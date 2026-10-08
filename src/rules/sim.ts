import { NO_CELL, cellIndex, cubeAt } from './board';
import { endBeat, levelConfig } from './level';
import { applyMove, canAcceptCommand } from './movement';
import { levelStats, pruneReactions, removeCube, resolveLanded, runPhase } from './reactions';
import { isPuzzleHeld, placePuzzleLayout, puzzleConfig, runPuzzle } from './puzzle';
import { advancePending, chainQuiet, placeLevelLayout, placeStartLayout, runSpawn } from './spawn';
import { isHeld, placeTutorialLayout, runTutorial, tutorialConfig, tutorialMove } from './tutorial';
import { runWave, waveAt } from './wave';
import type { Dir, LevelRun, LevelSpec, PuzzleLayout, RulesConfig, RunState } from './types';

export interface RunOptions {
  seed: number;
  config: RulesConfig;
  /** Time Limited instead of Endless. Ignored for the tutorial. */
  timed?: boolean;
  tutorial?: boolean;
  /** A puzzle to solve: its dice and nothing else, on a board of its own size. */
  puzzle?: PuzzleLayout;
  /** A level of the game: its board, its dice, its goal and its moves. */
  level?: LevelSpec;
  /** Start with no cubes and the player on the ground. Used by tests. */
  empty?: boolean;
  forceFallback?: boolean;
}

export function createRun(opts: RunOptions): RunState {
  const { puzzle } = opts;
  const level = puzzle ? undefined : opts.level;
  const scripted = opts.tutorial && !puzzle && !level;
  // The run keeps a config of its own: its chain window changes with the level.
  const config = puzzle
    ? puzzleConfig(opts.config, puzzle)
    : level
      ? levelConfig(opts.config, level)
      : opts.tutorial
        ? tutorialConfig(opts.config)
        : { ...opts.config };
  const state: RunState = {
    config,
    mode: puzzle ? 'puzzle' : level ? 'level' : opts.tutorial ? 'practice' : opts.timed ? 'timed' : 'endless',
    seed: opts.seed,
    tick: 0,
    rng: opts.seed | 0,
    cubes: [],
    grid: new Array<number>(config.size * config.size).fill(0),
    reactions: [],
    pending: [],
    // A board given die by die may start the player on the floor, on a cell that holds no die.
    player: { x: config.startX, z: config.startZ, level: opts.empty || level?.layout?.onFloor ? 'ground' : 'top' },
    score: 0,
    level: 1,
    removed: 0,
    maxChain: 0,
    spawnTimer: 0,
    wave: waveAt(config, opts.seed, 0, 0),
    chainCalmLeft: 0,
    chainQuietSpent: 0,
    edgeCalmLeft: 0,
    edgeCalmSpent: false,
    sinceClear: 0,
    liftTimer: 0,
    fullTicks: 0,
    spawnEnabled: !opts.tutorial && !puzzle && !level,
    feedDeck: [],
    helpDeck: [],
    tutorial: scripted ? { step: 0, timer: 0, done: false } : null,
    puzzle: puzzle ? { moves: 0, held: 0, dead: null } : null,
    levelRun: level ? { spec: level, moves: 0, sent: [0, 0, 0, 0, 0, 0], bestChain: 0, beat: 0 } : null,
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
      floorClimbs: 0,
      dockDescents: 0,
      dockClimbs: 0,
      gifts: 0,
      wipes: 0,
      levels: [],
      dangerTicks: 0,
      chainQuietTicks: 0,
      longestChainQuiet: 0,
    },
    events: [],
    nextCubeId: 1,
    nextReactionId: 1,
  };
  // The cells a level cuts out of its board are marked before anything is laid: nothing ever stands there.
  for (const { x, z } of level?.holes ?? []) state.grid[cellIndex(config.size, x, z)] = NO_CELL;
  if (opts.empty) return state;
  if (puzzle) placePuzzleLayout(state, puzzle);
  else if (level) placeLevelLayout(state);
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
    if (cube.hold) {
      cube.hold--;
      continue;
    }
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
 * A tick of a level. Its world moves only with a move, a roll or a push, and for as long as
 * the moved die is on its way: a beat. On every other tick nothing sinks, rises or comes, and
 * the tick of the run stands; the player's own step is all that goes on. Where there is no move
 * to make the world plays a beat by itself: with no die standing, and with the player up on a
 * die that is still coming, which can be neither rolled nor left and so comes up under them.
 * A beat ends on the tick the die lands, or on the last tick of a beat played alone.
 */
function stepLevel(state: RunState, run: LevelRun, cmd: Dir | null): boolean {
  const flying = () => state.cubes.some((c) => c.state === 'moving');
  const accepts = cmd !== null && canAcceptCommand(state);
  const moved = flying();
  const alone = run.beat > 0;

  finishMovements(state);
  if (moved || alone) {
    finishRemovals(state);
    finishRisings(state);
    advancePending(state);
    if (alone) run.beat--;
    countStats(state);
    state.tick++;
    if ((moved && !flying()) || (alone && run.beat === 0)) endBeat(state);
  }
  if (accepts && !state.over && applyMove(state, cmd)) {
    const kind = state.player.action?.kind;
    if (kind === 'roll' || kind === 'push') run.moves++;
  }
  const waits = state.over || state.player.action !== undefined || run.beat > 0;
  if (!waits) {
    const { player } = state;
    const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
    const noneStands = !state.cubes.some((c) => c.state === 'idle' || c.state === 'moving');
    if (noneStands || own?.state === 'rising') run.beat = state.config.actionTicks;
  }
  return accepts;
}

/**
 * Advances the run by one tick. `cmd` is applied only when the player is free;
 * the return value says whether it was consumed (blocked steps are consumed too).
 */
export function step(state: RunState, cmd: Dir | null): boolean {
  state.events = [];
  if (state.over) return false;
  if (state.levelRun) return stepLevel(state, state.levelRun, cmd);
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
  runWave(state);
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
