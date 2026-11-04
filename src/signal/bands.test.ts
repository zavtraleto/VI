import { describe, expect, it } from 'vitest';
import { BandTimer } from './bands';
import { NOVEL_LOOK } from './record';

const seq = (seed: number) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

describe('the bands of interference of a record', () => {
  it('come one at a time, now and then, and grow and fade without a jump', () => {
    const timer = new BandTimer(seq(11));
    const look = NOVEL_LOOK.bands;
    let came = 0;
    let was = 0;
    let had = false;
    let quiet = 0;
    let longest = 0;
    for (let t = 0; t <= 120000; t += 16) {
      const band = timer.at(t, false);
      const strength = band?.strength ?? 0;
      expect(strength).toBeGreaterThanOrEqual(0);
      expect(strength).toBeLessThanOrEqual(1);
      // At sixty frames a second it never moves much in one frame.
      expect(Math.abs(strength - was)).toBeLessThan(0.1);
      if (band && !had) came++;
      had = band !== null;
      if (band) {
        expect(band.half * 2).toBeGreaterThanOrEqual(look.height[0] - 1e-9);
        expect(band.half * 2).toBeLessThanOrEqual(look.height[1] + 1e-9);
        quiet = 0;
      } else {
        longest = Math.max(longest, ++quiet * 16);
      }
      was = strength;
    }
    // Two minutes: between one every eight seconds and one every three and a half.
    expect(came).toBeGreaterThanOrEqual(120000 / (look.every[1] + look.rollMs) - 1);
    expect(came).toBeLessThanOrEqual(120000 / look.every[0] + 1);
    expect(longest).toBeLessThanOrEqual(look.every[1] + 32);
  });

  it('run down the frame from the top, or stand where they light up', () => {
    const timer = new BandTimer(seq(3));
    const kinds = new Set<string>();
    let previous: number | null = null;
    let moving = false;
    for (let t = 0; t <= 200000; t += 16) {
      const band = timer.at(t, false);
      if (!band) {
        if (previous !== null) kinds.add(moving ? 'roll' : 'flare');
        previous = null;
        moving = false;
        continue;
      }
      if (previous !== null && band.y < previous) moving = true;
      if (previous !== null) expect(band.y).toBeLessThanOrEqual(previous);
      previous = band.y;
    }
    expect(kinds).toEqual(new Set(['roll', 'flare']));
  });

  it('do not come with motion kept low', () => {
    const timer = new BandTimer(seq(5));
    for (let t = 0; t <= 60000; t += 16) expect(timer.at(t, true)).toBeNull();
  });
});
