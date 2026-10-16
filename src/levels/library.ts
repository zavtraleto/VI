import type { LevelSpec } from '../rules/types';
import type { Row } from './row';
import { BOARD_MARKS, normalSpec, parseBoard, printBoard, readBoardHead, type BoardHead, type BoardMark, type BoardStatus, type BoardWords } from './boardFile';

export { withHead } from './boardFile';
import { sameBoard } from './variety';
import { isBoardName } from '../app/boardProbe';

/**
 * The library of the boards (docs/superpowers/specs/2026-10-14-vi-board-library-design.md): every
 * board ever made is a file of `boards/`, and the file is the truth of it. These are the pure
 * parts that the script `scripts/library.mjs`, the page `?lab=library` and the test of the library
 * share: the names of the boards, the heads merged, the place of a board in the row, what is
 * checked of the files against the code, and the text a session of marks is given out as.
 *
 * The row is given to every function that needs it, as the chapters of the campaign are
 * (`rowChapters` of the row of `row.gen.ts`): the library reads the row, it does not hold it.
 */

/** A chapter of the row as the library needs it: its codes in order. */
export interface LibraryRowChapter {
  id: number;
  title: string;
  faces: readonly number[] | null;
  stops: readonly string[];
}

/** The chapters of a laid row as the library reads them: their codes in order. */
export function rowChapters(row: Row): LibraryRowChapter[] {
  return row.chapters.map((chapter) => ({ id: chapter.id, title: chapter.title, faces: chapter.faces, stops: row.places.slice(chapter.first, chapter.last + 1).map((place) => place.code) }));
}

/** Where a board stands in the row: its number from 1, and its chapter. */
export interface Place {
  number: number;
  chapter: number;
  title: string;
}

/** The code a board of an older edition of the road keeps where another board holds the code now: `R07e2`. */
export function codeWithEdition(code: string, edition: number): string {
  return `${code}e${edition}`;
}

/** The name of a board of a reserve: the code of its place and the seed it was laid from, `P01_s30512`. */
export function spareName(code: string, seed: number): string {
  return `${code}_s${seed}`;
}

/**
 * What is wrong with a map of renames (`library.mjs rename map=`), a line to a board: a board that
 * is not there, a board of the row (its code is what the progress of the players keeps), a name
 * taken by a board that is not renamed itself, a name given twice, a name that is no name of a
 * board. Empty where the map can be done.
 */
export function renameFaults(map: Readonly<Record<string, string>>, names: readonly string[], rowCodes: readonly string[]): string[] {
  const faults: string[] = [];
  const given = new Set<string>();
  const leaving = new Set(Object.keys(map));
  for (const [from, to] of Object.entries(map)) {
    if (!names.includes(from)) faults.push(`${from}: no such board`);
    else if (rowCodes.includes(from)) faults.push(`${from}: a board of the row keeps its code`);
    else if (!isBoardName(to)) faults.push(`${from}: "${to}" is no name of a board`);
    else if (given.has(to)) faults.push(`${from}: ${to} is given twice`);
    else if (names.includes(to) && !leaving.has(to)) faults.push(`${from}: ${to} is taken`);
    given.add(to);
  }
  return faults;
}

/** The file a name is of: the file of that name, or the one that had the name before (`was`). */
export function resolveName(name: string, files: readonly { name: string; text: string }[]): string | null {
  if (files.some((file) => file.name === name)) return name;
  return files.find((file) => readBoardHead(file.text).was?.includes(name))?.name ?? null;
}

/** The codes of the row in its order. */
export function rowCodes(chapters: readonly LibraryRowChapter[]): string[] {
  return chapters.flatMap((chapter) => chapter.stops);
}

/** The place of a board in the row, by its name; null for a board that is not in it. */
export function placeOf(name: string, chapters: readonly LibraryRowChapter[]): Place | null {
  let number = 0;
  for (const chapter of chapters) {
    for (const stop of chapter.stops) {
      number++;
      if (stop === name) return { number, chapter: chapter.id, title: chapter.title };
    }
  }
  return null;
}

/** The board as the row plays it: on the faces of its chapter and with the floor open, as `levels.ts` lays a board of a chapter. */
export function asInRow(spec: LevelSpec, place: Place | null, chapters: readonly LibraryRowChapter[]): LevelSpec {
  const faces = place ? chapters.find((chapter) => chapter.id === place.chapter)?.faces : null;
  if (!faces) return spec;
  const { floor: _floor, ...open } = { ...spec, faces, values: faces };
  return open;
}

/** A board as a file under its name, with its head. */
export function fileOfSpec(spec: LevelSpec, name: string, head: BoardHead = {}): string {
  return printBoard({ ...spec, id: name }, head);
}

/** The sources a board is from, as `origin` says them: a list, the oldest first, split on `; `. */
export function originsOf(head: BoardHead): string[] {
  return (head.origin ?? '').split(';').map((part) => part.trim()).filter((part) => part !== '');
}

/**
 * The sources of a board said short, the oldest first: a source said twice is said once, and the
 * editions of the road a board went through under one code are said as their span:
 * `дорога, редакции 3–6 (R06)`.
 */
export function compactOrigins(labels: readonly string[]): string[] {
  const groups: { key: string; first: string; editions: number[]; code: string }[] = [];
  for (const label of labels) {
    const code = /\s*(\([^)]*\))$/.exec(label)?.[1] ?? '';
    const edition = /^дорога, редакция (\d+)$/.exec(label.replace(/\s*\([^)]*\)$/, ''));
    const key = edition ? `road|${code}` : label;
    const group = groups.find((one) => one.key === key);
    if (group) {
      if (edition) group.editions.push(Number(edition[1]));
      continue;
    }
    groups.push({ key, first: label, editions: edition ? [Number(edition[1])] : [], code });
  }
  return groups.map((group) => {
    if (new Set(group.editions).size < 2) return group.first;
    const sorted = [...new Set(group.editions)].sort((a, b) => a - b);
    const span = sorted.every((edition, at) => at === 0 || edition === sorted[at - 1] + 1) ? `${sorted[0]}–${sorted.at(-1)}` : sorted.join(', ');
    return `дорога, редакции ${span}${group.code ? ` ${group.code}` : ''}`;
  });
}

/**
 * A head with what another head adds to it: the sources it is from, the words not yet said, the
 * tags not yet given, and the status and the mark where there were none. What the head says is
 * never taken back or written over.
 */
export function mergeHead(kept: BoardHead, more: BoardHead): BoardHead {
  const origins = [...originsOf(kept), ...originsOf(more).filter((origin) => !originsOf(kept).includes(origin))];
  const words = [...(kept.words ?? [])];
  for (const said of more.words ?? []) if (!words.some((word) => word.date === said.date && word.text === said.text)) words.push(said);
  const tags = [...(kept.tags ?? []), ...(more.tags ?? []).filter((tag) => !(kept.tags ?? []).includes(tag))];
  const { migrated: _migrated, ...rest } = kept;
  return {
    ...rest,
    ...(rest.note === undefined && more.note ? { note: more.note } : {}),
    ...(rest.status === undefined && more.status ? { status: more.status } : {}),
    ...(origins.length > 0 ? { origin: origins.join('; ') } : {}),
    ...(rest.mark === undefined && more.mark ? { mark: more.mark } : {}),
    ...(words.length > 0 ? { words } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };
}

/** The cells, the dice and the way of a board, with nothing else: what the file and the code must agree on. */
function diceAndWay(spec: LevelSpec): string {
  const { size, holes, layout, solution } = normalSpec(spec);
  return JSON.stringify({ size, holes: holes ?? [], layout, solution: solution ?? [] });
}

/** Two boards with the same cells, dice and start, and the same way kept: the faces they work on aside. */
export function sameDice(a: LevelSpec, b: LevelSpec): boolean {
  return diceAndWay(a) === diceAndWay(b);
}

/** One board turned or mirrored, whatever faces each works on: `sameBoard` of `variety.ts` with the faces of one lent to the other. */
export function sameBoardAnyFaces(a: LevelSpec, b: LevelSpec): boolean {
  return sameBoard(a, { ...b, faces: a.faces, values: a.values });
}

/**
 * The status a board is given where it is laid in the library: `R` in the row; a board out of
 * the row that its file said was in it, `RC`; else what its file says; else by the last mark of
 * the owner, `RC` for fire or fine and `X` for a miss; else a draft.
 */
export function statusFor(name: string, said: BoardStatus | undefined, mark: BoardMark | undefined, chapters: readonly LibraryRowChapter[]): BoardStatus {
  if (placeOf(name, chapters)) return 'R';
  if (said === 'R') return 'RC';
  if (said) return said;
  if (mark === 'мимо') return 'X';
  if (mark) return 'RC';
  return 'D';
}

/** A file of the library as it is read: its name, and its text. */
export interface LibraryFile {
  name: string;
  text: string;
}

/** The boards of the row as the game plays them, in its order. */
export interface CodeBoards {
  row: readonly LevelSpec[];
}

/**
 * What is wrong between the files of the library and the code, a line to a fault with the code
 * of the board in it; empty where they agree. Every board of the row has a file under its code
 * with the same dice and way and the status `R`; every file with `R` is in the row; every file is
 * read and says a status of the four.
 */
export function checkLibrary(files: readonly LibraryFile[], code: CodeBoards, chapters: readonly LibraryRowChapter[]): string[] {
  const faults: string[] = [];
  const read: { name: string; spec: LevelSpec; head: BoardHead; strict: boolean }[] = [];
  for (const { name, text } of files) {
    // A board of the history the rules of today refuse is kept as it was written: only a file that cannot be read at all is a fault.
    try {
      read.push({ name, spec: parseBoard(text, name), head: readBoardHead(text), strict: true });
    } catch {
      try {
        read.push({ name, spec: parseBoard(text, name, true), head: readBoardHead(text), strict: false });
      } catch (error) {
        faults.push(`${name}: the file is no board: ${(error as Error).message}`);
      }
    }
  }
  const byName = new Map(read.map((file) => [file.name, file]));
  for (const file of read) {
    if (file.head.migrated) faults.push(`${file.name}: the status is of the old words; run node scripts/library.mjs import`);
    else if (!file.head.status) faults.push(`${file.name}: no status`);
    if (file.spec.id !== file.name) faults.push(`${file.name}: the file says id ${file.spec.id}`);
  }
  const row = rowCodes(chapters);
  for (const spec of code.row) {
    const file = byName.get(spec.id);
    if (!file) faults.push(`${spec.id}: in the row, and there is no file boards/${spec.id}.txt`);
    else if (!sameDice(file.spec, spec)) faults.push(`${spec.id}: the file is another board than the one in the row`);
    else if (file.head.status !== 'R') faults.push(`${spec.id}: in the row, and its file says status ${file.head.status ?? '—'}`);
    else if (!file.strict) faults.push(`${spec.id}: in the row, and the rules refuse its file`);
  }
  for (const file of read) if (file.head.status === 'R' && !row.includes(file.name)) faults.push(`${file.name}: status R, and it is not in the row`);
  return faults;
}

/** A board as a session gives it out: what it is, where it stands, its passport where it is known, and what the owner said. */
export interface ExportEntry {
  name: string;
  status?: BoardStatus;
  place: Place | null;
  faces: readonly number[];
  par?: number | null;
  route?: string;
  turns?: number;
  away?: number;
  mark?: BoardMark;
  words: readonly BoardWords[];
}

/**
 * The text a session of the library is given out as, for a chat: a line to a board, with its
 * status, place, chapter, faces and passport, the mark and the words said of it. A session with
 * nothing marked is a line that says so.
 */
export function exportText(entries: readonly ExportEntry[], date: string): string {
  const lines = entries.map((entry) => {
    const passport = [
      entry.status ?? '—',
      entry.place ? `место ${entry.place.number}` : '—',
      entry.place ? `глава ${entry.place.chapter} «${entry.place.title}»` : 'глава —',
      `грани ${entry.faces.join(' ')}`,
      `par ${entry.par ?? '—'}`,
      ...(entry.route ? [entry.route] : []),
      ...(entry.turns !== undefined && entry.away !== undefined ? [`turns ${entry.turns} away ${entry.away}`] : []),
    ].join(', ');
    const words = entry.words.map((word) => `${word.date}: «${word.text}»`).join(' ');
    return `- ${entry.name} (${passport}) — ${entry.mark ?? 'без оценки'}.${words ? ` ${words}.` : ''}`;
  });
  return [`## Библиотека, выгрузка ${date}`, '', ...(lines.length > 0 ? lines : ['- ничего не оценено']), ''].join('\n');
}

/** The mark of a key after a play: `1` fire, `2` fine, `3` a miss. */
export function markOfKey(code: string): BoardMark | null {
  const at = ['Digit1', 'Digit2', 'Digit3'].indexOf(code);
  const pad = ['Numpad1', 'Numpad2', 'Numpad3'].indexOf(code);
  const index = at >= 0 ? at : pad;
  return index >= 0 ? BOARD_MARKS[index] : null;
}
