import { DELTA, cellIndex, cubeAt, cubeHeight, inBounds, isFree } from './board';
import { roll } from './orientation';
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
    if (target) {
      if (target.state === 'idle' || target.state === 'sinking') return { kind: 'hop', tx, tz };
      return blocked;
    }
    if (!isFree(state, tx, tz)) return blocked;
    if (own.state === 'idle') {
      return { kind: 'roll', tx, tz, cube: own, cubeX: tx, cubeZ: tz, newOri: roll(own.ori, dir) };
    }
    if (cubeHeight(own, config) <= config.lowHeight) return { kind: 'descend', tx, tz };
    return blocked;
  }

  if (!target) {
    return isFree(state, tx, tz) ? { kind: 'walk', tx, tz } : blocked;
  }
  if (target.state === 'idle') {
    const bx = tx + dx;
    const bz = tz + dz;
    if (isFree(state, bx, bz)) {
      return { kind: 'push', tx, tz, cube: target, cubeX: bx, cubeZ: bz, newOri: target.ori };
    }
    return config.experiments.floorClimb ? { kind: 'climb', tx, tz } : blocked;
  }
  if (target.state === 'rising' || target.state === 'sinking') {
    return cubeHeight(target, config) <= config.lowHeight ? { kind: 'mount', tx, tz } : blocked;
  }
  return blocked;
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
    state.grid[cellIndex(config.size, cube.x, cube.z)] = 0;
    cube.move = {
      fromX: cube.x,
      fromZ: cube.z,
      dir,
      kind: intent.kind === 'roll' ? 'roll' : 'slide',
      prevOri: cube.ori,
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
