import { defaultConfig, levelConfig } from '../rules';
import { scoreOf } from '../rules/levelScore';
import { moveText, solveLevel } from '../rules/levelSolver';
import type { LevelSpec, Technique } from '../rules/types';
import { editsOf } from './edits';
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
  /** What its way leans on: empty where it has none. */
  uses: Technique[];
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
    return { spec: bare, par: null, exact: false, route: null, uses: [], misses, distance };
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
  return { spec: { ...bare, par: found.par, exact: true, solution: way }, par: found.par, exact: true, route: score.route, uses: [...found.uses], misses, distance };
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

/** A generator of numbers from a seed, each from 0 up to 1: the same seed gives the same board. */
function numbersFrom(seed: number): () => number {
  let state = (Math.imul(seed, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const at = (cell: { x: number; z: number }): string => `${cell.x},${cell.z}`;

/**
 * Boards for an order built about what the owner has put down: the dice of `pinned` stay where
 * they are and as they lie, with the cells cut out and the start if it is on one of them or on
 * the floor; the rest of the dice the order asks for are laid on the free cells by chance, half
 * of them showing a face that works and half another, and every board laid is judged by the
 * order. A die of the board that is not pinned is not kept: it is what is laid anew.
 */
export function completeFor(order: Order, board: LevelSpec, pinned: readonly { x: number; z: number }[], opts: { from?: number; tries?: number; budgetMs?: number; keep?: number; now?: () => number } = {}): { offers: OrderOffer[]; tried: number; next: number } {
  const { from = 1, tries = 4000, budgetMs = 3000, keep = 5, now = Date.now } = opts;
  const layout = board.layout;
  if (!layout) return { offers: [], tried: 0, next: from };
  const held = new Set(pinned.map(at));
  const kept = layout.dice.filter((die) => held.has(at(die)));
  const holes = new Set((board.holes ?? []).map(at));
  const startKept = layout.onFloor ? !holes.has(at(layout.start)) && layout.start.x >= 0 : held.has(at(layout.start));
  const free: { x: number; z: number }[] = [];
  for (let z = 0; z < board.size; z++) {
    for (let x = 0; x < board.size; x++) {
      const cell = { x, z };
      if (holes.has(at(cell)) || kept.some((die) => die.x === x && die.z === z) || (startKept && layout.onFloor && layout.start.x === x && layout.start.z === z)) continue;
      free.push(cell);
    }
  }
  const wanted = Math.max(0, order.dice - kept.length);
  const working = order.faces.filter((face) => face !== 1);
  const others = [1, 2, 3, 4, 5, 6].filter((face) => !order.faces.includes(face));
  const { par: _par, exact: _exact, solution: _solution, ...head } = board;
  const began = now();
  const offers: OrderOffer[] = [];
  let tried = 0;
  let seed = from;
  for (; seed < from + tries && now() - began < budgetMs && wanted <= free.length; seed++) {
    tried++;
    const next = numbersFrom(seed);
    const cells = [...free];
    const laid = [];
    for (let index = 0; index < wanted; index++) {
      const [cell] = cells.splice(Math.floor(next() * cells.length), 1);
      const faces = index % 2 === 0 || others.length === 0 ? (working.length > 0 ? working : order.faces) : others;
      const top = faces[Math.floor(next() * faces.length)];
      const sides = [1, 2, 3, 4, 5, 6].filter((face) => face !== top && face !== 7 - top);
      laid.push({ ...cell, top, north: sides[Math.floor(next() * sides.length)] });
    }
    const dice = [...kept, ...laid];
    const movable = dice.filter((die) => !die.fixed);
    if (!startKept && movable.length === 0) continue;
    const start = startKept ? layout.start : movable[Math.floor(next() * movable.length)];
    const leaving = (layout.leaving ?? []).flatMap(({ die, moves }) => {
      const index = kept.indexOf(layout.dice[die]);
      return index < 0 ? [] : [{ die: index, moves }];
    });
    const spec: LevelSpec = { ...head, norm: dice.length, layout: { start: { x: start.x, z: start.z }, dice, ...(leaving.length > 0 ? { leaving } : {}), ...(startKept && layout.onFloor ? { onFloor: true } : {}) } };
    const judged = judgeBoard(order, spec);
    if (!judged || judged.par === null || offers.some((offer) => sameBoard(offer.spec, judged.spec))) continue;
    offers.push({ ...judged, seed });
    offers.sort(byOrder);
    if (offers.filter((offer) => offer.misses.length === 0).length >= keep) break;
  }
  return { offers: offers.slice(0, keep), tried, next: seed + 1 };
}

/** A board mended for an order: the board, and the changes that made it of the one it was. */
export interface Mended extends Judged {
  edits: string[];
}

/**
 * The board nearest to the one given that meets an order: changed by one die, and if no such
 * board meets it, by two and by three from the best of those. A change is one of `editsOf`: a
 * die turned to another face, a die moved a cell, the start on another die; a die of `pinned`
 * is not changed. The board with the fewest changes that meets the order is given first; where
 * none meets it in the time there is, the nearest found, with what it still misses.
 */
export function repairFor(order: Order, board: LevelSpec, pinned: readonly { x: number; z: number }[], opts: { budgetMs?: number; keep?: number; now?: () => number } = {}): { mended: Mended[]; tried: number } {
  const { budgetMs = 8000, keep = 3, now = Date.now } = opts;
  const held = new Set(pinned.map(at));
  const began = now();
  let tried = 0;
  const found: Mended[] = [];
  const seen: LevelSpec[] = [board];
  const sorted = (): Mended[] => found.sort((a, b) => a.misses.length - b.misses.length || a.edits.length - b.edits.length || a.distance - b.distance);
  let front: Mended[] = [];
  const whole = judgeBoard(order, board);
  if (whole && whole.misses.length === 0) return { mended: [{ ...whole, edits: [] }], tried: 0 };
  front.push({ ...(whole ?? { spec: board, par: null, exact: false, route: null, uses: [], misses: ['the rules lay no such board'], distance: 1000 }), edits: [] });
  search: for (let changes = 1; changes <= 3 && front.length > 0; changes++) {
    const next: Mended[] = [];
    for (const parent of front) {
      const { leaving, onFloor } = parent.spec.layout!;
      for (const edit of editsOf(parent.spec)) {
        if (now() - began >= budgetMs) break search;
        const named = /(\d+),(\d+)/.exec(edit.what);
        if (named && held.has(`${named[1]},${named[2]}`)) continue;
        // A change keeps what the board says of dice that are leaving and of a start on the floor, where it is not a change of the start.
        const moved = edit.what.startsWith('start at');
        const spec: LevelSpec = { ...edit.spec, layout: { ...edit.spec.layout!, ...(leaving ? { leaving } : {}), ...(onFloor && !moved ? { onFloor } : {}) } };
        if (seen.some((other) => sameBoard(other, spec) && JSON.stringify(other.layout) === JSON.stringify(spec.layout))) continue;
        seen.push(spec);
        tried++;
        const judged = judgeBoard(order, spec);
        if (!judged) continue;
        const mended: Mended = { ...judged, edits: [...parent.edits, edit.what] };
        next.push(mended);
        found.push(mended);
        if (found.filter((kept) => kept.misses.length === 0).length >= keep) break search;
      }
    }
    if (found.some((kept) => kept.misses.length === 0)) break;
    // The boards nearest the order are the ones changed further.
    front = next.sort((a, b) => a.distance - b.distance).slice(0, 4);
  }
  return { mended: sorted().slice(0, keep), tried };
}
