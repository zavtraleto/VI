import { defaultConfig } from './config';
import { floorLost, floorStuck, levelStuck, smallestGroup } from './level';
import type { LevelGraph } from './levelGraph';
import { neededBy } from './levelProof';
import { scoreOf } from './levelScore';
import { SOLVER_MAX_STATES, moveOf, playMove, solveLevel, tryWay, type SolverMove } from './levelSolver';
import { scan } from './reach';
import { nextRandom, randomInt } from './rng';
import { createRun } from './sim';
import type { LevelSpec, RunState, Technique } from './types';

export { neededBy };

/**
 * The players of a board to be cleared. None of them is a person, and each shows one thing of
 * a board. They all play in moves, on the real rules: a level waits for its player, so what
 * tells players apart is not how fast they are but how far ahead they think and what they know.
 * The player of the session without a limit, who walks the board step by step against a clock,
 * has no part here.
 *
 * - The random one makes any move it can get to up on the dice: a board it clears is cleared by
 *   fiddling.
 * - The greedy one takes whatever goes at once, and the share of its runs that end at a dead
 *   end says how hard the board punishes play without a plan.
 * - The personas think so many moves ahead and no further, and the gap between the weakest and
 *   the strongest is the room a board leaves for skill.
 * - The walker wanders over the graph of the boards with a lean towards the cleared one: its
 *   moves and its fresh starts are the nearest thing to how hard a board is to a person.
 *
 * All of them know the rule of the floor, since it is a rule and not a skill: up on the dice a
 * die is turned, down on the floor it is only pushed, and the one way up is a die that is
 * leaving. None of them steps down by a slip.
 */

/** How a run ends: the board cleared, a dead end by the count of the dice, a dead end of the floor, or still rolling when the moves ran out. */
export type Ending = 'passed' | 'count' | 'floor' | 'limit';

export const ENDINGS: readonly Ending[] = ['passed', 'count', 'floor', 'limit'];

/**
 * How the run of a player ended. The floor ends a run where the player is down with no way to
 * clear the board or has no move left at all, whether the rules of the level end it there or
 * not yet.
 */
export function endingOf(state: RunState): Ending {
  if (state.endReason === 'passed') return 'passed';
  if (levelStuck(state)) return 'count';
  if (state.over || floorLost(state) || scan(state).moves.length === 0) return 'floor';
  return 'limit';
}

/** The run a player starts: the level with no limit of moves. */
function startOf(spec: LevelSpec): RunState {
  return createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });
}

/** A run goes on until the board is cleared or lost. */
const goesOn = (state: RunState): boolean => !state.over && !floorLost(state);

/**
 * The move the random player makes: any of those it can get to without the floor, and any at
 * all once there is no other. With `floor` it takes any move from the first. Null with no move.
 */
export function randomMove(state: RunState, rng: { rng: number }, floor = false): SolverMove | null {
  const all = scan(state).moves;
  if (all.length === 0) return null;
  const up = floor ? all : all.filter((move) => !move.floor);
  const moves = up.length > 0 ? up : all;
  return moves[randomInt(rng, moves.length)];
}

/** A run of the random player. */
export function randomPlay(spec: LevelSpec, seed: number, maxMoves: number, opts: { floor?: boolean } = {}): RunState {
  let state = startOf(spec);
  const rng = { rng: (seed ^ 0x2545f491) | 0 };
  for (let made = 0; made < maxMoves && goesOn(state); made++) {
    const move = randomMove(state, rng, opts.floor);
    if (!move) break;
    state = playMove(state, move);
  }
  return state;
}

/** Moves a random run gets: thirty, or four times the fewest the board is cleared in. */
export function randomMoves(par: number): number {
  return Math.max(30, 4 * par);
}

/** Share of random runs that clear the board in the moves they get. `par` is the level's own unless given. */
export function randomRate(spec: LevelSpec, runs = 100, par = spec.par ?? 0): number {
  let cleared = 0;
  for (let seed = 1; seed <= runs; seed++) {
    if (randomPlay(spec, seed, randomMoves(par)).endReason === 'passed') cleared++;
  }
  return cleared / runs;
}

/**
 * Players that plan as people do: from where the board stands they try the moves they can get
 * to, so many moves deep and no more than so many boards in all, and take the move that leads
 * to the best board they saw. What a board is worth to them is plain: the fewer dice standing
 * the better, a cleared board best, a dead end worst. Now and then they make a move without
 * thinking, and the better of them count: they see that the dice left are too few for a group
 * of their own and have to make the group that is going.
 *
 * The idea is that of procedural personas (Holmgard, Green, Liapis, Togelius: a player is a
 * utility and a bounded search), with the bounds as what differs. With no data of real players
 * to learn from, as the playtesting agents of King have, a persona is the next best stand-in
 * for a kind of player.
 */
export interface Persona {
  /** Moves ahead it thinks, and the boards it can hold in its head while it does. */
  depth: number;
  budget: number;
  /** Share of its moves made without thinking. */
  slip: number;
  /** It counts the dice left against the groups that can still be made. */
  counts: boolean;
}

export const PERSONAS = {
  /** Sees the move in front of it. */
  hasty: { depth: 1, budget: 40, slip: 0.12, counts: false },
  /** Thinks a move ahead of the one it makes. */
  casual: { depth: 2, budget: 200, slip: 0.08, counts: false },
  /** Thinks three moves through and counts the dice. */
  careful: { depth: 3, budget: 1200, slip: 0.04, counts: true },
  /** Plans five moves deep and seldom slips. */
  planner: { depth: 5, budget: 6000, slip: 0.02, counts: true },
} as const satisfies Record<string, Persona>;

export type PersonaName = keyof typeof PERSONAS;
export const PERSONA_NAMES = Object.keys(PERSONAS) as PersonaName[];

/**
 * The greedy player: sees the move in front of it and never slips, so it always takes what
 * goes at once. It is a persona apart from the four: a yardstick of traps, not a kind of player.
 */
export const GREEDY: Persona = { depth: 1, budget: 40, slip: 0, counts: false };

/** What a board that is lost is worth, and what a cleared one is. */
const LOST = -1000;
const CLEARED = 1000;
/**
 * What being on the floor costs a board: a little while a way up is there, so that of two boards
 * as good the one played from on top is taken; more with no way up; and more again for every
 * die that shows no working face, which cannot be turned from there.
 */
const FLOOR = 0.5;
const DOWN = 5;
const DOWN_A_DIE = 15;

/** What a board is worth to a persona. */
function worthOf(state: RunState, persona: Persona, depth: number): number {
  if (state.endReason === 'passed') return CLEARED - depth;
  // A level that ends with the player still up on a leaving die, and nothing to do on the floor
  // below, is not seen for what it is from up there: the board is worth what stands on it, and
  // only a player who counts sees that it is too little. This is the trap of a combo with
  // nowhere to step to, and a player without a plan walks into it.
  if (state.over && !(state.player.level === 'top' && floorStuck(state))) return LOST;
  const spec = state.levelRun!.spec;
  const standing = state.cubes.filter((cube) => cube.state !== 'sinking');
  let worth = -10 * standing.length - depth * 0.01;
  // The dice left cannot make a group of their own: they are lost unless they join the one that is going.
  if (persona.counts && standing.length < smallestGroup(spec)) worth -= 40;
  if (state.player.level !== 'ground') return worth;
  // Down on the floor: is there a move at all, and a way back up?
  const { places, moves } = scan(state);
  if (moves.length === 0 && standing.length > 0) return LOST;
  const cells = state.config.size * state.config.size;
  for (let cell = 0; cell < cells; cell++) if (places[cell]) return worth - FLOOR;
  if (floorLost(state)) return LOST;
  const faces = spec.faces;
  const unturned = faces ? standing.filter((cube) => !faces.includes(cube.ori.top)).length : 0;
  return worth - DOWN - DOWN_A_DIE * unturned;
}

/** The move a persona makes: the first of the way to the best board it finds within its bounds. Null with no move. */
export function personaMove(state: RunState, persona: Persona, rng: { rng: number }): SolverMove | null {
  const first = scan(state).moves;
  if (first.length === 0) return null;
  if (nextRandom(rng) < persona.slip) {
    // A move made without thinking is made where the player stands: nobody steps down to the floor by a slip.
    const up = first.filter((move) => !move.floor);
    const moves = up.length > 0 ? up : first;
    return moves[randomInt(rng, moves.length)];
  }
  const best = first.map(() => -Infinity);
  let front = first.map((move, index) => ({ state: playMove(state, move), index }));
  let tried = front.length;
  for (let depth = 1; front.length > 0; depth++) {
    const next: typeof front = [];
    for (const node of front) {
      const worth = worthOf(node.state, persona, depth);
      best[node.index] = Math.max(best[node.index], worth);
      if (node.state.over || worth <= LOST || depth >= persona.depth || tried >= persona.budget) continue;
      for (const move of scan(node.state).moves) {
        if (tried >= persona.budget) break;
        tried++;
        next.push({ state: playMove(node.state, move), index: node.index });
      }
    }
    // A board cleared at this depth is worth more than any that is cleared further on: there is nothing better to look for.
    if (Math.max(...best) >= CLEARED - depth) break;
    front = next;
  }
  const top = Math.max(...best);
  const picks = first.filter((_, index) => best[index] >= top - 1e-9);
  return picks[randomInt(rng, picks.length)];
}

/** Moves after which a run of a persona is called off. */
const PERSONA_MOVES = 60;

/** A run of a player who plans: the board it comes to, and the moves it made. */
export function personaRun(spec: LevelSpec, persona: Persona, seed: number, maxMoves = PERSONA_MOVES): { state: RunState; way: SolverMove[] } {
  let state = startOf(spec);
  const rng = { rng: (seed ^ 0x3c6ef372) | 0 };
  const way: SolverMove[] = [];
  for (let made = 0; made < maxMoves && goesOn(state); made++) {
    const move = personaMove(state, persona, rng);
    if (!move) break;
    way.push({ x: move.x, z: move.z, dir: move.dir, push: move.push });
    state = playMove(state, move);
  }
  return { state, way };
}

/** A run of a persona on a level. */
export function personaPlay(spec: LevelSpec, name: PersonaName, seed: number, maxMoves = PERSONA_MOVES): RunState {
  return personaRun(spec, PERSONAS[name], seed, maxMoves).state;
}

/** Share of the runs of each persona, the hastiest first, that clear the board. */
export function personaRates(spec: LevelSpec, runs = 12): Record<PersonaName, number> {
  const rates = {} as Record<PersonaName, number>;
  for (const name of PERSONA_NAMES) {
    let cleared = 0;
    for (let seed = 1; seed <= runs; seed++) if (personaPlay(spec, name, seed).endReason === 'passed') cleared++;
    rates[name] = cleared / runs;
  }
  return rates;
}

/** What the runs of a player come to. */
export interface PersonaFacts {
  /** Share of the runs by how they end. */
  endings: Record<Ending, number>;
  /**
   * Of the runs that pass: the middle number of moves over the fewest; the share that go the
   * route of the level's own way, sign for sign; and the share whose route is of the same kind.
   * Null where the level keeps no fewest moves, or no way.
   */
  over: number | null;
  match: number | null;
  sameKind: number | null;
}

/** The runs of a persona on a level, or of the greedy player: how they end, how long the passes are, and whether they go the way the level was made for. */
export function personaFacts(spec: LevelSpec, name: PersonaName | 'greedy', runs = 20): PersonaFacts {
  const persona = name === 'greedy' ? GREEDY : PERSONAS[name];
  const own = spec.solution ? scoreOf(spec, spec.solution.map(moveOf)) : null;
  const endings: Record<Ending, number> = { passed: 0, count: 0, floor: 0, limit: 0 };
  const lengths: number[] = [];
  let matched = 0;
  let alike = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const { state, way } = personaRun(spec, persona, seed);
    const ending = endingOf(state);
    endings[ending]++;
    if (ending !== 'passed') continue;
    lengths.push(way.length);
    if (own === null) continue;
    const score = scoreOf(spec, way);
    if (score.route === own.route) matched++;
    if (score.kind === own.kind) alike++;
  }
  const passed = endings.passed;
  for (const ending of ENDINGS) endings[ending] /= runs;
  lengths.sort((a, b) => a - b);
  return {
    endings,
    over: passed > 0 && spec.par !== undefined ? lengths[Math.floor(lengths.length / 2)] - spec.par : null,
    match: passed > 0 && own !== null ? matched / passed : null,
    sameKind: passed > 0 && own !== null ? alike / passed : null,
  };
}

/** Share of the runs of the greedy player, with seeds from 1 on, that end at a dead end. */
export function trapRate(spec: LevelSpec, runs = 40): number {
  let lost = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const ending = endingOf(personaRun(spec, GREEDY, seed).state);
    if (ending === 'count' || ending === 'floor') lost++;
  }
  return lost / runs;
}

/**
 * The shortest way the planning persona clears the board by: the word a level is taken on when
 * the solver cannot count it through. Null when none of the runs clears it.
 */
export function witnessWay(spec: LevelSpec, runs = 20): SolverMove[] | null {
  let best: SolverMove[] | null = null;
  for (let seed = 1; seed <= runs; seed++) {
    const { state, way } = personaRun(spec, PERSONAS.planner, seed);
    if (state.endReason === 'passed' && (!best || way.length < best.length)) best = way;
  }
  return best;
}

/**
 * A player who wanders over the graph of a level with a lean towards the cleared board: at
 * every board it takes one of the boards its moves lead to, and one that is a move nearer to
 * cleared is so many times likelier than any other. It is the model of Jarusek and Pelanek for
 * a person at a puzzle of moving things about, which followed the time people took better than
 * the length of the way did; the lean that fitted their three puzzles best was 25, and is the
 * number to start from here, not a measure of this game.
 */
export interface Walker {
  /** How much likelier a move that brings the board a move nearer to cleared is than any other. 0 walks at random. */
  bonus: number;
  /** Takes no move onto a board the level is not cleared from while another is there. */
  wary: boolean;
  /** Moves made on boards the level is not cleared from before the run is begun again. */
  patience: number;
}

export const WALKERS = {
  /** Walks into what is lost, and finds out. */
  walker: { bonus: 25, wary: false, patience: 6 },
  /** Sees a lost board for what it is a move ahead. */
  wary: { bonus: 25, wary: true, patience: 6 },
} as const satisfies Record<string, Walker>;

export type WalkerName = keyof typeof WALKERS;
export const WALKER_NAMES = Object.keys(WALKERS) as WalkerName[];

export interface WalkFacts {
  /** Moves to a cleared board, those of the runs begun again counted in; times a run was begun again. Means over the runs. */
  moves: number;
  restarts: number;
  /** Share of the runs cleared at the first go, within the moves of `limit`. */
  first: number;
}

/** Moves a walk may take in all before it is called off: a walker with no lean on a wide graph may never get there. */
const WALK_MOVES = 5000;

/**
 * Walks the graph so many times and says what it took. A run is begun again at a dead end, at
 * the rim of the graph, and after the walker has made its moves of patience on boards the level
 * is not cleared from. Null for a graph that is not complete or holds no way.
 */
export function walkFacts(graph: LevelGraph, walker: Walker, opts: { runs?: number; limit?: number; seed?: number } = {}): WalkFacts | null {
  const { next, end, toClear } = graph;
  if (!graph.complete || toClear[0] < 0) return null;
  const { runs = 300, limit = Infinity, seed = 1 } = opts;
  const rng = { rng: (seed ^ 0x51ed270b) | 0 };
  let moves = 0;
  let restarts = 0;
  let first = 0;
  for (let run = 0; run < runs; run++) {
    let at = 0;
    let made = 0;
    let astray = 0;
    let again = 0;
    for (let walked = 0; walked < WALK_MOVES; walked++) {
      if (end[at] === 'passed') {
        if (again === 0 && made <= limit) first++;
        break;
      }
      if (next[at].length === 0 || astray >= walker.patience) {
        restarts++;
        again++;
        at = 0;
        made = 0;
        astray = 0;
        continue;
      }
      const live = walker.wary ? next[at].filter((to) => toClear[to] >= 0) : [];
      const options = live.length > 0 ? live : next[at];
      const weights = options.map((to) => (toClear[at] > 0 && toClear[to] === toClear[at] - 1 ? 1 + walker.bonus : 1));
      let roll = nextRandom(rng) * weights.reduce((sum, weight) => sum + weight, 0);
      let pick = options.length - 1;
      for (let index = 0; index < options.length; index++) {
        roll -= weights[index];
        if (roll < 0) {
          pick = index;
          break;
        }
      }
      at = options[pick];
      moves++;
      made++;
      astray = toClear[at] < 0 ? astray + 1 : 0;
    }
  }
  return { moves: moves / runs, restarts: restarts / runs, first: first / runs };
}

/** What a board comes to: what the solver says of it and how the players play it. */
export interface Measures {
  /** Fewest moves known, whether proved the fewest, and the way; null when no way is known. */
  par: number | null;
  exact: boolean;
  way: SolverMove[] | null;
  depth: number;
  uses: Technique[];
  /** Techniques no way within three moves of the fewest does without. */
  needs: Technique[];
  traps: number;
  random: number;
  /** Share of clears of each persona, the hastiest first. */
  personas: Record<PersonaName, number>;
}

/**
 * Measures a board. A level that keeps its way is taken at its word, and the way is played
 * again; any other is solved, and where the solver gives up, the planning persona is asked.
 */
export function measure(spec: LevelSpec, opts: { maxStates?: number; skillRuns?: number } = {}): Measures {
  const { maxStates = SOLVER_MAX_STATES, skillRuns = 12 } = opts;
  let way: SolverMove[] | null = null;
  let exact = false;
  if (spec.solution) {
    way = spec.solution.map(moveOf);
    exact = spec.exact ?? false;
  } else {
    const solved = solveLevel(spec, { maxStates });
    way = solved.solution?.moves ?? (solved.exhausted ? null : witnessWay(spec));
    exact = solved.solution !== null;
  }
  const report = way ? tryWay(spec, way) : null;
  const par = way && report?.state.endReason === 'passed' ? way.length : null;
  return {
    par,
    exact,
    way: par === null ? null : way,
    depth: report?.depth ?? 0,
    uses: report?.uses ?? [],
    needs: par === null || !report ? [] : neededBy(spec, par, report.uses),
    traps: trapRate(spec),
    random: randomRate(spec, 100, par ?? 0),
    personas: personaRates(spec, skillRuns),
  };
}
