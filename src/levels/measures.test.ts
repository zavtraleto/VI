import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../rules/config';
import { moveOf, movesAt, solveLevel, tryWay } from '../rules/levelSolver';
import { createRun } from '../rules/sim';
import { ori } from '../rules/testkit';
import type { LevelSpec, Orientation, PuzzleDie } from '../rules/types';
import { farOf, firstsOf, rideTurn, rides, tailOf, underOf } from './measures';

/** A die of a board, lying as the faces given say. */
const die = (x: number, z: number, faces: Partial<Orientation>): PuzzleDie => {
  const lie = ori(faces);
  return { x, z, top: lie.top, north: lie.north };
};

/** A board to clear with its floor shut, where only `faces` work and a die that has joined a combo goes in two moves. */
const level = (size: number, faces: number[], start: { x: number; z: number }, dice: PuzzleDie[]): LevelSpec => ({
  id: 'test', seed: 1, size, values: faces, norm: dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces, sinkMoves: 2, liftMoves: 1, floor: false,
  layout: { start, dice },
});

const way = (...moves: string[]) => moves.map(moveOf);

describe('the tail of a way', () => {
  it('is nothing for a way that clears once, and the moves after the clearing before the last for one that clears more', () => {
    expect(tailOf([false, false, true])).toBe(0);
    expect(tailOf([true, true])).toBe(1);
    expect(tailOf([false, true, false, false, true])).toBe(3);
    expect(tailOf([])).toBe(0);
  });
});

describe('dice with a working face at the bottom', () => {
  it('are counted by the face under the top', () => {
    // Where 3s work, a die showing a 4 has its 3 underneath.
    const board = level(3, [3], { x: 0, z: 0 }, [die(0, 0, { top: 4 }), die(2, 2, { top: 3 }), die(2, 1, { top: 5 })]);
    expect(underOf(board)).toBe(1);
    expect(underOf({ ...board, faces: [2, 3] })).toBe(2);
  });
});

describe('a ride on the side', () => {
  // Two 3s stand at (2,0) and (2,1). The die at (0,2) has its 3 to the west: rolled north twice it
  // keeps the 3 on that side, and rolled east it lays the 3 on top beside them.
  const board = level(3, [3], { x: 0, z: 2 }, [die(2, 0, { top: 3 }), die(2, 1, { top: 3 }), die(0, 2, { top: 6, west: 3 })]);

  it('clears the board it is laid for', () => {
    expect(tryWay(board, way('0,2,N', '0,1,N', '0,0,E')).state.endReason).toBe('passed');
  });

  it('is a way of the own die rolled along and then turned, the face on its side all the while', () => {
    expect(rides(board, way('0,2,N', '0,1,N', '0,0,E'))).toBe(true);
    expect(rides(board, way('0,2,N', '0,1,E'))).toBe(true);
  });

  it('is not a way that turns first: the face that rides is not one that works', () => {
    expect(rides(board, way('0,2,E', '1,2,N', '1,1,N'))).toBe(false);
  });

  it('is not one roll, nor a way that goes on along, nor one that turns back', () => {
    expect(rides(board, way('0,2,E'))).toBe(false);
    expect(rides(board, way('0,2,N', '0,1,N'))).toBe(false);
    expect(rides(board, way('0,2,N', '0,1,S'))).toBe(false);
  });

  it('is not a way that begins with another die', () => {
    expect(rides(board, way('2,1,W', '1,1,S'))).toBe(false);
  });
});

describe('the way to the die of the first move', () => {
  const board = level(3, [3], { x: 0, z: 0 }, [die(0, 0, { top: 3 }), die(1, 0, { top: 3 }), die(2, 0, { top: 6, north: 3 })]);

  it('is counted in steps over the dice', () => {
    expect(farOf(board, way('2,0,S'))).toBe(2);
    expect(farOf(board, way('1,0,S'))).toBe(1);
    expect(farOf(board, way('0,0,S'))).toBe(0);
  });

  it('is none where no steps lead to that die', () => {
    const apart = level(3, [3], { x: 0, z: 0 }, [die(0, 0, { top: 3 }), die(2, 2, { top: 3 })]);
    expect(farOf(apart, way('2,2,N'))).toBe(-1);
  });
});

describe('first moves that keep a board in hand', () => {
  it('are those after which the board is still cleared in as many moves as it took from the start', () => {
    // Two dice where 2s work.
    const board = level(3, [2], { x: 0, z: 0 }, [die(0, 0, { top: 6, east: 2 }), die(2, 0, { top: 2 })]);
    const { par } = solveLevel(board).solution!;
    const firsts = firstsOf(board, par);
    expect(firsts).toBeGreaterThanOrEqual(1);
    expect(firsts).toBeLessThanOrEqual(movesAt(createRun({ seed: 1, config: defaultConfig(), level: board })).length);
    // Asked for the rest in no moves at all, only a first move that clears the board is good.
    expect(firstsOf(board, 0)).toBe(par === 1 ? firsts : 0);
  });
});

describe('the turn of a ride', () => {
  // The die at (0,2) has its 3 to the south, at the player: rolled east it keeps it there, and rolled north it lays it on top.
  const board = level(3, [3], { x: 0, z: 2 }, [die(0, 2, { top: 6, south: 3 }), die(2, 0, { top: 3 }), die(2, 1, { top: 5 })]);

  it('is the side the die is turned to: north, where the face that rode looked at the player', () => {
    expect(rideTurn(board, way('0,2,E', '1,2,N'))).toBe('N');
    expect(rideTurn(board, way('0,2,N', '0,1,E'))).toBeNull();
  });
});
