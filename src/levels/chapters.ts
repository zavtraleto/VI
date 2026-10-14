import type { LevelSpec } from '../rules/types';

/**
 * The chapters of the campaign and what every board of the row is in it
 * (docs/superpowers/specs/2026-10-14-vi-campaign-2-design.md, sections 3, 4 and 7). The list of the
 * levels (`levels.ts`) is built from the chapters, and the row (`campaign.ts`) from the road and the
 * list, so the chapters live apart from both.
 */

/** What a board is in its chapter: a meeting with a move, learning it, using it, an event, a twist, the peak, a rest. */
export type Role = 'meet' | 'learn' | 'apply' | 'event' | 'twist' | 'peak' | 'rest';

/** A move a board can bring in (`teaches`) or ask for: the words of the grammar of the row (`grammar.ts`). */
export type Technique = 'link' | 'walk' | 'glass' | 'lift' | 'push' | 'ones' | 'twoFaces' | 'seven' | 'time';

/** A chapter of the row: its number, its name, its faces (null for the prologue, whose pieces have their own) and its boards in their order. */
export interface Chapter {
  id: number;
  title: string;
  faces: readonly number[] | null;
  stops: readonly string[];
}

/** The chapters of the row, in its order: the prologue is chapter 0. */
export const CHAPTERS: readonly Chapter[] = [
  { id: 0, title: 'prologue', faces: null, stops: ['R01', 'R02', 'R03', 'R04', 'R05', 'R07', 'R08'] },
  { id: 1, title: 'road', faces: [2, 3], stops: ['R11', 'P02', 'R15', 'C1-04', 'C1-05', 'C1-06', 'K22'] },
];

/** What a board is in the row, by its code: its chapter, its role, the move it brings in, what it is about (its archetype) and what is seen on it first. */
export interface StopMeta {
  chapter: number;
  role: Role;
  teaches?: Technique;
  archetype: string;
  event?: string;
}

export const STOPS: Readonly<Record<string, StopMeta>> = {
  R01: { chapter: 0, role: 'meet', archetype: 'roll' },
  R02: { chapter: 0, role: 'learn', archetype: 'ride', event: 'stair and floor' },
  R03: { chapter: 0, role: 'apply', archetype: 'first free board' },
  R04: { chapter: 0, role: 'apply', archetype: 'free to fail', event: 'first dead end' },
  R05: { chapter: 0, role: 'apply', archetype: 'choose the first die', event: 'choice of the first die' },
  R07: { chapter: 0, role: 'meet', teaches: 'link', archetype: 'chain' },
  R08: { chapter: 0, role: 'rest', archetype: 'domino', event: 'domino' },
  R11: { chapter: 1, role: 'meet', teaches: 'walk', archetype: 'bridge', event: 'first walk over leaving dice' },
  P02: { chapter: 1, role: 'apply', archetype: 'bridge' },
  R15: { chapter: 1, role: 'apply', archetype: 'bridge' },
  'C1-04': { chapter: 1, role: 'meet', teaches: 'glass', archetype: 'roll onto leaving', event: 'a leaving die is a cell' },
  'C1-05': { chapter: 1, role: 'apply', archetype: 'roll onto leaving' },
  'C1-06': { chapter: 1, role: 'twist', archetype: 'bridge both ways', event: 'the road goes both ways, briefly' },
  K22: { chapter: 1, role: 'rest', archetype: 'collapse', event: 'first big clearing' },
};

/** A board on the faces of its chapter: the faces that work and the values it is counted on are the chapter's. */
export function withChapterFaces(spec: LevelSpec, faces: readonly number[]): LevelSpec {
  return { ...spec, faces, values: faces };
}

