import { describe, expect, it, vi } from 'vitest';
import { FIRST_LEVEL } from '../levels/first';
import { LEVELS } from '../levels/levels';
import { defaultConfig } from '../rules/config';
import { worldRuns } from '../rules/level';
import { solveFrom } from '../rules/levelSolver';
import { createRun, step } from '../rules/sim';
import type { Dir, LevelSpec, RunState } from '../rules/types';
import { stageWait, signAt, signCell, signMode, stepsTo, wastedMoves } from './signWay';

// The solver as it is, with its calls counted.
vi.mock('../rules/levelSolver', async (original) => {
  const actual = await original<typeof import('../rules/levelSolver')>();
  return { ...actual, solveFrom: vi.fn(actual.solveFrom) };
});

const stageOf = (id: string): LevelSpec => FIRST_LEVEL.find((spec) => spec.id === id)!;
const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });

/** Gives a command and runs the level until the world stands and the player is free, as a move is made. */
function go(state: RunState, dir: Dir): void {
  step(state, dir);
  for (let ticks = 0; (worldRuns(state) || state.player.action) && !state.over; ticks++) {
    if (ticks > 1000) throw new Error('a move that does not end');
    step(state, null);
  }
}

/** Plays a stage by its sign alone, and says the way the sign led. */
function follow(spec: LevelSpec, before: readonly Dir[] = []): { state: RunState; dirs: Dir[]; left: (number | null)[] } {
  const state = start(spec);
  for (const dir of before) go(state, dir);
  const dirs: Dir[] = [];
  const left: (number | null)[] = [];
  while (!state.over) {
    const way = signAt(state);
    if (way.dir === null) break;
    if (dirs.length > 30) throw new Error(`${spec.id}: the sign leads nowhere`);
    dirs.push(way.dir);
    left.push(way.left);
    go(state, way.dir);
  }
  return { state, dirs, left };
}

describe('the way the swipe sign points', () => {
  it('is the roll of the way, where the player stands on its die', () => {
    expect(signAt(start(stageOf('F1a')))).toEqual({ dir: 'E', left: 4 });
    expect(signAt(start(stageOf('F1c')))).toEqual({ dir: 'N', left: 1 });
    expect(signAt(start(stageOf('F1d')))).toEqual({ dir: 'W', left: 1 });
  });

  it('is the step towards the die of the way, where the player is not on it: up the stair, over, and then the rolls', () => {
    const { state, dirs, left } = follow(stageOf('F1b'));
    expect(dirs).toEqual(['N', 'E', 'E', 'E', 'N']);
    // Steps are not moves: the way is as long after them as before.
    expect(left).toEqual([3, 3, 3, 2, 1]);
    expect(state.endReason).toBe('passed');
    expect(state.levelRun!.moves).toBe(3);
  });

  it('clears every stage in its fewest moves when it is followed from the start', () => {
    for (const spec of FIRST_LEVEL) {
      const { state } = follow(spec);
      expect(state.endReason, spec.id).toBe('passed');
      expect(state.levelRun!.moves, spec.id).toBe(spec.par);
    }
  });

  it('clears a stage from a board the player has wandered to', () => {
    for (const [id, before] of [['F1a', ['E', 'E']], ['F1c', ['E']], ['F1c', ['S']], ['F1d', ['E']], ['F1d', ['N', 'W']], ['F1b', ['N', 'E', 'E', 'E', 'W']]] as const) {
      const { state } = follow(stageOf(id), before);
      expect(state.endReason, `${id} after ${before.join('')}`).toBe('passed');
    }
  });

  it('is not asked of a board that moves, of one that is over, or outside the levels', () => {
    const none = { dir: null, left: null };
    const state = start(stageOf('F1a'));
    step(state, 'E');
    expect(worldRuns(state) || Boolean(state.player.action)).toBe(true);
    expect(signAt(state)).toEqual(none);
    const { state: passed } = follow(stageOf('F1c'));
    expect(passed.over).toBe(true);
    expect(signAt(passed)).toEqual(none);
    expect(signAt(createRun({ seed: 1, config: defaultConfig() }))).toEqual(none);
  });

  it('is none where the search is not let to find a way', () => {
    expect(signAt(start(LEVELS[LEVELS.length - 1]), 1)).toEqual({ dir: null, left: null });
  });
});

describe('the steps to a place', () => {
  it('are none to where the player is', () => {
    const state = start(stageOf('F1b'));
    expect(stepsTo(state, { x: 0, z: 3, level: 'ground' })).toEqual([]);
  });

  it('lead from the floor up the die that is leaving and on over the dice', () => {
    const state = start(stageOf('F1b'));
    expect(stepsTo(state, { x: 0, z: 2, level: 'top' })).toEqual(['N']);
    expect(stepsTo(state, { x: 1, z: 2, level: 'top' })).toEqual(['N', 'E']);
  });

  it('are never a roll: a cell with no die is not stepped to from a die that stands', () => {
    const state = start(stageOf('F1b'));
    // On the die at the foot of the strip: the cell to its east is empty, and getting there is a move.
    go(state, 'N');
    go(state, 'E');
    expect(state.player).toEqual({ x: 1, z: 2, level: 'top' });
    expect(stepsTo(state, { x: 2, z: 2, level: 'top' })).toBeNull();
    expect(stepsTo(state, { x: 3, z: 0, level: 'top' })).toBeNull();
    expect(state.levelRun!.moves).toBe(0);
  });

  it('leave the board as it was', () => {
    const state = start(stageOf('F1b'));
    const before = JSON.stringify(state);
    stepsTo(state, { x: 1, z: 2, level: 'top' });
    signAt(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('the moves wasted', () => {
  it('are the moves made less the moves the way has grown shorter by', () => {
    expect(wastedMoves(3, 0, 3)).toBe(0);
    expect(wastedMoves(3, 2, 1)).toBe(0);
    expect(wastedMoves(3, 3, 3)).toBe(3);
    expect(wastedMoves(1, 4, 2)).toBe(5);
  });

  it('are none where the way is not known, and never fewer than none', () => {
    expect(wastedMoves(undefined, 5, 2)).toBe(0);
    expect(wastedMoves(3, 5, null)).toBe(0);
    expect(wastedMoves(4, 1, 2)).toBe(0);
  });

  it('are counted on a stage as it is played: a roll there and back on the small board is two', () => {
    const spec = stageOf('F1c');
    const state = start(spec);
    go(state, 'E');
    go(state, 'W');
    expect(state.levelRun!.moves).toBe(2);
    expect(wastedMoves(spec.par, state.levelRun!.moves, signAt(state).left)).toBeGreaterThanOrEqual(2);
  });
});

describe('where the sign stands', () => {
  it('is the first cell off the board from the player, along their row or their column', () => {
    const strip = stageOf('F1a');
    expect(signCell(strip.size, strip.holes, { x: 0, z: 2 }, 'E')).toEqual({ x: 6, z: 2 });
    expect(signCell(strip.size, strip.holes, { x: 3, z: 2 }, 'W')).toEqual({ x: -1, z: 2 });
    // The strip is a row of a board cut away: the cell north of it is off the board.
    expect(signCell(strip.size, strip.holes, { x: 3, z: 2 }, 'N')).toEqual({ x: 3, z: 1 });
    expect(signCell(strip.size, strip.holes, { x: 3, z: 2 }, 'S')).toEqual({ x: 3, z: 3 });
  });

  it('follows the shape of a board with cells cut out', () => {
    const stair = stageOf('F1b');
    expect(signCell(stair.size, stair.holes, { x: 0, z: 3 }, 'N')).toEqual({ x: 0, z: 1 });
    expect(signCell(stair.size, stair.holes, { x: 1, z: 2 }, 'E')).toEqual({ x: 4, z: 2 });
    expect(signCell(stair.size, stair.holes, { x: 3, z: 2 }, 'N')).toEqual({ x: 3, z: -1 });
  });

  it('is beside a whole board on the side asked', () => {
    expect(signCell(5, undefined, { x: 2, z: 1 }, 'N')).toEqual({ x: 2, z: -1 });
    expect(signCell(5, [], { x: 2, z: 1 }, 'S')).toEqual({ x: 2, z: 5 });
  });

  it('stands just past the stair when the way is up out of the pocket, not beyond the square the board is cut from', () => {
    // The stage as it is started, with the place of the player the rules give and the way the sign gives.
    const spec = stageOf('F1b');
    const state = start(spec);
    expect(state.player).toMatchObject({ x: 0, z: 3, level: 'ground' });
    expect(signAt(state).dir).toBe('N');
    expect(signCell(spec.size, spec.holes, state.player, 'N')).toEqual({ x: 0, z: 1 });
  });

  it('stops at a cell cut out between the player and the edge of the square, though the board goes on beyond it', () => {
    // A whole board of five but for one cell: north of (2,3) the board ends at (2,1), and (2,0) is a cell again.
    const holes = [{ x: 2, z: 1 }];
    expect(signCell(5, holes, { x: 2, z: 3 }, 'N')).toEqual({ x: 2, z: 1 });
    expect(signCell(5, holes, { x: 2, z: 0 }, 'S')).toEqual({ x: 2, z: 1 });
    expect(signCell(5, holes, { x: 0, z: 1 }, 'E')).toEqual({ x: 2, z: 1 });
    // Beside the hole and not through it, the column runs to the edge of the square.
    expect(signCell(5, holes, { x: 1, z: 3 }, 'N')).toEqual({ x: 1, z: -1 });
  });

  it('is where each stage of the first level asks for it at its start', () => {
    const at = (id: string, dir: Dir) => {
      const spec = stageOf(id);
      return signCell(spec.size, spec.holes, start(spec).player, dir);
    };
    expect(at('F1a', 'E')).toEqual({ x: 6, z: 2 });
    expect(at('F1b', 'N')).toEqual({ x: 0, z: 1 });
    expect(at('F1c', 'N')).toEqual({ x: 1, z: -1 });
    expect(at('F1d', 'W')).toEqual({ x: -1, z: 1 });
  });
});

describe('the form of the sign', () => {
  it('is the dot on a phone, whatever is set and whatever was pressed', () => {
    expect(signMode('gesture', true, null)).toBe('dot');
    expect(signMode('dpad', true, 'keys')).toBe('dot');
  });

  it('is the key for those who last pressed a key, and for those who press buttons', () => {
    expect(signMode('gesture', false, 'keys')).toBe('key');
    expect(signMode('dpad', false, 'pointer')).toBe('key');
    expect(signMode('dpad', false, null)).toBe('key');
  });

  it('is the dot for those who swipe with a mouse', () => {
    expect(signMode('gesture', false, 'pointer')).toBe('dot');
    expect(signMode('gesture', false, null)).toBe('dot');
  });
});

describe('what a stage shows while the player waits, frame by frame', () => {
  const NOTHING = { dir: null, blink: false };

  it('is kept for the stages of the first level only', () => {
    for (const spec of FIRST_LEVEL) expect(stageWait(spec.id), spec.id).not.toBeNull();
    for (const spec of LEVELS) expect(stageWait(spec.id), spec.id).toBeNull();
    expect(stageWait('F1')).toBeNull();
  });

  it('opens the first stage with its sign, takes it away with the first roll, and brings the sign of the way after six seconds', () => {
    const state = start(stageOf('F1a'));
    const wait = stageWait('F1a')!;
    expect(wait.frame(state, 100, true)).toEqual({ dir: 'E', blink: false });
    expect(wait.frame(state, 60_000, true)).toEqual({ dir: 'E', blink: false });
    go(state, 'E');
    expect(wait.frame(state, 61_000, true)).toEqual(NOTHING);
    expect(wait.frame(state, 66_999, true)).toEqual(NOTHING);
    expect(wait.frame(state, 67_000, true)).toEqual({ dir: 'E', blink: false });
    go(state, 'E');
    expect(wait.frame(state, 67_100, true)).toEqual(NOTHING);
    // A roll back is a move like any: the sign waits its seconds again, and points the way from where the die now is.
    go(state, 'W');
    expect(wait.frame(state, 70_000, true)).toEqual(NOTHING);
    expect(wait.frame(state, 76_000, true)).toEqual({ dir: 'E', blink: false });
  });

  it('opens the other stages with nothing, blinks the plaque from four seconds and shows the way from eight', () => {
    const state = start(stageOf('F1b'));
    const wait = stageWait('F1b')!;
    expect(wait.frame(state, 1000, true)).toEqual(NOTHING);
    expect(wait.frame(state, 4999, true)).toEqual(NOTHING);
    expect(wait.frame(state, 5000, true)).toEqual({ dir: null, blink: true });
    expect(wait.frame(state, 8999, true)).toEqual({ dir: null, blink: true });
    expect(wait.frame(state, 9000, true)).toEqual({ dir: 'N', blink: false });
    // A step takes the sign away as a move does, and the next one is the step that follows.
    go(state, 'N');
    expect(wait.frame(state, 9500, true)).toEqual(NOTHING);
    expect(wait.frame(state, 17_500, true)).toEqual({ dir: 'E', blink: false });
  });

  it('shows nothing and asks nothing of a board that moves, and counts the wait from when it stands', () => {
    const state = start(stageOf('F1c'));
    const wait = stageWait('F1c')!;
    expect(wait.frame(state, 0, true)).toEqual(NOTHING);
    expect(wait.frame(state, 9000, true)).toEqual({ dir: 'N', blink: false });
    step(state, 'E');
    expect(wait.frame(state, 9016, true)).toEqual(NOTHING);
    let time = 9016;
    while (worldRuns(state) || state.player.action) {
      step(state, null);
      time += 16;
      expect(wait.frame(state, time, true)).toEqual(NOTHING);
    }
    // The last of those frames saw the board stand: the wait is counted from it.
    expect(time).toBeGreaterThan(9032);
    expect(wait.frame(state, time + 3999, true)).toEqual(NOTHING);
    expect(wait.frame(state, time + 4000, true)).toEqual({ dir: null, blink: true });
    expect(wait.frame(state, time + 8000, true).dir).not.toBeNull();
  });

  it('shows nothing under a panel, and does not count its time', () => {
    const state = start(stageOf('F1d'));
    const wait = stageWait('F1d')!;
    expect(wait.frame(state, 0, true)).toEqual(NOTHING);
    expect(wait.frame(state, 3000, false)).toEqual(NOTHING);
    expect(wait.frame(state, 90_000, false)).toEqual(NOTHING);
    expect(wait.frame(state, 100_000, true)).toEqual(NOTHING);
    expect(wait.frame(state, 100_999, true)).toEqual(NOTHING);
    expect(wait.frame(state, 101_000, true)).toEqual({ dir: null, blink: true });
    expect(wait.frame(state, 105_000, true)).toEqual({ dir: 'W', blink: false });
    // The sign that had come goes out under a panel too.
    expect(wait.frame(state, 105_100, false)).toEqual(NOTHING);
    expect(wait.frame(state, 105_200, true)).toEqual({ dir: 'W', blink: false });
  });

  it('keeps the opening sign of the first stage out from under a panel', () => {
    const state = start(stageOf('F1a'));
    const wait = stageWait('F1a')!;
    expect(wait.frame(state, 0, false)).toEqual(NOTHING);
    expect(wait.frame(state, 16, true)).toEqual({ dir: 'E', blink: false });
  });

  it('shows the way at once when three moves have been wasted', () => {
    const state = start(stageOf('F1d'));
    const wait = stageWait('F1d')!;
    let time = 0;
    const seen: (Dir | null)[] = [];
    // To the east and back, and to the east again: three rolls, and the board no nearer.
    for (const dir of ['E', 'W', 'E'] as const) {
      expect(wait.frame(state, time, true)).toEqual(NOTHING);
      go(state, dir);
      time += 500;
      seen.push(wait.frame(state, time, true).dir);
    }
    expect(seen.slice(0, 2)).toEqual([null, null]);
    expect(seen[2]).not.toBeNull();
    expect(seen[2]).toBe(signAt(state).dir);
  });

  it('shows nothing of a level that is over', () => {
    const state = start(stageOf('F1c'));
    const wait = stageWait('F1c')!;
    wait.frame(state, 0, true);
    go(state, 'N');
    expect(state.endReason).toBe('passed');
    expect(wait.frame(state, 60_000, true)).toEqual(NOTHING);
  });

  it('asks the solver once for a board, not on every frame', () => {
    const asked = vi.mocked(solveFrom);
    const state = start(stageOf('F1b'));
    const wait = stageWait('F1b')!;
    asked.mockClear();
    for (let time = 0; time <= 9000; time += 16) wait.frame(state, time, true);
    expect(asked).toHaveBeenCalledTimes(1);
    go(state, 'N');
    for (let time = 9016; time <= 20_000; time += 16) wait.frame(state, time, true);
    expect(asked).toHaveBeenCalledTimes(2);
    // Under a panel nothing is asked, whatever the board.
    go(state, 'E');
    for (let time = 20_016; time <= 21_000; time += 16) wait.frame(state, time, false);
    expect(asked).toHaveBeenCalledTimes(2);
  });
});
