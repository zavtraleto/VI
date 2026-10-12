import { describe, expect, it } from 'vitest';
import { DRONE_TONES, droneChoices, droneShift, droneStart } from './drone';
import { MODES } from './scale';
import { soundRandom } from './variation';

/** The intervals over the root the air may stand on, within an octave. */
const AT_REST = [0, 3, 4, 5, 7];

describe('the air of a level', () => {
  it('stands only on degrees of the mode that are at rest with the root', () => {
    for (const steps of Object.values(MODES)) {
      const choices = droneChoices(steps);
      expect(choices.length).toBeGreaterThan(1);
      for (const semis of choices) {
        expect(AT_REST).toContain(semis % 12);
        expect([...steps, 12]).toContain(semis);
      }
    }
    // The in: the fourth, the fifth and the octave. Its two semitones are left to the dice.
    expect(droneChoices(MODES.in)).toEqual([5, 7, 12]);
  });

  it('begins on the root and the fifth over it, its fixed tones on the root', () => {
    const start = droneStart(MODES.in);
    expect(start).toHaveLength(DRONE_TONES.length);
    DRONE_TONES.forEach((tone, index) => {
      if (tone.fixed) expect(start[index]).toBe(0);
    });
    expect(start).toContain(7);
  });

  it('changes one moving tone at a time, to another degree at rest, and never moves a fixed one', () => {
    for (const steps of Object.values(MODES)) {
      const rand = soundRandom(7);
      let at = droneStart(steps);
      const choices = droneChoices(steps);
      for (let i = 0; i < 200; i++) {
        const { tone, semis } = droneShift(at, steps, rand);
        expect(DRONE_TONES[tone].fixed).toBe(false);
        expect(choices).toContain(semis);
        expect(semis).not.toBe(at[tone]);
        at = at.map((was, index) => (index === tone ? semis : was));
      }
    }
  });

  it('never has all its tones breathe together: some breathe out while others breathe in, each at its own pace', () => {
    expect(DRONE_TONES.some((tone) => tone.depth > 0) && DRONE_TONES.some((tone) => tone.depth < 0)).toBe(true);
    expect(new Set(DRONE_TONES.map((tone) => tone.breath)).size).toBe(DRONE_TONES.length);
    for (const tone of DRONE_TONES) expect(Math.abs(tone.depth)).toBeLessThanOrEqual(0.5);
  });
});
