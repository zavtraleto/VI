import type { LevelSpec, Technique } from '../rules/types';
import { offersFor, type OrderOffer } from './orderSearch';
import { BASE_ORDER, PRESETS, applyPreset, type Order } from './orders';

/**
 * A set: three to five boards ordered in a row and played as a piece of the game. Half of what
 * a board feels like is where it stands: a gift is a gift after a wall, and a trick is mastered
 * only once it has been met. So a set is laid board by board, and every board is ordered with
 * what was played before it in mind (`orderInSet`):
 *
 * - `mastery` asks for a technique a board before it leaned on, in no more moves than that
 *   board took: the trick is met again, and is quicker.
 * - `gift` is two moves shorter than the longest board before it, where its own bounds leave room.
 * - `wall` is longer than every board before it.
 * - no board is one of the set already, turned or mirrored.
 *
 * A set keeps no file of its own: its boards are files named `<set>-1`, `<set>-2` and on, each
 * with the note of its order, and are played in the order of their numbers.
 */

/** What a set remembers of a board played: the moves it took and what its way leaned on. */
export interface Played {
  par: number;
  uses: readonly Technique[];
}

/** The techniques that are tricks to meet again: the 1s are a rule of the level, not a trick. */
const TRICKS: readonly Technique[] = ['link', 'glass', 'floor'];

/** The order of a preset as it stands in a set, after the boards played before it. */
export function orderInSet(key: string, before: readonly Played[], base: Order = BASE_ORDER): Order {
  const order = applyPreset(base, key);
  if (before.length === 0) return order;
  const longest = Math.max(...before.map((board) => board.par));
  if (key === 'mastery') {
    // The trick met last is the one asked for again.
    const met = [...before].reverse().find((board) => board.uses.some((technique) => TRICKS.includes(technique)));
    if (!met) return order;
    const trick = [...met.uses].reverse().find((technique) => TRICKS.includes(technique))!;
    return { ...order, needs: [trick], avoid: (order.avoid ?? []).filter((technique) => technique !== trick), par: [Math.min(order.par[0], met.par), met.par] };
  }
  if (key === 'gift') {
    // Shorter than what came before by two moves at the least, where the preset leaves room for that.
    const most = Math.max(2, Math.min(order.par[1], longest - 2));
    return { ...order, par: [Math.min(order.par[0], most), most] };
  }
  if (key === 'wall') return { ...order, par: [Math.max(order.par[0], longest + 1), Math.max(order.par[1], longest + 3)] };
  return order;
}

/** A board of a set: the offer, the preset it was laid for and the order it was laid by. */
export interface SetBoard {
  key: string;
  order: Order;
  offer: OrderOffer;
}

/**
 * Lays a set: a board to every preset named, in their order, each ordered after those before
 * it. A preset no board is found for in its time is left out of the set and said in `missing`.
 */
export function setFor(keys: readonly string[], opts: { budgetMs?: number; base?: Order; now?: () => number; seeds?: number } = {}): { boards: SetBoard[]; missing: string[] } {
  const { budgetMs = 4000, base = BASE_ORDER, now, seeds } = opts;
  for (const key of keys) if (!PRESETS[key]) throw new Error(`no preset "${key}": the presets are ${Object.keys(PRESETS).join(', ')}`);
  const boards: SetBoard[] = [];
  const missing: string[] = [];
  const played: Played[] = [];
  const taken: LevelSpec[] = [];
  keys.forEach((key, index) => {
    const order = orderInSet(key, played, base);
    // Every place of a set begins at seeds of its own: two places of one preset do not see the same boards first.
    const { offers } = offersFor(order, { from: 1 + index * 700, budgetMs, keep: 1, skip: taken, ...(now ? { now } : {}), ...(seeds ? { seeds } : {}) });
    const offer = offers[0];
    if (!offer || offer.par === null) {
      missing.push(key);
      return;
    }
    boards.push({ key, order, offer });
    played.push({ par: offer.par, uses: offer.uses });
    taken.push(offer.spec);
  });
  return { boards, missing };
}
