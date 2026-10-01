import { cellIndex, cubeAt, neighbours } from './board';
import type { Cube, Overrun, RunState } from './types';

function startSinking(cube: Cube, reactionId: number): void {
  cube.state = 'sinking';
  cube.t = 0;
  cube.reactionId = reactionId;
}

function recordClear(state: RunState): void {
  state.stats.clears++;
  if (state.stats.clearTicks.length < 5) state.stats.clearTicks.push(state.tick);
}

/** Takes a cube off the board and counts it towards the level. */
export function removeCube(state: RunState, cube: Cube): void {
  const { config, player } = state;
  state.grid[cellIndex(config.size, cube.x, cube.z)] = 0;
  state.cubes = state.cubes.filter((c) => c !== cube);
  state.removed++;
  state.events.push({ type: 'removed', cubeId: cube.id });
  if (player.level === 'top' && player.x === cube.x && player.z === cube.z) {
    player.level = 'ground';
    state.stats.falls++;
    state.events.push({ type: 'fell' });
  }
  const level = 1 + Math.floor(state.removed / config.cubesPerLevel);
  if (level > state.level) {
    state.level = level;
    state.events.push({ type: 'levelUp', level });
  }
}

/** A cube going down as part of a chain: until it is gone, cubes brought to it join the chain. */
export function inChain(cube: Cube): boolean {
  return cube.state === 'sinking' && cube.reactionId !== 0;
}

/** Idle cubes connected to `start` that show the same top value, `start` included. */
function componentOf(state: RunState, start: Cube): Cube[] {
  const value = start.ori.top;
  const seen = new Set<number>([start.id]);
  const component: Cube[] = [];
  const stack = [start];
  while (stack.length > 0) {
    const cube = stack.pop()!;
    component.push(cube);
    for (const n of neighbours(state, cube.x, cube.z)) {
      if (n.state === 'idle' && n.ori.top === value && !seen.has(n.id)) {
        seen.add(n.id);
        stack.push(n);
      }
    }
  }
  return component.sort((a, b) => a.id - b.id);
}

function touchedReactions(state: RunState, component: Cube[], over: Overrun | undefined): number[] {
  const value = component[0].ori.top;
  const ids = new Set<number>();
  for (const cube of component) {
    for (const n of neighbours(state, cube.x, cube.z)) {
      if (inChain(n) && n.ori.top === value) ids.add(n.reactionId);
    }
  }
  // Rolling onto a low sinking cube of the same value continues its chain.
  if (over && over.value === value && state.reactions.some((r) => r.id === over.reactionId)) ids.add(over.reactionId);
  return [...ids].sort((a, b) => a - b);
}

function joinReactions(state: RunState, component: Cube[], touched: number[]): void {
  const value = component[0].ori.top;
  const targetId = touched[0];
  const involved = state.reactions.filter((r) => touched.includes(r.id));
  const chain = Math.max(...involved.map((r) => r.chain)) + 1;
  const total = involved.reduce((sum, r) => sum + r.total, 0) + component.length;

  for (const cube of state.cubes) {
    if (touched.includes(cube.reactionId)) cube.reactionId = targetId;
    if (cube.move?.over && touched.includes(cube.move.over.reactionId)) cube.move.over.reactionId = targetId;
  }
  state.reactions = state.reactions.filter((r) => r.id === targetId || !touched.includes(r.id));
  const target = state.reactions.find((r) => r.id === targetId)!;
  target.chain = chain;
  target.total = total;

  for (const cube of component) startSinking(cube, targetId);

  const points = value * total * chain;
  state.score += points;
  state.maxChain = Math.max(state.maxChain, chain);
  recordClear(state);
  state.events.push({ type: 'chain', reactionId: targetId, value, chain, count: component.length, points });
}

function startReaction(state: RunState, component: Cube[]): void {
  const value = component[0].ori.top;
  const id = state.nextReactionId++;
  state.reactions.push({ id, value, chain: 1, total: component.length });
  for (const cube of component) startSinking(cube, id);
  const points = value * component.length;
  state.score += points;
  state.maxChain = Math.max(state.maxChain, 1);
  recordClear(state);
  state.events.push({ type: 'match', reactionId: id, value, count: component.length, points });
}

/**
 * Happy One: a 1 connected to a running chain makes every resting 1 on the board sink,
 * except the one the player is standing on. With `soloOne` only the connected 1 sinks.
 */
function happyOne(state: RunState, trigger: Cube): void {
  const { player } = state;
  const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
  const victims = state.config.experiments.soloOne
    ? [trigger]
    : state.cubes.filter((c) => c.state === 'idle' && c.ori.top === 1 && c !== own);
  if (victims.length === 0) return;
  for (const cube of victims) startSinking(cube, 0);
  state.score += victims.length;
  recordClear(state);
  state.events.push({ type: 'happyOne', count: victims.length, points: victims.length });
}

/**
 * Puzzle: a group clears only as a whole and nothing joins it afterwards. It waits under the
 * player, so what matters at once is whether there is a way on from it.
 */
function resolvePuzzle(state: RunState, cube: Cube): void {
  const puzzle = state.puzzle!;
  const value = cube.ori.top;
  if (value < 2) return;
  const component = componentOf(state, cube);
  if (component.length < value) return;
  startReaction(state, component);
  const rest = state.cubes.filter((c) => c.state === 'idle');
  // The last group goes down with the player on it.
  if (rest.length === 0) return;
  puzzle.held = cube.reactionId;
  const touches = (a: Cube, b: Cube) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1;
  if (!rest.some((r) => component.some((c) => touches(r, c)))) puzzle.dead = 'noExit';
  else if (rest.length === 1) puzzle.dead = 'single';
  if (puzzle.dead) state.events.push({ type: 'deadEnd', reason: puzzle.dead });
}

/**
 * Resolves what a cube causes when the player has just rolled or pushed it into place.
 * Nothing clears on its own: cubes that merely rose next to each other wait until the
 * player moves a cube into or onto the group.
 */
export function resolveLanded(state: RunState, cube: Cube, over?: Overrun): void {
  if (cube.state !== 'idle') return;
  if (state.puzzle) {
    resolvePuzzle(state, cube);
    return;
  }
  if (cube.ori.top === 1) {
    // Only a chain counts: 1s that are themselves sinking do not set off another Happy One.
    const touching = (over !== undefined && over.reactionId !== 0) || neighbours(state, cube.x, cube.z).some(inChain);
    if (touching) happyOne(state, cube);
    return;
  }
  const component = componentOf(state, cube);
  const touched = touchedReactions(state, component, over);
  if (touched.length > 0) joinReactions(state, component, touched);
  else if (component.length >= cube.ori.top) startReaction(state, component);
}

/** Drops reactions that no longer have a sinking cube or a cube rolling onto one. */
export function pruneReactions(state: RunState): void {
  if (state.reactions.length === 0) return;
  const alive = new Set<number>();
  for (const c of state.cubes) {
    if (c.state === 'sinking') alive.add(c.reactionId);
    if (c.move?.over) alive.add(c.move.over.reactionId);
  }
  state.reactions = state.reactions.filter((r) => alive.has(r.id));
}
