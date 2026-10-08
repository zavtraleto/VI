import type { Size } from '../display/sizing';
import { CELL_H, CELL_W, MIN_ZONE, isWide, type Box, type Insets, type Point } from './layout';

/** Space kept from the edges of the picture. */
const MARGIN = 8;
/** Places of the large number: a score of six digits at twice the size. */
const SCORE_PLACES = 6;
/** Places of a reading in the middle: `LV 01`, a clock. */
const MID_PLACES = 5;

const ceilTo = (value: number, step: number): number => Math.ceil(value / step) * step;

/**
 * The readings of a session, in pixels of the picture. On a tall screen they are a band
 * across the top and the board starts below it. On a wide one they are a column down the
 * left side and the board has the whole height: there a band would be mostly empty, and with
 * its large pixels far too tall.
 */
export interface HudLayout {
  wide: boolean;
  /** How much of the top of the picture the readings take; 0 on a wide screen. */
  height: number;
  /** How much of the left of the picture the readings take; 0 on a tall screen. */
  column: number;
  /** Tops of the lines of the column, on a wide screen. */
  lines: { label: number; big: number; tag: number; best: number; link: number; cells: number };
  /** Where the net of the die under the player goes: its top left corner. */
  net: Point;
  left: number;
  right: number;
  /** Tops of the two rows of names and values, and of the row under them. */
  rowA: number;
  rowB: number;
  rowC: number;
  /** Top of the large number, which stands twice as tall as a row. */
  big: number;
  /** Where the middle readings start, and where the readings on the right end. */
  mid: number;
  end: number;
  /** The picture is narrow: the middle has room for one reading, not two. */
  tight: boolean;
  /** The zone that pauses the session. */
  pause: Box;
  /** The line under the readings. */
  rule: number;
}

/**
 * Lays the readings out. `zoom` is CSS pixels per pixel of the picture: the zone that pauses
 * is as large as a finger needs whatever the picture is.
 */
export function hudLayout(picture: Size, safe: Insets, zoom: number): HudLayout {
  const left = ceilTo(safe.left, CELL_W) + MARGIN;
  const top = ceilTo(safe.top, 4) + 4;
  if (isWide(picture)) return columnLayout(left, top, zoom);
  const right = picture.width - ceilTo(safe.right, CELL_W) - MARGIN;
  const rowA = top;
  const rowB = top + CELL_H;
  const rowC = top + CELL_H * 2;
  const rule = rowC + CELL_H + 3;
  const side = Math.min(rule - top, Math.max(24, ceilTo(MIN_ZONE / Math.max(0.1, zoom), 4)));
  const pause: Box = { x: right - side, y: top, w: side, h: side };
  const mid = left + SCORE_PLACES * CELL_W * 2 + MARGIN;
  const end = pause.x - MARGIN;
  return {
    wide: false,
    height: rule + 4,
    column: 0,
    lines: { label: rowA, big: top + CELL_H - 2, tag: rowA, best: rowB, link: rowC, cells: rowC },
    net: { x: left, y: rule + 10 },
    left,
    right,
    rowA,
    rowB,
    rowC,
    big: top + CELL_H - 2,
    mid,
    end,
    tight: end - SCORE_PLACES * CELL_W < mid + MID_PLACES * CELL_W + CELL_W / 2,
    pause,
    rule,
  };
}

/** The readings as a column down the left side: as wide as the large number, one reading to a line. */
function columnLayout(left: number, top: number, zoom: number): HudLayout {
  const width = SCORE_PLACES * CELL_W * 2;
  const right = left + width;
  const label = top;
  const big = label + CELL_H - 2;
  const tag = big + CELL_H * 2 + 4;
  const best = tag + CELL_H + 2;
  const link = best + CELL_H + 2;
  const cells = link + CELL_H + 1;
  const rule = cells + 9 + 5;
  const side = Math.max(CELL_H + 4, ceilTo(MIN_ZONE / Math.max(0.1, zoom), 4));
  const pause: Box = { x: left, y: rule + 6, w: width, h: side };
  return {
    wide: true,
    height: 0,
    column: right + MARGIN,
    lines: { label, big, tag, best, link, cells },
    net: { x: left, y: pause.y + pause.h + 10 },
    left,
    right,
    rowA: label,
    rowB: tag,
    rowC: link,
    big,
    mid: left,
    end: right,
    tight: false,
    pause,
    rule,
  };
}

/** How the floor of the board lies on screen: where a cell to the east and a cell to the south lead, y pointing down. */
export interface FloorAxes {
  east: Point;
  south: Point;
}

/** Which cell of the unfolded die a point is in, and where in that cell. */
export interface NetCell {
  /** The top face, or the side folded out towards a direction of the board. */
  cell: 'top' | 'N' | 'E' | 'S' | 'W';
  /** Within the cell, 0..1 across to the east and 0..1 down to the south. */
  u: number;
  v: number;
}

/**
 * The cell of the net under a point of the picture. The net is a cross of five squares lying
 * in the plane of the board: `centre` is the middle of its top face, `side` the length of a
 * square along the axes of the floor.
 */
export function netCellAt(x: number, y: number, centre: Point, side: number, axes: FloorAxes): NetCell | null {
  const { east, south } = axes;
  const det = east.x * south.y - south.x * east.y;
  if (Math.abs(det) < 1e-6 || side <= 0) return null;
  const dx = (x - centre.x) / side;
  const dy = (y - centre.y) / side;
  // Along the east axis and along the south one, in squares from the middle of the top face.
  const a = (dx * south.y - south.x * dy) / det;
  const b = (east.x * dy - dx * east.y) / det;
  const inA = Math.abs(a) < 0.5;
  const inB = Math.abs(b) < 0.5;
  if (inA && inB) return { cell: 'top', u: a + 0.5, v: b + 0.5 };
  if (inB && a >= 0.5 && a < 1.5) return { cell: 'E', u: a - 0.5, v: b + 0.5 };
  if (inB && a <= -0.5 && a > -1.5) return { cell: 'W', u: a + 1.5, v: b + 0.5 };
  if (inA && b >= 0.5 && b < 1.5) return { cell: 'S', u: a + 0.5, v: b - 0.5 };
  if (inA && b <= -0.5 && b > -1.5) return { cell: 'N', u: a + 0.5, v: b + 1.5 };
  return null;
}

/** The box of the picture that holds the whole net. */
export function netBounds(centre: Point, side: number, axes: FloorAxes): Box {
  const { east, south } = axes;
  const reach = (ax: number, bx: number): number => Math.max(1.5 * Math.abs(ax) + 0.5 * Math.abs(bx), 0.5 * Math.abs(ax) + 1.5 * Math.abs(bx)) * side;
  const w = reach(east.x, south.x);
  const h = reach(east.y, south.y);
  return { x: Math.floor(centre.x - w), y: Math.floor(centre.y - h), w: Math.ceil(w * 2) + 1, h: Math.ceil(h * 2) + 1 };
}

/** A quarter turn of a point of a face, `turns` times, counter-clockwise as seen from above. */
export function turned(u: number, v: number, turns: number): { u: number; v: number } {
  let x = u;
  let y = v;
  for (let i = ((turns % 4) + 4) % 4; i > 0; i--) [x, y] = [1 - y, x];
  return { u: x, v: y };
}

/**
 * Where the swipe sign stands so that all of it is on the picture: `at`, the start of its trail,
 * moved the least it takes for the start and the end of the trail to lie `pad` inside `bounds`.
 * A sign asked for beyond the edge, beside a board that fills the screen, comes to the edge on
 * that side. In bounds too small for it, it stands in their middle.
 */
export function signPlace(at: Point, trail: Point, bounds: Box, pad: number): Point {
  const fit = (value: number, reach: number, from: number, length: number): number => {
    const low = from + pad - Math.min(0, reach);
    const high = from + length - pad - Math.max(0, reach);
    return low > high ? (low + high) / 2 : Math.min(high, Math.max(low, value));
  };
  return { x: fit(at.x, trail.x, bounds.x, bounds.w), y: fit(at.y, trail.y, bounds.y, bounds.h) };
}
