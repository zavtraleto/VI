import { describe, expect, it } from 'vitest';
import { CURVES, inExpo, inOutSine, inQuart, outBack, outCubic, tween } from './ease';

describe('the curves of the look', () => {
  it('start at 0 and end at 1', () => {
    for (const [name, curve] of Object.entries(CURVES)) {
      expect(curve(0), name).toBeCloseTo(0);
      expect(curve(1), name).toBeCloseTo(1);
    }
  });

  it('go one way: none of them turns back, but the one that goes past the end', () => {
    for (const [name, curve] of Object.entries(CURVES)) {
      if (name === 'outBack') continue;
      let last = curve(0);
      for (let i = 1; i <= 100; i++) {
        const next = curve(i / 100);
        expect(next, `${name} at ${i}`).toBeGreaterThanOrEqual(last - 1e-9);
        last = next;
      }
    }
  });

  it('is slow at the start when it is in, and slow at the end when it is out', () => {
    expect(inQuart(0.5)).toBeLessThan(0.1);
    expect(inExpo(0.5)).toBeLessThan(0.05);
    expect(outCubic(0.5)).toBeGreaterThan(0.85);
    expect(inOutSine(0.5)).toBeCloseTo(0.5);
  });

  it('goes past the end and comes back when it is back', () => {
    const back = outBack();
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => back(i / 100)))).toBeGreaterThan(1.05);
    expect(back(1)).toBeCloseTo(1);
  });

  it('tweens from one number to another along a curve, and stays at the ends outside 0..1', () => {
    expect(tween(0.5, 2, 4, (t) => t)).toBeCloseTo(3);
    expect(tween(-1, 2, 4, (t) => t)).toBe(2);
    expect(tween(2, 2, 4, (t) => t)).toBe(4);
  });
});
