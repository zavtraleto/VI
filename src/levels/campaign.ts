import { goalOf } from '../rules/level';
import type { GoalLine } from '../rules/types';
import { starsHeld } from './progress';
import type { Help, Live, Place } from './row';
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

/**
 * The live sessions of the row (docs/superpowers/specs/2026-10-22-vi-live-sessions-design.md): Endless
 * on a clock between chapters, each after a board of the row. Not places: the boards keep their numbers.
 */
export const LIVES: readonly Live[] = ROW.lives;

/** What is kept of a live session: the best score of it and how many times it was played. */
export interface LiveStat {
  best: number;
  plays: number;
}

/** What is kept of the player that the row is read against. */
export interface CampaignKept {
  passed: Readonly<Record<string, boolean | undefined>>;
  stats: Readonly<Record<string, { bestMoves?: number | null } | undefined>>;
  at?: string;
  /** The live sessions by their codes. */
  lives?: Readonly<Record<string, LiveStat | undefined>>;
}

/** The live session that stands after the place of this index, or null. */
export function liveAfter(placeIndex: number, lives: readonly Live[] = LIVES): Live | null {
  return lives.find((live) => live.after === placeIndex) ?? null;
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

/** A cell of the list of the levels: a board, or a live session after the board it stands after. */
export type CampaignListCell =
  | { kind: 'board'; cell: CampaignCell }
  | { kind: 'live'; code: string; step: number; best: number | null; played: boolean };

/** The cells of the list of the levels in their order: the boards, and each live session after its board. */
export function campaignList(kept: CampaignKept, row: readonly Place[] = CAMPAIGN, lives: readonly Live[] = LIVES): CampaignListCell[] {
  const list: CampaignListCell[] = [];
  campaignCells(kept, row).forEach((cell, index) => {
    list.push({ kind: 'board', cell });
    const live = liveAfter(index, lives);
    if (!live) return;
    const stat = kept.lives?.[live.code];
    const played = (stat?.plays ?? 0) > 0;
    list.push({ kind: 'live', code: live.code, step: live.step, best: played ? stat!.best : null, played });
  });
  return list;
}

/** The index of the place with this code; -1 for a code that is not in the row. */
export function placeOfCode(code: string, row: readonly Place[] = CAMPAIGN): number {
  return row.findIndex((place) => place.code === code);
}

/**
 * The place the player stands on, which the program starts from and the list opens on, as the road and
 * the list had it before the row was one: on the prologue (the first chapter), the place of the code
 * kept of them, whatever they play or have passed further on; with no code, or one the row has not, its
 * first place. Past the prologue (a code of a later chapter), the place of a chapter being played
 * (`playing`, for the list), or else the first place of the chapters not passed, and their first when
 * all are: a place passed out of turn holds no one.
 */
export function campaignFocus(kept: CampaignKept, row: readonly Place[] = CAMPAIGN, playing: number | null = null): number {
  const at = kept.at === undefined ? -1 : placeOfCode(kept.at, row);
  if (at < 0) return 0;
  if (row[at].chapter === 0) return at;
  if (playing !== null && row[playing]?.chapter > 0) return playing;
  const chapters = row.findIndex((place) => place.chapter > 0);
  const open = row.findIndex((place) => place.chapter > 0 && kept.passed[place.code] !== true);
  return open >= 0 ? open : chapters;
}

export function campaignDone(kept: Pick<CampaignKept, 'passed'>, row: readonly Place[] = CAMPAIGN): number {
  return row.filter(({ spec }) => kept.passed[spec.id] === true).length;
}

/** The plaques a place shows over its dice: over every die from the start, over a heap whose combo is near, or none. */
export function plaquesOf(help: Help): 'all' | 'near' | null {
  return help.plaques ?? null;
}
