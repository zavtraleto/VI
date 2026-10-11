/** Frames of the screen its refresh is read from. */
const SCREEN_WINDOW = 30;
/** A gap longer than this is a stumble or the page having been away, not the pace of the screen. */
const STUMBLE_MS = 250;

/** The mean of the middle half: a frame that was dropped does not move it, nor do frames that come early and late by turns. */
function middle(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const half = sorted.slice(Math.floor(sorted.length / 4), Math.ceil((sorted.length * 3) / 4));
  return half.reduce((sum, value) => sum + value, 0) / half.length;
}

/**
 * Holds the frames drawn to a limit on a screen that refreshes faster than the limit. A frame
 * is drawn on every second, third or fourth frame of the screen, never at times of its own:
 * frames that come evenly are smooth, and frames cut by the clock alone are not on a screen
 * whose refresh the limit does not divide. So the pace is the slowest the screen can give
 * that is still no slower than the limit: sixty asked for is sixty on a screen of 120 or 240,
 * seventy-two on one of 144, and every frame on one of 60, 75 or 90, where every second frame
 * would be under the limit.
 *
 * The refresh is read from the frames themselves and is not known for the first half second:
 * until then every frame is drawn.
 */
export class Pacer {
  /** The shortest steady time between two frames of the screen: its refresh; Infinity until it is known. */
  private screen = Infinity;
  private readonly recent: number[] = [];
  private seen = 0;
  private drawn = 0;

  /** `cap` is the most frames drawn in a second; 0 follows the screen. */
  constructor(private readonly cap: number) {}

  /** Frames of the screen to one frame drawn. */
  get every(): number {
    if (!(this.cap > 0) || !Number.isFinite(this.screen)) return 1;
    // A screen measured a little slow is not taken for one under a whole number of limits.
    return Math.max(1, Math.floor(1000 / this.screen / this.cap + 0.1));
  }

  /** Takes a frame of the screen by its time; returns whether it is to be drawn. */
  take(time: number): boolean {
    if (!(this.cap > 0)) return true;
    const gap = time - this.seen;
    if (this.seen !== 0 && gap > 0 && gap < STUMBLE_MS) {
      this.recent.push(gap);
      if (this.recent.length >= SCREEN_WINDOW) {
        this.screen = Math.min(this.screen, middle(this.recent));
        this.recent.length = 0;
      }
    }
    this.seen = time;
    const { every } = this;
    // Half a frame of the screen of room: the frames of a screen do not come to the millisecond.
    if (every > 1 && this.drawn !== 0 && time > this.drawn && time - this.drawn < (every - 0.5) * this.screen) return false;
    this.drawn = time;
    return true;
  }
}
