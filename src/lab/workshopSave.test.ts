import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import type { Seconds } from './labFacts';
import { emptyBoard, stepsAway } from './editBoard';
import { headOnly, provedSave, rowSave, stateLine, type StateOf } from './workshopSave';

const lines = (over: Partial<StateOf>): string[] => stateLine({ name: 'bridge-3', status: 'D', place: null, batch: undefined, unsaved: 0, outside: false, locked: false, ...over }).split('\n');

describe('the state line over the field, three short lines', () => {
  it('says which board it is and where it stands, first', () => {
    expect(lines({ name: 'R05', status: 'R', place: { number: 6, chapter: 1, title: 'Дорога' } })[0]).toBe('R05 — в кампании, уровень 6, глава «Дорога»');
    expect(lines({ status: 'N', batch: 'bridge 2026-10-16' })[0]).toBe('bridge-3 — новая, пачка bridge');
    expect(lines({ status: 'N' })[0]).toBe('bridge-3 — новая');
    expect(lines({ name: 'collapse-5' })[0]).toBe('collapse-5 — черновик');
    expect(lines({ status: 'RC' })[0]).toBe('bridge-3 — хорошая');
    expect(lines({ status: 'X' })[0]).toBe('bridge-3 — убрана');
    expect(lines({ name: 'R40', status: 'R' })[0]).toBe('R40 — в кампании, без места в row.json');
  });
  it('says whether it is saved, second, with the number of edits in its Russian form', () => {
    expect(lines({})[1]).toBe('сохранено');
    expect(lines({ unsaved: 1 })[1]).toBe('не сохранено: 1 правка');
    expect(lines({ unsaved: 3 })[1]).toBe('не сохранено: 3 правки');
    expect(lines({ unsaved: 11 })[1]).toBe('не сохранено: 11 правок');
  });
  it('says that the file was changed from outside, only while there are edits to save over it', () => {
    expect(lines({ unsaved: 2, outside: true })[1]).toBe('не сохранено: 2 правки; файл изменён снаружи — сохранить перезапишет его');
    expect(lines({ outside: true })[1]).toBe('сохранено');
  });
  it('says what saving will do, third: change the level in the game, or write the file', () => {
    expect(lines({ name: 'R05', status: 'R', place: { number: 6, chapter: 1, title: 'Дорога' } })[2]).toBe('сохранить — изменит уровень 6 в игре');
    expect(lines({})[2]).toBe('сохранить — запишет файл доски');
    expect(lines({ name: 'R40', status: 'R' })[2]).toBe('сохранить — запишет файл доски');
    expect(lines({ locked: true })[2]).toBe('файл не читается как доска — страница его не пишет');
    expect(lines({})).toHaveLength(3);
  });
  it('is empty with no board in hand', () => {
    expect(stateLine({ name: '', status: undefined, place: null, batch: undefined, unsaved: 0, outside: false, locked: false })).toBe('');
  });
});

describe('the edits since the board was saved, as steps to take back', () => {
  it('counts the steps away from the saved board along the history', () => {
    expect(stepsAway(0, 0, 0)).toBe(0);
    expect(stepsAway(3, 0, 0)).toBe(3);
    // Taken back below the saved board and made again: back up to it.
    expect(stepsAway(1, 3, 3)).toBe(2);
    expect(stepsAway(3, 3, 3)).toBe(0);
    // A new edit made two steps below the saved board: two back to the fork, and the new ones from it.
    expect(stepsAway(2, 3, 1)).toBe(3);
    expect(stepsAway(1, 3, 1)).toBe(2);
    expect(stepsAway(0, 3, 1)).toBe(3);
  });
});

const head = { id: 'R01', seed: 0, size: 3, goal: { kind: 'clear' }, moves: 0, values: [2], norm: 0, arrival: 'none' } as LevelSpec;
const seconds = (over: Partial<Seconds['check']> = {}): Seconds => ({
  check: { par: 3, exact: true, states: 10, way: ['0,1,N', '0,0,E', '1,0,S'], score: null, kept: null, ...over },
  firsts: 1,
  moves: [],
  trap: null,
});
const rowBoard = (more: Partial<LevelSpec> = {}, locked = false) => ({ extra: { status: 'R' as const }, head: { ...head, ...more }, locked });

describe('saving a board of the row', () => {
  it('waits while the solver counts', () => {
    expect(rowSave(rowBoard(), null, null)).toEqual({ kind: 'wait' });
  });
  it('writes the way proved with the board, in one write', () => {
    expect(rowSave(rowBoard(), seconds(), null)).toEqual({ kind: 'write', head: { ...head, par: 3, exact: true, solution: ['0,1,N', '0,0,E', '1,0,S'] } });
  });
  it('writes the board with the way it keeps where that way holds', () => {
    const keeps = { par: 3, exact: true, solution: ['0,1,E', '0,0,N', '1,0,S'] };
    expect(rowSave(rowBoard(keeps), seconds({ kept: 'same' }), null)).toEqual({ kind: 'write', head: { ...head, ...keeps } });
  });
  it('refuses a board with no way, a minimum not proved, an answer that failed and a board the rules refuse, and points to the copy', () => {
    const none = rowSave(rowBoard(), seconds({ par: null, way: null }), null);
    expect(none).toEqual({ kind: 'refuse', line: expect.stringMatching(/^у доски нет решения — в кампанию не сохраняется; .*«копия»/) });
    expect(rowSave(rowBoard(), seconds({ par: null, exact: false, way: null }), null)).toEqual({ kind: 'refuse', line: expect.stringMatching(/^решатель не доказал минимум — не сохранено; .*«копия»/) });
    expect(rowSave(rowBoard(), seconds({ exact: false }), null)).toEqual({ kind: 'refuse', line: expect.stringMatching(/^решатель не доказал минимум — не сохранено/) });
    expect(rowSave(rowBoard(), seconds({ par: 0, way: [] }), null)).toEqual({ kind: 'refuse', line: expect.stringMatching(/^решатель не доказал минимум/) });
    expect(rowSave(rowBoard(), 'the worker fell', null)).toEqual({ kind: 'refuse', line: expect.stringMatching(/^решатель не ответил \(the worker fell\) — не сохранено/) });
    expect(rowSave(rowBoard(), null, 'no start')).toEqual({ kind: 'refuse', line: expect.stringMatching(/^правила не принимают доску: no start — не сохранено/) });
  });
  it('never writes a locked board', () => {
    expect(rowSave(rowBoard({}, true), seconds(), null)).toEqual({ kind: 'refuse', line: expect.stringMatching(/не читается/) });
  });
});

describe('a save of a board of the row while the proof is counted', () => {
  const drawn = emptyBoard(3);
  const at = { name: 'R05', board: drawn, head };
  const now = (over: Partial<{ name: string; board: typeof drawn; head: LevelSpec }> = {}) => ({ ...rowBoard(), name: 'R05', board: drawn, ...over });
  it('writes the very board the save was pressed on, with the way proved', () => {
    expect(provedSave(at, now({ head }), seconds(), null)).toEqual({ kind: 'write', head: { ...head, par: 3, exact: true, solution: ['0,1,N', '0,0,E', '1,0,S'] } });
    expect(provedSave(at, now({ head, name: 'r05' }), null, null)).toEqual({ kind: 'wait' });
  });
  it('is dropped where the board in hand is another: opened anew, read again or changed', () => {
    const dropped = { kind: 'refuse', line: expect.stringMatching(/^сохранение прервано/) };
    expect(provedSave(at, now({ head, name: 'R06' }), seconds(), null)).toEqual(dropped);
    expect(provedSave(at, now({ head, board: emptyBoard(3) }), seconds(), null)).toEqual(dropped);
    expect(provedSave(at, now({ head: { ...head } }), seconds(), null)).toEqual(dropped);
  });
  it('is refused where the proof fails, as any save of the row', () => {
    expect(provedSave(at, now({ head }), seconds({ par: null, way: null }), null)).toEqual({ kind: 'refuse', line: expect.stringMatching(/^у доски нет решения/) });
  });
});

describe('a change of the file from outside that is of its head alone', () => {
  const board = ['id: T', 'status: N', 'faces: 2', '---', '21*  .', ' .  21'];
  const text = (...over: string[]): string => [...board.slice(0, 1), ...over, ...board.slice(2)].join('\n');
  it('is a change of the status, the words or the mark, the board the same', () => {
    expect(headOnly(text('status: N'), text('status: D', 'words: 2026-10-17: ок'), 'T')).toBe(true);
  });
  it('is not a change of the board, its faces or its way', () => {
    expect(headOnly(text('status: N'), [...board.slice(0, 4), '21*  .', ' .  31'].join('\n'), 'T')).toBe(false);
    expect(headOnly(text('status: N'), text('status: N').replace('faces: 2', 'faces: 2 3'), 'T')).toBe(false);
  });
  it('is not where either text is no board', () => {
    expect(headOnly('not a board', text('status: D'), 'T')).toBe(false);
  });
});
