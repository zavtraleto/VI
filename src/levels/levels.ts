import type { LevelSpec } from '../rules/types';

/**
 * The nine levels of the probe: one loop and three kinds of level, by turns, from the plainest
 * to the hardest of each kind.
 *
 * - A board to clear (`c`): crowded, nothing comes, no limit of moves. What makes it hard is
 *   that the dice are all there are: the last of them have to make a group too.
 * - A combination (`k`): faces that are asked for, on a board dice come back to, in few moves.
 * - A chain (`h`): so many links, with dice that come for the chain, fewer of them level by level.
 *
 * The boards, the faces, the numbers of dice and the goals are the design's. The seed and the
 * limit are not thought up: they come from `node scripts/levels.mjs seeds=24`. The seed is, of
 * the boards a strong player of the rules passes, the one in the middle for the average one.
 * The limit is the median of the average player on that seed and a third more.
 */
export const PROBE_LEVELS: readonly LevelSpec[] = [
  { id: 'c1', seed: 1, size: 5, values: [2, 3], norm: 6, arrival: 'none', goal: { kind: 'clear' }, moves: 0 },
  { id: 'k1', seed: 15, size: 5, values: [2, 3], norm: 8, arrival: 'refill', goal: { kind: 'order', items: [{ value: 2, count: 4 }] }, moves: 6 },
  { id: 'h1', seed: 14, size: 5, values: [2, 3], norm: 8, arrival: 'refill', feedRate: 1, goal: { kind: 'chain', links: 3 }, moves: 6 },
  { id: 'c2', seed: 23, size: 5, values: [2, 3], norm: 12, arrival: 'none', goal: { kind: 'clear' }, moves: 0 },
  { id: 'k2', seed: 14, size: 7, values: [2, 3, 4], norm: 14, arrival: 'refill', goal: { kind: 'order', items: [{ value: 3, count: 6 }] }, moves: 11 },
  { id: 'h2', seed: 19, size: 7, values: [2, 3, 4], norm: 14, arrival: 'refill', feedRate: 0.6, goal: { kind: 'chain', links: 5 }, moves: 10 },
  { id: 'c3', seed: 7, size: 5, values: [2, 3, 4], norm: 16, arrival: 'none', goal: { kind: 'clear' }, moves: 0 },
  { id: 'k3', seed: 15, size: 7, values: [2, 3, 4], norm: 18, arrival: 'refill', goal: { kind: 'order', items: [{ value: 3, count: 3 }, { value: 4, count: 4 }] }, moves: 34 },
  { id: 'h3', seed: 2, size: 7, values: [1, 2, 3, 4, 5, 6], norm: 14, arrival: 'refill', feedRate: 0.4, goal: { kind: 'chain', links: 8 }, moves: 19 },
];
