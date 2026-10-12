import { describe, expect, it } from 'vitest';
import { PRAISE, praiseWord } from './praise';

describe('the word over a chain of a level', () => {
  it('has many words for every step, none of them twice, none longer than nine signs', () => {
    const all = PRAISE.flat();
    expect(new Set(all).size).toBe(all.length);
    for (const step of PRAISE) expect(step.length).toBeGreaterThanOrEqual(12);
    for (const word of all) {
      expect(word.length).toBeLessThanOrEqual(9);
      expect(word).toMatch(/^[A-Z ]+$/);
    }
  });

  it('is of the step the chain has reached, the last step for every chain past it', () => {
    for (const random of [0, 0.3, 0.999]) {
      expect(PRAISE[0]).toContain(praiseWord(2, random));
      expect(PRAISE[2]).toContain(praiseWord(4, random));
      expect(PRAISE[4]).toContain(praiseWord(6, random));
      expect(PRAISE[4]).toContain(praiseWord(30, random));
      expect(PRAISE[0]).toContain(praiseWord(1, random));
    }
  });

  it('is never the word said before', () => {
    for (const last of PRAISE[1]) for (let i = 0; i < 20; i++) expect(praiseWord(3, i / 20, last)).not.toBe(last);
  });
});
