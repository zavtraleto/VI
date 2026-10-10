import { describe, expect, it } from 'vitest';
import { Later } from './later';

/** Frames of a roll: a fifth of a second on a screen of 60 a second. */
const ROLL_FRAMES = 12;

describe('what is owed after a move', () => {
  it('is reported once, after the move of the first action has ended, and not on its frame', () => {
    const later = new Later();
    const said: string[] = [];
    // The first action: the start is put by on the tick the move begins.
    later.after(() => said.push('started'));
    for (let frame = 0; frame < ROLL_FRAMES; frame++) {
      later.frame(true);
      expect(said).toEqual([]);
    }
    // The frame the die lands on is left alone as well.
    later.frame(false);
    expect(said).toEqual([]);
    later.frame(false);
    expect(said).toEqual(['started']);
    for (let frame = 0; frame < 100; frame++) later.frame(frame % 3 === 0);
    expect(said).toEqual(['started']);
    expect(later.owed).toBe(0);
  });

  it('waits through moves made one after another', () => {
    const later = new Later();
    let said = 0;
    later.after(() => said++);
    for (let move = 0; move < 5; move++) {
      for (let frame = 0; frame < ROLL_FRAMES; frame++) later.frame(true);
      later.frame(false);
    }
    expect(said).toBe(0);
    later.frame(false);
    expect(said).toBe(1);
  });

  it('pays at once and in order when the page is hidden, and not a second time', () => {
    const later = new Later();
    const done: string[] = [];
    later.after(() => done.push('started'));
    later.after(() => done.push('settings 1'), 'settings');
    later.after(() => done.push('settings 2'), 'settings');
    later.frame(true);
    later.flush();
    // A write of the settings put by twice is one write, of the settings as they are last.
    expect(done).toEqual(['started', 'settings 2']);
    later.flush();
    later.frame(false);
    later.frame(false);
    expect(done).toEqual(['started', 'settings 2']);
  });

  it('goes on past a thing that fails', () => {
    const later = new Later();
    let done = 0;
    later.after(() => {
      throw new Error('no platform');
    });
    later.after(() => done++);
    expect(() => later.flush()).not.toThrow();
    expect(done).toBe(1);
  });
});
