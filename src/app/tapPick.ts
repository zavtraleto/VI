import { cubeAt, cubeHeight, type RunState } from '../rules';

/** A point of the page, in CSS pixels. */
export interface Point {
  x: number;
  y: number;
}

/**
 * A cell of the board as it lies on the page: the outline of the die on it, or of its floor where
 * none stands; the middle of what is aimed at (the top face of the die, or the floor); and how far
 * it is from the camera (less is nearer).
 */
export interface CellShape {
  x: number;
  z: number;
  outline: readonly Point[];
  centre: Point;
  depth: number;
}

/**
 * The cell under a point of the page. A die stands over the cells behind it on the page, and the
 * cell a player wants is often one of those, so the nearest to the camera is not taken: of the
 * shapes whose outline holds the point, the one whose middle is nearest to it is, the top face of
 * a die or the floor of a cell. Given `wanted`, the cells it passes are taken first: those a tap
 * would take the player to. Of two as near, the nearer to the camera. Null where the point is on
 * no cell.
 */
export function pickCell(shapes: readonly CellShape[], at: Point, wanted?: (x: number, z: number) => boolean): { x: number; z: number } | null {
  const under = shapes.filter((shape) => inside(hull(shape.outline), at));
  const good = wanted ? under.filter((shape) => wanted(shape.x, shape.z)) : [];
  const pool = good.length > 0 ? good : under;
  let best: CellShape | null = null;
  let least = Infinity;
  for (const shape of pool) {
    const far = Math.hypot(shape.centre.x - at.x, shape.centre.y - at.y);
    if (far < least - 0.5 || (Math.abs(far - least) <= 0.5 && best !== null && shape.depth < best.depth)) {
      least = Math.min(least, far);
      best = shape;
    }
  }
  return best ? { x: best.x, z: best.z } : null;
}

/**
 * The cells of the board as they lie on the page: a die by its whole box, an empty cell by its
 * floor. The die the player stands on is taken by its floor alone: a tap on it asks for nothing,
 * and it stands over the cell behind it, which is often the very cell the player wants. A cut
 * cell of a level is no cell.
 */
export function boardShapes(state: RunState, project: (x: number, y: number, z: number) => Point, depth: (x: number, y: number, z: number) => number): CellShape[] {
  const { size } = state.config;
  const { player } = state;
  const holes = state.levelRun?.spec.holes ?? [];
  const shapes: CellShape[] = [];
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      if (holes.some((hole) => hole.x === x && hole.z === z)) continue;
      const cube = cubeAt(state, x, z);
      const own = x === player.x && z === player.z;
      const top = cube && !own ? cubeHeight(cube, state.config) : 0;
      shapes.push({ x, z, outline: boxCorners(x, z, top, project), centre: project(x, top, z), depth: depth(x, top / 2, z) });
    }
  }
  return shapes;
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
