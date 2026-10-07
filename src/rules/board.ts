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

/**
 * What the grid holds for a cell that is cut out of the board of a level. No die is ever there
 * and it is never free, so to every rule it is what the edge of the board is: nothing is moved
 * onto it and nobody steps there.
 */
export const NO_CELL = -1;

/** Whether (x, z) is a cell of the board: inside its square, and not cut out of it. */
export function isCell(state: RunState, x: number, z: number): boolean {
  const size = state.config.size;
  return inBounds(size, x, z) && state.grid[cellIndex(size, x, z)] !== NO_CELL;
}

export function inBounds(size: number, x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < size && z < size;
}

export function getCube(state: RunState, id: number): Cube | undefined {
  if (id <= 0) return undefined;
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

/** A cube that is coming up or going down and stands no higher than `height`. */
export function isBelow(state: RunState, cube: Cube, height: number): boolean {
  return (cube.state === 'rising' || cube.state === 'sinking') && cubeHeight(cube, state.config) <= height;
}

/** What a cube that moves into a cell does to the low cube that is there. */
export interface Landing {
  /** Low sinking cube in the destination that the moving cube replaces. */
  over?: Cube;
  /** Low rising cube in the destination, and the free cell it is sent to. */
  displaced?: Cube;
  displaceTo?: { x: number; z: number };
}

/**
 * Can a cube move into (x, z)? An empty cell always works. A low sinking cube is replaced;
 * a low rising cube is sent to the nearest free cell, if there is one.
 */
export function landing(state: RunState, x: number, z: number, leaving: { x: number; z: number }[]): Landing | null {
  if (!inBounds(state.config.size, x, z)) return null;
  const occupant = cubeAt(state, x, z);
  if (!occupant) return isFree(state, x, z) ? {} : null;
  if (occupant.state === 'sinking') {
    return isBelow(state, occupant, state.config.sinkLowHeight) ? { over: occupant } : null;
  }
  if (!isBelow(state, occupant, state.config.lowHeight)) return null;
  const displaceTo = nearestFree(state, x, z, leaving);
  return displaceTo ? { displaced: occupant, displaceTo } : null;
}

/** A cube going down as part of a chain: until it is gone, cubes brought to it join the chain. */
export function inChain(cube: Cube): boolean {
  return cube.state === 'sinking' && cube.reactionId !== 0;
}

/**
 * A dock: a free cell beside a cube of a chain that is still open. A die brought there joins
 * the chain. A puzzle has none: nothing joins a finished group there, and it has no floor.
 */
export function isDock(state: RunState, x: number, z: number): boolean {
  return !state.puzzle && isFree(state, x, z) && neighbours(state, x, z).some(inChain);
}

/** What a step from the floor does with the standing cube it is made into. */
export type FloorStep = { kind: 'push'; spot: Landing } | { kind: 'climb'; dock: boolean };

/**
 * A step from the floor at (x, z) into the standing cube beside it in `dir`. A cube with room
 * behind it is pushed; with `floorClimb`, one that cannot be pushed is stepped onto. With
 * `dockSteps` a dock is a step up: from it the cube is stepped onto whether or not it could
 * be pushed. Null when the step cannot be made.
 */
export function floorStep(state: RunState, x: number, z: number, dir: Dir): FloorStep | null {
  const { experiments } = state.config;
  if (experiments.dockSteps && isDock(state, x, z)) return { kind: 'climb', dock: true };
  const tx = x + DELTA[dir].dx;
  const tz = z + DELTA[dir].dz;
  // The cell the pushed cube leaves is where the player steps, so nothing may be sent there.
  const spot = landing(state, tx + DELTA[dir].dx, tz + DELTA[dir].dz, [{ x: tx, z: tz }]);
  if (spot) return { kind: 'push', spot };
  return experiments.floorClimb ? { kind: 'climb', dock: false } : null;
}

/**
 * A dock the player can use with their next step: one beside the sinking cube they are up on,
 * to come down to, or the one they stand on when a standing cube is beside it, to go up
 * from. It is what the board marks more strongly than a dock that only takes a die.
 */
export function isStep(state: RunState, x: number, z: number): boolean {
  if (!state.config.experiments.dockSteps || !isDock(state, x, z)) return false;
  const { player } = state;
  if (player.level === 'top') {
    const beside = Math.abs(player.x - x) + Math.abs(player.z - z) === 1;
    return beside && cubeAt(state, player.x, player.z)?.state === 'sinking';
  }
  return player.x === x && player.z === z && neighbours(state, x, z).some((cube) => cube.state === 'idle');
}
