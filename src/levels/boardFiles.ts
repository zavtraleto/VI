import type { LevelSpec } from '../rules/types';
import { parseBoard } from './boardFile';

/**
 * Every file of `boards/` by its code, read when the module is built: for the tests and the labs
 * only. The game reads the boards of its row from `row.gen.ts`, and must not import this, or every
 * draft of the library goes into the build.
 */
const TEXTS = import.meta.glob<string>('../../boards/*.txt', { query: '?raw', import: 'default', eager: true });

export const BOARD_TEXTS: ReadonlyMap<string, string> = new Map(
  Object.entries(TEXTS).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1, -'.txt'.length), text]),
);

/** The board of a file by its code, as the file has it. */
export function fileBoard(code: string): LevelSpec {
  const text = BOARD_TEXTS.get(code);
  if (text === undefined) throw new Error(`no file boards/${code}.txt`);
  return parseBoard(text, code);
}
