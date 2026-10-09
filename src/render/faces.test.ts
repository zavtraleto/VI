import { describe, expect, it } from 'vitest';
import { RING_LEAST_PX, RING_MOST, offMask, ringHole } from './faces';
import { boardDefaults } from './params';
import { pipRadius } from './textures';

describe('the faces that do not work', () => {
  it('are none where no faces are named', () => {
    expect(offMask(undefined)).toBe(0);
  });

  it('are every face the level does not name, a bit for each', () => {
    expect(offMask([3])).toBe(0b111011);
    expect(offMask([2, 3])).toBe(0b111001);
    expect(offMask([3, 2])).toBe(0b111001);
    expect(offMask([1, 5])).toBe(0b101110);
    expect(offMask([1, 2, 3, 4, 5, 6])).toBe(0);
    expect(offMask([])).toBe(0b111111);
  });
});

describe('the ring of a hollow pip', () => {
  it('is a share of the radius of the pip where the face is large', () => {
    expect(ringHole(10, 0.4, 0.01)).toBeCloseTo(6);
    expect(ringHole(10, 0, 0)).toBe(10);
  });

  it('is never thinner than can be read', () => {
    // A pip of five pixels with a ring of a fifth of it: two pixels all the same.
    expect(ringHole(5, 0.2, 1)).toBeCloseTo(5 - RING_LEAST_PX);
  });

  it('always leaves a hole', () => {
    expect(ringHole(2, 1, 1)).toBeCloseTo(2 * (1 - RING_MOST));
    expect(ringHole(10, 1, 0)).toBeGreaterThan(0);
  });

  it('is two pixels or more on a phone as the look stands, with a hole left in it', () => {
    const values = boardDefaults();
    for (const face of [40, 50, 60]) {
      for (const value of [1, 2]) {
        // In pixels: the face is that many of them wide.
        const radius = pipRadius(value, values) * face;
        const hole = ringHole(radius, Number(values.pipRing), 1);
        expect(radius - hole, `${value} on ${face}`).toBeGreaterThanOrEqual(RING_LEAST_PX - 1e-9);
        expect(hole, `${value} on ${face}`).toBeGreaterThan(1);
      }
    }
  });
});
