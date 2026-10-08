import { describe, expect, it } from 'vitest';
import { NO_CELL, cubeAt, cubeHeight } from './board';
import { defaultConfig } from './config';
import { chainWindows, goalLines, worldRuns } from './level';
import { resolveMove } from './movement';
import { createRun, step } from './sim';
import type { Cube, Dir, LevelLayout, LevelSpec, RunState } from './types';

/** The cells of the board: a pocket, a strip that runs east of it and a turn to the north. Every other cell of the square is cut out. */
const CELLS: readonly string[] = ['2,0', '3,0', '3,1', '0,2', '1,2', '2,2', '3,2', '0,3'];

const HOLES: { x: number; z: number }[] = [];
for (let z = 0; z < 5; z++) for (let x = 0; x < 5; x++) if (!CELLS.includes(`${x},${z}`)) HOLES.push({ x, z });

/**
 * A board with a stair: the die at (0,2) is leaving and stands half down, and the player starts
 * on the floor in the pocket south of it. Only 3s work. The die at (1,2) has its 3 to the south:
 * rolled east twice and north once it shows it beside the two 3s at the top.
 */
const STAGE2: LevelSpec = {
  id: 'T-stair', seed: 1, size: 5, values: [3], norm: 4, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces: [3], floor: true,
  sinkMoves: 2, liftMoves: 1,
  holes: HOLES,
  layout: {
    dice: [{ x: 0, z: 2, top: 6, north: 2 }, { x: 1, z: 2, top: 1, north: 4 }, { x: 3, z: 0, top: 3, north: 1 }, { x: 2, z: 0, top: 3, north: 2 }],
    start: { x: 0, z: 3 }, onFloor: true, leaving: [{ die: 0, moves: 1 }],
  },
};

/** The board with what is given changed in its layout. */
function laid(layout: Partial<LevelLayout>, spec: Partial<LevelSpec> = {}): LevelSpec {
  return { ...STAGE2, ...spec, layout: { ...STAGE2.layout!, ...layout } };
}

function start(spec: LevelSpec = STAGE2): RunState {
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

/** The die that is leaving from the start. */
function stair(state: RunState): Cube {
  return cubeAt(state, 0, 2)!;
}

/** The board with the player gone up the stair and over onto the die beside it. */
function climbed(spec: LevelSpec = STAGE2): RunState {
  const s = start(spec);
  go(s, 'N');
  go(s, 'E');
  return s;
}

describe('a board laid with a die that is already leaving and the player on the floor', () => {
  it('starts the player on the floor, the die half down as a combo of one, and counts it cleared', () => {
    const s = start();
    // Eight cells are the board, and the pocket the player starts in is one of them with no die on it.
    expect(s.grid.filter((id) => id === NO_CELL)).toHaveLength(17);
    expect(s.cubes).toHaveLength(4);
    expect(s.player).toEqual({ x: 0, z: 3, level: 'ground' });
    expect(cubeAt(s, 0, 3)).toBeUndefined();
    expect(stair(s).state).toBe('sinking');
    const height = cubeHeight(stair(s), s.config);
    expect(height).toBeGreaterThanOrEqual(0.45);
    expect(height).toBeLessThanOrEqual(0.55);
    expect(s.reactions).toEqual([{ id: stair(s).reactionId, value: 6, chain: 1, total: 1 }]);
    expect(stair(s).reactionId).toBeGreaterThan(0);
    // It goes with the next move, and the dice laid whole are whole.
    expect(chainWindows(s)).toEqual([{ value: 6, moves: 1 }]);
    expect(s.cubes.filter((c) => c.state === 'idle')).toHaveLength(3);
    // It does not stand, so the goal has it already.
    expect(goalLines(s)[0]).toMatchObject({ what: 'cleared', have: 1, need: 4 });
    expect(s.over).toBe(false);
  });

  it('lets the player up onto the leaving die from the floor, and the step moves no world', () => {
    const s = start();
    const { t } = stair(s);
    expect(resolveMove(s, 'N').kind).toBe('mount');
    go(s, 'N');
    expect(s.player).toEqual({ x: 0, z: 2, level: 'top' });
    expect(stair(s).t).toBe(t);
    expect(s.tick).toBe(0);
    expect(s.levelRun!.moves).toBe(0);
  });

  it('lets the player step from it onto the die that stands beside it, and still nothing moves', () => {
    const s = start();
    const { t } = stair(s);
    go(s, 'N');
    expect(resolveMove(s, 'E').kind).toBe('hop');
    go(s, 'E');
    expect(s.player).toEqual({ x: 1, z: 2, level: 'top' });
    expect(stair(s).state).toBe('sinking');
    expect(stair(s).t).toBe(t);
    expect(s.tick).toBe(0);
    expect(s.levelRun!.moves).toBe(0);
  });

  it('lets the player back down from it to the floor', () => {
    const s = start();
    const { t } = stair(s);
    go(s, 'N');
    expect(resolveMove(s, 'S').kind).toBe('descend');
    go(s, 'S');
    expect(s.player).toEqual({ x: 0, z: 3, level: 'ground' });
    expect(stair(s).t).toBe(t);
  });

  it('takes the die off with the first move, and its reaction with it', () => {
    const s = climbed();
    const id = stair(s).id;
    go(s, 'E');
    expect(cubeAt(s, 0, 2)).toBeUndefined();
    expect(s.cubes.some((c) => c.id === id)).toBe(false);
    expect(s.reactions).toHaveLength(0);
    expect(cubeAt(s, 2, 2)?.ori.top).toBe(5);
    expect(s.levelRun!.moves).toBe(1);
    // It was counted from the start: its going adds nothing.
    expect(goalLines(s)[0]).toMatchObject({ have: 1, need: 4 });
    expect(s.over).toBe(false);
  });

  it('is rolled over like any die that is leaving: it goes at once and the die rolled stands in its cell', () => {
    const s = climbed();
    const id = stair(s).id;
    const own = cubeAt(s, 1, 2)!;
    const intent = resolveMove(s, 'W');
    expect(intent.kind).toBe('roll');
    expect(intent.over?.id).toBe(id);
    go(s, 'W');
    expect(s.cubes.some((c) => c.id === id)).toBe(false);
    expect(cubeAt(s, 0, 2)).toBe(own);
    expect(own.state).toBe('idle');
    expect(own.ori.south).toBe(3);
    expect(cubeAt(s, 1, 2)).toBeUndefined();
    expect(s.reactions).toHaveLength(0);
    expect(s.over).toBe(false);
  });

  it('is cleared by the way of the board: up the stair, over, and three rolls', () => {
    const s = climbed();
    go(s, 'E');
    go(s, 'E');
    expect(s.over).toBe(false);
    go(s, 'N');
    expect(s.endReason).toBe('passed');
    expect(s.levelRun!.moves).toBe(3);
  });

  it('keeps a die for as many moves as the board says it leaves in', () => {
    const s = climbed(laid({ leaving: [{ die: 0, moves: 2 }] }));
    expect(chainWindows(s)).toEqual([{ value: 6, moves: 2 }]);
    go(s, 'E');
    expect(stair(s).state).toBe('sinking');
    expect(chainWindows(s)).toEqual([{ value: 6, moves: 1 }]);
    go(s, 'E');
    expect(cubeAt(s, 0, 2)).toBeUndefined();
    expect(s.reactions).toHaveLength(0);
  });

  it('says what is wrong with it: a die where the player starts on the floor, a start that is no cell, a leaving die that is not laid or goes in moves it cannot', () => {
    expect(() => start(laid({ start: { x: 0, z: 2 } }))).toThrow(/a die on the floor the player starts on at 0,2/);
    expect(() => start(laid({ start: { x: 5, z: 3 } }))).toThrow(/a start off the board at 5,3/);
    expect(() => start(laid({ start: { x: 1, z: 3 } }))).toThrow(/a start on a cell that is cut out at 1,3/);
    // Without the floor to start on, the start is a die as it was.
    expect(() => start(laid({ onFloor: false }))).toThrow(/no die to start on at 0,3/);
    expect(() => start(laid({ leaving: [{ die: 4, moves: 1 }] }))).toThrow(/no die 4 to be leaving: 4 are laid/);
    expect(() => start(laid({ leaving: [{ die: -1, moves: 1 }] }))).toThrow(/no die -1 to be leaving/);
    expect(() => start(laid({ leaving: [{ die: 0.5, moves: 1 }] }))).toThrow(/no die 0.5 to be leaving/);
    expect(() => start(laid({ leaving: [{ die: 0, moves: 0 }] }))).toThrow(/a die leaving in 0 moves, where it is 1 to 2/);
    expect(() => start(laid({ leaving: [{ die: 0, moves: 3 }] }))).toThrow(/a die leaving in 3 moves, where it is 1 to 2/);
    expect(() => start(laid({ leaving: [{ die: 0, moves: 1.5 }] }))).toThrow(/a die leaving in 1.5 moves/);
    // A combo of the level goes in more moves, and so may the die.
    expect(() => start(laid({ leaving: [{ die: 0, moves: 3 }] }, { sinkMoves: 3 }))).not.toThrow();
  });
});
