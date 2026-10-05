import type { LevelSpec } from '../rules/types';

/**
 * What a player has of the ladder, and what the ladder asks of a player beyond clearing a board.
 * Three things, each a plain rule over the fewest moves a level is cleared in, so that a ladder
 * of other boards needs nothing set anew:
 *
 * - stars for a pass, by its moves, the top mark a move over the fewest;
 * - a limit of moves, generous, that tightens chapter by chapter: a board punishes a wrong
 *   group and never a roll made for nothing, so the count of moves is what a roll costs;
 * - gates: a chapter opens for a share of the stars of the levels before it.
 *
 * What these numbers do to the players made of the rules is measured by `node scripts/stars.mjs`;
 * where they come from is in docs/VI_Levels_Progression_Research.md.
 */

/**
 * Moves over the fewest that still earn three stars. The top mark is not the proved fewest: a
 * player is not told what the fewest are, and a way a move longer is as good as found.
 */
export const THREE_STARS_OVER = 1;
/** Moves over the top mark that still earn two stars. */
export const TWO_STARS_OVER = 3;

/**
 * Stars of a pass: three within a move of the fewest the board is cleared in, two within a few
 * moves more, one for any pass.
 */
export function levelStars(moves: number, par: number | undefined): 1 | 2 | 3 {
  if (par === undefined) return 1;
  if (moves <= par + THREE_STARS_OVER) return 3;
  return moves <= par + THREE_STARS_OVER + TWO_STARS_OVER ? 2 : 1;
}

/** Stars a player holds on a level: those of the fewest moves it has been passed in, none before a pass. */
export function starsHeld(bestMoves: number | null | undefined, par: number | undefined): 0 | 1 | 2 | 3 {
  return bestMoves === null || bestMoves === undefined ? 0 : levelStars(bestMoves, par);
}

/** A chapter: the levels from `from` up to and not including `to`, counted from 0. */
export interface Chapter {
  from: number;
  to: number;
}

/** The chapters of a ladder: the levels that follow one another with the same faces at work. */
export function chaptersOf(levels: readonly Pick<LevelSpec, 'faces'>[]): Chapter[] {
  const chapters: Chapter[] = [];
  levels.forEach((level, index) => {
    const last = chapters[chapters.length - 1];
    if (last && String(levels[last.from].faces) === String(level.faces)) last.to = index + 1;
    else chapters.push({ from: index, to: index + 1 });
  });
  return chapters;
}

/** How many times the fewest moves a level of each chapter gives, and the least it comes down to. */
const LIMIT_TIMES = [5, 4, 3];
/** Moves a limit gives over that, whatever the level. */
const LIMIT_SPARE = 10;

/**
 * The moves a level of a chapter gives: so many times the fewest it is cleared in, and some to
 * spare. None (0) where the fewest are not known.
 */
export function moveLimit(par: number | undefined, chapter: number): number {
  if (par === undefined) return 0;
  return LIMIT_TIMES[Math.min(chapter, LIMIT_TIMES.length - 1)] * par + LIMIT_SPARE;
}

/** A level of the ladder as it is played: with the limit of its chapter. The level kept stays as it is. */
export function limitedLevel(levels: readonly LevelSpec[], index: number): LevelSpec {
  const chapter = chaptersOf(levels).findIndex(({ from, to }) => index >= from && index < to);
  return { ...levels[index], moves: moveLimit(levels[index].par, chapter) };
}

/** Share of the stars of the levels before a chapter that open it. */
export const GATE_SHARE = 0.4;

/** Stars a chapter asks for: a share of what the levels before it can give. The first asks for none. */
export function gateOf(chapter: Chapter): number {
  return Math.ceil(GATE_SHARE * 3 * chapter.from);
}

/** How a player stands on the ladder. */
export interface LadderProgress {
  /** Stars held on every level. */
  stars: (0 | 1 | 2 | 3)[];
  total: number;
  chapters: (Chapter & { gate: number; open: boolean })[];
  /** Levels that cannot be played yet: those of a chapter that is not open. */
  locked: boolean[];
  /** The chapter a level is in, counted from 0. */
  chapterOf: (index: number) => number;
}

/**
 * The ladder as a player has it: the stars of every level by the fewest moves it was passed in
 * (`best` answers by the code of a level), and the chapters those stars open. Stars count
 * wherever they were earned. With `gates` off every chapter is open.
 */
export function ladderProgress(levels: readonly LevelSpec[], best: (id: string) => number | null | undefined, gates = true): LadderProgress {
  const stars = levels.map((level) => starsHeld(best(level.id), level.par));
  const total = stars.reduce<number>((sum, count) => sum + count, 0);
  const chapters = chaptersOf(levels).map((chapter) => {
    const gate = gateOf(chapter);
    return { ...chapter, gate, open: !gates || total >= gate };
  });
  const chapterOf = (index: number) => chapters.findIndex(({ from, to }) => index >= from && index < to);
  return { stars, total, chapters, locked: levels.map((_, index) => !(chapters[chapterOf(index)]?.open ?? true)), chapterOf };
}
