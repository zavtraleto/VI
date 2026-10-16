import { BOARD_MARKS, BOARD_STATUSES, parseBoard, readBoardHead, type BoardHead, type BoardMark, type BoardStatus, type BoardWords } from '../levels/boardFile';
import { asInRow, originsOf, placeOf, type Place, type LibraryRowChapter } from '../levels/library';
import type { LevelSpec } from '../rules/types';

/**
 * The table of the page of the library (`?lab=library`), as far as it can be said without a
 * page: a row to a file of `boards/`, the filters and the order of the rows. The page is
 * `libraryLab.ts`.
 */

/** What the solver says of a board, where it has been asked: the fewest moves, the route and the two measures. */
export interface Passport {
  par: number | null;
  exact: boolean;
  route?: string;
  turns?: number;
  away?: number;
}

/** A file of `boards/` as a row of the table. */
export interface LibraryRow {
  name: string;
  text: string;
  hash: string | null;
  /** The board as the row plays it (on the faces of its chapter); null where the file is no board. */
  spec: LevelSpec | null;
  error: string | null;
  head: BoardHead;
  place: Place | null;
  passport: Passport | null;
}

/** A file read as a row: the board strictly where it is one, as it is written where the rules refuse it. */
export function rowOf(file: { name: string; text: string; hash: string | null }, chapters: readonly LibraryRowChapter[]): LibraryRow {
  const place = placeOf(file.name, chapters);
  let spec: LevelSpec | null = null;
  let error: string | null = null;
  try {
    spec = parseBoard(file.text, file.name);
  } catch (thrown) {
    error = (thrown as Error).message;
    try {
      spec = parseBoard(file.text, file.name, true);
    } catch {
      spec = null;
    }
  }
  return { ...file, spec: spec && asInRow(spec, place, chapters), error, head: readBoardHead(file.text), place, passport: null };
}

/** The faces a row shows: those it is played on. */
export function facesOf(row: LibraryRow): readonly number[] {
  return row.spec ? row.spec.faces ?? row.spec.values : [];
}

/** The last words said of a board. */
export function lastWords(row: LibraryRow): BoardWords | null {
  return row.head.words?.at(-1) ?? null;
}

/** What the table is narrowed to: each left empty is not asked. `chapter` is a number, or `none` for a board out of the row. */
export interface LibraryFilter {
  status: '' | BoardStatus;
  chapter: string;
  faces: string;
  tag: string;
  mark: '' | 'none' | BoardMark;
  text: string;
}

export const NO_FILTER: LibraryFilter = { status: '', chapter: '', faces: '', tag: '', mark: '', text: '' };

/** The rows the filter lets through, in their order. Faces: every face named is one the board works on. Text: in the name, the origin or the words. */
export function filterRows(rows: readonly LibraryRow[], filter: LibraryFilter): LibraryRow[] {
  const faces = filter.faces.split(/[\s,]+/).filter(Boolean).map(Number);
  const text = filter.text.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.status && row.head.status !== filter.status) return false;
    if (filter.chapter === 'none' ? row.place !== null : filter.chapter !== '' && String(row.place?.chapter ?? '') !== filter.chapter) return false;
    if (faces.length > 0 && !faces.every((face) => facesOf(row).includes(face))) return false;
    if (filter.tag.trim() && !(row.head.tags ?? []).includes(filter.tag.trim())) return false;
    if (filter.mark === 'none' ? row.head.mark !== undefined : filter.mark !== '' && row.head.mark !== filter.mark) return false;
    if (text) {
      const said = [row.name, row.head.origin ?? '', ...(row.head.words ?? []).map((word) => word.text), row.head.note ?? ''].join('\n').toLowerCase();
      if (!said.includes(text)) return false;
    }
    return true;
  });
}

/** The columns of the table, in their order: what each is called and what it sorts by. */
export const COLUMNS = [
  { key: 'name', title: 'код' },
  { key: 'status', title: 'статус' },
  { key: 'place', title: 'место' },
  { key: 'chapter', title: 'глава' },
  { key: 'faces', title: 'грани' },
  { key: 'dice', title: 'костей' },
  { key: 'par', title: 'par' },
  { key: 'route', title: 'маршрут' },
  { key: 'turns', title: 'turns' },
  { key: 'away', title: 'away' },
  { key: 'mark', title: 'оценка' },
  { key: 'words', title: 'последние слова' },
  { key: 'origin', title: 'откуда' },
] as const;
export type SortKey = (typeof COLUMNS)[number]['key'];

/** What a row is sorted by in a column: a number or a text; null for a row that has nothing there, and goes last either way. */
function sortValue(row: LibraryRow, key: SortKey): number | string | null {
  switch (key) {
    case 'name':
      return row.name;
    case 'status':
      return row.head.status ? (['R', 'RC', 'D', 'N', 'X'] as const).indexOf(row.head.status) : null;
    case 'place':
      return row.place?.number ?? null;
    case 'chapter':
      return row.place?.chapter ?? null;
    case 'faces':
      return facesOf(row).join(' ') || null;
    case 'dice':
      return row.spec?.norm ?? null;
    case 'par':
      return row.passport?.par ?? row.spec?.par ?? null;
    case 'route':
      return row.passport?.route ?? null;
    case 'turns':
      return row.passport?.turns ?? null;
    case 'away':
      return row.passport?.away ?? null;
    case 'mark':
      return row.head.mark ? BOARD_MARKS.indexOf(row.head.mark) : null;
    case 'words':
      return lastWords(row)?.date ?? null;
    case 'origin':
      return originsOf(row.head)[0] ?? null;
  }
}

/** The rows in the order of a column, one way or the other; a row with nothing in the column goes last, and rows that are equal keep the order of their names. */
export function sortRows(rows: readonly LibraryRow[], key: SortKey, way: 1 | -1): LibraryRow[] {
  const byName = (a: LibraryRow, b: LibraryRow): number => a.name.localeCompare(b.name, 'en', { numeric: true });
  return [...rows].sort((a, b) => {
    const x = sortValue(a, key);
    const y = sortValue(b, key);
    if (x === null || y === null) return x === y ? byName(a, b) : x === null ? 1 : -1;
    const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ru', { numeric: true });
    return order * way || byName(a, b);
  });
}

/** The statuses and the marks the filters offer. */
export const STATUS_CHOICES: readonly ('' | BoardStatus)[] = ['', ...BOARD_STATUSES];
export const MARK_CHOICES: readonly ('' | 'none' | BoardMark)[] = ['', ...BOARD_MARKS, 'none'];
