import { cubeAt } from './board';
import { defaultConfig } from './config';
import { createRun, step } from './sim';
import type { Cube, ExperimentConfig, RunState, Tuning } from './types';

/**
 * A stand-in for a player, to see what a pace does without playing it: it never moves and
 * builds no groups. At an even beat it takes one resting cube, the one that has stood the
 * longest, and makes it sink as a plain clear of one cube. It makes no chains, so it buys no
 * silence: a real player who chains lasts longer than this.
 *
 * Run it with `node scripts/pace.mjs`.
 */
export interface PaceRun {
  /** Cubes the bot clears in a minute. */
  rate: number;
  timed: boolean;
  seed: number;
  seconds: number;
  level: number;
  /** Why the run ended; null when it outlasted the time given to the trial. */
  endReason: RunState['endReason'];
  removed: number;
  /** When the board first came to the danger mark: from there the bot is losing ground. */
  dangerAt: { seconds: number; level: number } | null;
  /** Seconds with the board at the danger mark, and the most cubes it held. */
  dangerSeconds: number;
  peakCubes: number;
}

export interface PaceOptions {
  rate: number;
  timed?: boolean;
  seed?: number;
  /** The bot gives up on a run that lasts this long. */
  limitMinutes?: number;
  experiments?: Partial<ExperimentConfig>;
  tuning?: Partial<Tuning>;
}

/** The resting cube that has stood the longest, the one under the player left alone. */
function oldestIdle(state: RunState): Cube | undefined {
  const { player } = state;
  const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
  let found: Cube | undefined;
  for (const cube of state.cubes) {
    if (cube.state !== 'idle' || cube === own) continue;
    if (!found || cube.id < found.id) found = cube;
  }
  return found;
}

/** Makes a cube sink as a clear of the player's: a reaction of its own, one link long. */
function clear(state: RunState, cube: Cube): void {
  const top = cube.ori.top;
  // A 1 goes down outside any reaction, as it does in a Happy One.
  const reactionId = top >= 2 ? state.nextReactionId++ : 0;
  if (reactionId !== 0) state.reactions.push({ id: reactionId, value: top, chain: 1, total: 1 });
  cube.state = 'sinking';
  cube.t = 0;
  cube.reactionId = reactionId;
}

export function playPace(opts: PaceOptions): PaceRun {
  const { rate, timed = false, seed = 1, limitMinutes = 60 } = opts;
  const config = defaultConfig(opts.experiments, opts.tuning);
  const state = createRun({ seed, config, timed });
  const perTick = (rate * config.tickMs) / 60000;
  const limit = Math.round((limitMinutes * 60000) / config.tickMs);
  const seconds = (ticks: number) => (ticks * config.tickMs) / 1000;
  let due = 0;
  let peakCubes = state.cubes.length;
  let dangerTicks = 0;
  let dangerAt: PaceRun['dangerAt'] = null;
  while (!state.over && state.tick < limit) {
    due += perTick;
    if (due >= 1) {
      const cube = oldestIdle(state);
      // With nothing to clear the beat waits; it does not save clears up.
      due = cube ? due - 1 : 1;
      if (cube) clear(state, cube);
    }
    step(state, null);
    peakCubes = Math.max(peakCubes, state.cubes.length);
    if (state.cubes.length >= config.warnOccupied) {
      dangerTicks++;
      dangerAt ??= { seconds: seconds(state.tick), level: state.level };
    }
  }
  return {
    rate,
    timed,
    seed,
    seconds: seconds(state.tick),
    level: state.level,
    endReason: state.endReason,
    removed: state.removed,
    dangerAt,
    dangerSeconds: seconds(dangerTicks),
    peakCubes,
  };
}

function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

const END: Record<string, string> = { full: 'board full', time: 'clock ran out', cleared: 'cleared' };

/**
 * The table of the pace: how long a run lasts and what level it gets to for each rate of
 * clearing, as text. Every rate is played on several seeds; the row gives the middle one.
 * "Danger from" is when the board first held the danger mark of cubes: up to there the bot
 * keeps the board, after it the bot lives on a crowded one.
 */
export function paceTable(opts: Omit<PaceOptions, 'rate' | 'seed'> & { rates?: number[]; seeds?: number[] } = {}): string {
  const { rates = [10, 20, 40], seeds = [1, 2, 3, 4, 5], ...rest } = opts;
  const lines = ['mode     cubes/min  time     level  end                     danger from      danger s  peak cubes'];
  for (const timed of [false, true]) {
    for (const rate of rates) {
      const runs = seeds.map((seed) => playPace({ ...rest, rate, timed, seed })).sort((a, b) => a.seconds - b.seconds);
      const mid = runs[Math.floor(runs.length / 2)];
      const end = mid.endReason ? END[mid.endReason] : `not over in ${rest.limitMinutes ?? 60} min`;
      lines.push(
        [
          (timed ? 'timed' : 'endless').padEnd(8),
          String(rate).padEnd(10),
          clock(mid.seconds).padEnd(8),
          String(mid.level).padEnd(6),
          end.padEnd(23),
          (mid.dangerAt ? `${clock(mid.dangerAt.seconds)}, level ${mid.dangerAt.level}` : 'never').padEnd(16),
          mid.dangerSeconds.toFixed(0).padEnd(9),
          String(mid.peakCubes),
        ].join(' '),
      );
    }
  }
  return lines.join('\n');
}
