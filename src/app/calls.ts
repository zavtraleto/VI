import type { Place } from '../levels/row';

/**
 * The calls: the live sessions as a layer of their own (docs/superpowers/specs/2026-11-05-vi-live-calls-design.md,
 * section 5). A call does not stand in the row: it comes by a rule, after a board passed in turn, and
 * may be taken or declined. These are the rule and what is kept of it; the game shows the call.
 */

/** The best score and the plays of a step of the calls. */
export interface CallStat {
  best: number;
  plays: number;
}

/** What is kept of the calls (`settings.levels.calls`). */
export interface CallProgress {
  /** Calls taken and seen to an end: faded out, or hung up after `CALL_DONE_SEC`. The next call is of the step one above. */
  done: number;
  /** Boards passed in turn since the last call came, taken or declined. */
  since: number;
  /** Boards this player waits between calls, drawn once: `CALL_GAP_MIN` to `CALL_GAP_MAX`. */
  gap: number;
  /** A call came once at least: the first comes after `CALL_FIRST_PLACE`, the next ones by the gap. */
  came: boolean;
  /** The best score and the plays of every step, by code `call-<step>`. */
  stats: Record<string, CallStat>;
}

/** The first call: after this place is passed (the owner, 20 October 2026: «первый звонок после 16-го места — отлично»). */
export const CALL_FIRST_PLACE = 16;
/** The boards between two calls, drawn anew after every call so that the player does not guess the beat. */
export const CALL_GAP_MIN = 8;
export const CALL_GAP_MAX = 14;
/** A call hung up after this many seconds is seen to its end, as one that faded out. */
export const CALL_DONE_SEC = 60;
/** The steps of the calls; the step past the last plays the last. */
export const CALL_STEPS = 7;

export function callCode(step: number): string {
  return `call-${step}`;
}

/** A gap of boards between calls, drawn from `random`. */
export function drawGap(random: () => number): number {
  return CALL_GAP_MIN + Math.min(CALL_GAP_MAX - CALL_GAP_MIN, Math.floor(random() * (CALL_GAP_MAX - CALL_GAP_MIN + 1)));
}

/** What a player who has had no call keeps of them. */
export function newCalls(random: () => number = Math.random): CallProgress {
  return { done: 0, since: 0, gap: drawGap(random), came: false, stats: {} };
}

/** The step of the next call: one above the calls seen to an end, and no further than the last. */
export function callStep(calls: CallProgress): number {
  return Math.min(CALL_STEPS, calls.done + 1);
}

/**
 * The step of the call that comes after the place just passed in turn (its index in the row), or
 * null for none. A call comes from `CALL_FIRST_PLACE` on: the first on the first such place, the
 * next ones once `gap` boards have been passed since the last; never after a peak or before one, for
 * a peak is a board to come to with a clear head and to leave with the feeling of it; and not after
 * the last place, where the end of the row has its window.
 */
export function callDue(placeIndex: number, calls: CallProgress, row: readonly Place[]): number | null {
  const place = row[placeIndex];
  const next = row[placeIndex + 1];
  if (!place || !next) return null;
  if (place.number < CALL_FIRST_PLACE) return null;
  if (place.role === 'peak' || next.role === 'peak') return null;
  if (calls.came && calls.since < calls.gap) return null;
  return callStep(calls);
}

/** After a board passed in turn: one more board since the last call. */
export function countBoard(calls: CallProgress): void {
  calls.since++;
}

/** A call came, taken or declined: the count of boards starts over, and the gap to the next is drawn again. */
export function callCame(calls: CallProgress, random: () => number): void {
  calls.since = 0;
  calls.came = true;
  calls.gap = drawGap(random);
}

/** How a call ended: it faded out on its clock, the player hung up, or the board filled and the line was lost. */
export type CallEnd = 'faded' | 'hangup' | 'full';

/** Is a call that ended so, after so many seconds, seen to its end? */
export function callDone(how: CallEnd, seconds: number): boolean {
  return how === 'faded' || (how === 'hangup' && seconds >= CALL_DONE_SEC);
}

/**
 * Notes a call that ended: one more play of its step, its score as the best where it is; and, when
 * it was seen to an end on the step the calls stand at, the step goes up. A step played again from
 * the list of calls raises nothing. True when the step went up.
 */
export function noteCall(calls: CallProgress, step: number, score: number, done: boolean): boolean {
  const stat = (calls.stats[callCode(step)] ??= { best: 0, plays: 0 });
  stat.plays++;
  stat.best = Math.max(stat.best, score);
  if (!done || step !== callStep(calls) || calls.done >= CALL_STEPS) return false;
  calls.done++;
  return true;
}

/** The score of a call already noted, doubled for an advertisement: the best only, no play is added. */
export function raiseCall(calls: CallProgress, step: number, score: number): CallStat {
  const stat = (calls.stats[callCode(step)] ??= { best: 0, plays: 0 });
  stat.best = Math.max(stat.best, score);
  return stat;
}

/**
 * The steps whose calls have been taken, in order: the list of calls of `ENDLESS`, and the screen of
 * `ENDLESS` opens once there is one. A call only declined will come again; a step that has not come
 * is not shown: what comes next, the game does not say (the owner, 5 November 2026).
 */
export function callsPlayed(calls: CallProgress): number[] {
  const steps: number[] = [];
  for (let step = 1; step <= CALL_STEPS; step++) if ((calls.stats[callCode(step)]?.plays ?? 0) > 0) steps.push(step);
  return steps;
}

/**
 * What a save from before the calls keeps of them: a player who played a live session of the row has
 * had a call, and one step for every session played, but no more than two (an old session 1 is about
 * step 3, and the player who played it starts after the gentle ones).
 */
export function callsFromLives(lives: Record<string, { plays?: number }> | undefined, random: () => number = Math.random): CallProgress {
  const calls = newCalls(random);
  const played = Object.values(lives ?? {}).filter((live) => (live?.plays ?? 0) > 0).length;
  calls.came = played > 0;
  calls.done = Math.min(2, played);
  return calls;
}
