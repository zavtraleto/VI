import { describe, expect, it } from 'vitest';
import { CameraPunch } from './punch';

describe('the lean of the camera on a beat', () => {
  it('comes up to its peak in the attack, and not at once', () => {
    const punch = new CameraPunch();
    expect(punch.value(120)).toBe(0);
    punch.lean(0.02, 30, 120);
    expect(punch.value(120)).toBe(0);
    punch.update(15);
    expect(punch.value(120)).toBeGreaterThan(0.01);
    expect(punch.value(120)).toBeLessThan(0.02);
    punch.update(15);
    expect(punch.value(120)).toBeCloseTo(0.02);
  });

  it('goes back down after the peak, by the time it is given', () => {
    const punch = new CameraPunch();
    punch.lean(0.02, 30, 120);
    punch.update(30 + 120);
    expect(punch.value(120)).toBeCloseTo(0.02 / Math.E);
    punch.update(2000);
    expect(punch.value(120)).toBeLessThan(1e-6);
  });

  it('raises its peak for a beat that comes in the attack, without starting over', () => {
    const punch = new CameraPunch();
    punch.lean(0.01, 30, 120);
    punch.update(15);
    punch.lean(0.03, 30, 120);
    punch.update(15);
    expect(punch.value(120)).toBeCloseTo(0.03);
    // A smaller one takes nothing from it.
    const again = new CameraPunch();
    again.lean(0.03, 30, 120);
    again.update(15);
    again.lean(0.01, 30, 120);
    again.update(15);
    expect(again.value(120)).toBeCloseTo(0.03);
  });

  it('starts a later beat from where the lean is, with no jump down', () => {
    const punch = new CameraPunch();
    punch.lean(0.03, 30, 120);
    punch.update(60);
    const before = punch.value(120);
    expect(before).toBeGreaterThan(0.02);
    punch.lean(0.045, 30, 120);
    expect(punch.value(120)).toBeCloseTo(before);
    punch.update(30);
    expect(punch.value(120)).toBeCloseTo(0.045);
    // A smaller beat on a larger lean does not pull it down either.
    punch.lean(0.006, 30, 120);
    expect(punch.value(120)).toBeCloseTo(0.045);
  });

  it('is at its peak at once with no attack, and is nothing after a reset', () => {
    const punch = new CameraPunch();
    punch.lean(0.02, 0, 120);
    expect(punch.value(120)).toBeCloseTo(0.02);
    punch.reset();
    expect(punch.value(120)).toBe(0);
  });
});
