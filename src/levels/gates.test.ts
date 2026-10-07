import { describe, expect, it, vi } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { GATE_SHARE, chaptersOf, gateOf, ladderProgress, limitedLevel, moveLimit } from './progress';

/**
 * The game has one chapter, with no gate and one limit of moves. What a chapter may ask for is
 * kept all the same: a gate that opens for a share of the stars before it, and a limit as tight
 * as the chapter says. It is tried here on three chapters written for this test, put in the
 * place of the game's own: an open one, and two with gates, each tighter than the one before.
 */
vi.mock('./recipes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./recipes')>()),
  CHAPTERS: [
    { key: 'open', times: 5, gate: false, floor: true, guard: 'none' },
    { key: 'gated', times: 4, gate: true, floor: true, guard: 'none' },
    { key: 'last', times: 3, gate: true, floor: true, guard: 'none' },
  ],
}));

const level = (id: string, par: number, chapter: number): LevelSpec => ({
  id, chapter, seed: 1, size: 3, values: [2], norm: 2, arrival: 'none', goal: { kind: 'clear' }, moves: 0, par,
});
/** Four levels of the open chapter, three of the next, two of the last; every one cleared in four moves. */
const LEVELS: readonly LevelSpec[] = [
  ...['A1', 'A2', 'A3', 'A4'].map((id) => level(id, 4, 0)),
  ...['B1', 'B2', 'B3'].map((id) => level(id, 4, 1)),
  ...['C1', 'C2'].map((id) => level(id, 4, 2)),
];
/** The first levels passed, each in so many moves over its fewest. */
const passedTo = (count: number, over: number) => (id: string) => {
  const index = LEVELS.findIndex((other) => other.id === id);
  return index < count ? LEVELS[index].par! + over : null;
};

describe('the limit of moves of a chapter', () => {
  it('is as tight as the chapter says: so many times the fewest moves, and ten', () => {
    expect(moveLimit(4, 0)).toBe(30);
    expect(moveLimit(4, 1)).toBe(26);
    expect(moveLimit(4, 2)).toBe(22);
    // Past the last chapter there is, the limit of the last.
    expect(moveLimit(4, 99)).toBe(22);
  });

  it('is laid on a level by the chapter it names, and never cuts short the way the level keeps', () => {
    expect(LEVELS.map((_, index) => limitedLevel(LEVELS, index).moves)).toEqual([30, 30, 30, 30, 26, 26, 26, 22, 22]);
    LEVELS.forEach((spec, index) => expect(limitedLevel(LEVELS, index).moves).toBeGreaterThanOrEqual(spec.par! + 10));
  });
});

describe('the gates of the chapters', () => {
  const chapters = chaptersOf(LEVELS);

  it('ask for nothing before a chapter with no gate, and for two fifths of the stars of the levels before any other', () => {
    expect(GATE_SHARE).toBe(0.4);
    // Twelve stars to be had before the second chapter, twenty-one before the third.
    expect(chapters.map(gateOf)).toEqual([0, 5, 9]);
  });

  it('keep the levels of a chapter shut until the stars held meet its gate', () => {
    const fresh = ladderProgress(LEVELS, () => null);
    expect(fresh.total).toBe(0);
    expect(fresh.chapters.map((chapter) => chapter.open)).toEqual([true, false, false]);
    expect(fresh.locked).toEqual([false, false, false, false, true, true, true, true, true]);

    // The open chapter passed with a star a level is a star short of the next.
    const plain = ladderProgress(LEVELS, passedTo(4, 9));
    expect(plain.total).toBe(4);
    expect(plain.chapters[1]).toMatchObject({ gate: 5, open: false });

    // Two levels a move over the fewest are six stars: the second chapter opens, and the third does not.
    const clean = ladderProgress(LEVELS, passedTo(2, 1));
    expect(clean.total).toBe(6);
    expect(clean.chapters.map((chapter) => chapter.open)).toEqual([true, true, false]);
    expect(clean.locked).toEqual([false, false, false, false, false, false, false, true, true]);
  });

  it('count the stars wherever they were earned', () => {
    // Three stars on three levels, one of them of the second chapter: nine, and the last chapter opens.
    const progress = ladderProgress(LEVELS, (id) => (['A1', 'A2', 'B1'].includes(id) ? 4 : null));
    expect(progress.total).toBe(9);
    expect(progress.chapters.every((chapter) => chapter.open)).toBe(true);
  });

  it('open every chapter when the gates are switched off', () => {
    const open = ladderProgress(LEVELS, () => null, false);
    expect(open.chapters.every((chapter) => chapter.open)).toBe(true);
    expect(open.locked.some((locked) => locked)).toBe(false);
    // What a chapter would ask for is said all the same.
    expect(open.chapters.map((chapter) => chapter.gate)).toEqual([0, 5, 9]);
  });
});
