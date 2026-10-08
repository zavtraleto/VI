import { cubeAt, type RunState } from '../rules';

/**
 * The face of a die that the layout of the level laid as already leaving and that is still
 * going, as its own reaction has it. No group was said of such a die, so nothing has told the
 * board which light it throws. Nought where there is no such die: on a level whose layout lays
 * none, once it has gone, outside the levels, and for every die that goes by a group of its
 * own - those of a board a move was taken back to as well.
 */
export function laidFace(state: RunState): number {
  const layout = state.levelRun?.spec.layout;
  for (const { die } of layout?.leaving ?? []) {
    const { x, z, top, north } = layout!.dice[die];
    const cube = cubeAt(state, x, z);
    // A die that is leaving neither moves nor turns: the one that was laid still lies as it was laid.
    if (cube?.state !== 'sinking' || cube.ori.top !== top || cube.ori.north !== north) continue;
    const reaction = state.reactions.find(({ id }) => id === cube.reactionId);
    if (reaction) return reaction.value;
  }
  return 0;
}
