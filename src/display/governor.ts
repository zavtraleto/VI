/**
 * What the board may be drawn with, from the finest down: samples of anti-aliasing, and the
 * light the tube spreads around the dice. Smoothing the edges of the dice is the heaviest
 * thing the graphics card does for a frame: on a large canvas it is more than everything else
 * together. Two samples for four is hard to see, so they go first; then the light of the
 * tube, which is a small picture drawn and blurred on every frame; then the rest of the
 * smoothing, which shows.
 */
export const QUALITY_STEPS: readonly { samples: number; halo: boolean }[] = [
  { samples: 4, halo: true },
  { samples: 2, halo: true },
  { samples: 2, halo: false },
  { samples: 0, halo: false },
];

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
/** Frames that come at least this fast are on time with room to spare: something may be given back. */
const EASY_MS = 17.5;
/** Judgements in a row that have to find the frames on time before a step is given back: half a minute of play. */
const CLIMB_AFTER = 10;
/** Judgements a step that was given back is on trial for: slow within them, it is taken away again and asked for later. */
const TRIAL = 3;
/** The most judgements between one try and the next: a quarter of an hour of play. */
const CLIMB_AFTER_MOST = 320;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Watches how the frames of play come and takes samples of anti-aliasing away, and the light
 * of the tube, where the device does not keep up. Under sixty frames a second it gives up a
 * step at a time, down to the last. Sixty is enough on any screen: a screen that refreshes
 * faster is not a reason to give anything up.
 *
 * It gives a step back as well. What a frame costs the graphics card cannot be seen from frames
 * that are on time, so it can only try: after half a minute of play on time it goes a step
 * up, and if the frames are then slow it comes back down and waits twice as long before the
 * next try. One bad moment does not cost the look of the board for good, and a device that
 * cannot hold a step is asked less and less often.
 *
 * A device that never shows more than thirty frames a second, as a phone saving its battery
 * does, is not slow by this measure: the frames are judged against what the screen gives.
 */
export class Governor {
  /** Which of `QUALITY_STEPS` the board is drawn with. */
  step: number;
  /** The shortest steady time between two frames the screen has shown: its refresh. */
  private screen = Infinity;
  private readonly recent: number[] = [];
  private readonly gaps: number[] = [];
  private span = 0;
  private rest = SETTLE_MS;
  /** Judgements in a row that found the frames on time. */
  private easy = 0;
  /** How many of them a step up is tried after: more after every try that failed. */
  private climbAfter = CLIMB_AFTER;
  /** Judgements left of the trial of a step that was given back; 0 outside one. */
  private trial = 0;

  constructor(step = 0) {
    this.step = Math.min(QUALITY_STEPS.length - 1, Math.max(0, Math.round(step)));
  }

  /** Samples the board is drawn with now. */
  get samples(): number {
    return QUALITY_STEPS[this.step].samples;
  }

  /** The tube still spreads light around the dice. */
  get halo(): boolean {
    return QUALITY_STEPS[this.step].halo;
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
    const slow = pace > SLOW_MS && pace > this.screen * 1.3;
    if (slow) {
      this.easy = 0;
      // The step that was just given back is more than the device holds: later next time.
      if (this.trial > 0) this.climbAfter = Math.min(CLIMB_AFTER_MOST, this.climbAfter * 2);
      this.trial = 0;
      if (this.step >= QUALITY_STEPS.length - 1) return false;
      this.step++;
      this.rest = SETTLE_MS;
      return true;
    }
    // A step that has held through its trial is held: the next is tried as soon as the first was.
    if (this.trial > 0 && --this.trial === 0) this.climbAfter = CLIMB_AFTER;
    // On time with room to spare, by the screen's own measure where it shows fewer than sixty.
    if (pace > (this.screen > EASY_MS ? this.screen * 1.15 : EASY_MS)) {
      this.easy = 0;
      return false;
    }
    if (this.step === 0 || ++this.easy < this.climbAfter) return false;
    this.easy = 0;
    this.step--;
    this.trial = TRIAL;
    this.rest = SETTLE_MS;
    return true;
  }
}
