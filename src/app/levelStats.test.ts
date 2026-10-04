import { describe, expect, it } from 'vitest';
import type { LevelStat } from '../platform/settings';
import type { LevelGoal, LevelSpec, RunState } from '../rules';
import { levelRun, put } from '../rules/testkit';
import { levelReport, shortOf } from './levelStats';

describe('level report', () => {
  const stat = (over: Partial<LevelStat>): LevelStat => ({
    tries: 1,
    passes: 0,
    fails: 0,
    firstPassTry: null,
    bestLeft: null,
    bestMoves: null,
    undos: 0,
    short: [],
    playMs: 0,
    ...over,
  });
  const levels: { id: string; goal: LevelGoal; moves: number }[] = [
    { id: 'a', goal: { kind: 'send', count: 6 }, moves: 20 },
    { id: 'b', goal: { kind: 'order', items: [{ value: 2, count: 4 }, { value: 3, count: 6 }] }, moves: 60 },
    { id: 'c', goal: { kind: 'chain', links: 3 }, moves: 9 },
    { id: 'd', goal: { kind: 'clear' }, moves: 0 },
  ];

  it('lists only the levels that were played, by number', () => {
    const text = levelReport(levels, {
      a: stat({ tries: 2, passes: 2, firstPassTry: 1, bestLeft: 14, bestMoves: 6, playMs: 41300 }),
      c: stat({ tries: 4, fails: 3, short: [2, 1, 1], playMs: 187400 }),
    });
    const lines = text.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('VI levels playtest, 2 of 4 levels played');
    expect(lines[1]).toBe('1. send 6, in 20 moves: passed on try 1, best 14 left, tries 2, passes 2, fails 0, 41s');
    expect(lines[2]).toBe('3. chain 3, in 9 moves: not passed, tries 4, passes 0, fails 3, short by 2 1 1, 187s');
  });

  it('names every face of an order, and shows the fails of a level passed later', () => {
    const text = levelReport(levels, { b: stat({ tries: 3, passes: 1, fails: 2, firstPassTry: 3, bestLeft: 0, bestMoves: 60, short: [5, 2], playMs: 90000 }) });
    expect(text.split('\n')[1]).toBe('2. order 4 of 2 and 6 of 3, in 60 moves: passed on try 3, best 0 left, tries 3, passes 1, fails 2, short by 5 2, 90s');
  });

  it('says of a level with no limit how few moves it took, and how many were taken back', () => {
    const text = levelReport(levels, { d: stat({ tries: 2, passes: 1, firstPassTry: 2, bestLeft: 0, bestMoves: 17, undos: 9, playMs: 240000 }) });
    expect(text.split('\n')[1]).toBe('4. clear the board, no limit: passed on try 2, best in 17 moves, tries 2, passes 1, fails 0, undos 9, 240s');
  });

  it('leaves out a level that was opened and not played', () => {
    expect(levelReport(levels, { a: stat({ tries: 0, playMs: 4000 }) })).toBe('');
  });

  it('is empty when nothing has been played', () => {
    expect(levelReport(levels, {})).toBe('');
  });

  it('is plain text that any messenger carries', () => {
    const text = levelReport(levels, {
      b: stat({ fails: 1, short: [3] }),
      c: stat({ passes: 1, firstPassTry: 1, bestLeft: 2, bestMoves: 7 }),
      d: stat({ passes: 1, firstPassTry: 1, bestLeft: 0, bestMoves: 12, undos: 2 }),
    });
    expect(text).toMatch(/^[\x20-\x7e\n]+$/);
  });
});

describe('how far short of its goal a level stands', () => {
  /** An empty board of a level with what a run has sent so far. */
  const run = (spec: Partial<LevelSpec>, sent: number[], bestChain = 0): RunState => {
    const state = levelRun(spec);
    state.levelRun!.sent = sent;
    state.levelRun!.bestChain = bestChain;
    return state;
  };

  it('is the dice not sent', () => {
    expect(shortOf(run({ goal: { kind: 'send', count: 12 } }, [0, 4, 3, 0, 0, 0]))).toBe(5);
  });

  it('adds up what every line of an order lacks, and nothing for a line that is full', () => {
    const goal: LevelGoal = { kind: 'order', items: [{ value: 2, count: 4 }, { value: 3, count: 6 }] };
    expect(shortOf(run({ goal }, [0, 8, 3, 0, 0, 0]))).toBe(3);
  });

  it('is the links a chain lacks', () => {
    expect(shortOf(run({ goal: { kind: 'chain', links: 3 } }, [0, 2, 0, 0, 0, 0], 1))).toBe(2);
  });

  it('is the dice that still stand on a board to be cleared', () => {
    const state = run({ goal: { kind: 'clear' }, arrival: 'none', norm: 5 }, [0, 2, 0, 0, 0, 0]);
    put(state, 0, 0, 3);
    put(state, 1, 0, 4);
    put(state, 4, 4, 2, 'sinking');
    expect(shortOf(state)).toBe(2);
  });

  it('is nothing for a goal that is met', () => {
    expect(shortOf(run({ goal: { kind: 'send', count: 2 } }, [0, 2, 0, 0, 0, 0]))).toBe(0);
  });
});
