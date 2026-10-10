import { goalOf } from '../rules/level';
import type { GoalLine } from '../rules/types';
import { starsHeld } from './progress';
import { ROAD, roadPlace } from './road';

/**
 * The pieces of the road as a list to pick from: what the file of the menu that says how the
 * game is played shows, so that the teaching can be come back to and begun anew. Every piece is
 * open. Nothing here is kept: it is read from what the player has passed.
 */

/** A piece of the road as its cell in the list shows it. */
export interface RoadCell {
  /** The number on the cell, counted from 1. */
  number: number;
  passed: boolean;
  /** Stars of the fewest moves the piece was passed in; none before a pass. */
  stars: 0 | 1 | 2 | 3;
  goal: GoalLine[];
  /** The faces that work on the piece. */
  faces?: readonly number[];
}

/** What is read of the player: what they have passed, and the fewest moves of each pass, by the codes of the pieces. */
export interface RoadKeptList {
  passed: Readonly<Record<string, boolean | undefined>>;
  stats: Readonly<Record<string, { bestMoves?: number | null } | undefined>>;
}

/** The list of the pieces: a cell for each, in the order of the road, with the stars the player holds on it. */
export function roadCells(kept: RoadKeptList): RoadCell[] {
  return ROAD.map((spec, index) => {
    const passed = kept.passed[spec.id] === true;
    return {
      number: index + 1,
      passed,
      stars: passed ? starsHeld(kept.stats[spec.id]?.bestMoves ?? null, spec.par) || 1 : 0,
      goal: goalOf(spec),
      faces: spec.faces,
    };
  });
}

/** Pieces of the road the player has passed. */
export function roadDone(kept: Pick<RoadKeptList, 'passed'>): number {
  return ROAD.filter((spec) => kept.passed[spec.id] === true).length;
}

/**
 * The cell the list opens on: the piece the player is on, by what is kept of their place
 * (`roadPlace`); the first for one who is past the road.
 */
export function roadFocus(road: string | undefined, firstPassed: boolean): number {
  return roadPlace(road, firstPassed) ?? 0;
}
