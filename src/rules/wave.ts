import type { RulesConfig, RunState, Wave } from './types';

/**
 * A number from 0 to 1 that depends on the seed of a run and on `n` alone. The waves do not
 * draw from the run's own generator: what the player does must not move them, and the cubes
 * come as they would have without them.
 */
function noise(seed: number, n: number): number {
  let t = (seed ^ Math.imul(n + 1, 0x9e3779b1)) | 0;
  t = Math.imul(t ^ (t >>> 16), 0x85ebca6b);
  t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** A length that is `ticks` on average and up to `spread` of it longer or shorter. */
function varied(ticks: number, spread: number, roll: number): number {
  return Math.max(0, Math.round(ticks * (1 + spread * (2 * roll - 1))));
}

/**
 * Wave `index` of a run, from tick `start` on. The flow of cubes gathers for `build` ticks to
 * a crest and then falls into a trough for `rest`: the challenge rises in peaks, and after
 * every peak comes a stretch where the player is stronger than what is asked of them. No two
 * waves are of one length, so the troughs are not kept like a beat; and everything about a
 * wave comes from the seed of the run, so it is a script and not an answer to how the player
 * is doing.
 */
export function waveAt(config: RulesConfig, seed: number, index: number, start: number): Wave {
  // The big breather: small waves ride on a larger one, and after a run of them the trough is long.
  const breather = config.breatherEvery > 0 && index % config.breatherEvery === config.breatherEvery - 1;
  const rest = config.restTicks * (breather ? config.breatherFactor : 1);
  return {
    index,
    start,
    build: Math.max(1, varied(config.waveTicks, config.waveSpread, noise(seed, index * 2))),
    rest: varied(rest, config.waveSpread, noise(seed, index * 2 + 1)),
  };
}

/**
 * What a wave multiplies the interval of the level by at a tick: above 1 where it opens, the
 * flow slower than the level asks, and below 1 at its crest. It gathers slowly, then steeply,
 * and holds near the crest before it breaks. In the trough after the crest the flow is a share
 * of the level's, lower than anywhere on the way up.
 */
export function swellAt(config: RulesConfig, wave: Wave, tick: number): number {
  if (tick >= wave.start + wave.build && config.restFlow > 0) return 1 / config.restFlow;
  const along = Math.min(1, Math.max(0, (tick - wave.start) / Math.max(1, wave.build)));
  const gathered = along * along * (3 - 2 * along);
  return config.waveEase + (config.wavePeak - config.waveEase) * gathered;
}

/** Endless and Time Limited come in waves; a tutorial and a puzzle keep a pace of their own. */
function hasWaves(state: RunState): boolean {
  return state.config.experiments.waves && (state.mode === 'endless' || state.mode === 'timed');
}

/** Moves the run on to its next wave when the rest of this one is over. */
export function runWave(state: RunState): void {
  if (!hasWaves(state)) return;
  let wave = state.wave;
  while (state.tick >= wave.start + wave.build + wave.rest) {
    wave = waveAt(state.config, state.seed, wave.index + 1, wave.start + wave.build + wave.rest);
  }
  state.wave = wave;
}

/** Waves it takes for the salvo at the crest to grow by a cube. */
const SURGE_GROWTH_WAVES = 4;

/**
 * Cubes that come at once on this tick because a wave is breaking: the peak of the challenge
 * is an event and not only a faster flow. None on any other tick.
 */
export function surge(state: RunState): number {
  const { config, wave } = state;
  if (!config.experiments.surge || !hasWaves(state) || state.tick !== wave.start + wave.build) return 0;
  return Math.min(config.surgeMax, config.surgeCubes + Math.floor(wave.index / SURGE_GROWTH_WAVES));
}

/** What the wave the run is on multiplies the interval of the level by now. */
export function swell(state: RunState): number {
  return hasWaves(state) ? swellAt(state.config, state.wave, state.tick) : 1;
}

/** The wave has broken: until the next one begins the run is in the trough. */
export function resting(state: RunState): boolean {
  return hasWaves(state) && state.tick >= state.wave.start + state.wave.build;
}

/** The trough is a silence: no regular cube comes in it. So it is when its flow is set to nothing. */
export function silent(state: RunState): boolean {
  return resting(state) && state.config.restFlow <= 0;
}
