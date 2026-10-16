import { isBoardName } from '../app/boardProbe';
import { BOARD_MARKS, normalSpec, parseBoard, printBoard, readBoardHead, withHead, type BoardMark, type BoardStatus, type BoardWords } from '../levels/boardFile';

/**
 * What the dev server does for the lab of the levels, as far as it can be said without a disk:
 * which address asks for what, what a file of the history is called, and the hash a version of
 * a board is known by. The plugin that reads and writes the files is `vite.boards.ts`, beside
 * the config of the build; it is of the dev server only, and a build has nothing of it.
 *
 *   GET  /__boards                         the names of the boards, sorted, as JSON
 *   GET  /__boards/<name>                  the text of boards/<name>.txt
 *   PUT  /__boards/<name>                  writes it, and a copy into the history where it is a board
 *   GET  /__boards/<name>/history          the versions kept: [{ file, time, hash }], the oldest first
 *   GET  /__boards/<name>/history/<file>   the text of one of them
 *   GET  /__boards/<name>/plays            the plays written down, as JSON
 *   POST /__boards/<name>/plays            writes a play down: a line of JSON
 *   GET  /__boards?heads                   every board with its text and hash: [{ name, text, hash }], for the library
 *   PUT  /__boards/<name>/head             a status, a mark and words laid into the head of the file (`patchHead`); no version is kept
 *   POST /__boards/<name>/rename           { to }: the file, its history and its plays under the new name; refused where the name is taken or the board is of the row
 *   POST /__boards?export=<date>           a text given out by the library, kept in boards/.history/export-<date>.md
 *
 * A name is the name of a board and nothing more: letters, digits, `-` and `_`. A name with a
 * dot or a slash in it would be a path, and the page would write wherever it liked.
 */

/** The name of a board as an address may give it, or null where it is no name. */
export function safeName(name: string): string | null {
  return isBoardName(name) ? name : null;
}

/** FNV-1a over the text, as eight hex digits. */
export function hashOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at++) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * The hash a version of a board is known by: of the board as it is written once everything two
 * files of one board could differ by is taken out, the note and the status with it. Null where
 * the text is no board: such a file is written and no version of it is kept.
 */
export function boardHash(text: string, name = '?'): string | null {
  try {
    return hashOf(printBoard(normalSpec(parseBoard(text, name))));
  } catch {
    return null;
  }
}

/** The time a version was kept at, as its file is named by it: `20261012T170827Z`. */
function stampOf(now: Date): string {
  return `${now.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

/** The file a version of a board is kept in. */
export function historyFile(hash: string, now: Date): string {
  return `${stampOf(now)}-${hash}.txt`;
}

export function historyPath(root: string, id: string, hash: string, now: Date): string {
  return `${root}/boards/.history/${id}/${historyFile(hash, now)}`;
}

/** A version of a board as the page is told of it. */
export interface Version {
  file: string;
  /** When it was kept, as ISO time. */
  time: string;
  hash: string;
}

/** What the name of a file of the history says; null where the file is no version (the plays are kept beside them). */
export function versionOf(file: string): Version | null {
  const read = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-([0-9a-f]{8})\.txt$/.exec(file);
  if (!read) return null;
  const [, year, month, day, hour, minute, second, hash] = read;
  return { file, time: `${year}-${month}-${day}T${hour}:${minute}:${second}Z`, hash };
}

/** What an address of the plugin asks for. */
export type BoardsAsk =
  | { kind: 'list' | 'heads' }
  | { kind: 'export'; date: string }
  | { kind: 'head'; name: string }
  | { kind: 'rename'; name: string }
  | { kind: 'read' | 'write' | 'history' | 'plays' | 'play'; name: string }
  | { kind: 'version'; name: string; file: string }
  | { kind: 'refused'; status: 400 | 404 | 405; why: string };

/**
 * Reads what is asked: the method, and the path after `/__boards`. Every part of the path is a
 * name or a file of the history by their own patterns, so no path leads out of `boards/`.
 */
export function askOf(method: string, path: string): BoardsAsk {
  const refused = (status: 400 | 404 | 405, why: string): BoardsAsk => ({ kind: 'refused', status, why });
  let parts: string[];
  const query = new URLSearchParams(path.split('?')[1] ?? '');
  try {
    parts = path.split('?')[0].split('/').filter((part) => part !== '').map(decodeURIComponent);
  } catch {
    return refused(400, 'an address that cannot be read');
  }
  if (parts.length === 0 && query.has('heads')) return method === 'GET' ? { kind: 'heads' } : refused(405, 'the heads are only read');
  if (parts.length === 0 && query.has('export')) {
    const date = query.get('export') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return refused(400, `"${date}" is no date: YYYY-MM-DD`);
    return method === 'POST' ? { kind: 'export', date } : refused(405, 'an export is written with POST');
  }
  if (parts.length === 0) return method === 'GET' ? { kind: 'list' } : refused(405, 'the list is only read');
  const name = safeName(parts[0]);
  if (name === null) return refused(400, `"${parts[0]}" is no name of a board: letters, digits, - and _`);
  if (parts.length === 1) return method === 'GET' ? { kind: 'read', name } : method === 'PUT' ? { kind: 'write', name } : refused(405, 'a board is read with GET and written with PUT');
  if (parts[1] === 'history' && parts.length === 2) return method === 'GET' ? { kind: 'history', name } : refused(405, 'the history is only read');
  if (parts[1] === 'history' && parts.length === 3) {
    if (versionOf(parts[2]) === null) return refused(400, `"${parts[2]}" is no file of the history`);
    return method === 'GET' ? { kind: 'version', name, file: parts[2] } : refused(405, 'a version is only read');
  }
  if (parts[1] === 'head' && parts.length === 2) return method === 'PUT' ? { kind: 'head', name } : refused(405, 'a head is written with PUT');
  if (parts[1] === 'plays' && parts.length === 2) return method === 'GET' ? { kind: 'plays', name } : method === 'POST' ? { kind: 'play', name } : refused(405, 'the plays are read with GET and added to with POST');
  if (parts[1] === 'rename' && parts.length === 2) return method === 'POST' ? { kind: 'rename', name } : refused(405, 'a board is renamed with POST');
  return refused(404, 'no such address');
}

/** What the page of the library lays into the head of a file: the status, the mark, and words to add, each with its day. */
export interface HeadPatch {
  /** What a verdict after a play makes of the board: R is given only by the row. */
  status?: Exclude<BoardStatus, 'R'>;
  mark?: BoardMark;
  words?: BoardWords[];
}

/** The patch a body of `PUT …/head` says, or null where it says no such thing. */
export function headPatchOf(body: string): HeadPatch | null {
  let said: unknown;
  try {
    said = JSON.parse(body);
  } catch {
    return null;
  }
  if (said === null || typeof said !== 'object') return null;
  const { status, mark, words } = said as { status?: unknown; mark?: unknown; words?: unknown };
  if (status !== undefined && !(['N', 'D', 'RC', 'X'] as unknown[]).includes(status)) return null;
  if (mark !== undefined && !(BOARD_MARKS as readonly unknown[]).includes(mark)) return null;
  if (words !== undefined && (!Array.isArray(words) || !words.every((word) => word && typeof word.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(word.date) && typeof word.text === 'string' && word.text.trim() !== '' && !/[\r\n]/.test(word.text)))) return null;
  return { ...(status !== undefined ? { status: status as Exclude<BoardStatus, 'R'> } : {}), ...(mark !== undefined ? { mark: mark as BoardMark } : {}), ...(words !== undefined ? { words: (words as BoardWords[]).map(({ date, text }) => ({ date, text: text.trim() })) } : {}) };
}

/**
 * A file with a status, a mark and words laid into its head: the status and the mark stand for
 * those there were, the words go after those there are, and nothing else of the file changes. The
 * board is the same, so its hash is: the plugin keeps no version for it. A board of the row keeps
 * its R: a patch that would change it is refused, and its words are laid in all the same.
 */
export function patchHead(text: string, patch: HeadPatch): string {
  const head = readBoardHead(text);
  if (patch.status && head.status === 'R') throw new Error(`a board of the row keeps R: ${/^id:\s*(.*)$/m.exec(text)?.[1]?.trim() || 'this board'}`);
  const { migrated: _migrated, ...rest } = head;
  return withHead(text, {
    ...rest,
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.mark ? { mark: patch.mark } : {}),
    ...(patch.words && patch.words.length > 0 ? { words: [...(head.words ?? []), ...patch.words] } : {}),
  });
}

/** The name a body of `POST …/rename` asks for, or null where it asks for no name of a board. */
export function renameOf(body: string): string | null {
  try {
    const { to } = JSON.parse(body) as { to?: unknown };
    return typeof to === 'string' ? safeName(to) : null;
  } catch {
    return null;
  }
}

/**
 * A file under a new name: its id is the new name, and the name it had goes to the end of the
 * names it had before (`was`). A name given back is its id again and no longer among them.
 * Nothing else of the file changes.
 */
export function renamedText(text: string, to: string): string {
  const head = readBoardHead(text);
  const { migrated: _migrated, ...rest } = head;
  const id = /^id:\s*(.*)$/m.exec(text)?.[1]?.trim() ?? '';
  const was = [...(head.was ?? []), ...(id ? [id] : [])].filter((name) => name !== to);
  return withHead(text.replace(/^id:.*$/m, `id: ${to}`), { ...rest, was });
}

/** The file of the history an export of a day is kept in. */
export function exportFile(date: string): string {
  return `export-${date}.md`;
}
