import { goalOf } from '../rules/level';
import type { GoalLine, LevelSpec } from '../rules/types';
import { LEVELS } from './levels';
import { starsHeld } from './progress';
import { ROAD, ROAD_HINTS, roadPlace, type HintUntil, type RoadHintKey } from './road';
import { ROAD_PLACES } from './roadRecipes';

/**
 * The campaign: every board the player is led through, in one row with one number each — the
 * pieces of the road first, the prologue, then the levels act by act and the tail of the list
 * that the acts have not taken yet. The row is read, never kept: what the player has passed is
 * kept by the codes of the boards, as it was.
 */

/** A board of the game by its place: a piece of the road or a level of the list. */
export interface Board {
  road?: number;
  level?: number;
}

/** What a board is in its act: a lesson, a free piece or a mix of the road; one of the six roles of an act; a level of the tail. */
export type Role = 'lesson' | 'free' | 'mix' | 'opening' | 'apply' | 'twist' | 'join' | 'peak' | 'rest' | 'wall' | 'coda' | 'tail';

export interface Stop {
  spec: LevelSpec;
  /** The number of the board in the row, from 1. */
  number: number;
  board: Board;
  /** The act the board is of: 0 is the prologue, the road; null is the tail, of no act. */
  act: number | null;
  role: Role;
}

/** The act and the role of every board of the acts, by its code. */
const ACT_ROLES: Readonly<Record<string, { act: number; role: Role }>> = {
  K17: { act: 1, role: 'opening' },
  P03: { act: 1, role: 'apply' },
  P16: { act: 1, role: 'twist' },
  P09: { act: 1, role: 'join' },
  K21: { act: 1, role: 'peak' },
  K22: { act: 1, role: 'rest' },
  K23: { act: 2, role: 'opening' },
  P20: { act: 2, role: 'apply' },
  K25: { act: 2, role: 'twist' },
  P06: { act: 2, role: 'join' },
  P05: { act: 2, role: 'peak' },
  K28: { act: 2, role: 'rest' },
};

/** The act and the role of a board by its code: the pieces of the road by their places, a lesson being a piece of no place. */
export const ROLES: Readonly<Record<string, { act: number; role: Role }>> = {
  ...Object.fromEntries(ROAD.map((spec) => [spec.id, { act: 0, role: ROAD_PLACES.find((place) => place.id === spec.id)?.role ?? 'lesson' }])),
  ...ACT_ROLES,
};

const TAIL_ROLE = { act: null, role: 'tail' } as const;

export const CAMPAIGN: readonly Stop[] = [
  ...ROAD.map((spec, road) => ({ spec, number: road + 1, board: { road }, ...(ROLES[spec.id] ?? TAIL_ROLE) })),
  ...LEVELS.map((spec, level) => ({ spec, number: ROAD.length + level + 1, board: { level }, ...(ROLES[spec.id] ?? TAIL_ROLE) })),
];

/** The lines of the texts (`src/ui/i18n.ts`) that a board can carry above itself: those of the road and those of the acts. */
export type HintKey = RoadHintKey | 'hintSeven' | 'hintLinkMove';

export interface Hint {
  key: HintKey;
  /** The line stands from the start of the board and goes out when this has been done on it. */
  until: HintUntil;
}

/**
 * The line a board carries above itself, by its code: the lessons of the road, and the line an
 * act opens with. A line of an act is said once: a board the player has passed does not say it again.
 */
export const HINTS: Readonly<Record<string, Hint>> = {
  ...ROAD_HINTS,
  K17: { key: 'hintSeven', until: 'combo' },
  K23: { key: 'hintLinkMove', until: 'chain' },
};

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
