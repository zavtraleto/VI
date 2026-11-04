/**
 * The scale of difficulty of a board, from 1 to 10, and the bands each ten places of the row are to keep
 * (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md, sections 6 and 7): one number of a
 * board, so that the row is laid in bands and a board is argued over as a number, not as «простая».
 */

/** What the scale reads of a board: its measures of section 3 (`src/levels/measures.ts`). */
export interface DFacts {
  /** The depth a player has to think to clear the board (1, 2, 3, 5, 8); null where no player does. */
  rank: number | null;
  /** The places on the shortest ways where two moves look good and only one keeps the count. */
  forks: number;
  /** The dice whose goal face is not to be seen at the start. */
  hidden: number;
  /** The fewest moves after which the player can stand where the board cannot be cleared; null where it cannot be lost. */
  lossAt: number | null;
  /** The fewest moves the board is cleared in. */
  par: number;
}

/**
 * The base of the scale by the depth a player has to think: the main part of it. Each within its band of section 6;
 * the depths of one and five sit at the inner ends of theirs, as the owner's words on the row of 28 October placed
 * the boards the shallow players clear higher, and those only the planner clears lower (section 12).
 */
export const RANK_BASE: Readonly<Record<1 | 2 | 3 | 5 | 8, number>> = { 1: 2, 2: 3.5, 3: 5.5, 5: 7, 8: 9.5 };

/** The base of a depth not among those of the personas: that of the deepest of them it reaches. */
function baseOf(rank: number | null): number {
  if (rank === null) return 10;
  const depths = (Object.keys(RANK_BASE).map(Number) as (keyof typeof RANK_BASE)[]).filter((depth) => depth <= rank);
  return depths.length === 0 ? RANK_BASE[1] : RANK_BASE[depths[depths.length - 1]];
}

/**
 * The difficulty of a board: the base of its depth, a quarter for each fork over three (up to 2), a half where more
 * than one die hides its goal face, a half where it can be lost on the first or second move and a half less where
 * only after the fifth, and a half for every two moves over five. Held within 1 and 10, to a half, a quarter going up.
 * The number of the ways is no part of it: several ways are a merit, not an ease (the owner's decision 8). The
 * weights are those the calibration on the owner's words chose (spec section 12): the forks and the moves over five
 * part the boards he called hard from those he called easy better than the hidden dice and the early trap do.
 */
export function difficulty(facts: DFacts): number {
  let d = baseOf(facts.rank);
  d += Math.min(2, Math.max(0, facts.forks - 3) * 0.25);
  d += Math.min(0.5, Math.max(0, facts.hidden - 1) * 0.5);
  if (facts.lossAt !== null && facts.lossAt <= 2) d += 0.5;
  else if (facts.lossAt !== null && facts.lossAt > 5) d -= 0.5;
  if (facts.par > 5) d += Math.floor((facts.par - 5) / 2) * 0.5;
  return Math.min(10, Math.max(1, Math.round(d * 2) / 2));
}

/**
 * Two scales beside D, each set against people (docs/superpowers/specs/2026-11-04-vi-level-craft-design.md,
 * section 4, the calibration of 4 November 2026 by `node scripts/calibrate.mjs`). D mixes two kinds of
 * difficulty and foretells neither well: the share of the players of Playgama who failed a board at least
 * once goes with it at 0.37, the owner's moves against par at 0.29. A new player fails the board that is
 * easy to lose (the risk); the owner searches long on the board the shallow player cannot clear (the search).
 */

/** What the risk reads of a board. */
export interface RiskFacts {
  /** The fewest moves after which the board can no longer be cleared; null where it cannot be lost. */
  lossAt: number | null;
  /** The dice on the board, fixed ones as well. */
  dice: number;
}

/**
 * The risk of a board for a new player, from 1 to 10: how soon it can be lost (one over the moves, nothing where it
 * cannot be) and how many dice stand on it (two none, eight and more all), the two of equal weight. With the players
 * of Playgama on 24 boards it goes with the failures a player at 0.76 (Spearman) and with the share who failed at
 * least once at 0.67; the share of the boards lost added nothing to the two. To a half.
 */
export function riskOf(facts: RiskFacts): number {
  const soon = facts.lossAt === null ? 0 : 1 / Math.max(1, facts.lossAt);
  const many = Math.min(1, Math.max(0, (facts.dice - 2) / 6));
  return Math.min(10, Math.max(1, Math.round((1 + 4.5 * (soon + many)) * 2) / 2));
}

/** The weights of the search: the failures of the casual player (depth 2) above all, then the careful and the planner. */
export const SEARCH_WEIGHTS = { casual: 3, careful: 1, planner: 1 } as const;

/**
 * The search a board asks of a strong player, from 1 to 10: the shares of the runs that the casual, the careful and
 * the planning players do not clear, weighted 3, 1 and 1. With the owner on places 31-60 (25 boards) it goes with his
 * moves against par at 0.74 (0.66 and 0.75 on the two halves; the casual one alone 0.75); the planner is there to
 * leave the late boards room above. A share not measured counts as cleared. To a half.
 */
export function searchOf(shares: Readonly<Partial<Record<'casual' | 'careful' | 'planner', number>>>): number {
  const total = SEARCH_WEIGHTS.casual + SEARCH_WEIGHTS.careful + SEARCH_WEIGHTS.planner;
  const fails = (Object.keys(SEARCH_WEIGHTS) as (keyof typeof SEARCH_WEIGHTS)[]).reduce(
    (sum, name) => sum + SEARCH_WEIGHTS[name] * (1 - (shares[name] ?? 1)),
    0,
  );
  return Math.min(10, Math.max(1, Math.round((1 + (9 * fails) / total) * 2) / 2));
}

/** The band of a decade of the row: the places, the D of an ordinary board, and the D of its peak. */
export interface Band {
  from: number;
  to: number;
  lo: number;
  hi: number;
  peak: readonly [number, number];
}

/** The bands of section 7, from the 31st place: the first thirty stay as they are and are not judged. */
export const BANDS: readonly Band[] = [
  { from: 31, to: 40, lo: 3, hi: 4, peak: [5, 5] },
  { from: 41, to: 50, lo: 4, hi: 5, peak: [6, 6] },
  { from: 51, to: 60, lo: 5, hi: 6, peak: [7, 7] },
  { from: 61, to: 70, lo: 6, hi: 7, peak: [8, 8] },
  { from: 71, to: 80, lo: 7, hi: 8, peak: [8, 9] },
  // The owner's word of 28 October at the rebuild: the tasks of Devil Dice even the planner loses (D 10) go as peaks of 81–99.
  { from: 81, to: 90, lo: 7, hi: 9, peak: [9, 10] },
  { from: 91, to: 100, lo: 8, hi: 9, peak: [10, 10] },
];

/** The band of the place of the number given; none before the 31st. */
export function bandOf(number: number): Band | null {
  return BANDS.find((band) => band.from <= number && number <= band.to) ?? null;
}
