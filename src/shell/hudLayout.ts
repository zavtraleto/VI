import type { Rect, Size } from '../display/sizing';
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

/** A cube on the plaque of a short combo, and the gap between two, in picture pixels. */
export const COUNTER_CUBE = 12;
export const COUNTER_GAP = 2;

/** The width of the plaque over a heap that needs `need` dice: a cube for each, the gaps between, and 3 pixels of the plate at each end. */
export function counterWidth(need: number): number {
  return need * COUNTER_CUBE + (need - 1) * COUNTER_GAP + 6;
}

/**
 * Where the plaque of a short combo stands so that all of it is in the window: the left edge of
 * a plaque `width` wide asked for with its middle at `middle`, moved the least it takes to lie
 * `pad` inside `bounds` from side to side, to a whole pixel. A plaque that is in the window is
 * where it was asked for; one over a heap at the edge of the screen is brought in from that
 * edge. In bounds too narrow for it, it stands in their middle.
 */
export function counterLeft(middle: number, width: number, bounds: Box, pad: number): number {
  const low = Math.ceil(bounds.x + pad);
  const high = Math.floor(bounds.x + bounds.w - pad) - width;
  return low > high ? Math.round((low + high) / 2) : Math.min(high, Math.max(low, Math.round(middle - width / 2)));
}

/**
 * Where the swipe sign stands so that all of it is on the picture: `at`, the start of its trail,
 * moved the least it takes for the start and the end of the trail to lie `pad` inside `bounds`.
 * A sign stands beside the die of the figure, so it is on the picture where the figure is; one
 * whose trail runs off the picture, by a figure at its edge, is brought in from that edge, and
 * may then lie on the die. In bounds too small for it, it stands in their middle.
 */
export function signPlace(at: Point, trail: Point, bounds: Box, pad: number): Point {
  const fit = (value: number, reach: number, from: number, length: number): number => {
    const low = from + pad - Math.min(0, reach);
    const high = from + length - pad - Math.max(0, reach);
    return low > high ? (low + high) / 2 : Math.min(high, Math.max(low, value));
  };
  return { x: fit(at.x, trail.x, bounds.x, bounds.w), y: fit(at.y, trail.y, bounds.y, bounds.h) };
}

/**
 * Where the trail of the swipe sign runs: beside the die under the figure, on its right. `body`
 * is that die as it lies on the picture, `step` a cell of the board the way of the swipe as it
 * lies there, so the trail is parallel to the board; it is `length` cells long. Whichever way it
 * runs, the end of it that is nearest the die is `gap` to the right of the die, and it is as far
 * above the middle of the die as below it: it never lies on the die or on the figure.
 */
export function signBeside(body: Box, step: Point, length: number, gap: number): { from: Point; trail: Point } {
  const trail = { x: step.x * length, y: step.y * length };
  const left = body.x + body.w + gap;
  const middle = body.y + body.h / 2;
  return { from: { x: left - Math.min(0, trail.x), y: middle - trail.y / 2 }, trail };
}

/**
 * The start of a trail moved down, the least it takes, for the trail to lie `pad` clear of
 * `avoid`: the buttons of a level, in the corner of the stage. Where it does not reach them it
 * is left where it is.
 */
export function signClear(from: Point, trail: Point, avoid: Box | null, pad: number): Point {
  if (!avoid) return from;
  const left = Math.min(from.x, from.x + trail.x);
  const right = Math.max(from.x, from.x + trail.x);
  const top = Math.min(from.y, from.y + trail.y);
  const bottom = Math.max(from.y, from.y + trail.y);
  const under = avoid.y + avoid.h + pad;
  if (right < avoid.x - pad || left > avoid.x + avoid.w + pad || bottom < avoid.y - pad || top >= under) return from;
  return { x: from.x, y: from.y + under - top };
}

/**
 * Where the key of the swipe sign stands: in the middle of the trail the star would run, beside
 * the die of the figure and not on it.
 */
export function signKey(at: Point, trail: Point): Point {
  return { x: at.x + trail.x / 2, y: at.y + trail.y / 2 };
}

/**
 * The part of the picture the swipe sign can light, wherever on its run the star is: the trail
 * from `from`, and `reach` dots around it on every side, in whole dots. The sign is drawn anew
 * many times a second, and only this part of the picture is drawn and sent again for it.
 */
export function signRoom(from: Point, trail: Point, reach: number): Box {
  const around = Math.max(0, Math.ceil(reach));
  const left = Math.floor(Math.min(from.x, from.x + trail.x)) - around;
  const top = Math.floor(Math.min(from.y, from.y + trail.y)) - around;
  const right = Math.ceil(Math.max(from.x, from.x + trail.x)) + around + 1;
  const bottom = Math.ceil(Math.max(from.y, from.y + trail.y)) + around + 1;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Whether two boxes of the picture have a dot in common. */
export function boxesMeet(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * A number that names the picture of the swipe sign at a moment: while it stays the same the
 * sign is not drawn again. The key is lit and unlit by turns of `keyMs`. The star is another
 * picture at every moment of its run of `runMs`, and one picture, nothing, for the `restMs`
 * after it. With `step` the run is counted in steps of that many milliseconds: for a sign that
 * cannot be drawn alone, where each new picture of it is a new picture of all the readings.
 */
export function signTurn(mode: 'dot' | 'key', timeMs: number, times: { runMs: number; restMs: number; keyMs: number }, step = 0): number {
  if (mode === 'key') return Math.floor(timeMs / Math.max(1, times.keyMs)) % 2;
  const runMs = Math.max(1, times.runMs);
  if (timeMs % (runMs + Math.max(0, times.restMs)) >= runMs) return -1;
  return step > 0 ? Math.floor(timeMs / step) : timeMs;
}

/** Letters of the voice for a note over the board, in CSS pixels. */
export const NOTE_SIZE = 17;
/**
 * Letters of the voice over the board, in CSS pixels. On a tall screen they are a fixed size;
 * on a wide one they follow the height of the window, between these two.
 */
const LINE_SIZE_TALL = 19;
const LINE_SIZE_WIDE: readonly [number, number] = [26, 46];
const LINE_SHARE_WIDE = 0.052;

/** How large the letters of a line over the board are on this stage: of the words of the exercise, and of the hint of a piece of the road. */
export function lineSize(stage: Size): number {
  if (stage.height > stage.width) return LINE_SIZE_TALL;
  return Math.round(Math.min(LINE_SIZE_WIDE[1], Math.max(LINE_SIZE_WIDE[0], stage.height * LINE_SHARE_WIDE)));
}
/** The line of a hint is no longer than this many letters wide, and is centred in what the window leaves it. */
const HINT_EM = 40;
/** A hint stands this far from the top of the stage, in CSS pixels, and from the edges of it; the board starts this far below it. */
const HINT_TOP = 6;
const HINT_SIDE = 12;
const HINT_BELOW = 8;
/** How long a hint takes to come and to go, and the steps its brightness is drawn in: each step is a new picture of the voice. */
export const HINT_FADE_MS = 300;
const HINT_STEPS = 10;

/**
 * Where the one line of a hint stands, in CSS pixels of the window: at the top of the stage, under
 * the readings of a level, centred, wider than neither `HINT_EM` letters nor the stage and its
 * edges, and within what the edges of the screen keep; `tools` is the rectangle of the buttons of a level, if it has them. `height` is what the text takes in the lines
 * it is put into at that width; `room` is how much of the top of the stage the line keeps, the
 * board being laid out below it so that no cell of it is under the words.
 */
export function hintBox(stage: Rect, window: Size, safe: Insets, size: number, height: number, tools: Rect | null = null): { box: Rect; room: number } {
  const left = Math.max(stage.x + HINT_SIDE, safe.left);
  const right = Math.min(stage.x + stage.width - HINT_SIDE, window.width - safe.right);
  const width = Math.max(0, Math.min(right - left, size * HINT_EM));
  const x = left + (right - left - width) / 2;
  // The two buttons of a level stand in the top right corner of the stage, in the row the line would take: where the line
  // could reach them, it starts below them, and the room grows by as much.
  const reaches = tools !== null && x + width > tools.x;
  const top = reaches ? tools.y + tools.height + HINT_TOP - stage.y : HINT_TOP;
  const box: Rect = { x, y: stage.y + top, width, height };
  return { box, room: Math.ceil(top + height + HINT_BELOW) };
}

/**
 * How bright a hint is, 0 to 1, in steps: it comes in `HINT_FADE_MS` after it is put up (`since`)
 * and goes out in as long from when it is taken away (`gone`, null while it stands). With reduced
 * motion it is there or it is not.
 */
export function hintAlpha(since: number, gone: number | null, reduced: boolean): number {
  const clamp = (value: number): number => Math.min(1, Math.max(0, value));
  const coming = reduced ? 1 : clamp(since / HINT_FADE_MS);
  const going = gone === null ? 1 : reduced ? 0 : 1 - clamp(gone / HINT_FADE_MS);
  return Math.round(Math.min(coming, going) * HINT_STEPS) / HINT_STEPS;
}

/**
 * The two buttons of a level, UNDO and RESTART, in the top right corner of the stage, in pixels of the
 * picture: a button is `wide` by `tall`, the right one ends at `right`, and `box` holds both.
 * `undoWidth` is the width of the longest word on the left button.
 */
export function toolButtons(stage: Box, zoom: number, undoWidth: number): { tall: number; wide: number; right: number; y: number; box: Box } {
  const tall = Math.max(CELL_H + 8, Math.ceil(MIN_ZONE / zoom));
  const wide = Math.max(tall, undoWidth + 12);
  const right = Math.round(stage.x + stage.w - 6);
  const y = Math.round(stage.y + 6);
  return { tall, wide, right, y, box: { x: right - wide * 2 - 6, y, w: wide * 2 + 6, h: tall } };
}

/**
 * How far into its coming-in a hint that is given again is put when it is still going out (`since`, `gone`
 * as in `hintAlpha`): as far as it had got dark, so that it comes back from how bright it was and not from nothing.
 */
export function hintResumes(since: number, gone: number, reduced: boolean): number {
  return hintAlpha(since, gone, reduced) * HINT_FADE_MS;
}
