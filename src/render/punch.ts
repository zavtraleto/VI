import { outCubic, tween } from './ease';

/**
 * The lean of the camera on a beat: it comes up to its peak in the attack and goes back down
 * after it, so that a beat is a push and not a step of the picture (spec:
 * docs/superpowers/specs/2026-10-13-vi-leaving-choreography-design.md, 3.4). A beat that comes in
 * the attack raises the peak without starting over; one that comes later starts from where the
 * lean is. In every mode.
 */
export class CameraPunch {
  private from = 0;
  private peak = 0;
  /** How long ago the lean was struck, and the attack it was struck with. */
  private ms = 0;
  private attack = 0;

  /** `decayMs` is what the lean that is on goes back by: a later beat starts from where that has brought it. */
  lean(peak: number, attackMs: number, decayMs: number): void {
    if (this.peak > 0 && this.ms < this.attack) {
      this.peak = Math.max(this.peak, peak);
      return;
    }
    const now = this.value(decayMs);
    this.from = now;
    this.peak = Math.max(now, peak);
    this.ms = 0;
    this.attack = Math.max(0, attackMs);
  }

  update(dtMs: number): void {
    this.ms += dtMs;
  }

  /** How far the camera leans now, as a share of its zoom; `decayMs` is how fast it goes back after the peak. */
  value(decayMs: number): number {
    if (this.peak <= 0) return 0;
    if (this.ms < this.attack) return tween(this.ms / this.attack, this.from, this.peak, outCubic);
    return this.peak * Math.exp(-(this.ms - this.attack) / Math.max(1, decayMs));
  }

  reset(): void {
    this.from = 0;
    this.peak = 0;
    this.ms = 0;
  }
}
