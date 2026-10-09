import type { Rand } from './variation';

/**
 * The numbers of the sound that take time to work out: the noise the knocks are cut from and
 * the echo. They are the same for any context of one rate, so they can be worked out before
 * there is a context at all: the sound is opened by the first press of the page, and a press
 * that had to wait for a third of a million numbers of the echo held the page for longer than a
 * frame, on a phone for longer than a die rolls. Nothing here knows of WebAudio or of the page.
 */

/** The noise the clicks of the knocks are cut from, in seconds. */
export const NOISE_SECONDS = 0.5;
/** Rates of a context the numbers are worked out for ahead of time: nearly every device has one of the two. */
export const STOCK_RATES: readonly number[] = [48000, 44100];
/** Numbers worked out in one go, where the work is done a little at a time. */
const SLICE = 8192;

/** How many numbers the noise has at a rate. */
export function noiseLength(rate: number): number {
  return Math.floor(rate * NOISE_SECONDS);
}

/** How many numbers a side of the echo has at a rate. */
export function echoLength(rate: number, seconds: number): number {
  return Math.max(2, Math.floor(rate * seconds));
}

/** Fills `data` with noise, from `from` up to `to`. */
export function fillNoise(data: Float32Array, rand: Rand, from = 0, to = data.length): void {
  for (let i = from; i < to; i++) data[i] = rand() * 2 - 1;
}

/**
 * One side of the echo, worked out a part at a time: a burst of noise that dies away and grows
 * darker as it does. Its low part is taken out, so that it does not rumble, and its high part is
 * soft from the start, so that it never hisses. `data` is as long as `echoLength` says.
 */
export class EchoSide {
  private at: number;
  private smooth = 0;
  private slow = 0;
  private readonly before: number;
  private readonly under: number;

  constructor(
    readonly data: Float32Array,
    private readonly rate: number,
    private readonly rand: Rand,
  ) {
    this.before = Math.min(data.length - 1, Math.floor(rate * 0.012));
    this.at = this.before;
    this.under = this.follow(160);
  }

  /** How fast a one-pole filter follows what it is given, for a corner in hertz, at any rate of the context. */
  private follow(hz: number): number {
    return 1 - Math.exp((-2 * Math.PI * hz) / this.rate);
  }

  get done(): boolean {
    return this.at >= this.data.length;
  }

  /** Works out at most `count` numbers more; without it, all that are left. */
  fill(count = Infinity): void {
    const { data, before, under, rand } = this;
    const length = data.length;
    const end = Math.min(length, this.at + count);
    let { smooth, slow } = this;
    for (let i = this.at; i < end; i++) {
      const t = (i - before) / (length - before);
      // From about five thousand hertz down to a few hundred: the tail grows dark.
      smooth += (rand() * 2 - 1 - smooth) * this.follow(5200 * (1 - t) ** 2 + 500);
      slow += (smooth - slow) * under;
      // Sixty decibels down by its end, and to nothing exactly at it.
      data[i] = (smooth - slow) * Math.exp(-6.9 * t) * (1 - t);
    }
    this.smooth = smooth;
    this.slow = slow;
    this.at = end;
  }
}

/** The numbers of a chain for one rate: its noise, and the two sides of its echo. */
export interface ChainNumbers {
  noise: Float32Array;
  echo: [Float32Array, Float32Array];
}

interface Job {
  rate: number;
  noise: Float32Array;
  noiseAt: number;
  sides: [EchoSide, EchoSide];
}

/**
 * The numbers of a chain worked out ahead of the first press, for the rates a context is likely
 * to have and for one length of the echo: a little on each call of `step`, which whoever owns
 * the idle time of the page makes. `take` hands the numbers of a rate over, finishing at once
 * what is left of them; a rate that was not foreseen, or another length of the echo, gets none,
 * and the chain works its own out as it did before.
 */
export class ChainStock {
  private readonly jobs: Job[];

  constructor(
    readonly seconds: number,
    private readonly rand: Rand,
    rates: readonly number[] = STOCK_RATES,
  ) {
    this.jobs = rates.map((rate) => {
      const side = (): EchoSide => new EchoSide(new Float32Array(echoLength(rate, seconds)), rate, rand);
      return { rate, noise: new Float32Array(noiseLength(rate)), noiseAt: 0, sides: [side(), side()] };
    });
  }

  /** Does a part of what is left; false when nothing was left to do. */
  step(): boolean {
    for (const job of this.jobs) {
      if (this.advance(job, SLICE)) return true;
    }
    return false;
  }

  /** Nothing is left to work out. */
  get done(): boolean {
    return this.jobs.every((job) => job.noiseAt >= job.noise.length && job.sides.every((side) => side.done));
  }

  /** The numbers for a context of this rate with an echo of this length, whole; null where there are none. */
  take(rate: number, seconds: number): ChainNumbers | null {
    const job = this.jobs.find((one) => one.rate === rate);
    if (!job || seconds !== this.seconds) return null;
    while (this.advance(job, Infinity)) {
      // What the idle time of the page did not get to is done now.
    }
    return { noise: job.noise, echo: [job.sides[0].data, job.sides[1].data] };
  }

  /** At most `count` numbers more of one rate; false when it has them all. */
  private advance(job: Job, count: number): boolean {
    if (job.noiseAt < job.noise.length) {
      const end = Math.min(job.noise.length, job.noiseAt + count);
      fillNoise(job.noise, this.rand, job.noiseAt, end);
      job.noiseAt = end;
      return true;
    }
    for (const side of job.sides) {
      if (side.done) continue;
      side.fill(count);
      return true;
    }
    return false;
  }
}
