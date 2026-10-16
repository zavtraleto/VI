import type { LevelSpec } from '../rules/types';
import { fileBoard } from './boardFiles';
import { CAMPAIGN } from './campaign';

/**
 * The boards the code of the game held until the row moved to files (15 October 2026), now read from
 * their files by code: the tests and the scripts that went over all of them still do. For the tests and
 * the labs only, as `boardFiles.ts` is: the game reads its row from `row.gen.ts`. The files took names
 * by their idea on 16 October 2026; the old names are in their `was:`.
 */

/** The levels of the probe and the acts that were parked: played by the tests, not by the game. */
export const PARKED_CODES: readonly string[] = [
  'first-die-1', 'broom-3', 'collapse-6', 'bridge-8', 'probe-23', 'probe-25', 'probe-26', 'probe-27', 'probe-28', 'probe-29', 'probe-30', 'collapse-3', 'hidden-face-3', 'rescue-3', 'chaser-1', 'two-combos-3', 'probe-31', 'trap-4',
  'act-k17', 'hidden-face-1', 'bridge-5', 'act-k21', 'act-k23', 'domino-3', 'act-k25', 'tight-room-1', 'act-k28', 'roll-onto-1', 'act-k22', 'tight-room-4',
];

/** The reserve of the places of the probe, once under the code of the place and the seed it was laid from (now in their `was:`). */
export const SPARE_NAMES: readonly string[] = [
  'collapse-2', 'collapse-1', 'bridge-3', 'bridge-1', 'hidden-face-2', 'rescue-2', 'rescue-1', 'tight-room-2', 'tight-room-3',
  'down-back-1', 'down-back-2', 'two-combos-1', 'two-combos-2', 'domino-1', 'domino-2', 'trap-1', 'trap-2', 'broom-1',
  'broom-2', 'down-back-3', 'down-back-4', 'collapse-5', 'collapse-4', 'rescue-4', 'rescue-5', 'tight-room-6', 'tight-room-5',
  'bridge-7', 'bridge-6', 'two-combos-4', 'two-combos-5', 'trap-3', 'broom-4', 'broom-5', 'trap-6', 'trap-5',
  'domino-5', 'domino-4', 'collapse-8', 'collapse-7', 'bridge-10', 'bridge-9', 'probe-23-2', 'probe-24-3', 'probe-24-2',
  'probe-25-3', 'probe-25-2', 'probe-26-3', 'probe-26-2', 'probe-27-2', 'probe-27-3', 'probe-28-2', 'probe-28-3', 'probe-29-2',
  'probe-29-3', 'probe-30-2', 'probe-30-3',
];

/** The boards of the row as they are played. */
export function rowBoards(): LevelSpec[] {
  return CAMPAIGN.map((place) => place.spec);
}

export function parkedBoards(): LevelSpec[] {
  return PARKED_CODES.map(fileBoard);
}

export function spareBoards(): LevelSpec[] {
  return SPARE_NAMES.map(fileBoard);
}

/** A board of the row as it is played, or else its file: by its code. */
export function boardOf(code: string): LevelSpec {
  return CAMPAIGN.find((place) => place.code === code)?.spec ?? fileBoard(code);
}
