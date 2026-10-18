import type { ShortGroup } from '../rules/level';
import { movesAt, solveFrom, tellMove } from '../rules/levelSolver';
import type { RunState } from '../rules/types';
import { roadCounters } from './roadCounters';
import { goalFaces } from '../levels/goalFaces';

/**
 * The plaques of a level as a hint (word of the owner, 17 October 2026): a plaque stands over a
 * heap only when one roll of the die the player stands on makes its combo, and that roll keeps
 * the fewest moves the board can still be cleared in from where it stands. It stands over the
 * dice of the heap that are already there, never over the die under the player's feet: it says
 * "roll into here, now". A combo the roll makes with dice that are leaving (a link) has none.
 *
 * It is counted on the rules themselves: every roll is played on a copy of the run, and the
 * board it leaves is given to the solver. Nothing here reads a clock or draws, and the run given
 * is left as it was.
 */

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
  const { player } = state;
  const own = player.level === 'top' ? state.cubes.find((cube) => cube.x === player.x && cube.z === player.z) : undefined;
  if (own?.state !== 'idle') return none;
  const groups = roadCounters(state, goalFaces(state.levelRun.spec));
  const rolls = movesAt(state).filter((move) => !move.push && move.x === player.x && move.z === player.z);
  if (groups.length === 0 || rolls.length === 0) return none;
  const dice = groups.map((group) =>
    group.cells.map(({ x, z }) => {
      const cube = state.cubes.find((other) => other.x === x && other.z === z && other.state === 'idle')!;
      return { id: cube.id, x, z };
    }),
  );
  let states = 0;
  /** The fewest moves the board is cleared in, or null where the solver could not say within its bounds. */
  const fewest = (from: RunState): number | null => {
    if (from.endReason === 'passed') return 0;
    if (from.over) return Infinity;
    if (states >= maxStates) return null;
    const solved = solveFrom(from, { maxStates: maxStates - states });
    states += solved.states;
    if (solved.solution) return solved.solution.par;
    return solved.exhausted ? Infinity : null;
  };
  const now = fewest(state);
  if (now === null) return { groups: [], states, settled: false };
  if (now === Infinity) return { groups: [], states, settled: true };
  const good = groups.map(() => false);
  let settled = true;
  for (const roll of rolls) {
    const one = tellMove(state, roll);
    if (!one.outcome.cleared) continue;
    const made = groups.map((group, i) => !good[i] && madeIn(one.state, dice[i], group.value));
    if (!made.includes(true)) continue;
    const after = fewest(one.state);
    if (after === null) settled = false;
    else if (after === now - 1) made.forEach((yes, i) => (good[i] ||= yes));
  }
  return { groups: groups.filter((_, i) => good[i]), states, settled };
}
