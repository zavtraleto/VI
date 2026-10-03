import { describe, expect, it } from 'vitest';
import { lensBends, lensForward, lensFrom, lensInverse, lensTo, type Lens, type LensStrength } from './lens';

const UNEVEN = { left: 1.65, right: 0.7, bottom: 0.7, top: 1.1 };
const STRENGTHS: LensStrength[] = [0, 0.3, 0.7, 2, UNEVEN];
/** Points all over the rectangle, the corners and a little past the edges included. */
const POINTS: [number, number][] = [];
for (let x = -1.1; x <= 1.1001; x += 0.1) for (let y = -1.1; y <= 1.1001; y += 0.1) POINTS.push([x, y]);

describe('the lens', () => {
  it('leaves the centre where it is', () => {
    for (const k of STRENGTHS) {
      expect(lensInverse(0, 0, k)).toEqual({ x: 0, y: 0 });
      expect(lensForward(0, 0, k)).toEqual({ x: 0, y: 0 });
    }
  });

  it('keeps an edge an edge', () => {
    for (const k of STRENGTHS) {
      for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const from = lensInverse(x, y, k);
        expect(from.x).toBeCloseTo(x, 12);
        expect(from.y).toBeCloseTo(y, 12);
        const to = lensForward(x, y, k);
        expect(to.x).toBeCloseTo(x, 9);
        expect(to.y).toBeCloseTo(y, 9);
      }
    }
  });

  it('is the formula of the distance from the centre when it is as strong all round', () => {
    const k = 0.7;
    for (const [x, y] of POINTS) {
      const r = Math.hypot(x, y);
      const from = lensInverse(x, y, k);
      expect(Math.hypot(from.x, from.y)).toBeCloseTo((r * (1 + k * r * r)) / (1 + k), 12);
      // And along the same line from the centre.
      expect(from.x * y).toBeCloseTo(from.y * x, 12);
    }
  });

  it('enlarges the middle `1 + k` times, towards each side by the strength of that side', () => {
    const near = 1e-4;
    expect(lensInverse(near, 0, 0.7).x).toBeCloseTo(near / 1.7, 9);
    expect(lensInverse(-near, 0, UNEVEN).x).toBeCloseTo(-near / 2.65, 9);
    expect(lensInverse(near, 0, UNEVEN).x).toBeCloseTo(near / 1.7, 9);
    expect(lensInverse(0, near, UNEVEN).y).toBeCloseTo(near / 2.1, 9);
  });

  it('has forward and inverse undo each other', () => {
    for (const k of STRENGTHS) {
      for (const [x, y] of POINTS) {
        const there = lensInverse(x, y, k);
        const back = lensForward(there.x, there.y, k);
        expect(back.x).toBeCloseTo(x, 9);
        expect(back.y).toBeCloseTo(y, 9);
        const shown = lensForward(x, y, k);
        const taken = lensInverse(shown.x, shown.y, k);
        expect(taken.x).toBeCloseTo(x, 9);
        expect(taken.y).toBeCloseTo(y, 9);
      }
    }
  });

  it('does nothing at no strength', () => {
    for (const [x, y] of POINTS) {
      expect(lensInverse(x, y, 0)).toEqual({ x, y });
      expect(lensForward(x, y, 0)).toEqual({ x, y });
    }
    expect(lensBends(0)).toBe(false);
    expect(lensBends({ left: 0, right: 0, bottom: 0, top: 0 })).toBe(false);
    expect(lensBends(0.7)).toBe(true);
    expect(lensBends({ left: 0, right: 0, bottom: 0.2, top: 0 })).toBe(true);
  });

  it('presses the picture together more and more towards the edge', () => {
    // Equal steps on the screen take longer and longer steps of the layer.
    let before = 0;
    let stride = 0;
    for (let r = 0.1; r <= 1.0001; r += 0.1) {
      const at = lensInverse(r, 0, 0.7).x;
      expect(at - before).toBeGreaterThan(stride);
      stride = at - before;
      before = at;
    }
  });
});

describe('a lens over a part of a layer', () => {
  const lens: Lens = { centre: { x: 0.5, y: 0.5 }, from: { x: 0.7, y: 0.4 }, k: UNEVEN };

  it('shows under its centre the point it is told to', () => {
    expect(lensFrom(lens, 0.5, 0.5)).toEqual({ x: 0.7, y: 0.4 });
    const shown = lensTo(lens, 0.7, 0.4);
    expect(shown.x).toBeCloseTo(0.5, 12);
    expect(shown.y).toBeCloseTo(0.5, 12);
  });

  it('keeps the edges of the part at the edges', () => {
    expect(lensFrom(lens, 0, 0.5).x).toBeCloseTo(0, 12);
    expect(lensFrom(lens, 1, 0.5).x).toBeCloseTo(1, 12);
    expect(lensFrom(lens, 0.5, 0).y).toBeCloseTo(0, 12);
    expect(lensFrom(lens, 0.5, 1).y).toBeCloseTo(1, 12);
  });

  it('puts a point of the layer where the screen shows it', () => {
    for (let u = 0; u <= 1.0001; u += 0.125) {
      for (let v = 0; v <= 1.0001; v += 0.125) {
        const shown = lensTo(lens, u, v);
        const taken = lensFrom(lens, shown.x, shown.y);
        expect(taken.x).toBeCloseTo(u, 9);
        expect(taken.y).toBeCloseTo(v, 9);
      }
    }
  });

  it('is the plain picture with no strength and the centre on its own point', () => {
    const none: Lens = { centre: { x: 0.5, y: 0.5 }, from: { x: 0.5, y: 0.5 }, k: 0 };
    expect(lensFrom(none, 0.2, 0.9)).toEqual({ x: 0.2, y: 0.9 });
    expect(lensTo(none, 0.2, 0.9)).toEqual({ x: 0.2, y: 0.9 });
  });
});
