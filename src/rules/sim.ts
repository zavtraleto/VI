import { applyMove, canAcceptCommand } from './movement';
import { levelStats, pruneReactions, removeCube, resolveLanded, runPhase } from './reactions';
import { isPuzzleHeld, placePuzzleLayout, puzzleConfig, runPuzzle } from './puzzle';
import { chainQuiet, placeStartLayout, runSpawn } from './spawn';
import { isHeld, placeTutorialLayout, runTutorial, tutorialConfig, tutorialMove } from './tutorial';
import type { Dir, PuzzleLayout, RulesConfig, RunState } from './types';

export interface RunOptions {
  seed: number;
  config: RulesConfig;
  /** Time Limited instead of Endless. Ignored for the tutorial. */
  timed?: boolean;
  tutorial?: boolean;
  /** A puzzle to solve: its dice and nothing else, on a board of its own size. */
  puzzle?: PuzzleLayout;
  /** Start with no cubes and the player on the ground. Used by tests. */
  empty?: boolean;
  forceFallback?: boolean;
}

export function createRun(opts: RunOptions): RunState {
  const { puzzle } = opts;
  // The run keeps a config of its own: its chain window changes with the level.
  const config = puzzle ? puzzleConfig(opts.config, puzzle) : opts.tutorial ? tutorialConfig(opts.config) : { ...opts.config };
  const state: RunState = {
    config,
    mode: puzzle ? 'puzzle' : opts.tutorial ? 'practice' : opts.timed ? 'timed' : 'endless',
    seed: opts.seed,
    tick: 0,
    rng: opts.seed | 0,
    cubes: [],
    grid: new Array<number>(config.size * config.size).fill(0),
    reactions: [],
    pending: [],
    player: { x: config.startX, z: config.startZ, level: opts.empty ? 'ground' : 'top' },
    score: 0,
    level: 1,
    removed: 0,
    maxChain: 0,
    spawnTimer: 0,
    calmLeft: 0,
    chainCalmLeft: 0,
    liftTimer: 0,
    fullTicks: 0,
    spawnEnabled: !opts.tutorial && !puzzle,
    feedDeck: [],
    helpDeck: [],
    tutorial: opts.tutorial && !puzzle ? { step: 0, timer: 0, done: false } : null,
    puzzle: puzzle ? { moves: 0, held: 0, dead: null } : null,
    over: false,
    endReason: null,
    stats: {
      clearTicks: [],
      clears: 0,
      bestChainScore: 0,
      blockedSteps: 0,
      groundTicks: 0,
      falls: 0,
      steps: 0,
      levels: [],
      dangerTicks: 0,
      chainQuietTicks: 0,
      longestChainQuiet: 0,
    },
    events: [],
    nextCubeId: 1,
    nextReactionId: 1,
  };
  if (opts.empty) return state;
  if (puzzle) placePuzzleLayout(state, puzzle);
  else if (opts.tutorial) placeTutorialLayout(state);
  else placeStartLayout(state, opts.forceFallback);
  return state;
}

function finishMovements(state: RunState): void {
  const { actionTicks } = state.config;
  // The player's step ends first, so a rolled cube lands with the player already on it.
  const action = state.player.action;
  if (action) {
    action.t++;
    if (action.t >= actionTicks) state.player.action = undefined;
  }
  for (const cube of [...state.cubes]) {
    if (cube.state !== 'moving') continue;
    cube.t++;
    if (cube.t < actionTicks) continue;
    const over = cube.move?.over;
    cube.state = 'idle';
    cube.t = 0;
    cube.move = undefined;
    state.events.push({ type: 'landed' });
    resolveLanded(state, cube, over);
  }
}

function finishRemovals(state: RunState): void {
  for (const cube of [...state.cubes]) {
    if (cube.state !== 'sinking' || isHeld(state, cube) || isPuzzleHeld(state, cube)) continue;
    cube.t++;
    // Read each time: a removal can raise the level, and the level sets the window.
    if (cube.t >= state.config.sinkingTicks) removeCube(state, cube);
  }
  pruneReactions(state);
}

function finishRisings(state: RunState): void {
  for (const cube of state.cubes) {
    if (cube.state !== 'rising' || isHeld(state, cube)) continue;
    cube.t++;
    if (cube.t >= state.config.risingTicks) {
      cube.state = 'idle';
      cube.t = 0;
      state.events.push({ type: 'risen', cubeId: cube.id });
    }
  }
}

function checkFill(state: RunState): void {
  const { config } = state;
  if (state.cubes.length < config.size * config.size) {
    state.fullTicks = 0;
    return;
  }
  state.fullTicks++;
  if (state.fullTicks >= config.rescueTicks) {
    state.over = true;
    state.endReason = 'full';
    state.events.push({ type: 'gameOver' });
  }
}

/** Time Limited ends when the clock runs out. */
function checkClock(state: RunState): void {
  if (state.over || state.mode !== 'timed') return;
  if (state.tick + 1 < state.config.timedTicks) return;
  state.over = true;
  state.endReason = 'time';
  state.events.push({ type: 'gameOver' });
}

/** Counters of the run report: what the pace is tuned by. */
function countStats(state: RunState): void {
  const { config, stats } = state;
  levelStats(state).ticks++;
  if (state.player.level === 'ground') stats.groundTicks++;
  if (state.cubes.length >= config.warnOccupied) stats.dangerTicks++;
}

/** Length of the silence a chain is holding, counted before the spawn timer spends a tick of it. */
function countChainQuiet(state: RunState): void {
  const { stats } = state;
  if (!state.spawnEnabled || !chainQuiet(state)) {
    stats.chainQuietTicks = 0;
    return;
  }
  stats.chainQuietTicks++;
  stats.longestChainQuiet = Math.max(stats.longestChainQuiet, stats.chainQuietTicks);
}

/**
 * Advances the run by one tick. `cmd` is applied only when the player is free;
 * the return value says whether it was consumed (blocked steps are consumed too).
 */
export function step(state: RunState, cmd: Dir | null): boolean {
  state.events = [];
  if (state.over) return false;
  const accepts = cmd !== null && canAcceptCommand(state);

  finishMovements(state);
  finishRemovals(state);
  finishRisings(state);
  if (accepts) {
    if (state.tutorial && !state.tutorial.done) tutorialMove(state, cmd);
    else applyMove(state, cmd);
  }
  runTutorial(state);
  runPhase(state);
  countChainQuiet(state);
  runSpawn(state);
  runPuzzle(state);
  // A puzzle is never lost to a full board: nothing rises on it.
  if (!state.puzzle) checkFill(state);
  checkClock(state);

  countStats(state);
  state.tick++;
  return accepts;
}
