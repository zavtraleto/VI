import type { LevelSpec } from '../rules/types';
import { normalSpec } from './boardFile';
import type { Depth } from './depth';
import type { SlowFacts } from './grammar';
import type { ExplorerFacts, Shares } from './measures';
import type { Technique } from './row';

/**
 * The cache of the slow measures of the boards of the row (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md,
 * section 8): the walk, the personas, the bans of the solver and the graph of a board take about an hour on six workers (3728 s, 28 October 2026) for the
 * row, so each board's are kept in `boards/.measures/<key>.json` (written by `scripts/measureCache.mjs`, kept in git so
 * that a new worktree starts warm). `npm test` never reads it.
 */

/** The version of the measures: raised whenever the personas, the solver or a measure change, and every board is measured again. */
export const MEASURES_VERSION = 1;

/** What the slow part of the table of the campaign and of the passport of a place reads of a board; JSON values only. */
export interface SlowMeasures {
  /** The first moves that keep the board in hand, and the walk over the boards the player can come to (`capped` where it was cut). */
  road: { firsts: number; worst: number; lost: number; boards: number; capped: boolean };
  /** What the slow rules of the grammar ask of the board, without its D: D is read off these measures by the scale as it stands. */
  facts: Omit<SlowFacts, 'd'>;
  /** The shares of the runs of the players the rank is said by. */
  shares: Shares;
  /** The share of the runs of the player who reads only what a person sees. */
  reader: number;
  /** What the players who try other ways find. */
  explorer: { careful: ExplorerFacts; planner: ExplorerFacts };
  depth: Depth;
  /** The dice whose goal face is not to be seen at the start. */
  hidden: number;
  /** The boards the solver saw to find the fewest moves. */
  states: number;
}

/** The text a board is known by in the cache: normalised, with no name, its fields in one order, and what it teaches. */
function keyText(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(keyText).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, one]) => one !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([name, one]) => `${JSON.stringify(name)}:${keyText(one)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** FNV-1a of 64 bits over the UTF-8 of a text, as sixteen hex digits. */
function fnv64(text: string): string {
  const MASK = (1n << 64n) - 1n;
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & MASK;
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * The key of a board in the cache: `<16 hex digits>-<MEASURES_VERSION>`. A board changed in its file is another key;
 * a board renamed is the same key; a board on the faces of another chapter, or teaching another move, is another.
 */
export function cacheKey(spec: LevelSpec, teaches?: Technique): string {
  return `${fnv64(keyText([normalSpec({ ...spec, id: '' }), teaches ?? null]))}-${MEASURES_VERSION}`;
}
