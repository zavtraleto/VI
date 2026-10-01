import { DELTA, cellIndex, cubeAt, cubeHeight, inBounds, isFree, nearestFree } from './board';
import { roll } from './orientation';
import { removeCube } from './reactions';
import type { Cube, Dir, Level, MoveKind, Orientation, RunState } from './types';

export interface MoveIntent {
  kind: MoveKind | 'blocked';
  /** Cell the player ends up in. */
  tx: number;
  tz: number;
  /** Cube that rolls or slides, with its destination and resulting orientation. */
  cube?: Cube;
  cubeX?: number;
  cubeZ?: number;
  newOri?: Orientation;
  /** Low sinking cube in the destination that the moving cube replaces. */
  over?: Cube;
  /** Low rising cube in the destination, and the free cell it is sent to. */
  displaced?: Cube;
  displaceTo?: { x: number; z: number };
}

const LEVEL_AFTER: Record<MoveKind, Level> = {
  roll: 'top',
  hop: 'top',
  mount: 'top',
  climb: 'top',
  descend: 'ground',
  walk: 'ground',
  push: 'ground',
};

export function canAcceptCommand(state: RunState): boolean {
  if (state.over) return false;
  const action = state.player.action;
  return action === undefined || action.t + 1 >= state.config.actionTicks;
}

function isBelow(state: RunState, cube: Cube, height: number): boolean {
  return (cube.state === 'rising' || cube.state === 'sinking') && cubeHeight(cube, state.config) <= height;
}

/**
 * Can a cube move into (x, z)? An empty cell always works. A low sinking cube is replaced;
 * a low rising cube is sent to the nearest free cell, if there is one.
 */
function landing(
  state: RunState,
  x: number,
  z: number,
  leaving: { x: number; z: number }[],
): Pick<MoveIntent, 'over' | 'displaced' | 'displaceTo'> | null {
  if (!inBounds(state.config.size, x, z)) return null;
  const occupant = cubeAt(state, x, z);
  if (!occupant) return isFree(state, x, z) ? {} : null;
  if (!isBelow(state, occupant, state.config.lowHeight)) return null;
  if (occupant.state === 'sinking') return { over: occupant };
  const displaceTo = nearestFree(state, x, z, leaving);
  return displaceTo ? { displaced: occupant, displaceTo } : null;
}

/** Decides what a step in `dir` would do, without changing anything. */
export function resolveMove(state: RunState, dir: Dir): MoveIntent {
  const { config, player } = state;
  const { dx, dz } = DELTA[dir];
  const tx = player.x + dx;
  const tz = player.z + dz;
  const blocked: MoveIntent = { kind: 'blocked', tx: player.x, tz: player.z };
  if (!inBounds(config.size, tx, tz)) return blocked;

  const target = cubeAt(state, tx, tz);

  if (player.level === 'top') {
    const own = cubeAt(state, player.x, player.z);
    if (!own) return blocked;
    if (own.state === 'idle') {
      const spot = landing(state, tx, tz, []);
      if (spot) return { kind: 'roll', tx, tz, cube: own, cubeX: tx, cubeZ: tz, newOri: roll(own.ori, dir), ...spot };
    }
    if (target) {
      return target.state === 'idle' || target.state === 'sinking' ? { kind: 'hop', tx, tz } : blocked;
    }
    if (!isFree(state, tx, tz)) return blocked;
    // Only a sinking cube can be stepped off: a rising one is the way back up, so the
    // player cannot fall off it by accident.
    const canStepDown = own.state === 'sinking' && cubeHeight(own, config) <= config.stepDownHeight;
    return canStepDown ? { kind: 'descend', tx, tz } : blocked;
  }

  if (!target) {
    return isFree(state, tx, tz) ? { kind: 'walk', tx, tz } : blocked;
  }
  if (target.state === 'idle') {
    const bx = tx + dx;
    const bz = tz + dz;
    // The cell the pushed cube leaves is where the player steps, so nothing may be sent there.
    const spot = landing(state, bx, bz, [{ x: tx, z: tz }]);
    if (spot) return { kind: 'push', tx, tz, cube: target, cubeX: bx, cubeZ: bz, newOri: target.ori, ...spot };
    return config.experiments.floorClimb ? { kind: 'climb', tx, tz } : blocked;
  }
  return isBelow(state, target, config.mountHeight) ? { kind: 'mount', tx, tz } : blocked;
}

/** Executes a step command. Returns false when the step is blocked. */
export function applyMove(state: RunState, dir: Dir): boolean {
  const intent = resolveMove(state, dir);
  if (intent.kind === 'blocked') {
    state.stats.blockedSteps++;
    state.events.push({ type: 'blocked', dir });
    return false;
  }

  const { config, player } = state;
  player.action = {
    kind: intent.kind,
    fromX: player.x,
    fromZ: player.z,
    fromLevel: player.level,
    dir,
    t: 0,
  };

  const cube = intent.cube;
  if (cube && intent.cubeX !== undefined && intent.cubeZ !== undefined && intent.newOri) {
    const over = intent.over ? { value: intent.over.ori.top, reactionId: intent.over.reactionId } : undefined;
    if (intent.over) removeCube(state, intent.over);
    if (intent.displaced && intent.displaceTo) {
      const moved = intent.displaced;
      state.grid[cellIndex(config.size, moved.x, moved.z)] = 0;
      // It keeps rising from where it had got to; only the cell changes.
      moved.x = intent.displaceTo.x;
      moved.z = intent.displaceTo.z;
      state.grid[cellIndex(config.size, moved.x, moved.z)] = moved.id;
      state.events.push({ type: 'displaced', cubeId: moved.id });
    }
    state.grid[cellIndex(config.size, cube.x, cube.z)] = 0;
    cube.move = {
      fromX: cube.x,
      fromZ: cube.z,
      dir,
      kind: intent.kind === 'roll' ? 'roll' : 'slide',
      prevOri: cube.ori,
      over,
    };
    cube.x = intent.cubeX;
    cube.z = intent.cubeZ;
    cube.ori = intent.newOri;
    cube.state = 'moving';
    cube.t = 0;
    state.grid[cellIndex(config.size, cube.x, cube.z)] = cube.id;
  }

  player.x = intent.tx;
  player.z = intent.tz;
  player.level = LEVEL_AFTER[intent.kind];
  state.stats.steps++;
  state.events.push({ type: 'move', kind: intent.kind, dir });
  return true;
}
