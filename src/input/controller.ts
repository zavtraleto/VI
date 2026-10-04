import type { Dir } from '../rules';

export const FIRST_REPEAT_MS = 320;
export const REPEAT_MS = 200;

/**
 * Turns presses and holds into single-step commands. Holds one buffered command at most;
 * a newer press replaces it. Time is supplied by the caller in game milliseconds.
 */
export class InputController {
  private pending: Dir | null = null;
  private held: Dir | null = null;
  private heldSince = 0;
  private lastEmit = Number.NEGATIVE_INFINITY;
  private repeats = true;

  /**
   * Whether a held direction goes on stepping. Where every step is a move that counts, it does
   * not: a press is one step, however long it is held.
   */
  setRepeat(on: boolean): void {
    this.repeats = on;
  }

  /** A fresh press: one guaranteed step, then repeats while held. */
  press(dir: Dir, now: number): void {
    this.pending = dir;
    this.held = dir;
    this.heldSince = now;
  }

  /** Direction changed during a hold: step the new way at once and keep repeating. */
  redirect(dir: Dir): void {
    this.pending = dir;
    this.held = dir;
  }

  /** Falls back to another direction that is still held, without an extra step. */
  hold(dir: Dir): void {
    this.held = dir;
  }

  /** Stops repeating. A step already buffered still happens. */
  release(): void {
    this.held = null;
  }

  /** Drops the hold and the buffered step. */
  cancel(): void {
    this.held = null;
    this.pending = null;
  }

  /** Called when the player can act. Returns the command to run, if any. */
  take(now: number): Dir | null {
    if (this.pending !== null) {
      const dir = this.pending;
      this.pending = null;
      this.lastEmit = now;
      return dir;
    }
    if (this.repeats && this.held !== null && now - this.heldSince >= FIRST_REPEAT_MS && now - this.lastEmit >= REPEAT_MS) {
      this.lastEmit = now;
      return this.held;
    }
    return null;
  }
}
