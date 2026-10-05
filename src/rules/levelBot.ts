import { SKILLS, SKILL_NAMES, botCommand, createBot, type Bot, type Skill, type SkillName } from './bot';
import { defaultConfig } from './config';
import { goalLines, smallestGroup, worldRuns } from './level';
import { SOLVER_MAX_STATES, moveOf, movesAt, playMove, solveLevel, tryWay, type SolverMove } from './levelSolver';
import { canAcceptCommand, resolveMove } from './movement';
import { nextRandom, randomInt } from './rng';
import { createRun, step } from './sim';
import type { LevelGoal, LevelSpec, RunState, Technique } from './types';

/**
 * What a level asks of a player, without a person playing it: the player of `bot.ts` plays the
 * level with no limit of moves, and what is counted is the moves it takes to meet the goal.
 * The seed and the limit of a level are then set from those counts, and a run that meets the
 * goal is the proof that the level can be passed.
 *
 * The player knows the goal as far as choosing among the clears it sees: for an order it takes
 * the faces still asked for, for a chain it goes on with the group that is open. It does not
 * plan towards the goal over several clears, so its count is on the generous side.
 *
 * These counts set the seeds and limits of the levels with goals other than a clear board, which
 * are put off for now; the boards to clear of the ladder are measured further down, by the
 * solver and three yardstick players. Run those with `node scripts/ladder.mjs`.
 */
export interface LevelPlay {
  skill: SkillName;
  botSeed: number;
  /** The goal was met before the trial gave up. */
  reached: boolean;
  /** Rolls and pushes made: to the goal, or until the trial gave up. */
  moves: number;
  /** Steps of every kind. */
  steps: number;
  /** Dice left standing when the trial ended. */
  left: number;
}

/** Moves after which a trial gives up, and the calls of the game it never goes over. */
const MAX_MOVES = 150;
const MAX_CALLS = 200_000;
/** What a clear beside the point of the level is worth to the player, against one that is to the point. */
const BESIDE_THE_POINT = 0.1;
/** An order is not served by other faces: a clear of one is passed by, and the dice are turned instead. */
const OFF_THE_ORDER = 0.1;

/** A player of the rules who knows what the level asks for. */
export function goalBot(spec: LevelSpec, skill: SkillName, botSeed: number): Bot {
  const bot = createBot(SKILLS[skill], botSeed);
  const { goal } = spec;
  if (goal.kind === 'order') {
    const asked = (face: number | undefined, state: RunState) => goalLines(state).some((line) => line.value === face && line.have < line.need);
    bot.prefer = (plan, state) => (asked(plan.value, state) ? 1 : OFF_THE_ORDER);
    bot.wants = asked;
  } else if (goal.kind === 'chain') {
    // While a group is open, a link is what counts; with none, any group opens one.
    bot.prefer = (plan, state) => (state.reactions.length === 0 || plan.chain >= 2 ? 1 : BESIDE_THE_POINT);
  }
  return bot;
}

/**
 * Plays a level with a player of the rules, with no limit of moves, and keeps the rolls and
 * pushes it made: the way it went, as a solver would write it.
 */
function playWith(spec: LevelSpec, bot: Bot, maxMoves: number): { state: RunState; way: SolverMove[] } {
  const state = createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });
  const run = state.levelRun!;
  const way: SolverMove[] = [];
  for (let calls = 0; calls < MAX_CALLS && !state.over; calls++) {
    const cmd = botCommand(bot, state);
    if (cmd !== null && canAcceptCommand(state)) {
      const intent = resolveMove(state, cmd);
      if ((intent.kind === 'roll' || intent.kind === 'push') && intent.cube) way.push({ x: intent.cube.x, z: intent.cube.z, dir: cmd, push: intent.kind === 'push' });
    }
    step(state, cmd);
    // The last move is let land: it may be the one that meets the goal.
    if (run.moves >= maxMoves && !worldRuns(state)) break;
  }
  return { state, way };
}

export function playLevel(spec: LevelSpec, skill: SkillName, botSeed: number, maxMoves = MAX_MOVES): LevelPlay {
  const { state } = playWith(spec, goalBot(spec, skill, botSeed), maxMoves);
  const left = state.cubes.filter((cube) => cube.state !== 'sinking').length;
  return { skill, botSeed, reached: state.endReason === 'passed', moves: state.levelRun!.moves, steps: state.stats.steps, left };
}

/**
 * The yardsticks of a board to be cleared: three players that are not people, each showing one
 * thing. The greedy one always takes the nearest clear, and the share of its runs that end at a
 * dead end says how hard the board punishes play without a plan. The random one makes any move
 * it can get to: a lesson it should pass, a peak it should not. The five players by skill show
 * the gap between a weak hand and a strong one.
 */

/**
 * The greedy player: the eye of a pro and no failings, no pauses, and no weighing of what a
 * clear gives. It takes the nearest clear it sees.
 */
export const GREEDY: Skill = {
  ...SKILLS.pro,
  think: [0, 0], thinkPerMove: 0, thinkPerCube: 0, pause: [0, 0], idle: [0, 0],
  miss: 0, missPerRoll: 0, lapse: 0, lapseTicks: [0, 0], slip: 0, greed: 0,
};

/** Moves after which a greedy run is called neither lost nor won. */
const GREEDY_MOVES = 60;

/** Share of greedy runs, with the player's own seeds from 1 on, that end at a dead end. */
export function trapRate(spec: LevelSpec, runs = 40): number {
  let lost = 0;
  for (let botSeed = 1; botSeed <= runs; botSeed++) {
    if (playWith(spec, createBot(GREEDY, botSeed), GREEDY_MOVES).state.endReason === 'failed') lost++;
  }
  return lost / runs;
}

/** A run of the random player: every move is any of those it can get to. */
export function randomPlay(spec: LevelSpec, seed: number, maxMoves: number): RunState {
  let state = createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });
  const rng = { rng: (seed ^ 0x2545f491) | 0 };
  for (let made = 0; made < maxMoves && !state.over; made++) {
    const moves = movesAt(state);
    if (moves.length === 0) break;
    state = playMove(state, moves[randomInt(rng, moves.length)]);
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

/** Share of the runs of each player by skill, the weakest first, that clear the board. */
export function skillRates(spec: LevelSpec, runs = 20): Record<SkillName, number> {
  const rates = {} as Record<SkillName, number>;
  for (const skill of SKILL_NAMES) {
    let cleared = 0;
    for (let botSeed = 1; botSeed <= runs; botSeed++) {
      if (playLevel(spec, skill, botSeed).reached) cleared++;
    }
    rates[skill] = cleared / runs;
  }
  return rates;
}

/**
 * Players that plan as people do. The players by skill above walk the board step by step and
 * were made for a game that runs on a clock; a level waits, and what tells its players apart is
 * how far ahead they think. So these think in moves: from where the board stands they try the
 * moves they can get to, so many moves deep and no more than so many boards in all, and take
 * the move that leads to the best board they saw. What a board is worth to them is plain: the
 * fewer dice standing the better, a cleared board best, a dead end worst. Now and then they
 * make a move without thinking, and the better of them count: they see that the dice left are
 * too few for a group of their own and have to make the group that is going.
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

/** What a board is worth to a persona. */
function worthOf(state: RunState, persona: Persona, depth: number): number {
  if (state.endReason === 'passed') return 1000 - depth;
  if (state.over) return -1000;
  const standing = state.cubes.filter((cube) => cube.state !== 'sinking').length;
  let worth = -10 * standing - depth * 0.01;
  // The dice left cannot make a group of their own: they are lost unless they join the one that is going.
  if (persona.counts && standing < smallestGroup(state.levelRun!.spec)) worth -= 40;
  return worth;
}

/** The move a persona makes: the first of the way to the best board it finds within its bounds. */
function personaMove(state: RunState, persona: Persona, rng: { rng: number }): SolverMove | null {
  const first = movesAt(state);
  if (first.length === 0) return null;
  if (nextRandom(rng) < persona.slip) return first[randomInt(rng, first.length)];
  const best = first.map(() => -Infinity);
  let front = first.map((move, index) => ({ state: playMove(state, move), index }));
  let tried = front.length;
  for (let depth = 1; front.length > 0; depth++) {
    const next: typeof front = [];
    for (const node of front) {
      best[node.index] = Math.max(best[node.index], worthOf(node.state, persona, depth));
      if (node.state.over || depth >= persona.depth || tried >= persona.budget) continue;
      for (const move of movesAt(node.state)) {
        if (tried >= persona.budget) break;
        tried++;
        next.push({ state: playMove(node.state, move), index: node.index });
      }
    }
    front = next;
  }
  const top = Math.max(...best);
  const picks = first.filter((_, index) => best[index] >= top - 1e-9);
  return picks[randomInt(rng, picks.length)];
}

/** Moves after which a run of a persona is called off. */
const PERSONA_MOVES = 60;

/** A run of a persona on a level. */
export function personaPlay(spec: LevelSpec, name: PersonaName, seed: number, maxMoves = PERSONA_MOVES): RunState {
  let state = createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });
  const rng = { rng: (seed ^ 0x3c6ef372) | 0 };
  for (let made = 0; made < maxMoves && !state.over; made++) {
    const move = personaMove(state, PERSONAS[name], rng);
    if (!move) break;
    state = playMove(state, move);
  }
  return state;
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

/**
 * The shortest way a strong player clears the board by: the word a level is taken on when the
 * solver cannot count it through. Null when none of the runs clears it.
 */
export function witnessWay(spec: LevelSpec, runs = 20): SolverMove[] | null {
  let best: SolverMove[] | null = null;
  for (const skill of WITNESSES) {
    for (let botSeed = 1; botSeed <= runs; botSeed++) {
      const { state, way } = playWith(spec, goalBot(spec, skill, botSeed), MAX_MOVES);
      if (state.endReason === 'passed' && (!best || way.length < best.length)) best = way;
    }
  }
  return best;
}

/** What a board comes to: what the solver says of it and how the yardsticks play it. */
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

/**
 * Measures a board. A level that keeps its way is taken at its word, and the way is played
 * again; any other is solved, and where the solver gives up, a strong player is asked.
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

/** Moves to the goal in every run, the fewest first; a run that did not get there counts as endless. */
function movesOf(plays: readonly LevelPlay[]): number[] {
  return plays.map((play) => (play.reached ? play.moves : Infinity)).sort((a, b) => a - b);
}

/** The value that `percent` of a sorted list do not go over. */
export function percentile(sorted: readonly number[], percent: number): number {
  return sorted[Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1)];
}

function count(moves: number): string {
  return Number.isFinite(moves) ? String(moves) : '-';
}

function share(part: number, whole: number): string {
  return `${Math.round((100 * part) / Math.max(1, whole))}%`;
}

/** The goal of a level, as text. */
function goalText(goal: LevelGoal): string {
  if (goal.kind === 'send') return `send ${goal.count}`;
  if (goal.kind === 'chain') return `chain of ${goal.links}`;
  if (goal.kind === 'clear') return 'clear the board';
  return `order ${goal.items.map((item) => `${item.count} of ${item.value}`).join(', ')}`;
}

function layOut(rows: readonly string[][]): string {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd()).join('\n');
}

/** The player whose runs pick the seed of a level and set its limit. */
const MEASURE: SkillName = 'average';
/** The players and the runs of each that are asked whether a board can be passed at all. */
const WITNESSES: readonly SkillName[] = ['pro', 'esports'];
const WITNESS_RUNS = 10;
/** The limit of a level is the median of the measuring player and a third more. */
const LIMIT_MARGIN = 4 / 3;

/** What a seed of a level comes to: whether a board is laid, whether it can be passed, and how it goes for the measuring player. */
export interface SeedTrial {
  seed: number;
  laid: boolean;
  /** Some run of a strong player met the goal: the proof that the board can be passed. */
  passable: boolean;
  /** Median moves of the measuring player, and the share of its runs that met the goal. */
  median: number;
  reach: number;
}

export function trySeed(spec: LevelSpec, seed: number, runs: number, maxMoves = MAX_MOVES): SeedTrial {
  const board = { ...spec, seed };
  try {
    const passable = WITNESSES.some((skill) => Array.from({ length: WITNESS_RUNS }, (_, i) => i + 1).some((botSeed) => playLevel(board, skill, botSeed, maxMoves).reached));
    const plays = Array.from({ length: runs }, (_, i) => playLevel(board, MEASURE, i + 1, maxMoves));
    return { seed, laid: true, passable, median: percentile(movesOf(plays), 50), reach: plays.filter((play) => play.reached).length / runs };
  } catch {
    // No board can be laid for this seed.
    return { seed, laid: false, passable: false, median: Infinity, reach: 0 };
  }
}

/**
 * The seed of a level: among the boards that can be passed, the one in the middle for the
 * measuring player, the lower of the two middle ones where they are even in number. A level
 * with a goal to clear the board is told apart by how often it is cleared, any other by the
 * moves its goal takes. Null when no board of the seeds tried can be passed.
 */
export function pickSeed(spec: LevelSpec, trials: readonly SeedTrial[]): SeedTrial | null {
  const open = trials.filter((trial) => trial.passable);
  if (open.length === 0) return null;
  const byMoves = (a: SeedTrial, b: SeedTrial) => a.median - b.median || a.seed - b.seed;
  const byReach = (a: SeedTrial, b: SeedTrial) => b.reach - a.reach || a.seed - b.seed;
  const order = [...open].sort(spec.goal.kind === 'clear' ? byReach : byMoves);
  return order[Math.max(0, Math.ceil(order.length / 2) - 1)];
}

/** The limit of moves a median asks for: a third more, a whole number. */
export function limitFor(median: number): number {
  return Math.ceil(median * LIMIT_MARGIN);
}

function seedTable(levels: readonly LevelSpec[], seeds: number, runs: number, maxMoves: number): string {
  const head = ['level', 'goal', ...Array.from({ length: seeds }, (_, i) => `s${i + 1}`), 'pick', 'limit'];
  const rows: string[][] = [head];
  for (const spec of levels) {
    const trials = Array.from({ length: seeds }, (_, i) => trySeed(spec, i + 1, runs, maxMoves));
    const pick = pickSeed(spec, trials);
    const clear = spec.goal.kind === 'clear';
    // A board that no strong player passed is marked: it is not one to pick.
    const cell = (trial: SeedTrial) => (!trial.laid ? 'none' : `${clear ? share(trial.reach, 1) : count(trial.median)}${trial.passable ? '' : '!'}`);
    const picked = pick ? `seed ${pick.seed} (${clear ? share(pick.reach, 1) : count(pick.median)})` : 'no board passes';
    const limit = clear ? 'none' : pick && Number.isFinite(pick.median) ? `${limitFor(pick.median)} (reach ${share(pick.reach, 1)})` : '-';
    rows.push([spec.id, goalText(spec.goal), ...trials.map(cell), picked, limit]);
  }
  return layOut(rows);
}

/**
 * The table of the levels, as text: for every level and player, the share of runs that met the
 * goal, the moves it took at the 5th, 50th, 75th and 90th percentile, the share that would have
 * passed in the level's own limit, and the dice left standing. With `seeds` it is the table the
 * seed and the limit of a level are taken from instead: for every seed the median of the
 * measuring player, or for a board to clear the share of its runs that cleared it; a `!` marks a
 * board no strong player passed.
 */
export function levelTable(
  opts: { levels?: readonly LevelSpec[]; skills?: readonly SkillName[]; runs?: number; maxMoves?: number; seeds?: number } = {},
): string {
  const { levels = [], skills = SKILL_NAMES, runs = 40, maxMoves = MAX_MOVES, seeds } = opts;
  if (seeds !== undefined) return seedTable(levels, seeds, runs, maxMoves);
  const rows: string[][] = [['level', 'board', 'faces', 'dice', 'come', 'goal', 'seed', 'limit', 'player', 'reached', 'p5', 'p50', 'p75', 'p90', 'in limit', 'left p50']];
  for (const spec of levels) {
    for (const skill of skills) {
      const plays = Array.from({ length: runs }, (_, i) => playLevel(spec, skill, i + 1, maxMoves));
      const moves = movesOf(plays);
      const reached = plays.filter((play) => play.reached).length;
      const inLimit = plays.filter((play) => play.reached && play.moves <= spec.moves).length;
      const left = plays.map((play) => play.left).sort((a, b) => a - b);
      rows.push([
        spec.id,
        `${spec.size}x${spec.size}`,
        spec.values.join(''),
        String(spec.norm),
        spec.arrival === 'none' ? 'no' : spec.feedRate !== undefined ? `feed ${spec.feedRate}` : 'yes',
        goalText(spec.goal),
        String(spec.seed),
        spec.moves > 0 ? String(spec.moves) : 'none',
        skill,
        share(reached, runs),
        ...[5, 50, 75, 90].map((percent) => count(percentile(moves, percent))),
        spec.moves > 0 ? share(inLimit, runs) : '-',
        String(percentile(left, 50)),
      ]);
    }
  }
  return layOut(rows);
}
