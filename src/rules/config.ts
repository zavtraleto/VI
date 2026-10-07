import type { ExperimentConfig, RulesConfig, RunMode, Tuning } from './types';

export const TICK_MS = 20;

export function msToTicks(ms: number): number {
  return Math.max(1, Math.round(ms / TICK_MS));
}

/** The version of the rules. Records of another version are kept apart. */
export const RULES_VERSION = '0.9';

export function defaultExperiments(): ExperimentConfig {
  return {
    guidedStart: true,
    gentleStart: true,
    boardPreview: false,
    matchHint: false,
    floorClimb: true,
    floorLift: true,
    dockSteps: true,
    soloOne: false,
    chainCalm: true,
    timeFloor: true,
    waves: true,
    surge: true,
    opening: true,
    lastSliver: true,
    gift: true,
  };
}

/**
 * An unhurried pace that does not stay quiet for long: the first level is time to read the
 * board, and from the second the pressure builds. It comes in waves: tension, a rest, more
 * tension. Only the flow of cubes grows with the level; the player's step, the warning and
 * the rise never speed up.
 */
export const DEFAULT_TUNING: Readonly<Tuning> = {
  stepMs: 200,
  warnMs: 1000,
  riseMs: 3000,
  paceStartMs: 5000,
  paceFlatLevels: 1,
  paceGrowth: 0.1,
  paceMinMs: 500,
  waveSec: 40,
  waveSpread: 0.35,
  waveEase: 1.2,
  wavePeak: 0.75,
  restMs: 10000,
  restFlow: 0.5,
  surgeCubes: 2,
  surgeMax: 4,
  breatherEvery: 4,
  breatherFactor: 2.5,
  wipeBonus: 100,
  cubesPerLevel: 16,
  levelSec: 40,
  chainCalmMs: 800,
  chainCalmMaxMs: 8000,
  sinkStartMs: 10000,
  sinkFloorMs: 7000,
  timedStartMs: 3000,
  timedEndMs: 1500,
  startCubes: 10,
  // Glass does not hold: a cube that comes or goes is rolled over, mounted and stepped off at any height.
  lowHeight: 1,
  sinkLowHeight: 1,
  mountHeight: 1,
  stepDownHeight: 1,
  chainLift: 0.25,
  chainLiftMin: 0.1,
  feedRate: 0.4,
  liftMs: 3000,
  gentleSec: 180,
  rescueMs: 3000,
  timedSec: 180,
  helpRate: 0.65,
  targetCubes: 14,
  refillMs: 2200,
  refillEndMs: 1000,
  crowdedFactor: 1.2,
  easyLevels: 6,
  edgeFactor: 1.5,
  edgeCalmMs: 2500,
  giftRate: 0.08,
  giftMax: 0.4,
};

/** Slider limits for the debug panel: [min, max, step]. */
export const TUNING_RANGES: Readonly<Record<keyof Tuning, readonly [number, number, number]>> = {
  stepMs: [100, 400, 20],
  warnMs: [0, 3000, 100],
  riseMs: [400, 6000, 100],
  paceStartMs: [1000, 15000, 250],
  paceFlatLevels: [1, 10, 1],
  paceGrowth: [0, 0.3, 0.005],
  paceMinMs: [300, 5000, 100],
  waveSec: [10, 180, 5],
  waveSpread: [0, 0.9, 0.05],
  waveEase: [1, 2, 0.05],
  wavePeak: [0.3, 1, 0.05],
  restMs: [0, 20000, 500],
  restFlow: [0, 1, 0.05],
  surgeCubes: [0, 6, 1],
  surgeMax: [0, 8, 1],
  breatherEvery: [0, 12, 1],
  breatherFactor: [1, 5, 0.25],
  wipeBonus: [0, 1000, 10],
  cubesPerLevel: [5, 60, 1],
  levelSec: [10, 300, 5],
  chainCalmMs: [0, 5000, 100],
  chainCalmMaxMs: [0, 20000, 500],
  sinkStartMs: [1000, 15000, 250],
  sinkFloorMs: [1000, 15000, 250],
  timedStartMs: [500, 8000, 100],
  timedEndMs: [300, 8000, 100],
  startCubes: [2, 30, 1],
  lowHeight: [0.1, 0.9, 0.05],
  sinkLowHeight: [0.1, 1, 0.05],
  mountHeight: [0.1, 1, 0.05],
  stepDownHeight: [0.1, 1, 0.05],
  chainLift: [0, 0.6, 0.05],
  chainLiftMin: [0, 0.6, 0.05],
  feedRate: [0, 1, 0.2],
  liftMs: [500, 10000, 250],
  gentleSec: [0, 600, 15],
  rescueMs: [1000, 10000, 500],
  timedSec: [30, 600, 15],
  helpRate: [0, 1, 0.05],
  targetCubes: [0, 30, 1],
  refillMs: [300, 5000, 100],
  refillEndMs: [300, 5000, 100],
  crowdedFactor: [1, 2, 0.05],
  easyLevels: [1, 15, 1],
  edgeFactor: [1, 5, 0.1],
  edgeCalmMs: [0, 10000, 250],
  giftRate: [0, 1, 0.02],
  giftMax: [0, 1, 0.05],
};

export function isCustomTuning(tuning: Partial<Tuning>): boolean {
  return (Object.keys(DEFAULT_TUNING) as (keyof Tuning)[]).some(
    (key) => tuning[key] !== undefined && tuning[key] !== DEFAULT_TUNING[key],
  );
}

export function defaultConfig(experiments: Partial<ExperimentConfig> = {}, tuning: Partial<Tuning> = {}): RulesConfig {
  const exp = { ...defaultExperiments(), ...experiments };
  const t = { ...DEFAULT_TUNING, ...tuning };
  return {
    rulesVersion: RULES_VERSION,
    size: 7,
    tickMs: TICK_MS,
    startCubes: Math.max(2, Math.round(t.startCubes)),
    startX: 3,
    startZ: 4,
    actionTicks: msToTicks(t.stepMs),
    warnTicks: Math.round(t.warnMs / TICK_MS),
    risingTicks: msToTicks(t.riseMs),
    sinkingTicks: msToTicks(t.sinkStartMs),
    sinkStartTicks: msToTicks(t.sinkStartMs),
    sinkFloorTicks: msToTicks(t.sinkFloorMs),
    paceStartMs: t.paceStartMs,
    paceFlatLevels: Math.max(1, Math.round(t.paceFlatLevels)),
    paceGrowth: Math.max(0, t.paceGrowth),
    paceMinMs: t.paceMinMs,
    waveTicks: msToTicks(t.waveSec * 1000),
    restTicks: Math.round(t.restMs / TICK_MS),
    waveSpread: Math.min(0.95, Math.max(0, t.waveSpread)),
    waveEase: t.waveEase,
    wavePeak: t.wavePeak,
    restFlow: Math.min(1, Math.max(0, t.restFlow)),
    surgeCubes: Math.max(0, Math.round(t.surgeCubes)),
    surgeMax: Math.max(0, Math.round(t.surgeMax)),
    breatherEvery: Math.max(0, Math.round(t.breatherEvery)),
    breatherFactor: Math.max(1, t.breatherFactor),
    wipeBonus: Math.max(0, Math.round(t.wipeBonus)),
    chainCalmTicks: Math.round(t.chainCalmMs / TICK_MS),
    chainCalmMaxTicks: Math.round(t.chainCalmMaxMs / TICK_MS),
    timedStartMs: t.timedStartMs,
    timedEndMs: t.timedEndMs,
    cubesPerLevel: Math.max(1, Math.round(t.cubesPerLevel)),
    levelTicks: msToTicks(t.levelSec * 1000),
    warnOccupied: 42,
    rescueTicks: msToTicks(t.rescueMs),
    lowHeight: t.lowHeight,
    sinkLowHeight: t.sinkLowHeight,
    mountHeight: t.mountHeight,
    stepDownHeight: t.stepDownHeight,
    chainLift: t.chainLift,
    chainLiftMin: t.chainLiftMin,
    feedRate: t.feedRate,
    helpRate: t.helpRate,
    targetCubes: Math.max(0, Math.round(t.targetCubes)),
    refillMs: t.refillMs,
    refillEndMs: t.refillEndMs,
    crowdedFactor: t.crowdedFactor,
    edgeFactor: t.edgeFactor,
    edgeCalmTicks: Math.round(t.edgeCalmMs / TICK_MS),
    giftRate: t.giftRate,
    giftMax: t.giftMax,
    easyLevels: Math.max(1, Math.round(t.easyLevels)),
    gentleTicks: Math.round((t.gentleSec * 1000) / TICK_MS),
    timedTicks: msToTicks(t.timedSec * 1000),
    floorLiftTicks: msToTicks(t.liftMs),
    custom: isCustomTuning(tuning),
    experiments: exp,
  };
}

/** Records are kept separately for each combination of rule-changing flags. */
export function ruleKey(config: RulesConfig): string {
  const e = config.experiments;
  const flags = [
    e.gentleStart ? 'g' : '',
    e.floorClimb ? 'c' : '',
    e.floorLift ? 'l' : '',
    e.soloOne ? 's' : '',
    e.chainCalm ? 'q' : '',
    e.dockSteps ? 'd' : '',
    e.timeFloor ? 't' : '',
    e.waves ? 'w' : '',
    e.surge ? 'u' : '',
    e.lastSliver ? 'e' : '',
    e.gift ? 'p' : '',
    e.opening ? 'o' : '',
  ].join('');
  return `${config.rulesVersion}${flags ? '-' + flags : ''}`;
}

/** Cubes in play at which spawning is at its slowest. */
const CROWDED_CUBES = 30;
/** Cubes short of the target at which refilling runs at full speed. */
const REFILL_FULL = 2;
/** Levels at the start of a run on which the refill and the chain window keep their first values. */
const FLAT_LEVELS = 3;
/** Levels by which the refill and the chain window have come to their last values. */
const REFILL_LEVEL = 15;
const SINK_LEVEL = 20;
/** A phase of a Time Limited run lasts a minute: the level of the run is the number of the phase. */
const TIMED_PHASE_MS = 60_000;

/** How far a value that changes with the level has come by `level`: 0 on the flat start, 1 from `last` on. */
function ramp(level: number, last: number): number {
  return Math.min(1, Math.max(0, (level - FLAT_LEVELS) / Math.max(1, last - FLAT_LEVELS)));
}

/**
 * Endless: time between spawns with the target number of cubes in play, before the wave the
 * run is on has its say. Flat over the first levels, `paceFlatLevels` of them; then every
 * level adds the same share of the starting flow, so the cubes that come in a minute grow by
 * a line. The interval falls fast at first and ever slower after: the faster the game goes,
 * the slower it speeds up, and a player twice as fast lasts far longer than twice the time
 * it takes a slow one to be overrun, where a curve that multiplies gives them a minute more.
 */
function endlessPaceMs(config: RulesConfig, level: number): number {
  const steps = Math.max(0, level - config.paceFlatLevels);
  return Math.max(config.paceMinMs, config.paceStartMs / (1 + config.paceGrowth * steps));
}

/** Endless: the level the clock alone has brought the run to, a level for every `levelTicks` played. */
export function timeLevel(config: RulesConfig, tick: number): number {
  return 1 + Math.floor(tick / config.levelTicks);
}

/** Time Limited: how many phases a run has, one for every minute it lasts. */
export function timedPhases(config: RulesConfig): number {
  return Math.max(1, Math.ceil((config.timedTicks * config.tickMs) / TIMED_PHASE_MS));
}

/** Time Limited: the phase of the clock, the same for every player. */
export function timedPhase(config: RulesConfig, tick: number): number {
  return Math.min(timedPhases(config), 1 + Math.floor((tick * config.tickMs) / TIMED_PHASE_MS));
}

/** Time Limited: time between spawns at the target, falling evenly from the first tick to the last. */
function timedPaceMs(config: RulesConfig, tick: number): number {
  const done = Math.min(1, tick / config.timedTicks);
  return config.timedStartMs + (config.timedEndMs - config.timedStartMs) * done;
}

/**
 * Time between spawns for a number of cubes in play. The interval is given at the target:
 * Endless takes it from the level, Time Limited from the clock alone, so that its pressure
 * is the same for everybody. `swell` is what the wave the run is on multiplies it by; the
 * interval stays above its floor whatever the wave: the lowest one of Endless, the one a Time
 * Limited run ends at. Below the target what the
 * player clears comes back sooner, so there is always something to build with; above it the
 * interval stretches as the board crowds, to give the player room to clear. Past the danger
 * mark it stretches much further, the more the nearer the board is to full: the last sliver
 * of the board is thicker than the rest of it.
 */
export function paceIntervalTicks(config: RulesConfig, mode: RunMode, level: number, tick: number, cubes: number, swell = 1): number {
  const timed = mode === 'timed';
  const atTarget = timed
    ? Math.max(Math.min(config.timedStartMs, config.timedEndMs), timedPaceMs(config, tick) * swell)
    : Math.max(config.paceMinMs, endlessPaceMs(config, level) * swell);
  const target = config.targetCubes;
  if (cubes < target) {
    const refillLevel = timed ? timedPhase(config, tick) : level;
    const refill = config.refillMs + (config.refillEndMs - config.refillMs) * ramp(refillLevel, REFILL_LEVEL);
    const short = Math.min(1, (target - cubes) / REFILL_FULL);
    return msToTicks(atTarget + (Math.min(refill, atTarget) - atTarget) * short);
  }
  const fill = Math.min(1, (cubes - target) / Math.max(1, CROWDED_CUBES - target));
  let stretch = 1 + (config.crowdedFactor - 1) * fill;
  if (config.experiments.lastSliver && cubes > config.warnOccupied) {
    const cells = config.size * config.size;
    const edge = Math.min(1, (cubes - config.warnOccupied) / Math.max(1, cells - config.warnOccupied));
    stretch += (Math.max(stretch, config.edgeFactor) - stretch) * edge;
  }
  return msToTicks(atTarget * stretch);
}

/**
 * Chain window at a level: how long a cleared cube sinks, and so how long a chain can be
 * added to. Generous on the first levels, it shrinks to its floor and no further.
 */
export function sinkTicksAt(config: RulesConfig, level: number): number {
  const start = config.sinkStartTicks;
  const floor = Math.min(start, config.sinkFloorTicks);
  return Math.round(start + (floor - start) * ramp(level, SINK_LEVEL));
}

/**
 * Relative chance of each top value (index 0 = the 1) for a new cube. Early levels favour
 * 2s and 3s, which clear with few cubes; by `easyLevels` every value is equally likely.
 */
export function topWeights(config: RulesConfig, level: number): number[] {
  const easy = [0.6, 3, 3, 2, 1, 0.8];
  const blend = Math.min(1, (level - 1) / Math.max(1, config.easyLevels - 1));
  return easy.map((w) => w + (1 - w) * blend);
}

/**
 * Share of helpful spawns at a level: generous at first, tapering off as the level rises. In
 * the trough after the crest of a wave every cube is a helpful one: the hard part is behind,
 * and what comes now is there to be made something of.
 */
export function helpChance(config: RulesConfig, level: number, generous = false): number {
  if (generous) return 1;
  return config.helpRate * Math.max(0.35, 1 - 0.07 * (level - 1));
}
