import { measure, personaPlay } from '../rules/levelBot';
import { scoreOf } from '../rules/levelScore';
import { defaultConfig } from '../rules/config';
import { moveOf, solveLevel, tellMove, tryWay, type SolverMove } from '../rules/levelSolver';
import { scan, type Ban } from '../rules/reach';
import { createRun } from '../rules/sim';
import type { LevelSpec } from '../rules/types';
import type { Place, Technique } from './row';
import { BARRED, WARNING, held, type Barred, type SlowFacts, type Violation } from './grammar';
import { firstsOf, lostOf, nearOf, tailOf, trapOf, turnsOf } from './measures';
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

/** The passport of a place of the row (`node scripts/row.mjs report`): the table of the road, and the boards within two moves of the start. */
export const PLACE_HEAD: readonly string[] = [...ROAD_HEAD, 'near', 'whole'];
/** A board of no more cells than this is walked whole for its passport: the walk of two dice on nine cells takes half a second. */
export const WHOLE_CELLS = 9;

/**
 * A place of the row as a row of its passport: the row of the table of the road, its role named with
 * its chapter (`1:meet`); `near` — the boards within two moves of the start, the dead ends the level
 * says at once, the boards lost and not said, and the most moves from the rest (`nearOf`); and `whole`
 * — for a board of nine cells or fewer, every board it can come to, those lost, and the most moves
 * from any of them (`lostOf`).
 */
export function placeRow(place: Place, walkLimit = ROAD_WALK_LIMIT, runs = PERSONA_FLOOR_RUNS): string[] {
  const { spec } = place;
  const cells = spec.size * spec.size - (spec.holes?.length ?? 0);
  const whole = cells <= WHOLE_CELLS ? lostOf(spec) : null;
  return [
    ...roadRow(place.number, spec, `${place.chapter}:${place.role}`, walkLimit, runs),
    nearOf(spec).join(' '),
    whole ? `${whole.boards} ${whole.lost} ${whole.worst}` : '-',
  ];
}

export function placeTable(rows: readonly string[][]): string {
  return layOutRows([[...PLACE_HEAD], ...rows]);
}

/**
 * The bans of the solver that take away a move a board can teach; none for a move the solver cannot do
 * without. The walk over leaving dice is taken with the way up onto one: on an open floor a step down
 * and up onto the leaving combo is the same road over it.
 */
const BAN_OF: Partial<Record<Technique, readonly Ban[]>> = { link: ['link'], walk: ['bridge', 'up'], glass: ['glass'], lift: ['floor'], push: ['push'], ones: ['ones'] };

/**
 * Rule 12: the bans that take away a move before its lesson. As `BAN_OF`, but the lift is the climb onto
 * a leaving die alone: a push goes down to the floor, and a board of the push before the lesson of the climb
 * is not one that climbs.
 */
const BEFORE_LESSON_BAN: Readonly<Record<Barred, readonly Ban[]>> = { link: ['link'], walk: ['bridge', 'up'], glass: ['glass'], lift: ['up'], push: ['push'], ones: ['ones'] };
/** Rule 12: the moves over its own a board is looked for in without a move, and the boards the search may see. */
const CLEARED_SLACK = 3;
const CLEARED_MAX_STATES = 400_000;

/**
 * Whether the kept way clears the board with the parts banned: every move is one the player can come to
 * without them (`scan`, as the solver looks for moves), and no link or 1s are made where those are banned.
 * Played again move by move, not read off the score: the score marks a walk or a climb only on the roll
 * the player makes from that die, and a walk to a push or a walk over two leaving dice is missed by it.
 */
function wayHolds(spec: LevelSpec, way: readonly SolverMove[], ban: readonly Ban[]): boolean {
  let state = createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });
  for (const move of way) {
    const can = scan(state, ban).moves.some((one) => one.x === move.x && one.z === move.z && one.dir === move.dir && one.push === move.push);
    if (!can) return false;
    const told = tellMove(state, move);
    if ((ban.includes('link') && told.outcome.link) || (ban.includes('ones') && told.outcome.ones)) return false;
    state = told.state;
  }
  return state.endReason === 'passed';
}

/**
 * Rule 12: for each move the solver can be barred from, the fewest moves the board is cleared in without it,
 * up to three over its own, null where there is none; a move the search could not settle is left out. A board
 * whose kept way holds with the move banned (`wayHolds`) keeps the count of that way, with no search.
 */
export function clearedWithout(spec: LevelSpec): Partial<Record<Barred, number | null>> {
  const par = spec.par ?? 0;
  const way = (spec.solution ?? []).map(moveOf);
  const out: Partial<Record<Barred, number | null>> = {};
  for (const one of BARRED) {
    const ban = BEFORE_LESSON_BAN[one];
    if (way.length > 0 && wayHolds(spec, way, ban)) {
      out[one] = way.length;
      continue;
    }
    const { solution, exhausted } = solveLevel(spec, { ban: [...ban], maxMoves: par + CLEARED_SLACK, maxStates: CLEARED_MAX_STATES });
    if (solution) out[one] = solution.par;
    else if (exhausted) out[one] = null;
  }
  return out;
}

/**
 * What the slow rules of the grammar ask of a board (`slowGrammar`): whether the walk over the
 * boards the player can come to finds one lost, the shares of the planner's and the casual persona's runs that clear it, whether
 * it is a trap of order (two combos or links on its way and `trapOf`), and,
 * for a board that teaches, the fewest moves it is cleared in without that move (up to two over its own);
 * and, for rule 12, the fewest without each move the solver can be barred from (`clearedWithout`).
 */
export function slowFactsOf(spec: LevelSpec, teaches: Technique | undefined, walkLimit = ROAD_WALK_LIMIT, runs = PERSONA_FLOOR_RUNS): SlowFacts {
  let planned = 0;
  let casual = 0;
  for (let run = 1; run <= runs; run++) {
    if (personaPlay(spec, 'planner', run).endReason === 'passed') planned++;
    if (personaPlay(spec, 'casual', run).endReason === 'passed') casual++;
  }
  const ban = teaches ? BAN_OF[teaches] : undefined;
  const without = ban === undefined ? undefined : (solveLevel(spec, { ban: [...ban], maxMoves: (spec.par ?? 0) + 2 }).solution?.par ?? null);
  // A link is the second event of a trap of order as a combo is (third campaign, section 14): R05 is a combo and a link.
  const events = scoreOf(spec, (spec.solution ?? []).map(moveOf)).beats.filter((beat) => beat.event === 'combo' || beat.event === 'link').length;
  const order = events >= 2 && trapOf(spec) !== null;
  return { lost: walkBoards(spec, walkLimit).lost > 0, planner: planned / runs, casual: casual / runs, order, cleared: clearedWithout(spec), ...(without === undefined ? {} : { without }) };
}

/**
 * The rules of the grammar broken, one to a line under the table of the campaign in the order of the
 * row, or that none is; a rule that does not hold the row back yet (`HELD`) is marked a warning.
 */
export function grammarText(violations: readonly Violation[]): string {
  if (violations.length === 0) return 'grammar: clean';
  const lines = [...violations].sort((a, b) => a.at - b.at || a.rule - b.rule).map((one) => `  ${one.rule}  ${one.text}${held(one) ? '' : WARNING}`);
  return ['grammar:', ...lines].join('\n');
}
