import { describe, expect, it } from 'vitest';
import { printBoard } from '../levels/boardFile';
import type { RowChapter } from '../levels/library';
import { ROAD } from '../levels/road';
import { NO_FILTER, filterRows, rowOf, sortRows, type LibraryRow } from './libraryRows';

const CHAPTERS: readonly RowChapter[] = [
  { id: 0, title: 'prologue', faces: null, stops: ['A'] },
  { id: 1, title: 'road', faces: [2, 3], stops: ['B'] },
];

function row(name: string, spec: (typeof ROAD)[number], head: Parameters<typeof printBoard>[1]): LibraryRow {
  return rowOf({ name, text: printBoard({ ...spec, id: name }, head), hash: null }, CHAPTERS);
}

const ROWS = [
  row('A', ROAD[0], { status: 'R', origin: 'дорога, редакция 7', mark: 'норм', words: [{ date: '2026-10-14', text: 'ок' }] }),
  row('B', ROAD[3], { status: 'R', origin: 'проба 7 октября', tags: ['мост'] }),
  row('C10', ROAD[4], { status: 'RC', mark: 'огонь', origin: 'курс 6 октября' }),
  row('C9', ROAD[5], { status: 'X', mark: 'мимо', origin: 'дорога, редакция 1', words: [{ date: '2026-10-11', text: 'убрать' }] }),
  row('D', ROAD[6], { status: 'D' }),
];
const names = (rows: readonly LibraryRow[]): string[] => rows.map((one) => one.name);

describe('a file as a row', () => {
  it('knows its place, and plays a board of a chapter on the faces of the chapter', () => {
    expect(ROWS[0].place).toEqual({ number: 1, chapter: 0, title: 'prologue' });
    expect(ROWS[1].place?.number).toBe(2);
    expect(ROWS[1].spec?.faces).toEqual([2, 3]);
    expect(ROWS[2].place).toBeNull();
    expect(rowOf({ name: 'X', text: 'id: X\nfaces: 2\n---\n 23  65\n  .   .\n', hash: null }, CHAPTERS).error).toMatch(/one start/);
  });
});

describe('the filters', () => {
  it('narrow by status, chapter, faces, tag, mark and text', () => {
    expect(names(filterRows(ROWS, { ...NO_FILTER, status: 'R' }))).toEqual(['A', 'B']);
    expect(names(filterRows(ROWS, { ...NO_FILTER, chapter: '1' }))).toEqual(['B']);
    expect(names(filterRows(ROWS, { ...NO_FILTER, chapter: 'none' }))).toEqual(['C10', 'C9', 'D']);
    expect(names(filterRows(ROWS, { ...NO_FILTER, faces: '2 3' }))).toEqual(names(ROWS.filter((one) => [2, 3].every((face) => (one.spec?.faces ?? []).includes(face)))));
    expect(names(filterRows(ROWS, { ...NO_FILTER, tag: 'мост' }))).toEqual(['B']);
    expect(names(filterRows(ROWS, { ...NO_FILTER, mark: 'огонь' }))).toEqual(['C10']);
    expect(names(filterRows(ROWS, { ...NO_FILTER, mark: 'none' }))).toEqual(['B', 'D']);
    expect(names(filterRows(ROWS, { ...NO_FILTER, text: 'УБРАТЬ' }))).toEqual(['C9']);
    expect(names(filterRows(ROWS, { ...NO_FILTER, text: 'курс' }))).toEqual(['C10']);
    expect(names(filterRows(ROWS, NO_FILTER))).toEqual(names(ROWS));
  });
});

describe('the order', () => {
  it('goes by a column either way, with the empty last and the names in their numeric order', () => {
    expect(names(sortRows(ROWS, 'name', 1))).toEqual(['A', 'B', 'C9', 'C10', 'D']);
    expect(names(sortRows(ROWS, 'place', 1))).toEqual(['A', 'B', 'C9', 'C10', 'D']);
    expect(names(sortRows(ROWS, 'place', -1))).toEqual(['B', 'A', 'C9', 'C10', 'D']);
    expect(names(sortRows(ROWS, 'status', 1))).toEqual(['A', 'B', 'C10', 'D', 'C9']);
    expect(names(sortRows(ROWS, 'mark', 1))).toEqual(['C10', 'A', 'C9', 'B', 'D']);
    expect(names(sortRows(ROWS, 'words', -1))).toEqual(['A', 'C9', 'B', 'C10', 'D']);
    expect(names(sortRows(ROWS, 'route', 1))).toEqual(['A', 'B', 'C9', 'C10', 'D']);
  });
});
