import type { ShortGroup } from '../rules/level';
import { movesAt, solveFrom, tellMove } from '../rules/levelSolver';
import type { RunState } from '../rules/types';
import { roadCounters } from './roadCounters';

/**
 * The plaques of a level as a hint: of the dice and heaps that are short of their combo, those
 * whose combo can be made within two moves from where the board stands, with the board still
 * one that can be cleared once it is made. A plaque that stands says "this one, now"; a heap
 * that takes longer, or whose combo leaves a board that cannot be cleared, has none.
 *
 * It is counted on the rules themselves: every move and every move after it is played on a copy
 * of the run, and a board a combo leaves is given to the solver. Nothing here reads a clock or
 * draws, and the run given is left as it was.
 */

/** Moves a combo may take to be hinted at. */
export const HINT_MOVES = 2;
/**
 * Boards the solver may see for one hint, all its searches together. A hint that runs out of
 * them says nothing of the heaps it has not settled: a plaque that is not sure does not stand.
 */
export const HINT_MAX_STATES = 20_000;

export interface ComboHints {
  groups: ShortGroup[];
  /** Boards the solver saw, and whether it settled every heap within its bounds. */
  states: number;
  settled: boolean;
}

/** A heap is made when each of its dice is leaving where it stood, showing what it showed. */
function madeIn(after: RunState, dice: readonly { id: number; x: number; z: number }[], value: number): boolean {
  return dice.every(({ id, x, z }) => {
    const cube = after.cubes.find((other) => other.id === id);
    return cube !== undefined && cube.state === 'sinking' && cube.x === x && cube.z === z && cube.ori.top === value;
  });
}

export function comboHints(state: RunState, maxStates = HINT_MAX_STATES): ComboHints {
  const none: ComboHints = { groups: [], states: 0, settled: true };
  if (!state.levelRun || state.over) return none;
  const groups = roadCounters(state);
  if (groups.length === 0) return none;
  const dice = groups.map((group) =>
    group.cells.map(({ x, z }) => {
      const cube = state.cubes.find((other) => other.x === x && other.z === z && other.state === 'idle')!;
      return { id: cube.id, x, z };
    }),
  );
  const good = groups.map(() => false);
  let states = 0;
  let settled = true;
  /** Whether the board a combo leaves can still be cleared; false where the solver has no boards left to see. */
  const clears = (after: RunState): boolean => {
    if (after.endReason === 'passed') return true;
    if (after.over) return false;
    if (states >= maxStates) {
      settled = false;
      return false;
    }
    const solved = solveFrom(after, { maxStates: maxStates - states });
    states += solved.states;
    if (!solved.exhausted) settled = false;
    return solved.solution !== null;
  };
  /** The heaps a board has made that are not hinted at yet; each board is asked of the solver once. */
  const take = (after: RunState): void => {
    const made = groups.map((group, i) => !good[i] && madeIn(after, dice[i], group.value));
    if (!made.includes(true) || !clears(after)) return;
    made.forEach((yes, i) => (good[i] ||= yes));
  };
  for (const first of movesAt(state)) {
    const one = tellMove(state, first);
    if (one.outcome.cleared) take(one.state);
    if (one.state.over || HINT_MOVES < 2 || good.every(Boolean)) continue;
    for (const second of movesAt(one.state)) {
      const two = tellMove(one.state, second);
      if (two.outcome.cleared) take(two.state);
    }
  }
  return { groups: groups.filter((_, i) => good[i]), states, settled };
}
