/**
 * What keeps a sound from being the same twice: a variant that is never the last one, and small
 * deviations. The numbers come from outside. They are the sound's own: the rules have their
 * generator, and nothing here reads it or is read by them.
 */

/** A source of numbers in 0..1. */
export type Rand = () => number;

/** The sound's own stream of numbers (mulberry32): the same seed gives the same stream. */
export function soundRandom(seed: number): Rand {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One of `count` variants that is not `last`. With one variant there is nothing to choose from. */
export function pickFresh(count: number, last: number, rand: Rand): number {
  if (count <= 1) return 0;
  const known = last >= 0 && last < count;
  const room = known ? count - 1 : count;
  const pick = Math.min(room - 1, Math.max(0, Math.floor(rand() * room)));
  return known && pick >= last ? pick + 1 : pick;
}

/** Remembers the last variant of every sound by its name, so none comes twice in a row. */
export class Variety {
  private readonly last = new Map<string, number>();

  pick(key: string, count: number, rand: Rand): number {
    const pick = pickFresh(count, this.last.get(key) ?? -1, rand);
    this.last.set(key, pick);
    return pick;
  }
}

/** A number between `-amount` and `amount`. */
export function spread(amount: number, rand: Rand): number {
  return (rand() * 2 - 1) * amount;
}

/** Hundredths of a semitone as a ratio of frequencies. */
export function cents(value: number): number {
  return 2 ** (value / 1200);
}
