import { measure } from '../rules/levelBot';
import type { LevelSpec } from '../rules/types';
import { MEASURE_HEAD, layOutRows, measureRow } from './select';

/**
 * The table of the ladder as it stands: every level and every board in reserve, measured again
 * from what the level keeps. Run with `node scripts/ladder.mjs`.
 */

/** A level measured, as a row of the table. Its way is the one it keeps, played again on the rules. */
export function measureBoard(place: string, spec: LevelSpec, skillRuns = 20): string[] {
  const measured = measure(spec, { skillRuns });
  const par = measured.par ?? 0;
  return measureRow(
    place,
    { seed: spec.seed, spec, par, exact: measured.exact, short: par, depth: measured.depth, uses: measured.uses, needs: measured.needs, traps: measured.traps, random: measured.random, distance: 0, misses: [] },
    measured.personas,
  );
}

export function tableOf(rows: readonly string[][]): string {
  return layOutRows([[...MEASURE_HEAD], ...rows]);
}
