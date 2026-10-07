import { solveLevel, type SolverMove } from './levelSolver';
import { scoreOf, type Score } from './levelScore';
import type { Ban } from './reach';
import type { LevelSpec, Technique } from './types';

/**
 * What a level can be shown to need, by solving it with something taken away. The solver looks
 * at every board within its bounds, so a way it does not find is a way that is not there: a
 * level solved with its pushes banned and found to have no way needs its pushes. The same
 * search, asked for a way only a move longer than the fewest, finds the ways round what a
 * level was built for: a player who takes one clears the board and never meets its point.
 */

/** Boards a search for a way without a technique may see: enough for a small board, and a big one is left unsaid. */
const NEEDS_MAX_STATES = 400_000;

/**
 * Techniques a level cannot be cleared without: those of its way for which no way without them
 * is found within three moves of the fewest. One the search could not settle is not named.
 */
export function neededBy(spec: LevelSpec, par: number, uses: readonly Technique[], maxStates = NEEDS_MAX_STATES): Technique[] {
  return uses.filter((technique) => {
    const { solution, exhausted } = solveLevel(spec, { ban: [technique], maxMoves: par + 3, maxStates });
    return solution === null && exhausted;
  });
}

/** The parts of a route a way may lean on: what a level can be asked to do without, one at a time. */
export const ROUTE_PARTS: readonly Ban[] = ['link', 'glass', 'ones', 'floor', 'push', 'up', 'bridge'];

/** The parts of a route a way leans on, read off its score. */
export function partsOf(score: Score): Ban[] {
  const { beats } = score;
  const leans: Record<Ban, boolean> = {
    link: beats.some((beat) => beat.event === 'link'),
    glass: beats.some((beat) => beat.how === 'glass'),
    ones: beats.some((beat) => beat.event === 'ones'),
    floor: beats.some((beat) => beat.down !== null || beat.how === 'push' || beat.up),
    push: beats.some((beat) => beat.how === 'push'),
    up: beats.some((beat) => beat.up),
    bridge: beats.some((beat) => beat.bridged),
  };
  return ROUTE_PARTS.filter((part) => leans[part]);
}

/** A way round a part of a route. */
export interface Bypass {
  part: Ban;
  /** A way that does without the part and is no more than the slack longer than the way asked about; null where there is none. */
  way: SolverMove[] | null;
  /** The search saw every board within its bounds: a null is then a proof that the part is needed. */
  settled: boolean;
}

/** Moves over the fewest a pass may take and still be rated three stars: a way round within them is one a good player takes. */
const SLACK = 1;

/**
 * For every part of the route the way leans on, the way round it: the level solved with that
 * part banned, in no more moves than the way has and the slack. A part with no way round is
 * one the level makes its player use.
 */
export function bypassesOf(spec: LevelSpec, way: readonly SolverMove[], opts: { slack?: number; maxStates?: number } = {}): Bypass[] {
  const { slack = SLACK, maxStates = NEEDS_MAX_STATES } = opts;
  return partsOf(scoreOf(spec, way)).map((part) => {
    const { solution, exhausted } = solveLevel(spec, { ban: [part], maxMoves: way.length + slack, maxStates });
    return { part, way: solution?.moves ?? null, settled: exhausted };
  });
}
