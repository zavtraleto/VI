import { describe, expect, it } from 'vitest';
import {
  BOOST_MS,
  CONTACT_LINES,
  CONTACT_STEPS,
  Ritual,
  STAGE_TRANSITION_MS,
  lineLevel,
  nextThreshold,
  stageForScore,
} from './ritual';

const LAST = CONTACT_STEPS[CONTACT_STEPS.length - 1].score;

describe('contact steps', () => {
  it('rise in score, and every line has a step', () => {
    const scores = CONTACT_STEPS.map((step) => step.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
    expect(new Set(scores).size).toBe(scores.length);
    for (const line of CONTACT_LINES) {
      expect(CONTACT_STEPS.some((step) => step.line === line)).toBe(true);
    }
  });

  it('maps score to stage at the thresholds', () => {
    CONTACT_STEPS.forEach((step, i) => {
      expect(stageForScore(step.score - 1)).toBe(i);
      expect(stageForScore(step.score)).toBe(i + 1);
    });
    expect(stageForScore(0)).toBe(0);
    expect(stageForScore(999999)).toBe(CONTACT_STEPS.length);
  });

  it('names the next threshold until the last stage', () => {
    expect(nextThreshold(0)).toBe(CONTACT_STEPS[0].score);
    expect(nextThreshold(CONTACT_STEPS[0].score)).toBe(CONTACT_STEPS[1].score);
    expect(nextThreshold(LAST - 1)).toBe(LAST);
    expect(nextThreshold(LAST)).toBeNull();
  });

  it('counts the steps of a line that lie under a depth', () => {
    const first = CONTACT_STEPS[0].line;
    expect(lineLevel(first, 0)).toBe(0);
    expect(lineLevel(first, 0.5)).toBeCloseTo(0.5);
    expect(lineLevel(first, 1)).toBe(1);
    const all = CONTACT_LINES.reduce((sum, line) => sum + lineLevel(line, CONTACT_STEPS.length), 0);
    expect(all).toBe(CONTACT_STEPS.length);
  });
});

describe('ritual', () => {
  it('fires each stage once and eases its line in', () => {
    const r = new Ritual();
    const { score, line } = CONTACT_STEPS[0];
    expect(r.update(score - 50, 16)).toEqual([]);
    expect(r.update(score + 20, 16)).toEqual([1]);
    expect(r.update(score + 30, 16)).toEqual([]);
    expect(r.look[line]).toBeGreaterThan(0);
    expect(r.look[line]).toBeLessThan(1);
    r.update(score + 30, STAGE_TRANSITION_MS);
    expect(r.look[line]).toBe(1);
    expect(r.look[CONTACT_STEPS[1].line]).toBe(0);
  });

  it('reports every stage crossed by one big jump', () => {
    const r = new Ritual();
    expect(r.update(CONTACT_STEPS[2].score, 16)).toEqual([1, 2, 3]);
    expect(r.stage).toBe(3);
  });

  it('starts a peak at the final stage that fades out', () => {
    const r = new Ritual();
    r.update(LAST, 0);
    expect(r.look.peak).toBe(1);
    r.update(LAST, 5000);
    expect(r.look.peak).toBe(0);
    expect(r.update(LAST + 2000, 16)).toEqual([]);
  });

  it('is lifted by a chain for a while, and comes back', () => {
    const r = new Ritual();
    const second = CONTACT_STEPS[1].line;
    r.update(CONTACT_STEPS[0].score, STAGE_TRANSITION_MS);
    expect(r.look[second]).toBe(0);
    // A group alone lifts nothing.
    r.send(4, 1);
    r.update(CONTACT_STEPS[0].score, 100);
    expect(r.look[second]).toBe(0);
    r.send(4, 3);
    r.update(CONTACT_STEPS[0].score, 100);
    expect(r.look[second]).toBeGreaterThan(0);
    for (let t = 0; t < BOOST_MS * 4; t += 100) r.update(CONTACT_STEPS[0].score, 100);
    expect(r.look[second]).toBe(0);
    expect(r.stage).toBe(1);
  });

  it('turns the picture over for a long chain made past the last step', () => {
    const r = new Ritual();
    r.update(LAST, 5000);
    r.send(5, 2);
    expect(r.look.peak).toBe(0);
    r.send(5, 3);
    expect(r.look.peak).toBe(1);
  });

  it('knows the channel sent most', () => {
    const r = new Ritual();
    expect(r.look.channel).toBe(0);
    r.send(3, 1);
    expect(r.look.channel).toBe(3);
    r.send(5, 1);
    expect(r.look.channel).toBe(3);
    r.send(5, 2);
    expect(r.look.channel).toBe(5);
  });

  it('resets for a new run', () => {
    const r = new Ritual();
    r.send(2, 4);
    r.update(LAST, 2000);
    r.reset();
    expect(r.stage).toBe(0);
    expect(r.look).toEqual({ grid: 0, dice: 0, backdrop: 0, screen: 0, program: 0, red: 0, peak: 0, channel: 0 });
    expect(r.update(0, 16)).toEqual([]);
  });
});
