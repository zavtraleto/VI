import { defaultConfig } from './config';
import type { ExperimentConfig, RulesConfig, Tuning } from './types';

/** A step of the calls: the tuning it plays with over the default, and the faces its new cubes may come with. */
export interface LiveStep {
  tuning: Partial<Tuning>;
  /** Left out, any face; the gentle steps leave out the 1. */
  arriveFaces?: readonly number[];
}

const NO_ONES: readonly number[] = [2, 3, 4, 5, 6];

/**
 * The steps of the calls (docs/superpowers/specs/2026-11-05-vi-live-calls-design.md, section 4).
 * Steps 1 and 2 are the gentle ones (the owner, 5 November 2026: «сделать их поначалу проще
 * (доску меньше, режиссёр - подыгрывает игроку)»): a board of 5 and of 6, fewer cubes, more help,
 * and no cube comes with a 1 up. Steps 3 to 7 are the old steps 1, 2, 3, 5 and 7 of the live
 * sessions, each faster than the one before and with fewer gifts (26 October 2026: «сложность
 * сеансов тоже должна расти»). Every one lasts three minutes, the last 15 seconds of it with no
 * cube coming.
 */
export const LIVE_STEPS: readonly LiveStep[] = [
  {
    tuning: {
      liveSec: 180, size: 5, startCubes: 5, targetCubes: 8, warnShare: 16 / 25, gentleSec: 180,
      liveStartMs: 3500, liveEndMs: 2500, helpRate: 0.9, feedRate: 0.6, giftRate: 0.2, giftMax: 0.6,
    },
    arriveFaces: NO_ONES,
  },
  {
    tuning: {
      liveSec: 180, size: 6, startCubes: 7, targetCubes: 11, warnShare: 25 / 36, gentleSec: 180,
      liveStartMs: 3200, liveEndMs: 2200, helpRate: 0.8, feedRate: 0.5, giftRate: 0.12, giftMax: 0.5,
    },
    arriveFaces: NO_ONES,
  },
  { tuning: { liveSec: 180, gentleSec: 180, liveStartMs: 3500, liveEndMs: 2500, giftRate: 0.08 } },
  { tuning: { liveSec: 180, gentleSec: 60, liveStartMs: 3000, liveEndMs: 1500, giftRate: 0.08 } },
  { tuning: { liveSec: 180, gentleSec: 0, liveStartMs: 2500, liveEndMs: 1000, giftRate: 0.04 } },
  { tuning: { liveSec: 180, gentleSec: 0, liveStartMs: 2100, liveEndMs: 850, giftRate: 0.035 } },
  { tuning: { liveSec: 180, gentleSec: 0, liveStartMs: 2100, liveEndMs: 800, giftRate: 0.03 } },
];

/** The step of the table for a step number (1-based); a step past the last plays the last. */
export function liveStep(step: number): LiveStep {
  return LIVE_STEPS[Math.min(LIVE_STEPS.length, Math.max(1, Math.floor(step))) - 1];
}

/** The config of a call of a step (1-based), with `tuning` over the step's own. */
export function liveConfig(step: number, experiments: Partial<ExperimentConfig> = {}, tuning: Partial<Tuning> = {}): RulesConfig {
  const at = liveStep(step);
  const config = defaultConfig(experiments, { ...at.tuning, ...tuning });
  return at.arriveFaces ? { ...config, arriveFaces: at.arriveFaces } : config;
}
