import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { LEVELS } from './levels';
import { ROAD } from './road';
import { walkBoards } from './walk';

/**
 * The third piece of the road as its first edition had it: two cells by two, the die of the
 * player and a fixed 2 it is rolled to. Four boards in all, and none of them lost.
 */
const SMALL: LevelSpec = {
  id: 'X03', seed: 8103, size: 2, values: [2], faces: [2], norm: 2, floor: false, arrival: 'none', goal: { kind: 'clear' }, moves: 0, undos: 3, sinkMoves: 2, liftMoves: 1, chapter: 0, exact: true,
  layout: { start: { x: 1, z: 1 }, dice: [{ x: 1, z: 1, top: 6, north: 3 }, { x: 0, z: 0, top: 2, north: 1, fixed: true }] },
  par: 1, solution: ['1,1,W'],
};

/** The boards the player can come to, by moves and by steps, and what is left of the board from each. */
describe('the walk over the boards a player can come to', () => {
  it('counts the boards of a small piece, the most moves to clear any of them, and finds none lost', () => {
    const walk = walkBoards(SMALL);
    expect(walk).toMatchObject({ boards: 4, worst: 2, lost: 0, capped: false, example: null });
  });

  it('finds the boards of a level from which the board cannot be cleared, and the commands that lead to the first', () => {
    // P03 of the list is wide open (the walk over it is thousands of boards long); P04 loses the board in four commands.
    const walk = walkBoards(LEVELS.find((spec) => spec.id === 'P04')!, 60);
    expect(walk.lost).toBeGreaterThan(0);
    expect(walk.example).toBe('EESN');
  }, 30_000);

  it('is left at the first board lost, or the first that takes more moves than is asked, where it is told to', () => {
    const level = LEVELS.find((spec) => spec.id === 'P04')!;
    const early = walkBoards(level, 5000, { lost: true });
    expect(early).toMatchObject({ lost: 1, example: 'EESN', capped: false });
    expect(early.boards).toBeLessThan(80);
    expect(walkBoards(ROAD[1], 5000, { worst: 3 }).worst).toBeGreaterThan(3);
    expect(walkBoards(ROAD[1], 5000, { worst: 6 })).toEqual(walkBoards(ROAD[1]));
  }, 30_000);

  it('stops at the limit, says so, and counts only the boards it has seen', () => {
    const walk = walkBoards(SMALL, 3);
    expect(walk.capped).toBe(true);
    expect(walk.boards).toBe(3);
    expect(walkBoards(SMALL, 4).capped).toBe(false);
  });

  it('is the same every time', () => {
    expect(walkBoards(ROAD[1])).toEqual(walkBoards(ROAD[1]));
  });
});
