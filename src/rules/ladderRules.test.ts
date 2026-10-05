import { describe, expect, it } from 'vitest';
import { DELTA, DIRS, cubeAt } from './board';
import { chainWindows, levelStuck, shortGroups, smallestGroup } from './level';
import { previewMove } from './preview';
import { act, levelRun, place, put, putOri } from './testkit';
import type { LevelSpec, RunState } from './types';

/** The rules of the ladder: only 3s work, and a die that has joined a group goes in two moves. */
const THREES: Partial<LevelSpec> = { goal: { kind: 'clear' }, arrival: 'none', faces: [3], sinkMoves: 2, liftMoves: 1 };

/**
 * Two 3s stand in the corner; the die at (3,0) rolled west makes the third. A die at (2,3) is
 * there to make moves with that clear nothing, and one more stands far off.
 */
function board(spec: Partial<LevelSpec> = {}): RunState {
  const s = levelRun({ ...THREES, norm: 5, ...spec });
  put(s, 0, 0, 3);
  put(s, 1, 0, 3);
  putOri(s, 3, 0, { top: 6, east: 3 });
  putOri(s, 2, 3, { top: 6, north: 2 });
  put(s, 4, 4, 5);
  place(s, 3, 0, 'top');
  return s;
}

/** One move that clears nothing, made with the die the player is on. */
function idleMove(s: RunState): void {
  for (const dir of DIRS) {
    const seen = previewMove(s, dir);
    const empty = cubeAt(s, s.player.x + DELTA[dir].dx, s.player.z + DELTA[dir].dz) === undefined;
    if (seen.kind === 'roll' && !seen.clears && empty) {
      act(s, dir);
      return;
    }
  }
  throw new Error('no roll that clears nothing');
}

describe('the faces that work on a level', () => {
  it('are the only ones that make a group: two 2s side by side stay where only 3s work', () => {
    const s = levelRun({ ...THREES, norm: 4 });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 4, 4, 5);
    put(s, 4, 3, 4);
    place(s, 2, 0, 'top');
    expect(previewMove(s, 'W').clears).toBe(false);
    act(s, 'W');
    expect(s.cubes.every((cube) => cube.state === 'idle')).toBe(true);
    expect(s.reactions).toHaveLength(0);
    // The same roll makes the pair where every face works.
    const open = levelRun({ goal: { kind: 'clear' }, arrival: 'none', norm: 4 });
    put(open, 0, 0, 2);
    putOri(open, 2, 0, { top: 6, east: 2 });
    put(open, 4, 4, 5);
    put(open, 4, 3, 4);
    place(open, 2, 0, 'top');
    act(open, 'W');
    expect(open.reactions).toHaveLength(1);
  });

  it('make their groups as anywhere: three 3s go', () => {
    const s = board();
    expect(previewMove(s, 'W').clears).toBe(true);
    act(s, 'W');
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'match', value: 3, count: 3 }));
  });

  it('are the only ones counted as a group that is short', () => {
    const s = levelRun({ ...THREES, norm: 4 });
    put(s, 0, 0, 3);
    put(s, 1, 0, 3);
    put(s, 3, 3, 5);
    put(s, 4, 3, 5);
    expect(shortGroups(s).map((group) => group.value)).toEqual([3]);
  });

  it('set how few dice are a dead end: fewer than the smallest group that works', () => {
    expect(smallestGroup(THREES)).toBe(3);
    expect(smallestGroup({ faces: [2, 3] })).toBe(2);
    expect(smallestGroup({})).toBe(2);
    const s = board();
    act(s, 'W');
    place(s, 2, 3, 'top');
    idleMove(s);
    expect(s.over).toBe(false);
    idleMove(s);
    // The group is gone and two dice stand: where only 3s work they can make nothing.
    expect(s.cubes).toHaveLength(2);
    expect(s.endReason).toBe('failed');
    expect(levelStuck(s)).toBe(true);
  });
});

describe('a group that goes in two moves', () => {
  it('is half gone after one move and gone with the second', () => {
    const s = board();
    act(s, 'W');
    expect(chainWindows(s)).toEqual([{ value: 3, moves: 2 }]);
    place(s, 2, 3, 'top');
    idleMove(s);
    expect(chainWindows(s)).toEqual([{ value: 3, moves: 1 }]);
    expect(cubeAt(s, 0, 0)?.state).toBe('sinking');
    idleMove(s);
    expect(cubeAt(s, 0, 0)).toBeUndefined();
    expect(chainWindows(s)).toEqual([]);
  });

  it('takes a die that lands on its second move', () => {
    const s = board({ norm: 6 });
    // Rolled north, this die shows a 3 beside the group.
    putOri(s, 1, 2, { top: 6, south: 3 });
    act(s, 'W');
    place(s, 2, 3, 'top');
    idleMove(s);
    place(s, 1, 2, 'top');
    act(s, 'N');
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'chain', value: 3, chain: 2 }));
  });

  it('holds its dice where they are for a move when a die joins them, and does not bring them back up', () => {
    const s = board({ norm: 6 });
    putOri(s, 1, 2, { top: 6, south: 3 });
    act(s, 'W');
    const first = cubeAt(s, 0, 0)!;
    place(s, 1, 2, 'top');
    act(s, 'N');
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'chain' }));
    const sunk = first.t;
    expect(first.hold).toBeGreaterThan(0);
    // The link has its own two moves, and the dice it joined have two as well: one held, one to go.
    expect(chainWindows(s)).toEqual([{ value: 3, moves: 2 }]);
    place(s, 2, 3, 'top');
    idleMove(s);
    // A move later they stand where they stood, not higher: without the link they would be at the bottom.
    expect(s.cubes).toContain(first);
    expect(first.t).toBeLessThanOrEqual(sunk + 1);
    idleMove(s);
    expect(s.cubes).not.toContain(first);
  });
});
