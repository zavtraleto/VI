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
export const TECHNIQUES = ['link', 'walk', 'glass', 'lift', 'push', 'ones', 'twoFaces', 'seven', 'time', 'loop', 'order'] as const;
export type Technique = (typeof TECHNIQUES)[number];
/** The hints of the texts (`src/ui/i18n.ts`) a place can show in a window before its board. */
export const HINT_KEYS = ['roadHintChain', 'roadHintWalk', 'roadHintPush', 'roadHintClimb', 'hintSeven', 'hintLinkMove', 'hintRollIn'] as const;
export type HintKey = (typeof HINT_KEYS)[number];
/** What a player is meant to feel on a place (docs/superpowers/specs/2026-10-16-vi-campaign-3-design.md, 4.4): the words of rule 8 of the grammar. */
export const EMOTIONS = ['gift', 'recognition', 'insight', 'flow', 'trick', 'surprise', 'tension', 'payoff', 'fiero', 'relief', 'mastery'] as const;
export type Emotion = (typeof EMOTIONS)[number];
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
  emotion?: Emotion;
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

/**
 * A live session of the row (docs/superpowers/specs/2026-10-22-vi-live-sessions-design.md): Endless on a
 * clock, after the board `after`, of the step `step` of `LIVE_STEPS` (src/rules/live.ts). Not a place:
 * the numbers of the boards stay as they are. Written in row.json by hand; the workshop keeps them.
 */
export interface RowLiveFile {
  after: string;
  step: number;
  /** A note for people, not read by the game. */
  note?: string;
}

export interface RowFile {
  chapters: RowChapterFile[];
  lives?: RowLiveFile[];
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
  emotion?: Emotion;
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

/** A live session of the laid row: its code (`live-<step>`), its step, and the index in `places` of the board it stands after. */
export interface Live {
  code: string;
  step: number;
  after: number;
}

export interface Row {
  chapters: RowChapter[];
  places: Place[];
  lives: Live[];
}

/** The code of a live session of a step: what saves, analytics and the window know it by. */
export function liveCode(step: number): string {
  return `live-${step}`;
}

/** The keys row.json knows, in the order it is written in (`rowFileText` of rowEdit.ts). */
export const CHAPTER_KEYS = ['title', 'faces', 'floor', 'places'] as const;
export const LIVE_KEYS = ['after', 'step', 'note'] as const;
export const PLACE_KEYS = ['board', 'role', 'teaches', 'archetype', 'emotion', 'event', 'note', 'help'] as const;
export const HELP_KEYS = ['hint', 'sign', 'plaques', 'wait', 'camera'] as const;

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
      if (said.emotion !== undefined) oneOf(where, 'emotion', said.emotion, EMOTIONS);
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
        ...(said.emotion !== undefined ? { emotion: said.emotion } : {}),
        ...(said.event !== undefined ? { event: said.event } : {}),
        help: { ...help },
      });
    }
    chapters.push({ id, title: chapter.title, faces: chapter.faces ? [...chapter.faces] : null, first, last: places.length - 1 });
  });
  return { chapters, places, lives: buildLives(file.lives ?? [], places) };
}

/**
 * The live sessions of the row in the order of the places they stand after. Refuses, in one line
 * that begins `row: live after <code>: `, a session after a board that is not in the row, a step
 * that is not a whole number from 1, a step twice, and a key it does not know.
 */
function buildLives(said: readonly RowLiveFile[], places: readonly Place[]): Live[] {
  if (!Array.isArray(said)) throw new Error('row: "lives" is a list of live sessions');
  const lives: Live[] = [];
  for (const live of said) {
    const where = `row: live after ${String(live.after)}`;
    unknownKeys(live, LIVE_KEYS, where);
    const after = places.findIndex((place) => place.code === live.after);
    if (after < 0) throw new Error(`${where}: there is no board ${String(live.after)} in the row`);
    if (!Number.isInteger(live.step) || live.step < 1) throw new Error(`${where}: "step: ${String(live.step)}" is a whole number from 1`);
    if (lives.some((other) => other.step === live.step)) throw new Error(`${where}: step ${live.step} is in the row twice`);
    if (lives.some((other) => other.after === after)) throw new Error(`${where}: the board has a live session after it already`);
    lives.push({ code: liveCode(live.step), step: live.step, after });
  }
  return lives.sort((a, b) => a.after - b.after);
}

/** Whether a file of `boards/` written anew changes the row: row.json itself, or the file of a board in it. */
export function touchesRow(name: string, file: RowFile): boolean {
  if (name === 'row.json') return true;
  if (!name.endsWith('.txt')) return false;
  const code = name.slice(0, -'.txt'.length);
  return file.chapters.some((chapter) => chapter.places.some((place) => place.board === code));
}

/**
 * The labs of the levels, which read the row anew from its files when it is laid again
 * (`ROW_EVENT`); every other page of the dev server is loaded again.
 */
export const ROW_LABS = ['workshop', 'levels', 'library'] as const;
/** The event of `window` a lab of the levels is told by that the dev server has laid the row again. */
export const ROW_EVENT = 'vi:row';

/**
 * The text of `row.gen.ts` for a row: one literal, keys as they were laid, two spaces. On the dev
 * server the module takes its own update, so a row laid again does not load every page again: a
 * lab of the levels is told by an event and reads the row itself, any other page is loaded again
 * to play the new row; a worker that reads the row takes the update and does nothing. Elsewhere (a
 * build, a test, a script) `import.meta.hot` is not there.
 */
export function rowText(row: Row): string {
  return [
    '// Generated by node scripts/row.mjs from boards/row.json and boards/*.txt. Do not edit.',
    "import type { Row } from './row';",
    '',
    `export const ROW: Row = ${JSON.stringify(row, null, 2)};`,
    '',
    'if (import.meta.hot) {',
    '  import.meta.hot.accept(() => {',
    // A worker that reads the row (the solver, through labText.ts) is given import.meta.hot too: it has no page to tell.
    "    if (typeof window === 'undefined') return;",
    `    const lab = new URLSearchParams(window.location.search).get('lab') ?? '';`,
    `    if (${JSON.stringify(ROW_LABS)}.includes(lab)) window.dispatchEvent(new Event(${JSON.stringify(ROW_EVENT)}));`,
    '    else window.location.reload();',
    '  });',
    '}',
    '',
  ].join('\n');
}

function oneOf(where: string, key: string, value: unknown, of: readonly string[]): void {
  if (!of.includes(value as string)) throw new Error(`${where}: "${key}: ${String(value)}" is none of ${of.join(', ')}`);
}

function unknownKeys(object: object, known: readonly string[], where: string): void {
  for (const key of Object.keys(object)) if (!known.includes(key)) throw new Error(`${where}: unknown key "${key}"`);
}
