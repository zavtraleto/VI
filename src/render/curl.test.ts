import { describe, expect, it } from 'vitest';
import { curlAt, curlFit, type Curl } from './curl';

const DEG = Math.PI / 180;
const WALL = 75 * DEG;

/** Length of the sheet between two points of it, measured on the curl itself. */
function lengthOn(curl: Curl, from: number, to: number, steps = 2000): number {
  let length = 0;
  let before = curlAt(curl, from);
  for (let i = 1; i <= steps; i++) {
    const now = curlAt(curl, from + ((to - from) * i) / steps);
    length += Math.hypot(now.along - before.along, now.up - before.up);
    before = now;
  }
  return length;
}

describe('curlAt', () => {
  const curl: Curl = { flat: 1, radius: 2, wall: WALL };

  it('leaves the sheet flat under the player', () => {
    expect(curlAt(curl, 0)).toEqual({ along: 0, up: 0, angle: 0 });
    expect(curlAt(curl, 0.7)).toEqual({ along: 0.7, up: 0, angle: 0 });
    expect(curlAt({ flat: 0, radius: 1, wall: 0 }, 5)).toEqual({ along: 5, up: 0, angle: 0 });
  });

  it('curls up on a circle and goes on as a wall', () => {
    // A quarter of the way round a circle of the radius 2 would be a turn of 90 degrees; this one stops at 75.
    const turned = curlAt(curl, 1 + 2 * (30 * DEG));
    expect(turned.angle).toBeCloseTo(30 * DEG);
    expect(turned.along).toBeCloseTo(1 + 2 * Math.sin(30 * DEG));
    expect(turned.up).toBeCloseTo(2 * (1 - Math.cos(30 * DEG)));
    const end = 1 + 2 * WALL;
    const wall = curlAt(curl, end + 3);
    expect(wall.angle).toBeCloseTo(WALL);
    expect(wall.along).toBeCloseTo(curlAt(curl, end).along + 3 * Math.cos(WALL));
    expect(wall.up).toBeCloseTo(curlAt(curl, end).up + 3 * Math.sin(WALL));
  });

  it('bends the sheet without stretching it, and without a break', () => {
    expect(lengthOn(curl, 0, 7)).toBeCloseTo(7, 4);
    for (const d of [1, 1 + 2 * WALL]) {
      const before = curlAt(curl, d - 1e-6);
      const after = curlAt(curl, d + 1e-6);
      expect(after.along).toBeCloseTo(before.along, 5);
      expect(after.up).toBeCloseTo(before.up, 5);
      expect(after.angle).toBeCloseTo(before.angle, 5);
    }
  });

  it('never turns back: farther along the sheet is farther across and no lower', () => {
    let before = curlAt(curl, 0);
    for (let d = 0.05; d < 9; d += 0.05) {
      const now = curlAt(curl, d);
      expect(now.along).toBeGreaterThan(before.along);
      expect(now.up).toBeGreaterThanOrEqual(before.up);
      before = now;
    }
  });
});

describe('curlFit', () => {
  it('leaves a board that fits as it lies', () => {
    expect(curlFit(2, 3, 0.3, WALL, 2).wall).toBe(0);
    expect(curlFit(3, 3, 0.3, WALL, 2).wall).toBe(0);
    expect(curlFit(0, 0.5, 0.3, WALL, 2).wall).toBe(0);
    expect(curlAt(curlFit(2, 3, 0.3, WALL, 2), 2).along).toBe(2);
  });

  it('brings the edge of the board to the edge of the screen', () => {
    // The player in the middle of the board, near a side of it, and at the far side from it.
    for (const [reach, room] of [[4.86, 2.92], [2.92, 1.98], [1.46, 1.28], [1.17, 1.14], [8.9, 5.25], [6, 3]]) {
      for (const flat of [0, 0.3, 0.6]) {
        for (const tightest of [0.5, 2, 3]) {
          const curl = curlFit(reach, room, flat, WALL, tightest);
          expect(curlAt(curl, reach).along).toBeCloseTo(room, 6);
          expect(curl.wall).toBeGreaterThan(0);
          expect(curl.wall).toBeLessThanOrEqual(WALL + 1e-9);
          expect(curl.flat).toBeGreaterThanOrEqual(0);
          expect(curl.flat).toBeLessThanOrEqual(flat * room + 1e-9);
        }
      }
    }
  });

  it('keeps the flat part asked for where the curl is wide enough', () => {
    const curl = curlFit(4.86, 2.92, 0.2, WALL, 1);
    expect(curl.flat).toBeCloseTo(0.2 * 2.92);
    expect(curl.radius).toBeGreaterThanOrEqual(1);
    expect(curl.wall).toBeCloseTo(WALL);
  });

  it('gives up the flat part before the curl gets tighter than asked', () => {
    const tight = curlFit(4.86, 2.92, 0.5, WALL, 0.5);
    const wide = curlFit(4.86, 2.92, 0.5, WALL, 2);
    expect(tight.flat).toBeCloseTo(0.5 * 2.92);
    expect(wide.radius).toBeCloseTo(2, 5);
    expect(wide.flat).toBeLessThan(tight.flat);
    // Wider than the board can be curled at all: no flat part is left, and the curl is as wide as it gets.
    const widest = curlFit(4.86, 2.92, 0.5, WALL, 9);
    expect(widest.flat).toBe(0);
    expect(widest.radius).toBeLessThan(9);
    expect(curlAt(widest, 4.86).along).toBeCloseTo(2.92, 6);
  });

  it('curls a little where the board only just fails to fit, and stops at its edge', () => {
    const curl = curlFit(1.17, 1.14, 0.3, WALL, 0.5);
    expect(curl.wall).toBeLessThan(40 * DEG);
    // The curl ends where the board does.
    expect(curl.flat + curl.radius * curl.wall).toBeCloseTo(1.17, 6);
  });

  it('is steeper the more of the board there is to take in', () => {
    const near = curlAt(curlFit(3, 2.5, 0.3, WALL, 1), 3);
    const far = curlAt(curlFit(6, 2.5, 0.3, WALL, 1), 6);
    expect(far.up).toBeGreaterThan(near.up);
    expect(far.angle).toBeGreaterThanOrEqual(near.angle);
  });
});
