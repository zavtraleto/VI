import type { Size } from '../display/sizing';
import { CELL_H, CELL_W, MIN_ZONE, isWide, zoneOf, type Box, type Insets, type Point } from './layout';
import { BUTTON_H, EDGE, GAP, UNIT } from './theme';

/** Places of the score: seven digits at twice the size, zeros and all (word of the owner, 30 October 2026). */
export const SCORE_PLACES = 7;
/**
 * How wide the readings in the top left corner are, in cells of a letter: the largest of them,
 * `LEVEL 100` at twice the size, and a score of seven digits, fit in it. A wide picture keeps a
 * column this wide down its left side, levels and sessions alike.
 */
const READINGS_CELLS = 16;

const ceilTo = (value: number, step: number): number => Math.ceil(value / step) * step;

/**
 * The readings over the board, in pixels of the picture: lines in the top left corner and the
 * buttons in the top right one. On a tall screen the board starts below them. On a wide one the
 * lines are a column down the left side and the board has the whole height.
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
  /** The button that pauses the session. */
  pause: Box;
  /** The button that starts a level over, beside the one that pauses and of its size; null where nothing is started over. */
  restart: Box | null;
  /** The button that turns the sound off and on, left of the one that starts over and of its size; null where there is none, or no room for it. */
  sound: Box | null;
  /** Where each button takes a press: the button and the field a finger needs around it, as far as it lies on the picture. */
  zones: { pause: Box; restart: Box | null; sound: Box | null };
  /** Where the number of a level stands: the first of its lines. */
  tag: Point;
  /** Top of the line of the goal of a level, under its three lines. */
  goal: number;
  /** Tops of the lines of the moves made on a level and of the fewest it is cleared in, under its number. */
  moves: readonly [number, number];
  /** Where the readings end below; what comes apart with the contact is cut here. */
  rule: number;
}

/** What the readings are of: a level has its own lines and no score, and whatever can be started over has a button for it. */
export interface HeaderNeeds {
  restart?: boolean;
  /** The button of the sound, beside the one that starts over. */
  sound?: boolean;
  level?: boolean;
  /** A level that counts something towards its goal has a line for it. */
  goal?: boolean;
}

/**
 * Lays the readings out. Every button is drawn a button tall (`BUTTON_H`) whatever the
 * picture is; `zoom`, CSS pixels per pixel of the picture, grows the zone each takes a press
 * in to what a finger needs (`zoneOf`).
 */
export function hudLayout(picture: Size, safe: Insets, zoom: number, needs: HeaderNeeds = {}): HudLayout {
  const left = ceilTo(safe.left, CELL_W) + EDGE;
  const top = ceilTo(safe.top, UNIT) + UNIT;
  // A zone that reaches past the edge of the picture is cut there: nothing is pressed beyond it.
  const zone = (box: Box | null): Box | null => {
    if (!box) return null;
    const grown = zoneOf(box, zoom);
    const x = Math.max(0, grown.x);
    const y = Math.max(0, grown.y);
    return { x, y, w: Math.min(picture.width, grown.x + grown.w) - x, h: Math.min(picture.height, grown.y + grown.h) - y };
  };
  const wide = isWide(picture);
  const layout = needs.level ? levelLayout(picture, safe, left, top, needs, wide) : sessionLayout(picture, safe, left, top, needs, wide);
  return { ...layout, zones: { pause: zone(layout.pause)!, restart: zone(layout.restart), sound: zone(layout.sound) } };
}

/** The buttons of the readings in the top right corner, side by side a gap apart: the pause in the corner, the one that starts over left of it where there is one, the sound left of those where it does not reach `clear`. */
function corner(picture: Size, safe: Insets, top: number, needs: HeaderNeeds, clear: number): { right: number; pause: Box; restart: Box | null; sound: Box | null } {
  const right = picture.width - ceilTo(safe.right, CELL_W) - EDGE;
  const side = BUTTON_H;
  const pause: Box = { x: right - side, y: top, w: side, h: side };
  const restart: Box | null = needs.restart ? { x: pause.x - GAP - side, y: top, w: side, h: side } : null;
  const soundAt = (restart ?? pause).x - GAP - side;
  const sound: Box | null = needs.sound && soundAt >= clear ? { x: soundAt, y: top, w: side, h: side } : null;
  return { right, pause, restart, sound };
}

/**
 * The readings of a session, the same on a tall picture and a wide one, in the key of those of a
 * level (word of the owner, 30 October 2026: the score is what matters, the time left comes
 * second, the rest goes; the score needs no name): in the top left corner the score twice the
 * size, and under it one line for the time a live session has left, or the seconds a full board
 * has; the sound and the pause in the top right corner. On a tall picture the board starts under
 * them; on a wide one they are a column down the left, as wide as the column of a level.
 */
function sessionLayout(picture: Size, safe: Insets, left: number, top: number, needs: HeaderNeeds, wide: boolean): Omit<HudLayout, 'zones'> {
  // A line of the readings: a row of text and a unit of air under it.
  const label = top;
  // The score stands two rows tall at the top, the time a unit under it.
  const big = top;
  const time = big + CELL_H * 2 + UNIT;
  const rule = time + CELL_H;
  const end = left + READINGS_CELLS * CELL_W;
  const { right, pause, restart, sound } = corner(picture, safe, top, needs, end);
  const below = Math.max(rule, wide ? 0 : top + BUTTON_H) + UNIT;
  return {
    wide,
    height: wide ? 0 : below,
    column: wide ? end + EDGE : 0,
    lines: { label, big, tag: time, best: time, link: time, cells: time },
    net: { x: left, y: below + GAP },
    left,
    right,
    rowA: label,
    rowB: time,
    rowC: time,
    big,
    mid: left,
    end,
    tight: false,
    pause,
    restart,
    sound,
    tag: { x: left, y: label },
    goal: time,
    moves: [big, time],
    rule,
  };
}

/**
 * The readings of a level, the same on a tall picture and a wide one (word of the owner,
 * 30 October 2026): in the top left corner `LEVEL 17` twice the size, the moves and the par
 * under it as `005:003`, a line of its goal under them where it has one, and the faces it asks
 * for right under those; its buttons in the top right corner, side by side a gap apart. A level
 * has no score. On a tall picture the board starts under the lines; on a wide one the lines are
 * a column down the left and the board has the whole height, its top right corner under the buttons.
 */
function levelLayout(picture: Size, safe: Insets, left: number, top: number, needs: HeaderNeeds, wide: boolean): Omit<HudLayout, 'zones'> {
  // A line of the readings: a row of text and a unit of air under it.
  const line = CELL_H + UNIT;
  // `LEVEL 17` two rows tall at the top, as a score stands; the moves and the par a unit under it, the goal a line under those.
  const moves = top + CELL_H * 2 + UNIT;
  const rows = [top, moves, moves] as const;
  const goal = moves + line;
  const rule = (needs.goal ? goal : moves) + CELL_H;
  // As wide as the column of a session, so that the board stands where it does beside it.
  const end = left + READINGS_CELLS * CELL_W;
  // The button of the sound, left of the one that starts over, where it does not reach the lines.
  const { right, pause, restart, sound } = corner(picture, safe, top, needs, end);
  const below = Math.max(rule, wide ? 0 : top + BUTTON_H) + UNIT;
  return {
    wide,
    height: wide ? 0 : below,
    column: wide ? end + EDGE : 0,
    lines: { label: rows[0], big: rows[0], tag: rows[0], best: rows[2], link: goal, cells: goal },
    net: { x: left, y: below + GAP },
    left,
    right,
    rowA: rows[0],
    rowB: rows[1],
    rowC: rows[2],
    big: rows[0],
    mid: left,
    end,
    tight: false,
    pause,
    restart,
    sound,
    tag: { x: left, y: rows[0] },
    goal,
    moves: [rows[1], rows[2]],
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

/** Letters of the voice for a note over the board, in CSS pixels: the size of all prose (`theme.ts`). */
export { NOTE_SIZE } from './theme';
/** What the button that takes a move back keeps around its picture and its word, and between them. */
export const TOOL_PAD = 6;
export const TOOL_GAP = 6;

/**
 * The button that takes a move back, in pixels of the picture: its picture, `icon` dots wide,
 * and right of it its word, `word` wide, with no frame around them, in the bottom left corner:
 * at the bottom of the stage, its left edge at `left`. The picture is drawn a dot a dot, as the
 * letters are, whatever the size of the zone; `box` is what a finger presses, and its line of
 * text stands in the middle of it.
 */
export function undoButton(stage: Box, zoom: number, icon: number, word: number, left: number): { tall: number; box: Box } {
  const tall = Math.max(CELL_H + 8, Math.ceil(MIN_ZONE / zoom));
  const wide = Math.max(tall, TOOL_PAD + icon + TOOL_GAP + word + TOOL_PAD);
  return { tall, box: { x: Math.round(left), y: Math.round(stage.y + stage.h - TOOL_PAD) - tall, w: wide, h: tall } };
}
