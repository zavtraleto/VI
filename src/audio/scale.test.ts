import { describe, expect, it } from 'vitest';
import { soundDefaults } from './params';
import { COMMA, MODES, MODE_NAMES, chainDegree, degreeHz, faceDegree, foldUnder, hertz, semitones, tuning } from './scale';

describe('modes', () => {
  it('has the four of the list, the in first', () => {
    expect(MODE_NAMES).toEqual(['in', 'hirajoshi', 'pentatonic', 'minor']);
    expect(MODES.in).toEqual([0, 1, 5, 7, 8]);
  });

  it('goes on through the octaves, up and down', () => {
    expect(semitones(MODES.in, 0)).toBe(0);
    expect(semitones(MODES.in, 4)).toBe(8);
    expect(semitones(MODES.in, 5)).toBe(12);
    expect(semitones(MODES.in, 6)).toBe(13);
    expect(semitones(MODES.in, 11)).toBe(25);
    expect(semitones(MODES.in, -1)).toBe(-4);
    expect(semitones(MODES.in, -5)).toBe(-12);
  });
});

describe('the notes of the faces', () => {
  it('are six notes that rise, in every mode', () => {
    for (const name of MODE_NAMES) {
      const steps = MODES[name];
      const notes = [1, 2, 3, 4, 5, 6].map((face) => semitones(steps, faceDegree(steps, face)));
      expect(new Set(notes).size).toBe(6);
      expect([...notes].sort((a, b) => a - b)).toEqual(notes);
    }
  });

  it('take the degrees of the in one after another', () => {
    const notes = [1, 2, 3, 4, 5, 6].map((face) => semitones(MODES.in, faceDegree(MODES.in, face)));
    expect(notes).toEqual([0, 1, 5, 7, 8, 12]);
  });

  it('make the six the octave of the one, in every mode', () => {
    for (const name of MODE_NAMES) {
      const tune = tuning(name, 'A', 3);
      const one = degreeHz(tune, faceDegree(tune.steps, 1));
      const six = degreeHz(tune, faceDegree(tune.steps, 6));
      expect(six / one).toBeCloseTo(2, 9);
    }
  });
});

describe('the ladder of a chain', () => {
  it('starts on the note of the face and goes a degree up with every link', () => {
    for (const name of MODE_NAMES) {
      const steps = MODES[name];
      for (let face = 1; face <= 6; face++) {
        expect(chainDegree(steps, face, 1)).toBe(faceDegree(steps, face));
        for (let chain = 1; chain < 12; chain++) {
          const here = semitones(steps, chainDegree(steps, face, chain));
          const next = semitones(steps, chainDegree(steps, face, chain + 1));
          expect(next).toBeGreaterThan(here);
        }
      }
    }
  });

  it('runs on past the octave', () => {
    expect(semitones(MODES.in, chainDegree(MODES.in, 1, 6))).toBe(12);
    expect(semitones(MODES.in, chainDegree(MODES.in, 6, 6))).toBe(24);
  });
});

describe('frequencies', () => {
  it('puts the A of the fourth octave at 440', () => {
    expect(hertz(69)).toBeCloseTo(440, 9);
    expect(tuning('in', 'A', 4).root).toBe(69);
    expect(degreeHz(tuning('in', 'A', 3), 0)).toBeCloseTo(220, 9);
    expect(degreeHz(tuning('in', 'A', 3), 0, 1)).toBeCloseTo(440, 9);
    expect(degreeHz(tuning('in', 'C', 4), 0)).toBeCloseTo(261.6256, 3);
  });

  it('takes the first mode and the A for names it does not know', () => {
    expect(tuning('nothing', 'H', 3)).toEqual(tuning('in', 'A', 3));
  });

  it('stands off concert pitch by as many cents as it is told', () => {
    expect(degreeHz(tuning('in', 'A', 3, 100), 0)).toBeCloseTo(hertz(58), 9);
    expect(degreeHz(tuning('in', 'A', 3, -50), 0, 1) / degreeHz(tuning('in', 'A', 3), 0, 1)).toBeCloseTo(2 ** (-50 / 1200), 9);
  });

  it('is tuned, as the program has it, from the line-up tone of the test card: the octaves of its root fall on 1 kHz', () => {
    const values = soundDefaults();
    const tune = tuning(String(values.mode), String(values.root), Number(values.octave), Number(values.fine));
    expect(degreeHz(tune, 0, 2)).toBeCloseTo(1000, 0);
    // The six of the bells is that tone itself.
    expect(degreeHz(tune, faceDegree(tune.steps, 6), Number(values.bellOctave))).toBeCloseTo(1000, 0);
  });

  it('keeps the other side a septimal comma away: six doublings against seven times nine', () => {
    expect(COMMA).toBeCloseTo(2 ** 6 / (7 * 9), 12);
    expect(1200 * Math.log2(COMMA)).toBeCloseTo(27.26, 2);
  });

  it('folds a degree that is too high down by octaves, and keeps its note', () => {
    const steps = MODES.in;
    expect(foldUnder(steps, 3, 24)).toBe(3);
    expect(foldUnder(steps, 12, 24)).toBe(7);
    expect(semitones(steps, foldUnder(steps, 23, 24))).toBeLessThanOrEqual(24);
    expect((semitones(steps, 23) - semitones(steps, foldUnder(steps, 23, 24))) % 12).toBe(0);
  });
});
