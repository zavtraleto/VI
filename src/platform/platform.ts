/**
 * Everything the game asks of the place it is played on, and the game without one. The game
 * reads the platform from `@platform` only: the build puts there `none` or the adapter of a
 * platform (platforms/). This file knows no platform.
 */

/** What the game tells the platform about itself. */
export type PlatformMessage =
  | 'game_ready'
  | 'level_started'
  | 'level_completed'
  | 'level_failed'
  | 'level_paused'
  | 'level_resumed'
  | 'player_got_achievement';

/** Where a rewarded advertisement stands: the way on a board, the doubled score of a live session. An adapter names it to its platform as it is here. */
export type RewardedPlacement = 'show_way' | 'double_score';

/** Plain values of an analytics event. */
export type PlatformData = Record<string, string | number | boolean>;

/** What came of sending something out: it went to the sheet of the device, it lies on the clipboard, or neither. */
export type Shared = 'sent' | 'copied' | 'failed';

/** A line of the table of players. */
export interface BoardEntry {
  rank: number;
  name: string;
  score: number;
  /** The line of the one who is playing. */
  own: boolean;
}

/** What the platform keeps for the player, as text by key. */
export interface PlatformStorage {
  /** Text under each key; null for a key it has nothing under. Rejects where it cannot be read. */
  read(keys: readonly string[]): Promise<(string | null)[]>;
  /** All keys in one call, as the platform asks. */
  write(keys: readonly string[], values: readonly string[]): Promise<void>;
}

/** The table of players of the platform. */
export interface PlatformLeaderboard {
  /** The game draws the table itself, so its lines can be read (`entries`). */
  readonly inGame: boolean;
  /** Hands a score to the table, whoever draws it. Answers whether it was taken. */
  submit(board: string, score: number): Promise<boolean>;
  /** The top of the table, best first. Rejects where it cannot be read. */
  entries(board: string): Promise<BoardEntry[]>;
  /** The name the player has on the platform; null for a guest. */
  playerName(): string | null;
}

/** The platform's own sign-in. */
export interface PlatformAuth {
  /** The player is a guest the platform can give a name. */
  readonly guest: boolean;
  /** Opens the sign-in. Answers whether the player is known by name after it. */
  register(): Promise<boolean>;
}

/**
 * Everything the game asks of the place it is played on. `storage`, `leaderboard` and `auth`
 * are read after `init()` is over; before it, and where the platform did not start, they are null.
 */
export interface Platform {
  /** Starts the platform. Waits for it no longer than the adapter allows; never rejects. */
  init(): Promise<void>;
  /** The language the player has set on the platform (`ru`, `en`); null where it has none. */
  language(): string | null;
  /** The time it is now, by the clock of the platform where it has one, else by the device. */
  now(): number;
  readonly storage: PlatformStorage | null;
  /** `level` is the name of what is being played: the session, or a level. */
  tell(message: PlatformMessage, level?: string): void;
  /** The platform asks the game to stop and to go on. Told at once how it stands now, if it knows. */
  onPause(listener: (paused: boolean) => void): void;
  /** The platform allows sound or takes it away. Told at once how it stands now, if it knows. */
  onAudio(listener: (enabled: boolean) => void): void;
  /** An advertisement between sessions. `done` is called once: closed, failed, or not shown. */
  interstitial(done: () => void): void;
  /** Whether the platform shows advertisements between sessions: what brings one says so only then. */
  readonly interstitialSupported: boolean;
  /** Whether the platform shows rewarded advertisements: a button for one is drawn only then. */
  readonly rewardedSupported: boolean;
  /** Shows a rewarded advertisement; `done(true)` only when the platform says it was watched to the end. Called once. */
  rewarded(placement: RewardedPlacement, done: (rewarded: boolean) => void): void;
  /** An event of the game for the analytics of the platform. */
  track(event: string, data?: PlatformData): void;
  /** The sample of frames the platform asks for (`FrameSampler` in src/app/telemetry.ts). */
  trackPerformance(sample: PlatformData): void;
  readonly leaderboard: PlatformLeaderboard | null;
  /** Sends text out as it is: the sheet of a phone, else the clipboard. Called from a press of the player. */
  share(text: string): Promise<Shared>;
  /** Where the game is played: the address a player sends along with a result; null where there is none. */
  readonly gameUrl: string | null;
  readonly auth: PlatformAuth | null;
}

/**
 * On a platform the game stands in a frame of somebody else's page, and that page keeps the
 * keys until the frame is clicked. The game takes them to itself: when it opens, and again
 * when what the platform had over it is gone. Where the game is the page itself it changes nothing.
 */
export function takeFocus(): void {
  window.focus();
}

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
 * Sends a line of text out. A phone has a sheet of its own for this; anywhere else, and where
 * the sheet is not allowed to a frame, the text goes to the clipboard: through `copy` where it
 * is given (the clipboard of a platform), else through the browser. Called from a press of the
 * player, as browsers ask.
 */
export async function browserShare(text: string, copy?: (text: string) => Promise<void>): Promise<Shared> {
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (touch && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'sent';
    } catch (error) {
      // The player shut the sheet: nothing was asked for after all.
      if ((error as { name?: string } | null)?.name === 'AbortError') return 'failed';
    }
  }
  try {
    if (copy) {
      await copy(text);
      return 'copied';
    }
  } catch {
    // The platform could not: the browser is asked.
  }
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    // No permission in this frame: the old way below needs none.
  }
  return copyByHand(text) ? 'copied' : 'failed';
}

/** No platform: the game runs on its own. Nothing is kept but in the browser, nothing is told, nothing is shown over the game. */
export const none: Platform = {
  init: () => Promise.resolve(),
  language: () => null,
  now: () => Date.now(),
  storage: null,
  tell: () => undefined,
  onPause: () => undefined,
  onAudio: () => undefined,
  interstitial: (done) => done(),
  interstitialSupported: false,
  rewardedSupported: false,
  rewarded: (_, done) => done(false),
  track: () => undefined,
  trackPerformance: () => undefined,
  leaderboard: null,
  share: (text) => browserShare(text),
  gameUrl: null,
  auth: null,
};
