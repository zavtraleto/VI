import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { STAR_POINTS, chaptersOf, gateOf, ladderProgress, levelStars, limitedLevel, moveLimit, starScore, starsHeld } from './progress';

/** A level as far as its place among the levels goes: its name, its chapter and the fewest moves it is cleared in. */
const level = (id: string, par: number | undefined, chapter = 0): LevelSpec => ({
  id, chapter, seed: 1, size: 3, values: [2], norm: 2, arrival: 'none', goal: { kind: 'clear' }, moves: 0, par,
});

describe('the stars of a level', () => {
  it('gives three within a move of the fewest, two within three moves more, one for any other pass', () => {
    expect(levelStars(4, 4)).toBe(3);
    expect(levelStars(5, 4)).toBe(3);
    expect(levelStars(6, 4)).toBe(2);
    expect(levelStars(8, 4)).toBe(2);
    expect(levelStars(9, 4)).toBe(1);
    expect(levelStars(40, 4)).toBe(1);
  });

  it('gives one for a pass of a level whose fewest moves are not known', () => {
    expect(levelStars(12, undefined)).toBe(1);
  });

  it('holds none on a level that has not been passed', () => {
    expect(starsHeld(null, 4)).toBe(0);
    expect(starsHeld(undefined, 4)).toBe(0);
    expect(starsHeld(5, 4)).toBe(3);
    expect(starsHeld(9, 4)).toBe(1);
  });
});

describe('the chapters of a list of levels', () => {
  it('are the levels that follow one another and name one chapter', () => {
    const of = (chapter: number) => ({ chapter });
    expect(chaptersOf([of(0), of(0), of(1), of(4), of(4), of(4)])).toEqual([
      { chapter: 0, from: 0, to: 2 },
      { chapter: 1, from: 2, to: 3 },
      { chapter: 4, from: 3, to: 6 },
    ]);
    expect(chaptersOf([{}, {}])).toEqual([{ chapter: 0, from: 0, to: 2 }]);
    expect(chaptersOf([])).toEqual([]);
  });
});

describe('the limit of moves of a level', () => {
  it('is generous and grows with the fewest moves: five times them and ten', () => {
    expect(moveLimit(1, 0)).toBe(15);
    expect(moveLimit(4, 0)).toBe(30);
    expect(moveLimit(8, 0)).toBe(50);
  });

  it('is that of the last chapter there is for a level that names a chapter past it, and of the first for one before it', () => {
    expect(moveLimit(4, 7)).toBe(30);
    expect(moveLimit(4, -1)).toBe(30);
  });

  it('is none for a level whose fewest moves are not known', () => {
    expect(moveLimit(undefined, 0)).toBe(0);
  });

  it('is laid on a level as it is started, and leaves the level as it is kept', () => {
    const levels = [level('A', 3), level('B', 6), level('C', undefined)];
    const limited = limitedLevel(levels, 1);
    expect(limited.moves).toBe(40);
    expect(limited).toEqual({ ...levels[1], moves: 40 });
    expect(levels[1].moves).toBe(0);
    // A level with no fewest moves known is played with no limit.
    expect(limitedLevel(levels, 2).moves).toBe(0);
  });
});

describe('the levels as a player has them', () => {
  const levels = [level('A', 4), level('B', 3), level('C', 6), level('D', 5)];
  /** Passed in so many moves; a level not named has not been passed. */
  const best = (moves: Record<string, number>) => (id: string) => moves[id] ?? null;

  it('hold the stars of the fewest moves every level was passed in, and none before a pass', () => {
    const progress = ladderProgress(levels, best({ A: 5, C: 10, D: 30 }));
    expect(progress.stars).toEqual([3, 0, 2, 1]);
    expect(progress.total).toBe(6);
    expect(ladderProgress(levels, () => null)).toMatchObject({ stars: [0, 0, 0, 0], total: 0 });
  });

  it('are all open in the chapters of the game: none has a gate, and none asks for stars', () => {
    expect(gateOf({ chapter: 0, from: 0, to: 20 })).toBe(0);
    // A chapter past the last there is goes by the rule of the last.
    expect(gateOf({ chapter: 3, from: 20, to: 30 })).toBe(0);
    const fresh = ladderProgress([...levels, level('E', 4, 1), level('F', 4, 1)], () => null);
    expect(fresh.chapters).toEqual([
      { chapter: 0, from: 0, to: 4, gate: 0, open: true },
      { chapter: 1, from: 4, to: 6, gate: 0, open: true },
    ]);
    expect(fresh.locked).toEqual([false, false, false, false, false, false]);
  });

  it('say of a level which chapter of the list it is in, counted from the first', () => {
    const progress = ladderProgress([level('A', 4), level('B', 4), level('C', 4, 2), level('D', 4, 5)], () => null);
    expect([0, 1, 2, 3].map(progress.chapterOf)).toEqual([0, 0, 1, 2]);
    expect(progress.chapterOf(9)).toBe(-1);
  });
});

describe('the score of the levels', () => {
  it('is the stars held on every board, a hundred points each', () => {
    const boards = [level('A', 4), level('B', 4), level('C', 4)];
    const best: Record<string, number> = { A: 4, B: 7 };
    expect(STAR_POINTS).toBe(100);
    expect(starScore(boards, (id) => best[id])).toBe(500);
    expect(starScore(boards, () => null)).toBe(0);
  });

  it('gains by a pass only the stars the board did not have', () => {
    const boards = [level('A', 4)];
    expect(starScore(boards, () => 9) - starScore(boards, () => null)).toBe(100);
    expect(starScore(boards, () => 4) - starScore(boards, () => 9)).toBe(200);
    expect(starScore(boards, () => 5) - starScore(boards, () => 4)).toBe(0);
  });
});
