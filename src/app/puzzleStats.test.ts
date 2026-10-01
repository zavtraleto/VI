import { describe, expect, it } from 'vitest';
import type { PuzzleStat } from '../platform/settings';
import { puzzleReport, starsFor, twoStarLimit } from './puzzleStats';

describe('puzzle stars', () => {
  it('gives three stars for the fewest moves and never more than that', () => {
    expect(starsFor(5, 5)).toBe(3);
    expect(starsFor(4, 5)).toBe(3);
  });

  it('gives two stars within a small allowance that grows with the level', () => {
    expect(twoStarLimit(1)).toBe(3);
    expect(twoStarLimit(5)).toBe(7);
    expect(twoStarLimit(9)).toBe(12);
    expect(starsFor(7, 5)).toBe(2);
    expect(starsFor(6, 5)).toBe(2);
  });

  it('gives one star for any other clear', () => {
    expect(starsFor(8, 5)).toBe(1);
    expect(starsFor(40, 5)).toBe(1);
  });
});

describe('puzzle report', () => {
  const stat = (over: Partial<PuzzleStat>): PuzzleStat => ({
    tries: 1,
    undos: 0,
    dead: 0,
    playMs: 0,
    firstMoves: null,
    firstSec: null,
    best: null,
    ...over,
  });
  const levels = [
    { id: 'a', par: 2 },
    { id: 'b', par: 5 },
    { id: 'c', par: 7 },
  ];

  it('lists only the levels that were played, by number', () => {
    const text = puzzleReport(levels, {
      a: stat({ firstMoves: 2, firstSec: 14, best: 2, playMs: 14000 }),
      c: stat({ tries: 3, undos: 11, dead: 2, playMs: 187400 }),
    });
    const lines = text.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('1. par 2: first 2 in 14s, best 2, tries 1, undos 0, dead ends 0');
    expect(lines[2]).toBe('3. par 7: not cleared, 187s, tries 3, undos 11, dead ends 2');
  });

  it('is empty when nothing has been played', () => {
    expect(puzzleReport(levels, {})).toBe('');
  });
});
