import { describe, expect, it } from 'vitest';
import { cubeAt, cubeHeight } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { worldRuns } from '../rules/level';
import { createRun, step } from '../rules/sim';
import type { Dir, LevelSpec, RunState } from '../rules/types';
import { ROAD } from '../levels/road';
import { boardDefaults } from './params';
import { isStair, leavingHeight, leavingSteps, shownHeight } from './leaving';

const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
const pieceOf = (id: string): LevelSpec => ROAD.find((spec) => spec.id === id)!;

function go(state: RunState, dir: Dir): void {
  step(state, dir);
  for (let ticks = 0; (worldRuns(state) || state.player.action) && !state.over; ticks++) {
    if (ticks > 1000) throw new Error('a move that does not end');
    step(state, null);
  }
}

describe('the height a die that leaves a level is shown at', () => {
  it('is by steps on a board whose dice go in two moves: 0.78 when it leaves, 0.12 with a move left, and nothing then', () => {
    expect(leavingHeight(1, 2)).toBeCloseTo(0.78);
    expect(leavingHeight(0.5, 2)).toBeCloseTo(0.12);
    expect(leavingHeight(0, 2)).toBe(0);
    // In between, the straight line from one step to the next.
    expect(leavingHeight(0.75, 2)).toBeCloseTo(0.45);
    expect(leavingHeight(0.25, 2)).toBeCloseTo(0.06);
    // Past either end it stays at that end.
    expect(leavingHeight(1.1, 2)).toBeCloseTo(0.78);
    expect(leavingHeight(-0.1, 2)).toBe(0);
  });

  it('is the middle step for a stair with two moves left, down to the last step through the move, and nothing then', () => {
    expect(leavingHeight(1, 2, leavingSteps(), true)).toBeCloseTo(0.5);
    expect(leavingHeight(0.75, 2, leavingSteps(), true)).toBeCloseTo(0.31);
    expect(leavingHeight(0.5, 2, leavingSteps(), true)).toBeCloseTo(0.12);
    expect(leavingHeight(0, 2, leavingSteps(), true)).toBe(0);
  });

  it('keeps its steps in the look, where the lab can turn them', () => {
    expect(leavingSteps()).toEqual({ first: 0.78, last: 0.12, middle: 0.5 });
    expect(leavingSteps(boardDefaults())).toEqual({ first: 0.78, last: 0.12, middle: 0.5 });
    expect(leavingHeight(1, 2, leavingSteps({ stairMiddle: 0.4 }), true)).toBeCloseTo(0.4);
    expect(leavingHeight(1, 2, leavingSteps({ leaveFirst: 0.8, leaveLast: 0.15 }))).toBeCloseTo(0.8);
    expect(leavingHeight(0.5, 2, leavingSteps({ leaveFirst: 0.8, leaveLast: 0.15 }))).toBeCloseTo(0.15);
  });

  it('goes over the window of a board whose dice go in more moves: the last step with the last move left', () => {
    expect(leavingHeight(1, 3)).toBeCloseTo(0.78);
    expect(leavingHeight(1 / 3, 3)).toBeCloseTo(0.12);
    expect(leavingHeight(2 / 3, 3)).toBeCloseTo(0.45);
    expect(leavingHeight(1, 1)).toBeCloseTo(0.78);
  });

  it('is so on a piece of the road: the pair made, a move after it, and the stair laid as leaving in two moves and in one', () => {
    // The lesson of the way up: its stair is laid as leaving in two moves, and stands half way up, not as a die that has just left.
    const climb = start(pieceOf('R10'));
    expect(isStair(cubeAt(climb, 2, 1)!, climb)).toBe(true);
    expect(shownHeight(cubeAt(climb, 2, 1)!, climb, 0)).toBeCloseTo(0.5);
    go(climb, 'N');
    // The pair has just left, and the stair has a move left to it. The pair is no stair, though it is as far from going.
    expect(isStair(cubeAt(climb, 0, 2)!, climb)).toBe(false);
    expect(shownHeight(cubeAt(climb, 0, 2)!, climb, 0)).toBeCloseTo(0.78);
    expect(shownHeight(cubeAt(climb, 0, 1)!, climb, 0)).toBeCloseTo(0.78);
    expect(shownHeight(cubeAt(climb, 2, 1)!, climb, 0)).toBeCloseTo(0.12);
    // The rules have them otherwise, and are not changed: nearly whole, and about half.
    expect(cubeHeight(cubeAt(climb, 0, 2)!, climb.config)).toBeGreaterThan(0.9);
    expect(cubeHeight(cubeAt(climb, 2, 1)!, climb.config)).toBeGreaterThan(0.45);
    // The stair of two of the second piece: the lower laid as leaving in one move, near the floor, the upper in two, half way up.
    const stair = start(pieceOf('R02'));
    expect(shownHeight(cubeAt(stair, 4, 5)!, stair, 0)).toBeCloseTo(0.12);
    expect(shownHeight(cubeAt(stair, 4, 4)!, stair, 0)).toBeCloseTo(0.5);
    // A die that stands is whole.
    expect(shownHeight(cubeAt(stair, 4, 3)!, stair, 0)).toBe(1);
    // Up the stair, over, and the first roll: the lower is gone, and the upper has come down to where the lower was.
    for (const dir of ['N', 'N', 'N', 'N'] as const) go(stair, dir);
    expect(cubeAt(stair, 4, 5)).toBeUndefined();
    expect(shownHeight(cubeAt(stair, 4, 4)!, stair, 0)).toBeCloseTo(0.12);
    // With the second roll it is gone too.
    go(stair, 'N');
    expect(cubeAt(stair, 4, 4)).toBeUndefined();
  });

  it('is what the rules have outside a level', () => {
    const session = createRun({ seed: 1, config: defaultConfig() });
    for (const cube of session.cubes) expect(shownHeight(cube, session, 0.5)).toBe(cubeHeight(cube, session.config, 0.5));
    const sinking = { ...session.cubes[0], state: 'sinking' as const, t: 3 };
    expect(shownHeight(sinking, session, 0)).toBe(cubeHeight(sinking, session.config));
  });
});
