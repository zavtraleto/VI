import { describe, expect, it } from 'vitest';
import { bootFrame, bootLength, type BootOptions, type BootTiming } from './bootScript';

const timing: BootTiming = { totalMs: 6000, shortMs: 1200, darkMs: 400, linkMs: 1100, logoMs: 1500, fadeMs: 160 };
const first: BootOptions = { first: true, reduced: false, rows: 5 };
const later: BootOptions = { first: false, reduced: false, rows: 5 };
/** One step of the check with these numbers: (6000 - 400 - 1100 - 1500) / 8. */
const STEP = 375;

describe('the first boot', () => {
  it('takes as long as it is told to', () => {
    expect(bootLength(timing, first)).toBe(6000);
    expect(bootFrame(5999, timing, first).done).toBe(false);
    expect(bootFrame(6000, timing, first).done).toBe(true);
  });

  it('starts on a dark, empty screen', () => {
    const frame = bootFrame(399, timing, first);
    expect(frame).toMatchObject({ labels: 0, values: 0, tail: false, light: 0, logo: 0 });
  });

  it('writes the check line by line, each line answering a little after it appears', () => {
    expect(bootFrame(400, timing, first)).toMatchObject({ labels: 1, values: 0 });
    expect(bootFrame(400 + STEP * 0.5, timing, first)).toMatchObject({ labels: 1, values: 1 });
    expect(bootFrame(400 + STEP, timing, first)).toMatchObject({ labels: 2, values: 1 });
    expect(bootFrame(400 + STEP * 3.5, timing, first)).toMatchObject({ labels: 4, values: 4 });
  });

  it('waits for the link device before saying it is not there', () => {
    const asked = 400 + STEP * 4;
    expect(bootFrame(asked, timing, first)).toMatchObject({ labels: 5, values: 4 });
    // Any other line would have answered by now.
    expect(bootFrame(asked + STEP, timing, first)).toMatchObject({ labels: 5, values: 4, tail: false });
    const answered = asked + STEP * 0.45 + 1100;
    expect(bootFrame(answered - 1, timing, first).values).toBe(4);
    expect(bootFrame(answered, timing, first).values).toBe(5);
  });

  it('adds the last line after the check and then clears the screen for the logo', () => {
    const tail = 400 + STEP * 6 + 1100;
    expect(bootFrame(tail - 1, timing, first).tail).toBe(false);
    expect(bootFrame(tail, timing, first)).toMatchObject({ labels: 5, values: 5, tail: true, light: 0 });
    const logo = 4500;
    expect(bootFrame(logo - 1, timing, first)).toMatchObject({ tail: true, logo: 0 });
    expect(bootFrame(logo + 80, timing, first)).toMatchObject({ labels: 0, tail: false, light: 0.5, logo: 0.5 });
    expect(bootFrame(logo + 160, timing, first)).toMatchObject({ light: 1, logo: 1, done: false });
  });

  it('never takes back what it has shown before the logo', () => {
    let labels = 0;
    let values = 0;
    for (let t = 0; t < 4500; t += 10) {
      const frame = bootFrame(t, timing, first);
      expect(frame.labels).toBeGreaterThanOrEqual(labels);
      expect(frame.values).toBeGreaterThanOrEqual(values);
      expect(frame.values).toBeLessThanOrEqual(frame.labels);
      labels = frame.labels;
      values = frame.values;
    }
  });

  it('shows the whole check at once with reduced motion', () => {
    const reduced = { ...first, reduced: true };
    expect(bootFrame(0, timing, reduced)).toMatchObject({ labels: 5, values: 5, tail: true, light: 0 });
    expect(bootFrame(1500, timing, reduced)).toMatchObject({ labels: 0, light: 1, logo: 1, done: false });
    expect(bootFrame(bootLength(timing, reduced), timing, reduced).done).toBe(true);
    expect(bootLength(timing, reduced)).toBe(3000);
  });

  it('still runs when the parts are longer than the whole', () => {
    const tight = { ...timing, totalMs: 2500 };
    expect(bootLength(tight, first)).toBeGreaterThan(2500);
    expect(bootFrame(bootLength(tight, first) - 1, tight, first)).toMatchObject({ logo: 1, done: false });
  });
});

describe('a later boot', () => {
  it('is the logo and one line, on the light screen from the start', () => {
    expect(bootLength(timing, later)).toBe(1200);
    expect(bootFrame(0, timing, later)).toMatchObject({ labels: 0, light: 1, logo: 0, line: false, done: false });
    expect(bootFrame(160, timing, later)).toMatchObject({ logo: 1, line: false });
    expect(bootFrame(300, timing, later).line).toBe(true);
    expect(bootFrame(1200, timing, later).done).toBe(true);
  });

  it('shows everything at once with reduced motion', () => {
    expect(bootFrame(0, timing, { ...later, reduced: true })).toMatchObject({ logo: 1, line: true, done: false });
  });
});
