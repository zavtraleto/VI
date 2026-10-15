import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { STAR_POINTS, levelStars, starScore, starsHeld } from './progress';

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
