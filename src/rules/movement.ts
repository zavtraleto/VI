import { DELTA, cellIndex, cubeAt, cubeHeight, floorStep, inBounds, isBelow, isDock, isFree, landing, type Landing } from './board';
import { roll } from './orientation';
import { puzzleBusy } from './puzzle';
import { removeCube } from './reactions';
import type { Cube, Dir, Level, MoveKind, Orientation, RunState } from './types';

/** A step and, when a cube rolls or slides with it, what that cube does where it lands. */
export interface MoveIntent extends Landing {
  kind: MoveKind | 'blocked';
  /** Cell the player ends up in. */
  tx: number;
  tz: number;
  /** Cube that rolls or slides, with its destination and resulting orientation. */
  cube?: Cube;
  cubeX?: number;
  cubeZ?: number;
  newOri?: Orientation;
  /** The step is one a dock gives: down onto it, or up from it onto a standing cube. */
  dock?: boolean;
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
  if (state.over || puzzleBusy(state)) return false;
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
    if (own.state === 'idle') {
      const spot = landing(state, tx, tz, []);
      // A puzzle die rolls into an empty cell only: nothing is rolled over.
      const plain = spot !== null && !spot.over && !spot.displaced;
      if (spot && (plain || !state.puzzle)) {
        return { kind: 'roll', tx, tz, cube: own, cubeX: tx, cubeZ: tz, newOri: roll(own.ori, dir), ...spot };
      }
    }
    if (target) {
      // Glass does not hold: in a session a cube that is coming up stops a step no more than
      // one that stands or goes down. A whole cube has rolled into its cell above and sent it
      // away; where that could not be, with no free cell to send it to, it is stepped onto.
      // On a level a whole cube is stopped by it as before: the rules of a level are frozen.
      const standing = target.state === 'idle' || target.state === 'sinking';
      const reachable = standing || (target.state === 'rising' && (own.state !== 'idle' || !state.levelRun));
      return reachable ? { kind: 'hop', tx, tz } : blocked;
    }
    if (!isFree(state, tx, tz)) return blocked;
    // A level may shut its floor: the player stays on the dice until the floor has been taught.
    if (state.levelRun?.spec.floor === false) return blocked;
    // Glass does not hold: in a session a cube that is coming up is stepped off like one that
    // is going down. On a level it is not: there it comes up under the player (`stepLevel`).
    // A whole cube is never stepped off: it rolls.
    // In a puzzle there is no floor to stand on: the player stays on the dice.
    const leaves = own.state === 'sinking' || (own.state === 'rising' && !state.levelRun);
    if (state.puzzle || !leaves) return blocked;
    // A dock is a step: the player comes down onto it from any height. So they do onto any
    // other empty cell as the game is set; with `stepDownHeight` tuned lower it waits until
    // the cube is that low.
    if (config.experiments.dockSteps && isDock(state, tx, tz)) return { kind: 'descend', tx, tz, dock: true };
    return cubeHeight(own, config) <= config.stepDownHeight ? { kind: 'descend', tx, tz } : blocked;
  }

  if (!target) {
    return isFree(state, tx, tz) ? { kind: 'walk', tx, tz } : blocked;
  }
  if (target.state === 'idle') {
    const into = floorStep(state, player.x, player.z, dir);
    if (!into) return blocked;
    if (into.kind === 'climb') return into.dock ? { kind: 'climb', tx, tz, dock: true } : { kind: 'climb', tx, tz };
    return { kind: 'push', tx, tz, cube: target, cubeX: tx + dx, cubeZ: tz + dz, newOri: target.ori, ...into.spot };
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
  if (state.puzzle && intent.kind === 'roll') state.puzzle.moves++;
  state.stats.steps++;
  // The ways between the floor and the cubes, for the report of the run.
  if (intent.kind === 'climb') state.stats[intent.dock ? 'dockClimbs' : 'floorClimbs']++;
  else if (intent.kind === 'descend' && intent.dock) state.stats.dockDescents++;
  state.events.push({ type: 'move', kind: intent.kind, dir });
  return true;
}
