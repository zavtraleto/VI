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
    expect(walk).toEqual({ boards: 4, worst: 2, lost: 0, capped: false, unsettled: 0, example: null });
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

  it('does not count lost a board the solver gave up on: the walk is not whole, and says how many it could not settle', () => {
    // The solver let see one board settles the boards one move clears and gives up on the rest.
    const walk = walkBoards(SMALL, 5000, { solveStates: 1 });
    expect(walk.boards).toBe(4);
    expect(walk.unsettled).toBeGreaterThan(0);
    expect(walk).toMatchObject({ lost: 0, capped: true, example: null });
    // A board that is lost is still counted, by a search that went through every way: P04, as above.
    const level = LEVELS.find((spec) => spec.id === 'P04')!;
    expect(walkBoards(level, 60)).toMatchObject({ unsettled: 0, example: 'EESN' });
  }, 30_000);

  it('is left as soon as it is not whole, where it is told to: at its limit, or at a board the solver gave up on', () => {
    const level = LEVELS.find((spec) => spec.id === 'P04')!;
    // Left at the board after the one whose moves filled the queue, the rest of the queue is not solved.
    const cut = walkBoards(level, 60, { capped: true });
    expect(cut).toMatchObject({ capped: true, boards: 60 });
    expect(cut.lost).toBeLessThan(walkBoards(level, 60).lost);
    expect(walkBoards(SMALL, 5000, { solveStates: 1, capped: true }).unsettled).toBe(1);
    // A walk that is whole is not left.
    expect(walkBoards(SMALL, 5000, { capped: true })).toEqual(walkBoards(SMALL));
  }, 30_000);

  it('is only for a level that is cleared, with nothing coming and no limit of moves', () => {
    expect(() => walkBoards({ ...SMALL, moves: 5 })).toThrow('walkBoards');
    expect(() => walkBoards({ ...SMALL, arrival: 'refill' })).toThrow('walkBoards');
  });

  it('is the same every time', () => {
    expect(walkBoards(ROAD[1])).toEqual(walkBoards(ROAD[1]));
  });
});
