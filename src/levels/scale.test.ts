import { describe, expect, it } from 'vitest';
import { BANDS, RANK_BASE, bandOf, difficulty } from './scale';

/**
 * The scale of difficulty and the bands of the decades (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md,
 * sections 6 and 7): one number of a board from its measures, and the numbers each ten places of the row are to have.
 */

describe('the difficulty of a board', () => {
  it('starts at the base of the depth a player has to think', () => {
    expect(RANK_BASE).toEqual({ 1: 1.5, 2: 3.5, 3: 5.5, 5: 7.5, 8: 9.5 });
    expect(difficulty({ rank: 1, forks: 0, hidden: 0, lossAt: null, par: 3 })).toBe(1.5);
    expect(difficulty({ rank: 2, forks: 2, hidden: 1, lossAt: 4, par: 8 })).toBe(3.5);
  });

  it('is 10 where no player clears the board', () => expect(difficulty({ rank: null, forks: 0, hidden: 0, lossAt: null, par: 0 })).toBe(10));

  it('adds the forks, the hidden dice, an early trap and a long way, and stops at 10', () => {
    // 7.5 + 2 (forks, capped) + 1 (hidden, capped) + 1 (lost on the first move) + 1 (four moves over eight) = 12.5.
    expect(difficulty({ rank: 5, forks: 6, hidden: 3, lossAt: 1, par: 12 })).toBe(10);
    // 5.5 + 0.5 (a fork over two) − 0.5 (lost only after the fifth move); a move over eight adds nothing.
    expect(difficulty({ rank: 3, forks: 3, hidden: 1, lossAt: 7, par: 9 })).toBe(5.5);
  });

  it('counts each part as the spec says it', () => {
    const base = { rank: 1, forks: 0, hidden: 0, lossAt: null, par: 3 } as const;
    expect(difficulty({ ...base, forks: 4 })).toBe(2.5);
    expect(difficulty({ ...base, forks: 9 })).toBe(3.5);
    expect(difficulty({ ...base, hidden: 2 })).toBe(2);
    expect(difficulty({ ...base, hidden: 5 })).toBe(2.5);
    expect(difficulty({ ...base, lossAt: 2 })).toBe(2.5);
    expect(difficulty({ ...base, lossAt: 3 })).toBe(1.5);
    expect(difficulty({ ...base, lossAt: 6 })).toBe(1);
    expect(difficulty({ ...base, par: 10 })).toBe(2);
    expect(difficulty({ ...base, par: 11 })).toBe(2);
  });

  it('never falls under 1', () => expect(difficulty({ rank: 1, forks: 0, hidden: 0, lossAt: 9, par: 2 })).toBe(1));

  it('is a whole number or a half', () => {
    for (const rank of [1, 2, 3, 5, 8, null]) {
      for (let forks = 0; forks < 8; forks++) {
        for (const lossAt of [null, 1, 3, 6]) {
          const d = difficulty({ rank, forks, hidden: forks % 3, lossAt, par: 3 + forks * 2 });
          expect(d * 2).toBe(Math.round(d * 2));
          expect(d).toBeGreaterThanOrEqual(1);
          expect(d).toBeLessThanOrEqual(10);
        }
      }
    }
  });
});

describe('the bands of the decades', () => {
  it('holds the table of section 7 from the 31st place', () => {
    expect(BANDS.map((band) => [band.from, band.to, band.lo, band.hi, ...band.peak])).toEqual([
      [31, 40, 3, 4, 5, 5],
      [41, 50, 4, 5, 6, 6],
      [51, 60, 5, 6, 7, 7],
      [61, 70, 6, 7, 8, 8],
      [71, 80, 7, 8, 8, 9],
      [81, 90, 7, 9, 9, 9],
      [91, 100, 8, 9, 10, 10],
    ]);
  });

  it('finds the band of a place, and none before the 31st', () => {
    expect(bandOf(30)).toBeNull();
    expect(bandOf(1)).toBeNull();
    expect(bandOf(55)).toEqual({ from: 51, to: 60, lo: 5, hi: 6, peak: [7, 7] });
    expect(bandOf(31)?.from).toBe(31);
    expect(bandOf(100)?.from).toBe(91);
    expect(bandOf(101)).toBeNull();
  });
});
