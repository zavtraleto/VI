import { describe, expect, it } from 'vitest';
import { COUNTER_CUBE, COUNTER_GAP, counterLeft, counterWidth, hudLayout, netBounds, netCellAt, signBeside, signClear, signKey, signPlace, turned, type FloorAxes } from './hudLayout';
import { CELL_W, MIN_ZONE } from './layout';

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
/** The floor as the default camera shows it. */
const AXES: FloorAxes = { east: { x: 0.87, y: 0.31 }, south: { x: -0.5, y: 0.53 } };

describe('the readings of a session', () => {
  it('keep the large number, the middle and the right side apart on every picture', () => {
    for (const [width, height, zoom] of [
      [240, 520, 1.33],
      [281, 609, 1.33],
      [320, 693, 1.33],
      [400, 400, 2],
    ]) {
      const layout = hudLayout({ width, height }, NO_INSETS, zoom);
      expect(layout.wide).toBe(false);
      expect(layout.mid).toBeGreaterThanOrEqual(layout.left + 6 * CELL_W * 2);
      expect(layout.end).toBeLessThan(layout.pause.x);
      expect(layout.pause.x + layout.pause.w).toBeLessThanOrEqual(width);
      // The score of six digits on the right never reaches the middle reading on its row.
      if (!layout.tight) expect(layout.end - 6 * CELL_W).toBeGreaterThanOrEqual(layout.mid + 5 * CELL_W);
      expect(layout.height).toBeGreaterThan(layout.rule);
    }
  });

  it('give the pause a zone a finger can hit', () => {
    const layout = hudLayout({ width: 281, height: 609 }, NO_INSETS, 1.33);
    expect(layout.pause.h * 1.33).toBeGreaterThanOrEqual(MIN_ZONE);
    expect(layout.pause.w * 1.33).toBeGreaterThanOrEqual(MIN_ZONE);
  });

  it('stand clear of what the edges of the screen keep', () => {
    const plain = hudLayout({ width: 281, height: 609 }, NO_INSETS, 1.33);
    const notched = hudLayout({ width: 281, height: 609 }, { top: 30, right: 0, bottom: 0, left: 0 }, 1.33);
    expect(notched.rowA).toBeGreaterThanOrEqual(plain.rowA + 30);
    expect(notched.height).toBeGreaterThanOrEqual(plain.height + 30);
  });

  it('say when the picture is too narrow for two readings in the middle', () => {
    expect(hudLayout({ width: 240, height: 520 }, NO_INSETS, 1.33).tight).toBe(true);
    expect(hudLayout({ width: 320, height: 693 }, NO_INSETS, 1.33).tight).toBe(false);
  });

  it('stand in a column down the left of a wide picture and take none of its height', () => {
    for (const [width, height, zoom] of [
      [640, 360, 2],
      [640, 360, 3],
      [609, 281, 1.33],
    ]) {
      const layout = hudLayout({ width, height }, NO_INSETS, zoom);
      expect(layout.wide).toBe(true);
      expect(layout.height).toBe(0);
      expect(layout.column).toBeGreaterThanOrEqual(6 * CELL_W * 2 + 16);
      expect(layout.column).toBeLessThan(width / 3);
      const { lines } = layout;
      // One reading to a line, none over another, the pause under them, the net under the pause.
      expect([lines.label, lines.big, lines.tag, lines.best, lines.link, lines.cells]).toEqual(
        [lines.label, lines.big, lines.tag, lines.best, lines.link, lines.cells].sort((a, b) => a - b),
      );
      expect(lines.tag).toBeGreaterThanOrEqual(lines.big + 32);
      expect(layout.pause.y).toBeGreaterThan(layout.rule);
      expect(layout.pause.h * zoom).toBeGreaterThanOrEqual(MIN_ZONE);
      expect(layout.net.y).toBeGreaterThanOrEqual(layout.pause.y + layout.pause.h);
      expect(layout.net.y + 70).toBeLessThan(height);
    }
  });
});

describe('the net of the die under the player', () => {
  const centre = { x: 100, y: 100 };
  const side = 20;
  const point = (a: number, b: number) => ({
    x: centre.x + (AXES.east.x * a + AXES.south.x * b) * side,
    y: centre.y + (AXES.east.y * a + AXES.south.y * b) * side,
  });
  const at = (a: number, b: number) => {
    const p = point(a, b);
    return netCellAt(p.x, p.y, centre, side, AXES);
  };

  it('has the top face in the middle and a side towards every direction of the board', () => {
    expect(at(0, 0)?.cell).toBe('top');
    expect(at(1, 0)?.cell).toBe('E');
    expect(at(-1, 0)?.cell).toBe('W');
    expect(at(0, 1)?.cell).toBe('S');
    expect(at(0, -1)?.cell).toBe('N');
    // The corners of the cross are not a part of it.
    expect(at(1, 1)).toBeNull();
    expect(at(2, 0)).toBeNull();
  });

  it('tells where in a cell a point is', () => {
    const hit = at(0.25, 0)!;
    expect(hit.cell).toBe('top');
    expect(hit.u).toBeCloseTo(0.75);
    expect(hit.v).toBeCloseTo(0.5);
  });

  it('fits in its bounds', () => {
    const box = netBounds(centre, side, AXES);
    const corners = [
      [1.5, 0.5],
      [1.5, -0.5],
      [-1.5, 0.5],
      [-1.5, -0.5],
      [0.5, 1.5],
      [-0.5, 1.5],
      [0.5, -1.5],
      [-0.5, -1.5],
    ];
    for (const [a, b] of corners) {
      const { x, y } = point(a, b);
      expect(x).toBeGreaterThanOrEqual(box.x);
      expect(x).toBeLessThanOrEqual(box.x + box.w);
      expect(y).toBeGreaterThanOrEqual(box.y);
      expect(y).toBeLessThanOrEqual(box.y + box.h);
    }
  });

  it('turns a point of a face by quarters, and four of them bring it back', () => {
    expect(turned(0.2, 0.3, 0)).toEqual({ u: 0.2, v: 0.3 });
    const once = turned(0.2, 0.3, 1);
    expect(once.u).toBeCloseTo(0.7);
    expect(once.v).toBeCloseTo(0.2);
    const back = turned(0.2, 0.3, 4);
    expect(back.u).toBeCloseTo(0.2);
    expect(back.v).toBeCloseTo(0.3);
    expect(turned(0.2, 0.3, -1)).toEqual(turned(0.2, 0.3, 3));
  });
});

describe('the place of the swipe sign', () => {
  const picture = { x: 0, y: 0, w: 280, h: 600 };

  it('has its key in the middle of the trail, beside the figure the trail starts from', () => {
    expect(signKey({ x: 100, y: 300 }, { x: 20, y: -6 })).toEqual({ x: 110, y: 297 });
    expect(signKey({ x: 100, y: 300 }, { x: -30, y: 0 })).toEqual({ x: 85, y: 300 });
    expect(signKey({ x: 100, y: 300 }, { x: 0, y: 0 })).toEqual({ x: 100, y: 300 });
  });

  it('is where it was asked for when the sign and its trail are on the picture', () => {
    expect(signPlace({ x: 100, y: 300 }, { x: 20, y: -6 }, picture, 4)).toEqual({ x: 100, y: 300 });
    expect(signPlace({ x: 100, y: 300 }, { x: 0, y: 0 }, picture, 10)).toEqual({ x: 100, y: 300 });
  });

  it('is brought to the edge of the picture on the side it left it by, trail and all', () => {
    // East of a board that fills the screen of a phone: the trail ends at the edge, less the room asked.
    expect(signPlace({ x: 300, y: 300 }, { x: 20, y: 0 }, picture, 4)).toEqual({ x: 256, y: 300 });
    expect(signPlace({ x: -30, y: 300 }, { x: -20, y: 0 }, picture, 4)).toEqual({ x: 24, y: 300 });
    expect(signPlace({ x: 100, y: -50 }, { x: 5, y: -20 }, picture, 4)).toEqual({ x: 100, y: 24 });
    expect(signPlace({ x: 100, y: 700 }, { x: -5, y: 20 }, picture, 4)).toEqual({ x: 100, y: 576 });
  });

  it('keeps out of what the edges of the screen keep to themselves', () => {
    const inner = { x: 30, y: 40, w: 220, h: 500 };
    expect(signPlace({ x: 0, y: 0 }, { x: 10, y: 10 }, inner, 4)).toEqual({ x: 34, y: 44 });
    expect(signPlace({ x: 400, y: 900 }, { x: 10, y: 10 }, inner, 4)).toEqual({ x: 236, y: 526 });
  });

  it('stands in the middle of a picture too small for it', () => {
    expect(signPlace({ x: 0, y: 5 }, { x: 40, y: 0 }, { x: 0, y: 0, w: 30, h: 10 }, 4)).toEqual({ x: -5, y: 5 });
  });
});

describe('the trail of the swipe sign beside the die', () => {
  // The die under the figure as it lies on a picture, and a cell of the board the way of each swipe.
  const die = { x: 150, y: 300, w: 40, h: 50 };
  const ends = (run: { from: { x: number; y: number }; trail: { x: number; y: number } }) => ({ x: run.from.x + run.trail.x, y: run.from.y + run.trail.y });

  it('runs to the north beside the die, on its right, the way the strip of the first piece runs on screen', () => {
    const run = signBeside(die, { x: 0, y: -40 }, 1.2, 6);
    // Parallel to the board: the way a cell to the north lies on screen, and as long as the look asks.
    expect(run.trail).toEqual({ x: 0, y: -48 });
    // Right of the die by the gap, and as far below its middle as it ends above it.
    expect(run.from).toEqual({ x: 196, y: 349 });
    expect(ends(run)).toEqual({ x: 196, y: 301 });
  });

  it('keeps the lean of the board: a north that goes up and to the right starts at the gap and leans away from the die', () => {
    const run = signBeside(die, { x: 20, y: -30 }, 1, 6);
    expect(run.trail).toEqual({ x: 20, y: -30 });
    expect(run.from).toEqual({ x: 196, y: 340 });
  });

  it('runs to the south beside the die, on its right, downwards', () => {
    const run = signBeside(die, { x: 0, y: 40 }, 1, 6);
    expect(run.from).toEqual({ x: 196, y: 305 });
    expect(ends(run)).toEqual({ x: 196, y: 345 });
  });

  it('runs to the east away from the die, from the gap on', () => {
    const run = signBeside(die, { x: 30, y: 16 }, 1, 6);
    expect(run.from).toEqual({ x: 196, y: 317 });
    expect(ends(run)).toEqual({ x: 226, y: 333 });
  });

  it('runs to the west towards the die and ends at the gap: it never lies on the die', () => {
    const run = signBeside(die, { x: -30, y: -16 }, 1, 6);
    expect(run.from).toEqual({ x: 226, y: 333 });
    expect(ends(run)).toEqual({ x: 196, y: 317 });
    for (const step of [{ x: 0, y: -40 }, { x: 0, y: 40 }, { x: 30, y: 16 }, { x: -30, y: -16 }, { x: 20, y: -30 }]) {
      const each = signBeside(die, step, 1.5, 6);
      expect(Math.min(each.from.x, ends(each).x)).toBe(196);
    }
  });

  it('is brought in from the right edge of a phone 360 wide, trail and all', () => {
    const phone = { x: 0, y: 40, w: 360, h: 600 };
    const run = signBeside({ x: 310, y: 300, w: 44, h: 50 }, { x: 0, y: -40 }, 1.2, 6);
    expect(run.from.x).toBe(360);
    const from = signPlace(run.from, run.trail, phone, 8);
    expect(from).toEqual({ x: 352, y: 349 });
    // And under the readings: a die in the top row has its sign below them.
    const high = signBeside({ x: 100, y: 44, w: 40, h: 50 }, { x: 0, y: -40 }, 1.2, 6);
    expect(signPlace(high.from, high.trail, phone, 8)).toEqual({ x: 146, y: 96 });
  });

  it('stands below the buttons of a level where it would lie on them, and is left alone where it would not', () => {
    const tools = { x: 280, y: 40, w: 76, h: 24 };
    // Its trail runs up into the buttons: it is moved down until its top is clear of them.
    expect(signClear({ x: 300, y: 100 }, { x: 0, y: -48 }, tools, 4)).toEqual({ x: 300, y: 116 });
    expect(signClear({ x: 300, y: 50 }, { x: 0, y: 30 }, tools, 4)).toEqual({ x: 300, y: 68 });
    // Left of them, or below them, it stays.
    expect(signClear({ x: 200, y: 100 }, { x: 0, y: -48 }, tools, 4)).toEqual({ x: 200, y: 100 });
    expect(signClear({ x: 300, y: 200 }, { x: 0, y: -48 }, tools, 4)).toEqual({ x: 300, y: 200 });
    expect(signClear({ x: 300, y: 100 }, { x: 0, y: -48 }, null, 4)).toEqual({ x: 300, y: 100 });
  });
});

describe('the plaque of a short combo', () => {
  it('is as wide as its cubes: one more cube makes it wider by a cube and its gap', () => {
    expect(counterWidth(3) - counterWidth(2)).toBe(COUNTER_CUBE + COUNTER_GAP);
    expect(counterWidth(6) - counterWidth(2)).toBe(4 * (COUNTER_CUBE + COUNTER_GAP));
    expect(counterWidth(2)).toBeGreaterThan(2 * COUNTER_CUBE);
  });

  /** The picture of a phone 360 wide, drawn pixel for pixel. */
  const phone = { x: 0, y: 0, w: 360, h: 640 };
  const six = counterWidth(6);

  it('stands with its middle over its heap when all of it is in the window', () => {
    expect(counterLeft(180, six, phone, 1)).toBe(180 - six / 2);
    expect(counterLeft(180, counterWidth(2), phone, 1)).toBe(180 - counterWidth(2) / 2);
    // To a whole pixel, as it was drawn before it was kept in the window.
    expect(counterLeft(100.4, counterWidth(3), phone, 1)).toBe(Math.round(100.4 - counterWidth(3) / 2));
    // The nearest it comes to either edge without being moved.
    expect(counterLeft(1 + six / 2, six, phone, 1)).toBe(1);
    expect(counterLeft(359 - six / 2, six, phone, 1)).toBe(359 - six);
  });

  it('of six over a heap at the left or the right edge of the window is brought in from the edge, whole', () => {
    for (const middle of [-40, 0, 10, six / 2]) {
      const left = counterLeft(middle, six, phone, 1);
      expect(left).toBe(1);
      expect(left + six).toBeLessThanOrEqual(360);
    }
    for (const middle of [360 - six / 2, 350, 360, 420]) {
      const left = counterLeft(middle, six, phone, 1);
      expect(left).toBe(359 - six);
      expect(left).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps out of what the edges of the screen keep to themselves, to a whole pixel', () => {
    const notched = { x: 30.5, y: 0, w: 300, h: 640 };
    expect(counterLeft(0, six, notched, 1)).toBe(32);
    expect(counterLeft(360, six, notched, 1)).toBe(329 - six);
    expect(counterLeft(180, six, notched, 1)).toBe(180 - six / 2);
  });

  it('stands in the middle of a window too narrow for it', () => {
    expect(counterLeft(10, six, { x: 0, y: 0, w: 60, h: 100 }, 1)).toBe(30 - six / 2);
  });
});
