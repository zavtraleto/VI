export type Dir = 'N' | 'S' | 'E' | 'W';

export interface Orientation {
  top: number;
  bottom: number;
  north: number;
  south: number;
  east: number;
  west: number;
}

export type CubeState = 'rising' | 'idle' | 'moving' | 'sinking';
export type Level = 'top' | 'ground';

/** What a single step command turns into. */
export type MoveKind =
  | 'roll' // on a cube, into an empty cell or over a low cube: cube rotates, player rides
  | 'hop' // on a cube, onto a neighbouring cube
  | 'descend' // from a sinking cube down to the ground
  | 'walk' // on the ground, into an empty cell
  | 'push' // on the ground, slides a cube without rotation
  | 'mount' // from the ground onto a low rising/sinking cube
  | 'climb'; // experiment: from the ground onto a cube that cannot be pushed

/** A low sinking cube that the moving cube rolled or slid over. */
export interface Overrun {
  value: number;
  reactionId: number;
}

export interface CubeMove {
  fromX: number;
  fromZ: number;
  dir: Dir;
  kind: 'roll' | 'slide';
  prevOri: Orientation;
  over?: Overrun;
}

export interface Cube {
  id: number;
  /** Logical cell. While moving this is already the destination. */
  x: number;
  z: number;
  /** Orientation after the current move completes. */
  ori: Orientation;
  state: CubeState;
  /** Ticks spent in the current timed state (rising, moving, sinking). */
  t: number;
  move?: CubeMove;
  /** 0 when the cube is not part of a chain reaction. */
  reactionId: number;
}

export interface PlayerAction {
  kind: MoveKind;
  fromX: number;
  fromZ: number;
  fromLevel: Level;
  dir: Dir;
  t: number;
}

export interface Player {
  /** Logical cell. While acting this is already the destination. */
  x: number;
  z: number;
  level: Level;
  action?: PlayerAction;
}

export interface Reaction {
  id: number;
  value: number;
  chain: number;
  /** Unique participants over the whole life of the reaction. */
  total: number;
}

/** A cube that has been announced on a cell and will start rising when the warning ends. */
export interface PendingSpawn {
  x: number;
  z: number;
  ori: Orientation;
  t: number;
}

export interface ExperimentConfig {
  guidedStart: boolean;
  gentleStart: boolean;
  boardPreview: boolean;
  matchHint: boolean;
  floorClimb: boolean;
  floorLift: boolean;
  /** A 1 that touches a chain sinks alone instead of taking every other 1 with it. */
  soloOne: boolean;
}

/** Gameplay variables exposed in the debug panel. Times are in milliseconds. */
export interface Tuning {
  stepMs: number;
  warnMs: number;
  riseMs: number;
  sinkMs: number;
  spawnStartMs: number;
  spawnStepMs: number;
  spawnMinMs: number;
  cubesPerLevel: number;
  startCubes: number;
  lowHeight: number;
  mountHeight: number;
  stepDownHeight: number;
  liftMs: number;
  gentleSec: number;
  rescueMs: number;
  timedSec: number;
  helpRate: number;
  sparseFactor: number;
  crowdedFactor: number;
  easyLevels: number;
}

export interface RulesConfig {
  rulesVersion: string;
  size: number;
  tickMs: number;
  startCubes: number;
  startX: number;
  startZ: number;
  actionTicks: number;
  /** Warning shown on a cell before a cube starts rising there. */
  warnTicks: number;
  risingTicks: number;
  sinkingTicks: number;
  spawnIntervalMs: number;
  spawnStepMs: number;
  spawnMinMs: number;
  cubesPerLevel: number;
  warnOccupied: number;
  rescueTicks: number;
  /** Height at or below which a rising/sinking cube can be rolled over. */
  lowHeight: number;
  /** Height at or below which a rising/sinking cube can be stepped onto from the ground. */
  mountHeight: number;
  /** Height at or below which the player can step off their sinking cube to the ground. */
  stepDownHeight: number;
  /** Share of spawns that are placed and oriented to be useful, at level 1. */
  helpRate: number;
  /** Spawn interval multiplier on a nearly empty board and on a crowded one. */
  sparseFactor: number;
  crowdedFactor: number;
  /** Levels over which low face values stop being favoured. */
  easyLevels: number;
  gentleTicks: number;
  /** Length of a Time Limited run. */
  timedTicks: number;
  floorLiftTicks: number;
  /** Pause between the last move of the tutorial and its end. */
  tutorialEndTicks: number;
  /** True when any tuning value differs from the defaults. */
  custom: boolean;
  experiments: ExperimentConfig;
}

export type GameEvent =
  | { type: 'move'; kind: MoveKind; dir: Dir }
  | { type: 'blocked'; dir: Dir }
  | { type: 'landed' } // a cube finished rolling or sliding
  | { type: 'match'; reactionId: number; value: number; count: number; points: number }
  | { type: 'chain'; reactionId: number; value: number; chain: number; count: number; points: number }
  | { type: 'happyOne'; count: number; points: number }
  | { type: 'warned'; x: number; z: number } // a cube was announced on a cell
  | { type: 'spawn'; cubeId: number }
  | { type: 'risen'; cubeId: number }
  | { type: 'removed'; cubeId: number }
  | { type: 'displaced'; cubeId: number } // a low rising cube was rolled over and moved away
  | { type: 'fell' } // the cube under the player was removed
  | { type: 'lifted' } // a cube appeared under the player on the ground
  | { type: 'levelUp'; level: number }
  | { type: 'nudge'; dir: Dir } // tutorial: a step off the script was ignored
  | { type: 'tutorialStep'; step: number }
  | { type: 'tutorialDone' }
  | { type: 'gameOver' };

export interface RunStats {
  /** Ticks of the first few clears (matches, chain joins, Happy One). */
  clearTicks: number[];
  clears: number;
  blockedSteps: number;
  groundTicks: number;
  falls: number;
  steps: number;
}

export type RunMode = 'endless' | 'timed' | 'practice';

export interface TutorialState {
  /** Scripted moves made so far. */
  step: number;
  /** Ticks since the last scripted move; runs once the script is complete. */
  timer: number;
  done: boolean;
}

export interface RunState {
  config: RulesConfig;
  mode: RunMode;
  seed: number;
  tick: number;
  rng: number;
  cubes: Cube[];
  /** size*size cells holding a cube id, or 0. */
  grid: number[];
  reactions: Reaction[];
  pending: PendingSpawn[];
  player: Player;
  score: number;
  level: number;
  removed: number;
  maxChain: number;
  spawnTimer: number;
  /** Ticks on the ground since the fall or since the last lift was sent. */
  liftTimer: number;
  /** Consecutive ticks with every cell occupied. */
  fullTicks: number;
  spawnEnabled: boolean;
  tutorial: TutorialState | null;
  over: boolean;
  /** Why the run ended: the board stayed full, or the Time Limited clock ran out. */
  endReason: null | 'full' | 'time';
  stats: RunStats;
  /** Events produced by the most recent step. */
  events: GameEvent[];
  nextCubeId: number;
  nextReactionId: number;
}
