import { defaultConfig, levelConfig } from '../rules';
import { scoreOf } from '../rules/levelScore';
import { moveText, solveLevel } from '../rules/levelSolver';
import type { LevelSpec, Technique } from '../rules/types';
import { FROM_ROUTE, FROM_SOLUTION, candidate } from './generate';
import { firstsOf, underOf } from './measures';
import { orderMisses, recipeOf, type Order } from './orders';
import { sameBoard } from './variety';

/**
 * Boards for an order, in seconds. The judge of the places of the list (`judge` of `select.ts`)
 * proves what a board cannot be cleared without and plays it with the players made of the rules:
 * it takes a second and more to a board, which is right for a list picked once and wrong for a
 * board the owner waits for. So an order is judged here by less: the board is solved, and what
 * the order says is read off its fewest moves, the score of its way and the board as it lies.
 * Two things are therefore said more weakly than a place says them: a technique is `needed`
 * where the shortest way leans on it, with no proof that no way does without; and nothing is
 * asked of how the players fare. Both are said of the board afterwards, in the background tier
 * of the page, once it is on the board.
 */

/** Boards the solver may see on a candidate of an order: a board that takes more is turned away, which keeps a search to its seconds. */
export const ORDER_MAX_STATES = 30_000;

/** A board held against an order. */
export interface Judged {
  /** The board with its fewest moves and a way written into it, where it has one. */
  spec: LevelSpec;
  par: number | null;
  exact: boolean;
  route: string | null;
  /** What it does not meet of the order, in words; empty where it meets all of it. */
  misses: string[];
  /** How far it is from the order: a miss of a number by how far outside it is, any other miss as one. */
  distance: number;
}

const span = ([from, to]: readonly [number, number]): string => (from === to ? String(from) : `${from}-${to}`);

/** Holds a board against an order. Null where the rules lay no such board. */
export function judgeBoard(order: Order, board: LevelSpec, opts: { maxStates?: number } = {}): Judged | null {
  const { par: _par, exact: _exact, solution: _solution, ...bare } = board;
  let solved;
  try {
    levelConfig(defaultConfig(), bare);
    solved = solveLevel(bare, { maxStates: opts.maxStates ?? ORDER_MAX_STATES });
  } catch {
    return null;
  }
  const misses: string[] = [];
  let distance = 0;
  const miss = (what: string, far = 1): void => {
    misses.push(what);
    distance += far;
  };
  /** A number held against its bounds: outside them it is a miss, as far as it is outside. */
  const within = (name: string, value: number, bounds: readonly [number, number] | undefined): void => {
    if (!bounds || (value >= bounds[0] && value <= bounds[1])) return;
    miss(`${name} ${value}, not ${span(bounds)}`, value < bounds[0] ? bounds[0] - value : value - bounds[1]);
  };

  const dice = bare.layout?.dice.length ?? 0;
  if (dice < order.dice || dice > order.dice + (order.more ?? 0)) miss(`${dice} dice, not ${order.dice}${order.more ? `-${order.dice + order.more}` : ''}`, Math.abs(dice - order.dice));
  if (order.hidden) {
    const under = underOf(bare);
    if (order.hidden === 'hidden' && under === 0) miss('no working face lies under a die');
    if (order.hidden === 'shown' && under > 0) miss(`${under} dice have a working face under them`);
  }

  const found = solved.solution;
  if (!found) {
    miss(solved.exhausted ? 'no way: the board cannot be cleared' : 'no way found: the board is too big for a search of seconds', 100);
    return { spec: bare, par: null, exact: false, route: null, misses, distance };
  }
  const way = found.moves.map(moveText);
  const score = scoreOf(bare, found.moves);
  within('moves', found.par, order.par);
  within('quiet moves', score.quiet, order.quiet);
  within('tail', score.tail, order.tail);
  within('dice of the last event', score.last, order.last);
  const uses = new Set<Technique>(found.uses);
  for (const technique of order.needs ?? []) if (!uses.has(technique)) miss(`the way does without ${technique}`);
  for (const technique of order.avoid ?? []) if (uses.has(technique)) miss(`the way leans on ${technique}`);
  if (order.endsOn) {
    const last = score.beats[score.beats.length - 1];
    if (!last || last.event !== order.endsOn.event) miss(`the way ends on ${last?.event ?? 'nothing'}, not on ${order.endsOn.event}`);
    else if (order.endsOn.spare !== undefined && last.spare !== null && last.spare !== order.endsOn.spare) miss(`the last link comes with ${last.spare} to spare, not ${order.endsOn.spare}`, Math.abs(last.spare - order.endsOn.spare));
  }
  if (order.far !== undefined) {
    const { start } = bare.layout!;
    const first = found.moves[0];
    const steps = Math.abs(first.x - start.x) + Math.abs(first.z - start.z);
    if (steps < order.far) miss(`the die of the first move is ${steps} cells from the start, not ${order.far} or more`, order.far - steps);
  }
  // What takes a search of its own is asked last, and only of a board that is near the order already.
  if (order.firsts && distance <= 2) within('first moves', firstsOf(bare, found.par, 15_000), order.firsts);
  if (distance <= 2) for (const said of orderMisses(order, bare, way)) miss(said);
  return { spec: { ...bare, par: found.par, exact: true, solution: way }, par: found.par, exact: true, route: score.route, misses, distance };
}

/** A board offered for an order: the board judged, and the seed it was laid from. */
export interface OrderOffer extends Judged {
  seed: number;
}

/** The order of offers: those that meet the order first, then by how far they are from it; of two as far, the one laid first. */
export function byOrder(a: OrderOffer, b: OrderOffer): number {
  return a.misses.length - b.misses.length || a.distance - b.distance || a.seed - b.seed;
}

/**
 * Lays boards for an order and judges them, until its seconds are spent or its seeds are: the
 * offers, the best first. The boards are laid by what lays the boards of a place: at random, and
 * from a solution backwards, and where the preset of the order has a route, from the route. A
 * board that is one of `skip`, or one already offered, turned or mirrored, is left out. Where
 * no board meets the order the nearest ones are given, each with what it misses.
 */
export function offersFor(order: Order, opts: { from?: number; seeds?: number; budgetMs?: number; keep?: number; skip?: readonly LevelSpec[]; now?: () => number } = {}): { offers: OrderOffer[]; tried: number; next: number } {
  const { from = 1, seeds = 4000, budgetMs = 3000, keep = 5, skip = [], now = Date.now } = opts;
  const recipe = recipeOf(order);
  const ways = [0, FROM_SOLUTION, ...(recipe.scenes ? [FROM_ROUTE] : [])];
  const began = now();
  const offers: OrderOffer[] = [];
  let tried = 0;
  let number = from;
  search: for (; number < from + seeds; number++) {
    for (const base of ways) {
      if (now() - began >= budgetMs) break search;
      tried++;
      let board: LevelSpec | null;
      try {
        board = candidate(recipe, base + number);
      } catch {
        board = null;
      }
      if (!board) continue;
      const judged = judgeBoard(order, board);
      if (!judged || judged.par === null) continue;
      if ([...skip, ...offers.map((offer) => offer.spec)].some((other) => sameBoard(other, judged.spec))) continue;
      offers.push({ ...judged, seed: base + number });
      offers.sort(byOrder);
      if (offers.length > keep * 4) offers.length = keep * 4;
      // Enough boards that meet the order: the search is over before its time.
      if (offers.filter((offer) => offer.misses.length === 0).length >= keep) break search;
    }
  }
  return { offers: offers.slice(0, keep), tried, next: number + 1 };
}
