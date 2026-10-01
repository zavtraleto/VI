import { describe, expect, it } from 'vitest';
import { Ritual, STAGE_TRANSITION_MS, nextThreshold, stageForScore } from './ritual';

describe('ritual stages', () => {
  it('maps score to stage at the thresholds', () => {
    expect([0, 99, 100, 299, 300, 699, 700, 1499, 1500, 2999, 3000, 99999].map(stageForScore)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
  });

  it('names the next threshold until the last stage', () => {
    expect(nextThreshold(0)).toBe(100);
    expect(nextThreshold(100)).toBe(300);
    expect(nextThreshold(2999)).toBe(3000);
    expect(nextThreshold(3000)).toBeNull();
  });

  it('fires each stage once and eases it in', () => {
    const r = new Ritual();
    expect(r.update(50, 16)).toEqual([]);
    expect(r.update(120, 16)).toEqual([1]);
    expect(r.update(130, 16)).toEqual([]);
    expect(r.levels[0]).toBeGreaterThan(0);
    expect(r.levels[0]).toBeLessThan(1);
    r.update(130, STAGE_TRANSITION_MS);
    expect(r.levels[0]).toBe(1);
    expect(r.levels[1]).toBe(0);
  });

  it('reports every stage crossed by one big jump', () => {
    const r = new Ritual();
    expect(r.update(800, 16)).toEqual([1, 2, 3]);
    expect(r.stage).toBe(3);
  });

  it('starts a phase shift at the final stage that fades out', () => {
    const r = new Ritual();
    r.update(3000, 0);
    expect(r.phaseShift).toBe(1);
    r.update(3000, 5000);
    expect(r.phaseShift).toBe(0);
    expect(r.update(5000, 16)).toEqual([]);
  });

  it('resets for a new run', () => {
    const r = new Ritual();
    r.update(3000, 2000);
    r.reset();
    expect(r.stage).toBe(0);
    expect(r.levels.every((v) => v === 0)).toBe(true);
    expect(r.update(0, 16)).toEqual([]);
  });
});
