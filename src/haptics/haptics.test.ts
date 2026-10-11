import { describe, expect, it } from 'vitest';
import { Haptics, PULSES, hapticScale, pulseOfBeat, pulseOfEvent, scaled } from './haptics';

describe('haptics', () => {
  it('answers only dice that leave', () => {
    expect(pulseOfBeat({ kind: 'match' })).toBe('combo');
    expect(pulseOfBeat({ kind: 'chain' })).toBe('link');
    for (const kind of ['one', 'step', 'level', 'peak']) expect(pulseOfBeat({ kind })).toBeNull();
    expect(pulseOfEvent({ type: 'cleared' })).toBe('passed');
    expect(pulseOfEvent({ type: 'levelPassed' })).toBe('passed');
    expect(pulseOfEvent({ type: 'deadEnd' } as never)).toBeNull();
    expect(pulseOfEvent({ type: 'gameOver' } as never)).toBeNull();
  });

  it('keeps every tick short', () => {
    for (const pulse of Object.values(PULSES)) {
      pulse.forEach((ms, index) => {
        if (index % 2 === 0) expect(ms).toBeLessThanOrEqual(10);
      });
    }
  });

  it('scales ticks and not rests', () => {
    expect(scaled([8, 70, 8], 2)).toEqual([16, 70, 16]);
    expect(scaled([8], 100)).toEqual([40]);
  });

  it('reads the address', () => {
    expect(hapticScale('')).toBe(1);
    expect(hapticScale('?haptic=off')).toBe(0);
    expect(hapticScale('?haptic=2')).toBe(2);
    expect(hapticScale('?haptic=nonsense')).toBe(1);
  });

  it('is not cut short by a lesser pulse, and gives way to a greater one', () => {
    const felt: number[][] = [];
    let now = 0;
    const haptics = new Haptics(1, (pattern) => (felt.push(pattern), true), () => now);
    haptics.play('link');
    now = 40;
    haptics.play('combo');
    expect(felt).toEqual([[8, 70, 8]]);
    haptics.play('passed');
    expect(felt).toHaveLength(2);
    now = 1000;
    haptics.play('combo');
    expect(felt[2]).toEqual([8]);
  });

  it('is silent where there is no motor, when it is off, and when the browser says no', () => {
    expect(() => new Haptics(1, null).play('combo')).not.toThrow();
    const felt: number[][] = [];
    new Haptics(0, (pattern) => (felt.push(pattern), true)).play('combo');
    expect(felt).toEqual([]);
    let now = 0;
    const refused = new Haptics(1, () => false, () => now);
    refused.play('passed');
    const calls: number[][] = [];
    const after = new Haptics(1, (pattern) => (calls.push(pattern), calls.length > 1), () => now);
    after.play('passed');
    now = 10;
    after.play('combo');
    expect(calls).toHaveLength(2);
  });
});
