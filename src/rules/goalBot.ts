import { SKILLS, SKILL_NAMES, botCommand, createBot, type Bot, type SkillName } from './bot';
import { defaultConfig } from './config';
import { goalLines, worldRuns } from './level';
import type { SolverMove } from './levelSolver';
import { canAcceptCommand, resolveMove } from './movement';
import { createRun, step } from './sim';
import type { LevelGoal, LevelSpec, RunState } from './types';


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
 * are put off for now. The boards to clear of the ladder are measured by players of another
 * kind, who think in moves and know nothing of this one: `levelBot.ts`.
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
export function playWith(spec: LevelSpec, bot: Bot, maxMoves: number): { state: RunState; way: SolverMove[] } {
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
