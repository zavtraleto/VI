import { measure, personaPlay } from '../rules/levelBot';
import { scoreOf } from '../rules/levelScore';
import { tryWay } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { firstsOf, tailOf } from './measures';
import { MEASURE_HEAD, PERSONA_FLOOR_RUNS, layOutRows, measureRow } from './select';
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

/** The table of the road: a piece, what it is, its board and its dice, and what the solver, the walk and two personas make of it. */
export const ROAD_HEAD: readonly string[] = ['piece', 'role', 'board', 'dice', 'faces', 'par', 'firsts', 'worst', 'lost', 'boards', 'hasty', 'casual'];
/** Boards the walk sees on a piece for the table of the road: an open board has far more, and its row says the walk was cut (`+`). */
export const ROAD_WALK_LIMIT = 300;

/**
 * A piece of the road as a row of its table (`node scripts/ladder.mjs road`). `firsts` are the
 * first moves that leave the board cleared within a move over the fewest; `worst`, `lost` and
 * `boards` are of the walk over the boards the player can come to, and carry a `+` where the
 * walk was cut at `walkLimit`: they are then of the boards nearest the start and no more. The
 * personas play the thirty runs a place is judged by.
 */
export function roadRow(spec: LevelSpec, role: string, walkLimit = ROAD_WALK_LIMIT, runs = PERSONA_FLOOR_RUNS): string[] {
  const cut = new Set((spec.holes ?? []).map((cell) => `${cell.x},${cell.z}`));
  const xs: number[] = [];
  const zs: number[] = [];
  for (let z = 0; z < spec.size; z++) for (let x = 0; x < spec.size; x++) if (!cut.has(`${x},${z}`)) (xs.push(x), zs.push(z));
  const side = (at: number[]): number => Math.max(...at) - Math.min(...at) + 1;
  const walk = walkBoards(spec, walkLimit);
  const more = walk.capped ? '+' : '';
  const share = (name: 'hasty' | 'casual'): string => {
    let cleared = 0;
    for (let run = 1; run <= runs; run++) if (personaPlay(spec, name, run).endReason === 'passed') cleared++;
    return `${Math.round((cleared / runs) * 100)}%`;
  };
  return [
    spec.id,
    role,
    `${side(xs)}x${side(zs)}`,
    String(spec.layout?.dice.length ?? 0),
    (spec.faces ?? []).join(' '),
    String(spec.par ?? '-'),
    String(firstsOf(spec, spec.par ?? 0)),
    `${walk.worst}${more}`,
    `${walk.lost}${more}`,
    `${walk.boards}${more}`,
    share('hasty'),
    share('casual'),
  ];
}

export function roadTable(rows: readonly string[][]): string {
  return layOutRows([[...ROAD_HEAD], ...rows]);
}
