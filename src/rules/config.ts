import type { ExperimentConfig, RulesConfig, RunMode, Tuning } from './types';

export const TICK_MS = 20;

export function msToTicks(ms: number): number {
  return Math.max(1, Math.round(ms / TICK_MS));
}

/** The version of the rules. Records of another version are kept apart. */
export const RULES_VERSION = '0.8';

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
  };
}

/**
 * Slow, forgiving pace: time to read the board before the pressure builds. Only the flow of
 * cubes grows with the level; the player's step, the warning and the rise never speed up.
 */
export const DEFAULT_TUNING: Readonly<Tuning> = {
  stepMs: 200,
  warnMs: 1000,
  riseMs: 3000,
  paceStartMs: 6000,
  paceRatio: 0.94,
  paceMinMs: 1400,
  phaseLevels: 5,
  breathLevels: 2,
  calmMs: 6000,
  cubesPerLevel: 16,
  chainCalmMs: 1500,
  chainCalmMaxMs: 8000,
  sinkStartMs: 10000,
  sinkFloorMs: 7000,
  timedStartMs: 3000,
  timedEndMs: 1500,
  timedCalmMs: 3000,
  startCubes: 10,
  lowHeight: 0.5,
  sinkLowHeight: 0.8,
  mountHeight: 1,
  stepDownHeight: 0.9,
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
};

/** Slider limits for the debug panel: [min, max, step]. */
export const TUNING_RANGES: Readonly<Record<keyof Tuning, readonly [number, number, number]>> = {
  stepMs: [100, 400, 20],
  warnMs: [0, 3000, 100],
  riseMs: [400, 6000, 100],
  paceStartMs: [1000, 15000, 250],
  paceRatio: [0.8, 1, 0.01],
  paceMinMs: [300, 5000, 100],
  phaseLevels: [1, 20, 1],
  breathLevels: [0, 10, 1],
  calmMs: [0, 20000, 500],
  cubesPerLevel: [5, 60, 1],
  chainCalmMs: [0, 5000, 100],
  chainCalmMaxMs: [0, 20000, 500],
  sinkStartMs: [1000, 15000, 250],
  sinkFloorMs: [1000, 15000, 250],
  timedStartMs: [500, 8000, 100],
  timedEndMs: [300, 8000, 100],
  timedCalmMs: [0, 10000, 250],
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
    paceRatio: t.paceRatio,
    paceMinMs: t.paceMinMs,
    phaseLevels: Math.max(1, Math.round(t.phaseLevels)),
    breathLevels: Math.max(0, Math.round(t.breathLevels)),
    calmTicks: Math.round(t.calmMs / TICK_MS),
    chainCalmTicks: Math.round(t.chainCalmMs / TICK_MS),
    chainCalmMaxTicks: Math.round(t.chainCalmMaxMs / TICK_MS),
    timedStartMs: t.timedStartMs,
    timedEndMs: t.timedEndMs,
    timedCalmTicks: Math.round(t.timedCalmMs / TICK_MS),
    cubesPerLevel: Math.max(1, Math.round(t.cubesPerLevel)),
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
  ].join('');
  return `${config.rulesVersion}${flags ? '-' + flags : ''}`;
}

/** Cubes in play at which spawning is at its slowest. */
const CROWDED_CUBES = 30;
/** Cubes short of the target at which refilling runs at full speed. */
const REFILL_FULL = 2;
/** Levels at the start of a run on which nothing speeds up. */
const FLAT_LEVELS = 3;
/** Levels by which the refill and the chain window have come to their last values. */
const REFILL_LEVEL = 15;
const SINK_LEVEL = 20;
/** Phases of a Time Limited run: its level is the number of the phase. */
export const TIMED_PHASES = 3;

/** How far a value that changes with the level has come by `level`: 0 on the flat start, 1 from `last` on. */
function ramp(level: number, last: number): number {
  return Math.min(1, Math.max(0, (level - FLAT_LEVELS) / Math.max(1, last - FLAT_LEVELS)));
}

/** The first level of a new phase: a rest. The run does not open with one. */
export function isPhaseStart(config: RulesConfig, level: number): boolean {
  return level > 1 && (level - 1) % config.phaseLevels === 0;
}

/**
 * Endless: time between spawns with the target number of cubes in play. Flat over the first
 * levels, then every level multiplies it by the same ratio: gentle at first, steep in the
 * deep. The first level of a phase takes the interval of a few levels back.
 */
function endlessPaceMs(config: RulesConfig, level: number): number {
  const paced = isPhaseStart(config, level) ? level - config.breathLevels : level;
  const steps = Math.max(0, paced - FLAT_LEVELS);
  return Math.max(config.paceMinMs, config.paceStartMs * Math.pow(config.paceRatio, steps));
}

/** Time Limited: the phase of the clock, the same for every player. */
export function timedPhase(config: RulesConfig, tick: number): number {
  return Math.min(TIMED_PHASES, 1 + Math.floor((tick * TIMED_PHASES) / config.timedTicks));
}

/** Time Limited: time between spawns at the target, falling evenly from the first tick to the last. */
function timedPaceMs(config: RulesConfig, tick: number): number {
  const done = Math.min(1, tick / config.timedTicks);
  return config.timedStartMs + (config.timedEndMs - config.timedStartMs) * done;
}

/**
 * Time between spawns for a number of cubes in play. The interval is given at the target:
 * Endless takes it from the level, Time Limited from the clock alone, so that its pressure
 * is the same for everybody. Below the target what the player clears comes back sooner, so
 * there is always something to build with; above it the interval stretches as the board
 * crowds, to give the player room to clear.
 */
export function paceIntervalTicks(config: RulesConfig, mode: RunMode, level: number, tick: number, cubes: number): number {
  const timed = mode === 'timed';
  const atTarget = timed ? timedPaceMs(config, tick) : endlessPaceMs(config, level);
  const target = config.targetCubes;
  if (cubes < target) {
    const refillLevel = timed ? timedPhase(config, tick) : level;
    const refill = config.refillMs + (config.refillEndMs - config.refillMs) * ramp(refillLevel, REFILL_LEVEL);
    const short = Math.min(1, (target - cubes) / REFILL_FULL);
    return msToTicks(atTarget + (Math.min(refill, atTarget) - atTarget) * short);
  }
  const fill = Math.min(1, (cubes - target) / Math.max(1, CROWDED_CUBES - target));
  return msToTicks(atTarget * (1 + (config.crowdedFactor - 1) * fill));
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

/** Share of helpful spawns at a level: generous at first, tapering off as the level rises. */
export function helpChance(config: RulesConfig, level: number): number {
  return config.helpRate * Math.max(0.35, 1 - 0.07 * (level - 1));
}
