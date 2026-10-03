/**
 * Samples of anti-aliasing the board may be drawn with, from the finest down. Smoothing the
 * edges of the dice is the heaviest thing the graphics card does for a frame: on a large
 * canvas it is more than everything else together.
 */
export const SAMPLE_STEPS: readonly number[] = [4, 2, 0];

/** Play one judgement is made from, in milliseconds, and the fewest frames it may be made from. */
const WINDOW_MS = 3000;
const WINDOW_FRAMES = 30;
/** Play left out before frames are counted, after a start or a change, in milliseconds. */
const SETTLE_MS = 2000;
/** A gap longer than this is a stumble or the page having been away, not the pace of the frames. */
const STUMBLE_MS = 250;
/** Frames the refresh of the screen is read from, play or not. */
const SCREEN_WINDOW = 60;
/** A frame slower than this is under sixty a second, with room for the clock's own unevenness. */
const SLOW_MS = 20;
/** A screen whose frames come faster than this refreshes more than sixty times a second. */
const FAST_SCREEN_MS = 12;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Watches how the frames of play come and takes samples of anti-aliasing away where the
 * device does not keep up. It only ever goes down: what a frame costs the graphics card
 * cannot be seen from frames that are on time, so there is no telling when it is safe to go
 * back up.
 *
 * Under sixty frames a second it gives up a step at a time, down to none. On a screen that
 * refreshes faster, where the game runs at sixty or more but not at the screen's own rate, it
 * gives up the first step only: four samples for two is hard to see, none at all is not.
 *
 * A device that never shows more than thirty frames a second, as a phone saving its battery
 * does, is not slow by this measure: the frames are judged against what the screen gives.
 */
export class Governor {
  /** Which of `SAMPLE_STEPS` the board is drawn with. */
  step: number;
  /** The shortest steady time between two frames the screen has shown: its refresh. */
  private screen = Infinity;
  private readonly recent: number[] = [];
  private readonly gaps: number[] = [];
  private span = 0;
  private rest = SETTLE_MS;

  constructor(step = 0) {
    this.step = Math.min(SAMPLE_STEPS.length - 1, Math.max(0, Math.round(step)));
  }

  /** Samples the board is drawn with now. */
  get samples(): number {
    return SAMPLE_STEPS[this.step];
  }

  /**
   * Takes the time since the frame before. `playing` is a session on screen and running: only
   * its frames are judged. Returns whether the step has changed.
   */
  frame(dtMs: number, playing: boolean): boolean {
    if (!(dtMs > 0) || dtMs > STUMBLE_MS) return false;
    this.recent.push(dtMs);
    if (this.recent.length >= SCREEN_WINDOW) {
      this.screen = Math.min(this.screen, median(this.recent));
      this.recent.length = 0;
    }
    if (!playing) {
      // What was counted before the break says nothing of the play after it.
      this.gaps.length = 0;
      this.span = 0;
      this.rest = SETTLE_MS;
      return false;
    }
    if (this.rest > 0) {
      this.rest -= dtMs;
      return false;
    }
    this.gaps.push(dtMs);
    this.span += dtMs;
    if (this.span < WINDOW_MS || this.gaps.length < WINDOW_FRAMES) return false;
    const pace = median(this.gaps);
    this.gaps.length = 0;
    this.span = 0;
    if (this.step >= SAMPLE_STEPS.length - 1) return false;
    const slow = pace > SLOW_MS && pace > this.screen * 1.3;
    const behind = this.step === 0 && this.screen < FAST_SCREEN_MS && pace > this.screen * 1.6;
    if (!slow && !behind) return false;
    this.step++;
    this.rest = SETTLE_MS;
    return true;
  }
}
