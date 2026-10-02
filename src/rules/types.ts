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
  /** A chain of two links or more holds regular cubes off while it runs and for a while after. */
  chainCalm: boolean;
}

/** Gameplay variables exposed in the debug panel. Times are in milliseconds. */
export interface Tuning {
  stepMs: number;
  warnMs: number;
  riseMs: number;
  /** Endless: interval at the target number of cubes on levels 1 to 3, its ratio per level, its floor. */
  paceStartMs: number;
  paceRatio: number;
  paceMinMs: number;
  /** Levels in a phase; on the first one the interval goes `breathLevels` back and `calmMs` pass in silence. */
  phaseLevels: number;
  breathLevels: number;
  calmMs: number;
  cubesPerLevel: number;
  /** Silence after a chain for each of its links, and the most a chain can buy. */
  chainCalmMs: number;
  chainCalmMaxMs: number;
  /** Chain window: how long a cleared cube sinks, on the first levels and in the deep. */
  sinkStartMs: number;
  sinkFloorMs: number;
  /** Time Limited: interval at the target at the start and at the end, and the rest between its phases. */
  timedStartMs: number;
  timedEndMs: number;
  timedCalmMs: number;
  startCubes: number;
  lowHeight: number;
  sinkLowHeight: number;
  mountHeight: number;
  stepDownHeight: number;
  chainLift: number;
  chainLiftMin: number;
  feedRate: number;
  liftMs: number;
  gentleSec: number;
  rescueMs: number;
  timedSec: number;
  helpRate: number;
  targetCubes: number;
  /** Interval below the target on the first levels, and from level 15 on. */
  refillMs: number;
  refillEndMs: number;
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
  /**
   * Chain window: how long a cleared cube sinks. A run keeps its own copy of the config and
   * sets this from `sinkStartTicks` and `sinkFloorTicks` as its level changes.
   */
  sinkingTicks: number;
  sinkStartTicks: number;
  sinkFloorTicks: number;
  /** Endless: interval with the target number of cubes in play on levels 1 to 3. */
  paceStartMs: number;
  /** What every further level multiplies that interval by, and the interval it never goes under. */
  paceRatio: number;
  paceMinMs: number;
  /** Levels in a phase. The first level of a new phase is a rest. */
  phaseLevels: number;
  /** Levels the interval goes back by on the first level of a phase. */
  breathLevels: number;
  /** Ticks without regular cubes at the start of a phase. */
  calmTicks: number;
  /** Ticks without regular cubes after a chain for each of its links, and the most it can buy. */
  chainCalmTicks: number;
  chainCalmMaxTicks: number;
  /** Time Limited: interval at the target at the start and at the end of the run. */
  timedStartMs: number;
  timedEndMs: number;
  /** Time Limited: ticks without regular cubes at the start of the second and the third phase. */
  timedCalmTicks: number;
  cubesPerLevel: number;
  warnOccupied: number;
  rescueTicks: number;
  /** Height at or below which a rising cube can be rolled over. */
  lowHeight: number;
  /** Height at or below which a sinking cube is see-through and can be rolled over. */
  sinkLowHeight: number;
  /** Height at or below which a rising/sinking cube can be stepped onto from the ground. */
  mountHeight: number;
  /** Height at or below which the player can step off their sinking cube to the ground. */
  stepDownHeight: number;
  /** Share of its height a chain's cubes come back up by on the first join, and on late ones. */
  chainLift: number;
  chainLiftMin: number;
  /** Share of spawns that come up one move away from a running chain, showing its value. */
  feedRate: number;
  /** Share of spawns that are placed and oriented to be useful, at level 1. */
  helpRate: number;
  /** Cubes in play the board is kept at: below it new cubes come every `refillMs`. */
  targetCubes: number;
  /** Interval below the target on the first levels, and the one it comes down to by level 15. */
  refillMs: number;
  refillEndMs: number;
  /** Spawn interval multiplier on a crowded board. */
  crowdedFactor: number;
  /** Levels over which low face values stop being favoured. */
  easyLevels: number;
  gentleTicks: number;
  /** Length of a Time Limited run. */
  timedTicks: number;
  floorLiftTicks: number;
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
  | { type: 'tutorialStep'; step: number }
  | { type: 'tutorialDone' }
  | { type: 'deadEnd'; reason: DeadEnd } // puzzle: the group just made cannot be followed by a win
  | { type: 'cleared' } // puzzle: the last dice are gone
  | { type: 'gameOver' };

/** What happened on one level of a run. */
export interface LevelStats {
  /** Ticks the level lasted. */
  ticks: number;
  /** Cubes that came up, and cubes that were removed. */
  spawned: number;
  removed: number;
}

export interface RunStats {
  /** Ticks of the first few clears (matches, chain joins, Happy One). */
  clearTicks: number[];
  clears: number;
  /** Most points a single addition to a chain has given. */
  bestChainScore: number;
  blockedSteps: number;
  groundTicks: number;
  falls: number;
  steps: number;
  /** One entry for each level reached, the first level first. */
  levels: LevelStats[];
  /** Ticks with the board at the danger mark: `warnOccupied` cubes or more. */
  dangerTicks: number;
  /** Ticks of the silence a chain is holding now, and the longest one a chain has held. */
  chainQuietTicks: number;
  longestChainQuiet: number;
}

export type RunMode = 'endless' | 'timed' | 'practice' | 'puzzle';

/** A die of a puzzle: its cell and the two faces that fix how it lies. */
export interface PuzzleDie {
  x: number;
  z: number;
  top: number;
  north: number;
}

/** A puzzle as it stands before the first move. */
export interface PuzzleLayout {
  /** Cells along one side of the board. */
  size: number;
  dice: readonly PuzzleDie[];
  /** Cell of the die the player starts on. */
  start: { x: number; z: number };
}

/** Why a finished group leads nowhere: no die next to it to step onto, or one die left over. */
export type DeadEnd = 'noExit' | 'single';

export interface PuzzleState {
  /** Rolls made so far. Steps from die to die are free. */
  moves: number;
  /** Reaction of the group that waits under the player; 0 when there is none. */
  held: number;
  dead: DeadEnd | null;
}

export interface TutorialState {
  /** Index of the current step of the script. */
  step: number;
  /** Ticks spent on the current step, counted while it is a pause. */
  timer: number;
  done: boolean;
  /** Moves of the short way through the part in hand that the player has made, in order. */
  along?: number;
  /** The player has left that short way: the tutorial no longer knows the moves ahead. */
  off?: boolean;
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
  /** Ticks of silence left at the start of a phase: no regular cubes until it runs out. */
  calmLeft: number;
  /** Ticks of silence left after a chain. */
  chainCalmLeft: number;
  /** Ticks on the ground since the fall or since the last lift was sent. */
  liftTimer: number;
  /** Consecutive ticks with every cell occupied. */
  fullTicks: number;
  spawnEnabled: boolean;
  /** Cards left in the decks that decide which spawns feed a running chain and which are helpful. */
  feedDeck: boolean[];
  helpDeck: boolean[];
  tutorial: TutorialState | null;
  /** Set for a puzzle run only. */
  puzzle: PuzzleState | null;
  over: boolean;
  /** Why the run ended: the board stayed full, the Time Limited clock ran out, or a puzzle was cleared. */
  endReason: null | 'full' | 'time' | 'cleared';
  stats: RunStats;
  /** Events produced by the most recent step. */
  events: GameEvent[];
  nextCubeId: number;
  nextReactionId: number;
}
