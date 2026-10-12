import { isBoardName } from '../app/boardProbe';
import { normalSpec, parseBoard, printBoard } from '../levels/boardFile';

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
  | { kind: 'list' }
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
  try {
    parts = path.split('?')[0].split('/').filter((part) => part !== '').map(decodeURIComponent);
  } catch {
    return refused(400, 'an address that cannot be read');
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
  if (parts[1] === 'plays' && parts.length === 2) return method === 'GET' ? { kind: 'plays', name } : method === 'POST' ? { kind: 'play', name } : refused(405, 'the plays are read with GET and added to with POST');
  return refused(404, 'no such address');
}
