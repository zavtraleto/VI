import { QUICK_MAX_STATES, checkOf, movesOf, nearOf, type Check, type MoveFact, type NearFact } from '../levels/labText';
import { trapDepthOf } from '../levels/orders';
import { firstsOf } from '../levels/measures';
import { createRun, defaultConfig } from '../rules';
import { levelDeadEnd, shortGroups, type LevelDeadEnd, type ShortGroup } from '../rules/level';
import { report, type LevelReport } from '../rules/levelReport';
import { scoreOf } from '../rules/levelScore';
import { SOLVER_MAX_STATES, solveLevel } from '../rules/levelSolver';
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
  /** How deep the trap is: moves after it before the board is seen lost (0 at once); null where there is none (`trapDepthOf`). */
  trap: number | null;
}

export function secondsOf(spec: LevelSpec, maxStates = SOLVER_MAX_STATES): Seconds {
  const check = checkOf(spec, { maxStates });
  return { check, firsts: check.par === null ? 0 : firstsOf(spec, check.par), moves: check.par === null ? [] : movesOf(spec), trap: check.way ? trapDepthOf(spec, check.way) : null };
}

/**
 * The dice a board does not need: with such a die taken off, the board is cleared in as many
 * moves and by the same route, sign for sign. It is the test by pruning: a die that changes
 * nothing when it goes is a red herring, or a die that goes along with a combo for nothing. The
 * die the player starts on and a fixed die are not tried, and a board the rules refuse without
 * the die, a combo standing ready or no board at all, says nothing of it.
 */
export function spareOf(spec: LevelSpec, maxStates = QUICK_MAX_STATES): { x: number; z: number }[] {
  const { layout } = spec;
  if (!layout) return [];
  const whole = solveLevel(spec, { maxStates }).solution;
  if (!whole) return [];
  const route = scoreOf(spec, whole.moves).route;
  const spare: { x: number; z: number }[] = [];
  layout.dice.forEach((die, index) => {
    if (die.fixed || (!layout.onFloor && die.x === layout.start.x && die.z === layout.start.z)) return;
    const leaving = (layout.leaving ?? []).filter((left) => left.die !== index).map((left) => ({ die: left.die > index ? left.die - 1 : left.die, moves: left.moves }));
    const { leaving: _leaving, ...rest } = layout;
    const without: LevelSpec = { ...spec, norm: spec.norm - 1, layout: { ...rest, dice: layout.dice.filter((_, at) => at !== index), ...(leaving.length > 0 ? { leaving } : {}) } };
    try {
      const solved = solveLevel(without, { maxStates }).solution;
      if (solved && solved.par === whole.par && scoreOf(without, solved.moves).route === route) spare.push({ x: die.x, z: die.z });
    } catch {
      // No board without the die: nothing is said of it.
    }
  });
  return spare;
}

/** Later, in the background: the report of the players of the levels, every board one change away, and the dice the board does not need. */
export interface Later {
  report: LevelReport;
  near: NearFact[];
  spare: { x: number; z: number }[];
}

/** The games each player of the report plays in the third tier. */
export const LATER_RUNS = 10;

export function laterOf(spec: LevelSpec, runs = LATER_RUNS): Later {
  // The report takes a way a level keeps at its word; here the board is asked, so it is given without one.
  const { par: _par, exact: _exact, solution: _solution, ...bare } = spec;
  return { report: report(bare, { runs }), near: nearOf(bare), spare: spareOf(bare) };
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
