import { defaultConfig } from './config';
import type { ExperimentConfig, RulesConfig, Tuning } from './types';

/**
 * The steps of the live sessions of the row: the tuning each plays with, over the default.
 * Step 1 is the first the row offers: the whole session in the gentle start of Endless. Step 2
 * is the pace of the old session of the day with a gentle first minute; step 3 has no gentle
 * start and half the gifts. Steps 4 to 7 go on along the same line, each faster than the one before
 * and with fewer gifts (word of the owner, 26 October 2026: «сложность сеансов тоже должна расти»);
 * their sessions stand in `row.json` after places near 50, 63, 76 and 89, laid with steps 1 to 3 of
 * the levels to a hundred.
 */
export const LIVE_STEPS: readonly Partial<Tuning>[] = [
  { liveSec: 180, gentleSec: 180, liveStartMs: 3500, liveEndMs: 2500, giftRate: 0.08 },
  { liveSec: 180, gentleSec: 60, liveStartMs: 3000, liveEndMs: 1500, giftRate: 0.08 },
  { liveSec: 180, gentleSec: 0, liveStartMs: 2500, liveEndMs: 1000, giftRate: 0.04 },
  { liveSec: 180, gentleSec: 0, liveStartMs: 2200, liveEndMs: 900, giftRate: 0.04 },
  { liveSec: 180, gentleSec: 0, liveStartMs: 2100, liveEndMs: 850, giftRate: 0.035 },
  { liveSec: 180, gentleSec: 0, liveStartMs: 2000, liveEndMs: 800, giftRate: 0.03 },
  { liveSec: 180, gentleSec: 0, liveStartMs: 1900, liveEndMs: 750, giftRate: 0.03 },
];

/** The config of a live session of a step (1-based); a step past the last plays the last. */
export function liveConfig(step: number, experiments: Partial<ExperimentConfig> = {}): RulesConfig {
  const index = Math.min(LIVE_STEPS.length, Math.max(1, Math.floor(step))) - 1;
  return defaultConfig(experiments, LIVE_STEPS[index]);
}
