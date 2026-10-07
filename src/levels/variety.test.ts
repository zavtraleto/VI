import { describe, expect, it } from 'vitest';
import type { LevelSpec, PuzzleDie } from '../rules/types';
import { arrange, sameBoard, shapeOf, traitsOf, unlike } from './variety';

/** A board of dice given by their cells and the faces on top; the player starts on the first. */
const board = (size: number, faces: number[], dice: readonly (readonly [number, number, number])[], solution: string[] = []): LevelSpec => ({
  id: 'test', seed: 1, size, values: faces, norm: dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces, solution,
  layout: { start: { x: dice[0][0], z: dice[0][1] }, dice: dice.map(([x, z, top]): PuzzleDie => ({ x, z, top, north: top === 1 || top === 6 ? 2 : 1 })) },
});

/** An L of three dice in the corner, the one in the corner a 6 with the player on it. */
const CORNER = board(3, [3], [[0, 0, 6], [1, 0, 3], [0, 1, 3]], ['0,0,E']);
/** The same L a quarter turn round: the corner is the one to the north-east. */
const TURNED = board(3, [3], [[2, 0, 6], [2, 1, 3], [1, 0, 3]], ['2,0,S']);
/** The same L with the player on another die of it. */
const OTHER_START = board(3, [3], [[1, 0, 3], [0, 0, 6], [0, 1, 3]], ['0,0,E']);
/** Three dice in a row. */
const ROW = board(3, [3], [[0, 0, 6], [1, 0, 3], [2, 0, 3]], ['0,0,S']);

describe('the shape dice stand in', () => {
  it('is the same for a board turned or mirrored, wherever on the board it stands', () => {
    expect(shapeOf(CORNER)).toBe(shapeOf(TURNED));
    expect(shapeOf(board(4, [3], [[2, 2, 3], [3, 2, 3], [2, 3, 3]]))).toBe(shapeOf(board(4, [3], [[0, 0, 5], [1, 0, 5], [0, 1, 5]])));
    expect(shapeOf(CORNER)).not.toBe(shapeOf(ROW));
  });
});

describe('a board that is another turned', () => {
  it('is the same board: its cells, the faces on top and the die of the start', () => {
    expect(sameBoard(CORNER, TURNED)).toBe(true);
    expect(sameBoard(CORNER, CORNER)).toBe(true);
  });

  it('is another board with another face on top, another start, another shape or other faces at work', () => {
    expect(sameBoard(CORNER, board(3, [3], [[0, 0, 5], [1, 0, 3], [0, 1, 3]]))).toBe(false);
    expect(sameBoard(CORNER, OTHER_START)).toBe(false);
    expect(sameBoard(CORNER, ROW)).toBe(false);
    expect(sameBoard(CORNER, { ...CORNER, faces: [6] })).toBe(false);
  });
});

describe('a board with cells cut out', () => {
  /** The L in the corner with the corner across from it cut out, and the same a quarter turn round, the cell turned with the dice. */
  const CUT = { ...CORNER, holes: [{ x: 2, z: 2 }] };
  const CUT_TURNED = { ...TURNED, holes: [{ x: 0, z: 2 }] };

  it('is another board than the one with the same dice and other cells cut out, or none', () => {
    expect(sameBoard(CUT, CORNER)).toBe(false);
    expect(sameBoard(CORNER, CUT)).toBe(false);
    expect(sameBoard(CUT, { ...CORNER, holes: [{ x: 2, z: 1 }] })).toBe(false);
    expect(sameBoard(CUT, { ...CORNER, holes: [{ x: 2, z: 2 }, { x: 2, z: 1 }] })).toBe(false);
    // A level that says it cuts out no cell is the square board.
    expect(sameBoard(CORNER, { ...CORNER, holes: [] })).toBe(true);
  });

  it('is the same board turned or mirrored where the cut-out cells are turned with the dice, and not where they stay', () => {
    expect(sameBoard(CUT, CUT)).toBe(true);
    expect(sameBoard(CUT, CUT_TURNED)).toBe(true);
    expect(sameBoard(CUT_TURNED, CUT)).toBe(true);
    // The dice turned and the cell left where it was: the cell is beside the L now, and not across from it.
    expect(sameBoard(CUT, { ...TURNED, holes: [{ x: 2, z: 2 }] })).toBe(false);
    // The order the cells are named in is nothing to the board.
    const two = { ...CORNER, holes: [{ x: 2, z: 2 }, { x: 2, z: 1 }] };
    expect(sameBoard(two, { ...CORNER, holes: [{ x: 2, z: 1 }, { x: 2, z: 2 }] })).toBe(true);
    // Mirrored about the line from the corner of the L, it lies on itself: the cells mirrored with it are (2,2) and (1,2).
    expect(sameBoard(two, { ...CORNER, holes: [{ x: 2, z: 2 }, { x: 1, z: 2 }] })).toBe(true);
  });

  it('has a shape of its own: the dice of two boards stand alike only where the boards are cut alike', () => {
    expect(shapeOf(CUT)).not.toBe(shapeOf(CORNER));
    expect(shapeOf(CUT)).toBe(shapeOf(CUT_TURNED));
    expect(shapeOf(CUT)).not.toBe(shapeOf({ ...CORNER, holes: [{ x: 2, z: 1 }] }));
    expect(unlike(traitsOf({ spec: CUT, clears: 1 }), traitsOf({ spec: CORNER, clears: 1 }))).toBe(1);
    expect(unlike(traitsOf({ spec: CUT, clears: 1 }), traitsOf({ spec: CUT_TURNED, clears: 1 }))).toBe(0);
  });

  it('is not taken twice into a ladder, turned or not, and is taken beside the square board of the same dice', () => {
    const fit = (spec: LevelSpec) => ({ spec, clears: 1 });
    expect(arrange([[fit(CUT)], [fit(CUT_TURNED)]])).toEqual([fit(CUT), null]);
    expect(arrange([[fit(CUT)], [fit(CORNER)]])).toEqual([fit(CUT), fit(CORNER)]);
  });
});

describe('the traits of a level', () => {
  it('are what it can differ from its neighbour in', () => {
    expect(traitsOf({ spec: CORNER, clears: 1 })).toEqual({ faces: '3', size: 3, dice: 3, shape: shapeOf(CORNER), ownFirst: true, combos: 1 });
    expect(traitsOf({ spec: OTHER_START, clears: 1 }).ownFirst).toBe(false);
  });

  it('are counted where two levels do not share them', () => {
    const corner = traitsOf({ spec: CORNER, clears: 1 });
    expect(unlike(corner, corner)).toBe(0);
    expect(unlike(corner, traitsOf({ spec: TURNED, clears: 1 }))).toBe(0);
    expect(unlike(corner, traitsOf({ spec: ROW, clears: 1 }))).toBe(1);
    expect(unlike(corner, traitsOf({ spec: { ...ROW, faces: [2] }, clears: 2 }))).toBe(3);
  });
});

describe('a ladder put together', () => {
  const fit = (spec: LevelSpec, clears = 1) => ({ spec, clears });

  it('takes the board that fits a place best where nothing speaks against it', () => {
    expect(arrange([[fit(CORNER), fit(ROW)]])).toEqual([fit(CORNER)]);
  });

  it('does not take one board twice, turned or not', () => {
    const [first, second] = arrange([[fit(CORNER)], [fit(TURNED), fit(ROW)]]);
    expect(first!.spec).toBe(CORNER);
    expect(second!.spec).toBe(ROW);
  });

  it('passes over a board that is like the one before it for one that is unlike it in two traits', () => {
    const row2 = { ...ROW, faces: [2] };
    const [, second] = arrange([[fit(CORNER)], [fit(ROW), fit(row2)]]);
    expect(second!.spec).toBe(row2);
  });

  it('takes the most unlike there is where none is unlike enough', () => {
    const [, second] = arrange([[fit(CORNER)], [fit(OTHER_START), fit(ROW)]]);
    // Each is unlike the corner in one trait; the first of them is taken.
    expect(second!.spec).toBe(OTHER_START);
  });

  it('leaves a place with no board empty, and goes on', () => {
    expect(arrange([[fit(CORNER)], [], [fit(ROW)]])).toEqual([fit(CORNER), null, fit(ROW)]);
    expect(arrange([[fit(CORNER)], [fit(TURNED)]])).toEqual([fit(CORNER), null]);
  });
});
