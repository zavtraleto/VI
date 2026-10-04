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
  | 'descend' // from a sinking cube down to the ground: once it is low, or onto a dock at any height
  | 'walk' // on the ground, into an empty cell
  | 'push' // on the ground, slides a cube without rotation
  | 'mount' // from the ground onto a low rising/sinking cube
  | 'climb'; // from the ground onto a standing cube: one that cannot be pushed, or any one from a dock

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
  /** From the floor, a standing cube that cannot be pushed is stepped onto. */
  floorClimb: boolean;
  floorLift: boolean;
  /**
   * Docks, the free cells beside an open chain, are steps: the player comes down onto one from a
   * sinking cube at any height, and goes up from one onto any standing cube beside it.
   */
  dockSteps: boolean;
  /** A 1 that touches a chain sinks alone instead of taking every other 1 with it. */
  soloOne: boolean;
  /** A chain of two links or more holds regular cubes off while it runs and for a while after, up to a limit. */
  chainCalm: boolean;
  /** Endless: the level rises with the time too, so an unhurried run does not stay on the first levels. */
  timeFloor: boolean;
  /** The flow of cubes comes in waves: it gathers to a crest, breaks into a rest and comes back. */
  waves: boolean;
  /** The crest of a wave is an event: several cubes come at once as the wave breaks. */
  surge: boolean;
  /**
   * Endless: the board a run opens on holds a group of 2s, 3s or 4s that lacks one die, and the
   * die under the player or the one beside it finishes it with one roll, of a face the camera
   * shows. The first success is seconds away for anybody, and not the same one every run.
   */
  opening: boolean;
  /**
   * Past the danger mark the cubes come slower the fuller the board, and a clear made there
   * holds them off for a while: the player stays on the edge longer and gets out more often.
   */
  lastSliver: boolean;
  /**
   * Endless: after cubes that came without a clear, one comes up a roll away from a group that
   * lacks a single die, with the value on a face the camera shows.
   */
  gift: boolean;
}

/** Gameplay variables exposed in the debug panel. Times are in milliseconds. */
export interface Tuning {
  stepMs: number;
  warnMs: number;
  riseMs: number;
  /**
   * Endless: interval at the target number of cubes on the first levels, how many they are, the
   * share of the starting flow that every further level adds, and the interval's floor.
   */
  paceStartMs: number;
  paceFlatLevels: number;
  paceGrowth: number;
  paceMinMs: number;
  /**
   * Waves: how long one gathers on average, in seconds; how much the lengths of waves and rests
   * differ, as a share; what the interval is multiplied by where a wave opens and at its crest;
   * the trough after the crest, on average, and the share of the level's flow that comes in it
   * (0 makes the trough a silence).
   */
  waveSec: number;
  waveSpread: number;
  waveEase: number;
  wavePeak: number;
  restMs: number;
  restFlow: number;
  cubesPerLevel: number;
  /** Endless: seconds of play that raise the level by one, whatever has been removed. */
  levelSec: number;
  /** Silence after a chain for each of its links, and the longest silence chains hold in one stretch. */
  chainCalmMs: number;
  chainCalmMaxMs: number;
  /** Chain window: how long a cleared cube sinks, on the first levels and in the deep. */
  sinkStartMs: number;
  sinkFloorMs: number;
  /** Time Limited: interval at the target at the start and at the end. */
  timedStartMs: number;
  timedEndMs: number;
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
  /** The crest of a wave: cubes that come at once on the first waves, and the most they grow to. */
  surgeCubes: number;
  surgeMax: number;
  /** The big breather: after how many waves a trough is a long one (0 for never), and how many times longer. */
  breatherEvery: number;
  breatherFactor: number;
  /** Points for a clear that leaves no die standing, for every level of the run; 0 gives none. */
  wipeBonus: number;
  /** The last sliver: interval multiplier on a full board, and the silence a clear at the danger mark holds. */
  edgeFactor: number;
  edgeCalmMs: number;
  /** A gift: the chance of one that every cube come without a clear adds, and the most it gets to. */
  giftRate: number;
  giftMax: number;
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
  /** Endless: interval with the target number of cubes in play on the first levels, and how many of them hold it. */
  paceStartMs: number;
  paceFlatLevels: number;
  /** The share of the starting flow of cubes that every further level adds, and the interval it never goes under. */
  paceGrowth: number;
  paceMinMs: number;
  /** Ticks a wave gathers for and ticks it rests for, on average, and the share by which waves differ. */
  waveTicks: number;
  restTicks: number;
  waveSpread: number;
  /** What a wave multiplies the interval by where it opens and at its crest. */
  waveEase: number;
  wavePeak: number;
  /** The share of the level's flow that comes in the trough after a crest; 0 makes it a silence. */
  restFlow: number;
  /** Cubes that come at once at the crest of the first waves, and the most the salvo grows to. */
  surgeCubes: number;
  surgeMax: number;
  /** Waves to a long trough, 0 for none, and how many times longer than a usual one it is. */
  breatherEvery: number;
  breatherFactor: number;
  /** Points for a clear that leaves no die standing, for every level of the run. */
  wipeBonus: number;
  /**
   * Ticks without regular cubes after a chain for each of its links, and the longest silence
   * chains can hold in one stretch, while they run and after.
   */
  chainCalmTicks: number;
  chainCalmMaxTicks: number;
  /** Time Limited: interval at the target at the start and at the end of the run. */
  timedStartMs: number;
  timedEndMs: number;
  cubesPerLevel: number;
  /** Endless: ticks of play that raise the level by one, with `timeFloor`. */
  levelTicks: number;
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
  /** Spawn interval multiplier on a full board: past the danger mark the interval grows from the crowded one to this. */
  edgeFactor: number;
  /** Ticks without regular cubes after a clear made with the board at the danger mark. */
  edgeCalmTicks: number;
  /** Chance of a gift that every cube come without a clear adds, and the most the chance gets to. */
  giftRate: number;
  giftMax: number;
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
  | { type: 'wiped'; points: number } // a clear left no die standing: the board is clean
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
  | { type: 'levelPassed' } // level: its goal is met
  | { type: 'levelFailed' } // level: its moves are spent with the goal not met, or its board is at a dead end
  | { type: 'gameOver' };

/** What happened on one level of a run. */
export interface LevelStats {
  /** Ticks the level lasted. */
  ticks: number;
  /** Cubes that came up, and cubes that were removed. */
  spawned: number;
  removed: number;
}

/** A wave of the pace: the flow of cubes gathers for `build` ticks from `start`, then holds off for `rest`. */
export interface Wave {
  index: number;
  start: number;
  build: number;
  rest: number;
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
  /** Steps from the plain floor up onto a standing cube that could not be pushed. */
  floorClimbs: number;
  /** Steps from a sinking cube down onto a dock, and from a dock up onto a standing cube. */
  dockDescents: number;
  dockClimbs: number;
  /** Gifts that came: cubes a roll away from finishing a group. */
  gifts: number;
  /** Times a clear left no die standing. */
  wipes: number;
  /** One entry for each level reached, the first level first. */
  levels: LevelStats[];
  /** Ticks with the board at the danger mark: `warnOccupied` cubes or more. */
  dangerTicks: number;
  /** Ticks of the silence a chain is holding now, and the longest one a chain has held. */
  chainQuietTicks: number;
  longestChainQuiet: number;
}

export type RunMode = 'endless' | 'timed' | 'practice' | 'puzzle' | 'level';

/**
 * What a level asks for: dice sent, of any face or of faces ordered; a chain of so many links;
 * or a board with no die left standing.
 */
export type LevelGoal =
  | { kind: 'send'; count: number }
  | { kind: 'order'; items: readonly { value: number; count: number }[] }
  | { kind: 'chain'; links: number }
  | { kind: 'clear' };

/** The dice of a level as they are given, and the cell of the die the player starts on. */
export interface LevelLayout {
  dice: readonly PuzzleDie[];
  start: { x: number; z: number };
}

/**
 * What a way through a level can lean on: a die brought to a group that is going, a roll over a
 * die that is going, a step down to the floor, and the 1s that go together.
 */
export type Technique = 'link' | 'glass' | 'floor' | 'ones';

/** A level as it is given: a board, its dice, whether more of them come, a goal and the moves to meet it in. */
export interface LevelSpec {
  id: string;
  seed: number;
  size: number;
  goal: LevelGoal;
  /** Limit of moves; 0 for none. */
  moves: number;
  /** Top faces the dice start and arrive with. */
  values: readonly number[];
  /** Dice the board starts with; with `refill`, the number it is kept at. */
  norm: number;
  /** Whether dice come: `none`, or `refill` back to `norm`, one a beat. */
  arrival: 'none' | 'refill';
  /** Share of the dice that come for a running chain; the rules' own when left out. */
  feedRate?: number;
  helpRate?: number;
  sinkMoves?: number;
  liftMoves?: number;
  /** The board as given; when present, nothing is laid from the seed. */
  layout?: LevelLayout;
  /** Moves that may be taken back in one try. */
  undos?: number;
  /** Key of the line the level teaches with. */
  lesson?: string;
  /** The first roll, shown on the board until it is made. */
  arrow?: Dir;
  /** Fewest moves the board is known to be cleared in, whether that is proved the fewest, and one way to do it. */
  par?: number;
  exact?: boolean;
  /** A move is `x,z,D`: the cell of the die before the move and the side it goes to; a push is `x,z,D,p`. */
  solution?: readonly string[];
}

/** What a line of a goal counts: dice of any face, dice of one face, links of a chain, dice cleared off the board. */
export type GoalWhat = 'dice' | 'face' | 'links' | 'cleared';

/** A line of the goal of a level: how much of it there is and how much is asked for. `value` is the face of a `face` line. */
export interface GoalLine {
  what: GoalWhat;
  value: number;
  have: number;
  need: number;
}

export interface LevelRun {
  spec: LevelSpec;
  /** Rolls and pushes made. */
  moves: number;
  /** Dice sent, by top value: index 0 is the 1. */
  sent: number[];
  bestChain: number;
  /** World ticks left of a beat the world plays by itself. */
  beat: number;
}

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
  /** The wave of the pace the run is on. */
  wave: Wave;
  /** Ticks of silence left after a chain. */
  chainCalmLeft: number;
  /**
   * Ticks of silence chains have held in one stretch. At the limit the noise comes back, and
   * stays until no chain asks for silence: only the next chain buys it anew.
   */
  chainQuietSpent: number;
  /** Ticks of silence left after a clear made at the danger mark. */
  edgeCalmLeft: number;
  /** That silence has been held in this stay at the danger mark: the next one takes getting out and coming back. */
  edgeCalmSpent: boolean;
  /** Regular cubes that have come since the last clear: the longer the drought, the likelier a gift. */
  sinceClear: number;
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
  /** Set for a level only. */
  levelRun: LevelRun | null;
  over: boolean;
  /**
   * Why the run ended: the board stayed full, the Time Limited clock ran out, a puzzle was
   * cleared, or a level was passed or failed.
   */
  endReason: null | 'full' | 'time' | 'cleared' | 'passed' | 'failed';
  stats: RunStats;
  /** Events produced by the most recent step. */
  events: GameEvent[];
  nextCubeId: number;
  nextReactionId: number;
}
