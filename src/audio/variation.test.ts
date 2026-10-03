import { describe, expect, it } from 'vitest';
import { Variety, cents, pickFresh, soundRandom, spread } from './variation';

describe('a pick that is never the last one', () => {
  it('holds for any run of numbers', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rand = soundRandom(seed);
      for (const count of [2, 3, 4, 7]) {
        let last = -1;
        for (let i = 0; i < 400; i++) {
          const pick = pickFresh(count, last, rand);
          expect(pick).toBeGreaterThanOrEqual(0);
          expect(pick).toBeLessThan(count);
          expect(pick).not.toBe(last);
          last = pick;
        }
      }
    }
  });

  it('holds when the source is stuck at either end', () => {
    for (const stuck of [0, 0.5, 0.999999, 1]) {
      let last = -1;
      for (let i = 0; i < 20; i++) {
        const pick = pickFresh(3, last, () => stuck);
        expect(pick).toBeGreaterThanOrEqual(0);
        expect(pick).toBeLessThan(3);
        expect(pick).not.toBe(last);
        last = pick;
      }
    }
  });

  it('reaches every variant', () => {
    const rand = soundRandom(7);
    const seen = new Set<number>();
    let last = -1;
    for (let i = 0; i < 200; i++) {
      last = pickFresh(4, last, rand);
      seen.add(last);
    }
    expect(seen.size).toBe(4);
  });

  it('has nothing to choose from when there is one variant', () => {
    expect(pickFresh(1, 0, () => 0.7)).toBe(0);
    expect(pickFresh(0, -1, () => 0.7)).toBe(0);
  });
});

describe('variety', () => {
  it('keeps the last pick of every sound apart', () => {
    const rand = soundRandom(3);
    const variety = new Variety();
    const last: Record<string, number> = { roll: -1, step: -1 };
    for (let i = 0; i < 300; i++) {
      const key = i % 3 === 0 ? 'step' : 'roll';
      const pick = variety.pick(key, 3, rand);
      expect(pick).not.toBe(last[key]);
      last[key] = pick;
    }
  });
});

describe('the numbers of the sound', () => {
  it('are the same for the same seed and stay in 0..1', () => {
    const a = soundRandom(42);
    const b = soundRandom(42);
    for (let i = 0; i < 100; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('spread a value to both sides and no further than asked', () => {
    const rand = soundRandom(5);
    let low = 0;
    let high = 0;
    for (let i = 0; i < 500; i++) {
      const value = spread(0.2, rand);
      expect(Math.abs(value)).toBeLessThanOrEqual(0.2);
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
    expect(low).toBeLessThan(-0.1);
    expect(high).toBeGreaterThan(0.1);
  });

  it('turn cents into a ratio', () => {
    expect(cents(0)).toBe(1);
    expect(cents(1200)).toBeCloseTo(2, 9);
    expect(cents(-1200)).toBeCloseTo(0.5, 9);
  });
});
