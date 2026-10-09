import { describe, expect, it } from 'vitest';
import { ChainStock, EchoSide, STOCK_RATES, echoLength, fillNoise, noiseLength } from './stock';
import { soundRandom, type Rand } from './variation';

const SECONDS = 3.4;

/** A generator that counts what is asked of it. */
function counted(seed: number): { rand: Rand; asked: () => number } {
  const inner = soundRandom(seed);
  let asked = 0;
  return {
    rand: () => {
      asked++;
      return inner();
    },
    asked: () => asked,
  };
}

/** The numbers of a chain as the chain works them out by itself, at once: the noise, then one side of the echo, then the other. */
function atOnce(rate: number, seconds: number, rand: Rand): { noise: Float32Array; echo: Float32Array[] } {
  const noise = new Float32Array(noiseLength(rate));
  fillNoise(noise, rand);
  const echo = [0, 1].map(() => {
    const side = new EchoSide(new Float32Array(echoLength(rate, seconds)), rate, rand);
    side.fill();
    return side.data;
  });
  return { noise, echo };
}

/** Where two rows of numbers first differ; -1 where they are the same. */
function differs(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return Math.min(a.length, b.length);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

describe('the numbers of the sound worked out ahead of the first press', () => {
  it('are the numbers the chain works out by itself, however small the parts they were made in', () => {
    // One rate, so that the generator is asked in the same order both ways.
    const stock = new ChainStock(SECONDS, soundRandom(7), [48000]);
    let steps = 0;
    while (stock.step()) steps++;
    expect(steps).toBeGreaterThan(10);
    const made = stock.take(48000, SECONDS)!;
    const plain = atOnce(48000, SECONDS, soundRandom(7));
    expect(differs(made.noise, plain.noise)).toBe(-1);
    expect(differs(made.echo[0], plain.echo[0])).toBe(-1);
    expect(differs(made.echo[1], plain.echo[1])).toBe(-1);
  });

  it('leave the press nothing to work out once the idle time has done all of it', () => {
    const { rand, asked } = counted(11);
    const stock = new ChainStock(SECONDS, rand);
    expect(stock.done).toBe(false);
    while (stock.step()) {
      // Each call is one part of the work.
    }
    expect(stock.done).toBe(true);
    const before = asked();
    for (const rate of STOCK_RATES) {
      const made = stock.take(rate, SECONDS)!;
      expect(made.noise.length).toBe(noiseLength(rate));
      expect(made.echo[0].length).toBe(echoLength(rate, SECONDS));
      expect(made.echo[1].length).toBe(echoLength(rate, SECONDS));
    }
    expect(asked()).toBe(before);
  });

  it('do a part of the work on a call, never all of it: no call holds the page for long', () => {
    const { rand, asked } = counted(3);
    const stock = new ChainStock(SECONDS, rand);
    let most = 0;
    let last = 0;
    while (stock.step()) {
      most = Math.max(most, asked() - last);
      last = asked();
    }
    // A side of the echo at 48000 is a hundred and sixty thousand numbers.
    expect(most).toBeLessThanOrEqual(8192);
    expect(most).toBeGreaterThan(0);
  });

  it('are finished at once by a press that comes before the idle time has done them', () => {
    const stock = new ChainStock(SECONDS, soundRandom(5), [48000]);
    stock.step();
    stock.step();
    stock.step();
    const made = stock.take(48000, SECONDS)!;
    const plain = atOnce(48000, SECONDS, soundRandom(5));
    expect(differs(made.echo[1], plain.echo[1])).toBe(-1);
    // An echo dies away to nothing by its end, and is something before it.
    expect(Math.abs(made.echo[0][made.echo[0].length - 1])).toBeLessThan(1e-6);
    expect(made.echo[0].some((value) => Math.abs(value) > 0.01)).toBe(true);
  });

  it('are none for a rate that was not foreseen or for an echo of another length: the chain then works its own out', () => {
    const stock = new ChainStock(SECONDS, soundRandom(1));
    expect(stock.take(96000, SECONDS)).toBeNull();
    expect(stock.take(48000, 2)).toBeNull();
    expect(stock.take(44100, SECONDS)).not.toBeNull();
  });
});
