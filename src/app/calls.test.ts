import { describe, expect, it } from 'vitest';
import type { Place } from '../levels/row';
import {
  CALL_DONE_SEC,
  CALL_FIRST_PLACE,
  CALL_GAP_MAX,
  CALL_GAP_MIN,
  callCame,
  callDone,
  callDue,
  callStep,
  callsPlayed,
  callsFromLives,
  countBoard,
  newCalls,
  noteCall,
  raiseCall,
  type CallProgress,
} from './calls';

/** A row of `count` places numbered from 1; the places of `peaks` (numbers) are peaks. */
function row(count: number, peaks: number[] = []): Place[] {
  return Array.from({ length: count }, (_, i) => ({ number: i + 1, code: `P${i + 1}`, role: peaks.includes(i + 1) ? 'peak' : 'apply' }) as unknown as Place);
}

/** Passes the places of a row in turn from the first, as the game does: counts the board, asks for a call; a call that comes is declined. Gives the numbers of the places calls came after. */
function walk(calls: CallProgress, places: Place[], take?: (step: number) => void): number[] {
  const came: number[] = [];
  for (let i = 0; i < places.length; i++) {
    countBoard(calls);
    const step = callDue(i, calls, places);
    if (step === null) continue;
    came.push(places[i].number);
    callCame(calls, () => 0.5);
    take?.(step);
  }
  return came;
}

describe('the rule a call comes by', () => {
  it('brings the first call after the 16th place, of step 1', () => {
    const places = row(40);
    const calls = newCalls(() => 0);
    for (let i = 0; i < CALL_FIRST_PLACE - 1; i++) expect(callDue(i, calls, places), `place ${i + 1}`).toBeNull();
    expect(callDue(CALL_FIRST_PLACE - 1, calls, places)).toBe(1);
  });

  it('does not come after a peak, nor before one: the first then comes on the next place that will do', () => {
    const calls = newCalls(() => 0);
    expect(callDue(15, calls, row(40, [16]))).toBeNull();
    expect(callDue(15, calls, row(40, [17]))).toBeNull();
    expect(walk(newCalls(() => 0), row(40, [17]))[0]).toBe(17 + 1);
  });

  it('does not come after the last place: the end of the row has its window there', () => {
    expect(callDue(16, newCalls(), row(17))).toBeNull();
  });

  it('keeps the gap between calls', () => {
    const calls = newCalls(() => 0);
    const came = walk(calls, row(80));
    expect(came[0]).toBe(16);
    for (let i = 1; i < came.length; i++) {
      expect(came[i] - came[i - 1]).toBeGreaterThanOrEqual(CALL_GAP_MIN);
      expect(came[i] - came[i - 1]).toBeLessThanOrEqual(CALL_GAP_MAX);
    }
    expect(came.length).toBeGreaterThan(3);
  });

  it('draws the gap from 8 to 14 boards', () => {
    expect(newCalls(() => 0).gap).toBe(CALL_GAP_MIN);
    expect(newCalls(() => 0.999).gap).toBe(CALL_GAP_MAX);
    for (let r = 0; r < 1; r += 0.05) {
      const gap = newCalls(() => r).gap;
      expect(gap).toBeGreaterThanOrEqual(CALL_GAP_MIN);
      expect(gap).toBeLessThanOrEqual(CALL_GAP_MAX);
    }
  });

  it('brings a declined call back of the same step, after the gap', () => {
    const calls = newCalls(() => 0);
    const steps: number[] = [];
    walk(calls, row(60), (step) => steps.push(step));
    expect(steps.length).toBeGreaterThan(2);
    expect(new Set(steps)).toEqual(new Set([1]));
  });

  it('raises the step only for calls seen to an end', () => {
    const calls = newCalls(() => 0);
    const steps: number[] = [];
    let turn = 0;
    walk(calls, row(90), (step) => {
      steps.push(step);
      const how = (['faded', 'full', 'hangup', 'hangup'] as const)[turn % 4];
      const seconds = turn % 4 === 2 ? CALL_DONE_SEC - 1 : 120;
      noteCall(calls, step, 100, callDone(how, seconds));
      turn++;
    });
    // faded: up; full: no; hung up before a minute: no; hung up after: up.
    expect(steps.slice(0, 5)).toEqual([1, 2, 2, 2, 3]);
  });
});

describe('a call seen to its end', () => {
  it('is one that faded out, or was hung up after a minute', () => {
    expect(callDone('faded', 10)).toBe(true);
    expect(callDone('hangup', CALL_DONE_SEC)).toBe(true);
    expect(callDone('hangup', CALL_DONE_SEC - 1)).toBe(false);
    expect(callDone('full', 179)).toBe(false);
  });

  it('notes its play and its best, and a step played again raises nothing', () => {
    const calls = newCalls();
    expect(noteCall(calls, 1, 300, true)).toBe(true);
    expect(callStep(calls)).toBe(2);
    expect(noteCall(calls, 1, 200, true)).toBe(false);
    expect(callStep(calls)).toBe(2);
    expect(calls.stats['call-1']).toEqual({ best: 300, plays: 2 });
    expect(raiseCall(calls, 1, 600)).toEqual({ best: 600, plays: 2 });
    expect(raiseCall(calls, 1, 500)).toEqual({ best: 600, plays: 2 });
  });

  it('goes no further than the seventh step', () => {
    const calls = newCalls();
    for (let i = 0; i < 12; i++) noteCall(calls, callStep(calls), 1, true);
    expect(calls.done).toBe(7);
    expect(callStep(calls)).toBe(7);
  });
});

describe('the list of calls', () => {
  it('shows the steps whose calls were taken, and none declined or ahead', () => {
    const calls = newCalls();
    callCame(calls, () => 0);
    expect(callsPlayed(calls)).toEqual([]);
    noteCall(calls, 1, 10, true);
    expect(callsPlayed(calls)).toEqual([1]);
    expect(callStep(calls)).toBe(2);
    noteCall(calls, 2, 10, false);
    expect(callsPlayed(calls)).toEqual([1, 2]);
  });
});

describe('a save from before the calls', () => {
  it('has had a call when a live session was played, and starts after the gentle steps at most', () => {
    expect(callsFromLives(undefined)).toMatchObject({ came: false, done: 0 });
    expect(callsFromLives({ 'live-1': { plays: 0 } })).toMatchObject({ came: false, done: 0 });
    expect(callsFromLives({ 'live-1': { plays: 2 } })).toMatchObject({ came: true, done: 1 });
    expect(callsFromLives({ 'live-1': { plays: 1 }, 'live-2': { plays: 1 }, 'live-3': { plays: 4 } })).toMatchObject({ came: true, done: 2, stats: {}, heard: [] });
  });
});
