import type { BoardStatus } from '../levels/boardFile';
import { LATER_RUNS, type Instant, type Later, type Near, type Seconds } from './labFacts';
import { plural } from './workshopLists';

/**
 * What «проверить» of the workshop says of a board (docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md,
 * section 3.4): the facts of the tiers of the lab put into plain lines, a line to a thing. A fact
 * still being counted is said to be; a board the rules refuse is said in one line, and no more.
 * `near` is given for a board of the row: how alike it is to every place before it (`nearInRow`), of
 * which the last line says the five just before it and the most alike of all.
 */
export function checkLines(instant: Instant | null, seconds: Seconds | string | null, later: Later | string | null, near?: readonly Near[]): string[] {
  if (instant?.error) return [`правила не принимают доску: ${instant.error}`];
  const lines: string[] = [];
  if (instant?.deadEnd) lines.push('доска стоит в тупике как есть');
  const moves = (n: number): string => `${n} ${plural(n, ['ход', 'хода', 'ходов'])}`;
  if (seconds === null) lines.push('решаю…');
  else if (typeof seconds === 'string') lines.push(`решатель: ${seconds}`);
  else {
    const { check } = seconds;
    // `kept` holds the solver against the file (`checkOf`): shorter, the solver found a way shorter than the file keeps;
    // longer, the file keeps fewer moves than the solver can find; missing, the file's way plays and the solver gave up.
    const kept = {
      same: 'записанный путь: держит минимум',
      shorter: `записанный путь длиннее: есть путь за ${moves(check.par ?? 0)}`,
      longer: 'записано меньше ходов, чем нашёл решатель',
      missing: 'решатель сдался; записанный путь проходит доску',
      broken: 'записанный путь не проходит доску',
    } as const;
    if (check.par === null) {
      lines.push(check.exact ? 'решения нет' : 'решатель сдался, решения не нашёл');
      // With no way found only `missing` and `broken` can stand here.
      if (check.kept !== null) lines.push(kept[check.kept]);
    } else {
      lines.push(`решается за ${moves(check.par)} (${check.exact ? 'доказано' : 'не доказано'})`);
      lines.push(check.kept === null ? 'пути в файле нет' : kept[check.kept]);
      const count = (keeps: (fact: Seconds['moves'][number]) => boolean): number => seconds.moves.filter(keeps).length;
      const lead = count((move) => move.keeps === 'par' || move.keeps === 'longer');
      const dead = count((move) => move.keeps === 'dead' && move.deadEnd !== null);
      // A move the search gave up on is not said to lead nowhere: it is said to be not counted out.
      const open = count((move) => move.keeps === 'unknown');
      lines.push(`первые ходы: ${lead} из ${seconds.moves.length} ведут к решению${dead > 0 ? `, ${dead} сразу в тупик` : ''}${open > 0 ? `, ${open} не досчитаны` : ''}`);
      lines.push(seconds.trap === null ? 'ловушки нет' : seconds.trap === 0 ? 'ловушка: есть, тупик сразу' : `ловушка: есть, тупик виден через ${moves(seconds.trap)}`);
    }
  }
  if (later === null) lines.push('боты: считаю…');
  else if (typeof later === 'string') lines.push(`боты: ${later}`);
  else {
    const of = (name: 'hasty' | 'casual' | 'careful' | 'planner'): number => Math.round(later.report.personas[name].endings.passed * LATER_RUNS);
    lines.push(`боты из ${LATER_RUNS}: торопливый ${of('hasty')}, обычный ${of('casual')}, внимательный ${of('careful')}, планирующий ${of('planner')}`);
    const { measures } = later;
    // As the table of the campaign writes them: a rank no player reaches is `>8`, and numbers of a graph not walked whole have a `+`.
    if (measures) lines.push(`мерила: D ${measures.d}, rank ${measures.rank ?? '>8'}, развилок ${measures.forks}, скрыто ${measures.hidden}, путей ${measures.ways}/${measures.waysLong}${measures.complete ? '' : '+'}`);
    lines.push(later.spare.length === 0 ? 'лишних костей нет' : `лишних костей: ${later.spare.length}`);
  }
  if (near) lines.push(nearLine(near));
  return lines;
}

/** How alike a board of the row is to the five places just before it, the nearest first, and to the most alike of all before it. */
function nearLine(near: readonly Near[]): string {
  if (near.length === 0) return 'похожесть: прежних мест нет';
  const said = (place: Near): string => `${place.number} ${place.code} ${place.sim.toFixed(2)}`;
  const before = [...near].sort((a, b) => b.number - a.number);
  const most = before.reduce((best, place) => (place.sim > best.sim ? place : best));
  return `похожесть: ${before.slice(0, 5).map(said).join(', ')}; ближе всех — ${said(most)}`;
}

/**
 * The line over a board of the row whose file keeps no shortest way yet (section 11.2): the row
 * asks every board of it for one (`src/levels/row.test.ts`), and the page writes it as soon as the
 * solver proves the fewest moves. `seconds` is null while the solver counts; a board not of the
 * row, or one whose fewest moves are proved, has no line.
 */
export function rowPathLine(status: BoardStatus | undefined, seconds: Seconds | string | null): string | null {
  if (status !== 'R') return null;
  if (seconds === null) return 'ряд не соберётся, пока не записан путь';
  if (typeof seconds === 'string') return `ряд не соберётся: ${seconds}`;
  const { check } = seconds;
  if (check.par === null) return `ряд не соберётся: ${check.exact ? 'решения нет' : 'решатель сдался, решения не нашёл'}`;
  if (!check.exact || !check.way) return 'ряд не соберётся: решатель не доказал минимум';
  return null;
}
