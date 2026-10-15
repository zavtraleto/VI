import { goalOf } from '../rules/level';
import type { GoalLine } from '../rules/types';
import { starsHeld } from './progress';
import type { Help, Place } from './row';
import { ROW } from './row.gen';

/**
 * The campaign: every board the player is led through, in one row with one number each
 * (docs/superpowers/specs/2026-10-15-vi-row-json-design.md). The row is `boards/row.json` laid into
 * `row.gen.ts`; a chapter is one thought about what the dice and the floor can do, and the prologue is
 * its first chapter, whose places help the player more. What the player has passed is kept by the
 * codes of the boards, and where they stand by the code of the place (`at`).
 */

/** A stop of the row is a place of it. */
export type Stop = Place;

export const CAMPAIGN: readonly Place[] = ROW.places;

/** What is kept of the player that the row is read against. */
export interface CampaignKept {
  passed: Readonly<Record<string, boolean | undefined>>;
  stats: Readonly<Record<string, { bestMoves?: number | null } | undefined>>;
  at?: string;
}

/** A cell of the list of the levels: a board of the row with what the player holds on it. */
export interface CampaignCell {
  number: number;
  passed: boolean;
  stars: 0 | 1 | 2 | 3;
  goal: GoalLine[];
  faces?: readonly number[];
}

export function campaignCells(kept: CampaignKept, row: readonly Place[] = CAMPAIGN): CampaignCell[] {
  return row.map(({ spec, number }) => {
    const passed = kept.passed[spec.id] === true;
    // A board passed with no fewest moves kept holds the one star of having passed it.
    const stars = passed ? starsHeld(kept.stats[spec.id]?.bestMoves ?? null, spec.par) || 1 : 0;
    return { number, passed, stars, goal: goalOf(spec), faces: spec.faces };
  });
}

/** The index of the place with this code; -1 for a code that is not in the row. */
export function placeOfCode(code: string, row: readonly Place[] = CAMPAIGN): number {
  return row.findIndex((place) => place.code === code);
}

/**
 * The place the player stands on, which the list opens on and the program starts from: the place of
 * the code kept of them; for no code, or one the row has not, the first place not passed, and the
 * first when all are.
 */
export function campaignFocus(kept: CampaignKept, row: readonly Place[] = CAMPAIGN): number {
  const at = kept.at === undefined ? -1 : placeOfCode(kept.at, row);
  if (at >= 0) return at;
  const open = row.findIndex((place) => kept.passed[place.code] !== true);
  return open < 0 ? 0 : open;
}

export function campaignDone(kept: Pick<CampaignKept, 'passed'>, row: readonly Place[] = CAMPAIGN): number {
  return row.filter(({ spec }) => kept.passed[spec.id] === true).length;
}

/** The plaques a place shows over its dice: over every die from the start, over a heap whose combo is near, or none. */
export function plaquesOf(help: Help): 'all' | 'near' | null {
  return help.plaques ?? null;
}
