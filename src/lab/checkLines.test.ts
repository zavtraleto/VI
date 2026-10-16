import { describe, expect, it } from 'vitest';
import type { Instant, Later, Seconds } from './labFacts';
import { checkLines } from './checkLines';

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
const later = { report: { personas: { hasty: passed(0.1), casual: passed(0.3), careful: passed(0.7), planner: passed(1), greedy: passed(0) } }, near: [], spare: [] } as unknown as Later;

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
  it('says a board that stands in a dead end as it is', () => {
    expect(checkLines({ ...instant, deadEnd: 'count' }, null, null)[0]).toBe('доска стоит в тупике как есть');
  });
});
