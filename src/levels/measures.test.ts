import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../rules/config';
import { moveOf, movesAt, solveLevel, tryWay } from '../rules/levelSolver';
import { createRun } from '../rules/sim';
import { ori } from '../rules/testkit';
import type { LevelSpec, Orientation, PuzzleDie } from '../rules/types';
import { decoyOf, farOf, firstsOf, islandsOf, oneFaceClears, rideTurn, rides, silenceOf, tailOf, trapOf, underOf } from './measures';

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

/**
 * A board to clear as a level of the game is played: the floor open and strict, so that the one
 * way up from it is a die that is leaving. The player starts on the first die named.
 */
const open = (size: number, faces: number[], dice: PuzzleDie[]): LevelSpec => ({ ...level(size, faces, { x: dice[0].x, z: dice[0].z }, dice), floor: undefined });

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

describe('the silence of a way', () => {
  it('is the longest run of moves with no event between two events', () => {
    expect(silenceOf([true, false, false, true])).toBe(2);
    expect(silenceOf([true, true, false, true])).toBe(1);
    expect(silenceOf([false, true, false, true, false, false, false, true])).toBe(3);
  });

  it('does not count the quiet moves before the first event: nothing is going yet', () => {
    expect(silenceOf([false, false, false, true, true])).toBe(0);
    expect(silenceOf([false, false, true, false, true])).toBe(1);
  });

  it('is nothing for a way of one event or none, whatever comes after the last', () => {
    expect(silenceOf([])).toBe(0);
    expect(silenceOf([true])).toBe(0);
    expect(silenceOf([false, false])).toBe(0);
    expect(silenceOf([true, false, false])).toBe(0);
  });
});

describe('the clusters a board starts in', () => {
  it('are counted by the dice joined by their sides', () => {
    // An L of three.
    expect(islandsOf(open(3, [3], [die(0, 0, { top: 3 }), die(1, 0, { top: 3 }), die(0, 1, { top: 5 })]))).toBe(1);
    // A pair, and a die two cells off.
    expect(islandsOf(open(3, [3], [die(0, 0, { top: 3 }), die(1, 0, { top: 3 }), die(2, 2, { top: 5 })]))).toBe(2);
    expect(islandsOf(open(4, [3], [die(0, 0, { top: 3 }), die(2, 0, { top: 3 }), die(0, 2, { top: 5 }), die(3, 3, { top: 5 })]))).toBe(4);
  });

  it('are not joined by a corner', () => {
    expect(islandsOf(open(3, [3], [die(0, 0, { top: 3 }), die(1, 1, { top: 3 }), die(2, 2, { top: 5 })]))).toBe(3);
  });

  it('are none for a level with no board of its own', () => {
    const { layout: _layout, ...seeded } = open(3, [3], [die(0, 0, { top: 3 })]);
    expect(islandsOf(seeded)).toBe(0);
  });
});

/** The die the player starts on shows its 2 rolled west, beside the 2 in the corner: one roll, and the board is clear. */
const ONE_PAIR = open(3, [2], [die(2, 0, { top: 6, east: 2 }), die(0, 0, { top: 2 })]);
/**
 * The same pair, and a second one further down the west side: a die beside the corner that shows
 * its 2 rolled south, next to a 2 that stands there. It is come to over the first pair while that
 * is leaving, and made with a roll: the pair at hand loses nothing.
 */
const TWO_PAIRS = open(4, [2], [die(2, 0, { top: 6, east: 2 }), die(0, 0, { top: 2 }), die(0, 1, { top: 6, north: 2 }), die(0, 3, { top: 2 })]);
/**
 * Two pairs again, and the second is the other way about: a 2 under the die of the start, and a
 * die in the east corner that shows its 2 rolled south, beside that 2. The pair in the west corner
 * is at hand, one roll away, and made first it is a trap: the player is left on it with no die a
 * step away, a die is not rolled from the floor, and the die in the corner is not even pushed.
 * The other pair first, and the player walks back over it to the die of the start.
 */
const CUT_OFF = open(4, [2], [die(2, 0, { top: 6, east: 2 }), die(0, 0, { top: 2 }), die(2, 1, { top: 2 }), die(3, 0, { top: 6, north: 2 })]);
/**
 * Three dice where pairs go: the third has to join the pair within its two moves. The die of the
 * start makes the pair with one roll east, beside the 2. The third die stands beside that 2, a
 * step away, with its own 2 on the east side: it shows it rolled west, away from the pair, and no
 * two rolls bring it to the pair showing it. Rolled round a square first, west, south, east and
 * north, it comes back beside the 2 with its own 2 on top: that is the pair, and the die of the
 * start joins it.
 */
const WRONG_SIDE = open(3, [2], [die(1, 0, { top: 6, west: 2 }), die(2, 1, { top: 2 }), die(1, 1, { top: 6, east: 2 })]);

describe('a trap of order', () => {
  it('is none on a board its combos can be made on in any order, or that one combo clears', () => {
    expect(trapOf(ONE_PAIR)).toBeNull();
    expect(tryWay(TWO_PAIRS, way('2,0,W', '0,1,S')).state.endReason).toBe('passed');
    expect(trapOf(TWO_PAIRS)).toBeNull();
  });

  it('is a combo at hand that leaves a board that cannot be cleared', () => {
    expect(tryWay(WRONG_SIDE, way('1,1,W', '0,1,S', '0,2,E', '1,2,N', '1,0,E')).state.endReason).toBe('passed');
    // The pair made first: the third die is rolled and rolled, the pair goes, and it is left alone.
    expect(tryWay(WRONG_SIDE, way('1,0,E', '1,1,W', '0,1,E')).state.endReason).toBe('failed');
    expect(trapOf(WRONG_SIDE)).toBe('any');
  });

  it('is one of the floor where the combo leaves the player on it with no die to step to', () => {
    expect(tryWay(CUT_OFF, way('3,0,S', '2,0,W')).state.endReason).toBe('passed');
    expect(trapOf(CUT_OFF)).toBe('floor');
  });

  it('is none where the board is cleared after all: on a wider board the die in the corner is pushed beside the leaving pair, and climbed by it', () => {
    expect(trapOf({ ...CUT_OFF, size: 5 })).toBeNull();
  });

  it('is not said of a board the search could not settle', () => {
    expect(trapOf(WRONG_SIDE, 1)).toBeNull();
  });
});

/**
 * A pair and a three, each a roll away: the die of the start shows its 2 rolled east, beside the
 * 2 in the corner, and the die under it shows its 3 rolled south, beside the two 3s. Neither
 * face clears the five dice alone.
 */
const PAIR_AND_THREE = open(4, [2, 3], [die(1, 0, { top: 6, west: 2 }), die(3, 0, { top: 2 }), die(2, 1, { top: 3, north: 2 }), die(2, 2, { top: 3, north: 2 }), die(1, 1, { top: 6, north: 3 })]);
/** A 2 that stands alone, with its 3 to the west: rolled east it lies beside two 3s, a 3 itself. */
const LONE_TWO = open(3, [2, 3], [die(0, 0, { top: 2, west: 3 }), die(1, 1, { top: 3 }), die(2, 1, { top: 3 })]);
/** Two 3s side by side and a 2 beside them: one 3 rolls west and shows a 2 next to that 2, and the other is rolled to them as a 2 as well. */
const TWO_THREES = open(3, [2, 3], [die(1, 0, { top: 3, east: 2 }), die(1, 1, { top: 3, south: 2 }), die(0, 1, { top: 2 })]);

describe('one face at work alone', () => {
  it('clears a board that is made of its combos, and not one that takes two faces', () => {
    expect(tryWay(PAIR_AND_THREE, way('1,0,E', '1,1,S')).state.endReason).toBe('passed');
    expect(oneFaceClears(PAIR_AND_THREE, 2, 4)).toBe(false);
    expect(oneFaceClears(PAIR_AND_THREE, 3, 4)).toBe(false);
    // Three dice that go as three 3s with one roll.
    expect(oneFaceClears(LONE_TWO, 3, 1)).toBe(true);
    expect(oneFaceClears(LONE_TWO, 2, 4)).toBe(false);
  });

  it('is asked within so many moves and no more', () => {
    expect(oneFaceClears(LONE_TWO, 3, 0)).toBe(false);
    expect(oneFaceClears(TWO_THREES, 2, 1)).toBe(false);
    expect(oneFaceClears(TWO_THREES, 2, 2)).toBe(true);
  });

  it('is said to clear a board the search could not settle: only a search that saw every board says it does not', () => {
    expect(oneFaceClears(PAIR_AND_THREE, 2, 4, 1)).toBe(true);
  });

  it('leaves the level as it was', () => {
    const before = JSON.stringify(PAIR_AND_THREE);
    oneFaceClears(PAIR_AND_THREE, 3, 4);
    expect(JSON.stringify(PAIR_AND_THREE)).toBe(before);
  });
});

describe('a combo nearly made that is not what it looks', () => {
  it('is a 2 standing alone that goes as another face', () => {
    expect(tryWay(LONE_TWO, way('0,0,E')).values).toEqual([3]);
    expect(decoyOf(LONE_TWO, way('0,0,E'))).toBe(true);
  });

  it('is dice side by side, one short of their combo, of which one goes as another face', () => {
    expect(tryWay(TWO_THREES, way('1,0,W', '1,1,N')).values).toEqual([2, 2]);
    expect(decoyOf(TWO_THREES, way('1,0,W', '1,1,N'))).toBe(true);
  });

  it('is not dice that go as what they show', () => {
    // The lone 2 in the corner goes as a 2.
    expect(decoyOf(ONE_PAIR, way('2,0,W'))).toBe(false);
    // The two 3s go as 3s, and the pair as 2s.
    expect(decoyOf(PAIR_AND_THREE, way('1,0,E', '1,1,S'))).toBe(false);
  });

  it('is not a die showing a face that does not work: there it is no combo nearly made', () => {
    expect(decoyOf({ ...LONE_TWO, faces: [3] }, way('0,0,E'))).toBe(false);
  });

  it('is told by the way: on a way that moves none of those dice there is none', () => {
    expect(decoyOf(LONE_TWO, [])).toBe(false);
  });
});
