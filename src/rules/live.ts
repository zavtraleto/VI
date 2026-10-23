import { defaultConfig } from './config';
import type { ExperimentConfig, RulesConfig, Tuning } from './types';

/**
 * The steps of the live sessions of the row: the tuning each plays with, over the default.
 * Step 1 is the first the row offers: the whole session in the gentle start of Endless. Step 2
 * is the pace of the old session of the day with a gentle first minute; step 3 has no gentle
 * start and half the gifts.
 */
export const LIVE_STEPS: readonly Partial<Tuning>[] = [
  { liveSec: 180, gentleSec: 180, liveStartMs: 3500, liveEndMs: 2500, giftRate: 0.08 },
  { liveSec: 180, gentleSec: 60, liveStartMs: 3000, liveEndMs: 1500, giftRate: 0.08 },
  { liveSec: 180, gentleSec: 0, liveStartMs: 2500, liveEndMs: 1000, giftRate: 0.04 },
];

/** The config of a live session of a step (1-based); a step past the last plays the last. */
export function liveConfig(step: number, experiments: Partial<ExperimentConfig> = {}): RulesConfig {
  const index = Math.min(LIVE_STEPS.length, Math.max(1, Math.floor(step))) - 1;
  return defaultConfig(experiments, LIVE_STEPS[index]);
}
