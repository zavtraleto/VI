import { describe, expect, it } from 'vitest';
import { BANDS, RANK_BASE, bandOf, difficulty } from './scale';

/**
 * The scale of difficulty and the bands of the decades (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md,
 * sections 6, 7 and 12): one number of a board from its measures, and the numbers each ten places of the row are to have.
 */

describe('the difficulty of a board', () => {
  it('starts at the base of the depth a player has to think', () => {
    expect(RANK_BASE).toEqual({ 1: 2, 2: 3.5, 3: 5.5, 5: 7, 8: 9.5 });
    expect(difficulty({ rank: 1, forks: 0, hidden: 0, lossAt: null, par: 3 })).toBe(2);
    expect(difficulty({ rank: 2, forks: 3, hidden: 1, lossAt: 4, par: 5 })).toBe(3.5);
  });

  it('is 10 where no player clears the board', () => expect(difficulty({ rank: null, forks: 0, hidden: 0, lossAt: null, par: 0 })).toBe(10));

  it('adds the forks, the hidden dice, an early trap and a long way, and stops at 10', () => {
    // 7 + 2 (forks, capped) + 0.5 (hidden, capped) + 0.5 (lost on the first move) + 1.5 (seven moves over five) = 11.5.
    expect(difficulty({ rank: 5, forks: 20, hidden: 3, lossAt: 1, par: 12 })).toBe(10);
    // 5.5 + 0.5 (two forks over three) − 0.5 (lost only after the fifth move); a move over five adds nothing.
    expect(difficulty({ rank: 3, forks: 5, hidden: 1, lossAt: 7, par: 6 })).toBe(5.5);
  });

  it('counts each part as section 12 of the spec says it', () => {
    const base = { rank: 1, forks: 0, hidden: 0, lossAt: null, par: 3 } as const;
    // A quarter for each fork over three, up to 2; a quarter left over goes up to the half.
    expect(difficulty({ ...base, forks: 3 })).toBe(2);
    expect(difficulty({ ...base, forks: 4 })).toBe(2.5);
    expect(difficulty({ ...base, forks: 5 })).toBe(2.5);
    expect(difficulty({ ...base, forks: 11 })).toBe(4);
    expect(difficulty({ ...base, forks: 30 })).toBe(4);
    // A half where more than one die hides its goal face, and no more.
    expect(difficulty({ ...base, hidden: 1 })).toBe(2);
    expect(difficulty({ ...base, hidden: 2 })).toBe(2.5);
    expect(difficulty({ ...base, hidden: 5 })).toBe(2.5);
    // A half where the board is lost on the first or second move, a half less where only after the fifth.
    expect(difficulty({ ...base, lossAt: 2 })).toBe(2.5);
    expect(difficulty({ ...base, lossAt: 3 })).toBe(2);
    expect(difficulty({ ...base, lossAt: 6 })).toBe(1.5);
    // A half for every two moves over five.
    expect(difficulty({ ...base, par: 6 })).toBe(2);
    expect(difficulty({ ...base, par: 7 })).toBe(2.5);
    expect(difficulty({ ...base, par: 8 })).toBe(2.5);
    expect(difficulty({ ...base, par: 9 })).toBe(3);
  });

  it('gives the boards of the calibration the D of section 12', () => {
    // C2-05, tight-room-1, finale-1 and two-combos-3 as the cache of the row measured them on 28 October 2026.
    expect(difficulty({ rank: 5, forks: 1, hidden: 2, lossAt: 2, par: 5 })).toBe(8);
    expect(difficulty({ rank: 3, forks: 5, hidden: 3, lossAt: 1, par: 6 })).toBe(7);
    expect(difficulty({ rank: 3, forks: 20, hidden: 0, lossAt: 4, par: 8 })).toBe(8);
    expect(difficulty({ rank: 2, forks: 10, hidden: 2, lossAt: 2, par: 5 })).toBe(6.5);
  });

  it('is 1.5 at the lowest it reaches: the easiest board, lost only late', () => expect(difficulty({ rank: 1, forks: 0, hidden: 0, lossAt: 9, par: 2 })).toBe(1.5));

  it('is a whole number or a half', () => {
    for (const rank of [1, 2, 3, 5, 8, null]) {
      for (let forks = 0; forks < 12; forks++) {
        for (const lossAt of [null, 1, 3, 6]) {
          const d = difficulty({ rank, forks, hidden: forks % 3, lossAt, par: 3 + forks });
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
