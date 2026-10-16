import type { LevelSpec } from '../rules/types';
import { parseBoard } from './boardFile';
import { resolveName } from './library';

/**
 * Every file of `boards/` by its code, read when the module is built: for the tests and the labs
 * only. The game reads the boards of its row from `row.gen.ts`, and must not import this, or every
 * draft of the library goes into the build.
 */
const TEXTS = import.meta.glob<string>('../../boards/*.txt', { query: '?raw', import: 'default', eager: true });

export const BOARD_TEXTS: ReadonlyMap<string, string> = new Map(
  Object.entries(TEXTS).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1, -'.txt'.length), text]),
);

/** The board of a file by its code, as the file has it: the file of that name, or the one that had the name before (`was`). */
export function fileBoard(code: string): LevelSpec {
  const name = BOARD_TEXTS.has(code) ? code : resolveName(code, [...BOARD_TEXTS].map(([name, text]) => ({ name, text })));
  const text = name === null ? undefined : BOARD_TEXTS.get(name);
  if (name === null || text === undefined) throw new Error(`no file boards/${code}.txt`);
  return parseBoard(text, name);
}
