import { describe, expect, it } from 'vitest';
import { CROSS_LEAST_PX, CROSS_RIM_LEAST_PX, crossStrokes, offMask } from './faces';
import { boardDefaults } from './params';

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

describe('the cross of a face that does not work', () => {
  it('is as wide as it is asked to be, round ends and all', () => {
    const { thick, reach } = crossStrokes(0.5, 0.08, 0.02, 0.001);
    expect(thick).toBeCloseTo(0.04);
    // The end of a stroke lies on a diagonal; its round end reaches the side of the square.
    expect(reach * Math.SQRT1_2 + thick).toBeCloseTo(0.25);
  });

  it('has a dark line around its strokes', () => {
    const { thick, shell } = crossStrokes(0.5, 0.08, 0.02, 0.001);
    expect(shell - thick).toBeCloseTo(0.02);
    expect(crossStrokes(0.5, 0.08, 0, 0.01).shell - 0.04).toBeCloseTo(CROSS_RIM_LEAST_PX * 0.01);
  });

  it('is never thinner than can be read, nor turned inside out', () => {
    expect(crossStrokes(0.5, 0.01, 0.02, 0.02).thick * 2).toBeCloseTo(CROSS_LEAST_PX * 0.02);
    expect(crossStrokes(0.1, 0.4, 0, 0).reach).toBe(0);
  });

  it('is three pixels thick or more on a phone as the look stands, half the face wide', () => {
    const values = boardDefaults();
    expect(Number(values.crossSize)).toBe(0.5);
    expect(Number(values.crossWidth) * 48).toBeGreaterThanOrEqual(3);
    for (const face of [40, 50, 60]) {
      const { thick, reach, shell } = crossStrokes(Number(values.crossSize), Number(values.crossWidth), Number(values.crossRim), 1 / face);
      expect(thick * 2 * face, `stroke on ${face}`).toBeGreaterThanOrEqual(CROSS_LEAST_PX - 1e-9);
      expect((shell - thick) * face, `rim on ${face}`).toBeGreaterThanOrEqual(CROSS_RIM_LEAST_PX - 1e-9);
      // The strokes are longer than they are thick: a cross, not a blot.
      expect(reach).toBeGreaterThan(thick * 2);
    }
  });
});
