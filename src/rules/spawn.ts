import { DELTA, DIRS, cellIndex, cubeAt, freeCells, inBounds, isFree } from './board';
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

export function fallbackLayout(): Placement[] {
  const ori = orientationsWithTop(6)[0];
  return FALLBACK_CELLS.map(([x, z]) => ({ x, z, ori }));
}

export function placeStartLayout(state: RunState, forceFallback = false): void {
  let layout: Placement[] | null = null;
  for (let attempt = 0; attempt < 100 && !forceFallback && !layout; attempt++) {
    layout = tryStartLayout(state);
  }
  for (const p of layout ?? fallbackLayout()) addCube(state, p.x, p.z, p.ori);
}

export const TUTORIAL_A: Orientation = { top: 1, bottom: 6, north: 5, south: 2, east: 4, west: 3 };

export function placeTutorialLayout(state: RunState): void {
  const { startX, startZ } = state.config;
  addCube(state, startX, startZ, TUTORIAL_A);
  addCube(state, startX - 1, startZ - 1, orientationsWithTop(2)[0]);
}

function topsGrid(state: RunState): number[] {
  const tops = new Array<number>(state.grid.length).fill(0);
  for (const c of state.cubes) {
    if (c.state !== 'sinking') tops[cellIndex(state.config.size, c.x, c.z)] = c.ori.top;
  }
  return tops;
}

/** A cube showing `top` here would join a running chain or trigger Happy One once it rises. */
function wouldReactWithSinking(state: RunState, x: number, z: number, top: number): boolean {
  for (const dir of DIRS) {
    const n = cubeAt(state, x + DELTA[dir].dx, z + DELTA[dir].dz);
    if (n && n.state === 'sinking' && (top === 1 || n.ori.top === top)) return true;
  }
  return false;
}

function isBesidePlayer(state: RunState, x: number, z: number): boolean {
  return Math.abs(x - state.player.x) + Math.abs(z - state.player.z) === 1;
}

/**
 * After the staged first clear: fill the board with rising cubes that cannot clear on
 * their own. The first cube goes next to the player so there is a way off the sinking cube.
 */
export function tutorialRefill(state: RunState): void {
  const size = state.config.size;
  const tops = topsGrid(state);
  let placed = 0;
  for (let attempt = 0; attempt < 400 && placed < state.config.tutorialRefillCubes; attempt++) {
    let cells = freeCells(state).filter((c) => !(c.x === state.player.x && c.z === state.player.z));
    if (placed === 0) {
      const beside = cells.filter((c) => isBesidePlayer(state, c.x, c.z));
      if (beside.length > 0) cells = beside;
    }
    if (cells.length === 0) break;
    const cell = cells[randomInt(state, cells.length)];
    const ori = randomOrientation(state);
    if (wouldReactWithSinking(state, cell.x, cell.z, ori.top)) continue;
    const i = cellIndex(size, cell.x, cell.z);
    tops[i] = ori.top;
    if (hasReadyGroup(tops, size)) {
      tops[i] = 0;
      continue;
    }
    spawnCube(state, cell.x, cell.z, ori);
    placed++;
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

/** Timed spawn. Never queues spawns while the board is full. */
export function runSpawn(state: RunState): void {
  if (!state.spawnEnabled) return;
  const { config, player } = state;
  const free = freeCells(state);
  if (free.length === 0) {
    state.spawnTimer = 0;
    return;
  }
  if (
    config.experiments.gentleStart &&
    state.tick < config.gentleTicks &&
    state.cubes.length >= config.warnOccupied
  ) {
    state.spawnTimer = 0;
    return;
  }
  state.spawnTimer++;
  if (state.spawnTimer < spawnIntervalTicks(config, state.level)) return;
  state.spawnTimer = 0;

  let cell = free[randomInt(state, free.length)];
  const ori = randomOrientation(state);
  if (
    config.experiments.floorLift &&
    player.level === 'ground' &&
    state.groundStreak >= config.floorLiftTicks &&
    isFree(state, player.x, player.z)
  ) {
    cell = { x: player.x, z: player.z };
  }
  spawnCube(state, cell.x, cell.z, ori);
}
