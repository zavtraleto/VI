import { describe, expect, it } from 'vitest';
import { Governor, QUALITY_STEPS } from './governor';

/** Runs `seconds` of frames `gap` milliseconds apart; returns how many times the step changed. */
function run(governor: Governor, gap: number, seconds: number, playing = true): number {
  let changes = 0;
  for (let t = 0; t < seconds * 1000; t += gap) if (governor.frame(gap, playing)) changes++;
  return changes;
}

describe('Governor', () => {
  it('keeps every sample while the frames are on time', () => {
    const governor = new Governor();
    run(governor, 1000 / 60, 5, false);
    expect(run(governor, 1000 / 60, 60)).toBe(0);
    expect(governor.samples).toBe(4);
  });

  it('gives samples up one step at a time under sixty frames a second, down to none', () => {
    const governor = new Governor();
    run(governor, 1000 / 60, 5, false);
    expect(run(governor, 1000 / 30, 8)).toBe(1);
    expect(governor.samples).toBe(2);
    run(governor, 1000 / 30, 60);
    expect(governor.samples).toBe(0);
    expect(governor.step).toBe(QUALITY_STEPS.length - 1);
  });

  it('gives up two samples first, then the light of the tube, then the rest of the smoothing', () => {
    const governor = new Governor();
    run(governor, 1000 / 60, 5, false);
    const seen: [number, boolean][] = [[governor.samples, governor.halo]];
    for (let t = 0; t < 60000; t += 1000 / 30) if (governor.frame(1000 / 30, true)) seen.push([governor.samples, governor.halo]);
    expect(seen).toEqual([
      [4, true],
      [2, true],
      [2, false],
      [0, false],
    ]);
  });

  it('gives up the first step only to reach the rate of a faster screen', () => {
    const governor = new Governor();
    // The menu runs at the 120 of the screen; the session at 60.
    run(governor, 1000 / 120, 5, false);
    run(governor, 1000 / 60, 60);
    expect(governor.samples).toBe(2);
    expect(governor.halo).toBe(true);
  });

  it('does not judge a screen that never shows more than thirty frames', () => {
    const governor = new Governor();
    run(governor, 1000 / 30, 5, false);
    expect(run(governor, 1000 / 30, 60)).toBe(0);
    expect(governor.samples).toBe(4);
  });

  it('judges only frames of play, and not the first of them', () => {
    const governor = new Governor();
    run(governor, 1000 / 60, 5, false);
    // Slow frames under a menu or a pause are not the board's doing.
    expect(run(governor, 1000 / 30, 30, false)).toBe(0);
    // A second and a half of slow play is within what is let pass after a start.
    expect(run(governor, 1000 / 30, 1.5)).toBe(0);
    expect(governor.samples).toBe(4);
  });

  it('takes a stumble for a stumble', () => {
    const governor = new Governor();
    run(governor, 1000 / 60, 5, false);
    for (let i = 0; i < 2000; i++) governor.frame(i % 50 === 0 ? 400 : 1000 / 60, true);
    expect(governor.samples).toBe(4);
  });

  it('starts from the step it is given', () => {
    expect(new Governor(1).samples).toBe(2);
    expect(new Governor(1).halo).toBe(true);
    expect(new Governor(2).halo).toBe(false);
    expect(new Governor(9).samples).toBe(0);
    expect(new Governor(-3).samples).toBe(4);
  });
});
