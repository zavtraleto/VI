import type { PlaygamaBridge } from '@playgama/bridge';

/**
 * The only place that talks to the platform the game is opened on: its language, its pause and
 * sound, its advertisement, its table of players, its analytics. The Playgama Bridge SDK stands
 * behind all of it, loaded by the page before the game. Where it is absent or did not start,
 * every call here does nothing and the game runs on its own.
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

/** Starts the SDK. Nothing else of the platform answers before this is over. */
export async function initPlatform(): Promise<void> {
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
}

/** The platform is there and has started. */
export function platformLive(): boolean {
  return sdk !== null;
}

/** The time it is now, by the clock of the platform where it has told it, else by the device. */
export function platformNow(): number {
  return Date.now() + clockAhead;
}

/**
 * On a platform the game stands in a frame of somebody else's page, and that page keeps the
 * keys until the frame is clicked. The game takes them to itself: when it opens, and again
 * when what the platform had over it is gone. It needs no SDK, and where the game is the page
 * itself it changes nothing.
 */
export function takeFocus(): void {
  window.focus();
}

/** The language the player has set on the platform, as `ru` or `en`; null where there is no platform. */
export function platformLanguage(): string | null {
  return sdk?.platform.language ?? null;
}

/** What the platform keeps under each key, as text; null for a key it has nothing under. Rejects where it cannot be read. */
export async function platformRead(keys: readonly string[]): Promise<(string | null)[]> {
  if (!sdk) throw new Error('no platform');
  const values = (await sdk.storage.get([...keys], false)) as unknown[];
  return keys.map((_, i) => {
    const value = values?.[i];
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

/** Hands the platform what to keep, all keys in one call. */
export function platformWrite(keys: readonly string[], values: readonly string[]): Promise<void> {
  if (!sdk) return Promise.reject(new Error('no platform'));
  return sdk.storage.set([...keys], [...values]);
}

/** What the game tells the platform about itself. */
export type PlatformMessage = 'game_ready' | 'level_started' | 'level_completed' | 'level_failed' | 'level_paused' | 'level_resumed' | 'player_got_achievement';

/** `level` is the name of what is being played: a kind of session, or a task. */
export function tell(message: PlatformMessage, level?: string): void {
  if (!sdk) return;
  void sdk.platform.sendMessage(message, level === undefined ? undefined : { world: 'vi', level }).catch(() => undefined);
}

/** The platform asks the game to stop and to go on: an advertisement is open, the page is hidden. Told at once how it stands now. */
export function onPlatformPause(listener: (paused: boolean) => void): void {
  if (!sdk) return;
  sdk.platform.on(sdk.EVENT_NAME.PAUSE_STATE_CHANGED, listener);
  if (sdk.platform.isPaused) listener(true);
}

/** The platform allows sound or takes it away. Told at once how it stands now. */
export function onPlatformAudio(listener: (enabled: boolean) => void): void {
  if (!sdk) return;
  sdk.platform.on(sdk.EVENT_NAME.AUDIO_STATE_CHANGED, listener);
  listener(sdk.platform.isAudioEnabled);
}

/**
 * An advertisement over the whole screen, at a break between sessions and never over play.
 * `done` is called when it has been closed, has failed, or was not shown at all: the platform
 * keeps its own count of how often one may come. One that is on its way is waited for, so it
 * does not open over the session that comes next.
 */
export function showInterstitial(done: () => void): void {
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
    // An advertisement that was open took the keys with it.
    takeFocus();
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
}

/** An event of the game for the analytics of the platform: a short name and plain values. */
export function track(event: string, data?: Record<string, string | number | boolean>): void {
  if (!sdk) return;
  try {
    sdk.analytics.send(event, data);
  } catch {
    // Analytics never gets in the way of the game.
  }
}

/**
 * The sample of frames the platform asks for. It goes the way of the game's own events until
 * the SDK has a way of its own for it: then only this function changes.
 */
export function trackPerformance(sample: Record<string, string | number | boolean>): void {
  track('performance_sample', sample);
}

/** A line of the table of players. */
export interface BoardEntry {
  rank: number;
  name: string;
  score: number;
  /** The line of the one who is playing. */
  own: boolean;
}

/** The platform has a table of players that the game draws itself. */
export function hasBoard(): boolean {
  return sdk?.leaderboards.type === 'in_game';
}

/** Hands a score to the table of the platform, whoever draws that table. */
export function submitScore(board: string, score: number): Promise<boolean> {
  if (!sdk || sdk.leaderboards.type === 'not_available') return Promise.resolve(false);
  return sdk.leaderboards.setScore(board, score).then(
    () => true,
    () => false,
  );
}

/** The top of the table, best first. Rejects where it cannot be read. */
export async function boardEntries(board: string): Promise<BoardEntry[]> {
  if (!sdk || !hasBoard()) throw new Error('no table');
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
}

/** The name the platform has for the one who plays; null where it has none, or there is no platform. */
export function playerName(): string | null {
  const name = sdk?.player.name?.trim();
  return name ? name : null;
}

/** Where the game is played: the address a player sends along with a result. */
export const GAME_URL = 'https://playgama.ai/play/hbhtrqdwvr';

/** What came of sending something out: it went to the sheet of the device, it lies on the clipboard, or neither. */
export type Shared = 'sent' | 'copied' | 'failed';

/** Puts text on the clipboard the way pages did before they were given one to write to. */
function copyByHand(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

/**
 * Sends a line of text out, with the address of the game under it. A phone has a sheet of its
 * own for this; anywhere else, and where the sheet is not allowed to a frame, the text goes to
 * the clipboard: through the platform where it has a way, else through the browser. Called
 * from a press of the player, as browsers ask.
 */
export async function shareOut(text: string): Promise<Shared> {
  const whole = `${text}\n${GAME_URL}`;
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (touch && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: whole });
      return 'sent';
    } catch (error) {
      // The player shut the sheet: nothing was asked for after all.
      if ((error as { name?: string } | null)?.name === 'AbortError') return 'failed';
    }
  }
  try {
    if (sdk?.clipboard.isSupported) {
      await sdk.clipboard.write(whole);
      return 'copied';
    }
  } catch {
    // The platform could not: the browser is asked.
  }
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(whole);
      return 'copied';
    }
  } catch {
    // No permission in this frame: the old way below needs none.
  }
  return copyByHand(whole) ? 'copied' : 'failed';
}

/** The player is a guest of a platform that can give them a name. */
export function canRegister(): boolean {
  return sdk !== null && sdk.player.isAuthorizationSupported && sdk.player.isGuest;
}

/** Opens the platform's own sign-in. Answers whether the player is known by name after it. */
export function register(): Promise<boolean> {
  if (!sdk) return Promise.resolve(false);
  const { player } = sdk;
  return player.authorize().then(
    () => !player.isGuest,
    () => false,
  );
}
