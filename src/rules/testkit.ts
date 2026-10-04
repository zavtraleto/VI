import { defaultConfig } from './config';
import { ALL_ORIENTATIONS } from './orientation';
import { resolveLanded } from './reactions';
import { createRun, step } from './sim';
import { addCube } from './spawn';
import type { Cube, CubeState, Dir, ExperimentConfig, Level, LevelSpec, Orientation, RunState, Tuning } from './types';

/**
 * Empty board, timed spawning off, the pace even with no waves, no salvos and no gifts, no
 * points for a clean board unless the tuning asks for them, player on the ground at the start cell.
 */
export function emptyRun(experiments: Partial<ExperimentConfig> = {}, seed = 1, tuning: Partial<Tuning> = {}): RunState {
  const quiet = { floorLift: false, gentleStart: false, waves: false, surge: false, gift: false };
  const state = createRun({ seed, config: defaultConfig({ ...quiet, ...experiments }, tuning), empty: true });
  state.spawnEnabled = false;
  // A test board is a few cubes: clearing them all would be a clean board every time.
  if (tuning.wipeBonus === undefined) state.config.wipeBonus = 0;
  return state;
}

/**
 * The empty board of a level, five cells a side, with the player on the floor in the middle.
 * Nothing comes to it and it has no goal to meet or moves to run out of, unless `spec` says so.
 */
export function levelRun(spec: Partial<LevelSpec> = {}): RunState {
  const level: LevelSpec = { id: 'test', seed: 1, size: 5, goal: { kind: 'send', count: 999 }, moves: 0, values: [2, 3], norm: 0, arrival: 'refill', ...spec };
  return createRun({ seed: level.seed, config: defaultConfig(), level, empty: true });
}

/** First orientation matching every given face. */
export function ori(faces: Partial<Orientation>): Orientation {
  const found = ALL_ORIENTATIONS.find((o) =>
    (Object.keys(faces) as (keyof Orientation)[]).every((k) => o[k] === faces[k]),
  );
  if (!found) throw new Error(`no orientation for ${JSON.stringify(faces)}`);
  return found;
}

export function put(state: RunState, x: number, z: number, top: number, cubeState: CubeState = 'idle'): Cube {
  return addCube(state, x, z, ori({ top }), cubeState);
}

export function putOri(state: RunState, x: number, z: number, faces: Partial<Orientation>): Cube {
  return addCube(state, x, z, ori(faces));
}

export function place(state: RunState, x: number, z: number, level: Level): void {
  state.player = { x, z, level };
}

export function run(state: RunState, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(state, null);
}

/** Issues a command and runs until the action has completed. */
export function act(state: RunState, dir: Dir): boolean {
  const accepted = step(state, dir);
  run(state, state.config.actionTicks);
  return accepted;
}

/** Resolves `cube` as if the player had just moved it into place. */
export function land(state: RunState, cube: Cube): void {
  state.events = [];
  resolveLanded(state, cube);
}

/** State without per-tick bookkeeping, for "nothing changed" comparisons. */
export function snapshot(state: RunState): string {
  const { events: _e, stats: _s, tick: _t, liftTimer: _l, ...rest } = state;
  return JSON.stringify(rest);
}
