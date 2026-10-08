/**
 * How long the player of a piece of the road has waited, and what the piece shows for it: first the plaque
 * over the target blinks, then the swipe sign comes. A move or a step takes both away, and they
 * come back after the same wait. Time under a panel, or while the board takes no input, is not
 * waited. Nothing here reads a clock: whoever owns the frame says what time it is.
 */

/** When the plaque blinks and when the sign comes, in milliseconds of waiting, and how many wasted moves bring the sign at once. A null is a thing the piece does not do. */
export interface IdleRule {
  blinkMs: number | null;
  signMs: number;
  wasted: number | null;
}

export interface IdleView {
  /** The plaque over the target blinks: until the sign has come. */
  blink: boolean;
  /** The swipe sign is shown. */
  sign: boolean;
}

export class Idle {
  /** When the player last did something, moved on by the time not counted since; null until they have stood on the board. */
  private since: number | null = null;
  private wasted = 0;
  /** When the time stopped counting; null while it counts. */
  private pausedAt: number | null = null;

  constructor(private readonly rule: IdleRule) {}

  /** The player did something: a move or a step. `wasted` is moves made minus progress by the solver since the start. */
  acted(timeMs: number, wasted: number): void {
    this.since = timeMs;
    this.wasted = wasted;
    // What is done under a panel is waited from when the panel goes.
    if (this.pausedAt !== null) this.pausedAt = timeMs;
  }

  /** A panel is open or input is off: time does not count. */
  pause(timeMs: number): void {
    this.pausedAt ??= timeMs;
  }

  resume(timeMs: number): void {
    if (this.pausedAt === null) return;
    if (this.since !== null) this.since += timeMs - this.pausedAt;
    this.pausedAt = null;
  }

  /** `hurry`: the sign is shown whatever the wait, because the piece has come to a dead end again (spec of the teaching road, 7). */
  at(timeMs: number, hurry = false): IdleView {
    const { blinkMs, signMs, wasted } = this.rule;
    const waited = this.since === null ? 0 : (this.pausedAt ?? timeMs) - this.since;
    const sign = hurry || waited >= signMs || (wasted !== null && this.wasted >= wasted);
    return { blink: !sign && blinkMs !== null && waited >= blinkMs, sign };
  }
}
