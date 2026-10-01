import type { Dir } from '../rules';
import type { InputController } from './controller';

export const TRIGGER_PX = 18;
export const DEAD_ZONE_PX = 10;
export const HYSTERESIS_DEG = 12;

/** Where each board direction points on screen: unit vectors, y growing downwards. */
export type ScreenDirs = Record<Dir, { x: number; y: number }>;

const ORDER: readonly Dir[] = ['N', 'E', 'S', 'W'];

/** The classic diamond view: every board direction is a screen diagonal. */
export const DIAMOND_DIRS: ScreenDirs = {
  N: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  E: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  S: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  W: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
};

/** Angle in degrees between a swipe and the on-screen direction of `dir`. */
export function degreesTo(dx: number, dy: number, dir: Dir, dirs: ScreenDirs): number {
  const length = Math.hypot(dx, dy);
  if (length === 0) return 180;
  const cos = (dx * dirs[dir].x + dy * dirs[dir].y) / length;
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** The board direction whose on-screen vector is closest to the swipe. */
export function nearestDir(dx: number, dy: number, dirs: ScreenDirs): Dir {
  let best: Dir = 'N';
  let bestAngle = Infinity;
  for (const dir of ORDER) {
    const angle = degreesTo(dx, dy, dir, dirs);
    if (angle < bestAngle) {
      best = dir;
      bestAngle = angle;
    }
  }
  return best;
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
    private readonly dirs: () => ScreenDirs = () => DIAMOND_DIRS,
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
    const dirs = this.dirs();
    if (this.active === null) {
      if (dist >= TRIGGER_PX) {
        this.active = nearestDir(dx, dy, dirs);
        this.controller.press(this.active, this.now());
      }
      return;
    }
    if (dist <= DEAD_ZONE_PX) {
      this.active = null;
      this.controller.release();
      return;
    }
    const dir = nearestDir(dx, dy, dirs);
    if (dir === this.active) return;
    // The finger must be clearly past the line between the two directions before the turn.
    const past = (degreesTo(dx, dy, this.active, dirs) - degreesTo(dx, dy, dir, dirs)) / 2;
    if (past >= HYSTERESIS_DEG) {
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
