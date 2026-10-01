import { cellIndex } from './board';
import { applyMove, canAcceptCommand } from './movement';
import { pruneReactions, resolveReactions } from './reactions';
import { placeStartLayout, placeTutorialLayout, runSpawn, tutorialRefill } from './spawn';
import type { Dir, RulesConfig, RunState } from './types';

export interface RunOptions {
  seed: number;
  config: RulesConfig;
  tutorial?: boolean;
  /** Start with no cubes and the player on the ground. Used by tests. */
  empty?: boolean;
  forceFallback?: boolean;
}

export function createRun(opts: RunOptions): RunState {
  const { config } = opts;
  const state: RunState = {
    config,
    mode: opts.tutorial ? 'practice' : 'endless',
    seed: opts.seed,
    tick: 0,
    rng: opts.seed | 0,
    cubes: [],
    grid: new Array<number>(config.size * config.size).fill(0),
    reactions: [],
    player: { x: config.startX, z: config.startZ, level: opts.empty ? 'ground' : 'top' },
    score: 0,
    level: 1,
    removed: 0,
    maxChain: 0,
    spawnTimer: 0,
    fullTicks: 0,
    spawnEnabled: !opts.tutorial,
    tutorial: opts.tutorial ? { phase: 'await', timer: 0 } : null,
    groundStreak: 0,
    over: false,
    stats: { clearTicks: [], clears: 0, blockedSteps: 0, groundTicks: 0, falls: 0, steps: 0 },
    events: [],
    nextCubeId: 1,
    nextReactionId: 1,
  };
  if (opts.empty) return state;
  if (opts.tutorial) placeTutorialLayout(state);
  else placeStartLayout(state, opts.forceFallback);
  return state;
}

function finishMovements(state: RunState): void {
  const { actionTicks } = state.config;
  for (const cube of state.cubes) {
    if (cube.state !== 'moving') continue;
    cube.t++;
    if (cube.t >= actionTicks) {
      cube.state = 'idle';
      cube.t = 0;
      cube.move = undefined;
      state.events.push({ type: 'landed' });
    }
  }
  const action = state.player.action;
  if (action) {
    action.t++;
    if (action.t >= actionTicks) state.player.action = undefined;
  }
}

function finishRemovals(state: RunState): void {
  const { config, player } = state;
  let removedAny = false;
  for (const cube of state.cubes) {
    if (cube.state !== 'sinking') continue;
    cube.t++;
    if (cube.t < config.sinkingTicks) continue;
    removedAny = true;
    state.grid[cellIndex(config.size, cube.x, cube.z)] = 0;
    state.removed++;
    state.events.push({ type: 'removed', cubeId: cube.id });
    if (player.level === 'top' && player.x === cube.x && player.z === cube.z) {
      player.level = 'ground';
      state.stats.falls++;
      state.events.push({ type: 'fell' });
    }
  }
  if (!removedAny) return;
  state.cubes = state.cubes.filter((c) => !(c.state === 'sinking' && c.t >= config.sinkingTicks));
  pruneReactions(state);
  const level = 1 + Math.floor(state.removed / config.cubesPerLevel);
  if (level > state.level) {
    state.level = level;
    state.events.push({ type: 'levelUp', level });
  }
}

function finishRisings(state: RunState): void {
  for (const cube of state.cubes) {
    if (cube.state !== 'rising') continue;
    cube.t++;
    if (cube.t >= state.config.risingTicks) {
      cube.state = 'idle';
      cube.t = 0;
      state.events.push({ type: 'risen', cubeId: cube.id });
    }
  }
}

function runTutorial(state: RunState): void {
  const tutorial = state.tutorial;
  if (!tutorial) return;
  if (tutorial.phase === 'await') {
    if (state.events.some((e) => e.type === 'match')) {
      tutorial.phase = 'cleared';
      tutorial.timer = 0;
    }
  } else if (tutorial.phase === 'cleared') {
    tutorial.timer++;
    if (tutorial.timer >= state.config.tutorialRefillTicks) {
      tutorial.phase = 'done';
      tutorialRefill(state);
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
    state.events.push({ type: 'gameOver' });
  }
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
  if (accepts) applyMove(state, cmd);
  resolveReactions(state);
  runTutorial(state);
  runSpawn(state);
  checkFill(state);

  if (state.player.level === 'ground') {
    state.groundStreak++;
    state.stats.groundTicks++;
  } else {
    state.groundStreak = 0;
  }
  state.tick++;
  return accepts;
}
