import { describe, expect, it } from 'vitest';
import type { LibraryRowChapter } from '../levels/library';
import { ROLES, type RowFile } from '../levels/row';
import { ROLE_TITLES, batchTitle, batchesOf, chaptersOf, freeName, listRows, nextInBatch, plural, rowOf, verdictPatch } from './workshopLists';

const ROW: readonly LibraryRowChapter[] = [{ id: 0, title: 'prologue', faces: null, stops: ['R01'] }];
const file = (name: string, head: string, time?: string) => rowOf({ name, text: `id: ${name}\n${head}faces: 2\n---\n21* 21\n .   .\n`, hash: null, time }, ROW);
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
  it('keeps the time of the file as the time the board was touched', () => {
    expect(file('t-1', 'status: N\n', '2026-10-16T09:00:00.000Z').touched).toBe('2026-10-16T09:00:00.000Z');
    expect(file('t-1', 'status: N\n').touched).toBe('');
  });
  it('puts first the board marked last, though no words were said of it', () => {
    const good = [file('good-a', 'status: RC\nwords: 2026-10-15: ровная\n', '2026-10-15T08:00:00.000Z'), file('good-b', 'status: RC\n', '2026-10-16T10:00:00.000Z')];
    expect(listRows(good, 'good', '').map((row) => row.name)).toEqual(['good-b', 'good-a']);
    const redo = [file('old-a', 'status: D\nwords: 2026-10-14: почти\n'), file('old-b', 'status: D\nwords: 2026-10-10: длинно\n', '2026-10-16T07:00:00.000Z')];
    expect(listRows(redo, 'redo', '').map((row) => row.name)).toEqual(['old-b', 'old-a']);
  });
  it('orders names by their numbers in «все»', () => {
    const named = [file('bridge-10', 'status: N\n'), file('bridge-2', 'status: N\n'), file('arch-1', 'status: D\n')];
    expect(listRows(named, 'all', '').map((row) => row.name)).toEqual(['arch-1', 'bridge-2', 'bridge-10']);
  });
  it('puts a board of the row with no place last in «в кампании»', () => {
    const row = [file('R99', 'status: R\n'), file('R01', 'status: R\n')];
    expect(row[0].place).toBeNull();
    expect(listRows(row, 'row', '').map((one) => one.name)).toEqual(['R01', 'R99']);
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

describe('the chapters of «в кампании»', () => {
  const sample: RowFile = {
    chapters: [
      { title: 'prologue', places: [{ board: 'R01', role: 'meet', archetype: 'roll' }] },
      { title: 'road', faces: [2, 3], places: [{ board: 'gone-1', role: 'apply', archetype: 'bridge' }, { board: 'R03', role: 'rest', archetype: 'domino' }] },
    ],
  };
  it('gives the chapters in order, the places numbered through the row from 1, each with the row of its board', () => {
    const chapters = chaptersOf([file('R03', 'status: R\n'), file('R01', 'status: R\n')], sample);
    expect(chapters.map((chapter) => [chapter.title, chapter.faces])).toEqual([['prologue', null], ['road', [2, 3]]]);
    expect(chapters.flatMap((chapter) => chapter.places.map((place) => [place.number, place.place.board, place.row?.name ?? null]))).toEqual([
      [1, 'R01', 'R01'],
      [2, 'gone-1', null],
      [3, 'R03', 'R03'],
    ]);
    expect(chapters[1].places[1].place.role).toBe('rest');
  });
  it('has a Russian word for every role of the row', () => {
    expect(Object.keys(ROLE_TITLES).sort()).toEqual([...ROLES].sort());
    expect(ROLE_TITLES.meet).toBe('встреча');
    expect(ROLE_TITLES.rest).toBe('передышка');
  });
});

describe('a name for a board begun anew', () => {
  it('takes the first number free, in any letter case, as the disk of Windows does', () => {
    expect(freeName('bridge', [])).toBe('bridge-1');
    expect(freeName('bridge', ['bridge-1', 'Bridge-2', 'bridge-4'])).toBe('bridge-3');
    expect(freeName('P06-try', ['P06', 'p06-try-1'])).toBe('P06-try-2');
  });
});
