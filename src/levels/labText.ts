import type { LevelSpec, RulesConfig } from '../rules/types';
import { scoreOf, type Score } from '../rules/levelScore';
import { layOut, scoreText } from '../rules/levelReport';
import { levelDeadEnd, type LevelDeadEnd } from '../rules/level';
import { moveOf, moveText, movesAt, playMove, solveFrom, solveLevel, tryWay } from '../rules/levelSolver';
import { boardSigns, printBoard } from './boardFile';
import { editsOf } from './edits';
import { FROM_ROUTE, FROM_SOLUTION, SKETCH, levelId } from './generate';
import type { Recipe } from './recipes';
import { gather, judge, type Fit, type JudgeOptions } from './select';
import { sameBoard } from './variety';
import { LEVELS } from './levels';
import { ROAD } from './road';

/**
 * What the lab of the levels says of a board, as facts and as text: the script
 * `scripts/level.mjs` only reads a file and prints what is made here, and the page of the lab
 * asks the same functions. Nothing here reads a disk or knows of a process.
 */

/** A board the game has, by its code: a level of the list (`P06`) or a piece of the road (`R03`). */
export function boardFrom(code: string): { spec: LevelSpec; from: 'list' | 'road' } {
  const level = LEVELS.find((spec) => spec.id === code);
  if (level) return { spec: level, from: 'list' };
  const piece = ROAD.find((spec) => spec.id === code);
  if (piece) return { spec: piece, from: 'road' };
  throw new Error(`no board "${code}": it is no file, no level of the list (P01…) and no piece of the road (R01…)`);
}

/** The cells of a board as its file has them, the digits in columns. */
export function gridText(spec: LevelSpec): string {
  const signs = boardSigns(spec);
  const wide = Math.max(3, ...signs.flat().map((sign) => sign.length));
  return signs.map((row) => row.map((sign) => (sign.length === 1 ? ` ${sign}` : sign).padEnd(wide)).join(' ').trimEnd()).join('\n');
}

/** The head of a board in a line, and its cells. */
export function showText(spec: LevelSpec): string {
  const faces = (spec.faces ?? spec.values).join('');
  const par = `par ${spec.par ?? '-'}${spec.par !== undefined && spec.exact === false ? ' (not proved the fewest)' : ''}`;
  return [`${spec.id}  ${spec.size}x${spec.size}, ${spec.norm} dice, faces ${faces}, floor ${spec.floor === false ? 'shut' : 'open'}, ${par}`, '', gridText(spec)].join('\n');
}

/**
 * A board solved anew and held against what it keeps. `kept` is null where the board keeps
 * neither a way nor a count of moves; `same` where the fewest moves found are the moves kept and
 * the way kept plays; `shorter` and `longer` where the fewest found are fewer or more than kept;
 * `missing` where the search gave up before a way was found; `broken` where the way kept does
 * not clear the board.
 */
export interface Check {
  par: number | null;
  /** The moves found are proved the fewest: the search went through every shorter way. With no way found, that there is none. */
  exact: boolean;
  states: number;
  way: string[] | null;
  score: Score | null;
  kept: 'same' | 'shorter' | 'longer' | 'missing' | 'broken' | null;
}

/** Whether the way a board keeps clears it when played on the rules. */
export function wayPlays(spec: LevelSpec, config?: RulesConfig): boolean {
  try {
    return tryWay(spec, (spec.solution ?? []).map(moveOf), config).state.endReason === 'passed';
  } catch {
    return false;
  }
}

export function checkOf(spec: LevelSpec, opts: { maxStates?: number } = {}): Check {
  const solved = solveLevel(spec, opts.maxStates === undefined ? {} : { maxStates: opts.maxStates });
  const found = solved.solution;
  const stored = spec.par ?? spec.solution?.length ?? null;
  let kept: Check['kept'] = null;
  if (stored !== null) {
    if (spec.solution && !wayPlays(spec)) kept = 'broken';
    else if (!found) kept = 'missing';
    else kept = found.par < stored ? 'shorter' : found.par > stored ? 'longer' : 'same';
  }
  return {
    par: found?.par ?? null,
    exact: solved.exhausted,
    states: solved.states,
    way: found ? found.moves.map(moveText) : null,
    score: found ? scoreOf(spec, found.moves) : null,
    kept,
  };
}

/** Whether a check is one a board passes: a way was found, and it is what the board keeps where it keeps one. */
export function checkPassed(check: Check): boolean {
  return check.par !== null && (check.kept === null || check.kept === 'same');
}

export function checkText(spec: LevelSpec, check: Check): string {
  const lines = [showText(spec), ''];
  if (check.par === null || !check.way || !check.score) {
    lines.push(check.exact ? `no way: the board cannot be cleared (${check.states} boards seen)` : `no way found: the search gave up at ${check.states} boards`);
  } else {
    lines.push(`moves ${check.par}${check.exact ? '' : ' (not proved the fewest)'}: ${check.way.join(' ')}`);
    lines.push(`route ${check.score.route}  (${check.score.kind})`);
    lines.push(`boards seen ${check.states}`, '', scoreText(check.score));
  }
  lines.push('', `kept: ${check.kept ?? 'nothing to hold against'}${check.kept === null || spec.par === undefined ? '' : ` (the board says ${spec.par})`}`);
  return lines.join('\n');
}

export function checkJson(spec: LevelSpec, check: Check): Record<string, unknown> {
  return {
    id: spec.id,
    par: check.par,
    exact: check.exact,
    states: check.states,
    way: check.way,
    route: check.score?.route ?? null,
    kind: check.score?.kind ?? null,
    kept: check.kept,
    ok: checkPassed(check),
  };
}

/** Boards the solver may see on a board that is one of many asked at once: a move of a board, a board a change away. */
export const QUICK_MAX_STATES = 200_000;

/**
 * What a move does to the board it is made on. `keeps` is `par` where the board is still
 * cleared in the fewest moves after it, `longer` where it is cleared but in more, `dead` where
 * it is not cleared at all, `unknown` where the search gave up. `par` is the fewest moves the
 * board is cleared in by a way that begins with the move, the move counted; `deadEnd` is the
 * dead end the move comes to at once, where it does.
 */
export interface MoveFact {
  move: string;
  keeps: 'par' | 'longer' | 'dead' | 'unknown';
  par: number | null;
  deadEnd: LevelDeadEnd | null;
}

/** Every move there is from the board as it stands after the moves of `after`, with what it does. */
export function movesOf(spec: LevelSpec, opts: { after?: readonly string[]; maxStates?: number } = {}): MoveFact[] {
  const { after = [], maxStates = QUICK_MAX_STATES } = opts;
  const state = tryWay(spec, after.map(moveOf)).state;
  if (state.over) return [];
  const best = solveFrom(state, { maxStates }).solution?.par ?? null;
  return movesAt(state).map((move): MoveFact => {
    const next = playMove(state, move);
    const text = moveText(move);
    if (next.endReason === 'passed') return { move: text, keeps: best === 1 ? 'par' : 'longer', par: 1, deadEnd: null };
    if (next.over) return { move: text, keeps: 'dead', par: null, deadEnd: levelDeadEnd(next) };
    const solved = solveFrom(next, { maxStates });
    if (!solved.solution) return { move: text, keeps: solved.exhausted ? 'dead' : 'unknown', par: null, deadEnd: levelDeadEnd(next) };
    const par = solved.solution.par + 1;
    return { move: text, keeps: best === null ? 'unknown' : par === best ? 'par' : 'longer', par, deadEnd: null };
  });
}

export function movesText(facts: readonly MoveFact[]): string {
  if (facts.length === 0) return 'no moves: the board is over';
  const table = [['move', 'keeps', 'moves', 'dead end']];
  for (const fact of facts) table.push([fact.move, fact.keeps, fact.par === null ? '-' : String(fact.par), fact.deadEnd ?? '-']);
  const count = (keeps: MoveFact['keeps']) => facts.filter((fact) => fact.keeps === keeps).length;
  return `${layOut(table)}\n\nmoves: ${facts.length}, ${count('par')} keep the fewest, ${count('longer')} longer, ${count('dead')} dead${count('unknown') > 0 ? `, ${count('unknown')} the search gave up on` : ''}`;
}

/**
 * What a change of one die does to a board: the fewest moves of the board changed, and whether
 * that is the same, fewer or more than before, or the board is not cleared any more.
 */
export interface NearFact {
  what: string;
  par: number | null;
  /** The search went through: the moves are the fewest, or there is proved to be no way. */
  exact: boolean;
  change: 'same' | 'shorter' | 'longer' | 'unsolved';
}

/**
 * Every board one change away (`editsOf`), each only solved: no report is made of it, which is
 * what makes this a matter of seconds. A change keeps what the board says of dice that are
 * leaving and of a start on the floor, where the change is not of the start. A change the rules
 * refuse, a combo ready at the start and the like, is left out.
 */
export function nearOf(spec: LevelSpec, opts: { maxStates?: number } = {}): NearFact[] {
  return nearBoards(spec, opts).map(({ what, par, exact, change }) => ({ what, par, exact, change }));
}

/** The boards one change away with what each change does, as `nearOf` tells it, and the board itself: a board that is cleared keeps its way. */
export function nearBoards(spec: LevelSpec, opts: { maxStates?: number } = {}): (NearFact & { spec: LevelSpec })[] {
  const { maxStates = QUICK_MAX_STATES } = opts;
  const before = solveLevel(spec, { maxStates }).solution?.par ?? spec.par ?? null;
  const facts: (NearFact & { spec: LevelSpec })[] = [];
  for (const edit of editsOf(spec)) {
    const { leaving, onFloor } = spec.layout!;
    const moved = edit.what.startsWith('start at');
    const layout = { ...edit.spec.layout!, ...(leaving ? { leaving } : {}), ...(onFloor && !moved ? { onFloor } : {}) };
    const board: LevelSpec = { ...edit.spec, layout };
    let solved;
    try {
      solved = solveLevel(board, { maxStates });
    } catch {
      continue;
    }
    const par = solved.solution?.par ?? null;
    const change: NearFact['change'] = par === null ? 'unsolved' : before === null || par === before ? 'same' : par < before ? 'shorter' : 'longer';
    const kept: LevelSpec = solved.solution ? { ...board, par: solved.solution.par, exact: true, solution: solved.solution.moves.map(moveText) } : board;
    facts.push({ what: edit.what, par, exact: solved.exhausted, change, spec: kept });
  }
  return facts;
}

export function nearText(facts: readonly NearFact[]): string {
  const table = [['change', 'moves', 'exact', 'what it does']];
  for (const fact of facts) table.push([fact.what, fact.par === null ? '-' : String(fact.par), fact.exact ? 'yes' : 'no', fact.change]);
  const count = (change: NearFact['change']) => facts.filter((fact) => fact.change === change).length;
  return `${layOut(table)}\n\nnear: ${facts.length} changes, ${count('same')} same, ${count('shorter')} shorter, ${count('longer')} longer, ${count('unsolved')} unsolved`;
}

/** The levels of the probe the owner has not played: what their places are there for is not said, by the page or by the script. */
export const BLIND: readonly string[] = ['P23', 'P24', 'P25', 'P26', 'P27', 'P28', 'P29', 'P30'];

/** What a board does not meet of what a place asks: empty where it fits. Only the name of the place is given, never what it is there for. */
export interface FitFact {
  place: string;
  misses: string[];
}

/**
 * A board that is there already held against places: each place is asked as it asks of a board
 * laid by hand for it (`judge` with the board as its one sketch, the nearest board looked for),
 * on the square and with the cells of the board, since a board drawn by hand is seldom on the
 * shape of a place. What a place plays its level with is its own, though, and a board of other
 * faces, another floor or another count of dice is not judged: it says which of them differs.
 */
export function fitOf(spec: LevelSpec, places: readonly Recipe[], opts: { maxStates?: number } = {}): FitFact[] {
  if (!spec.layout) return [];
  const facts: FitFact[] = [];
  for (const place of places) {
    const faces = [...(place.ones ? [1] : []), ...place.faces].sort((a, b) => a - b);
    const own = [...(spec.faces ?? spec.values)].sort((a, b) => a - b);
    const misses: string[] = [];
    if (String(faces) !== String(own)) misses.push(`faces ${own.join(' ')}, the place has ${faces.join(' ')}`);
    if ((place.floor ?? true) !== (spec.floor ?? true)) misses.push(`floor ${spec.floor === false ? 'shut' : 'open'}, the place has it ${place.floor === false ? 'shut' : 'open'}`);
    const dice = spec.layout.dice.length;
    if (dice < place.dice || dice > place.dice + (place.more ?? 0)) misses.push(`${dice} dice, the place has ${place.dice}${place.more ? `-${place.dice + place.more}` : ''}`);
    if (misses.length === 0) {
      const asked: Recipe = { ...place, size: spec.size, holes: (spec.holes ?? []).map(({ x, z }) => [x, z] as const), sketch: [spec.layout] };
      try {
        const verdict = judge(asked, SKETCH + 1, { near: true, ...(opts.maxStates === undefined ? {} : { maxStates: opts.maxStates }) });
        misses.push(...(verdict.fit ? verdict.fit.misses : [verdict.why]));
      } catch (error) {
        misses.push((error as Error).message);
      }
    }
    facts.push({ place: levelId(place), misses });
  }
  return facts;
}

export function fitText(facts: readonly FitFact[]): string {
  const fits = facts.filter((fact) => fact.misses.length === 0);
  const lines = facts.map((fact) => `${fact.place.padEnd(5)} ${fact.misses.length === 0 ? 'fits' : fact.misses.join('; ')}`);
  return `${lines.join('\n')}\n\nfit: ${facts.length} places, the board fits ${fits.length === 0 ? 'none' : fits.map((fact) => fact.place).join(' ')}`;
}

/** The cells two boards differ in, by the signs of their files, and whether they are one board turned or mirrored. */
export interface Diff {
  cells: { x: number; z: number; was: string; now: string }[];
  same: boolean;
}

export function diffOf(a: LevelSpec, b: LevelSpec): Diff {
  const was = boardSigns(a);
  const now = boardSigns(b);
  const cells: Diff['cells'] = [];
  for (let z = 0; z < Math.max(a.size, b.size); z++) {
    for (let x = 0; x < Math.max(a.size, b.size); x++) {
      const before = was[z]?.[x] ?? '';
      const after = now[z]?.[x] ?? '';
      if (before !== after) cells.push({ x, z, was: before, now: after });
    }
  }
  return { cells, same: sameBoard(a, b) };
}

export function diffText(a: LevelSpec, b: LevelSpec, diff: Diff): string {
  const head = (spec: LevelSpec): string => `${spec.id} ${spec.size}x${spec.size}, faces ${(spec.faces ?? spec.values).join('')}, floor ${spec.floor === false ? 'shut' : 'open'}, par ${spec.par ?? '-'}`;
  const lines = [`a: ${head(a)}`, `b: ${head(b)}`, ''];
  for (const cell of diff.cells) lines.push(`cell ${cell.x},${cell.z}: ${cell.was || 'off the board'} -> ${cell.now || 'off the board'}`);
  lines.push(diff.cells.length === 0 ? 'diff: the cells are the same' : `diff: ${diff.cells.length} cells differ${diff.same ? '; the same board to a player, turned or mirrored' : ''}`);
  return lines.join('\n');
}

/** How the boards of a place are laid: at random, from their solution backwards, from the route of the place backwards, or every way. */
export type GenMode = 'random' | 'solution' | 'route' | 'both';

/**
 * The seeds a place is asked for boards with: `from` to `to`, counted from 1, in the range of
 * the way the boards are laid (`generate.ts`: seeds above ten thousand lay a board from its
 * solution, above thirty thousand from the route of the place). With no mode said, a place that
 * has a route is built from it and any other is laid at random, as `ladder.mjs` does.
 */
export function genSeeds(recipe: Recipe, span: { from: number; to: number }, mode?: GenMode): number[] {
  const count = Math.max(0, span.to - span.from + 1);
  const run = (base: number): number[] => Array.from({ length: count }, (_, index) => base + span.from + index);
  const how = mode ?? (recipe.scenes ? 'route' : 'random');
  if (how === 'both') return [...run(0), ...run(FROM_SOLUTION), ...(recipe.scenes ? run(FROM_ROUTE) : [])];
  return run(how === 'solution' ? FROM_SOLUTION : how === 'route' ? FROM_ROUTE : 0);
}

/**
 * The boards a place gets from a run of seeds, the best first: every seed lays a candidate, the
 * judge of the place holds it against what the place asks, and the boards that fit are put in
 * order (`candidate`, `judge` and `gather` of `select.ts`). It is what `ladder.mjs place=` does,
 * with the boards given back and not printed. The recipe of the place is the one set of rules
 * there is: nothing is asked here that the place does not ask.
 */
export function genOf(recipe: Recipe, span: { from: number; to: number }, opts: JudgeOptions & { mode?: GenMode; say?: (done: number, of: number, fit: number) => void } = {}): Fit[] {
  const { mode, say, ...judging } = opts;
  const seeds = genSeeds(recipe, span, mode);
  let fit = 0;
  const verdicts = seeds.map((seed, index) => {
    const verdict = judge(recipe, seed, judging);
    if (verdict.fit) fit++;
    say?.(index + 1, seeds.length, fit);
    return verdict;
  });
  return gather(recipe, verdicts).fits;
}

/** A board laid for a place as a file of the lab: its name, and its text with the status of an idea and a note of where it is from. */
export function genFile(recipe: Recipe, fit: Pick<Fit, 'seed' | 'spec'>): { name: string; text: string } {
  const place = levelId(recipe);
  return { name: `${place}-${fit.seed}`, text: printBoard(fit.spec, { status: 'idea', note: `место ${place}, зерно ${fit.seed}` }) };
}

/**
 * A board solved anew for the record of every board: `ok` where the fewest moves found are the
 * moves it keeps (or it keeps none and a way was found), `shorter` and `longer` where they are
 * not, `broken` where the way it keeps does not clear it, `unsolved` where the search went
 * through every board and found no way, `capped` where it gave up first: that is no failure,
 * and is said.
 */
export interface Regress {
  id: string;
  from: 'list' | 'spare' | 'road' | 'board';
  stored: number | null;
  found: number | null;
  exact: boolean;
  states: number;
  verdict: 'ok' | 'shorter' | 'longer' | 'unsolved' | 'broken' | 'capped';
}

export function regressOne(spec: LevelSpec, maxStates?: number, from: Regress['from'] = 'board'): Regress {
  const check = checkOf(spec, { maxStates });
  const stored = spec.par ?? spec.solution?.length ?? null;
  const verdict: Regress['verdict'] =
    check.kept === 'broken' ? 'broken' : check.par === null ? (check.exact ? 'unsolved' : 'capped') : check.kept === 'shorter' || check.kept === 'longer' ? check.kept : 'ok';
  return { id: spec.id, from, stored, found: check.par, exact: check.exact, states: check.states, verdict };
}

/** Whether a row of the record is a board that is not as it says: a search that gave up says nothing either way. */
export function regressFailed(row: Regress): boolean {
  return row.verdict !== 'ok' && row.verdict !== 'capped';
}

export function regressText(rows: readonly Regress[]): string {
  const table = [['board', 'from', 'kept', 'found', 'exact', 'boards seen', 'verdict']];
  for (const row of rows) table.push([row.id, row.from, row.stored === null ? '-' : String(row.stored), row.found === null ? '-' : String(row.found), row.exact ? 'yes' : 'no', String(row.states), row.verdict]);
  const capped = rows.filter((row) => row.verdict === 'capped').length;
  return `${layOut(table)}\n\nregress: ${rows.length} boards, ${rows.filter(regressFailed).length} not ok${capped > 0 ? `, ${capped} the search gave up on` : ''}`;
}
