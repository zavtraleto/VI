import { cubeHeight, isHeld, worldRuns, type Cube, type RunState } from '../rules';
import type { ParamValues } from '../signal/scene';
import { BOARD_GROUPS } from './params';

/**
 * How high a die is shown, which is not always how high the rules have it. On a level a die that
 * leaves is shown by steps (docs/art/VI_Interface_Layer.md): a little lower the moment it leaves,
 * near the floor with its last move left to it, and gone after that; between two steps it goes
 * down through the move as it always did. The rules do not read this: a die is stepped onto and
 * rolled over by the height the rules give it (`cubeHeight`). A session is shown as the rules are.
 */

/** The two steps, as shares of a whole die: the moment a die leaves, and with its last move left. */
export interface LeavingSteps {
  first: number;
  last: number;
}

/** The steps as the look is set, or as they are defined where the look says nothing of them. */
export function leavingSteps(values?: ParamValues): LeavingSteps {
  const first = Number(values?.leaveFirst ?? BOARD_GROUPS.road.leaveFirst.value);
  const last = Number(values?.leaveLast ?? BOARD_GROUPS.road.leaveLast.value);
  return { first, last };
}

/**
 * The height a die that leaves is shown at, from the share of its time to go that is left
 * (`share`, 1 the moment it leaves and 0 when it is gone) and the moves it goes in. A whole share
 * is the first step; the share of one move is the last step; nothing is nothing. In between it
 * is the straight line from one to the next, so a die goes down through a move as smoothly as the
 * rules have it, only between other heights.
 */
export function leavingHeight(share: number, sinkMoves: number, steps: LeavingSteps = leavingSteps()): number {
  const left = Math.min(1, Math.max(0, share));
  if (sinkMoves <= 1) return steps.first * left;
  const lastShare = 1 / sinkMoves;
  if (left >= lastShare) return steps.last + ((steps.first - steps.last) * (left - lastShare)) / (1 - lastShare);
  return (steps.last * left) / lastShare;
}

/**
 * How much of a die is shown above the floor. `alpha` is the share of the next tick the picture
 * is ahead of the rules; a die held by the tutorial stays put between ticks, and so does one on a
 * level whose world stands. On a level a die that leaves is shown by its steps: its share of time
 * left is counted from the tick it left on, when a whole window of moves is before it, and a die
 * laid as leaving with every move of that window is a die that has just left.
 */
export function shownHeight(cube: Cube, state: RunState, alpha: number, values?: ParamValues): number {
  const ahead = isHeld(state, cube) || !worldRuns(state) ? 0 : alpha;
  if (!state.levelRun || cube.state !== 'sinking') return cubeHeight(cube, state.config, ahead);
  const { sinkingTicks, actionTicks } = state.config;
  // A level's dice go in so many moves and a tick: the tick is the one they leave on.
  const window = Math.max(1, sinkingTicks - 1);
  const moves = Math.max(1, Math.round(window / Math.max(1, actionTicks)));
  return leavingHeight((sinkingTicks - cube.t - ahead) / window, moves, leavingSteps(values));
}
