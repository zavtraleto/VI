/**
 * The first seconds of play as `?perf` writes them: the latest frame after the command that
 * starts, the latest frame around the first move, and what the game itself has measured then.
 * A stumble at the first move is then a number, read off the screen of the device it happened on.
 */

/** How long after the start the frames are looked at, and how long after the first move, in milliseconds. */
export const PLAY_MS = 10_000;
export const MOVE_MS = 600;
/** A measure that began this long before the start still counts: the press of the command opens the sound. */
const BEFORE_MS = 1000;
/** A frame later than this after the one before is felt. */
const LONG_MS = 33;
/** No more measures than this are named. */
const NAMED = 6;

/** A frame: when it came, how long after the one before, and how many shaders were built in it. */
export interface EarlyFrame {
  at: number;
  gap: number;
  shaders: number;
}

/** A measure of the page; those of the game have names that begin with `vi-`. */
export interface Measured {
  name: string;
  startTime: number;
  duration: number;
}

/**
 * Two lines. `play` and `move` are the moments of the marks `vi-play` and `vi-first-move`, null
 * until they are made. `frames` are the frames since the earlier of them.
 */
export function firstLines(frames: readonly EarlyFrame[], play: number | null, move: number | null, measures: readonly Measured[]): string {
  const from = play ?? move;
  if (from === null) return 'first: no start yet';
  const within = (since: number, ms: number): EarlyFrame[] => frames.filter((frame) => frame.at > since && frame.at <= since + ms);
  const worst = (list: readonly EarlyFrame[]): number => list.reduce((most, frame) => Math.max(most, frame.gap), 0);
  const parts: string[] = [];
  if (play !== null) {
    const list = within(play, PLAY_MS);
    parts.push(`start+${PLAY_MS / 1000}s max ${worst(list).toFixed(0)} >33ms ${list.filter((frame) => frame.gap > LONG_MS).length}`);
  }
  if (move !== null) {
    const list = within(move, MOVE_MS);
    parts.push(`move1 max ${worst(list).toFixed(0)} sh ${list.reduce((sum, frame) => sum + frame.shaders, 0)}`);
  }
  // The longest of each name, the longest names first.
  const longest = new Map<string, number>();
  for (const { name, startTime, duration } of measures) {
    if (!name.startsWith('vi-') || startTime < from - BEFORE_MS || startTime > from + PLAY_MS) continue;
    const short = name.slice(3);
    longest.set(short, Math.max(longest.get(short) ?? 0, duration));
  }
  const named = [...longest].sort((a, b) => b[1] - a[1]).slice(0, NAMED);
  const said = named.length > 0 ? named.map(([name, ms]) => `${name} ${ms.toFixed(0)}`).join('  ') : 'none';
  return `${parts.join('  ')}\nvi: ${said}`;
}
