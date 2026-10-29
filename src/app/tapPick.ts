/** A point of the page, in CSS pixels. */
export interface Point {
  x: number;
  y: number;
}

/**
 * A cell of the board as it lies on the page: the outline of the die on it, or of its floor where
 * none stands, and how far it is from the camera (less is nearer).
 */
export interface CellShape {
  x: number;
  z: number;
  outline: readonly Point[];
  depth: number;
}

/**
 * The cell under a point of the page: of the shapes whose outline holds the point, the nearest to
 * the camera. A die stands over the cells behind it, so the side of a die is the die, not the
 * floor behind it. Null where the point is on no cell.
 */
export function pickCell(shapes: readonly CellShape[], at: Point): { x: number; z: number } | null {
  let best: CellShape | null = null;
  for (const shape of shapes) {
    if (best && shape.depth >= best.depth) continue;
    if (inside(hull(shape.outline), at)) best = shape;
  }
  return best ? { x: best.x, z: best.z } : null;
}

/** The corners of a box of the board seen from the camera: its outline is their hull. */
export function boxCorners(x: number, z: number, top: number, project: (x: number, y: number, z: number) => Point): Point[] {
  const corners: Point[] = [];
  for (const y of top > 0 ? [0, top] : [0]) {
    for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) corners.push(project(x + dx, y, z + dz));
  }
  return corners;
}

/** The convex hull of points, anticlockwise on the page as y grows downwards (Andrew's monotone chain). */
export function hull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Whether a point lies in a convex polygon given in hull order, its edge counted in. */
function inside(polygon: readonly Point[], at: Point): boolean {
  if (polygon.length < 3) return false;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if ((b.x - a.x) * (at.y - a.y) - (b.y - a.y) * (at.x - a.x) < 0) return false;
  }
  return true;
}
