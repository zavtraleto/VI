import type { LevelSpec } from '../rules/types';
import { parseBoard, readBoardHead } from './boardFile';

/**
 * The row of the campaign as files have it (docs/superpowers/specs/2026-10-15-vi-row-json-design.md):
 * `boards/row.json` says the chapters, the places in their order, what each place is and how the
 * game helps the player on it; a board is its file `boards/<code>.txt` and nothing else. `buildRow`
 * lays the row from them; `scripts/row.mjs` and the dev server write what it lays into `row.gen.ts`,
 * which the game reads. Nothing here reads a disk.
 */

/** What a board is in its chapter: a meeting with a move, learning it, using it, an event, a twist, the peak, a rest. */
export const ROLES = ['meet', 'learn', 'apply', 'event', 'twist', 'peak', 'rest'] as const;
export type Role = (typeof ROLES)[number];
/** A move a board can bring in (`teaches`) or ask for: the words of the grammar of the row (`grammar.ts`). */
export const TECHNIQUES = ['link', 'walk', 'glass', 'lift', 'push', 'ones', 'twoFaces', 'seven', 'time'] as const;
export type Technique = (typeof TECHNIQUES)[number];
/** The hints of the texts (`src/ui/i18n.ts`) a place can show in a window before its board. */
export const HINT_KEYS = ['roadHintChain', 'roadHintWalk', 'roadHintPush', 'roadHintClimb', 'hintSeven', 'hintLinkMove'] as const;
export type HintKey = (typeof HINT_KEYS)[number];
export const PLAQUES = ['all', 'near'] as const;
export const WAITS = ['first', 'lesson', 'free'] as const;
export const CAMERAS = ['cells', 'hold'] as const;
export const SIGNS = ['N', 'E', 'S', 'W'] as const;

/** How the game helps the player on a place; a place says none of it unless it is written. */
export interface Help {
  /** The window of a hint before the board, once for a player. */
  hint?: HintKey;
  /** The sign of the swipe from the first frame, its direction. */
  sign?: (typeof SIGNS)[number];
  /** Plaques over dice: over every die and heap of a working face from the start, or over a heap whose combo is near. Absent: none. */
  plaques?: (typeof PLAQUES)[number];
  /** What the board does while the player waits; absent: nothing, and no sign after dead ends. */
  wait?: (typeof WAITS)[number];
  /** The camera framed by the board's cells, and for `hold` at one scale with the neighbouring `hold` places. Absent: the whole square. */
  camera?: (typeof CAMERAS)[number];
}

export interface RowPlaceFile {
  board: string;
  role: Role;
  teaches?: Technique;
  archetype: string;
  event?: string;
  /** A note for people, not read by the game. */
  note?: string;
  help?: Help;
}

export interface RowChapterFile {
  title: string;
  /** Faces every board of the chapter plays on (and counts on); absent: each board keeps its own. */
  faces?: number[];
  /** 'open': the floor of every board of the chapter is open, whatever its file says; absent: as the file says. */
  floor?: 'open';
  places: RowPlaceFile[];
}

export interface RowFile {
  chapters: RowChapterFile[];
}

/** A place of the laid row: its number from 1 through the whole row, its chapter from 0, and the board as it is played. */
export interface Place {
  number: number;
  chapter: number;
  code: string;
  spec: LevelSpec;
  role: Role;
  teaches?: Technique;
  archetype: string;
  event?: string;
  help: Help;
}

/** A chapter of the laid row: the indices of its first and its last place in `places`. */
export interface RowChapter {
  id: number;
  title: string;
  faces: readonly number[] | null;
  first: number;
  last: number;
}

export interface Row {
  chapters: RowChapter[];
  places: Place[];
}

const CHAPTER_KEYS = ['title', 'faces', 'floor', 'places'] as const;
const PLACE_KEYS = ['board', 'role', 'teaches', 'archetype', 'event', 'note', 'help'] as const;
const HELP_KEYS = ['hint', 'sign', 'plaques', 'wait', 'camera'] as const;

/** Reads the text of row.json: JSON, with a list of chapters. What each holds is asked by `buildRow`. */
export function readRowFile(text: string): RowFile {
  const file = JSON.parse(text) as Partial<RowFile>;
  if (!Array.isArray(file.chapters)) throw new Error('row: "chapters" is a list of chapters');
  return file as RowFile;
}

/**
 * The row laid from row.json and the texts of the boards by their codes. A board of a chapter with
 * faces plays on them, and with its floor open where the chapter opens it. Refuses, in one line that
 * begins `row: `, a board with no file or a file that is not of the row (`status: R`), a board twice,
 * a word that is none of its list and a key it does not know; a board the rules refuse, as
 * `parseBoard` says it.
 */
export function buildRow(file: RowFile, boards: ReadonlyMap<string, string>): Row {
  const chapters: RowChapter[] = [];
  const places: Place[] = [];
  const seen = new Map<string, number>();
  file.chapters.forEach((chapter, id) => {
    unknownKeys(chapter, CHAPTER_KEYS, `row: chapter ${id + 1} (${chapter.title})`);
    const first = places.length;
    for (const said of chapter.places) {
      const number = places.length + 1;
      const where = `row: place ${number} (${said.board})`;
      unknownKeys(said, PLACE_KEYS, where);
      const help = said.help ?? {};
      unknownKeys(help, HELP_KEYS, where);
      oneOf(where, 'role', said.role, ROLES);
      if (said.teaches !== undefined) oneOf(where, 'teaches', said.teaches, TECHNIQUES);
      if (help.hint !== undefined) oneOf(where, 'hint', help.hint, HINT_KEYS);
      if (help.sign !== undefined) oneOf(where, 'sign', help.sign, SIGNS);
      if (help.plaques !== undefined) oneOf(where, 'plaques', help.plaques, PLAQUES);
      if (help.wait !== undefined) oneOf(where, 'wait', help.wait, WAITS);
      if (help.camera !== undefined) oneOf(where, 'camera', help.camera, CAMERAS);
      const before = seen.get(said.board);
      if (before !== undefined) throw new Error(`row: ${said.board} is in the row twice (places ${before} and ${number})`);
      seen.set(said.board, number);
      const text = boards.get(said.board);
      if (text === undefined) throw new Error(`row: ${said.board} is in the row, and there is no file boards/${said.board}.txt`);
      const status = readBoardHead(text).status;
      if (status !== 'R') throw new Error(`row: ${said.board}: the file says status ${status ?? '—'}; a board of the row is R`);
      let spec = parseBoard(text, said.board);
      if (chapter.faces) spec = { ...spec, faces: [...chapter.faces], values: [...chapter.faces] };
      if (chapter.floor === 'open') {
        const { floor: _floor, ...open } = spec;
        spec = open;
      }
      places.push({
        number,
        chapter: id,
        code: said.board,
        spec,
        role: said.role,
        ...(said.teaches !== undefined ? { teaches: said.teaches } : {}),
        archetype: said.archetype,
        ...(said.event !== undefined ? { event: said.event } : {}),
        help: { ...help },
      });
    }
    chapters.push({ id, title: chapter.title, faces: chapter.faces ? [...chapter.faces] : null, first, last: places.length - 1 });
  });
  return { chapters, places };
}

/** The text of `row.gen.ts` for a row: one literal, keys as they were laid, two spaces. */
export function rowText(row: Row): string {
  return [
    '// Generated by node scripts/row.mjs from boards/row.json and boards/*.txt. Do not edit.',
    "import type { Row } from './row';",
    '',
    `export const ROW: Row = ${JSON.stringify(row, null, 2)};`,
    '',
  ].join('\n');
}

function oneOf(where: string, key: string, value: unknown, of: readonly string[]): void {
  if (!of.includes(value as string)) throw new Error(`${where}: "${key}: ${String(value)}" is none of ${of.join(', ')}`);
}

function unknownKeys(object: object, known: readonly string[], where: string): void {
  for (const key of Object.keys(object)) if (!known.includes(key)) throw new Error(`${where}: unknown key "${key}"`);
}
