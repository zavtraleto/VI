import { DELTA, DIRS, cellIndex, cubeAt, cubeHeight, freeCells, inBounds, isFree, nearestFree } from './board';
import { helpChance, spawnIntervalTicks, topWeights } from './config';
import { ALL_ORIENTATIONS, orientationsWithTop } from './orientation';
import { nextRandom, randomInt } from './rng';
import type { Cube, CubeState, Orientation, RunState } from './types';

export function addCube(
  state: RunState,
  x: number,
  z: number,
  ori: Orientation,
  cubeState: CubeState = 'idle',
): Cube {
  const cube: Cube = { id: state.nextCubeId++, x, z, ori, state: cubeState, t: 0, reactionId: 0 };
  state.cubes.push(cube);
  state.grid[cellIndex(state.config.size, x, z)] = cube.id;
  return cube;
}

function randomOrientation(state: RunState): Orientation {
  return ALL_ORIENTATIONS[randomInt(state, ALL_ORIENTATIONS.length)];
}

/** True when a grid of top values (0 = empty) already holds a clearable group. */
export function hasReadyGroup(tops: number[], size: number): boolean {
  const seen = new Array<boolean>(tops.length).fill(false);
  for (let i = 0; i < tops.length; i++) {
    const value = tops[i];
    if (value < 2 || seen[i]) continue;
    let count = 0;
    const stack = [i];
    seen[i] = true;
    while (stack.length > 0) {
      const cur = stack.pop()!;
      count++;
      const x = cur % size;
      const z = Math.floor(cur / size);
      for (const dir of DIRS) {
        const nx = x + DELTA[dir].dx;
        const nz = z + DELTA[dir].dz;
        if (!inBounds(size, nx, nz)) continue;
        const ni = cellIndex(size, nx, nz);
        if (!seen[ni] && tops[ni] === value) {
          seen[ni] = true;
          stack.push(ni);
        }
      }
    }
    if (count >= value) return true;
  }
  return false;
}

interface Placement {
  x: number;
  z: number;
  ori: Orientation;
}

function tryStartLayout(state: RunState): Placement[] | null {
  const { size, startCubes, startX, startZ } = state.config;
  const cells: number[] = [];
  for (let i = 0; i < size * size; i++) {
    if (i !== cellIndex(size, startX, startZ)) cells.push(i);
  }
  // Partial Fisher-Yates: the first startCubes - 1 entries become the picked cells.
  for (let i = 0; i < startCubes - 1; i++) {
    const j = i + randomInt(state, cells.length - i);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const picked = [cellIndex(size, startX, startZ), ...cells.slice(0, startCubes - 1)];
  const tops = new Array<number>(size * size).fill(0);
  const layout: Placement[] = picked.map((i) => {
    const ori = randomOrientation(state);
    tops[i] = ori.top;
    return { x: i % size, z: Math.floor(i / size), ori };
  });

  let cubeNeighbours = 0;
  let emptyNeighbours = 0;
  for (const dir of DIRS) {
    const nx = startX + DELTA[dir].dx;
    const nz = startZ + DELTA[dir].dz;
    if (!inBounds(size, nx, nz)) continue;
    if (tops[cellIndex(size, nx, nz)] > 0) cubeNeighbours++;
    else emptyNeighbours++;
  }
  if (cubeNeighbours === 0 || emptyNeighbours === 0) return null;
  if (hasReadyGroup(tops, size)) return null;
  return layout;
}

const FALLBACK_CELLS: readonly [number, number][] = [
  [3, 4], [4, 4], [0, 0], [2, 0], [4, 0], [6, 0], [1, 2],
  [3, 2], [5, 2], [0, 4], [6, 4], [0, 6], [2, 6], [4, 6],
];

export function fallbackLayout(count = FALLBACK_CELLS.length): Placement[] {
  const ori = orientationsWithTop(6)[0];
  return FALLBACK_CELLS.slice(0, count).map(([x, z]) => ({ x, z, ori }));
}

export function placeStartLayout(state: RunState, forceFallback = false): void {
  const { startCubes, startX, startZ } = state.config;
  let layout: Placement[] | null = null;
  for (let attempt = 0; attempt < 100 && !forceFallback && !layout; attempt++) {
    layout = tryStartLayout(state);
  }
  if (!layout) {
    layout = fallbackLayout(startCubes);
    // The fallback is drawn for the usual start cell; any other start takes its first cube.
    if (!layout.some((p) => p.x === startX && p.z === startZ)) layout[0] = { ...layout[0], x: startX, z: startZ };
  }
  for (const p of layout) addCube(state, p.x, p.z, p.ori);
}

/** Top values of everything that will be resting on the board: cubes and announced spawns. */
function topsGrid(state: RunState): number[] {
  const size = state.config.size;
  const tops = new Array<number>(state.grid.length).fill(0);
  for (const c of state.cubes) {
    if (c.state !== 'sinking') tops[cellIndex(size, c.x, c.z)] = c.ori.top;
  }
  for (const p of state.pending) tops[cellIndex(size, p.x, p.z)] = p.ori.top;
  return tops;
}

/** Size of the same-value group that cell `i` belongs to. */
function groupSizeAt(tops: number[], size: number, i: number): number {
  const value = tops[i];
  const seen = new Set<number>([i]);
  const stack = [i];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const x = cur % size;
    const z = Math.floor(cur / size);
    for (const dir of DIRS) {
      const nx = x + DELTA[dir].dx;
      const nz = z + DELTA[dir].dz;
      if (!inBounds(size, nx, nz)) continue;
      const ni = cellIndex(size, nx, nz);
      if (!seen.has(ni) && tops[ni] === value) {
        seen.add(ni);
        stack.push(ni);
      }
    }
  }
  return seen.size;
}

/** A cube showing `top` here would look like it should join a running chain or Happy One. */
function besideMatchingSinking(state: RunState, x: number, z: number, top: number): boolean {
  for (const dir of DIRS) {
    const n = cubeAt(state, x + DELTA[dir].dx, z + DELTA[dir].dz);
    if (n && n.state === 'sinking' && (top === 1 || n.ori.top === top)) return true;
  }
  return false;
}

/** Picks an index with probability proportional to its weight. */
function weightedIndex(state: RunState, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = nextRandom(state) * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

function orientationWithTop(state: RunState, top: number): Orientation {
  const options = orientationsWithTop(top);
  return options[randomInt(state, options.length)];
}

/** Top values of the resting cubes around a cell: the ones a new cube could pair up with. */
function neighbourTops(state: RunState, x: number, z: number): number[] {
  const tops: number[] = [];
  for (const dir of DIRS) {
    const n = cubeAt(state, x + DELTA[dir].dx, z + DELTA[dir].dz);
    if (n && n.state === 'idle' && n.ori.top >= 2) tops.push(n.ori.top);
  }
  return tops;
}

/**
 * Picks an orientation for a new cube. The top value follows the level's weights; a
 * helpful spawn instead tries to show a value that a neighbour already shows, so the
 * player is one move away from a group. Either way the cube must not complete a group by
 * itself: clears are the player's doing.
 */
function chooseOrientation(state: RunState, x: number, z: number, helpful = false): Orientation {
  const size = state.config.size;
  const tops = topsGrid(state);
  const i = cellIndex(size, x, z);
  const weights = topWeights(state.config, state.level);
  const wanted = helpful ? neighbourTops(state, x, z) : [];
  let top = 1;
  for (let attempt = 0; attempt < 12; attempt++) {
    top =
      attempt < 3 && wanted.length > 0
        ? wanted[randomInt(state, wanted.length)]
        : weightedIndex(state, weights) + 1;
    tops[i] = top;
    const readyGroup = top >= 2 && groupSizeAt(tops, size, i) >= top;
    if (!readyGroup && !besideMatchingSinking(state, x, z, top)) break;
  }
  return orientationWithTop(state, top);
}

/**
 * Where the next cube goes. A helpful spawn prefers cells that touch other cubes and are
 * near the player, so new cubes are reachable and in play; otherwise any free cell will do.
 */
function chooseCell(
  state: RunState,
  free: readonly { x: number; z: number }[],
  helpful: boolean,
): { x: number; z: number } {
  if (!helpful) return free[randomInt(state, free.length)];
  const { player } = state;
  const weights = free.map((cell) => {
    let weight = 1;
    const touching = DIRS.some((dir) => {
      const n = cubeAt(state, cell.x + DELTA[dir].dx, cell.z + DELTA[dir].dz);
      return n !== undefined && n.state !== 'sinking';
    });
    if (touching) weight += 3;
    const distance = Math.abs(cell.x - player.x) + Math.abs(cell.z - player.z);
    if (distance <= 2) weight += 2;
    else if (distance <= 4) weight += 1;
    return weight;
  });
  return free[weightedIndex(state, weights)];
}

export function spawnCube(state: RunState, x: number, z: number, ori: Orientation): Cube {
  const cube = addCube(state, x, z, ori, 'rising');
  state.events.push({ type: 'spawn', cubeId: cube.id });
  const { player } = state;
  if (player.level === 'ground' && player.x === x && player.z === z) {
    player.level = 'top';
    state.events.push({ type: 'lifted' });
  }
  return cube;
}

function hasPendingAt(state: RunState, x: number, z: number): boolean {
  return state.pending.some((p) => p.x === x && p.z === z);
}

/** Announces a cube on a cell; it starts rising when the warning runs out. */
function announce(state: RunState, x: number, z: number, helpful = false): void {
  const ori = chooseOrientation(state, x, z, helpful);
  if (state.config.warnTicks <= 0) {
    spawnCube(state, x, z, ori);
    return;
  }
  state.pending.push({ x, z, ori, t: 0 });
  state.events.push({ type: 'warned', x, z });
}

function advancePending(state: RunState): void {
  if (state.pending.length === 0) return;
  const due: typeof state.pending = [];
  state.pending = state.pending.filter((p) => {
    p.t++;
    if (p.t < state.config.warnTicks) return true;
    due.push(p);
    return false;
  });
  for (const p of due) {
    // If something has moved onto the announced cell, the cube comes up in the nearest free one.
    const cell = isFree(state, p.x, p.z) ? p : nearestFree(state, p.x, p.z);
    if (cell) spawnCube(state, cell.x, cell.z, p.ori);
  }
}

/** Cubes on the board plus those already announced. */
function committed(state: RunState): number {
  return state.cubes.length + state.pending.length;
}

/** Is there already a cube the player on the ground could walk over to and step onto? */
function hasMountableCube(state: RunState): boolean {
  const { config } = state;
  return state.cubes.some((c) => c.state === 'rising' && cubeHeight(c, config) <= config.mountHeight);
}

/**
 * Lift: a player left on the ground gets the next cube under their feet. It is a last
 * resort, not an extra cube: it waits while another cube is on its way or can still be
 * stepped onto, and it takes the place of the next regular spawn.
 */
function runLift(state: RunState): void {
  const { config, player } = state;
  if (!config.experiments.floorLift || player.level !== 'ground') {
    state.liftTimer = 0;
    return;
  }
  state.liftTimer++;
  if (state.liftTimer < config.floorLiftTicks) return;
  if (state.pending.length > 0 || hasMountableCube(state)) return;
  if (!isFree(state, player.x, player.z)) return;
  if (committed(state) >= config.size * config.size) return;
  state.liftTimer = 0;
  state.spawnTimer = 0;
  announce(state, player.x, player.z);
}

/** Timed spawn. Never queues spawns while the board is full. */
export function runSpawn(state: RunState): void {
  advancePending(state);
  if (!state.spawnEnabled) return;
  runLift(state);

  const { config } = state;
  const free = freeCells(state).filter((c) => !hasPendingAt(state, c.x, c.z));
  const gentle = config.experiments.gentleStart && state.tick < config.gentleTicks;
  if (free.length === 0 || (gentle && committed(state) >= config.warnOccupied)) {
    state.spawnTimer = 0;
    return;
  }
  state.spawnTimer++;
  if (state.spawnTimer < spawnIntervalTicks(config, state.level, committed(state))) return;
  state.spawnTimer = 0;
  const helpful = nextRandom(state) < helpChance(config, state.level);
  const cell = chooseCell(state, free, helpful);
  announce(state, cell.x, cell.z, helpful);
}
