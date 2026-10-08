/**
 * The dice of a board while it is passed from, or come to: every die has its own time. The dice
 * of the combo that cleared a board light up one after another and then go under the floor one
 * after another; the dice of the next board come up out of it, the nearest to the player first
 * and a stair last. Nothing here reads a clock or draws: whoever owns the passage says how long
 * ago each part of it began, and the view reads how every die stands.
 */

/** How the dice of the board that is on stand in a passage between two boards. One object, kept by its owner and changed in place. */
export interface DicePassing {
  /** The dice are going, lit one by one and then under the floor; or they are coming up out of it. */
  mode: 'leave' | 'come';
  /** The place of every die in the order it lights and goes, or comes, by the id of its cube. */
  ranks: Map<number, number>;
  /**
   * Going: how many dice light up, the first of the order; the rest were going already and go
   * with the last of these. Coming: how many dice there are.
   */
  count: number;
  /** Coming: the id of the die that is the stair and comes last, after the others stand; -1 where there is none. */
  stair: number;
  /** Going: milliseconds since the first die lit up. */
  litMs: number;
  /** Milliseconds since the first die began to go under, or to come up; under nought before that. */
  moveMs: number;
  /** From one die to the next, and how long one die takes to go or to come, in milliseconds. */
  stepMs: number;
  moveForMs: number;
  /** Going: how long the light of a die that has just lit up takes to go down. */
  flashMs: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** How far through its `ms` the die of place `rank` is, 0 to 1, each die `stepMs` after the one before. */
export function dieShare(elapsedMs: number, rank: number, stepMs: number, ms: number): number {
  const since = elapsedMs - rank * stepMs;
  if (!(ms > 0)) return since >= 0 ? 1 : 0;
  return clamp01(since / ms);
}

/**
 * When the die of place `rank` of `dice` begins to come up, in milliseconds from the first:
 * a step later for every place. A stair is the last of the order and begins when every other
 * die stands.
 */
export function riseStart(rank: number, dice: number, stair: boolean, stepMs: number, riseMs: number): number {
  if (!stair || rank < dice - 1) return rank * stepMs;
  return dice > 1 ? (dice - 2) * stepMs + riseMs : 0;
}

/** How long the dice of a board take to come up, all of them, from the first to the last that stands. */
export function riseSpan(dice: number, stair: boolean, stepMs: number, riseMs: number): number {
  return dice > 0 ? riseStart(dice - 1, dice, stair, stepMs, riseMs) + riseMs : 0;
}

/** How many of the dice of a board stand, `elapsedMs` after the first began to come up. */
export function stoodBy(elapsedMs: number, dice: number, stair: boolean, stepMs: number, riseMs: number): number {
  let stood = 0;
  for (let rank = 0; rank < dice; rank++) if (elapsedMs >= riseStart(rank, dice, stair, stepMs, riseMs) + riseMs) stood++;
  return stood;
}

/** A die of the board that is passed is lit: its turn has come, or it was going before the combo. */
export function isLit(passing: DicePassing, rank: number): boolean {
  return rank >= passing.count || passing.litMs >= rank * passing.stepMs;
}

/** What is left of the light a die took when it lit up, 1 at that moment and falling to 0. */
export function litFlash(passing: DicePassing, rank: number): number {
  if (rank >= passing.count || !(passing.flashMs > 0)) return 0;
  const since = passing.litMs - rank * passing.stepMs;
  return since < 0 ? 0 : clamp01(1 - since / passing.flashMs);
}

/** How far under the floor a die of the board that is passed has gone, 0 to 1. */
export function goneShare(passing: DicePassing, rank: number): number {
  return dieShare(passing.moveMs, Math.min(rank, Math.max(0, passing.count - 1)), passing.stepMs, passing.moveForMs);
}

/** How far a die of the board that comes has come up, 0 to 1. */
export function comeShare(passing: DicePassing, rank: number): number {
  const start = riseStart(rank, passing.count, passing.stair >= 0, passing.stepMs, passing.moveForMs);
  return dieShare(passing.moveMs - start, 0, 0, passing.moveForMs);
}

/**
 * How high a die stands as the passage has it; `own` is its height by the rules. Going, a die
 * that is not lit yet stands whole, and a lit one goes down from where it stood, slowly at first
 * and then falling away. Coming, it comes up to where the rules have it, fast at first and
 * settling at the end: a die that stands to its full height, a stair to its own.
 */
export function passingHeight(passing: DicePassing, rank: number, own: number): number {
  if (passing.mode === 'leave') {
    if (!isLit(passing, rank)) return 1;
    const gone = goneShare(passing, rank);
    return own * (1 - gone * gone);
  }
  const left = 1 - comeShare(passing, rank);
  return own * (1 - left * left);
}

/**
 * The grey a face of a fixed die is before its combo lights it, from the light of its channel
 * (linear red, green, blue): as bright as the eye takes that colour to be, and `tone` of that.
 * The shader of the dice counts the same. A proposal: the owner has not said how a fixed die looks.
 */
export function unlitGrey(r: number, g: number, b: number, tone: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) * tone;
}
