import type { ExperimentConfig, RulesConfig } from './types';

export const TICK_MS = 20;

export function msToTicks(ms: number): number {
  return Math.round(ms / TICK_MS);
}

export function defaultExperiments(): ExperimentConfig {
  return {
    guidedStart: true,
    gentleStart: false,
    boardPreview: false,
    matchHint: false,
    floorClimb: false,
    floorLift: false,
    relaxedPace: false,
  };
}

export function defaultConfig(experiments: Partial<ExperimentConfig> = {}): RulesConfig {
  const exp = { ...defaultExperiments(), ...experiments };
  return {
    rulesVersion: '0.1',
    size: 7,
    tickMs: TICK_MS,
    startCubes: 14,
    startX: 3,
    startZ: 4,
    actionTicks: msToTicks(200),
    risingTicks: msToTicks(800),
    sinkingTicks: msToTicks(2400),
    spawnIntervalMs: exp.relaxedPace ? 4000 : 3000,
    spawnStepMs: 150,
    spawnMinMs: exp.relaxedPace ? 1200 : 900,
    cubesPerLevel: 20,
    warnOccupied: 42,
    rescueTicks: msToTicks(3000),
    lowHeight: 0.5,
    gentleTicks: msToTicks(180_000),
    floorLiftTicks: msToTicks(4000),
    tutorialRefillTicks: msToTicks(1000),
    tutorialRefillCubes: 12,
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
    e.relaxedPace ? 'r' : '',
  ].join('');
  return `${config.rulesVersion}${flags ? '-' + flags : ''}`;
}

export function spawnIntervalTicks(config: RulesConfig, level: number): number {
  const ms = Math.max(config.spawnMinMs, config.spawnIntervalMs - config.spawnStepMs * (level - 1));
  return msToTicks(ms);
}
