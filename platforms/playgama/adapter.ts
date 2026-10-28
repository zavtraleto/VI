import type { PlaygamaBridge } from '@playgama/bridge';
import {
  browserShare,
  none,
  type BoardEntry,
  type Platform,
  type PlatformAuth,
  type PlatformData,
  type PlatformLeaderboard,
  type PlatformStorage,
} from '../../src/platform/platform';

/**
 * The game on Playgama: its language, its pause and sound, its advertisement, its table of
 * players, its analytics. The Bridge SDK stands behind all of it, put in the page before the
 * game by `vite.ts` here. Where it is absent or did not start, every member is that of `none`,
 * and the game runs on its own.
 */

/** A start of the SDK that has not finished by then is not waited for. */
const INIT_PATIENCE_MS = 8000;
/** Nothing has been heard of an advertisement by then: none is coming. */
const AD_SILENCE_MS = 1500;
/** One that is being fetched and has not opened by then is not waited for. */
const AD_LOADING_MS = 8000;
/** The break the advertisement stands in: named in `playgama-bridge-config.json`. */
const AD_PLACEMENT = 'session_end';

let sdk: PlaygamaBridge | null = null;
/** How far the clock of the platform is ahead of the clock of the device, once the platform has said. */
let clockAhead = 0;

/** An event of the game for the analytics of the platform: a short name and plain values. */
function track(event: string, data?: PlatformData): void {
  if (!sdk) return;
  try {
    sdk.analytics.send(event, data);
  } catch {
    // Analytics never gets in the way of the game.
  }
}

const storage: PlatformStorage = {
  async read(keys) {
    if (!sdk) throw new Error('no platform');
    const values = (await sdk.storage.get([...keys], false)) as unknown[];
    return keys.map((_, i) => {
      const value = values?.[i];
      if (value === null || value === undefined) return null;
      return typeof value === 'string' ? value : JSON.stringify(value);
    });
  },
  write(keys, values) {
    if (!sdk) return Promise.reject(new Error('no platform'));
    return sdk.storage.set([...keys], [...values]);
  },
};

const leaderboard: PlatformLeaderboard = {
  get inGame() {
    return sdk?.leaderboards.type === 'in_game';
  },
  submit(board, score) {
    if (!sdk || sdk.leaderboards.type === 'not_available') return Promise.resolve(false);
    return sdk.leaderboards.setScore(board, score).then(
      () => true,
      () => false,
    );
  },
  async entries(board): Promise<BoardEntry[]> {
    if (!sdk || !leaderboard.inGame) throw new Error('no table');
    const answer = (await sdk.leaderboards.getEntries(board)) as unknown;
    const list = Array.isArray(answer) ? answer : ((answer as { entries?: unknown } | null)?.entries ?? []);
    if (!Array.isArray(list)) return [];
    const own = sdk.player.id;
    return list
      .map((entry: { id?: unknown; name?: unknown; score?: unknown; rank?: unknown }, i) => ({
        rank: Number(entry.rank) || i + 1,
        name: typeof entry.name === 'string' ? entry.name.trim() : '',
        score: Number(entry.score) || 0,
        own: own !== null && own !== '' && String(entry.id) === String(own),
      }))
      .sort((a, b) => a.rank - b.rank);
  },
  /**
   * A guest has no name here: what the SDK calls them is their number (`Guest sA7p…`), and the
   * name the platform shows for them stands only in its tables.
   */
  playerName() {
    if (!sdk || sdk.player.isGuest) return null;
    const name = sdk.player.name?.trim();
    return name ? name : null;
  },
};

const auth: PlatformAuth = {
  get guest() {
    return sdk?.player.isGuest ?? false;
  },
  register() {
    if (!sdk) return Promise.resolve(false);
    const { player } = sdk;
    return player.authorize().then(
      () => !player.isGuest,
      () => false,
    );
  },
};

export const platform = {
  async init() {
    const candidate = (globalThis as { bridge?: PlaygamaBridge }).bridge;
    if (!candidate) return;
    try {
      const started = candidate.initialize().then(() => true);
      const patience = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), INIT_PATIENCE_MS));
      if (!(await Promise.race([started, patience]))) return;
      candidate.gameVersion = import.meta.env.VI_VERSION;
      sdk = candidate;
      // The day everyone shares is counted by the clock of the platform, where it has one. Not waited for.
      const asked = Date.now();
      void candidate.platform.getServerTime().then(
        (time) => {
          if (typeof time === 'number' && Number.isFinite(time)) clockAhead = time - (asked + Date.now()) / 2;
        },
        () => undefined,
      );
    } catch {
      // The game runs without the platform.
    }
  },
  language: () => sdk?.platform.language ?? none.language(),
  now: () => Date.now() + clockAhead,
  get storage() {
    return sdk ? storage : null;
  },
  tell(message, level) {
    if (!sdk) return;
    void sdk.platform.sendMessage(message, level === undefined ? undefined : { world: 'vi', level }).catch(() => undefined);
  },
  onPause(listener) {
    if (!sdk) return;
    sdk.platform.on(sdk.EVENT_NAME.PAUSE_STATE_CHANGED, listener);
    if (sdk.platform.isPaused) listener(true);
  },
  onAudio(listener) {
    if (!sdk) return;
    sdk.platform.on(sdk.EVENT_NAME.AUDIO_STATE_CHANGED, listener);
    listener(sdk.platform.isAudioEnabled);
  },
  /**
   * An advertisement over the whole screen, at a break between sessions, and on a level after every
   * third move taken back, once the move is back (the owner, 23 October 2026).
   * The platform keeps its own count of how often one may come. One that is on its way is
   * waited for, so it does not open over the session that comes next.
   */
  interstitial(done) {
    const bridge = sdk;
    if (!bridge || !bridge.advertisement.isInterstitialSupported) {
      done();
      return;
    }
    const { LOADING, OPENED, CLOSED, FAILED } = bridge.INTERSTITIAL_STATE;
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      bridge.advertisement.off(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState);
      done();
    };
    let timer = window.setTimeout(finish, AD_SILENCE_MS);
    const onState = (state: string): void => {
      if (state === CLOSED || state === FAILED) {
        finish();
        return;
      }
      // While it is being fetched it is given some time; once it is on screen, only its end counts.
      window.clearTimeout(timer);
      if (state === LOADING) timer = window.setTimeout(finish, AD_LOADING_MS);
      else if (state !== OPENED) timer = window.setTimeout(finish, AD_SILENCE_MS);
    };
    bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState);
    try {
      bridge.advertisement.showInterstitial(AD_PLACEMENT);
    } catch {
      finish();
    }
  },
  get interstitialSupported() {
    return sdk?.advertisement.isInterstitialSupported ?? false;
  },
  get rewardedSupported() {
    return sdk?.advertisement.isRewardedSupported ?? false;
  },
  /**
   * An advertisement the player has asked for, for something in the game (docs/superpowers/specs/2026-10-23-vi-rewarded-ads-design.md).
   * What it is for is given only where the platform says it was watched (`rewarded`), and the
   * game hears of it once the advertisement is closed: a close with no `rewarded` before it, a
   * failure, and an advertisement that never comes give nothing.
   */
  rewarded(placement, done) {
    const bridge = sdk;
    if (!bridge || !bridge.advertisement.isRewardedSupported) {
      done(false);
      return;
    }
    const { LOADING, OPENED, REWARDED, CLOSED, FAILED } = bridge.REWARDED_STATE;
    let finished = false;
    let earned = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onState);
      done(earned);
    };
    let timer = window.setTimeout(finish, AD_SILENCE_MS);
    const onState = (state: string): void => {
      if (state === REWARDED) earned = true;
      if (state === CLOSED || state === FAILED) {
        finish();
        return;
      }
      // While it is being fetched it is given some time; once it is on screen, only its end counts.
      window.clearTimeout(timer);
      if (state === LOADING) timer = window.setTimeout(finish, AD_LOADING_MS);
      else if (state !== OPENED && state !== REWARDED) timer = window.setTimeout(finish, AD_SILENCE_MS);
    };
    bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, onState);
    try {
      bridge.advertisement.showRewarded(placement);
    } catch {
      finish();
    }
  },
  track,
  // The sample of frames goes the way of the game's own events until the SDK has a way of its own for it.
  trackPerformance: (sample) => track('performance_sample', sample),
  get leaderboard() {
    return sdk && sdk.leaderboards.type !== 'not_available' ? leaderboard : null;
  },
  /** The clipboard of the platform is asked before the browser's, where it has one. */
  share(text) {
    const bridge = sdk;
    return browserShare(text, bridge?.clipboard.isSupported ? (whole) => bridge.clipboard.write(whole) : undefined);
  },
  /** Where the game is played: the address a player sends along with a result. */
  gameUrl: 'https://playgama.ai/play/hbhtrqdwvr',
  get auth() {
    return sdk?.player.isAuthorizationSupported ? auth : null;
  },
} satisfies Platform;
