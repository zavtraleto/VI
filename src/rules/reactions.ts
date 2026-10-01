import { cubeAt, neighbours, DELTA, DIRS } from './board';
import type { Cube, RunState } from './types';

function startSinking(cube: Cube, reactionId: number): void {
  cube.state = 'sinking';
  cube.t = 0;
  cube.reactionId = reactionId;
}

function recordClear(state: RunState): void {
  state.stats.clears++;
  if (state.stats.clearTicks.length < 5) state.stats.clearTicks.push(state.tick);
}

/** Connected groups of idle cubes sharing a top value of 2..6, ordered by lowest cube id. */
function idleComponents(state: RunState): Cube[][] {
  const seen = new Set<number>();
  const components: Cube[][] = [];
  for (const start of state.cubes) {
    if (start.state !== 'idle' || start.ori.top < 2 || seen.has(start.id)) continue;
    const value = start.ori.top;
    const component: Cube[] = [];
    const stack = [start];
    seen.add(start.id);
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
    components.push(component);
  }
  return components;
}

function touchedReactions(state: RunState, component: Cube[]): number[] {
  const value = component[0].ori.top;
  const ids = new Set<number>();
  for (const cube of component) {
    for (const n of neighbours(state, cube.x, cube.z)) {
      if (n.state === 'sinking' && n.reactionId !== 0 && n.ori.top === value) ids.add(n.reactionId);
    }
  }
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

/** Cubes the player is standing on top of, including the one being left mid-step. */
function protectedCubeIds(state: RunState): Set<number> {
  const ids = new Set<number>();
  const { player } = state;
  if (player.level === 'top') {
    const c = cubeAt(state, player.x, player.z);
    if (c) ids.add(c.id);
  }
  if (player.action && player.action.fromLevel === 'top') {
    const c = cubeAt(state, player.action.fromX, player.action.fromZ);
    if (c) ids.add(c.id);
  }
  return ids;
}

function hasSinkingNeighbour(state: RunState, cube: Cube): boolean {
  for (const dir of DIRS) {
    const n = cubeAt(state, cube.x + DELTA[dir].dx, cube.z + DELTA[dir].dz);
    if (n && n.state === 'sinking') return true;
  }
  return false;
}

function resolveHappyOne(state: RunState): void {
  const ones = state.cubes.filter((c) => c.state === 'idle' && c.ori.top === 1);
  if (!ones.some((c) => hasSinkingNeighbour(state, c))) return;
  const shielded = protectedCubeIds(state);
  const victims = ones.filter((c) => !shielded.has(c.id));
  if (victims.length === 0) return;
  for (const cube of victims) startSinking(cube, 0);
  state.score += victims.length;
  recordClear(state);
  state.events.push({ type: 'happyOne', count: victims.length, points: victims.length });
}

/** Joins to running reactions first, then new groups, then Happy One. */
export function resolveReactions(state: RunState): void {
  const components = idleComponents(state);
  const leftover: Cube[][] = [];
  for (const component of components) {
    const touched = touchedReactions(state, component);
    if (touched.length > 0) joinReactions(state, component, touched);
    else leftover.push(component);
  }
  for (const component of leftover) {
    if (component.length >= component[0].ori.top) startReaction(state, component);
  }
  resolveHappyOne(state);
}

/** Drops reactions that no longer have a sinking cube. */
export function pruneReactions(state: RunState): void {
  if (state.reactions.length === 0) return;
  const alive = new Set(state.cubes.filter((c) => c.state === 'sinking').map((c) => c.reactionId));
  state.reactions = state.reactions.filter((r) => alive.has(r.id));
}
