import { goalOf } from '../rules/level';
import type { GoalLine, LevelSpec } from '../rules/types';
import { STOPS, type StopMeta } from './chapters';
import { LEVELS } from './levels';
import { starsHeld } from './progress';
import { ROAD, ROAD_HINTS, roadPlace, type HintUntil, type RoadHintKey } from './road';

/**
 * The campaign: every board the player is led through, in one row with one number each — the
 * prologue, the pieces of the road, and then the chapters (docs/superpowers/specs/2026-10-14-vi-campaign-2-design.md).
 * A chapter is one thought about what the dice and the floor can do, and one set of faces: every
 * board of it works on the faces of the chapter, whatever faces it had where it was laid. The row
 * is read, never kept: what the player has passed is kept by the codes of the boards, as it was.
 */

/** A board of the game by its place: a piece of the road or a level of the list. */
export interface Board {
  road?: number;
  level?: number;
}

export { CHAPTERS, STOPS, withChapterFaces, type Chapter, type Role, type StopMeta, type Technique } from './chapters';

export interface Stop extends StopMeta {
  spec: LevelSpec;
  /** The number of the board in the row, from 1. */
  number: number;
  board: Board;
}

/** What the row says of a board; a board with no thought written for it is not let into the row. */
function metaOf(spec: LevelSpec): StopMeta {
  const meta = STOPS[spec.id];
  if (!meta) throw new Error(`${spec.id} is in the row with no thought: write it in STOPS`);
  return meta;
}

export const CAMPAIGN: readonly Stop[] = [
  ...ROAD.map((spec, road) => ({ spec, number: road + 1, board: { road }, ...metaOf(spec) })),
  ...LEVELS.map((spec, level) => ({ spec, number: ROAD.length + level + 1, board: { level }, ...metaOf(spec) })),
];

/** The lines of the texts (`src/ui/i18n.ts`) that a board can carry above itself: those of the road and those of the acts. */
export type HintKey = RoadHintKey | 'hintSeven' | 'hintLinkMove';

export interface Hint {
  key: HintKey;
  /** The line stands from the start of the board and goes out when this has been done on it. */
  until: HintUntil;
}

/**
 * The line a board carries above itself, by its code: in the row now only the lesson of the chain
 * of the prologue. The lines of the acts (`hintSeven`, `hintLinkMove`) keep their texts and come
 * back with the chapters that use them (the campaign of the second edition, section 2.7). A line
 * of a chapter is said once: a board the player has passed does not say it again.
 */
export const HINTS: Readonly<Record<string, Hint>> = { ...ROAD_HINTS };

export function stopOf(board: Board): Stop | undefined {
  if (board.road !== undefined) return CAMPAIGN[board.road];
  if (board.level !== undefined) return CAMPAIGN[ROAD.length + board.level];
  return undefined;
}

/** The number of a board in the row; null for a board that is not of it, as a board of the lab. */
export function numberOf(board: Board): number | null {
  return stopOf(board)?.number ?? null;
}

/** What is kept of the player that the row is read against. */
export interface CampaignKept {
  passed: Readonly<Record<string, boolean | undefined>>;
  stats: Readonly<Record<string, { bestMoves?: number | null } | undefined>>;
  road?: string;
}

/** A cell of the list of the levels: a board of the row with what the player holds on it. */
export interface CampaignCell {
  number: number;
  passed: boolean;
  stars: 0 | 1 | 2 | 3;
  goal: GoalLine[];
  faces?: readonly number[];
}

export function campaignCells(kept: CampaignKept): CampaignCell[] {
  return CAMPAIGN.map(({ spec, number }) => {
    const passed = kept.passed[spec.id] === true;
    // A board passed with no fewest moves kept holds the one star of having passed it.
    const stars = passed ? starsHeld(kept.stats[spec.id]?.bestMoves ?? null, spec.par) || 1 : 0;
    return { number, passed, stars, goal: goalOf(spec), faces: spec.faces };
  });
}

/** The stop the list opens on: the piece the player is on; for one past the road, the level they go on with. */
export function campaignFocus(kept: CampaignKept, firstPassed: boolean, nextLevel: number): number {
  const place = roadPlace(kept.road, firstPassed);
  return place === null ? ROAD.length + nextLevel : place;
}

export function campaignDone(kept: Pick<CampaignKept, 'passed'>): number {
  return CAMPAIGN.filter(({ spec }) => kept.passed[spec.id] === true).length;
}
