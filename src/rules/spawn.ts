import { DELTA, DIRS, cellIndex, cubeAt, freeCells, inBounds, isFree, nearestFree } from './board';
import { spawnIntervalTicks } from './config';
import { ALL_ORIENTATIONS, orientationsWithTop } from './orientation';
import { randomInt } from './rng';
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
  let layout: Placement[] | null = null;
  for (let attempt = 0; attempt < 100 && !forceFallback && !layout; attempt++) {
    layout = tryStartLayout(state);
  }
  for (const p of layout ?? fallbackLayout(state.config.startCubes)) addCube(state, p.x, p.z, p.ori);
}

export const TUTORIAL_A: Orientation = { top: 1, bottom: 6, north: 5, south: 2, east: 4, west: 3 };

export function placeTutorialLayout(state: RunState): void {
  const { startX, startZ } = state.config;
  addCube(state, startX, startZ, TUTORIAL_A);
  addCube(state, startX - 1, startZ - 1, orientationsWithTop(2)[0]);
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

/**
 * Picks an orientation for a new cube that does not complete a group by itself. Clears
 * are the player's doing; the generator tries not to leave ready-made groups lying around.
 */
function chooseOrientation(state: RunState, x: number, z: number): Orientation {
  const size = state.config.size;
  const tops = topsGrid(state);
  const i = cellIndex(size, x, z);
  let ori = randomOrientation(state);
  for (let attempt = 0; attempt < 12; attempt++) {
    tops[i] = ori.top;
    const readyGroup = ori.top >= 2 && groupSizeAt(tops, size, i) >= ori.top;
    if (!readyGroup && !besideMatchingSinking(state, x, z, ori.top)) break;
    ori = randomOrientation(state);
  }
  return ori;
}

function isBesidePlayer(state: RunState, x: number, z: number): boolean {
  return Math.abs(x - state.player.x) + Math.abs(z - state.player.z) === 1;
}

/**
 * After the staged first clear: bring the board up to the normal starting count with
 * rising cubes. The first one goes next to the player so there is a way off the sinking cube.
 */
export function tutorialRefill(state: RunState): void {
  const wanted = Math.max(0, state.config.startCubes - 2);
  for (let placed = 0; placed < wanted; placed++) {
    let cells = freeCells(state).filter((c) => !(c.x === state.player.x && c.z === state.player.z));
    if (placed === 0) {
      const beside = cells.filter((c) => isBesidePlayer(state, c.x, c.z));
      if (beside.length > 0) cells = beside;
    }
    if (cells.length === 0) break;
    const cell = cells[randomInt(state, cells.length)];
    spawnCube(state, cell.x, cell.z, chooseOrientation(state, cell.x, cell.z));
  }
  state.spawnEnabled = true;
  state.spawnTimer = 0;
  state.events.push({ type: 'tutorialRefill' });
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
function announce(state: RunState, x: number, z: number): void {
  const ori = chooseOrientation(state, x, z);
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

/**
 * Lift: a player left on the ground gets the next cube under their feet. It replaces the
 * next regular spawn, so it adds no pressure.
 */
function runLift(state: RunState): void {
  const { config, player } = state;
  if (!config.experiments.floorLift || player.level !== 'ground') {
    state.liftTimer = 0;
    return;
  }
  state.liftTimer++;
  if (state.liftTimer < config.floorLiftTicks) return;
  if (hasPendingAt(state, player.x, player.z) || !isFree(state, player.x, player.z)) return;
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
  if (state.spawnTimer < spawnIntervalTicks(config, state.level)) return;
  state.spawnTimer = 0;
  const cell = free[randomInt(state, free.length)];
  announce(state, cell.x, cell.z);
}
