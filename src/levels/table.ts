import { measure, personaPlay } from '../rules/levelBot';
import { scoreOf } from '../rules/levelScore';
import { moveOf, solveLevel, tryWay } from '../rules/levelSolver';
import type { Ban } from '../rules/reach';
import type { LevelSpec } from '../rules/types';
import type { Technique } from './chapters';
import type { SlowFacts, Violation } from './grammar';
import { firstsOf, tailOf, turnsOf } from './measures';
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
    { seed: spec.seed, spec, par, exact: measured.exact, short: par, depth: measured.depth, uses: measured.uses, needs: measured.needs, traps: measured.traps, random: measured.random, tail, turns: measured.way ? turnsOf(spec, measured.way) : 0, clears: cleared.filter(Boolean).length, route: score?.route ?? '', kind: score?.kind ?? 'other', firsts, personas: measured.personas, shares: null, walk: walkLimit > 0 ? walkBoards(spec, walkLimit) : null, distance: 0, misses: [] },
    measured.personas,
  );
}

export function tableOf(rows: readonly string[][]): string {
  return layOutRows([[...MEASURE_HEAD], ...rows]);
}

/**
 * The table of the road and of the campaign: the number of a board in its row, the board, what it
 * is, its size and its dice, and what the solver, the score of its way, the walk and two personas
 * make of it.
 */
export const ROAD_HEAD: readonly string[] = ['n', 'board', 'role', 'size', 'dice', 'faces', 'par', 'turns', 'away', 'firsts', 'worst', 'lost', 'boards', 'hasty', 'casual'];
/** Boards the walk sees on a piece for the table of the road: an open board has far more, and its row says the walk was cut (`+`). */
export const ROAD_WALK_LIMIT = 300;

/**
 * A board as a row of the table of the road (`node scripts/ladder.mjs road`) or of the campaign
 * (`node scripts/ladder.mjs campaign`); `number` is its place in that row, from 1. `turns` and
 * `away` are of the way the board keeps (`scoreOf`): the dice to turn before the first event, and
 * the rolls that take a die away from where it ends. `firsts` are the
 * first moves that leave the board cleared within a move over the fewest; `worst`, `lost` and
 * `boards` are of the walk over the boards the player can come to, and carry a `+` where the
 * walk was cut at `walkLimit`: they are then of the boards nearest the start and no more. The
 * personas play the thirty runs a place is judged by.
 */
export function roadRow(number: number, spec: LevelSpec, role: string, walkLimit = ROAD_WALK_LIMIT, runs = PERSONA_FLOOR_RUNS): string[] {
  const cut = new Set((spec.holes ?? []).map((cell) => `${cell.x},${cell.z}`));
  const xs: number[] = [];
  const zs: number[] = [];
  for (let z = 0; z < spec.size; z++) for (let x = 0; x < spec.size; x++) if (!cut.has(`${x},${z}`)) (xs.push(x), zs.push(z));
  const side = (at: number[]): number => Math.max(...at) - Math.min(...at) + 1;
  const walk = walkBoards(spec, walkLimit);
  const more = walk.capped ? '+' : '';
  const score = spec.solution ? scoreOf(spec, spec.solution.map(moveOf)) : null;
  const share = (name: 'hasty' | 'casual'): string => {
    let cleared = 0;
    for (let run = 1; run <= runs; run++) if (personaPlay(spec, name, run).endReason === 'passed') cleared++;
    return `${Math.round((cleared / runs) * 100)}%`;
  };
  return [
    String(number),
    spec.id,
    role,
    `${side(xs)}x${side(zs)}`,
    String(spec.layout?.dice.length ?? 0),
    (spec.faces ?? []).join(' '),
    String(spec.par ?? '-'),
    String(score?.turns ?? '-'),
    String(score?.away ?? '-'),
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

/**
 * The bans of the solver that take away a move a board can teach; none for a move the solver cannot do
 * without. The walk over leaving dice is taken with the way up onto one: on an open floor a step down
 * and up onto the leaving combo is the same road over it.
 */
const BAN_OF: Partial<Record<Technique, readonly Ban[]>> = { link: ['link'], walk: ['bridge', 'up'], glass: ['glass'], lift: ['floor'], push: ['push'], ones: ['ones'] };

/**
 * What the slow rules of the grammar ask of a board (`slowGrammar`): whether the walk over the
 * boards the player can come to finds one lost, the share of the planner's runs that clear it, and,
 * for a board that teaches, whether it is cleared within a move over its fewest without that move.
 */
export function slowFactsOf(spec: LevelSpec, teaches: Technique | undefined, walkLimit = ROAD_WALK_LIMIT, runs = PERSONA_FLOOR_RUNS): SlowFacts {
  let cleared = 0;
  for (let run = 1; run <= runs; run++) if (personaPlay(spec, 'planner', run).endReason === 'passed') cleared++;
  const ban = teaches ? BAN_OF[teaches] : undefined;
  const shortWithout = ban === undefined ? undefined : solveLevel(spec, { ban: [...ban], maxMoves: (spec.par ?? 0) + 1 }).solution !== null;
  return { lost: walkBoards(spec, walkLimit).lost > 0, planner: cleared / runs, ...(shortWithout === undefined ? {} : { shortWithout }) };
}

/** The rules of the grammar broken, one to a line under the table of the campaign, or that none is. */
export function grammarText(violations: readonly Violation[]): string {
  if (violations.length === 0) return 'grammar: clean';
  return ['grammar:', ...violations.map((one) => `  ${one.rule}  ${one.text}`)].join('\n');
}
