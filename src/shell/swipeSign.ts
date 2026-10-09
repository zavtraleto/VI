import type { Dir } from '../rules';
import { signKey } from './hudLayout';
import type { Kit } from './kit';
import { CELL_H, type Box, type Point } from './layout';

/**
 * The drawing of the swipe sign, apart from the readings it is drawn over: the sign is another
 * picture on every frame of its run, and whoever owns the picture draws it alone, in its own
 * part of the picture (`signRoom` with `signReach`). Nothing here reads a clock or the page.
 */

/** The last part of its run over which the star goes out. */
const SIGN_OUT = 0.2;
/** Half a period of the blinking of the arrow key, in milliseconds, and the side of that key in dots. */
export const SIGN_KEY_MS = 500;
export const SIGN_KEY = 18;

const ARROW: Record<Dir, string> = { N: '↑', E: '→', S: '↓', W: '←' };

/** The swipe sign as it is laid out on the picture: where its trail starts and runs, and what it is drawn with. */
export interface SignPlan {
  mode: 'dot' | 'key';
  dir: Dir;
  from: Point;
  trail: Point;
  /** Rays of the star, in dots. */
  rays: number;
}

/** The numbers of the look of the board the star is drawn with: the times of its run and of its rest, the share of the run its line stays lit for, the light around it. */
export interface SignLook {
  runMs: number;
  restMs: number;
  trail: number;
  glow: number;
}

/** What of a kit the sign is drawn with. */
export type SignKit = Pick<Kit, 'palette' | 'box' | 'frame' | 'text' | 'light' | 'halo'>;

/**
 * How far from its trail the sign lights the picture, in dots: the light around the star is a
 * disc a dot wider than its rays, and the key is a square about the middle of the trail. The
 * room of the sign is its trail and this much around it.
 */
export function signReach(plan: SignPlan): number {
  return plan.mode === 'key' ? SIGN_KEY / 2 + 1 : plan.rays + 2;
}

/**
 * Draws the sign as it is laid out. A star of the bright ink of the program sets off from the
 * start of its trail and runs to the end of it; the thin line it leaves behind goes out towards
 * where it came from; at the end the star goes out, and after a moment of nothing it sets off
 * again. Held still, it stands at the end of its trail with the line behind it. The key stands
 * in the middle of that trail, and is lit and unlit by turns, once a second.
 */
export function paintSign(kit: SignKit, plan: SignPlan, look: SignLook, timeMs: number, still: boolean): void {
  const { bg, ink, dim } = kit.palette;
  const { from, trail, rays } = plan;
  if (plan.mode === 'key') {
    const centre = signKey(from, trail);
    const cell: Box = { x: Math.round(centre.x - SIGN_KEY / 2), y: Math.round(centre.y - SIGN_KEY / 2), w: SIGN_KEY, h: SIGN_KEY };
    const lit = still || Math.floor(timeMs / SIGN_KEY_MS) % 2 === 0;
    if (lit) kit.box(cell, ink);
    else {
      kit.box(cell, bg);
      kit.frame(cell, dim);
    }
    kit.text(ARROW[plan.dir], cell.x + SIGN_KEY / 2, cell.y + Math.round((SIGN_KEY - CELL_H) / 2), lit ? bg : ink, { align: 'center' });
    return;
  }
  const runMs = Math.max(1, look.runMs);
  const turn = timeMs % (runMs + Math.max(0, look.restMs));
  if (!still && turn >= runMs) return;
  const along = still ? 1 : turn / runMs;
  const eased = 1 - (1 - along) * (1 - along);
  // The star goes out over the last of its run, and its line with it.
  const here = still ? 1 : Math.min(1, (1 - along) / SIGN_OUT);
  // The line: thin, a dot of the picture wide, lit for a part of the run behind the star and going out towards its far end.
  const kept = Math.max(0, Math.min(1, look.trail));
  const tail = Math.max(0, eased - kept);
  const dots = Math.max(1, Math.ceil(Math.hypot(trail.x, trail.y) * (eased - tail)));
  let last = '';
  for (let i = 0; i <= dots; i++) {
    const at = tail + ((eased - tail) * i) / dots;
    const x = Math.round(from.x + trail.x * at);
    const y = Math.round(from.y + trail.y * at);
    // A dot of the picture is lit once, however many points of the line fall in it.
    if (`${x},${y}` === last) continue;
    last = `${x},${y}`;
    kit.light(x, y, 1, 1, ink, 0.7 * (kept > 0 ? 1 - (eased - at) / kept : 0) * here);
  }
  // The star: light around it, four rays that thin out, and a core lit in full.
  const hx = Math.round(from.x + trail.x * eased);
  const hy = Math.round(from.y + trail.y * eased);
  const glow = Math.max(0, look.glow);
  kit.halo(hx + 0.5, hy, rays + 1, ink, 0.14 * glow * here);
  kit.halo(hx + 0.5, hy, Math.max(1.5, rays / 2), ink, 0.22 * glow * here);
  for (let i = 1; i <= rays; i++) {
    const lit = here * (1 - (i - 1) / rays);
    kit.light(hx + i, hy, 1, 1, ink, lit);
    kit.light(hx - i, hy, 1, 1, ink, lit);
    kit.light(hx, hy + i, 1, 1, ink, lit);
    kit.light(hx, hy - i, 1, 1, ink, lit);
  }
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) kit.light(hx + dx, hy + dy, 1, 1, ink, 0.55 * here);
  kit.light(hx, hy, 1, 1, ink, here);
}
