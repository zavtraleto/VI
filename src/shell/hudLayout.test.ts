import { describe, expect, it } from 'vitest';
import { COUNTER_CUBE, COUNTER_GAP, counterWidth, hudLayout, netBounds, netCellAt, signPlace, turned, type FloorAxes } from './hudLayout';
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

describe('the plaque of a short combo', () => {
  it('is as wide as its cubes: one more cube makes it wider by a cube and its gap', () => {
    expect(counterWidth(3) - counterWidth(2)).toBe(COUNTER_CUBE + COUNTER_GAP);
    expect(counterWidth(6) - counterWidth(2)).toBe(4 * (COUNTER_CUBE + COUNTER_GAP));
    expect(counterWidth(2)).toBeGreaterThan(2 * COUNTER_CUBE);
  });
});
