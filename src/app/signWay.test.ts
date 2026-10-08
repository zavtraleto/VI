import { describe, expect, it, vi } from 'vitest';
import { LEVELS } from '../levels/levels';
import { ROAD } from '../levels/road';
import { defaultConfig } from '../rules/config';
import { worldRuns } from '../rules/level';
import { solveFrom } from '../rules/levelSolver';
import { createRun, step } from '../rules/sim';
import type { Dir, LevelSpec, RunState } from '../rules/types';
import { roadWait, signAt, signHeight, signMode, signStart, stepsTo, wastedMoves } from './signWay';

// The solver as it is, with its calls counted.
vi.mock('../rules/levelSolver', async (original) => {
  const actual = await original<typeof import('../rules/levelSolver')>();
  return { ...actual, solveFrom: vi.fn(actual.solveFrom) };
});

const pieceOf = (id: string): LevelSpec => ROAD.find((spec) => spec.id === id)!;
const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });

/** Gives a command and runs the level until the world stands and the player is free, as a move is made. */
function go(state: RunState, dir: Dir): void {
  step(state, dir);
  for (let ticks = 0; (worldRuns(state) || state.player.action) && !state.over; ticks++) {
    if (ticks > 1000) throw new Error('a move that does not end');
    step(state, null);
  }
}

/** Plays a piece by its sign alone, and says the way the sign led. */
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
    expect(signAt(start(pieceOf('R01')))).toEqual({ dir: 'N', left: 4 });
    expect(signAt(start(pieceOf('R03')))).toEqual({ dir: 'W', left: 1 });
    expect(signAt(start(pieceOf('R05')))).toEqual({ dir: 'E', left: 3 });
  });

  it('is the step towards the die of the way, where the player is not on it: up the stair, over, and then the rolls', () => {
    const { state, dirs, left } = follow(pieceOf('R02'));
    expect(dirs).toEqual(['N', 'N', 'N', 'N', 'N', 'W']);
    // Steps are not moves: the way is as long after them as before.
    expect(left).toEqual([4, 4, 4, 3, 2, 1]);
    expect(state.endReason).toBe('passed');
    expect(state.levelRun!.moves).toBe(4);
  });

  it('is the step over to the second die when the first has made its combo', () => {
    const { state, dirs, left } = follow(pieceOf('R07'));
    expect(dirs).toEqual(['N', 'W', 'N', 'N', 'W']);
    expect(left).toEqual([4, 3, 3, 2, 1]);
    expect(state.endReason).toBe('passed');
  });

  it('clears every piece in its fewest moves when it is followed from the start', () => {
    for (const spec of ROAD) {
      const { state } = follow(spec);
      expect(state.endReason, spec.id).toBe('passed');
      expect(state.levelRun!.moves, spec.id).toBe(spec.par);
    }
  });

  it('clears a piece from a board the player has wandered to', () => {
    const wandered: readonly (readonly [string, readonly Dir[]])[] = [
      ['R01', ['N', 'N', 'S']],
      ['R03', ['N']],
      ['R04', ['W', 'W']],
      ['R05', ['E', 'E', 'E']],
      ['R06', ['N', 'E']],
      ['R02', ['N', 'N', 'N', 'S', 'S', 'S']],
      ['R07', ['N', 'W', 'N', 'S', 'E', 'E']],
    ];
    for (const [id, before] of wandered) {
      const { state } = follow(pieceOf(id), before);
      expect(state.endReason, `${id} after ${before.join('')}`).toBe('passed');
    }
  });

  it('is not asked of a board that moves, of one that is over, or outside the levels', () => {
    const none = { dir: null, left: null };
    const state = start(pieceOf('R01'));
    step(state, 'N');
    expect(worldRuns(state) || Boolean(state.player.action)).toBe(true);
    expect(signAt(state)).toEqual(none);
    const { state: passed } = follow(pieceOf('R03'));
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
    const state = start(pieceOf('R02'));
    expect(stepsTo(state, { x: 3, z: 5, level: 'ground' })).toEqual([]);
  });

  it('lead from the floor up the die that is leaving and on over the dice', () => {
    const state = start(pieceOf('R02'));
    expect(stepsTo(state, { x: 3, z: 4, level: 'top' })).toEqual(['N']);
    expect(stepsTo(state, { x: 3, z: 3, level: 'top' })).toEqual(['N', 'N']);
  });

  it('are never a roll: a cell with no die is not stepped to from a die that stands', () => {
    const state = start(pieceOf('R02'));
    // On the die at the foot of the strip: the cell to its north is empty, and getting there is a move.
    go(state, 'N');
    go(state, 'N');
    expect(state.player).toEqual({ x: 3, z: 3, level: 'top' });
    expect(stepsTo(state, { x: 3, z: 2, level: 'top' })).toBeNull();
    expect(stepsTo(state, { x: 1, z: 0, level: 'top' })).toBeNull();
    expect(state.levelRun!.moves).toBe(0);
  });

  it('leave the board as it was', () => {
    const state = start(pieceOf('R02'));
    const before = JSON.stringify(state);
    stepsTo(state, { x: 3, z: 3, level: 'top' });
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

  it('are counted on a piece as it is played: a roll there and back on the small board is two', () => {
    const spec = pieceOf('R03');
    const state = start(spec);
    go(state, 'N');
    go(state, 'S');
    expect(state.levelRun!.moves).toBe(2);
    expect(wastedMoves(spec.par, state.levelRun!.moves, signAt(state).left)).toBeGreaterThanOrEqual(2);
  });
});

describe('where the sign stands', () => {
  it('starts at the edge of the cell of the figure, on the side the swipe goes to', () => {
    expect(signStart({ x: 2, z: 3 }, 'N')).toEqual({ x: 2, z: 2.5 });
    expect(signStart({ x: 2, z: 3 }, 'S')).toEqual({ x: 2, z: 3.5 });
    expect(signStart({ x: 2, z: 3 }, 'E')).toEqual({ x: 2.5, z: 3 });
    expect(signStart({ x: 2, z: 3 }, 'W')).toEqual({ x: 1.5, z: 3 });
  });

  it('is by the figure wherever on the board the figure is, and never by the far edge of the board', () => {
    for (const spec of ROAD) {
      const state = start(spec);
      const { dir } = signAt(state);
      const at = signStart(state.player, dir!);
      expect(Math.abs(at.x - state.player.x) + Math.abs(at.z - state.player.z), spec.id).toBe(0.5);
    }
    // At the edge of a wide board as in its middle.
    expect(signStart({ x: 0, z: 0 }, 'W')).toEqual({ x: -0.5, z: 0 });
    expect(signStart({ x: 9, z: 4 }, 'E')).toEqual({ x: 9.5, z: 4 });
  });

  it('is where each piece asks for it at its start: north of the die on the strip, north of the floor before the stair', () => {
    const at = (id: string) => {
      const state = start(pieceOf(id));
      return signStart(state.player, signAt(state).dir!);
    };
    expect(at('R01')).toEqual({ x: 2, z: 4.5 });
    expect(at('R02')).toEqual({ x: 3, z: 4.5 });
    expect(at('R03')).toEqual({ x: 0.5, z: 1 });
    expect(at('R05')).toEqual({ x: 0.5, z: 2 });
  });

  it('goes with the figure: after a step and after a roll it starts from the cell the figure has come to', () => {
    const state = start(pieceOf('R02'));
    go(state, 'N');
    expect(signStart(state.player, signAt(state).dir!)).toEqual({ x: 3, z: 3.5 });
    go(state, 'N');
    go(state, 'N');
    expect(signStart(state.player, signAt(state).dir!)).toEqual({ x: 3, z: 1.5 });
  });
});

describe('how high the sign stands', () => {
  it('is the height the figure stands at: the top of a die for a player on the dice, the floor for one on the floor', () => {
    expect(signHeight('top')).toBe(1);
    expect(signHeight('ground')).toBe(0);
  });

  it('is the floor before the stair of the second piece and the top of a die once the stair is climbed, and the top of a die where the other pieces start', () => {
    const stair = start(pieceOf('R02'));
    expect(signHeight(stair.player.level)).toBe(0);
    go(stair, 'N');
    expect(signHeight(stair.player.level)).toBe(1);
    for (const spec of ROAD) if (spec.id !== 'R02') expect(signHeight(start(spec).player.level), spec.id).toBe(1);
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

describe('what a piece shows while the player waits, frame by frame', () => {
  const NOTHING = { dir: null, blink: false };

  it('is kept for the pieces of the road only', () => {
    for (const spec of ROAD) expect(roadWait(spec.id), spec.id).not.toBeNull();
    for (const spec of LEVELS) expect(roadWait(spec.id), spec.id).toBeNull();
    expect(roadWait('F1')).toBeNull();
    expect(roadWait('F1a')).toBeNull();
  });

  it('opens the first piece with its sign, takes it away with the first roll, and brings the sign of the way after six seconds', () => {
    const state = start(pieceOf('R01'));
    const wait = roadWait('R01')!;
    expect(wait.frame(state, 100, true)).toEqual({ dir: 'N', blink: false });
    expect(wait.frame(state, 60_000, true)).toEqual({ dir: 'N', blink: false });
    go(state, 'N');
    expect(wait.frame(state, 61_000, true)).toEqual(NOTHING);
    expect(wait.frame(state, 66_999, true)).toEqual(NOTHING);
    expect(wait.frame(state, 67_000, true)).toEqual({ dir: 'N', blink: false });
    go(state, 'N');
    expect(wait.frame(state, 67_100, true)).toEqual(NOTHING);
    // A roll back is a move like any: the sign waits its seconds again, and points the way from where the die now is.
    go(state, 'S');
    expect(wait.frame(state, 70_000, true)).toEqual(NOTHING);
    expect(wait.frame(state, 76_000, true)).toEqual({ dir: 'N', blink: false });
  });

  it('opens the other pieces with nothing, blinks the plaque from four seconds and shows the way from eight', () => {
    const state = start(pieceOf('R02'));
    const wait = roadWait('R02')!;
    expect(wait.frame(state, 1000, true)).toEqual(NOTHING);
    expect(wait.frame(state, 4999, true)).toEqual(NOTHING);
    expect(wait.frame(state, 5000, true)).toEqual({ dir: null, blink: true });
    expect(wait.frame(state, 8999, true)).toEqual({ dir: null, blink: true });
    expect(wait.frame(state, 9000, true)).toEqual({ dir: 'N', blink: false });
    // A step takes the sign away as a move does, and the next one is the step that follows.
    go(state, 'N');
    expect(wait.frame(state, 9500, true)).toEqual(NOTHING);
    expect(wait.frame(state, 17_500, true)).toEqual({ dir: 'N', blink: false });
  });

  it('shows nothing and asks nothing of a board that moves, and counts the wait from when it stands', () => {
    const state = start(pieceOf('R03'));
    const wait = roadWait('R03')!;
    expect(wait.frame(state, 0, true)).toEqual(NOTHING);
    expect(wait.frame(state, 9000, true)).toEqual({ dir: 'W', blink: false });
    step(state, 'N');
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
    const state = start(pieceOf('R03'));
    const wait = roadWait('R03')!;
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

  it('keeps the opening sign of the first piece out from under a panel', () => {
    const state = start(pieceOf('R01'));
    const wait = roadWait('R01')!;
    expect(wait.frame(state, 0, false)).toEqual(NOTHING);
    expect(wait.frame(state, 16, true)).toEqual({ dir: 'N', blink: false });
  });

  it('shows the way at once when three moves have been wasted', () => {
    const state = start(pieceOf('R03'));
    const wait = roadWait('R03')!;
    let time = 0;
    const seen: (Dir | null)[] = [];
    // To the north and back, and to the north again: three rolls, and the board no nearer.
    for (const dir of ['N', 'S', 'N'] as const) {
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
    const state = start(pieceOf('R03'));
    const wait = roadWait('R03')!;
    wait.frame(state, 0, true);
    go(state, 'W');
    expect(state.endReason).toBe('passed');
    expect(wait.frame(state, 60_000, true)).toEqual(NOTHING);
  });

  it('asks the solver once for a board, not on every frame', () => {
    const asked = vi.mocked(solveFrom);
    const state = start(pieceOf('R02'));
    const wait = roadWait('R02')!;
    asked.mockClear();
    for (let time = 0; time <= 9000; time += 16) wait.frame(state, time, true);
    expect(asked).toHaveBeenCalledTimes(1);
    go(state, 'N');
    for (let time = 9016; time <= 20_000; time += 16) wait.frame(state, time, true);
    expect(asked).toHaveBeenCalledTimes(2);
    // Under a panel nothing is asked, whatever the board.
    go(state, 'N');
    for (let time = 20_016; time <= 21_000; time += 16) wait.frame(state, time, false);
    expect(asked).toHaveBeenCalledTimes(2);
  });
});
