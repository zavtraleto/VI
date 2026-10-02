import { describe, expect, it } from 'vitest';
import { CubeSprings } from './springs';

function settle(springs: CubeSprings): void {
  for (let i = 0; i < 200; i++) springs.update(16);
}

describe('cube springs', () => {
  it('holds the cube under the player lower than the rest', () => {
    const springs = new CubeSprings();
    springs.hold(7, 0.07);
    settle(springs);
    expect(springs.offset(7)).toBeCloseTo(-0.07, 3);
    expect(springs.offset(8)).toBe(0);
  });

  it('lets a cube back up when the player leaves it for another', () => {
    const springs = new CubeSprings();
    springs.hold(7, 0.07);
    settle(springs);
    springs.hold(8, 0.07);
    settle(springs);
    expect(springs.offset(7)).toBe(0);
    expect(springs.offset(8)).toBeCloseTo(-0.07, 3);
    springs.hold(null, 0.07);
    settle(springs);
    expect(springs.offset(8)).toBe(0);
  });

  it('brings a cube that a chain lifted up softly', () => {
    const springs = new CubeSprings();
    springs.shift(3, -0.2);
    expect(springs.offset(3)).toBeCloseTo(-0.2);
    springs.update(16);
    expect(springs.offset(3)).toBeGreaterThan(-0.2);
    settle(springs);
    expect(springs.offset(3)).toBe(0);
  });
});
