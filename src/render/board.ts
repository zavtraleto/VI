import { cellPixels, fitBoard, type FrameBounds } from './framing';

/** Margin around the cells that the lines of the surface and the danger frame lie in, in cells. */
export const RIM = 0.25;
/** Tallest thing that must stay in frame: a cube with the figure on top. */
export const TOP_Y = 1.9;
export const FRAME_MARGIN = 0.25;
/** Room left beside the cells when the screen is narrower than the board. */
export const SIDE_MARGIN = 0.08;

/**
 * A board as the view is given it. The rules know nothing of `origin`: every board counts its
 * cells from its own corner, and the view lays it in the world where it is told to.
 */
export interface BoardShape {
  size: number;
  /** Cells cut out of the board of a level: they are left out of its grid. */
  holes: readonly { x: number; z: number }[];
  /** Where the board's cell (0, 0) lies in the world, in cells. */
  origin: { x: number; z: number };
}

/** What the camera is asked to show. */
export interface Frame {
  /** Middle of the picture in the world: a point of the floor, in cells. */
  x: number;
  z: number;
  /** Screen pixels a cell takes. */
  cell: number;
}

interface Axis {
  x: number;
  y: number;
  z: number;
}

/** The camera's right and up axes in the world: unit vectors, the right one level with the floor. */
export interface CameraAxes {
  right: Axis;
  up: Axis;
}

/** What the camera shows, on its own axes: the middle of the picture and half its height, in cells. */
export interface Sight {
  r: number;
  u: number;
  half: number;
}

const along = (x: number, y: number, z: number, axis: Axis): number => x * axis.x + y * axis.y + z * axis.z;

/** A point of the floor on the camera's right and up axes. */
export function toPlane(axes: CameraAxes, x: number, z: number): { r: number; u: number } {
  return { r: along(x, 0, z, axes.right), u: along(x, 0, z, axes.up) };
}

/** The point of the floor that is seen at a point of the camera's right and up axes. */
export function toFloor(axes: CameraAxes, r: number, u: number): { x: number; z: number } {
  const { right, up } = axes;
  // The camera always looks down at the floor, so its two axes never lie along one line of it.
  const det = right.x * up.z - right.z * up.x;
  return { x: (r * up.z - right.z * u) / det, z: (right.x * u - r * up.x) / det };
}

/**
 * Extents of a board of `size` cells on the camera's axes, counted from the middle of the board.
 *
 * What has to fit top to bottom: the surface and a cube with the figure on every cell. Side to
 * side only the cells have to: on a narrow screen the board is as large as it can be, and the
 * tips of the margin around them run off the edges.
 */
export function boardBounds(size: number, axes: CameraAxes): FrameBounds {
  const b: FrameBounds = { minR: Infinity, maxR: -Infinity, minU: Infinity, maxU: -Infinity, floorU: -Infinity };
  const slabHalf = size / 2 + RIM;
  const cellsHalf = slabHalf - RIM;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const r = along(sx * cellsHalf, 0, sz * cellsHalf, axes.right);
      b.minR = Math.min(b.minR, r);
      b.maxR = Math.max(b.maxR, r);
      for (const y of [0, TOP_Y]) {
        const u = along(sx * slabHalf, y, sz * slabHalf, axes.up);
        b.minU = Math.min(b.minU, u);
        b.maxU = Math.max(b.maxU, u);
      }
      b.floorU = Math.max(b.floorU, along(sx * slabHalf, 0, sz * slabHalf, axes.up));
    }
  }
  return b;
}

/**
 * The frame a board is in whole, in a window of `width` by `height` CSS pixels whose top
 * `clear` pixels the floor stays out of: what `fitBoard` makes of it, said as a point of the
 * world and the size of a cell.
 */
export function frameOf(shape: BoardShape, axes: CameraAxes, width: number, height: number, clear: number): Frame {
  const fit = fitBoard(boardBounds(shape.size, axes), width / height, clear / height, SIDE_MARGIN, FRAME_MARGIN);
  const centre = (shape.size - 1) / 2;
  const middle = toPlane(axes, shape.origin.x + centre, shape.origin.z + centre);
  return { ...toFloor(axes, middle.r + fit.centreR, middle.u + fit.centreU), cell: cellPixels(fit, height) };
}

/** What the camera shows of a frame in a window `height` CSS pixels tall. */
export function sightOf(frame: Frame, axes: CameraAxes, height: number): Sight {
  return { ...toPlane(axes, frame.x, frame.z), half: height / (2 * frame.cell) };
}

/** Tells boards apart by what is drawn of them: their size and the cells cut out. Where they lie is not in it. */
export function shapeKey(shape: BoardShape): string {
  return `${shape.size}:${shape.holes.map(({ x, z }) => `${x},${z}`).join(' ')}`;
}
