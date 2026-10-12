import { goalOf } from '../rules/level';
import type { GoalLine, LevelSpec } from '../rules/types';
import { LEVELS } from './levels';
import { starsHeld } from './progress';
import { ROAD, roadPlace } from './road';

/**
 * The campaign: every board the player is led through, in one row with one number each — the
 * pieces of the road first, then the levels of the list. The row is read, never kept: what the
 * player has passed is kept by the codes of the boards, as it was.
 */

/** A board of the game by its place: a piece of the road or a level of the list. */
export interface Board {
  road?: number;
  level?: number;
}

export interface Stop {
  spec: LevelSpec;
  /** The number of the board in the row, from 1. */
  number: number;
  board: Board;
}

export const CAMPAIGN: readonly Stop[] = [
  ...ROAD.map((spec, road) => ({ spec, number: road + 1, board: { road } })),
  ...LEVELS.map((spec, level) => ({ spec, number: ROAD.length + level + 1, board: { level } })),
];

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
