import type { LevelSpec, RulesConfig } from '../rules/types';
import { scoreOf, type Score } from '../rules/levelScore';
import { scoreText } from '../rules/levelReport';
import { moveOf, moveText, solveLevel, tryWay } from '../rules/levelSolver';
import { boardSigns } from './boardFile';
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
 * not clear the board, or is not as long as the count kept beside it.
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
    if (spec.solution && (spec.solution.length !== stored || !wayPlays(spec))) kept = 'broken';
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
