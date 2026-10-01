import type { Dir } from '../rules';
import type { InputController } from './controller';

export const TRIGGER_PX = 18;
export const DEAD_ZONE_PX = 10;
export const HYSTERESIS_DEG = 12;

/**
 * Board directions on screen are the four diagonals, so the nearest direction is simply
 * the quadrant the finger is in. Screen y grows downwards.
 */
export function quadrantDir(dx: number, dy: number): Dir {
  if (dx >= 0) return dy < 0 ? 'N' : 'E';
  return dy < 0 ? 'W' : 'S';
}

/** Degrees between the vector and the nearest quadrant boundary (the screen axes). */
export function degreesFromBoundary(dx: number, dy: number): number {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const mod = ((angle % 90) + 90) % 90;
  return Math.min(mod, 90 - mod);
}

/** Swipe-and-hold tracking for one pointer. */
export class GestureTracker {
  private originX = 0;
  private originY = 0;
  private tracking = false;
  private active: Dir | null = null;

  constructor(
    private readonly controller: InputController,
    private readonly now: () => number,
  ) {}

  get direction(): Dir | null {
    return this.active;
  }

  down(x: number, y: number): void {
    this.originX = x;
    this.originY = y;
    this.tracking = true;
    this.active = null;
  }

  move(x: number, y: number): void {
    if (!this.tracking) return;
    const dx = x - this.originX;
    const dy = y - this.originY;
    const dist = Math.hypot(dx, dy);
    if (this.active === null) {
      if (dist >= TRIGGER_PX) {
        this.active = quadrantDir(dx, dy);
        this.controller.press(this.active, this.now());
      }
      return;
    }
    if (dist <= DEAD_ZONE_PX) {
      this.active = null;
      this.controller.release();
      return;
    }
    const dir = quadrantDir(dx, dy);
    if (dir !== this.active && degreesFromBoundary(dx, dy) >= HYSTERESIS_DEG) {
      this.active = dir;
      this.controller.redirect(dir);
    }
  }

  up(): void {
    this.tracking = false;
    this.active = null;
    this.controller.release();
  }

  cancel(): void {
    this.tracking = false;
    this.active = null;
    this.controller.cancel();
  }
}

/** Wires a tracker to Pointer Events on an element. Extra fingers are ignored. */
export function bindGestures(el: HTMLElement, tracker: GestureTracker, enabled: () => boolean): void {
  let pointerId: number | null = null;
  el.addEventListener('pointerdown', (e) => {
    if (pointerId !== null || !enabled()) return;
    if ((e.target as HTMLElement).closest('button')) return;
    pointerId = e.pointerId;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety; tracking still works without it.
    }
    tracker.down(e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointerId) tracker.move(e.clientX, e.clientY);
  });
  el.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    tracker.up();
  });
  el.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    tracker.cancel();
  });
}
