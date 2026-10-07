import { describe, expect, it } from 'vitest';
import { DELTA, DIRS, cubeAt } from './board';
import { chainWindows, floorLost, floorStuck, levelDeadEnd, levelStranded, levelStuck, shortGroups, smallestGroup } from './level';
import { resolveMove } from './movement';
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

/** Where only 2s work: four dice, two of them a roll away from a pair. */
const TWOS: Partial<LevelSpec> = { goal: { kind: 'clear' }, arrival: 'none', faces: [2], sinkMoves: 2, liftMoves: 1, norm: 4 };

describe('the floor of a level', () => {
  /** The die at (2,0) rolled west makes a pair with the 2 at (0,0); a die stands at (1,1), another far off. */
  function pairBoard(spec: Partial<LevelSpec> = {}): RunState {
    const s = levelRun({ ...TWOS, ...spec });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 1, 1, 5);
    put(s, 4, 4, 5);
    place(s, 2, 0, 'top');
    act(s, 'W');
    return s;
  }

  it('is stepped down to from a die that is leaving, where the level leaves it open', () => {
    const s = pairBoard();
    expect(cubeAt(s, 1, 0)?.state).toBe('sinking');
    expect(resolveMove(s, 'E').kind).toBe('descend');
  });

  it('is not stepped down to where the level shuts it; a step onto a die is still a step', () => {
    const s = pairBoard({ floor: false });
    expect(resolveMove(s, 'E').kind).toBe('blocked');
    expect(resolveMove(s, 'S').kind).toBe('hop');
  });
});

describe('a level with its floor shut', () => {
  /** The pair is made at (0,0) and (1,0); the two dice left stand where no step leads. */
  function cutOff(spec: Partial<LevelSpec> = {}): RunState {
    const s = levelRun({ ...TWOS, ...spec });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 4, 4, 5);
    put(s, 4, 3, 4);
    place(s, 2, 0, 'top');
    act(s, 'W');
    return s;
  }

  it('is lost when the player stands on a leaving die with no die to step to: there is no move left', () => {
    const s = cutOff({ floor: false });
    expect(levelStranded(s)).toBe(true);
    expect(levelStuck(s)).toBe(false);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('failed');
  });

  it('goes on where the floor is open and a die can be pushed from it: the player steps down and walks', () => {
    const s = levelRun({ ...TWOS });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 3, 3, 5);
    put(s, 3, 2, 4);
    place(s, 2, 0, 'top');
    act(s, 'W');
    expect(levelStranded(s)).toBe(false);
    expect(levelDeadEnd(s)).toBeNull();
    expect(s.over).toBe(false);
  });

  it('is lost with the floor open as well, where nothing can be pushed from it: that is a dead end of the floor', () => {
    // The two dice left stand in the corner, one against the other: the floor leads to them and does nothing with them.
    const s = cutOff();
    expect(levelStranded(s)).toBe(false);
    expect(floorStuck(s)).toBe(true);
    expect(levelDeadEnd(s)).toBe('floor');
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('failed');
    // Where a die that cannot be pushed is climbed, as in a session, the level goes on.
    expect(cutOff({ climb: true }).over).toBe(false);
  });

  it('goes on while a die stands within a step', () => {
    const s = levelRun({ ...TWOS, floor: false });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 1, 1, 5);
    put(s, 4, 4, 5);
    place(s, 2, 0, 'top');
    act(s, 'W');
    expect(levelStranded(s)).toBe(false);
    expect(s.over).toBe(false);
  });
});

describe('the floor beside a leaving combo', () => {
  /** A pair is made at (0,0) and (1,0); the player steps down east of it, where a die stands a cell further on. */
  function beside(more: (s: RunState) => void = () => {}, spec: Partial<LevelSpec> = {}): RunState {
    const s = levelRun({ ...TWOS, norm: 6, ...spec });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 3, 0, 5);
    more(s);
    place(s, 2, 0, 'top');
    act(s, 'W');
    act(s, 'E');
    return s;
  }

  it('is floor like any other on a level: a die with room behind it is pushed from there, and not stepped onto', () => {
    const s = beside();
    expect([s.player.x, s.player.z, s.player.level]).toEqual([2, 0, 'ground']);
    expect(resolveMove(s, 'E').kind).toBe('push');
  });

  it('lets the player back onto the combo while it is there, and onto a die that cannot be pushed only where the level says so', () => {
    const s = beside((board) => put(board, 4, 0, 4), { climb: true });
    expect(resolveMove(s, 'E').kind).toBe('climb');
    expect(resolveMove(s, 'W').kind).toBe('mount');
    // As a level is, the die is not climbed; a die out in the open keeps the level going.
    const strict = beside((board) => {
      put(board, 4, 0, 4);
      put(board, 2, 3, 5);
    });
    expect(resolveMove(strict, 'E').kind).toBe('blocked');
    expect(resolveMove(strict, 'W').kind).toBe('mount');
  });
});

describe('a level where a die is not climbed from the floor', () => {
  /** A board of the ladder with nothing on it and the player on its floor: 3s work, or what the spec says. */
  function floor(spec: Partial<LevelSpec> = {}, at: [number, number] = [2, 2]): RunState {
    const s = levelRun({ ...THREES, norm: 4, ...spec });
    place(s, at[0], at[1], 'ground');
    return s;
  }

  it('takes no step up onto a die that cannot be pushed: the edge behind it, or another die', () => {
    const strict = floor({ climb: false }, [1, 0]);
    put(strict, 0, 0, 3);
    put(strict, 2, 0, 5);
    put(strict, 3, 0, 4);
    expect(resolveMove(strict, 'W').kind).toBe('blocked');
    expect(resolveMove(strict, 'E').kind).toBe('blocked');
    // A board nothing comes to is strict without being told.
    const plain = floor({}, [1, 0]);
    put(plain, 0, 0, 3);
    put(plain, 2, 0, 5);
    put(plain, 3, 0, 4);
    expect(resolveMove(plain, 'W').kind).toBe('blocked');
    expect(resolveMove(plain, 'E').kind).toBe('blocked');
    // A level that says so lets the player up onto both, as a session does.
    const open = floor({ climb: true }, [1, 0]);
    put(open, 0, 0, 3);
    put(open, 2, 0, 5);
    put(open, 3, 0, 4);
    expect(resolveMove(open, 'W').kind).toBe('climb');
    expect(resolveMove(open, 'E').kind).toBe('climb');
  });

  it('still pushes a die with room behind it, and still goes up by a die that is leaving', () => {
    const s = levelRun({ ...TWOS, norm: 6, climb: false });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 3, 0, 5);
    place(s, 2, 0, 'top');
    act(s, 'W');
    act(s, 'E');
    expect(s.player.level).toBe('ground');
    expect(resolveMove(s, 'E').kind).toBe('push');
    expect(resolveMove(s, 'W').kind).toBe('mount');
  });

  it('is stuck on the floor with nothing to push and nothing to go up by', () => {
    // Every die stands against the edge or another die on the side it would be pushed to.
    const s = floor({ climb: false }, [1, 1]);
    put(s, 0, 0, 3);
    put(s, 1, 0, 3);
    put(s, 0, 1, 5);
    expect(floorStuck(s)).toBe(true);
    // A die out in the open can be pushed.
    put(s, 3, 1, 4);
    expect(floorStuck(s)).toBe(false);
  });

  it('is not stuck where a die that cannot be pushed is climbed, nor up on the dice, nor on an empty board', () => {
    const open = floor({ climb: true }, [1, 1]);
    put(open, 0, 0, 3);
    put(open, 1, 0, 3);
    put(open, 0, 1, 5);
    expect(floorStuck(open)).toBe(false);
    const up = floor({ climb: false }, [1, 1]);
    put(up, 0, 0, 3);
    put(up, 1, 0, 3);
    place(up, 0, 0, 'top');
    expect(floorStuck(up)).toBe(false);
    expect(floorStuck(floor({ climb: false }))).toBe(false);
  });

  it('is lost on the floor when too few dice show a face that works: a push turns no die', () => {
    // Two 3s and a 5 out in the open: they can be pushed about for ever, and never be three 3s.
    const s = floor({ climb: false });
    put(s, 1, 1, 3);
    put(s, 3, 1, 3);
    put(s, 3, 3, 5);
    expect(floorStuck(s)).toBe(false);
    expect(floorLost(s)).toBe(true);
  });

  it('is not lost while the faces are there to be pushed together', () => {
    const s = floor({ climb: false });
    put(s, 1, 1, 3);
    put(s, 3, 1, 3);
    put(s, 3, 3, 3);
    expect(floorLost(s)).toBe(false);
    // Of two faces that work, one is enough.
    const two = floor({ ...TWOS, faces: [2, 3], climb: false });
    put(two, 1, 1, 2);
    put(two, 3, 1, 2);
    put(two, 3, 3, 5);
    expect(floorLost(two)).toBe(false);
  });

  it('is not lost while a die is leaving, where a die can be climbed, or up on the dice', () => {
    const leaving = floor({ climb: false });
    put(leaving, 1, 1, 3);
    put(leaving, 3, 3, 5);
    put(leaving, 0, 4, 3, 'sinking');
    expect(floorLost(leaving)).toBe(false);
    const open = floor({ climb: true });
    put(open, 0, 0, 3);
    put(open, 3, 3, 5);
    expect(floorLost(open)).toBe(false);
    const up = floor({ climb: false });
    put(up, 1, 1, 3);
    put(up, 3, 3, 5);
    place(up, 1, 1, 'top');
    expect(floorLost(up)).toBe(false);
  });
});

describe('a dead end of the floor', () => {
  it('ends the level on the beat that leaves the player down among faces that make no combo', () => {
    // A pair is made at (0,0) and (1,0), and two dice that show no 2 stand out in the open, a cell between them.
    const s = levelRun({ ...TWOS });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 3, 3, 5);
    put(s, 1, 3, 4);
    place(s, 2, 0, 'top');
    act(s, 'W');
    expect(s.over).toBe(false);
    // Down from the pair, and over the floor to the cell between the two dice.
    for (const dir of ['S', 'E', 'S', 'S'] as const) act(s, dir);
    expect([s.player.x, s.player.z, s.player.level]).toEqual([2, 3, 'ground']);
    // The first push: the pair is still going, and may yet be gone up by.
    act(s, 'E');
    expect(levelDeadEnd(s)).toBeNull();
    expect(s.over).toBe(false);
    // The second: the pair is gone with it. Two dice stand, enough by their count, and neither shows a 2.
    act(s, 'W');
    act(s, 'W');
    expect(s.reactions).toHaveLength(0);
    expect(levelStuck(s)).toBe(false);
    expect(levelDeadEnd(s)).toBe('faces');
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('failed');
  });

  it('ends the level on the move that leaves the player with nothing to push and nothing to go up by', () => {
    // The two dice left stand in a corner, one against the other: once the pair is made, the floor leads to them and does nothing with them.
    const s = levelRun({ ...TWOS });
    put(s, 0, 0, 2);
    putOri(s, 2, 0, { top: 6, east: 2 });
    put(s, 4, 4, 2);
    put(s, 4, 3, 2);
    place(s, 2, 0, 'top');
    expect(levelDeadEnd(s)).toBeNull();
    act(s, 'W');
    // The player is still up on the pair: the end is the one the floor below would be, a step sooner.
    expect(s.player.level).toBe('top');
    expect(levelDeadEnd(s)).toBe('floor');
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('failed');
  });

  it('says which dead end it is, and none while the level can go on', () => {
    const stuck = levelRun({ ...THREES, norm: 4 });
    put(stuck, 0, 0, 3);
    put(stuck, 1, 0, 3);
    put(stuck, 0, 1, 3);
    place(stuck, 1, 1, 'ground');
    expect(levelDeadEnd(stuck)).toBe('floor');
    const faces = levelRun({ ...THREES, norm: 4 });
    put(faces, 1, 1, 3);
    put(faces, 3, 1, 3);
    put(faces, 3, 3, 5);
    place(faces, 2, 2, 'ground');
    expect(levelDeadEnd(faces)).toBe('faces');
    put(faces, 1, 3, 3);
    expect(levelDeadEnd(faces)).toBeNull();
  });
});
