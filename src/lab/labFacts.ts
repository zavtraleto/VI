import { levelId } from '../levels/generate';
import { QUICK_MAX_STATES, checkOf, genFile, genOf, movesOf, nearBoards, nearOf, type Check, type MoveFact, type NearFact } from '../levels/labText';
import { completeFor, improveFor, offersFor, repairFor, type Mended, type OrderOffer } from '../levels/orderSearch';
import type { Order } from '../levels/orders';
import { setFor, type SetBoard } from '../levels/sets';
import { PLACES, type Recipe } from '../levels/recipes';
import { ROAD_PLACES } from '../levels/roadRecipes';
import { CAMPAIGN_PLACES } from '../levels/campaignRecipes';
import { firstsOf } from '../levels/measures';
import { createRun, defaultConfig } from '../rules';
import { levelDeadEnd, shortGroups, type LevelDeadEnd, type ShortGroup } from '../rules/level';
import { report, type LevelReport } from '../rules/levelReport';
import { scoreOf } from '../rules/levelScore';
import { SOLVER_MAX_STATES, solveLevel } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { printBoard } from '../levels/boardFile';

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

export function laterOf(spec: LevelSpec, runs = 10): Later {
  // The report takes a way a level keeps at its word; here the board is asked, so it is given without one.
  const { par: _par, exact: _exact, solution: _solution, ...bare } = spec;
  return { report: report(bare, { runs }), near: nearOf(bare), spare: spareOf(bare) };
}

/** A board offered to the owner: one laid for a place, or one a change away from the board in hand. */
export interface Offer {
  /** The name of the file it would be kept in, and its text. */
  name: string;
  text: string;
  /** What it is, in a few words: the seed it was laid from, or the change that made it. */
  what: string;
  spec: LevelSpec;
  par: number | null;
  exact: boolean;
}

/** The places boards are laid for: the places of the list, of the road and of the acts of the campaign. */
const ALL_PLACES: readonly Recipe[] = [...PLACES, ...ROAD_PLACES, ...CAMPAIGN_PLACES];

/** Those places by the names of their levels. */
export const GEN_PLACES: readonly string[] = ALL_PLACES.map(levelId);

/** Seeds a place is asked for boards with from the page. */
export const GEN_SEEDS = 200;

/** The boards a place gets from its first seeds, the best first. */
export function offersOfPlace(place: string, seeds = GEN_SEEDS): Offer[] {
  const recipe = ALL_PLACES.find((candidate) => levelId(candidate) === place);
  if (!recipe) throw new Error(`no place ${place}`);
  return genOf(recipe, { from: 1, to: seeds }).map((fit) => ({ ...genFile(recipe, fit), what: `зерно ${fit.seed}`, spec: fit.spec, par: fit.par, exact: fit.exact }));
}

/** The boards one change away from a board that are still cleared: the longest way first, and among ways as long those proved the fewest. */
export function offersOfBoard(spec: LevelSpec, name: string): Offer[] {
  const { par: _par, exact: _exact, solution: _solution, ...bare } = spec;
  return nearBoards(bare)
    .filter((board) => board.par !== null)
    .sort((a, b) => b.par! - a.par! || Number(b.exact) - Number(a.exact))
    .map((board, index) => {
      const id = `${name}-e${index + 1}`;
      const kept = { ...board.spec, id };
      return { name: id, text: printBoard(kept, { status: 'D', note: `от ${name}: ${board.what}` }), what: board.what, spec: kept, par: board.par, exact: board.exact };
    });
}

/** What the page asks of the worker, and what it is told. An answer bears the number of its question. */
export type Ask =
  | { id: number; tier: 'seconds'; spec: LevelSpec }
  | { id: number; tier: 'later'; spec: LevelSpec }
  | { id: number; tier: 'gen'; place: string }
  | { id: number; tier: 'gen'; spec: LevelSpec; name: string }
  | { id: number; tier: 'order'; order: Order; from: number; budgetMs: number; skip: LevelSpec[] }
  | { id: number; tier: 'complete'; order: Order; spec: LevelSpec; pinned: { x: number; z: number }[]; from: number }
  | { id: number; tier: 'repair'; order: Order; spec: LevelSpec; pinned: { x: number; z: number }[] }
  | { id: number; tier: 'improve'; order: Order; spec: LevelSpec; pinned: { x: number; z: number }[]; seed: number }
  | { id: number; tier: 'set'; keys: string[] };

/** What a worker answers when it is asked to build a board about pinned dice, or to mend one. */
export type Fixed = { kind: 'complete'; offers: OrderOffer[]; tried: number; next: number } | { kind: 'repair'; mended: Mended[]; tried: number };
export type Told = { id: number; tier: 'seconds'; facts: Seconds } | { id: number; tier: 'later'; facts: Later } | { id: number; tier: 'gen'; facts: Offer[] } | { id: number; tier: 'order'; facts: { offers: OrderOffer[]; tried: number; next: number } } | { id: number; tier: 'complete' | 'repair' | 'improve'; facts: Fixed } | { id: number; tier: 'set'; facts: { boards: SetBoard[]; missing: string[] } } | { id: number; tier: Ask['tier']; error: string };

/** Answers a question: the work of the worker, kept here so that it can be asked without one. */
export function answer(ask: Ask): Told {
  try {
    if (ask.tier === 'seconds') return { id: ask.id, tier: 'seconds', facts: secondsOf(ask.spec) };
    if (ask.tier === 'set') return { id: ask.id, tier: 'set', facts: setFor(ask.keys) };
    if (ask.tier === 'improve') return { id: ask.id, tier: 'improve', facts: { kind: 'repair', ...improveFor(ask.order, ask.spec, ask.pinned, { seed: ask.seed }) } };
    if (ask.tier === 'complete') return { id: ask.id, tier: 'complete', facts: { kind: 'complete', ...completeFor(ask.order, ask.spec, ask.pinned, { from: ask.from }) } };
    if (ask.tier === 'repair') return { id: ask.id, tier: 'repair', facts: { kind: 'repair', ...repairFor(ask.order, ask.spec, ask.pinned) } };
    if (ask.tier === 'order') return { id: ask.id, tier: 'order', facts: offersFor(ask.order, { from: ask.from, budgetMs: ask.budgetMs, skip: ask.skip }) };
    if (ask.tier === 'gen') return { id: ask.id, tier: 'gen', facts: 'place' in ask ? offersOfPlace(ask.place) : offersOfBoard(ask.spec, ask.name) };
    return { id: ask.id, tier: 'later', facts: laterOf(ask.spec) };
  } catch (error) {
    return { id: ask.id, tier: ask.tier, error: (error as Error).message };
  }
}
