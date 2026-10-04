import type { Dir } from '../rules';
import type { InputController } from './controller';

export const TRIGGER_PX = 18;
export const DEAD_ZONE_PX = 10;
export const HYSTERESIS_DEG = 12;
/** The point a swipe is measured from follows the finger no further behind than this. */
export const LEASH_PX = 30;

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

/** Plain swipes: up is north, right is east, whatever way the board is turned. */
export const CARDINAL_DIRS: ScreenDirs = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

/**
 * Swipe directions that lean from the plain ones towards where the board's own directions
 * point on screen. `tilt` 0 is plain swipes, 1 follows the board; half-way a swipe straight
 * up and a swipe along the board both land well inside north.
 */
export function leanDirs(board: ScreenDirs, tilt: number): ScreenDirs {
  const lean = (dir: Dir) => {
    const plain = Math.atan2(CARDINAL_DIRS[dir].y, CARDINAL_DIRS[dir].x);
    let turn = Math.atan2(board[dir].y, board[dir].x) - plain;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const angle = plain + turn * Math.min(1, Math.max(0, tilt));
    return { x: Math.cos(angle), y: Math.sin(angle) };
  };
  return { N: lean('N'), E: lean('E'), S: lean('S'), W: lean('W') };
}

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

/**
 * Swipe-and-hold tracking for one pointer. A swipe steps as soon as its direction is read, and
 * goes on stepping while the finger is held. With `onRelease` it steps when the finger is
 * lifted instead: until then the direction is only read, so it can be seen and put right, and
 * a finger brought back to where it started steps nowhere. A swipe is then one step.
 */
export class GestureTracker {
  private originX = 0;
  private originY = 0;
  private tracking = false;
  private active: Dir | null = null;

  constructor(
    private readonly controller: InputController,
    private readonly now: () => number,
    private readonly dirs: () => ScreenDirs = () => DIAMOND_DIRS,
    private readonly onRelease: () => boolean = () => false,
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
    // Read only: the step is made when the finger is lifted.
    const held = this.onRelease();
    if (this.active === null) {
      if (dist >= TRIGGER_PX) {
        this.active = nearestDir(dx, dy, dirs);
        if (!held) this.controller.press(this.active, this.now());
      }
    } else if (dist <= DEAD_ZONE_PX) {
      this.active = null;
      if (!held) this.controller.release();
    } else {
      const dir = nearestDir(dx, dy, dirs);
      // The finger must be clearly past the line between the two directions before the turn.
      const past = (degreesTo(dx, dy, this.active, dirs) - degreesTo(dx, dy, dir, dirs)) / 2;
      if (dir !== this.active && past >= HYSTERESIS_DEG) {
        this.active = dir;
        if (!held) this.controller.redirect(dir);
      }
    }
    // The origin trails the finger on a short leash: turning or going back is a short move
    // from where the finger is, not a trip back past where it first touched.
    if (dist > LEASH_PX) {
      const slack = (dist - LEASH_PX) / dist;
      this.originX += dx * slack;
      this.originY += dy * slack;
    }
  }

  up(): void {
    const dir = this.tracking && this.onRelease() ? this.active : null;
    this.tracking = false;
    this.active = null;
    if (dir !== null) this.controller.press(dir, this.now());
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
