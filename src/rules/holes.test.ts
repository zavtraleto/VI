import { describe, expect, it } from 'vitest';
import { NO_CELL, cellIndex, cubeAt, isCell, isFree } from './board';
import { defaultConfig } from './config';
import { levelDeadEnd } from './level';
import { moveOf, moveText, movesAt, playMove, solveLevel } from './levelSolver';
import { resolveMove } from './movement';
import { createRun } from './sim';
import { act, levelRun, place, put, putOri } from './testkit';
import type { LevelSpec, PuzzleDie, RunState } from './types';

/** The rules of a level of the game: 2s work, a combo goes in two moves, nothing comes. */
const TWOS: Partial<LevelSpec> = { goal: { kind: 'clear' }, arrival: 'none', faces: [2], sinkMoves: 2, liftMoves: 1, norm: 4 };

/** An empty board of five cells a side with the cell (2,2) cut out of it, and whatever else the spec cuts. */
function holed(spec: Partial<LevelSpec> = {}): RunState {
  return levelRun({ ...TWOS, holes: [{ x: 2, z: 2 }], ...spec });
}

/** A board given die by die, three cells a side unless said; the player starts on the first die named. */
function board(dice: readonly PuzzleDie[], spec: Partial<LevelSpec> = {}): LevelSpec {
  return {
    id: 'test', seed: 1, size: 3, values: [2], faces: [2], sinkMoves: 2, liftMoves: 1, norm: dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0,
    layout: { dice, start: { x: dice[0].x, z: dice[0].z } },
    ...spec,
  };
}

describe('a cell cut out of the board of a level', () => {
  it('is no cell: it is never free, no die is there, and the cells beside it are as they were', () => {
    const s = holed();
    expect(s.grid[cellIndex(5, 2, 2)]).toBe(NO_CELL);
    expect(isCell(s, 2, 2)).toBe(false);
    expect(isFree(s, 2, 2)).toBe(false);
    expect(cubeAt(s, 2, 2)).toBeUndefined();
    expect(isCell(s, 1, 2)).toBe(true);
    expect(isFree(s, 1, 2)).toBe(true);
    // Off the square there is no cell either, as there never was.
    expect(isCell(s, 5, 2)).toBe(false);
  });

  it('takes no die rolled from on top, whatever the die', () => {
    const s = holed();
    put(s, 1, 2, 5);
    place(s, 1, 2, 'top');
    expect(resolveMove(s, 'E').kind).toBe('blocked');
    expect(resolveMove(s, 'W').kind).toBe('roll');
    expect(act(s, 'E')).toBe(true);
    // The command was taken and nothing moved: the die stands where it stood.
    expect(cubeAt(s, 1, 2)).toBeDefined();
    expect([s.player.x, s.player.z]).toEqual([1, 2]);
  });

  it('is not stepped down onto from a die that is leaving, nor walked onto over the floor', () => {
    // A pair is made at (0,2) and (1,2): the player is up on the die at (1,2), and east of it the cell is cut out.
    const s = holed();
    put(s, 0, 2, 2);
    // Rolled south, a die lays on top the face that looked north.
    putOri(s, 1, 1, { top: 6, north: 2 });
    // A die out on the edge that can be pushed along it keeps the level going.
    put(s, 3, 0, 5);
    place(s, 1, 1, 'top');
    act(s, 'S');
    expect(cubeAt(s, 1, 2)?.state).toBe('sinking');
    expect(resolveMove(s, 'E').kind).toBe('blocked');
    // Down to the south, where the floor is, and from there east of it the cell is there; north of that one it is not.
    expect(resolveMove(s, 'S').kind).toBe('descend');
    act(s, 'S');
    act(s, 'E');
    expect([s.player.x, s.player.z, s.player.level]).toEqual([2, 3, 'ground']);
    expect(resolveMove(s, 'N').kind).toBe('blocked');
  });

  it('is an edge to a die pushed from the floor: with it behind, the die is not pushed and not climbed', () => {
    const s = holed();
    put(s, 2, 1, 5);
    put(s, 4, 4, 2);
    put(s, 3, 4, 2);
    place(s, 2, 0, 'ground');
    // South of the die the cell is cut out.
    expect(resolveMove(s, 'S').kind).toBe('blocked');
    // From the side it has room behind it, and goes.
    place(s, 1, 1, 'ground');
    expect(resolveMove(s, 'E').kind).toBe('push');
    // Where a die that cannot be pushed is climbed, it is climbed with a cut-out cell behind it as with the edge.
    const open = holed({ climb: true });
    put(open, 2, 1, 5);
    place(open, 2, 0, 'ground');
    expect(resolveMove(open, 'S').kind).toBe('climb');
  });

  it('parts two dice that stand across it: they are not side by side', () => {
    // Rolled west, the die at (4,2) would stand at (3,2), across the cut-out cell from the 2 at (1,2): no combo.
    const s = holed();
    put(s, 1, 2, 2);
    putOri(s, 4, 2, { top: 6, east: 2 });
    put(s, 0, 4, 5);
    put(s, 4, 4, 5);
    place(s, 4, 2, 'top');
    act(s, 'W');
    expect(cubeAt(s, 3, 2)?.ori.top).toBe(2);
    expect(s.reactions).toHaveLength(0);
  });

  it('can leave the player nothing to push: a dead end of the floor, as against the edge', () => {
    /** The pair is made in the corner; two 2s are left, one in a corner and one on the south edge with the cells given cut out. */
    const left = (holes: LevelSpec['holes']): RunState => {
      const s = levelRun({ ...TWOS, holes });
      put(s, 0, 0, 2);
      putOri(s, 2, 0, { top: 6, east: 2 });
      put(s, 4, 0, 2);
      put(s, 2, 4, 2);
      place(s, 2, 0, 'top');
      act(s, 'W');
      return s;
    };
    // With the board whole, the die on the edge is pushed along it: the level goes on.
    const whole = left([]);
    expect(movesAt(whole).map(moveText)).toEqual(['2,4,E,p', '2,4,W,p']);
    expect(whole.over).toBe(false);
    // With the cells either side of it cut out, there is nowhere to push it to and nowhere to push it from.
    const cut = left([{ x: 1, z: 4 }, { x: 3, z: 4 }]);
    expect(movesAt(cut)).toEqual([]);
    expect(levelDeadEnd(cut)).toBe('floor');
    expect(cut.over).toBe(true);
    // One of them is enough to shut one push, and the other still goes: pushed west from the east side.
    expect(movesAt(left([{ x: 1, z: 4 }])).map(moveText)).toEqual([]);
    expect(movesAt(left([{ x: 0, z: 4 }])).map(moveText)).toEqual(['2,4,E,p', '2,4,W,p']);
  });
});

describe('a board with cells cut out, as it is given', () => {
  const pair: PuzzleDie[] = [{ x: 2, z: 0, top: 6, north: 3 }, { x: 0, z: 0, top: 2, north: 1 }];
  const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });

  it('is a board: its cells are marked on the run from the start', () => {
    const s = start(board(pair, { holes: [{ x: 1, z: 1 }, { x: 2, z: 2 }] }));
    expect(isCell(s, 1, 1)).toBe(false);
    expect(isCell(s, 2, 2)).toBe(false);
    expect(s.cubes).toHaveLength(2);
  });

  it('says what is wrong with it: a die on a cell that is not there, a cell cut out twice or off the square, a board in two parts', () => {
    expect(() => start(board(pair, { holes: [{ x: 0, z: 0 }] }))).toThrow(/a die on a cell that is cut out at 0,0/);
    expect(() => start(board(pair, { holes: [{ x: 1, z: 1 }, { x: 1, z: 1 }] }))).toThrow(/cut out twice at 1,1/);
    expect(() => start(board(pair, { holes: [{ x: 3, z: 0 }] }))).toThrow(/off the board at 3,0/);
    // The middle column gone, the board is two columns that do not touch.
    expect(() => start(board(pair, { holes: [{ x: 1, z: 0 }, { x: 1, z: 1 }, { x: 1, z: 2 }] }))).toThrow(/in two parts/);
  });

  it('is solved on its own cells: a way that would cross a cut-out cell is no way', () => {
    // With the cell between them there, one roll west makes the pair. With it cut out, the die has no way to the other at all.
    expect(solveLevel(board(pair)).solution?.par).toBe(1);
    const cut = board(pair, { holes: [{ x: 1, z: 0 }, { x: 1, z: 1 }] });
    const solved = solveLevel(cut, { maxMoves: 6 });
    expect(solved.exhausted).toBe(true);
    expect(solved.solution === null || solved.solution.par > 1).toBe(true);
    expect(movesAt(start(cut)).map(moveText)).toEqual(['2,0,S']);
    // The cells stay cut out on every board the search comes to.
    const after = playMove(start(cut), moveOf('2,0,S'));
    expect(isCell(after, 1, 0)).toBe(false);
    expect(movesAt(after).map(moveText)).not.toContain('2,1,W');
  });
});
