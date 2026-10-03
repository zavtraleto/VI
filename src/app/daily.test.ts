import { describe, expect, it } from 'vitest';
import { dailyValue, dayAt, readDailyValue } from './daily';

describe('the session of the day', () => {
  it('has one seed for a whole day of UTC, and another the next day', () => {
    const morning = dayAt(Date.UTC(2026, 9, 3, 0, 0, 1));
    const night = dayAt(Date.UTC(2026, 9, 3, 23, 59, 59));
    const next = dayAt(Date.UTC(2026, 9, 4, 0, 0, 0));
    expect(morning.date).toBe('2026-10-03');
    expect(night).toEqual(morning);
    expect(next.date).toBe('2026-10-04');
    expect(next.index).toBe(morning.index + 1);
    expect(next.seed).not.toBe(morning.seed);
  });

  it('deals seeds that are whole numbers of 32 bits and do not repeat over the years', () => {
    const seeds = new Set<number>();
    for (let day = 0; day < 3650; day++) {
      const { seed } = dayAt(Date.UTC(2026, 0, 1) + day * 86_400_000);
      expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff).toBe(true);
      seeds.add(seed);
    }
    expect(seeds.size).toBe(3650);
  });
});

describe('the table of the day', () => {
  const today = dayAt(Date.UTC(2026, 9, 3)).index;

  it('keeps a score with its day and gives both back', () => {
    expect(readDailyValue(dailyValue(today, 1450))).toEqual({ day: today, score: 1450 });
    expect(readDailyValue(dailyValue(today, 0))).toEqual({ day: today, score: 0 });
  });

  it('puts any score of today above every score of the days before', () => {
    expect(dailyValue(today, 0)).toBeGreaterThan(dailyValue(today - 1, 999_999));
    expect(dailyValue(today, 500)).toBeGreaterThan(dailyValue(today, 499));
  });

  it('never lets a score run over into the next day', () => {
    expect(readDailyValue(dailyValue(today, 5_000_000))).toEqual({ day: today, score: 999_999 });
    expect(readDailyValue(dailyValue(today, -3)).score).toBe(0);
  });

  it('fits a whole number of 32 bits for years', () => {
    expect(dailyValue(dayAt(Date.UTC(2031, 0, 1)).index, 999_999)).toBeLessThan(2 ** 31);
  });
});
