import { checkOf, movesOf, nearOf, type Check, type MoveFact, type NearFact } from '../levels/labText';
import { firstsOf } from '../levels/measures';
import { createRun, defaultConfig } from '../rules';
import { levelDeadEnd, shortGroups, type LevelDeadEnd, type ShortGroup } from '../rules/level';
import { report, type LevelReport } from '../rules/levelReport';
import { SOLVER_MAX_STATES } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';

/**
 * What the page of the lab says of a board, in three tiers by what each costs. The first is
 * asked on the page itself, at once, with every change. The second takes a second or so and the
 * third longer: they are asked of a worker (`solve.worker.ts`), which is stopped when the board
 * is changed again, so that a number is never of a board that is not there any more.
 */

/** At once: whether the rules lay the board, whether it is a dead end as it lies, and the groups its dice are short of. */
export interface Instant {
  error: string | null;
  deadEnd: LevelDeadEnd | null;
  dice: number;
  groups: ShortGroup[];
}

export function instantOf(spec: LevelSpec): Instant {
  try {
    const state = createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });
    return { error: null, deadEnd: levelDeadEnd(state), dice: state.cubes.length, groups: shortGroups(state) };
  } catch (error) {
    return { error: (error as Error).message, deadEnd: null, dice: spec.layout?.dice.length ?? 0, groups: [] };
  }
}

/** In a second or so: the board solved, the first moves that keep it in hand, and what every move from the start does. */
export interface Seconds {
  check: Check;
  /** First moves after which the board is still cleared within a move of the fewest; 0 where no way is known. */
  firsts: number;
  moves: MoveFact[];
}

export function secondsOf(spec: LevelSpec, maxStates = SOLVER_MAX_STATES): Seconds {
  const check = checkOf(spec, { maxStates });
  return { check, firsts: check.par === null ? 0 : firstsOf(spec, check.par), moves: check.par === null ? [] : movesOf(spec) };
}

/** Later, in the background: the report of the players of the levels, and every board one change away. */
export interface Later {
  report: LevelReport;
  near: NearFact[];
}

export function laterOf(spec: LevelSpec, runs = 10): Later {
  // The report takes a way a level keeps at its word; here the board is asked, so it is given without one.
  const { par: _par, exact: _exact, solution: _solution, ...bare } = spec;
  return { report: report(bare, { runs }), near: nearOf(bare) };
}

/** What the page asks of the worker, and what it is told. An answer bears the number of its question. */
export type Ask = { id: number; tier: 'seconds'; spec: LevelSpec } | { id: number; tier: 'later'; spec: LevelSpec };
export type Told = { id: number; tier: 'seconds'; facts: Seconds } | { id: number; tier: 'later'; facts: Later } | { id: number; tier: Ask['tier']; error: string };

/** Answers a question: the work of the worker, kept here so that it can be asked without one. */
export function answer(ask: Ask): Told {
  try {
    if (ask.tier === 'seconds') return { id: ask.id, tier: 'seconds', facts: secondsOf(ask.spec) };
    return { id: ask.id, tier: 'later', facts: laterOf(ask.spec) };
  } catch (error) {
    return { id: ask.id, tier: ask.tier, error: (error as Error).message };
  }
}
