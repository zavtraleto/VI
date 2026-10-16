import { parseBoard, readBoardHead, type BoardHead, type BoardStatus } from '../levels/boardFile';
import { asInRow, placeOf, type Place, type LibraryRowChapter } from '../levels/library';
import type { Role, RowFile, RowPlaceFile } from '../levels/row';
import type { LevelSpec } from '../rules/types';
import type { HeadPatch } from './boardsServer';

/**
 * The lists of the workshop (`?lab=workshop`, docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md,
 * section 3.1), as far as they can be said without a page.
 */

/** The lists of the page, by the status of a board; `all` is every board. */
export type ListKey = 'new' | 'redo' | 'good' | 'row' | 'all';

/** What the owner says of a board after a play. */
export type Verdict = 'good' | 'redo' | 'drop';

/** A file of `boards/` as a row of a list. */
export interface BoardRow {
  name: string;
  text: string;
  hash: string | null;
  /** The board as the row plays it (on the faces of its chapter); null where the file is no board. */
  spec: LevelSpec | null;
  error: string | null;
  head: BoardHead;
  place: Place | null;
  /** When the file was last written, as an ISO time; empty where the server did not say. */
  touched: string;
}

/** The new boards of one order: the word and the day of the batch, and its boards by number. */
export interface Batch {
  key: string;
  word: string;
  date: string;
  rows: BoardRow[];
}

export const LISTS: readonly { key: ListKey; title: string }[] = [
  { key: 'new', title: 'новые' },
  { key: 'redo', title: 'доделать' },
  { key: 'good', title: 'хорошие' },
  { key: 'row', title: 'в кампании' },
  { key: 'all', title: 'все' },
];
const STATUS_OF: Readonly<Record<Exclude<ListKey, 'all'>, BoardStatus>> = { new: 'N', redo: 'D', good: 'RC', row: 'R' };
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** The number of a board in its batch: `bridge-12` is 12; a name with no number is 0. */
const numberOf = (name: string): number => Number(/-(\d+)$/.exec(name)?.[1] ?? 0);
/** When a board was last touched: the later of the time of its file and the day of its last words (ISO texts compare as text). */
const lastTouched = (row: BoardRow): string => {
  const said = row.head.words?.at(-1)?.date ?? '';
  return said > row.touched ? said : row.touched;
};
/** Names in the order of their numbers: `bridge-2` before `bridge-10`. */
const byName = (a: BoardRow, b: BoardRow): number => a.name.localeCompare(b.name, undefined, { numeric: true });

/** A file read as a row: the board strictly where it is one, as it is written where the rules refuse it. */
export function rowOf(file: { name: string; text: string; hash: string | null; time?: string }, chapters: readonly LibraryRowChapter[]): BoardRow {
  const { time, ...kept } = file;
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
  return { ...kept, spec: spec && asInRow(spec, place, chapters), error, head: readBoardHead(file.text), place, touched: time ?? '' };
}

/** The word of a number in its Russian form: 1 доска, 2 доски, 5 досок, 21 доска. */
export function plural(n: number, [one, few, many]: readonly [string, string, string]): string {
  const tens = n % 100;
  const units = n % 10;
  if (tens >= 11 && tens <= 14) return many;
  return units === 1 ? one : units >= 2 && units <= 4 ? few : many;
}

function found(row: BoardRow, search: string): boolean {
  const said = search.trim().toLowerCase();
  if (said === '') return true;
  return [row.name, ...(row.head.was ?? []), row.head.note ?? '', ...(row.head.words ?? []).map((word) => word.text)].some((text) => text.toLowerCase().includes(said));
}

/** The rows of a list the search finds, in its order: the new by batch, the row by place (no place last), all by name, the rest the last touched first. */
export function listRows(rows: readonly BoardRow[], key: ListKey, search: string): BoardRow[] {
  const shown = rows.filter((row) => (key === 'all' || row.head.status === STATUS_OF[key]) && found(row, search));
  if (key === 'new') return batchesOf(shown).flatMap((batch) => batch.rows);
  if (key === 'row') return shown.sort((a, b) => (a.place?.number ?? Infinity) - (b.place?.number ?? Infinity) || byName(a, b));
  if (key === 'all') return shown.sort(byName);
  return shown.sort((a, b) => lastTouched(b).localeCompare(lastTouched(a)) || byName(a, b));
}

/** The rows gathered by the batch they were laid in, the newest batch first, the boards of a batch by number. */
export function batchesOf(rows: readonly BoardRow[]): Batch[] {
  const batches = new Map<string, Batch>();
  for (const row of rows) {
    const key = row.head.batch ?? '';
    const [word = '', date = ''] = key.split(' ');
    const batch = batches.get(key) ?? { key, word: word || 'без пачки', date, rows: [] };
    batch.rows.push(row);
    batches.set(key, batch);
  }
  for (const batch of batches.values()) batch.rows.sort((a, b) => numberOf(a.name) - numberOf(b.name) || byName(a, b));
  return [...batches.values()].sort((a, b) => b.date.localeCompare(a.date) || a.word.localeCompare(b.word));
}

/** A batch as its heading says it: the word, the day and how many boards. */
export function batchTitle(batch: Batch): string {
  const [, month, day] = batch.date.split('-').map(Number);
  const when = month ? `, ${day} ${MONTHS[month - 1]}` : '';
  return `${batch.word}${when}, ${batch.rows.length} ${plural(batch.rows.length, ['доска', 'доски', 'досок'])}`;
}

/** The new board after a board in its batch; null after the last, or for a board of no batch. */
export function nextInBatch(rows: readonly BoardRow[], name: string): string | null {
  const row = rows.find((one) => one.name === name);
  if (!row?.head.batch) return null;
  const batch = batchesOf(rows.filter((one) => one.head.status === 'N' || one.name === name)).find((one) => one.key === row.head.batch);
  const at = batch?.rows.findIndex((one) => one.name === name) ?? -1;
  return batch?.rows[at + 1]?.name ?? null;
}

/**
 * The name of a board begun anew from a stem: `<stem>-<n>`, the first `n` free among the names. A
 * name is taken in any letters, small or great, as `batchFile` takes it: the disk of Windows does
 * not tell `Bridge-1.txt` from `bridge-1.txt`.
 */
export function freeName(stem: string, names: Iterable<string>): string {
  const taken = new Set([...names].map((name) => name.toLowerCase()));
  let number = 1;
  while (taken.has(`${stem}-${number}`.toLowerCase())) number++;
  return `${stem}-${number}`;
}

/** The verdicts after a play as the bar under the board offers them, with their keys. */
export const VERDICTS: readonly { verdict: Verdict; label: string; keys: readonly string[] }[] = [
  { verdict: 'good', label: '1 хорошая', keys: ['Digit1', 'Numpad1'] },
  { verdict: 'redo', label: '2 доделать', keys: ['Digit2', 'Numpad2'] },
  { verdict: 'drop', label: '3 убрать', keys: ['Digit3', 'Numpad3'] },
];
const STATUS_OF_VERDICT: Readonly<Record<Verdict, Exclude<BoardStatus, 'R'>>> = { good: 'RC', redo: 'D', drop: 'X' };
const WORD_OF_VERDICT: Readonly<Record<Verdict, string>> = { good: 'хорошая', redo: 'доделать', drop: 'убрать' };

/**
 * What a verdict after a play writes into the head of the file: the status it gives, and the
 * words with their day. A board of the row keeps R — the row is changed by the agent at the
 * word of the owner — so for it the verdict is written as a word. Null where nothing is said.
 */
export function verdictPatch(status: BoardStatus | undefined, verdict: Verdict | null, words: string, date: string): HeadPatch | null {
  const said = words.replace(/\s+/g, ' ').trim();
  if (status === 'R' && verdict) return { words: [{ date, text: said ? `${WORD_OF_VERDICT[verdict]}: ${said}` : WORD_OF_VERDICT[verdict] }] };
  if (!verdict && !said) return null;
  return { ...(verdict ? { status: STATUS_OF_VERDICT[verdict] } : {}), ...(said ? { words: [{ date, text: said }] } : {}) };
}

/** The roles of the row as the page says them (section 11.1). */
export const ROLE_TITLES: Readonly<Record<Role, string>> = { meet: 'встреча', learn: 'урок', apply: 'применение', event: 'событие', twist: 'поворот', peak: 'пик', rest: 'передышка' };

/** A chapter of «в кампании»: its title, its faces where it has its own, and its places numbered through the row. */
export interface ListChapter {
  title: string;
  faces: readonly number[] | null;
  /** Each place with the row of its board; null where the board has no file. */
  places: { number: number; row: BoardRow | null; place: RowPlaceFile }[];
}

/** The chapters of row.json as «в кампании» shows them: in order, the places numbered from 1 through the whole row. */
export function chaptersOf(rows: readonly BoardRow[], file: RowFile): ListChapter[] {
  const named = new Map(rows.map((row) => [row.name, row]));
  let number = 0;
  return file.chapters.map((chapter) => ({
    title: chapter.title,
    faces: chapter.faces ?? null,
    places: chapter.places.map((place) => ({ number: ++number, row: named.get(place.board) ?? null, place })),
  }));
}
