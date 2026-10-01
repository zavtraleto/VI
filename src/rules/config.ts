import type { ExperimentConfig, RulesConfig, Tuning } from './types';

export const TICK_MS = 20;

export function msToTicks(ms: number): number {
  return Math.max(1, Math.round(ms / TICK_MS));
}

export function defaultExperiments(): ExperimentConfig {
  return {
    guidedStart: true,
    gentleStart: true,
    boardPreview: false,
    matchHint: false,
    floorClimb: false,
    floorLift: true,
    soloOne: false,
  };
}

/** Slow, forgiving pace: time to read the board before the pressure builds. */
export const DEFAULT_TUNING: Readonly<Tuning> = {
  stepMs: 200,
  warnMs: 1000,
  riseMs: 3000,
  sinkMs: 5000,
  spawnStartMs: 5000,
  spawnStepMs: 250,
  spawnMinMs: 1500,
  cubesPerLevel: 12,
  startCubes: 10,
  lowHeight: 0.5,
  mountHeight: 1,
  stepDownHeight: 0.75,
  liftMs: 4000,
  gentleSec: 180,
  rescueMs: 3000,
  helpRate: 0.65,
  sparseFactor: 0.5,
  crowdedFactor: 1.2,
  easyLevels: 6,
};

/** Slider limits for the debug panel: [min, max, step]. */
export const TUNING_RANGES: Readonly<Record<keyof Tuning, readonly [number, number, number]>> = {
  stepMs: [100, 400, 20],
  warnMs: [0, 3000, 100],
  riseMs: [400, 6000, 100],
  sinkMs: [1000, 10000, 200],
  spawnStartMs: [1000, 10000, 250],
  spawnStepMs: [0, 500, 10],
  spawnMinMs: [300, 5000, 100],
  cubesPerLevel: [5, 60, 1],
  startCubes: [2, 30, 1],
  lowHeight: [0.1, 0.9, 0.05],
  mountHeight: [0.1, 1, 0.05],
  stepDownHeight: [0.1, 1, 0.05],
  liftMs: [500, 10000, 250],
  gentleSec: [0, 600, 15],
  rescueMs: [1000, 10000, 500],
  helpRate: [0, 1, 0.05],
  sparseFactor: [0.2, 1, 0.05],
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
    rulesVersion: '0.4',
    size: 7,
    tickMs: TICK_MS,
    startCubes: Math.max(2, Math.round(t.startCubes)),
    startX: 3,
    startZ: 4,
    actionTicks: msToTicks(t.stepMs),
    warnTicks: Math.round(t.warnMs / TICK_MS),
    risingTicks: msToTicks(t.riseMs),
    sinkingTicks: msToTicks(t.sinkMs),
    spawnIntervalMs: t.spawnStartMs,
    spawnStepMs: t.spawnStepMs,
    spawnMinMs: t.spawnMinMs,
    cubesPerLevel: Math.max(1, Math.round(t.cubesPerLevel)),
    warnOccupied: 42,
    rescueTicks: msToTicks(t.rescueMs),
    lowHeight: t.lowHeight,
    mountHeight: t.mountHeight,
    stepDownHeight: t.stepDownHeight,
    helpRate: t.helpRate,
    sparseFactor: t.sparseFactor,
    crowdedFactor: t.crowdedFactor,
    easyLevels: Math.max(1, Math.round(t.easyLevels)),
    gentleTicks: Math.round((t.gentleSec * 1000) / TICK_MS),
    floorLiftTicks: msToTicks(t.liftMs),
    tutorialRefillTicks: msToTicks(1000),
    custom: isCustomTuning(tuning),
    experiments: exp,
  };
}

/** Records are kept separately for each combination of rule-changing flags. */
export function ruleKey(config: RulesConfig): string {
  const e = config.experiments;
  const flags = [e.gentleStart ? 'g' : '', e.floorClimb ? 'c' : '', e.floorLift ? 'l' : '', e.soloOne ? 's' : ''].join('');
  return `${config.rulesVersion}${flags ? '-' + flags : ''}`;
}

/** Board fill at which spawning is at its fastest and at its slowest. */
const SPARSE_CUBES = 10;
const CROWDED_CUBES = 30;

/**
 * Time between spawns. It shortens with the level, and stretches with how full the board
 * is: a thin board refills quickly so there is always something to do, a crowded one
 * gives the player room to clear.
 */
export function spawnIntervalTicks(config: RulesConfig, level: number, cubes: number): number {
  const byLevel = Math.max(config.spawnMinMs, config.spawnIntervalMs - config.spawnStepMs * (level - 1));
  const fill = Math.min(1, Math.max(0, (cubes - SPARSE_CUBES) / (CROWDED_CUBES - SPARSE_CUBES)));
  const factor = config.sparseFactor + (config.crowdedFactor - config.sparseFactor) * fill;
  return msToTicks(byLevel * factor);
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
