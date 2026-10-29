/** A press that wanders no further than this from where it came down, in CSS pixels, is a tap. */
export const TAP_SLOP_PX = 14;

/**
 * Tells a tap from a drag for one pointer: a press let go no further than `TAP_SLOP_PX` from
 * where it came down, at any time on its way, is a tap at the place it came down.
 */
export class TapTracker {
  private at: { x: number; y: number } | null = null;

  down(x: number, y: number): void {
    this.at = { x, y };
  }

  move(x: number, y: number): void {
    if (this.at && Math.hypot(x - this.at.x, y - this.at.y) > TAP_SLOP_PX) this.at = null;
  }

  /** The place of the tap, or null where the press was a drag. */
  up(): { x: number; y: number } | null {
    const at = this.at;
    this.at = null;
    return at;
  }

  cancel(): void {
    this.at = null;
  }
}

/**
 * Wires taps to Pointer Events on an element: the left button of a mouse, a finger, a pen. A
 * second finger is not a tap. The readings of the screen take their own presses before they get here.
 */
export function bindTaps(el: HTMLElement, onTap: (x: number, y: number) => void, enabled: () => boolean): void {
  const tracker = new TapTracker();
  let pointerId: number | null = null;
  el.addEventListener('pointerdown', (e) => {
    if (pointerId !== null || !enabled()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    tracker.down(e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointerId) tracker.move(e.clientX, e.clientY);
  });
  el.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    const at = tracker.up();
    if (at && enabled()) onTap(at.x, at.y);
  });
  el.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    tracker.cancel();
  });
}
