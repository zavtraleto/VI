import { READER, measure, personaPlay } from '../rules/levelBot';
import { scoreOf } from '../rules/levelScore';
import { defaultConfig } from '../rules/config';
import { moveOf, solveLevel, tellMove, tryWay, type SolverMove } from '../rules/levelSolver';
import { scan, type Ban } from '../rules/reach';
import { createRun } from '../rules/sim';
import type { LevelSpec } from '../rules/types';
import type { Stop } from './campaign';
import { D_ROWS, SIMILAR_PAIRS, UNLIKE_PAIRS } from './calibration';
import { depthOf } from './depth';
import type { Place, Technique } from './row';
import { BARRED, held, knownRepeat, markOf, type Barred, type SlowFacts, type Violation } from './grammar';
import type { SlowMeasures } from './measureCache';
import { explorerFacts, firstsOf, hiddenOf, lostOf, nearOf, rankOf, rankShares, shareOf, tailOf, trapOf, turnsOf, type Shares } from './measures';
import { BANDS, difficulty } from './scale';
import { MEASURE_HEAD, PERSONA_FLOOR_RUNS, layOutRows, measureRow } from './select';
import { SIMILAR_NEAR, SIMILAR_ROW, coreKey, coreOf, similarity } from './signature';
import { walkBoards, type Walk } from './walk';

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
  const walk = walkBoards(spec, walkLimit);
  const share = (name: 'hasty' | 'casual'): number => {
    let cleared = 0;
    for (let run = 1; run <= runs; run++) if (personaPlay(spec, name, run).endReason === 'passed') cleared++;
    return cleared / runs;
  };
  const road = { firsts: firstsOf(spec, spec.par ?? 0), worst: walk.worst, lost: walk.lost, boards: walk.boards, capped: walk.capped };
  return roadCells(number, spec, role, road, share('hasty'), share('casual'));
}

const percent = (share: number): string => `${Math.round(share * 100)}%`;

/** The cells of the table of the road for a board whose first moves, walk and shares of the hasty and the casual persona are measured. */
function roadCells(number: number, spec: LevelSpec, role: string, road: SlowMeasures['road'], hasty: number, casual: number): string[] {
  const cut = new Set((spec.holes ?? []).map((cell) => `${cell.x},${cell.z}`));
  const xs: number[] = [];
  const zs: number[] = [];
  for (let z = 0; z < spec.size; z++) for (let x = 0; x < spec.size; x++) if (!cut.has(`${x},${z}`)) (xs.push(x), zs.push(z));
  const side = (at: number[]): number => Math.max(...at) - Math.min(...at) + 1;
  const more = road.capped ? '+' : '';
  const score = spec.solution ? scoreOf(spec, spec.solution.map(moveOf)) : null;
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
    String(road.firsts),
    `${road.worst}${more}`,
    `${road.lost}${more}`,
    `${road.boards}${more}`,
    percent(hasty),
    percent(casual),
  ];
}

export function roadTable(rows: readonly string[][]): string {
  return layOutRows([[...ROAD_HEAD], ...rows]);
}

/**
 * The table of the campaign (`node scripts/ladder.mjs campaign`): the table of the road, and the measures of the depth of
 * a board (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md, section 8) — its difficulty on the scale,
 * the depth a player has to think, the forks, the loss, the hidden dice, the ways, the share of the player who reads only
 * what a person sees, and the short key of its thought.
 */
export const CAMPAIGN_HEAD: readonly string[] = [...ROAD_HEAD, 'D', 'rank', 'forks', 'loss', 'hid', 'ways', 'reader', 'sig'];

/**
 * Every slow measure of a board, once: what the table of the campaign, the passport of a place and the slow rules
 * of the grammar read of it, kept in the cache by its key (`cacheKey`). The planner and the casual persona of the
 * slow facts are those of the shares of the ranks: their runs are played once.
 */
export function slowMeasuresOf(spec: LevelSpec, teaches: Technique | undefined, walkLimit = ROAD_WALK_LIMIT, runs = PERSONA_FLOOR_RUNS): SlowMeasures {
  const walk = walkBoards(spec, walkLimit);
  const shares = rankShares(spec, runs);
  return {
    road: { firsts: firstsOf(spec, spec.par ?? 0), worst: walk.worst, lost: walk.lost, boards: walk.boards, capped: walk.capped },
    facts: slowFactsOf(spec, teaches, walkLimit, runs, { walk, shares }),
    shares,
    reader: shareOf(spec, READER, runs),
    explorer: { careful: explorerFacts(spec, 'careful', runs), planner: explorerFacts(spec, 'planner', runs) },
    depth: depthOf(spec),
    hidden: hiddenOf(spec),
    states: solveLevel(spec).states,
  };
}

/** The difficulty of a board on the scale, read off its slow measures. */
export function dOf(spec: LevelSpec, m: SlowMeasures): number {
  return difficulty({ rank: rankOf(m.shares), forks: m.depth.forks, hidden: m.hidden, lossAt: m.depth.lossAt, par: spec.par ?? 0 });
}

/**
 * A board as a row of the table of the campaign, all read off its measures: the row of the road, then `D`; `rank`, or
 * `>8` where even the deep player does not clear it; `forks`; `loss`, the fewest moves it can be lost after (`-` where it
 * cannot) and the share of the boards up to par that are lost (`~` where it is of a sample); `hid`; `ways`, the shortest
 * and the long ways (`+` where the graph or the ways were not counted whole); `reader`; and `sig`, the key of its core.
 */
export function campaignRow(number: number, spec: LevelSpec, role: string, m: SlowMeasures): string[] {
  const { depth } = m;
  const rank = rankOf(m.shares);
  const cut = !depth.complete || depth.waysCapped || depth.longCapped ? '+' : '';
  return [
    ...roadCells(number, spec, role, m.road, m.shares.hasty ?? 0, m.shares.casual ?? 0),
    String(dOf(spec, m)),
    rank === null ? '>8' : String(rank),
    String(depth.forks),
    `${depth.lossAt ?? '-'} ${depth.lossSampled ? '~' : ''}${percent(depth.lostShare)}`,
    String(m.hidden),
    `${depth.ways}/${depth.waysLong}${cut}`,
    percent(m.reader),
    coreKey(coreOf(spec)),
  ];
}

export function campaignTable(rows: readonly string[][]): string {
  return layOutRows([[...CAMPAIGN_HEAD], ...rows]);
}

/** A board past this place whose ways are one is said under the table: a cause to lay it again, not a rule. */
const ONE_ROAD_AFTER = 50;
/** A row of the scale is off where its boards are on average more than this outside its band. */
const ROW_OFF = 1;
/** The rows of the scale off at which the formula is to be mended (spec section 6). */
const ROWS_OFF_MOST = 3;

const dText = (d: number): string => (Number.isInteger(d) ? String(d) : d.toFixed(1));

/**
 * What is said under the table of the campaign: the boards of one road past the 50th place; the rows of the scale the
 * owner placed boards in by words (section 6), each with its boards and their D, how many are outside its band and how
 * far on average, and whether the scale agrees; the pairs of section 5 the likeness misses; and how many places of
 * each decade from the 31st are outside its band (a peak against the peak of the decade, a rest not counted).
 */
export function campaignNotes(stops: readonly Stop[], measures: readonly SlowMeasures[]): string {
  const lines: string[] = [];
  const dAt = stops.map((stop, index) => dOf(stop.spec, measures[index]));
  const byCode = new Map(stops.map((stop, index) => [stop.code, index]));

  const oneRoad = stops.filter((stop, index) => stop.number > ONE_ROAD_AFTER && measures[index].depth.waysLong === 1);
  lines.push(oneRoad.length === 0 ? 'одна дорога: нет' : `одна дорога: ${oneRoad.map((stop) => `${stop.number} ${stop.code}`).join(', ')}`);

  lines.push('', 'шкала D (раздел 6):');
  let rowsOff = 0;
  for (const row of D_ROWS) {
    const held = row.codes.filter((code) => byCode.has(code));
    if (held.length === 0) continue;
    const off = held.map((code) => {
      const d = dAt[byCode.get(code)!];
      return Math.max(0, row.lo - d, d - row.hi);
    });
    const mean = off.reduce((sum, one) => sum + one, 0) / off.length;
    const isOff = mean > ROW_OFF;
    if (isOff) rowsOff++;
    const boards = held.map((code) => `${code} ${dText(dAt[byCode.get(code)!])}`).join(', ');
    lines.push(`  «${row.words}» ${row.lo}–${row.hi}: вне полосы ${off.filter((one) => one > 0).length} из ${held.length}, среднее отклонение ${mean.toFixed(1)}${isOff ? ' — расходится' : ''}; ${boards}`);
  }
  lines.push(rowsOff === 0 ? '  сходится' : rowsOff < ROWS_OFF_MOST ? `  сходится: расходятся ${rowsOff} из ${D_ROWS.length} строк, меньше трёх` : `  не сходится: ${rowsOff} строк`);

  const specOf = (code: string) => stops[byCode.get(code)!].spec;
  const misses: string[] = [];
  for (const { a, b } of SIMILAR_PAIRS) {
    const others = b.filter((code) => byCode.has(code));
    if (!byCode.has(a) || others.length === 0) continue;
    const best = Math.max(...others.map((code) => similarity(specOf(a), specOf(code))));
    if (best < SIMILAR_ROW) misses.push(`${a}~${others.join('|')} ${best.toFixed(2)}`);
  }
  for (const [a, b] of UNLIKE_PAIRS) {
    if (!byCode.has(a) || !byCode.has(b)) continue;
    const sim = similarity(specOf(a), specOf(b));
    if (sim > SIMILAR_NEAR) misses.push(`${a}≠${b} ${sim.toFixed(2)}`);
  }
  lines.push('', misses.length === 0 ? 'похожесть (раздел 5): пары сходятся' : `похожесть (раздел 5): промахов ${misses.length}: ${misses.join('; ')}`);

  const decades = BANDS.flatMap((band) => {
    const places = stops.map((stop, index) => ({ stop, d: dAt[index] })).filter(({ stop }) => band.from <= stop.number && stop.number <= band.to && stop.role !== 'rest');
    if (places.length === 0) return [];
    const out = places.filter(({ stop, d }) => (stop.role === 'peak' ? d < band.peak[0] || d > band.peak[1] : d < band.lo || d > band.hi)).length;
    return [`${band.from}–${band.to}: ${out} из ${places.length}`];
  });
  if (decades.length > 0) lines.push('', `вне полосы D по десяткам: ${decades.join(', ')}`);
  return lines.join('\n');
}

/** The passport of a place of the row (`node scripts/row.mjs report`): the table of the campaign, and the boards within two moves of the start. */
export const PLACE_HEAD: readonly string[] = [...CAMPAIGN_HEAD, 'near', 'whole'];
/** A board of no more cells than this is walked whole for its passport: the walk of two dice on nine cells takes half a second. */
export const WHOLE_CELLS = 9;

/**
 * A place of the row as a row of its passport: the row of the table of the campaign read off its measures, its role
 * named with its chapter (`1:meet`); `near` — the boards within two moves of the start, the dead ends the level says
 * at once, the boards lost and not said, and the most moves from the rest (`nearOf`); and `whole` — for a board of nine
 * cells or fewer, every board it can come to, those lost, and the most moves from any of them (`lostOf`); `-` for a
 * board of more cells, or of more boards than can be walked whole.
 */
export function placeRow(place: Place, m: SlowMeasures): string[] {
  const { spec } = place;
  const cells = spec.size * spec.size - (spec.holes?.length ?? 0);
  // A board of few cells can still come to more boards than the walk holds (tight-room-5, dd-12-ice-corridor): it has no whole.
  const walkedWhole = (): ReturnType<typeof lostOf> | null => {
    try {
      return lostOf(spec);
    } catch {
      return null;
    }
  };
  const whole = cells <= WHOLE_CELLS ? walkedWhole() : null;
  return [
    ...campaignRow(place.number, spec, `${place.chapter}:${place.role}`, m),
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
 * and, for rule 12, the fewest without each move the solver can be barred from (`clearedWithout`). The walk and the
 * shares of the planner and the casual persona may be given where they are measured already (`slowMeasuresOf`).
 */
export function slowFactsOf(spec: LevelSpec, teaches: Technique | undefined, walkLimit = ROAD_WALK_LIMIT, runs = PERSONA_FLOOR_RUNS, known: { walk?: Walk; shares?: Shares } = {}): SlowFacts {
  const played = (name: 'planner' | 'casual'): number => {
    const given = known.shares?.[name];
    if (given !== undefined) return given;
    let cleared = 0;
    for (let run = 1; run <= runs; run++) if (personaPlay(spec, name, run).endReason === 'passed') cleared++;
    return cleared / runs;
  };
  const ban = teaches ? BAN_OF[teaches] : undefined;
  const without = ban === undefined ? undefined : (solveLevel(spec, { ban: [...ban], maxMoves: (spec.par ?? 0) + 2 }).solution?.par ?? null);
  // A link is the second event of a trap of order as a combo is (third campaign, section 14): R05 is a combo and a link.
  const events = scoreOf(spec, (spec.solution ?? []).map(moveOf)).beats.filter((beat) => beat.event === 'combo' || beat.event === 'link').length;
  const order = events >= 2 && trapOf(spec) !== null;
  const walk = known.walk ?? walkBoards(spec, walkLimit);
  return { lost: walk.lost > 0, planner: played('planner'), casual: played('casual'), order, cleared: clearedWithout(spec), ...(without === undefined ? {} : { without }) };
}

/**
 * The rules of the grammar broken, one to a line under the table of the campaign in the order of the
 * row, or that none is; a rule that does not hold the row back yet (`HELD`) is marked a warning.
 */
export function grammarText(violations: readonly Violation[]): string {
  if (violations.length === 0) return 'grammar: clean';
  const lines = [...violations].sort((a, b) => a.at - b.at || a.rule - b.rule).map((one) => `  ${one.rule}  ${one.text}${markOf(one)}`);
  return ['grammar:', ...lines, `держат ряд: ${violations.filter((one) => held(one) && !knownRepeat(one)).length}`].join('\n');
}
