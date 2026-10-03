/**
 * The session with a limit is the session of the day: everyone plays it from one seed, and
 * the table of players it counts towards starts anew each day. A day is a day of UTC.
 */

const DAY_MS = 86_400_000;
/** The day before the first one the table counts: 31 December 2025, as days since 1970. */
const DAY_ZERO = Date.UTC(2026, 0, 1) / DAY_MS - 1;
/** Room a score has under the number of its day. */
const SCORE_ROOM = 1_000_000;

export interface Day {
  /** Days since 1 January 1970, UTC. */
  index: number;
  /** The same as YYYY-MM-DD. */
  date: string;
  /** What the session of that day is dealt from. */
  seed: number;
}

/** The day a moment falls on. */
export function dayAt(ms: number): Day {
  const index = Math.floor(ms / DAY_MS);
  // The days are told apart well: neighbouring numbers give seeds that share nothing.
  let seed = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b);
  seed = Math.imul(seed ^ (seed >>> 13), 0xc2b2ae35);
  seed = (seed ^ (seed >>> 16)) >>> 0;
  return { index, date: new Date(index * DAY_MS).toISOString().slice(0, 10), seed };
}

/**
 * A score as the table of the day keeps it. The table of the platform never starts anew by
 * itself, so the day stands in front of the score: a score of today is above every score of
 * the days before, and the top of the table is the table of today.
 */
export function dailyValue(day: number, score: number): number {
  return (day - DAY_ZERO) * SCORE_ROOM + Math.min(Math.max(0, Math.round(score)), SCORE_ROOM - 1);
}

/** The day and the score a value of the table stands for. */
export function readDailyValue(value: number): { day: number; score: number } {
  const whole = Math.max(0, Math.round(value));
  return { day: Math.floor(whole / SCORE_ROOM) + DAY_ZERO, score: whole % SCORE_ROOM };
}
