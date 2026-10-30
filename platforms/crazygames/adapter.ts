import { browserShare, none, type Platform, type PlatformStorage } from '../../src/platform/platform';

/**
 * The game on CrazyGames: its language, its saves (the Data module), its sound setting, the
 * breaks of play it is told of, its advertisement. The SDK v3 stands behind all of it, put in
 * the page before the game by `vite.ts` here (docs.crazygames.com/sdk/intro). Where it is
 * absent, or says it is `disabled` (any site but CrazyGames and localhost), every member is
 * that of `none`, and the game runs on its own.
 *
 * What CrazyGames has not: analytics of the game's own events (the SDK reports only purchases),
 * a table of players a game can read (theirs is by invitation, and drawn by CrazyGames), a
 * clock of its own. Those are left as `none` has them.
 */

/** The part of the SDK v3 the adapter uses (docs.crazygames.com/sdk). */
interface AdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: { code?: string; message?: string }) => void;
}
interface CrazySdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled' | string;
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    /** What is being played, attached by CrazyGames to what a player writes about the game. */
    setGameContext?(context: Record<string, string>): void;
    clearGameContext?(): void;
    settings: { muteAudio?: boolean; disableChat?: boolean };
    addSettingsChangeListener(listener: (settings: { muteAudio?: boolean }) => void): void;
  };
  ad: {
    requestAd(type: 'midgame' | 'rewarded', callbacks: AdCallbacks): unknown;
  };
  data: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
  user: {
    systemInfo?: { locale?: string };
  };
}

/** A start of the SDK that has not finished by then is not waited for: off CrazyGames it waits 7 s for an answer of its own. */
const INIT_PATIENCE_MS = 8000;
/** An advertisement asked for that has not started by then is not waited for. */
const AD_LOADING_MS = 8000;
/** The codes after which no advertisement comes in this visit: the Basic Launch, the kids' mode, a game played offline. */
const ADS_OFF = new Set(['adsDisabled', 'adsDisabledBasicLaunch']);

let sdk: CrazySdk | null = null;
/**
 * No advertisement in this visit: what brings one is not drawn. A Basic Launch has none, and
 * CrazyGames rejects a game whose button for a rewarded one does nothing; the SDK says so only
 * when one is asked for. So a build has advertisements only when asked for with
 * `VITE_CRAZYGAMES_ADS=on` (for the Full Launch), and in it the platform may still turn them off.
 */
let adsOff = import.meta.env.VITE_CRAZYGAMES_ADS !== 'on';
/** The game is in play, as CrazyGames has been told: each break and each return is said once. */
let inPlay = false;
/** An advertisement is on screen: the game is told to wait, as when a platform pauses it. */
let adOn = false;
const pauseListeners: ((paused: boolean) => void)[] = [];

function call(action: () => void): void {
  try {
    action();
  } catch {
    // A platform that refuses changes nothing of the game.
  }
}

function setPlay(playing: boolean): void {
  if (!sdk || playing === inPlay) return;
  inPlay = playing;
  const game = sdk.game;
  call(() => (playing ? game.gameplayStart() : game.gameplayStop()));
}

function setAd(on: boolean): void {
  if (on === adOn) return;
  adOn = on;
  for (const listener of pauseListeners) listener(on);
}

/**
 * One advertisement, by its callbacks: `done(watched)` once, when it is over, failed, or never
 * came. The game waits while it is on screen, and only then (docs: mute on `adStarted`).
 */
function showAd(type: 'midgame' | 'rewarded', done: (watched: boolean) => void): void {
  const crazy = sdk;
  if (!crazy || adsOff) {
    done(false);
    return;
  }
  let finished = false;
  const finish = (watched: boolean): void => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    setAd(false);
    done(watched);
  };
  const timer = window.setTimeout(() => finish(false), AD_LOADING_MS);
  try {
    crazy.ad.requestAd(type, {
      adStarted: () => {
        window.clearTimeout(timer);
        setAd(true);
      },
      adFinished: () => finish(true),
      adError: (error) => {
        if (error?.code && ADS_OFF.has(error.code)) adsOff = true;
        finish(false);
      },
    });
  } catch {
    finish(false);
  }
}

/** The Data module: the save of the player, kept with their account where they have one (docs.crazygames.com/sdk/data). */
const storage: PlatformStorage = {
  async read(keys) {
    if (!sdk) throw new Error('no platform');
    const data = sdk.data;
    return keys.map((key) => data.getItem(key));
  },
  async write(keys, values) {
    if (!sdk) throw new Error('no platform');
    const data = sdk.data;
    keys.forEach((key, i) => data.setItem(key, values[i]));
  },
};

/**
 * CrazyGames asks that the page in its frame does not scroll under the game: the wheel and the
 * keys that scroll a page are kept by the game (docs.crazygames.com/resources/html5/common-fixes).
 */
function holdThePage(): void {
  window.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'ArrowDown') event.preventDefault();
  });
}

export const platform = {
  async init() {
    const candidate = (globalThis as { CrazyGames?: { SDK?: CrazySdk } }).CrazyGames?.SDK;
    if (!candidate) return;
    try {
      const started = candidate.init().then(() => true);
      const patience = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), INIT_PATIENCE_MS));
      if (!(await Promise.race([started, patience]))) return;
      if (candidate.environment === 'disabled') return;
      sdk = candidate;
      holdThePage();
      // The opening goes on until the game has its first picture (`game_ready`).
      call(() => candidate.game.loadingStart());
    } catch {
      // The game runs without the platform.
    }
  },
  /** The language of the player's browser as CrazyGames reads it (`en-US`): the game takes the part before the dash. */
  language: () => sdk?.user.systemInfo?.locale ?? none.language(),
  now: () => Date.now(),
  get storage() {
    return sdk ? storage : null;
  },
  /**
   * The breaks of play: CrazyGames measures the opening up to the first `gameplayStart`, and
   * asks for `gameplayStop` at every menu, pause and end (docs.crazygames.com/sdk/game). A page
   * that is hidden and an advertisement on screen are none of these: the platform sees them itself.
   */
  tell(message, level) {
    if (!sdk) return;
    const game = sdk.game;
    if (message === 'game_ready') call(() => game.loadingStop());
    else if (message === 'level_started') {
      setPlay(true);
      // A player's report on the game comes with what they were playing (docs: `setGameContext`).
      if (level !== undefined) call(() => game.setGameContext?.({ level }));
    } else if (message === 'level_completed' || message === 'level_failed') {
      setPlay(false);
      call(() => game.clearGameContext?.());
    }
    else if ((message === 'level_paused' || message === 'level_resumed') && !document.hidden && !adOn) setPlay(message === 'level_resumed');
  },
  /** CrazyGames pauses nothing by events of its own: the game waits while an advertisement it asked for is on screen. */
  onPause(listener) {
    if (!sdk) return;
    pauseListeners.push(listener);
  },
  /** The sound setting of CrazyGames stands over the game's own (docs: `muteAudio` has priority). */
  onAudio(listener) {
    if (!sdk) return;
    const game = sdk.game;
    game.addSettingsChangeListener((settings) => listener(!settings.muteAudio));
    listener(!game.settings.muteAudio);
  },
  /** A midgame advertisement. CrazyGames keeps its own count of how often one may come (about once in three minutes). */
  interstitial(done) {
    showAd('midgame', () => done());
  },
  get interstitialSupported() {
    return sdk !== null && !adsOff;
  },
  get rewardedSupported() {
    return sdk !== null && !adsOff;
  },
  /** The reward is given on `adFinished` only, as CrazyGames asks; an error gives nothing. */
  rewarded(_placement, done) {
    showAd('rewarded', done);
  },
  track: none.track,
  trackPerformance: none.trackPerformance,
  leaderboard: null,
  share: (text) => browserShare(text),
  gameUrl: null,
  auth: null,
} satisfies Platform;
