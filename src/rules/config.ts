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
  };
}

/** Slow, forgiving pace: time to read the board before the pressure builds. */
export const DEFAULT_TUNING: Readonly<Tuning> = {
  stepMs: 200,
  warnMs: 1000,
  riseMs: 3000,
  sinkMs: 5000,
  spawnStartMs: 5000,
  spawnStepMs: 150,
  spawnMinMs: 1500,
  cubesPerLevel: 20,
  startCubes: 10,
  lowHeight: 0.5,
  liftMs: 2500,
  gentleSec: 180,
  rescueMs: 3000,
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
  liftMs: [500, 10000, 250],
  gentleSec: [0, 600, 15],
  rescueMs: [1000, 10000, 500],
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
    rulesVersion: '0.2',
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
  const flags = [e.gentleStart ? 'g' : '', e.floorClimb ? 'c' : '', e.floorLift ? 'l' : ''].join('');
  return `${config.rulesVersion}${flags ? '-' + flags : ''}`;
}

export function spawnIntervalTicks(config: RulesConfig, level: number): number {
  const ms = Math.max(config.spawnMinMs, config.spawnIntervalMs - config.spawnStepMs * (level - 1));
  return msToTicks(ms);
}
