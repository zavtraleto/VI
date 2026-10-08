import { describe, expect, it } from 'vitest';
import { cubeAt } from './board';
import { defaultConfig } from './config';
import { levelDeadEnd, worldRuns } from './level';
import { solveLevel } from './levelSolver';
import { resolveMove } from './movement';
import { canMove } from './reach';
import { createRun, step } from './sim';
import type { Dir, LevelLayout, LevelSpec, PuzzleDie, RunState } from './types';

/** A die the player rolls: 6 on top and its 2 to the south, so that a roll north shows the 2. */
const own = (x: number, z: number): PuzzleDie => ({ x, z, top: 6, north: 5 });
/** A fixed die that shows `top`. */
const fixed = (x: number, z: number, top: number): PuzzleDie => ({ x, z, top, north: top === 1 || top === 6 ? 2 : 1, fixed: true });
/** The same die with nothing said of it: it is rolled and pushed like any other. */
const plain = ({ x, z, top, north }: PuzzleDie): PuzzleDie => ({ x, z, top, north });

/** A board of three by three to be cleared, where only 2s work and nothing comes. */
function board(id: string, layout: LevelLayout, spec: Partial<LevelSpec> = {}): LevelSpec {
  return {
    id, seed: 1, size: 3, values: [2], norm: layout.dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces: [2], floor: true,
    sinkMoves: 2, liftMoves: 1, layout, ...spec,
  };
}

function start(spec: LevelSpec): RunState {
  return createRun({ seed: 1, config: defaultConfig(), level: spec });
}

/** Gives a command and runs the level until the world stands and the player is free, as the solver makes a move. */
function go(state: RunState, dir: Dir): void {
  step(state, dir);
  for (let ticks = 0; (worldRuns(state) || state.player.action) && !state.over; ticks++) {
    if (ticks > 1000) throw new Error('a move that does not end');
    step(state, null);
  }
}

/** A: the die the player is on is one roll north from showing a 2 beside the fixed 2 in the corner. */
const A = board('T-fixed-a', { dice: [own(1, 1), fixed(0, 0, 2)], start: { x: 1, z: 1 } });
/** C: a fixed die east of the player's own, with empty cells north and south of it. */
const C = board('T-fixed-c', { dice: [own(1, 1), fixed(2, 1, 4)], start: { x: 1, z: 1 } });
/** D: the player on the floor west of a fixed die, with a free cell behind it. */
const D = board('T-fixed-d', { dice: [fixed(1, 1, 4)], start: { x: 0, z: 1 }, onFloor: true });

describe('a fixed die', () => {
  it('is laid with its mark, and the dice beside it without one', () => {
    const s = start(A);
    expect(cubeAt(s, 0, 0)!.fixed).toBe(true);
    expect('fixed' in cubeAt(s, 1, 1)!).toBe(false);
  });

  it('makes a combo with a die rolled beside it and leaves with it', () => {
    const s = start(A);
    expect(resolveMove(s, 'N').kind).toBe('roll');
    go(s, 'N');
    expect(s.endReason).toBe('passed');
    expect(s.levelRun!.moves).toBe(1);
    expect(s.cubes.every((cube) => cube.state === 'sinking')).toBe(true);
    expect(cubeAt(s, 0, 0)!.reactionId).toBe(cubeAt(s, 1, 0)!.reactionId);
  });

  it('is not a die to start on', () => {
    expect(() => start(board('T-fixed-b', { dice: [own(1, 1), fixed(0, 0, 2)], start: { x: 0, z: 0 } }))).toThrow(/a start on a fixed die at 0,0/);
    // On the floor beside it the player may start.
    expect(() => start(D)).not.toThrow();
  });

  it('is stepped onto and off like any die, and is not rolled from on top', () => {
    const s = start(C);
    expect(resolveMove(s, 'E').kind).toBe('hop');
    go(s, 'E');
    expect(s.player).toEqual({ x: 2, z: 1, level: 'top' });
    for (const dir of ['N', 'S', 'E'] as const) {
      expect(resolveMove(s, dir).kind).toBe('blocked');
      go(s, dir);
      expect(s.player).toEqual({ x: 2, z: 1, level: 'top' });
    }
    expect(cubeAt(s, 2, 1)!.ori.top).toBe(4);
    expect(s.levelRun!.moves).toBe(0);
    expect(s.tick).toBe(0);
    expect(s.stats.blockedSteps).toBe(3);
    expect(resolveMove(s, 'W').kind).toBe('hop');
    go(s, 'W');
    expect(s.player).toEqual({ x: 1, z: 1, level: 'top' });
    expect(s.levelRun!.moves).toBe(0);
    // The same die with no mark is rolled from on top.
    const free = start(board('T-fixed-c-plain', { ...C.layout!, dice: C.layout!.dice.map(plain) }));
    go(free, 'E');
    expect(resolveMove(free, 'N').kind).toBe('roll');
  });

  it('is not pushed from the floor and, the floor being strict, not climbed', () => {
    const s = start(D);
    expect(s.player.level).toBe('ground');
    expect(resolveMove(s, 'E').kind).toBe('blocked');
    go(s, 'E');
    expect(s.player).toEqual({ x: 0, z: 1, level: 'ground' });
    expect(cubeAt(s, 1, 1)!.fixed).toBe(true);
    expect(cubeAt(s, 2, 1)).toBeUndefined();
    // From every side of it.
    s.player = { x: 1, z: 0, level: 'ground' };
    expect(resolveMove(s, 'S').kind).toBe('blocked');
    // The same die with no mark is pushed.
    const free = start(board('T-fixed-d-plain', { ...D.layout!, dice: D.layout!.dice.map(plain) }));
    expect(resolveMove(free, 'E').kind).toBe('push');
  });

  it('is climbed from the floor only where a die that cannot be pushed is', () => {
    const s = start(board('T-fixed-d-climb', D.layout!, { climb: true }));
    expect(resolveMove(s, 'E').kind).toBe('climb');
    go(s, 'E');
    expect(s.player).toEqual({ x: 1, z: 1, level: 'top' });
    expect(resolveMove(s, 'E').kind).toBe('blocked');
  });

  it('stands in the way of a die rolled or pushed at it', () => {
    const rolled = start(board('T-fixed-rolled', { dice: [own(1, 1), fixed(1, 0, 4)], start: { x: 1, z: 1 } }));
    expect(resolveMove(rolled, 'N').kind).toBe('hop');
    const pushed = start(board('T-fixed-pushed', { dice: [own(1, 1), fixed(2, 1, 4)], start: { x: 0, z: 1 }, onFloor: true }));
    expect(resolveMove(pushed, 'E').kind).toBe('blocked');
  });

  it('is walked off once it is leaving, as any die of a combo is', () => {
    const s = start(board('T-fixed-leaving', { dice: [own(1, 1), fixed(0, 0, 2), fixed(2, 2, 2), fixed(0, 2, 2), own(2, 0)], start: { x: 1, z: 1 } }, { sinkMoves: 3 }));
    go(s, 'N');
    expect(s.over).toBe(false);
    go(s, 'W');
    expect(s.player).toEqual({ x: 0, z: 0, level: 'top' });
    expect(cubeAt(s, 0, 0)!.state).toBe('sinking');
    expect(resolveMove(s, 'S').kind).toBe('descend');
  });
});

describe('the solver of a board with fixed dice', () => {
  it('clears it with the dice that roll', () => {
    const { solution } = solveLevel(A);
    expect(solution?.moves).toEqual([{ x: 1, z: 1, dir: 'N', push: false }]);
  });

  it('keeps the mark from board to board: a way that would roll or push a fixed die is not found', () => {
    // The fixed die shows a 6 and the die the player is on a 2: the board is cleared only if the fixed one is turned.
    const turn = board('T-fixed-turn', { dice: [{ x: 2, z: 2, top: 2, north: 1 }, fixed(0, 0, 6)], start: { x: 2, z: 2 } });
    const solved = solveLevel(turn);
    expect(solved.solution).toBeNull();
    expect(solved.exhausted).toBe(true);
    // With no mark on it, it is turned and the board is cleared.
    expect(solveLevel(board('T-fixed-turn-plain', { ...turn.layout!, dice: turn.layout!.dice.map(plain) })).solution).not.toBeNull();
  });

  it('finds a way on a board where a fixed die stands between two that roll, and makes no move with it', () => {
    const spec = board('T-fixed-between', { dice: [own(0, 2), fixed(1, 1, 2), own(2, 1)], start: { x: 0, z: 2 } }, { sinkMoves: 6 });
    const { solution } = solveLevel(spec);
    expect(solution).not.toBeNull();
    expect(solution!.par).toBeGreaterThan(1);
    expect(solution!.moves.some((move) => move.x === 1 && move.z === 1)).toBe(false);
  });
});

describe('a board left with fixed dice alone', () => {
  /** The roll north makes a combo with the fixed 2 in the corner; two fixed 2s are left apart from each other, each with room to be pushed into. */
  const left: LevelLayout = { dice: [own(1, 1), fixed(0, 0, 2), fixed(1, 2, 2), fixed(2, 1, 2)], start: { x: 1, z: 1 } };

  it('is a dead end of the floor: as many stand as a combo takes, and none of them can be moved', () => {
    const s = start(board('T-fixed-left', left));
    go(s, 'N');
    expect(canMove(s)).toBe(false);
    expect(levelDeadEnd(s)).toBe('floor');
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('failed');
  });

  it('is a dead end with the floor shut as well', () => {
    const s = start(board('T-fixed-left-shut', left, { floor: false }));
    go(s, 'N');
    expect(levelDeadEnd(s)).toBe('stranded');
    expect(s.endReason).toBe('failed');
  });

  it('is no board at all for the solver', () => {
    const solved = solveLevel(board('T-fixed-left', left));
    expect(solved.solution).toBeNull();
    expect(solved.exhausted).toBe(true);
  });
});
