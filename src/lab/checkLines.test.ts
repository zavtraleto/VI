import { describe, expect, it } from 'vitest';
import type { Instant, Later, Seconds } from './labFacts';
import { checkLines, rowPathLine } from './checkLines';

const instant: Instant = { error: null, deadEnd: null, dice: 5, groups: [] };
const seconds = (over: Partial<Seconds['check']> = {}, more: Partial<Seconds> = {}): Seconds => ({
  check: { par: 6, exact: true, states: 1000, way: ['0,0,E'], score: null, kept: 'same', ...over },
  firsts: 2,
  moves: [
    { move: '0,0,E', keeps: 'par', par: 6, deadEnd: null },
    { move: '0,0,S', keeps: 'longer', par: 8, deadEnd: null },
    { move: '0,0,N', keeps: 'dead', par: null, deadEnd: 'count' },
    { move: '0,0,W', keeps: 'dead', par: null, deadEnd: null },
  ],
  trap: 1,
  ...more,
});
const passed = (share: number) => ({ endings: { passed: share, count: 1 - share, floor: 0, limit: 0 } });
const later = { report: { personas: { hasty: passed(0.1), casual: passed(0.3), careful: passed(0.7), planner: passed(1), greedy: passed(0) } }, near: [], spare: [], measures: null } as unknown as Later;

describe('what «проверить» says', () => {
  it('says the board in plain lines', () => {
    expect(checkLines(instant, seconds(), later)).toEqual([
      'решается за 6 ходов (доказано)',
      'записанный путь: держит минимум',
      'первые ходы: 2 из 4 ведут к решению, 1 сразу в тупик',
      'ловушка: есть, тупик виден через 1 ход',
      'боты из 10: торопливый 1, обычный 3, внимательный 7, планирующий 10',
      'лишних костей нет',
    ]);
  });
  it('says what is still being counted', () => {
    expect(checkLines(instant, null, null)).toEqual(['решаю…', 'боты: считаю…']);
  });
  it('says a board the rules refuse, and nothing else', () => {
    expect(checkLines({ ...instant, error: 'level x: the board is in two parts' }, null, null)).toEqual(['правила не принимают доску: level x: the board is in two parts']);
  });
  it('says a board with no way, and the ways a file keeps that do not hold', () => {
    expect(checkLines(instant, seconds({ par: null, exact: true, way: null, kept: null }, { moves: [], firsts: 0, trap: null }), null)[0]).toBe('решения нет');
    expect(checkLines(instant, seconds({ par: null, exact: false, way: null, kept: 'missing' }, { moves: [], trap: null }), null)[0]).toBe('решатель сдался, решения не нашёл');
    expect(checkLines(instant, seconds({ kept: 'shorter', par: 4 }), null)[1]).toBe('записанный путь длиннее: есть путь за 4 хода');
    expect(checkLines(instant, seconds({ kept: 'broken' }), null)[1]).toBe('записанный путь не проходит доску');
    expect(checkLines(instant, seconds({ kept: null }), null)[1]).toBe('пути в файле нет');
    expect(checkLines(instant, seconds({}, { trap: 0 }), null)[3]).toBe('ловушка: есть, тупик сразу');
    expect(checkLines(instant, seconds({}, { trap: null }), null)[3]).toBe('ловушки нет');
  });
  it('says whether the way the file keeps holds on a board the solver found no way on', () => {
    expect(checkLines(instant, seconds({ par: null, exact: false, way: null, kept: 'missing' }, { moves: [], trap: null }), null)).toEqual([
      'решатель сдался, решения не нашёл',
      'решатель сдался; записанный путь проходит доску',
      'боты: считаю…',
    ]);
    expect(checkLines(instant, seconds({ par: null, exact: true, way: null, kept: 'broken' }, { moves: [], trap: null }), null)).toEqual([
      'решения нет',
      'записанный путь не проходит доску',
      'боты: считаю…',
    ]);
    expect(checkLines(instant, seconds({ par: null, exact: true, way: null, kept: null }, { moves: [], trap: null }), null)).toEqual(['решения нет', 'боты: считаю…']);
  });
  it('says first moves the search gave up on as not counted, not as leading nowhere', () => {
    const open = seconds({}, {
      moves: [
        { move: '0,0,E', keeps: 'par', par: 6, deadEnd: null },
        { move: '0,0,S', keeps: 'unknown', par: null, deadEnd: null },
        { move: '0,0,N', keeps: 'unknown', par: null, deadEnd: null },
        { move: '0,0,W', keeps: 'dead', par: null, deadEnd: 'count' },
      ],
    });
    expect(checkLines(instant, open, null)[2]).toBe('первые ходы: 1 из 4 ведут к решению, 1 сразу в тупик, 2 не досчитаны');
    const none = seconds({}, { moves: [{ move: '0,0,E', keeps: 'unknown', par: null, deadEnd: null }] });
    expect(checkLines(instant, none, null)[2]).toBe('первые ходы: 0 из 1 ведут к решению, 1 не досчитаны');
  });
  it('says the measures of the depth of a board after the bots, a graph not walked whole with a plus', () => {
    const measures = { d: 5.5, rank: 3, forks: 2, hidden: 1, ways: 2, waysLong: 5, complete: true };
    const lines = checkLines(instant, seconds(), { ...later, measures });
    expect(lines.slice(4, 6)).toEqual(['боты из 10: торопливый 1, обычный 3, внимательный 7, планирующий 10', 'мерила: D 5.5, rank 3, развилок 2, скрыто 1, путей 2/5']);
    expect(checkLines(instant, seconds(), { ...later, measures: { ...measures, d: 7, complete: false } })[5]).toBe('мерила: D 7, rank 3, развилок 2, скрыто 1, путей 2/5+');
    expect(checkLines(instant, seconds(), { ...later, measures: { ...measures, rank: null } })[5]).toBe('мерила: D 5.5, rank >8, развилок 2, скрыто 1, путей 2/5');
  });
  it('says no measures where the bots found no way to measure', () => {
    expect(checkLines(instant, seconds(), { ...later, measures: null }).some((line) => line.startsWith('мерила'))).toBe(false);
  });
  it('says how alike a board of the row is to the five places before it and to the most alike before, only where the row is given', () => {
    expect(checkLines(instant, seconds(), later).some((line) => line.startsWith('похожесть'))).toBe(false);
    const near = [
      { number: 29, code: 'floor-first-1', sim: 0.82 },
      { number: 49, code: 'a', sim: 0.1 },
      { number: 50, code: 'b', sim: 0.2 },
      { number: 51, code: 'c', sim: 0.3 },
      { number: 52, code: 'd', sim: 0.4 },
      { number: 53, code: 'e', sim: 0.25 },
      { number: 54, code: 'bridge-5', sim: 0.314 },
    ];
    expect(checkLines(instant, seconds(), later, near).at(-1)).toBe('похожесть: 54 bridge-5 0.31, 53 e 0.25, 52 d 0.40, 51 c 0.30, 50 b 0.20; ближе всех — 29 floor-first-1 0.82');
    // The lines of the tiers still being counted, the likeness is said all the same: the page reads it off the row.
    expect(checkLines(instant, null, null, near.slice(5)).at(-1)).toBe('похожесть: 54 bridge-5 0.31, 53 e 0.25; ближе всех — 54 bridge-5 0.31');
    expect(checkLines(instant, null, null, []).at(-1)).toBe('похожесть: прежних мест нет');
  });
  it('says a board that stands in a dead end as it is', () => {
    expect(checkLines({ ...instant, deadEnd: 'count' }, null, null)[0]).toBe('доска стоит в тупике как есть');
  });
});

describe('the line over a board of the row that keeps no way yet', () => {
  it('says nothing of a board not of the row', () => {
    expect(rowPathLine('D', null)).toBeNull();
    expect(rowPathLine(undefined, seconds({ par: null, exact: true, way: null }))).toBeNull();
  });
  it('says the row waits while the solver counts', () => {
    expect(rowPathLine('R', null)).toBe('ряд не соберётся, пока не записан путь');
  });
  it('says why the way cannot be written', () => {
    expect(rowPathLine('R', seconds({ par: null, exact: true, way: null, kept: null }))).toBe('ряд не соберётся: решения нет');
    expect(rowPathLine('R', seconds({ par: null, exact: false, way: null, kept: null }))).toBe('ряд не соберётся: решатель сдался, решения не нашёл');
    expect(rowPathLine('R', seconds({ exact: false }))).toBe('ряд не соберётся: решатель не доказал минимум');
    expect(rowPathLine('R', 'the worker fell')).toBe('ряд не соберётся: the worker fell');
  });
  it('says nothing once the fewest moves are proved: the page writes them', () => {
    expect(rowPathLine('R', seconds())).toBeNull();
  });
});
