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
  { from: 81, to: 90, lo: 7, hi: 9, peak: [9, 9] },
  { from: 91, to: 100, lo: 8, hi: 9, peak: [10, 10] },
];

/** The band of the place of the number given; none before the 31st. */
export function bandOf(number: number): Band | null {
  return BANDS.find((band) => band.from <= number && number <= band.to) ?? null;
}
