import { describe, expect, it } from 'vitest';
import { BOARD_TEXTS } from './boardFiles';
import { CROWD, OWNER_PLAYS, spearman } from './players';

describe('what people did on the boards', () => {
  it('names boards that are there, each once', () => {
    const codes = [...CROWD.map((b) => b.code), ...OWNER_PLAYS.map((p) => p.code)];
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(BOARD_TEXTS.has(code), code).toBe(true);
  });

  it('holds counts that agree with themselves', () => {
    for (const b of CROWD) {
      expect(b.passed, b.code).toBeLessThanOrEqual(b.began);
      expect(b.failedPlayers, b.code).toBeLessThanOrEqual(b.failures);
      expect(b.began, b.code).toBeGreaterThanOrEqual(10);
    }
    for (const p of OWNER_PLAYS) expect(p.moves, p.code).toBeGreaterThanOrEqual(p.par);
  });

  it('ranks as Spearman does, ties by their mean', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 1, 2, 3], [1, 2, 3, 4])).toBeCloseTo(0.9487, 3);
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});
