import { parseBoard, printBoard, readBoardHead, withHead, type BoardHead, type BoardStatus } from './boardFile';
import { CHAPTER_KEYS, HELP_KEYS, LIVE_KEYS, PLACE_KEYS, type Help, type RowChapterFile, type RowFile, type RowPlaceFile } from './row';

/**
 * The operations the workshop does on the row (docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md,
 * section 11): each gives a new `RowFile` and the files whose status it changes; the server lays the
 * row on the result and writes it only where it is laid. Nothing here changes what it is given, and
 * nothing reads a disk.
 *
 * Two codes that differ only in letter case are one board here, as they are one file on Windows:
 * a board is looked for in the row so, and an operation says it as the row spells it.
 */

/** What row.json says of a place, but for its board. */
export type PlaceFields = Omit<RowPlaceFile, 'board'>;

export type RowOp =
  | { op: 'insert'; board: string; chapter: number; after: string | null; place: PlaceFields }
  | { op: 'move'; board: string; way: 'up' | 'down' }
  | { op: 'remove'; board: string; status: 'RC' | 'X' }
  | { op: 'edit'; board: string; place: PlaceFields };

/** The row after the operation, and the files whose status it changes: insert → R, remove → RC or X. */
export interface RowEdit {
  file: RowFile;
  statuses: Readonly<Record<string, BoardStatus>>;
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** A copy of the row deep enough that no operation reaches into the file it was given. */
function copyOf(file: RowFile): RowFile {
  return { ...file, chapters: file.chapters.map((chapter) => ({ ...chapter, ...(chapter.faces ? { faces: [...chapter.faces] } : {}), places: chapter.places.map(copyPlace) })) };
}

function copyPlace(place: RowPlaceFile): RowPlaceFile {
  return { ...place, ...(place.help ? { help: { ...place.help } } : {}) };
}

/** Where a board stands in the row: its chapter and its index in it; null where it is not in the row. */
function find(file: RowFile, board: string): { chapter: number; index: number } | null {
  for (let chapter = 0; chapter < file.chapters.length; chapter++) {
    const index = file.chapters[chapter].places.findIndex((place) => same(place.board, board));
    if (index >= 0) return { chapter, index };
  }
  return null;
}

function placed(file: RowFile, board: string): { chapter: number; index: number } {
  const at = find(file, board);
  if (!at) throw new Error(`row: ${board} is not in the row`);
  return at;
}

function chapterOf(file: RowFile, chapter: number): RowChapterFile {
  const said = Number.isInteger(chapter) ? file.chapters[chapter] : undefined;
  if (!said) throw new Error(`row: there is no chapter ${chapter + 1}: the row has ${file.chapters.length}`);
  return said;
}

/** The index in a chapter a new place goes to: first, or right after the place `after`. */
function indexAfter(chapter: RowChapterFile, number: number, after: string | null): number {
  if (after === null) return 0;
  const at = chapter.places.findIndex((place) => same(place.board, after));
  if (at < 0) throw new Error(`row: ${after} is not in chapter ${number + 1}`);
  return at + 1;
}

/** The row after an operation, and the statuses it gives; refused in one line that begins `row: `. */
export function rowEdit(file: RowFile, op: RowOp): RowEdit {
  const next = copyOf(file);
  if (op.op === 'insert') {
    const there = find(next, op.board);
    if (there) throw new Error(`row: ${op.board} is in the row already`);
    const chapter = chapterOf(next, op.chapter);
    const index = indexAfter(chapter, op.chapter, op.after);
    chapter.places.splice(index, 0, copyPlace({ board: op.board, ...op.place }));
    return { file: next, statuses: { [op.board]: 'R' } };
  }
  const at = placed(next, op.board);
  const places = next.chapters[at.chapter].places;
  const board = places[at.index].board;
  if (op.op === 'remove') {
    places.splice(at.index, 1);
    return { file: next, statuses: { [board]: op.status } };
  }
  if (op.op === 'edit') {
    places[at.index] = copyPlace({ board, ...op.place });
    return { file: next, statuses: {} };
  }
  const up = op.way === 'up';
  const to = at.index + (up ? -1 : 1);
  if (to >= 0 && to < places.length) {
    [places[at.index], places[to]] = [places[to], places[at.index]];
    return { file: next, statuses: {} };
  }
  // Over the border of the chapter: last in the one before, or first in the one after.
  const beyond = next.chapters[at.chapter + (up ? -1 : 1)];
  if (!beyond) throw new Error(`row: ${board} is at the ${up ? 'start' : 'end'} of the row`);
  const [place] = places.splice(at.index, 1);
  if (up) beyond.places.push(place);
  else beyond.places.unshift(place);
  return { file: next, statuses: {} };
}

/**
 * The help a new place is given unless it is told otherwise: that of the place before it, and for
 * the first of a chapter, that of the place after it; none in an empty chapter.
 */
export function helpNear(file: RowFile, chapter: number, after: string | null): Help {
  const places = file.chapters[chapter]?.places ?? [];
  const near = after === null ? places[0] : places.find((place) => same(place.board, after));
  return { ...(near?.help ?? {}) };
}

/** A place, or its help, as one line of JSON: the keys in the order given, a space inside the braces. */
function line(object: object, keys: readonly string[]): string {
  const said = keys.flatMap((key) => {
    const value = (object as Record<string, unknown>)[key];
    if (value === undefined) return [];
    return [`${JSON.stringify(key)}: ${typeof value === 'object' && value !== null ? line(value, HELP_KEYS) : JSON.stringify(value)}`];
  });
  return said.length === 0 ? '{}' : `{ ${said.join(', ')} }`;
}

/**
 * The text of row.json as the file is written: a chapter over lines, its title, faces and floor a
 * line each, a place a line with its keys in their order, two spaces to a level, a line feed at the
 * end. A help that says nothing is not written: it is the same as none. The live sessions, which the
 * workshop does not edit, are written after the chapters as they were, a line each.
 */
export function rowFileText(file: RowFile): string {
  const chapters = file.chapters.map((chapter) => {
    const lines = CHAPTER_KEYS.filter((key) => key !== 'places' && chapter[key] !== undefined).map((key) => `      ${JSON.stringify(key)}: ${key === 'faces' ? `[${chapter.faces!.join(', ')}]` : JSON.stringify(chapter[key])}`);
    const places = chapter.places.map((place) => {
      const { help, ...rest } = place;
      return `        ${line(help && Object.keys(help).length > 0 ? place : rest, PLACE_KEYS)}`;
    });
    lines.push(places.length === 0 ? '      "places": []' : `      "places": [\n${places.join(',\n')}\n      ]`);
    return `    {\n${lines.join(',\n')}\n    }`;
  });
  const lives = file.lives === undefined ? '' : `,\n  "lives": [\n${file.lives.map((live) => `    ${line(live, LIVE_KEYS)}`).join(',\n')}\n  ]`;
  return `{\n  "chapters": [\n${chapters.join(',\n')}\n  ]${lives}\n}\n`;
}

/** The head of a file as `withHead` takes it back: what it says, without the note that it was read from old words. */
function headOf(text: string): BoardHead {
  const { migrated: _migrated, ...head } = readBoardHead(text);
  return head;
}

/** A file with its status said anew, and the rest of it as it was. Of the row only: the page changes no R (`patchHead`). */
export function withStatus(text: string, status: BoardStatus): string {
  return withHead(text, { ...headOf(text), status });
}

/**
 * Two files that give each other their boards (section 11.2): `kept` takes the cells, the rules of
 * the board and the way of `other`, and keeps its id and its head; `other` takes the board `kept`
 * had, keeps its id, and is a candidate (`RC`) with the note it is told. Both are read loose, as the
 * editor reads them; a file that cannot be read is refused.
 */
export function swapBoardTexts(kept: string, other: string, note: string): { kept: string; other: string } {
  const specKept = parseBoard(kept, 'kept', true);
  const specOther = parseBoard(other, 'other', true);
  return {
    kept: printBoard({ ...specOther, id: specKept.id }, headOf(kept)),
    other: printBoard({ ...specKept, id: specOther.id }, { ...headOf(other), status: 'RC', note }),
  };
}
