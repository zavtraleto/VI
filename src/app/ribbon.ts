/**
 * The ribbon: the stages of the first level and the levels of the list follow one another with
 * no window between them. The dice of a board that is passed leave, its surface goes out row by
 * row, the surface of the next comes the same way with its dice, the figure comes onto it, and
 * the board is the player's. Nothing here reads a clock or draws: whoever owns the frame says
 * how long ago the dice were gone, and draws what this says.
 */
import type { GridBands } from '../render/textures';

/**
 * Where the passage between two boards stands: the dice of the old one are still leaving, its
 * surface goes out, the new one comes, the figure comes onto it, the board is given over.
 */
export type RibbonPhase = 'leave' | 'fade' | 'reveal' | 'figure' | 'done';

/** How long the surface takes to go out and to come, and how long the figure takes to come onto it before the board takes input, in milliseconds. */
export const RIBBON_MS = { fade: 500, reveal: 800, figure: 300 } as const;

/**
 * The phase of the passage `elapsedMs` after the dice of the old board were gone; the share of
 * the rows of the surface that is drawn: all to none while it goes out, none to all while it
 * comes; and how much of the figure has come onto the new board: none until the board is whole,
 * then none to all. With motion kept low there are no rows and no coming: the board is changed
 * at once, with the figure on it.
 */
export function ribbonPhase(elapsedMs: number, reduced: boolean): { phase: RibbonPhase; rows: number; figure: number } {
  if (elapsedMs < 0) return { phase: 'leave', rows: 1, figure: 0 };
  const fade = reduced ? 0 : RIBBON_MS.fade;
  const reveal = reduced ? 0 : RIBBON_MS.reveal;
  if (elapsedMs < fade) return { phase: 'fade', rows: 1 - elapsedMs / fade, figure: 0 };
  if (elapsedMs < fade + reveal) return { phase: 'reveal', rows: (elapsedMs - fade) / reveal, figure: 0 };
  const stood = elapsedMs - fade - reveal;
  if (stood < RIBBON_MS.figure) return { phase: 'figure', rows: 1, figure: reduced ? 1 : stood / RIBBON_MS.figure };
  return { phase: 'done', rows: 1, figure: 1 };
}

/** A board of the ribbon: a stage of the first level or a level of the list, by its place. */
export interface RibbonBoard {
  stage?: number;
  level?: number;
}

/**
 * The board the program opens on: the first stage for one who has not passed the first level,
 * and for anyone else `onward`, the level of the list the player goes on with.
 */
export function startBoard(firstPassed: boolean, onward: number): RibbonBoard {
  return firstPassed ? { level: onward } : { stage: 0 };
}

/**
 * What comes after a board of the ribbon: the next stage; after the last stage `onward`, the
 * level of the list the player goes on with, so that one who has passed levels of the list is
 * not walked through them again; the next level of the list after a level; null after the last.
 */
export function nextBoard(current: RibbonBoard, stages: number, levels: number, onward: number): RibbonBoard | null {
  if (current.stage !== undefined && current.stage + 1 < stages) return { stage: current.stage + 1 };
  const level = current.stage !== undefined ? onward : (current.level ?? 0) + 1;
  return level < levels ? { level } : null;
}

/**
 * The rows of a surface of `cells` rows that are drawn when `share` of it is, whole rows at a
 * time, counted from the top of the screen. A board that goes out loses them from the top, as a
 * picture the tube has stopped drawing. One that comes gets them from the top: the heavy line
 * around the cells first, and the lines between them a row behind it.
 */
export function revealBands(share: number, cells: number, coming: boolean): GridBands {
  if (!coming) {
    const kept = Math.min(cells, Math.max(0, Math.ceil(share * cells)));
    return { edge: [cells - kept, cells], lines: [cells - kept, cells] };
  }
  const edge = Math.min(cells, Math.max(0, Math.ceil(share * (cells + 1))));
  return { edge: [0, edge], lines: [0, share >= 1 ? cells : Math.max(0, edge - 1)] };
}
