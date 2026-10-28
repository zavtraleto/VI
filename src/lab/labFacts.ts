import { QUICK_MAX_STATES, checkOf, movesOf, nearOf, type Check, type MoveFact, type NearFact } from '../levels/labText';
import { depthOf } from '../levels/depth';
import { trapDepthOf } from '../levels/orders';
import { firstsOf, hiddenOf, rankOf, rankShares } from '../levels/measures';
import { difficulty } from '../levels/scale';
import { coreOf, layoutSim, similarityOf, type Core } from '../levels/signature';
import { createRun, defaultConfig } from '../rules';
import { levelDeadEnd, shortGroups, type LevelDeadEnd, type ShortGroup } from '../rules/level';
import { report, type LevelReport } from '../rules/levelReport';
import { scoreOf } from '../rules/levelScore';
import { SOLVER_MAX_STATES, moveText, solveLevel } from '../rules/levelSolver';
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

/**
 * The measures of the depth of a board (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md,
 * sections 3 and 6), as the table of the campaign has them: its difficulty on the scale, the depth a player
 * has to think, the forks, the hidden dice, the shortest and the long ways. The players here play
 * `LATER_RUNS` games each, where the table plays thirty: a rank near the edge may differ by a step.
 */
export interface Measures {
  d: number;
  /** The depth of the first player who clears the board in half the games or more; null where none does, the deep one too. */
  rank: number | null;
  forks: number;
  hidden: number;
  ways: number;
  waysLong: number;
  /** The graph was walked whole and every way counted: the numbers are the board's, not of what was seen of it. */
  complete: boolean;
}

/** Later, in the background: the report of the players of the levels, every board one change away, the dice the board does not need, and its measures; null where no way is found to measure it by. */
export interface Later {
  report: LevelReport;
  near: NearFact[];
  spare: { x: number; z: number }[];
  measures: Measures | null;
}

/** The games each player of the report plays in the third tier. */
export const LATER_RUNS = 10;

export function laterOf(spec: LevelSpec, runs = LATER_RUNS): Later {
  // The report takes a way a level keeps at its word; here the board is asked, so it is given without one.
  const { par: _par, exact: _exact, solution: _solution, ...bare } = spec;
  const told = report(bare, { runs });
  return { report: told, near: nearOf(bare), spare: spareOf(bare), measures: told.par === null || !told.way ? null : measuresOf({ ...bare, par: told.par, exact: told.exact, solution: told.way.map(moveText) }, runs) };
}

/** The measures of a board that keeps the way it is measured by, the one the solver found for it. */
function measuresOf(kept: LevelSpec, runs: number): Measures {
  const depth = depthOf(kept);
  const rank = rankOf(rankShares(kept, runs));
  const hidden = hiddenOf(kept);
  return {
    d: difficulty({ rank, forks: depth.forks, hidden, lossAt: depth.lossAt, par: depth.par }),
    rank,
    forks: depth.forks,
    hidden,
    ways: depth.ways,
    waysLong: depth.waysLong,
    complete: depth.complete && !depth.waysCapped && !depth.longCapped,
  };
}

/** A place of the row as the page has it: its number, its code, and its board as the row plays it. */
export interface RowPlace {
  number: number;
  code: string;
  spec: LevelSpec;
}

/** How alike the board in hand is to a place before it in the row (`similarity`). */
export interface Near {
  number: number;
  code: string;
  sim: number;
}

/** The thoughts of the boards of the row, read once a board: the page asks the row again with every fact. Null where the way a board keeps cannot be played. */
const cores = new WeakMap<LevelSpec, Core | null>();
const coreOfPlace = (spec: LevelSpec): Core | null => {
  if (!cores.has(spec)) cores.set(spec, readCore(spec));
  return cores.get(spec)!;
};
const readCore = (spec: LevelSpec): Core | null => {
  try {
    return coreOf(spec);
  } catch {
    return null;
  }
};

/**
 * How alike a board of the row is to every place before it (rule 17, spec section 5), in the order of the row:
 * asked on the page, off the boards the row keeps. A place before that keeps no way, or one that cannot be played,
 * is left out: its thought is read off its way, and the page does not solve it. Null where the way of the board
 * in hand cannot be played: the solver is to say what way it has.
 */
export function nearInRow(spec: LevelSpec, number: number, places: readonly RowPlace[]): Near[] | null {
  const core = readCore(spec);
  if (!core) return null;
  return places
    .filter((place) => place.number < number && (place.spec.solution?.length ?? 0) > 0)
    .sort((a, b) => a.number - b.number)
    .flatMap((place) => {
      const other = coreOfPlace(place.spec);
      return other ? [{ number: place.number, code: place.code, sim: similarityOf(core, other, layoutSim(spec, place.spec)) }] : [];
    });
}

/**
 * The board in hand with the way its thought is read by: the one its file keeps, unless the solver found that
 * there is none or that it does not hold, or a shorter one; then the solver's. Null where there is no way yet:
 * the page does not solve a board, the worker does.
 */
export function wayedFor(spec: LevelSpec, seconds: Seconds | string | null): LevelSpec | null {
  const check = seconds !== null && typeof seconds !== 'string' ? seconds.check : null;
  if (check?.way && (check.kept === null || check.kept === 'shorter' || check.kept === 'broken')) return { ...spec, solution: check.way };
  return (spec.solution?.length ?? 0) > 0 ? spec : null;
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
