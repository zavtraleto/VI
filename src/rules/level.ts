import { refillLevel } from './spawn';
import type { GoalLine, LevelRun, LevelSpec, RulesConfig, RunState } from './types';

/**
 * A level: a run the world of which moves only with a move. A move is a roll or a push; while
 * the player thinks, or steps from die to die, the dice stand as they are. A group goes in a
 * number of moves and not of seconds; whether dice come, and for whom, is the level's own; and
 * the level ends the moment its goal is met or its moves are spent.
 *
 * A die on its way out is glass at once: it can be rolled over from the first move. So a step
 * from a group onto a die that stands is a commitment: the way back is a roll, not a step.
 */

/** Moves a group takes to go: a die that lands on any of them joins it. */
export const LEVEL_SINK_MOVES = 6;
/** Moves a new link gives back to the dice of the chain it joined. */
export const LEVEL_LIFT_MOVES = 2;
/**
 * How high a die stands from the moment it comes: as glass, with its faces to be read, for as
 * long as the player thinks. It takes the next beat to come up whole.
 */
export const LEVEL_GHOST_HEIGHT = 0.5;
/** Dice that come in one beat while the board is short of its number. */
export const LEVEL_REFILL = 1;
/** Share of the dice that come placed and turned to be of use. */
export const LEVEL_HELP_RATE = 0.65;

/**
 * The config of a level: a board of its size with the player in the middle. Everything is
 * counted in beats, a beat being the ticks a move takes. A die that comes at the end of one
 * beat stands half up at once and is whole by the end of the next. A group sinks for its moves
 * and a tick: its dice take their first tick of sinking on the tick they land, and with that
 * tick a die landing on the last move of the window still finds the group, and one landing on
 * the next does not. A die that sinks is rolled over and stepped off at any height. What
 * belongs to the pace of Endless is switched off.
 */
export function levelConfig(config: RulesConfig, spec: LevelSpec): RulesConfig {
  const sinkingTicks = (spec.sinkMoves ?? LEVEL_SINK_MOVES) * config.actionTicks + 1;
  const lift = ((spec.liftMoves ?? LEVEL_LIFT_MOVES) * config.actionTicks) / sinkingTicks;
  const middle = Math.floor(spec.size / 2);
  return {
    ...config,
    size: spec.size,
    startX: middle,
    startZ: middle,
    startCubes: spec.norm,
    targetCubes: spec.norm,
    warnTicks: 0,
    risingTicks: Math.round(config.actionTicks / (1 - LEVEL_GHOST_HEIGHT)),
    sinkLowHeight: 1,
    stepDownHeight: 1,
    feedRate: spec.feedRate ?? config.feedRate,
    sinkingTicks,
    sinkStartTicks: sinkingTicks,
    sinkFloorTicks: sinkingTicks,
    chainLift: lift,
    chainLiftMin: lift,
    helpRate: spec.helpRate ?? LEVEL_HELP_RATE,
    warnOccupied: spec.size * spec.size,
    wipeBonus: 0,
    custom: false,
    // An object of its own: the one it was given belongs to whoever made the run.
    experiments: {
      ...config.experiments,
      floorClimb: true,
      dockSteps: true,
      soloOne: false,
      gentleStart: false,
      floorLift: false,
      chainCalm: false,
      timeFloor: false,
      waves: false,
      surge: false,
      opening: false,
      lastSliver: false,
      gift: false,
    },
  };
}

/** Dice that stand on the board or are coming up: everything that is not on its way out. */
function standing(state: RunState): number {
  return state.cubes.filter((cube) => cube.state !== 'sinking').length;
}

/** The lines of a goal with what a run has of each: no more is shown than was asked for. */
function linesOf(spec: LevelSpec, sent: readonly number[], bestChain: number, cleared: number): GoalLine[] {
  const { goal } = spec;
  const line = (what: GoalLine['what'], value: number, have: number, need: number): GoalLine => ({ what, value, have: Math.min(have, need), need });
  if (goal.kind === 'send') return [line('dice', 0, sent.reduce((sum, count) => sum + count, 0), goal.count)];
  if (goal.kind === 'chain') return [line('links', 0, bestChain, goal.links)];
  if (goal.kind === 'clear') return [line('cleared', 0, cleared, spec.norm)];
  return goal.items.map(({ value, count }) => line('face', value, sent[value - 1] ?? 0, count));
}

/** One line per thing the goal of the level counts, as the run stands. Empty for a run that is not a level. */
export function goalLines(state: RunState): GoalLine[] {
  const run = state.levelRun;
  if (!run) return [];
  return linesOf(run.spec, run.sent, run.bestChain, run.spec.norm - standing(state));
}

/** The goal of a level before its first move: nothing sent, no chain made, every die standing. */
export function goalOf(spec: LevelSpec): GoalLine[] {
  return linesOf(spec, [], 0, 0);
}

export function goalReached(state: RunState): boolean {
  const lines = goalLines(state);
  return lines.length > 0 && lines.every((line) => line.have >= line.need);
}

/**
 * A board to be cleared has come to a dead end: one die stands and no group is open for it to
 * join. Alone it makes no group, so it will never go.
 */
export function levelStuck(state: RunState): boolean {
  const run = state.levelRun;
  if (!run || state.over || run.spec.goal.kind !== 'clear') return false;
  return standing(state) === 1 && state.reactions.length === 0 && !state.cubes.some((cube) => cube.state === 'moving');
}

/** Open chains: the value and how many more moves a die that lands still joins. */
export function chainWindows(state: RunState): { value: number; moves: number }[] {
  const { actionTicks, sinkingTicks } = state.config;
  const windows: { value: number; moves: number }[] = [];
  for (const reaction of state.reactions) {
    const ticks = state.cubes.filter((c) => c.state === 'sinking' && c.reactionId === reaction.id).map((c) => c.t);
    if (ticks.length === 0) continue;
    windows.push({ value: reaction.value, moves: Math.floor((sinkingTicks - Math.min(...ticks)) / actionTicks) });
  }
  return windows;
}

/** False while a level holds the world still: the picture must not run ahead of it. */
export function worldRuns(state: RunState): boolean {
  const run = state.levelRun;
  if (!run) return true;
  return !state.over && (run.beat > 0 || state.cubes.some((c) => c.state === 'moving'));
}

/** Counts what the tick has sent: a die is sent on the tick it becomes part of a group. */
function countSent(state: RunState, run: LevelRun): void {
  for (const event of state.events) {
    if (event.type === 'match' || event.type === 'chain') {
      run.sent[event.value - 1] += event.count;
      run.bestChain = Math.max(run.bestChain, event.type === 'chain' ? event.chain : 1);
    } else if (event.type === 'happyOne') {
      run.sent[0] += event.count;
    }
  }
}

/**
 * The end of a beat: the tick a moved die lands, or the last tick of a beat the world played by
 * itself. What the tick has sent is counted towards the goal; the level ends if the goal is met,
 * or if the moves are spent, and a goal met with the last move is a level passed; and if the
 * level goes on and is one that dice come to, the board gets its next die.
 */
export function endBeat(state: RunState): void {
  const run = state.levelRun;
  if (!run || state.over) return;
  countSent(state, run);
  const { spec } = run;
  if (goalReached(state)) {
    state.over = true;
    state.endReason = 'passed';
    state.events.push({ type: 'levelPassed' });
    return;
  }
  if (spec.moves > 0 && run.moves >= spec.moves) {
    state.over = true;
    state.endReason = 'failed';
    state.events.push({ type: 'levelFailed' });
    return;
  }
  if (spec.arrival === 'refill') refillLevel(state, LEVEL_REFILL);
}
