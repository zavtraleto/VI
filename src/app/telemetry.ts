import { ruleKey, type GameEvent, type RunState } from '../rules';

/**
 * What the game tells the analytics of the platform about how it is played: enough to tune
 * the pace and the spawn from numbers. Nothing here changes the game, and nothing here knows
 * who is playing.
 */

/** Plain values of an event. */
export type EventData = Record<string, string | number | boolean>;

/** Longest chains are counted together from this length on. */
const LONG_CHAIN = 4;

/** What the events of a run add up to, beyond what the rules count themselves. */
export class RunTally {
  /** Groups made, by the number on their dice: index 2 to 6. */
  private readonly matches = [0, 0, 0, 0, 0, 0, 0];
  /** How long each chain got, by its reaction. */
  private readonly chains = new Map<number, number>();
  private ones = 0;
  /** Times the board has come back from the danger mark. */
  private saves = 0;
  private danger = false;

  reset(): void {
    this.matches.fill(0);
    this.chains.clear();
    this.ones = 0;
    this.saves = 0;
    this.danger = false;
  }

  note(event: GameEvent): void {
    if (event.type === 'match') this.matches[event.value]++;
    else if (event.type === 'chain') this.chains.set(event.reactionId, Math.max(this.chains.get(event.reactionId) ?? 0, event.chain));
    else if (event.type === 'happyOne') this.ones += event.count;
  }

  /** Called once a tick: a board that leaves the danger mark with the run still going was saved. */
  watch(state: RunState): void {
    const danger = state.cubes.length >= state.config.warnOccupied;
    if (this.danger && !danger && !state.over) this.saves++;
    this.danger = danger;
  }

  values(): EventData {
    const lengths = [...this.chains.values()];
    const data: EventData = { ones: this.ones, saves: this.saves };
    for (let value = 2; value <= 6; value++) data[`match_${value}`] = this.matches[value];
    for (let length = 2; length < LONG_CHAIN; length++) data[`chains_${length}`] = lengths.filter((chain) => chain === length).length;
    data[`chains_${LONG_CHAIN}plus`] = lengths.filter((chain) => chain >= LONG_CHAIN).length;
    return data;
  }
}

/** What a scored session came to: the readings a pace or a spawn is tuned by. */
export function runSummary(state: RunState, tally: RunTally): EventData {
  const { config, stats } = state;
  const seconds = (ticks: number): number => Math.round((ticks * config.tickMs) / 100) / 10;
  const data: EventData = {
    rules: ruleKey(config),
    score: state.score,
    level: state.level,
    duration_sec: seconds(state.tick),
    max_chain: state.maxChain,
    best_chain_score: stats.bestChainScore,
    clears: stats.clears,
    removed: state.removed,
    spawned: stats.levels.reduce((sum, level) => sum + level.spawned, 0),
    cubes_end: state.cubes.length,
    steps: stats.steps,
    blocked_steps: stats.blockedSteps,
    falls: stats.falls,
    ground_sec: seconds(stats.groundTicks),
    // The ways between the floor and the dice: climbs onto a cube that could not be pushed, steps down to a dock, climbs from one.
    floor_climbs: stats.floorClimbs,
    dock_descents: stats.dockDescents,
    dock_climbs: stats.dockClimbs,
    danger_sec: seconds(stats.dangerTicks),
    chain_quiet_max_sec: seconds(stats.longestChainQuiet),
    ...tally.values(),
  };
  // A session without a single group has no first one: the reading is left out, not set to zero.
  if (stats.clearTicks.length > 0) data.first_clear_sec = seconds(stats.clearTicks[0]);
  return data;
}

/** A level of a session that has just been passed: how long it took and what it did to the board. */
export function levelSummary(state: RunState, level: number): EventData {
  const passed = state.stats.levels[level - 1];
  const seconds = (ticks: number): number => Math.round((ticks * state.config.tickMs) / 100) / 10;
  return {
    step_index: level,
    score: state.score,
    cubes: state.cubes.length,
    max_chain: state.maxChain,
    session_sec: seconds(state.tick),
    ...(passed ? { duration_sec: seconds(passed.ticks), spawned: passed.spawned, removed: passed.removed } : {}),
  };
}

/** How a session stands at a whole minute of play. */
export function checkpoint(state: RunState, minute: number): EventData {
  return {
    minute,
    score: state.score,
    level: state.level,
    cubes: state.cubes.length,
    removed: state.removed,
    max_chain: state.maxChain,
    danger_sec: Math.round((state.stats.dangerTicks * state.config.tickMs) / 100) / 10,
  };
}

/** The frame rate the game is made for. */
const TARGET_FPS = 60;
/** Play time one sample covers. */
const WINDOW_MS = 30_000;
/** A sample of less play than this says too little to be sent. */
const MIN_ACTIVE_MS = 5_000;
const SLOW_MS = [50, 100, 250, 500, 1000] as const;

/**
 * Measures the frames of active play and gives one sample for about every thirty seconds of
 * it, in the form the platform asks for. Menus, pauses and a hidden page are not play: a gap
 * between two stretches of play is not a frame.
 */
export class FrameSampler {
  private times: number[] = [];
  private active = 0;
  private startedAt = 0;
  private playing = false;
  private errors = 0;
  private rejections = 0;
  private contextLosses = 0;

  constructor(private readonly send: (sample: EventData) => void) {}

  /** A script has failed, a promise was left rejected, the picture has lost its context: counted within the sample. */
  noteError(kind: 'error' | 'rejection' | 'contextLoss'): void {
    if (kind === 'error') this.errors++;
    else if (kind === 'rejection') this.rejections++;
    else this.contextLosses++;
  }

  /** Called every frame. `playing` is active, visible play; `dtMs` is the time since the frame before. */
  frame(playing: boolean, dtMs: number, nowMs: number): void {
    if (!playing) {
      this.playing = false;
      return;
    }
    // The first frame after a gap has no frame before it to be measured from.
    if (this.playing && dtMs > 0) {
      if (this.times.length === 0) this.startedAt = nowMs - dtMs;
      this.times.push(dtMs);
      this.active += dtMs;
      if (this.active >= WINDOW_MS) this.flush(nowMs);
    }
    this.playing = true;
  }

  /** The play is over: what has been measured is sent if it is enough to say something. */
  flush(nowMs: number): void {
    const times = this.times;
    if (this.active >= MIN_ACTIVE_MS && times.length > 0) {
      const sorted = [...times].sort((a, b) => a - b);
      const at = (share: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
      const round = (value: number): number => Math.round(value * 10) / 10;
      const sample: EventData = {
        target_fps: TARGET_FPS,
        window_ms: Math.round(nowMs - this.startedAt),
        active_ms: Math.round(this.active),
        frame_count: times.length,
        fps_avg: round((times.length * 1000) / this.active),
        // The slowest tenth of the frames, as a frame rate.
        fps_p10: round(1000 / at(0.9)),
        frame_time_p50_ms: round(at(0.5)),
        frame_time_p95_ms: round(at(0.95)),
        frame_time_p99_ms: round(at(0.99)),
        frame_time_max_ms: round(sorted[sorted.length - 1]),
        js_error_count: this.errors,
        unhandled_rejection_count: this.rejections,
        webgl_context_loss_count: this.contextLosses,
        game_version: import.meta.env.VI_VERSION,
      };
      for (const limit of SLOW_MS) sample[`frames_over_${limit}ms`] = times.filter((time) => time > limit).length;
      this.send(sample);
    }
    this.times = [];
    this.active = 0;
    this.errors = 0;
    this.rejections = 0;
    this.contextLosses = 0;
  }
}
