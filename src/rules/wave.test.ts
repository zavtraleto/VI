import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, defaultConfig, helpChance, msToTicks, paceIntervalTicks, ruleKey } from './config';
import { createRun, step } from './sim';
import { emptyRun, put, run } from './testkit';
import type { Dir, ExperimentConfig, GameEvent, RunState, Tuning, Wave } from './types';
import { resting, silent, swell, swellAt, waveAt } from './wave';

const c = defaultConfig();
const warned = (e: GameEvent) => e.type === 'warned';

function collect(s: RunState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

/** The first waves of a run with this seed, one after another. */
function waves(seed: number, count: number, config = c): Wave[] {
  const list: Wave[] = [];
  for (let i = 0, start = 0; i < count; i++) {
    const wave = waveAt(config, seed, i, start);
    list.push(wave);
    start += wave.build + wave.rest;
  }
  return list;
}

/** An empty board that keeps the time of its waves. Nothing comes up until spawning is switched on. */
function swelling(seed = 7, experiments: Partial<ExperimentConfig> = {}, tuning: Partial<Tuning> = {}): RunState {
  return emptyRun({ waves: true, ...experiments }, seed, { helpRate: 0, ...tuning });
}

describe('a wave of the pace', () => {
  it('opens slower than the level asks and gathers to a crest that is faster', () => {
    const wave = waveAt(c, 7, 0, 0);
    expect(DEFAULT_TUNING.waveEase).toBeGreaterThan(1);
    expect(DEFAULT_TUNING.wavePeak).toBeLessThan(1);
    expect(swellAt(c, wave, 0)).toBeCloseTo(DEFAULT_TUNING.waveEase);
    // The crest is the last tick of the build; after it the wave is in its trough.
    expect(swellAt(c, wave, wave.build - 1)).toBeCloseTo(DEFAULT_TUNING.wavePeak, 3);
    expect(swellAt(c, wave, wave.build)).toBeGreaterThan(DEFAULT_TUNING.waveEase);
  });

  it('only gathers on the way to its crest', () => {
    const wave = waveAt(c, 7, 0, 0);
    for (let tick = 0; tick + 10 < wave.build; tick += 10) {
      expect(swellAt(c, wave, tick + 10)).toBeLessThanOrEqual(swellAt(c, wave, tick));
    }
  });

  it('is no metronome: waves and their rests differ in length, within the spread', () => {
    const list = waves(7, 12, defaultConfig({}, { breatherEvery: 0 }));
    const builds = list.map((wave) => wave.build);
    const rests = list.map((wave) => wave.rest);
    expect(new Set(builds).size).toBeGreaterThan(8);
    expect(new Set(rests).size).toBeGreaterThan(8);
    const spread = DEFAULT_TUNING.waveSpread;
    expect(spread).toBeGreaterThan(0);
    const build = msToTicks(DEFAULT_TUNING.waveSec * 1000);
    const rest = msToTicks(DEFAULT_TUNING.restMs);
    for (const ticks of builds) {
      expect(ticks).toBeGreaterThanOrEqual(Math.floor(build * (1 - spread)));
      expect(ticks).toBeLessThanOrEqual(Math.ceil(build * (1 + spread)));
    }
    for (const ticks of rests) {
      expect(ticks).toBeGreaterThanOrEqual(Math.floor(rest * (1 - spread)));
      expect(ticks).toBeLessThanOrEqual(Math.ceil(rest * (1 + spread)));
    }
  });

  it('has a long trough after every fourth wave: a big breather on top of the small ones', () => {
    const rest = msToTicks(DEFAULT_TUNING.restMs);
    expect(DEFAULT_TUNING.breatherEvery).toBe(4);
    expect(DEFAULT_TUNING.breatherFactor).toBeGreaterThan(1.5);
    waves(7, 12, defaultConfig({}, { waveSpread: 0 })).forEach((wave, i) => {
      expect(wave.rest).toBe(i % 4 === 3 ? Math.round(rest * DEFAULT_TUNING.breatherFactor) : rest);
    });
  });

  it('is even when the spread and the big breather are taken away', () => {
    const even = defaultConfig({}, { waveSpread: 0, breatherEvery: 0 });
    for (const wave of waves(7, 5, even)) {
      expect(wave.build).toBe(msToTicks(DEFAULT_TUNING.waveSec * 1000));
      expect(wave.rest).toBe(msToTicks(DEFAULT_TUNING.restMs));
    }
  });

  it('follows the one before it without a gap', () => {
    const list = waves(7, 6);
    list.forEach((wave, i) => {
      expect(wave.index).toBe(i);
      if (i > 0) expect(wave.start).toBe(list[i - 1].start + list[i - 1].build + list[i - 1].rest);
    });
  });

  it('comes from the seed alone', () => {
    expect(waves(7, 6)).toEqual(waves(7, 6));
    expect(waves(8, 6)).not.toEqual(waves(7, 6));
  });
});

describe('the swell of a wave', () => {
  const endless = (level: number, by?: number) => paceIntervalTicks(c, 'endless', level, 0, c.targetCubes, by);

  it('stretches and squeezes the interval of the level', () => {
    expect(endless(1)).toBe(250); // 5 s
    expect(endless(1, 1)).toBe(250);
    expect(endless(1, 1.2)).toBe(300); // 5 s x 1.2
    expect(endless(1, 0.75)).toBe(188); // 5 s x 0.75
  });

  it('never takes the interval under its floor', () => {
    expect(endless(200, 0.75)).toBe(25); // 0.5 s
    expect(endless(200, 1.2)).toBe(30); // 0.5 s x 1.2
  });

  it('takes Time Limited the same way', () => {
    expect(paceIntervalTicks(c, 'timed', 1, 0, c.targetCubes, 1.2)).toBe(180); // 3 s x 1.2
    expect(paceIntervalTicks(c, 'timed', 1, 0, c.targetCubes, 0.75)).toBe(113); // 3 s x 0.75
  });

  it('never takes Time Limited under the interval it ends at', () => {
    expect(paceIntervalTicks(c, 'timed', 1, c.timedTicks, c.targetCubes, 0.75)).toBe(75); // 1.5 s
    expect(paceIntervalTicks(c, 'timed', 1, c.timedTicks, c.targetCubes, 1.2)).toBe(90); // 1.5 s x 1.2
  });
});

describe('the crest of a wave', () => {
  /** An empty board with the cubes coming, and the wave an instant from its crest. */
  function atCrest(index: number, experiments: Partial<ExperimentConfig> = {}, tuning: Partial<Tuning> = {}): RunState {
    const s = swelling(7, { surge: true, ...experiments }, { targetCubes: 0, paceStartMs: 600000, ...tuning });
    s.spawnEnabled = true;
    s.wave = { index, start: s.tick, build: 5, rest: 500 };
    return s;
  }

  /** Cubes announced on the tick the wave breaks. */
  function salvo(s: RunState): number {
    expect(collect(s, 5).some(warned)).toBe(false);
    step(s, null);
    return s.events.filter(warned).length;
  }

  it('is an event: several cubes come at once, where the rest of the wave brings them one by one', () => {
    expect(DEFAULT_TUNING.surgeCubes).toBeGreaterThanOrEqual(2);
    expect(salvo(atCrest(0))).toBe(DEFAULT_TUNING.surgeCubes);
  });

  it('grows with the run: a cube more every few waves, up to its limit', () => {
    const first = salvo(atCrest(0));
    expect(salvo(atCrest(3))).toBe(first);
    expect(salvo(atCrest(4))).toBe(first + 1);
    expect(salvo(atCrest(8))).toBe(first + 2);
    expect(salvo(atCrest(400))).toBe(DEFAULT_TUNING.surgeMax);
    expect(DEFAULT_TUNING.surgeMax).toBeGreaterThan(first);
  });

  it('does not come through a silence a chain holds', () => {
    const s = atCrest(0);
    s.chainCalmLeft = 1000;
    expect(salvo(s)).toBe(0);
  });

  it('takes no more cells than the board has free', () => {
    const s = atCrest(400);
    let cell = 0;
    for (; s.cubes.length < 47; cell++) put(s, cell % 7, Math.floor(cell / 7), (cell % 7 + Math.floor(cell / 7)) % 2 === 0 ? 6 : 5);
    expect(salvo(s)).toBe(2);
  });

  it('is an experiment: switched off, the wave breaks without it', () => {
    expect(salvo(atCrest(0, { surge: false }))).toBe(0);
    expect(defaultConfig().experiments.surge).toBe(true);
    expect(ruleKey(defaultConfig({ surge: false }))).not.toBe(ruleKey(defaultConfig()));
  });
});

describe('waves in a run', () => {
  it('do not open it with a rest', () => {
    const s = swelling();
    expect(s.wave).toEqual(waveAt(s.config, 7, 0, 0));
    expect(resting(s)).toBe(false);
    expect(swell(s)).toBeCloseTo(DEFAULT_TUNING.waveEase);
  });

  it('hold every regular cube for the rest after a crest when its flow is set to nothing, then let them come again', () => {
    const s = swelling(7, {}, { restFlow: 0 });
    s.spawnEnabled = true;
    const { build, rest } = s.wave;
    expect(collect(s, build).some(warned)).toBe(true);
    expect(collect(s, rest).some(warned)).toBe(false);
    expect(resting(s)).toBe(true);
    expect(silent(s)).toBe(true);
    expect(s.wave.index).toBe(0);
    expect(collect(s, 400).some(warned)).toBe(true);
    expect(s.wave.index).toBe(1);
    expect(resting(s)).toBe(false);
  });

  it('fall into a trough after the crest, not into a silence: cubes still come, at a share of the flow of the level', () => {
    const s = swelling();
    const share = DEFAULT_TUNING.restFlow;
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
    run(s, s.wave.build + 1);
    expect(resting(s)).toBe(true);
    expect(silent(s)).toBe(false);
    expect(swell(s)).toBeCloseTo(1 / share);
    // The trough lies lower than the wave ever starts from.
    expect(1 / share).toBeGreaterThan(DEFAULT_TUNING.waveEase);
    s.spawnEnabled = true;
    expect(collect(s, s.wave.rest - 1).some(warned)).toBe(true);
  });

  it('make the trough a place to feel strong in: every cube that comes there is a helpful one', () => {
    expect(helpChance(c, 30, true)).toBe(1);
    expect(helpChance(c, 30, false)).toBeLessThan(0.5);
    expect(helpChance(c, 30)).toBe(helpChance(c, 30, false));
  });

  it('come back slower after the rest, and every crest is at least as fast as the last', () => {
    const s = swelling();
    const interval = () => paceIntervalTicks(s.config, s.mode, s.level, s.tick, s.config.targetCubes, swell(s));
    const crests: number[] = [];
    for (let i = 0; i < 6; i++) {
      const { start, build, rest } = s.wave;
      run(s, start + build - 1 - s.tick);
      const crest = interval();
      crests.push(crest);
      run(s, rest + 2);
      expect(s.wave.index).toBe(i + 1);
      expect(interval()).toBeGreaterThan(crest);
    }
    for (let i = 1; i < crests.length; i++) expect(crests[i]).toBeLessThanOrEqual(crests[i - 1]);
    expect(crests[5]).toBeLessThan(crests[0]);
  });

  /** A run of the game as it is dealt, with somebody at it or nobody. */
  function played(timed: boolean, moves: boolean): RunState {
    const s = createRun({ seed: 42, config: defaultConfig(), timed });
    const dirs: Dir[] = ['N', 'E', 'S', 'W'];
    // The session of the day can be lost from its first second: it is played while nobody can have lost it.
    const ticks = timed ? 3500 : 8000;
    for (let i = 0; i < ticks && !s.over; i++) step(s, moves && i % 7 === 0 ? dirs[(i / 7) % 4 | 0] : null);
    return s;
  }

  it('do not look at what the player does', () => {
    const idle = played(false, false);
    const busy = played(false, true);
    expect(busy.wave.index).toBeGreaterThan(1);
    expect(busy.wave).toEqual(idle.wave);
    expect(swell(busy)).toBe(swell(idle));
  });

  it('are the same for everyone in the session of the day', () => {
    const idle = played(true, false);
    const busy = played(true, true);
    expect(idle.over || busy.over).toBe(false);
    expect(busy.wave.index).toBeGreaterThanOrEqual(1);
    expect(busy.wave).toEqual(idle.wave);
    expect(swell(busy)).toBe(swell(idle));
    expect(played(true, true).wave).toEqual(waves(42, busy.wave.index + 1).at(-1));
  });

  it('are an experiment: switched off, the flow keeps to the level and never rests', () => {
    const s = swelling(7, { waves: false });
    for (let i = 0; i < 6000; i += 50) {
      run(s, 50);
      expect(swell(s)).toBe(1);
      expect(resting(s)).toBe(false);
    }
    expect(defaultConfig().experiments.waves).toBe(true);
    expect(ruleKey(defaultConfig({ waves: false }))).not.toBe(ruleKey(defaultConfig()));
  });

  it('leave the exercise to its own pace', () => {
    const s = createRun({ seed: 1, config: defaultConfig(), tutorial: true });
    run(s, 4000);
    expect(swell(s)).toBe(1);
    expect(resting(s)).toBe(false);
  });
});
