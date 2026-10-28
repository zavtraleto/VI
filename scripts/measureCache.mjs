// The cache of the slow measures of the boards of the row (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md,
// section 8): one file to a board, boards/.measures/<key>.json, by the key of src/levels/measureCache.ts (`cacheKey`).
// The files are kept in git, so that a new worktree starts warm; `npm test` never reads them. Only the process that
// gives out the work writes them, never its workers.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** A key as `cacheKey` makes it: sixteen hex digits and the version of the measures. */
const KEY = /^[0-9a-f]{16}-\d+$/;

const fileOf = (root, key) => {
  if (!KEY.test(key)) throw new Error(`no key of the cache: "${key}"`);
  return resolve(root, 'boards', '.measures', `${key}.json`);
};

/** The measures kept under the key, or null where there is no file or it cannot be read (a file torn by a run cut short). */
export function readMeasures(root, key) {
  const file = fileOf(root, key);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Keeps the measures under the key: JSON indented by two spaces, with a newline at the end, written whole or not at all. */
export function writeMeasures(root, key, measures) {
  const file = fileOf(root, key);
  mkdirSync(resolve(file, '..'), { recursive: true });
  const torn = `${file}.${process.pid}.tmp`;
  writeFileSync(torn, `${JSON.stringify(measures, null, 2)}\n`);
  renameSync(torn, file);
}
