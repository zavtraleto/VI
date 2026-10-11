import { describe, expect, it } from 'vitest';
import { Pacer } from './pacer';

/** The pace of the frames drawn in the last second of five on a screen of `hz`, and the longest and shortest time between two of them. */
function pace(pacer: Pacer, hz: number, jitter = 0): { fps: number; least: number; most: number } {
  const step = 1000 / hz;
  const drawn: number[] = [];
  for (let i = 1; i * step < 5000; i++) {
    const time = 100 + i * step + (i % 2 === 0 ? jitter : -jitter);
    if (pacer.take(time) && time > 4100) drawn.push(time);
  }
  const gaps = drawn.slice(1).map((time, i) => time - drawn[i]);
  const fps = Math.round(((drawn.length - 1) * 1000) / (drawn[drawn.length - 1] - drawn[0]));
  return { fps, least: Math.min(...gaps), most: Math.max(...gaps) };
}

describe('Pacer', () => {
  it('draws every second frame of a screen of 120', () => {
    const { fps, least, most } = pace(new Pacer(60), 120);
    expect(fps).toBe(60);
    expect(least).toBeCloseTo(1000 / 60, 3);
    expect(most).toBeCloseTo(1000 / 60, 3);
  });

  it('draws every frame of a screen of 60, 75 or 90: half of them would be under the limit', () => {
    expect(pace(new Pacer(60), 60).fps).toBe(60);
    expect(pace(new Pacer(60), 75).fps).toBe(75);
    expect(pace(new Pacer(60), 90).fps).toBe(90);
  });

  it('keeps the frames even on a screen the limit does not divide', () => {
    const { fps, least, most } = pace(new Pacer(60), 144);
    expect(fps).toBe(72);
    expect(most - least).toBeLessThan(0.001);
  });

  it('draws every fourth frame of a screen of 240', () => {
    expect(pace(new Pacer(60), 240).fps).toBe(60);
  });

  it('is not thrown by frames that come a millisecond early or late', () => {
    expect(pace(new Pacer(60), 120, 1).fps).toBe(60);
    expect(pace(new Pacer(60), 60, 1).fps).toBe(60);
  });

  it('follows the screen where no limit is set', () => {
    expect(pace(new Pacer(0), 120).fps).toBe(120);
  });

  it('draws every frame until the refresh is known', () => {
    const pacer = new Pacer(60);
    let drawn = 0;
    for (let i = 1; i <= 20; i++) if (pacer.take(i * (1000 / 120))) drawn++;
    expect(drawn).toBe(20);
  });
});
