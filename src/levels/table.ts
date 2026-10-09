import { measure } from '../rules/levelBot';
import { scoreOf } from '../rules/levelScore';
import { tryWay } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { firstsOf, tailOf } from './measures';
import { MEASURE_HEAD, layOutRows, measureRow } from './select';
import { walkBoards } from './walk';

/**
 * The table of the ladder as it stands: every level and every board in reserve, measured again
 * from what the level keeps. Run with `node scripts/ladder.mjs`.
 */

/** A level measured, as a row of the table. Its way is the one it keeps, played again on the rules; the boards the player can come to are walked where `walkLimit` is above 0. */
export function measureBoard(place: string, spec: LevelSpec, skillRuns = 20, walkLimit = 0): string[] {
  const measured = measure(spec, { skillRuns });
  const par = measured.par ?? 0;
  const cleared = measured.way ? tryWay(spec, measured.way).cleared : [];
  const tail = tailOf(cleared);
  const firsts = measured.way ? firstsOf(spec, par) : null;
  const score = measured.way ? scoreOf(spec, measured.way) : null;
  return measureRow(
    place,
    { seed: spec.seed, spec, par, exact: measured.exact, short: par, depth: measured.depth, uses: measured.uses, needs: measured.needs, traps: measured.traps, random: measured.random, tail, clears: cleared.filter(Boolean).length, route: score?.route ?? '', kind: score?.kind ?? 'other', firsts, personas: measured.personas, shares: null, walk: walkLimit > 0 ? walkBoards(spec, walkLimit) : null, distance: 0, misses: [] },
    measured.personas,
  );
}

export function tableOf(rows: readonly string[][]): string {
  return layOutRows([[...MEASURE_HEAD], ...rows]);
}
