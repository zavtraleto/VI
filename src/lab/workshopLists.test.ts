import { describe, expect, it } from 'vitest';
import type { LibraryRowChapter } from '../levels/library';
import { batchTitle, batchesOf, listRows, nextInBatch, plural, rowOf, verdictPatch } from './workshopLists';

const ROW: readonly LibraryRowChapter[] = [{ id: 0, title: 'prologue', faces: null, stops: ['R01'] }];
const file = (name: string, head: string) => rowOf({ name, text: `id: ${name}\n${head}faces: 2\n---\n21* 21\n .   .\n`, hash: null }, ROW);
const rows = [
  file('bridge-2', 'status: N\nbatch: bridge 2026-10-16\n'),
  file('bridge-1', 'status: N\nbatch: bridge 2026-10-16\n'),
  file('stairs-1', 'status: N\nbatch: stairs 2026-10-17\n'),
  file('old-1', 'status: D\nwords: 2026-10-10: длинно\n'),
  file('old-2', 'status: D\nwords: 2026-10-14: почти\n'),
  file('good-1', 'status: RC\nwas: P13_s30460\n'),
  file('R01', 'status: R\n'),
  file('gone-1', 'status: X\nnote: скучная\n'),
];

describe('the lists of the workshop', () => {
  it('puts each board in the list of its status, and all of them in «все»', () => {
    expect(listRows(rows, 'new', '').map((row) => row.name)).toEqual(['stairs-1', 'bridge-1', 'bridge-2']);
    expect(listRows(rows, 'redo', '').map((row) => row.name)).toEqual(['old-2', 'old-1']);
    expect(listRows(rows, 'good', '').map((row) => row.name)).toEqual(['good-1']);
    expect(listRows(rows, 'row', '').map((row) => row.name)).toEqual(['R01']);
    expect(listRows(rows, 'all', '')).toHaveLength(8);
  });
  it('finds a board by its name, a name it had, its words and its note', () => {
    expect(listRows(rows, 'all', 'P13').map((row) => row.name)).toEqual(['good-1']);
    expect(listRows(rows, 'all', 'почти').map((row) => row.name)).toEqual(['old-2']);
    expect(listRows(rows, 'all', 'скучн').map((row) => row.name)).toEqual(['gone-1']);
    expect(listRows(rows, 'new', 'stairs').map((row) => row.name)).toEqual(['stairs-1']);
  });
  it('gathers the new boards by batch, the newest batch first, the boards by number', () => {
    const batches = batchesOf(listRows(rows, 'new', ''));
    expect(batches.map((batch) => batch.key)).toEqual(['stairs 2026-10-17', 'bridge 2026-10-16']);
    expect(batches[1].rows.map((row) => row.name)).toEqual(['bridge-1', 'bridge-2']);
    expect(batchTitle(batches[1])).toBe('bridge, 16 октября, 2 доски');
  });
  it('goes on to the next new board of the batch, and to none after the last', () => {
    expect(nextInBatch(rows, 'bridge-1')).toBe('bridge-2');
    expect(nextInBatch(rows, 'bridge-2')).toBeNull();
  });
  it('says a number with its word', () => {
    expect([1, 2, 5, 11, 21, 22].map((n) => plural(n, ['доска', 'доски', 'досок']))).toEqual(['доска', 'доски', 'досок', 'досок', 'доска', 'доски']);
  });
});

describe('a verdict written into the head', () => {
  it('gives a board its status, and the words with their day', () => {
    expect(verdictPatch('N', 'good', '', '2026-10-16')).toEqual({ status: 'RC' });
    expect(verdictPatch('D', 'drop', 'скучно', '2026-10-16')).toEqual({ status: 'X', words: [{ date: '2026-10-16', text: 'скучно' }] });
    expect(verdictPatch('RC', 'redo', '  длинно  ', '2026-10-16')).toEqual({ status: 'D', words: [{ date: '2026-10-16', text: 'длинно' }] });
  });
  it('leaves a board of the row in the row: the verdict is a word, not a status', () => {
    expect(verdictPatch('R', 'drop', 'длинно', '2026-10-16')).toEqual({ words: [{ date: '2026-10-16', text: 'убрать: длинно' }] });
    expect(verdictPatch('R', 'good', '', '2026-10-16')).toEqual({ words: [{ date: '2026-10-16', text: 'хорошая' }] });
  });
  it('writes words without a verdict, and nothing where nothing is said', () => {
    expect(verdictPatch('N', null, 'мост не виден', '2026-10-16')).toEqual({ words: [{ date: '2026-10-16', text: 'мост не виден' }] });
    expect(verdictPatch('N', null, '  ', '2026-10-16')).toBeNull();
  });
});
