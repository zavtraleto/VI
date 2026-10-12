import { describe, expect, it } from 'vitest';
import { bumpOffset } from './bump';

describe('bumpOffset', () => {
  it('is nought before the bump, after it, and where it takes no time', () => {
    expect(bumpOffset(0, 140, 0.1)).toBe(0);
    expect(bumpOffset(140, 140, 0.1)).toBe(0);
    expect(bumpOffset(500, 140, 0.1)).toBe(0);
    expect(bumpOffset(50, 0, 0.1)).toBe(0);
  });

  it('goes out to its reach and comes back', () => {
    expect(bumpOffset(49, 140, 0.1)).toBeCloseTo(0.1, 5);
    const steps = [10, 30, 49, 80, 110, 135].map((ms) => bumpOffset(ms, 140, 0.1));
    expect(steps[0]).toBeLessThan(steps[1]);
    expect(steps[1]).toBeLessThan(steps[2]);
    expect(steps[2]).toBeGreaterThan(steps[3]);
    expect(steps[3]).toBeGreaterThan(steps[4]);
    expect(steps[4]).toBeGreaterThan(steps[5]);
    for (const step of steps) expect(step).toBeGreaterThan(0);
  });
});
