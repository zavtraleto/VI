import type { Cube, Dir, RulesConfig, RunState } from './types';

export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

export const DELTA: Record<Dir, { dx: number; dz: number }> = {
  N: { dx: 0, dz: -1 },
  S: { dx: 0, dz: 1 },
  E: { dx: 1, dz: 0 },
  W: { dx: -1, dz: 0 },
};

export function cellIndex(size: number, x: number, z: number): number {
  return z * size + x;
}

export function inBounds(size: number, x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < size && z < size;
}

export function getCube(state: RunState, id: number): Cube | undefined {
  if (id === 0) return undefined;
  return state.cubes.find((c) => c.id === id);
}

export function cubeAt(state: RunState, x: number, z: number): Cube | undefined {
  const size = state.config.size;
  if (!inBounds(size, x, z)) return undefined;
  return getCube(state, state.grid[cellIndex(size, x, z)]);
}

/** The cell a moving cube is leaving stays reserved until the move completes. */
export function isReserved(state: RunState, x: number, z: number): boolean {
  return state.cubes.some((c) => c.move !== undefined && c.move.fromX === x && c.move.fromZ === z);
}

export function isFree(state: RunState, x: number, z: number): boolean {
  const size = state.config.size;
  return inBounds(size, x, z) && state.grid[cellIndex(size, x, z)] === 0 && !isReserved(state, x, z);
}

export function freeCells(state: RunState): { x: number; z: number }[] {
  const size = state.config.size;
  const cells: { x: number; z: number }[] = [];
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      if (isFree(state, x, z)) cells.push({ x, z });
    }
  }
  return cells;
}

/**
 * Logical height of a cube, 0..1. `alpha` is the fraction of the next tick, used by the
 * renderer only; rule checks always pass 0.
 */
export function cubeHeight(cube: Cube, config: RulesConfig, alpha = 0): number {
  if (cube.state === 'rising') return Math.min(1, (cube.t + alpha) / config.risingTicks);
  if (cube.state === 'sinking') return Math.max(0, 1 - (cube.t + alpha) / config.sinkingTicks);
  return 1;
}

export function neighbours(state: RunState, x: number, z: number): Cube[] {
  const result: Cube[] = [];
  for (const dir of DIRS) {
    const c = cubeAt(state, x + DELTA[dir].dx, z + DELTA[dir].dz);
    if (c) result.push(c);
  }
  return result;
}

/**
 * Closest free cell to (x, z) by grid distance, lowest index winning ties.
 * `skip` names cells that must not be chosen.
 */
export function nearestFree(
  state: RunState,
  x: number,
  z: number,
  skip: readonly { x: number; z: number }[] = [],
): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null;
  let bestDistance = Infinity;
  for (const cell of freeCells(state)) {
    if (skip.some((s) => s.x === cell.x && s.z === cell.z)) continue;
    const distance = Math.abs(cell.x - x) + Math.abs(cell.z - z);
    if (distance < bestDistance) {
      best = cell;
      bestDistance = distance;
    }
  }
  return best;
}
