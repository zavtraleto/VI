import { worldRuns } from '../rules/level';
import { solveFrom } from '../rules/levelSolver';
import type { RunState } from '../rules/types';

/**
 * How far a level is from being cleared, from where its board stands (word of the owner,
 * 4 November 2026, «А + Б»: docs/VI_Levels_Playtest_2026-11-04.md, section 3). The solver is
 * asked from the board as it is, within a bound: a board it shows cannot be cleared at all is a
 * dead end, as one with too few dice is (A); a board whose best finish lies far over the fewest
 * moves of the level lights the button that starts it over, once a try (B). Nothing here reads a
 * clock or draws, and the run given is left as it was.
 */

/** Boards the solver may see for one board of a level in the worker: past them it does not say. */
export const WAY_MAX_STATES = 200_000;

/** Boards it may see where no worker could be started, and the count is made on the frame. */
export const WAY_INLINE_STATES = 2_000;

/** Moves over the fewest of the level past which the best finish from a board is far (B). */
export const FAR_OVER = 6;

/** What the solver found from a board: the fewest moves left, or none; `settled` where it saw every board within its bound. */
export interface WayFound {
  fewest: number | null;
  settled: boolean;
}

/** What a board of a level is, by its way: on the way, far from it, lost for good, or not known. */
export type WayVerdict = 'open' | 'far' | 'lost' | 'unknown';

/** Whether the solver can be asked of this board now: a level that is not over, with its world standing still. */
export function askable(state: RunState): boolean {
  return state.levelRun !== null && !state.over && !state.player.action && !worldRuns(state);
}

/** The fewest moves the board is still cleared in, as the solver finds them within its bound. */
export function wayFrom(state: RunState, maxStates = WAY_MAX_STATES): WayFound {
  if (!askable(state)) return { fewest: null, settled: false };
  const solved = solveFrom(state, { maxStates });
  return solved.solution ? { fewest: solved.solution.par, settled: true } : { fewest: null, settled: solved.exhausted };
}

/**
 * The verdict on a board: lost where the solver saw every board and none is cleared; far where the
 * moves made and the fewest left come to more than `FAR_OVER` over the fewest of the level; open
 * otherwise. Not known where the solver gave up, or the level keeps no fewest.
 */
export function wayVerdict(found: WayFound | null, made: number, par: number | undefined): WayVerdict {
  if (!found) return 'unknown';
  if (found.fewest === null) return found.settled ? 'lost' : 'unknown';
  if (par === undefined) return 'open';
  return made + found.fewest > par + FAR_OVER ? 'far' : 'open';
}
