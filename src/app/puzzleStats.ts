import type { PuzzleStat } from '../platform/settings';

/** Most moves that still earn two stars: a small allowance over the fewest possible. */
export function twoStarLimit(par: number): number {
  return par + Math.max(2, Math.round(par * 0.3));
}

/** Three stars for the fewest moves, two within the allowance, one for any clear. */
export function starsFor(moves: number, par: number): number {
  if (moves <= par) return 3;
  return moves <= twoStarLimit(par) ? 2 : 1;
}

/**
 * Playtest report: one line per level that was played. Plain ASCII in English, so it survives
 * any messenger and reads the same whoever plays.
 */
export function puzzleReport(
  levels: readonly { id: string; par: number }[],
  stats: Readonly<Record<string, PuzzleStat>>,
): string {
  const lines: string[] = [];
  levels.forEach((level, i) => {
    const s = stats[level.id];
    if (!s || s.tries === 0) return;
    const result =
      s.firstMoves === null
        ? `not cleared, ${Math.round(s.playMs / 1000)}s`
        : `first ${s.firstMoves} in ${s.firstSec}s, best ${s.best}`;
    lines.push(`${i + 1}. par ${level.par}: ${result}, tries ${s.tries}, undos ${s.undos}, dead ends ${s.dead}`);
  });
  if (lines.length === 0) return '';
  return [`VI puzzle playtest, ${lines.length} of ${levels.length} levels played`, ...lines].join('\n');
}
