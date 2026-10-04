import { RECORDS, eraDate } from '../shell/text';
import { ARCHIVE_ENDLESS, ARCHIVE_TIMED } from './archiveData';
import type { Day } from './daily';

/**
 * What stands in the log of sessions before anyone has played: the program's own archive. The
 * program was used before the player, and its log is not empty. The scores are real ones - the
 * player made of the rules has played every session (`node scripts/archive.mjs`) - and the
 * lines are written as the program writes its records, not as players of the platform: the six
 * best are the records of the six subjects, the rest are earlier sessions by their dates. The
 * best of all is the record of the sixth, far over the others.
 */
export interface ArchiveLine {
  name: string;
  score: number;
  /** A record of one of the six. */
  subject: boolean;
}

/** Lines of the archive in a log, and how many of them are the records of the six. */
export const ARCHIVE_LINES = 50;
const SUBJECTS = 6;

const DAY_MS = 86_400_000;
/** The days the sessions of the archive are of: none is later than the last start the program remembers, H13.03.21. */
const FIRST_DAY = Date.UTC(1998, 3, 1) / DAY_MS;
const LAST_DAY = Date.UTC(2001, 2, 21) / DAY_MS;

/** Numbers between 0 and 1 from a seed: the same seed gives the same log. */
function chance(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** A working day of the archive's years, as the program writes a date. */
function sessionDate(rand: () => number): string {
  let day = FIRST_DAY + Math.floor(rand() * (LAST_DAY - FIRST_DAY + 1));
  // The institute did not sit at the table on a Saturday or a Sunday: 1 January 1970 was a Thursday.
  const weekday = (((day + 4) % 7) + 7) % 7;
  if (weekday === 6) day -= 1;
  else if (weekday === 0) day -= 2;
  return eraDate(new Date(day * DAY_MS).toISOString().slice(0, 10));
}

/**
 * The lines of a log from its scores, best first: the best is the record of the sixth, the
 * five after it are those of the others, in no order; the rest get dates.
 */
function lines(scores: readonly number[], seed: number): ArchiveLine[] {
  const rand = chance(seed);
  const others = [1, 2, 3, 4, 5];
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const numbers = [SUBJECTS, ...others];
  return [...scores]
    .sort((a, b) => b - a)
    .map((score, i) =>
      i < SUBJECTS ? { name: `${RECORDS.subject} 0${numbers[i]}`, score, subject: true } : { name: sessionDate(rand), score, subject: false },
    );
}

let endless: ArchiveLine[] | null = null;
/** The archive of the day last asked for: it is asked for on every frame the log is drawn. */
let daily: { seed: number; lines: ArchiveLine[] } | null = null;

/** The archive of the sessions without a limit: the same lines always. */
export function endlessArchive(): readonly ArchiveLine[] {
  endless ??= lines(ARCHIVE_ENDLESS.slice(0, ARCHIVE_LINES), 6);
  return endless;
}

/**
 * The archive of the session of a day. The table of the day starts anew every day, and so does
 * what the program has in it: the lines of a day are taken from a pool of sessions by the seed
 * of that day, one from every stretch of the pool, so each day has its weak and its strong ones.
 */
export function dailyArchive(day: Pick<Day, 'seed'>): readonly ArchiveLine[] {
  if (daily?.seed === day.seed) return daily.lines;
  const pool = ARCHIVE_TIMED.filter((score) => score > 0).sort((a, b) => b - a);
  const rand = chance(day.seed);
  const count = Math.min(ARCHIVE_LINES, pool.length);
  const picked: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * pool.length) / count);
    const to = Math.floor(((i + 1) * pool.length) / count);
    picked.push(pool[from + Math.floor(rand() * (to - from))]);
  }
  daily = { seed: day.seed, lines: lines(picked, day.seed ^ 0x51ed270b) };
  return daily.lines;
}
