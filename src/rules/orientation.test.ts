import { describe, expect, it } from 'vitest';
import { ALL_ORIENTATIONS, CANONICAL, orientationKey, roll } from './orientation';
import { nextRandom } from './rng';
import type { Dir } from './types';

const DIRS: Dir[] = ['N', 'S', 'E', 'W'];
const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

describe('orientation', () => {
  it('has exactly 24 unique orientations', () => {
    expect(ALL_ORIENTATIONS.length).toBe(24);
    expect(new Set(ALL_ORIENTATIONS.map(orientationKey)).size).toBe(24);
  });

  it('keeps opposite faces summing to 7', () => {
    for (const o of ALL_ORIENTATIONS) {
      expect(o.top + o.bottom).toBe(7);
      expect(o.north + o.south).toBe(7);
      expect(o.east + o.west).toBe(7);
    }
  });

  it('returns to the start after four rolls in one direction', () => {
    for (const o of ALL_ORIENTATIONS) {
      for (const d of DIRS) {
        expect(roll(roll(roll(roll(o, d), d), d), d)).toEqual(o);
      }
    }
  });

  it('cancels a roll with the opposite roll', () => {
    for (const o of ALL_ORIENTATIONS) {
      for (const d of DIRS) {
        expect(roll(roll(o, d), OPPOSITE[d])).toEqual(o);
      }
    }
  });

  it('follows the roll table from the spec', () => {
    const o = CANONICAL; // top 1, bottom 6, north 2, south 5, east 3, west 4
    expect(roll(o, 'N')).toEqual({ top: 5, bottom: 2, north: 1, south: 6, east: 3, west: 4 });
    expect(roll(o, 'S')).toEqual({ top: 2, bottom: 5, north: 6, south: 1, east: 3, west: 4 });
    expect(roll(o, 'E')).toEqual({ top: 4, bottom: 3, north: 2, south: 5, east: 1, west: 6 });
    expect(roll(o, 'W')).toEqual({ top: 3, bottom: 4, north: 2, south: 5, east: 6, west: 1 });
  });

  it('contains the tutorial cube and rolls it west to a 2', () => {
    const a = { top: 1, bottom: 6, north: 4, south: 3, east: 2, west: 5 };
    expect(ALL_ORIENTATIONS.map(orientationKey)).toContain(orientationKey(a));
    expect(roll(a, 'W').top).toBe(2);
  });
});

describe('rng', () => {
  it('is reproducible and stays in [0, 1)', () => {
    const a = { rng: 12345 };
    const b = { rng: 12345 };
    for (let i = 0; i < 1000; i++) {
      const v = nextRandom(a);
      expect(v).toBe(nextRandom(b));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
