import type { Size } from '../display/sizing';
import { BUTTON_H, UNIT } from './theme';
import { glyphAdvance } from './pixelFont';

/** What the edges of the screen keep to themselves: notches, rounded corners. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** A rectangle in pixels of the picture, from its top left corner. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export type Dir4 = 'up' | 'down' | 'left' | 'right';

/** A place of a half-width letter: the picture is laid out in these. */
export const CELL_W = 8;
export const CELL_H = 16;
/** The smallest height of a zone that can be pressed, in CSS pixels. */
export const MIN_ZONE = 44;
/** From this proportion of the window on, the screen is laid out sideways. */
const WIDE_ASPECT = 1.15;

export function isWide(window: Size): boolean {
  return window.width >= window.height * WIDE_ASPECT;
}

/** How tall a zone that is pressed is at the least, in dots of a picture `zoom` CSS pixels to the dot: a button, or a finger where a finger is taller. */
export function fingerOf(zoom: number): number {
  return Math.max(BUTTON_H, Math.ceil(MIN_ZONE / Math.max(0.1, zoom) / UNIT) * UNIT);
}

/**
 * Where a button drawn in `box` takes a press: the button, grown by a field that is not drawn
 * to what a finger needs, as much on one side as on the other. It grows in height; a square
 * button, in width too. Two buttons a gap apart may have zones that reach over each other: the
 * press goes to the one whose middle is nearer (`zoneAt`).
 */
export function zoneOf(box: Box, zoom: number): Box {
  const finger = fingerOf(zoom);
  const h = Math.max(box.h, finger);
  const w = box.w === box.h ? Math.max(box.w, finger) : box.w;
  return { x: box.x - (w - box.w) / 2, y: box.y - (h - box.h) / 2, w, h };
}

/**
 * Size of the picture of the interface for a canvas. A pixel of the picture is a whole number
 * of pixels of the canvas, so it stays a square; the number is picked to bring the short side
 * of the picture close to what is asked for.
 */
export function pictureSize(canvas: Size, pixelsTall: number, pixelsWide: number): Size {
  const target = isWide(canvas) ? pixelsWide : pixelsTall;
  const step = Math.max(1, Math.round(Math.min(canvas.width, canvas.height) / Math.max(1, target)));
  return { width: Math.max(1, Math.floor(canvas.width / step)), height: Math.max(1, Math.floor(canvas.height / step)) };
}

/** Half-width signs: Latin with the letters its languages add to it, digits, punctuation and half-width kana. Everything else takes two places. */
function isHalfWidth(code: number): boolean {
  // The Cyrillic of the program is its own (`scripts/cyrillic-font.mjs`): as narrow as its Latin.
  return code < 0x250 || (code >= 0x400 && code <= 0x45f) || (code >= 0xff61 && code <= 0xff9f);
}

/**
 * How far a sign moves a line of the program's font on, in pixels of the picture: a drawn
 * letter as wide as it is (`pixelFont.ts`), any other sign a place of the font, or two.
 */
function signWidth(sign: string): number {
  return glyphAdvance(sign) ?? (isHalfWidth(sign.codePointAt(0)!) ? 1 : 2) * CELL_W;
}

/** Width of a line of the program's font in pixels of the picture. */
export function textWidth(text: string, scale = 1): number {
  let width = 0;
  for (const sign of text) width += signWidth(sign);
  return width * scale;
}

/** Where each sign of a line starts, in pixels of the picture from the start of the line. */
export function signPlaces(text: string): number[] {
  const places: number[] = [];
  let at = 0;
  for (const sign of text) {
    places.push(at);
    at += signWidth(sign);
  }
  return places;
}

/**
 * The net of a die: where each face lies when the die is unfolded into a cross. Index 0 is
 * the face 1. The die is unfolded as it stands on the board at the start: the one on top is
 * the middle of the cross, the two lies to the north of it, the four to the east, the three to
 * the west, the five to the south, and the six, which was underneath, hangs from the five.
 * Opposite faces - they add up to seven - are never side by side.
 */
export const NET: readonly { col: number; row: number }[] = [
  { col: 1, row: 1 }, // 1
  { col: 1, row: 0 }, // 2
  { col: 0, row: 1 }, // 3
  { col: 2, row: 1 }, // 4
  { col: 1, row: 2 }, // 5
  { col: 1, row: 3 }, // 6
];

/** The face next to a face on the net that way; the face itself where the net ends. */
export function netStep(face: number, dir: Dir4): number {
  const from = NET[face - 1];
  if (!from) return face;
  const col = from.col + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
  const row = from.row + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0);
  const index = NET.findIndex((cell) => cell.col === col && cell.row === row);
  return index === -1 ? face : index + 1;
}

/** How the six dice are looked at. */
export interface NetView {
  /** Degrees: around the dice, and from above. */
  yaw: number;
  pitch: number;
  /** Distance between two dice, in dice. */
  gap: number;
  /** How much of its box the net takes, 0..1. */
  fill: number;
}

/** How far above its die the figure reaches, in dice: the box of the net makes room for it. */
const FIGURE_HEIGHT = 0.9;

export interface NetProjection {
  /** Pixels of the picture per side of a die. */
  unit: number;
  /** Centre of each die and of its top face in the picture; index 0 is the face 1. */
  centres: Point[];
  tops: Point[];
  /** Side of the square zone around a die. */
  zone: number;
  /** The camera: what it looks at, in the dice's own space, and half of what it sees across and down. */
  target: { x: number; y: number; z: number };
  halfWidth: number;
  halfHeight: number;
}

/** Where a die of the net stands: a unit cube resting on the plane y = 0. */
export function netPosition(face: number, gap: number): { x: number; z: number } {
  const cell = NET[face - 1];
  return { x: (cell.col - 1) * gap, z: (cell.row - 1.5) * gap };
}

/**
 * The six dice of the net as a camera sees them from a side and from above, without
 * perspective, fitted into a box of the picture. The numbers here set the camera of the
 * picture and the zones that take a press, so the two always agree.
 */
export function netProjection(box: Box, view: NetView): NetProjection {
  const yaw = (view.yaw * Math.PI) / 180;
  const pitch = (view.pitch * Math.PI) / 180;
  const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  const up = { x: -Math.sin(yaw) * Math.sin(pitch), y: Math.cos(pitch), z: -Math.cos(yaw) * Math.sin(pitch) };
  const across = (x: number, y: number, z: number): number => x * right.x + y * right.y + z * right.z;
  const along = (x: number, y: number, z: number): number => x * up.x + y * up.y + z * up.z;

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  const take = (x: number, y: number, z: number): void => {
    const u = across(x, y, z);
    const v = along(x, y, z);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  };
  const places = NET.map((_, i) => netPosition(i + 1, view.gap));
  for (const { x, z } of places) {
    for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) for (const y of [0, 1]) take(x + dx, y, z + dz);
    take(x, 1 + FIGURE_HEIGHT, z);
  }

  const unit = Math.max(1, view.fill * Math.min(box.w / (maxU - minU), box.h / (maxV - minV)));
  const centreU = (minU + maxU) / 2;
  const centreV = (minV + maxV) / 2;
  const point = (x: number, y: number, z: number): Point => ({
    x: box.x + box.w / 2 + (across(x, y, z) - centreU) * unit,
    y: box.y + box.h / 2 - (along(x, y, z) - centreV) * unit,
  });

  // Squares around two dice next to each other must not share a point: the nearer pair sets the size.
  const stepX = Math.max(Math.abs(across(view.gap, 0, 0)), Math.abs(along(view.gap, 0, 0)));
  const stepZ = Math.max(Math.abs(across(0, 0, view.gap)), Math.abs(along(0, 0, view.gap)));
  return {
    unit,
    centres: places.map(({ x, z }) => point(x, 0.5, z)),
    tops: places.map(({ x, z }) => point(x, 1, z)),
    zone: Math.min(stepX, stepZ) * unit,
    target: { x: right.x * centreU + up.x * centreV, y: right.y * centreU + up.y * centreV, z: right.z * centreU + up.z * centreV },
    halfWidth: box.w / (2 * unit),
    halfHeight: box.h / (2 * unit),
  };
}

export type MarkArrangement = 'grid' | 'ring' | 'row';

/** The nodes of the logo's mark. Their centres span 0..1 down and 0..`width` across. */
export interface MarkShape {
  points: Point[];
  width: number;
}

/**
 * The mark of the logo: `count` nodes in two columns, on a ring or in a row. Six in two
 * columns stand as the six of a die does.
 */
export function markNodes(count: number, arrangement: MarkArrangement): MarkShape {
  const n = Math.max(1, Math.round(count));
  const points: Point[] = [];
  if (arrangement === 'ring') {
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      points.push({ x: 0.5 + 0.5 * Math.sin(angle), y: 0.5 - 0.5 * Math.cos(angle) });
    }
    return { points, width: 1 };
  }
  if (arrangement === 'row') {
    const step = 0.5;
    for (let i = 0; i < n; i++) points.push({ x: i * step, y: 0.5 });
    return { points, width: (n - 1) * step };
  }
  const rows = Math.ceil(n / 2);
  const step = rows > 1 ? 1 / (rows - 1) : 0.5;
  for (let i = 0; i < n; i++) {
    points.push({ x: (i % 2) * step, y: rows > 1 ? Math.floor(i / 2) * step : 0.5 });
  }
  return { points, width: n > 1 ? step : 0 };
}
