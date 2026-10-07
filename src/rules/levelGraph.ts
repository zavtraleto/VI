import { defaultConfig } from './config';
import { explore, type BoardEnd } from './levelSolver';
import type { Ban } from './reach';
import { createRun } from './sim';
import type { LevelSpec, RulesConfig } from './types';

/**
 * A level as the graph of its boards: the boards it can come to within so many moves of its
 * start, the moves between them, and from each the fewest moves to a cleared board over the
 * boards that were seen. The solver says how fast a level is cleared; the graph says
 * what there is around the way: how many ways are as short, how much of what a player can do is
 * a mistake already, how soon a dead end can be come to. A player who wanders over it is the
 * measure of how hard the level is to a person (`walkFacts` in `levelBot.ts`).
 *
 * The moves are bounded because the boards of a level are not: a die rolled about with nothing
 * going is a new board at every roll. With the bound a move over the fewest, the graph is the
 * level as a player after three stars meets it.
 */
export interface LevelGraph {
  /** Boards seen; false where the search gave up before it had seen all within its moves. */
  states: number;
  complete: boolean;
  /** The moves from the start the graph goes out to. */
  depth: number;
  /** For every entry, the entries its moves lead to. The start is entry 0; the cleared board, where there is one, is the last. */
  next: readonly (readonly number[])[];
  /** How an entry ends, where it does. */
  end: readonly (BoardEnd | null)[];
  /** Fewest moves from the start to an entry. */
  far: readonly number[];
  /** The fewest moves from an entry to the cleared board over the boards of the graph, -1 where there is no way. */
  toClear: Int32Array;
}

export function graphOf(spec: LevelSpec, opts: { depth?: number; maxStates?: number; config?: RulesConfig; ban?: readonly Ban[] } = {}): LevelGraph {
  const start = createRun({ seed: spec.seed, config: opts.config ?? defaultConfig(), level: { ...spec, moves: 0 } });
  const depth = opts.depth ?? Infinity;
  const { complete, boards, next, end, far } = explore(start, { maxMoves: depth, maxStates: opts.maxStates, ban: opts.ban });
  const back: number[][] = next.map(() => []);
  next.forEach((leads, from) => leads.forEach((to) => back[to].push(from)));
  const toClear = new Int32Array(next.length).fill(-1);
  const queue: number[] = [];
  end.forEach((how, at) => {
    if (how !== 'passed') return;
    toClear[at] = 0;
    queue.push(at);
  });
  for (let head = 0; head < queue.length; head++) {
    for (const from of back[queue[head]]) {
      if (toClear[from] >= 0) continue;
      toClear[from] = toClear[queue[head]] + 1;
      queue.push(from);
    }
  }
  return { states: boards, complete, depth, next, end, far, toClear };
}

export interface GraphFacts {
  states: number;
  /** Of the boards short of the rim, the share the level is still cleared from over the boards of the graph. */
  alive: number;
  /** Shortest ways, counted as paths over boards, and no more than a thousand. */
  ways: number;
  /** Boards the first move can lead to, and those of them the level is still cleared from. */
  firsts: number;
  firstsAlive: number;
  /** Fewest moves from the start to a dead end: how soon a board can be lost for good. -1 where the graph has none. */
  lostIn: number;
}

/** Ways are not counted past this: a level with so many has no one way to speak of. */
const WAYS_AT_MOST = 1000;

/** What a graph says of its level. Null for a graph that is not complete: half a graph says nothing sure. */
export function factsOf(graph: LevelGraph): GraphFacts | null {
  if (!graph.complete) return null;
  const { states, depth, next, end, far, toClear } = graph;
  let inside = 0;
  let alive = 0;
  let lostIn = -1;
  for (let at = 0; at < states; at++) {
    if (end[at] === 'count' || end[at] === 'floor') lostIn = lostIn < 0 ? far[at] : Math.min(lostIn, far[at]);
    if (far[at] >= depth) continue;
    inside++;
    if (toClear[at] >= 0) alive++;
  }

  const counted = new Map<number, number>();
  const waysFrom = (at: number): number => {
    if (toClear[at] === 0) return 1;
    const known = counted.get(at);
    if (known !== undefined) return known;
    let ways = 0;
    for (const to of next[at]) if (toClear[to] === toClear[at] - 1) ways = Math.min(WAYS_AT_MOST, ways + waysFrom(to));
    counted.set(at, ways);
    return ways;
  };

  return {
    states,
    alive: inside > 0 ? alive / inside : 0,
    ways: toClear[0] >= 0 ? waysFrom(0) : 0,
    firsts: next[0].length,
    firstsAlive: next[0].filter((to) => toClear[to] >= 0).length,
    lostIn,
  };
}
