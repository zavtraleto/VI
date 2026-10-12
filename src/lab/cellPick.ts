/** A cell of the board with where its middle lies on the page. */
export interface CellPoint {
  x: number;
  z: number;
  px: number;
  py: number;
}

/**
 * The cell of the board under a point of the page: the one whose middle is nearest, if it is
 * within `reach` pixels. The board is seen from a slant, so a cell is no square on the page and
 * is not found by dividing: the middles of the cells are asked of the view of the game
 * (`Game.cellPoint`) and the nearest is taken. Null where the point is off the board.
 */
export function pickCell(points: readonly CellPoint[], at: { px: number; py: number }, reach: number): { x: number; z: number } | null {
  let best: CellPoint | null = null;
  let least = reach * reach;
  for (const point of points) {
    const far = (point.px - at.px) ** 2 + (point.py - at.py) ** 2;
    // The first of two as near is kept: the list is given with what is in front first.
    if (far < least || (best === null && far <= least)) {
      least = far;
      best = point;
    }
  }
  return best ? { x: best.x, z: best.z } : null;
}

/** How far a point may be from the middle of a cell and still be on it: a little over half the least distance between the middles of two cells side by side. */
export function reachOf(points: readonly CellPoint[]): number {
  let least = Infinity;
  for (const a of points) {
    for (const b of points) {
      if (Math.abs(a.x - b.x) + Math.abs(a.z - b.z) !== 1) continue;
      least = Math.min(least, Math.hypot(a.px - b.px, a.py - b.py));
    }
  }
  return Number.isFinite(least) ? least * 0.6 : 0;
}
