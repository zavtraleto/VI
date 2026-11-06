import type { LevelSpec } from '../rules/types';

/**
 * What a player has of the ladder: stars for a pass, by its moves, the top mark a move over the
 * fewest. A plain rule over the fewest moves a level is cleared in, so that a ladder of other
 * boards needs nothing set anew. Every level is open: the gates of the chapters went on
 * 15 October 2026.
 *
 * A level has no limit of moves: the one this module laid on it was taken out on 12 October 2026.
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

/**
 * The sum of the stars: those held on every board given, a level of the list or a piece of the
 * road. It is the sum of the best passes, so a board passed again adds only the stars it had not
 * earned before. The records of the link open on it (`src/app/novel.ts`).
 */
export function starsSum(boards: readonly Pick<LevelSpec, 'id' | 'par'>[], bestMoves: (id: string) => number | null | undefined): number {
  return boards.reduce((sum, board) => sum + starsHeld(bestMoves(board.id), board.par), 0);
}
