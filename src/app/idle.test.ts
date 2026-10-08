import { describe, expect, it } from 'vitest';
import { ROAD_IDLE } from '../levels/road';
import { Idle, type IdleRule } from './idle';

const RULE: IdleRule = { blinkMs: 4000, signMs: 8000, wasted: 3 };

describe('the wait of a stage', () => {
  it('shows nothing before the player has waited, and nothing before the board has been stood on', () => {
    const idle = new Idle(RULE);
    expect(idle.at(0)).toEqual({ blink: false, sign: false });
    expect(idle.at(60_000)).toEqual({ blink: false, sign: false });
    idle.acted(1000, 0);
    expect(idle.at(1000)).toEqual({ blink: false, sign: false });
  });

  it('blinks the plaque from four seconds of waiting, and not a moment before', () => {
    const idle = new Idle(RULE);
    idle.acted(1000, 0);
    expect(idle.at(4999).blink).toBe(false);
    expect(idle.at(5000).blink).toBe(true);
    expect(idle.at(5000).sign).toBe(false);
    expect(idle.at(8999)).toEqual({ blink: true, sign: false });
  });

  it('shows the sign from eight seconds, and the plaque blinks no more once the sign has come', () => {
    const idle = new Idle(RULE);
    idle.acted(1000, 0);
    expect(idle.at(8999).sign).toBe(false);
    expect(idle.at(9000)).toEqual({ blink: false, sign: true });
    expect(idle.at(90_000)).toEqual({ blink: false, sign: true });
  });

  it('takes both away with a move or a step, and brings them back after the same seconds', () => {
    const idle = new Idle(RULE);
    idle.acted(0, 0);
    expect(idle.at(5000).blink).toBe(true);
    idle.acted(5000, 0);
    expect(idle.at(5000)).toEqual({ blink: false, sign: false });
    expect(idle.at(8999)).toEqual({ blink: false, sign: false });
    expect(idle.at(9000).blink).toBe(true);
    idle.acted(20_000, 1);
    expect(idle.at(20_000)).toEqual({ blink: false, sign: false });
    expect(idle.at(27_999).sign).toBe(false);
    expect(idle.at(28_000).sign).toBe(true);
  });

  it('shows the sign at once when three moves have been wasted, and waits again when they no longer are', () => {
    const idle = new Idle(RULE);
    idle.acted(0, 2);
    expect(idle.at(0).sign).toBe(false);
    idle.acted(1000, 3);
    expect(idle.at(1000)).toEqual({ blink: false, sign: true });
    idle.acted(2000, 4);
    expect(idle.at(2000).sign).toBe(true);
    // A move taken back: the count is that of the board that is back.
    idle.acted(3000, 2);
    expect(idle.at(3000)).toEqual({ blink: false, sign: false });
  });

  it('does not count the time a panel is open', () => {
    const idle = new Idle(RULE);
    idle.acted(0, 0);
    idle.pause(3000);
    expect(idle.at(50_000)).toEqual({ blink: false, sign: false });
    idle.resume(50_000);
    expect(idle.at(50_999).blink).toBe(false);
    expect(idle.at(51_000).blink).toBe(true);
    expect(idle.at(54_999).sign).toBe(false);
    expect(idle.at(55_000).sign).toBe(true);
  });

  it('is paused and let go on any number of times in a row with no harm', () => {
    const idle = new Idle(RULE);
    idle.acted(0, 0);
    idle.resume(500);
    idle.pause(1000);
    idle.pause(2000);
    idle.pause(9000);
    idle.resume(10_000);
    idle.resume(11_000);
    // A second has been waited before the panel, and the rest after it.
    expect(idle.at(12_999).blink).toBe(false);
    expect(idle.at(13_000).blink).toBe(true);
  });

  it('counts from the board come to under a panel only once the panel is gone', () => {
    const idle = new Idle(RULE);
    idle.pause(0);
    idle.acted(2000, 0);
    expect(idle.at(30_000)).toEqual({ blink: false, sign: false });
    idle.resume(30_000);
    expect(idle.at(33_999).blink).toBe(false);
    expect(idle.at(34_000).blink).toBe(true);
  });

  it('never blinks where the piece has no plaque to blink, and counts no wasted moves where it counts none', () => {
    const idle = new Idle({ blinkMs: null, signMs: 6000, wasted: null });
    idle.acted(0, 99);
    expect(idle.at(0)).toEqual({ blink: false, sign: false });
    expect(idle.at(5999)).toEqual({ blink: false, sign: false });
    expect(idle.at(6000)).toEqual({ blink: false, sign: true });
  });

  it('takes the rule of every piece of the road as it is written', () => {
    for (const rule of Object.values(ROAD_IDLE)) {
      const idle = new Idle(rule);
      idle.acted(0, 0);
      expect(idle.at(rule.signMs - 1).sign).toBe(false);
      expect(idle.at(rule.signMs).sign).toBe(true);
    }
  });
});
