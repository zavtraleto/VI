import { describe, expect, it } from 'vitest';
import { cubeHeight } from './board';
import { DEFAULT_TUNING, defaultConfig, msToTicks, paceIntervalTicks, ruleKey, sinkTicksAt, timedPhase } from './config';
import { createRun, step } from './sim';
import { population, spawnCube } from './spawn';
import { emptyRun, land, ori, place, put, run } from './testkit';
import type { Dir, ExperimentConfig, GameEvent, RunState, Tuning } from './types';

function collect(s: RunState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

const warned = (e: GameEvent) => e.type === 'warned';

/** Ticks until the next regular spawn is announced, for the board as it is now. */
function interval(s: RunState): number {
  return paceIntervalTicks(s.config, s.mode, s.level, s.tick, population(s));
}

/** Takes the last cube that the level is short of off the board: one step, and the run is on `level`. */
function reach(s: RunState, level: number): void {
  s.level = level - 1;
  s.removed = s.config.cubesPerLevel * (level - 1) - 1;
  put(s, 6, 6, 6, 'sinking').t = s.config.sinkingTicks - 1;
  step(s, null);
}

describe('endless curve', () => {
  const c = defaultConfig();
  const at = (level: number) => paceIntervalTicks(c, 'endless', level, 0, c.targetCubes);

  it('holds the starting interval over levels 1 to 3 and speeds up from the 4th', () => {
    expect(at(1)).toBe(300); // 6 s
    expect(at(2)).toBe(300);
    expect(at(3)).toBe(300);
    expect(at(4)).toBe(282); // 6 s x 0.94
    expect(at(5)).toBe(265); // 6 s x 0.94 x 0.94
  });

  it('is gentle at first and steep in the deep: 3.9 s at level 10, 2.9 at 15, 2.1 at 20, 1.5 at 25', () => {
    expect(at(10)).toBe(195);
    expect(at(15)).toBe(143);
    expect(at(20)).toBe(105);
    expect(at(25)).toBe(77);
  });

  it('never slows down inside a phase', () => {
    for (let level = 1; level < 60; level++) {
      const nextOpensPhase = level % c.phaseLevels === 0;
      if (!nextOpensPhase) expect(at(level + 1)).toBeLessThanOrEqual(at(level));
    }
  });

  it('rests on the first level of a phase: the interval goes two levels back', () => {
    for (const level of [6, 11, 16, 21, 26]) {
      expect(at(level)).toBeGreaterThan(at(level - 1));
      expect(at(level)).toBe(at(level - 2));
    }
  });

  it('stops at the lowest interval', () => {
    expect(at(40)).toBe(70); // 1.4 s
    expect(at(90)).toBe(70);
  });

  it('keeps the step, the warning and the rise of a cube the same on every level', () => {
    const s = emptyRun();
    const { actionTicks, warnTicks, risingTicks } = s.config;
    reach(s, 30);
    expect(s.level).toBe(30);
    expect(s.config).toMatchObject({ actionTicks, warnTicks, risingTicks });
  });
});

describe('chain window', () => {
  it('is generous at first and shrinks to its floor by level 20, never below it', () => {
    const c = defaultConfig();
    expect(c.sinkingTicks).toBe(500); // 10 s
    expect(sinkTicksAt(c, 1)).toBe(500);
    expect(sinkTicksAt(c, 3)).toBe(500);
    expect(sinkTicksAt(c, 20)).toBe(350); // 7 s
    const floor = msToTicks(DEFAULT_TUNING.sinkFloorMs);
    for (let level = 1; level < 99; level++) {
      expect(sinkTicksAt(c, level + 1)).toBeLessThanOrEqual(sinkTicksAt(c, level));
      expect(sinkTicksAt(c, level)).toBeGreaterThanOrEqual(floor);
    }
  });

  it('never grows with the level, whatever the variables say', () => {
    const c = defaultConfig({}, { sinkStartMs: 4000, sinkFloorMs: 9000 });
    expect(sinkTicksAt(c, 1)).toBe(200);
    expect(sinkTicksAt(c, 40)).toBe(200);
  });

  it('follows the level of the run and leaves sinking cubes at their height', () => {
    const config = defaultConfig({ floorLift: false, gentleStart: false });
    const s = createRun({ seed: 1, config, empty: true });
    s.spawnEnabled = false;
    const half = put(s, 0, 0, 5, 'sinking');
    half.t = s.config.sinkingTicks / 2;
    reach(s, 12);
    expect(s.level).toBe(12);
    expect(s.config.sinkingTicks).toBe(sinkTicksAt(s.config, 12));
    expect(s.config.sinkingTicks).toBeLessThan(500);
    expect(cubeHeight(half, s.config)).toBeCloseTo(0.5, 2);
    // The run keeps a config of its own: the one it was given is as it was.
    expect(config.sinkingTicks).toBe(500);
  });

  it('removes a cube after the window of the level it is on', () => {
    const s = emptyRun();
    reach(s, 20);
    put(s, 0, 0, 5, 'sinking');
    run(s, 349);
    expect(s.cubes.length).toBe(1);
    run(s, 1);
    expect(s.cubes.length).toBe(0);
  });
});

describe('silence at the start of a phase', () => {
  function playing(tuning: Partial<Tuning> = {}): RunState {
    const s = emptyRun({}, 1, { helpRate: 0, ...tuning });
    s.spawnEnabled = true;
    return s;
  }

  it('does not open a run', () => {
    expect(createRun({ seed: 3, config: defaultConfig() }).calmLeft).toBe(0);
    const s = playing();
    expect(collect(s, interval(s)).some(warned)).toBe(true);
  });

  it('holds every regular cube for the calm time, then lets them come again', () => {
    const s = playing();
    reach(s, 6);
    expect(s.level).toBe(6);
    const calm = msToTicks(DEFAULT_TUNING.calmMs);
    expect(collect(s, calm - 1).some(warned)).toBe(false);
    expect(s.cubes.length + s.pending.length).toBe(0);
    expect(collect(s, interval(s)).some(warned)).toBe(true);
  });

  it('comes with the first level of a phase only', () => {
    for (const level of [2, 5, 7, 10]) {
      const s = playing();
      reach(s, level);
      expect(s.calmLeft).toBe(0);
      expect(collect(s, interval(s)).some(warned)).toBe(true);
    }
    for (const level of [6, 11, 16]) {
      const s = playing();
      reach(s, level);
      expect(s.calmLeft).toBeGreaterThan(0);
    }
  });

  it('can be tuned away', () => {
    const s = playing({ calmMs: 0 });
    reach(s, 6);
    expect(collect(s, interval(s)).some(warned)).toBe(true);
  });
});

describe('silence a chain buys', () => {
  /** Three sinking 3s and a fourth that joined them: a chain of two links. */
  function chainOfTwo(experiments: Partial<ExperimentConfig> = {}, tuning: Partial<Tuning> = {}, seed = 1): RunState {
    const s = emptyRun(experiments, seed, { feedRate: 0, helpRate: 0, ...tuning });
    put(s, 2, 3, 3);
    put(s, 3, 3, 3);
    land(s, put(s, 4, 3, 3));
    land(s, put(s, 5, 3, 3));
    s.spawnEnabled = true;
    return s;
  }

  it('holds regular cubes while the chain runs and for 1.5 s a link after it', () => {
    const s = chainOfTwo();
    expect(s.reactions).toMatchObject([{ chain: 2 }]);
    expect(collect(s, s.config.sinkingTicks).some(warned)).toBe(false);
    expect(s.cubes.length).toBe(0);
    expect(s.reactions.length).toBe(0);
    const calm = msToTicks(2 * DEFAULT_TUNING.chainCalmMs);
    expect(collect(s, calm - 1).some(warned)).toBe(false);
    expect(collect(s, interval(s)).some(warned)).toBe(true);
  });

  it('is not bought by a plain group', () => {
    const s = emptyRun({}, 1, { feedRate: 0, helpRate: 0 });
    put(s, 2, 3, 3);
    put(s, 3, 3, 3);
    land(s, put(s, 4, 3, 3));
    s.spawnEnabled = true;
    expect(s.reactions).toMatchObject([{ chain: 1 }]);
    expect(collect(s, interval(s)).some(warned)).toBe(true);
    run(s, s.config.sinkingTicks);
    expect(s.chainCalmLeft).toBe(0);
  });

  it('is never longer than its limit', () => {
    const s = chainOfTwo({}, { chainCalmMs: 5000 });
    run(s, s.config.sinkingTicks);
    expect(s.reactions.length).toBe(0);
    const limit = msToTicks(DEFAULT_TUNING.chainCalmMaxMs);
    expect(s.chainCalmLeft).toBeLessThanOrEqual(limit);
    expect(s.chainCalmLeft).toBeGreaterThan(limit - 5);
  });

  it('is an experiment: switched off, cubes come through a chain as before', () => {
    const s = chainOfTwo({ chainCalm: false });
    expect(collect(s, interval(s)).some(warned)).toBe(true);
    run(s, s.config.sinkingTicks);
    expect(s.chainCalmLeft).toBe(0);
  });

  it('is on by default and belongs to the record key', () => {
    expect(defaultConfig().experiments.chainCalm).toBe(true);
    expect(ruleKey(defaultConfig({ chainCalm: false }))).not.toBe(ruleKey(defaultConfig()));
    expect(ruleKey(defaultConfig()).startsWith('0.7')).toBe(true);
  });
});

describe('cubes for a chain', () => {
  /** A cube announced one move away from the sinking 3s, showing a 3 where it can be seen. */
  function expectFeeder(s: RunState): void {
    expect(s.pending.length).toBe(1);
    const { x, z, ori: o } = s.pending[0];
    const distance = Math.min(...s.cubes.map((c) => Math.abs(c.x - x) + Math.abs(c.z - z)));
    expect(distance).toBe(2);
    expect([o.top, o.south, o.east]).toContain(3);
  }

  function sinkingThrees(seed: number, joined: boolean): RunState {
    const s = emptyRun({}, seed, { feedRate: 1, helpRate: 0 });
    put(s, 2, 3, 3);
    put(s, 3, 3, 3);
    land(s, put(s, 4, 3, 3));
    if (joined) land(s, put(s, 5, 3, 3));
    s.spawnEnabled = true;
    return s;
  }

  it('come through the silence of a running chain', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = sinkingThrees(seed, true);
      expect(s.reactions).toMatchObject([{ chain: 2 }]);
      run(s, interval(s));
      expectFeeder(s);
    }
  });

  it('come through the silence of a phase', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = sinkingThrees(seed, false);
      s.calmLeft = 1000;
      run(s, interval(s));
      expectFeeder(s);
    }
  });

  it('are the only ones that do: with no feeding the silence is complete', () => {
    const s = emptyRun({}, 1, { feedRate: 0, helpRate: 0 });
    put(s, 2, 3, 3);
    put(s, 3, 3, 3);
    land(s, put(s, 4, 3, 3));
    s.spawnEnabled = true;
    s.calmLeft = 1000;
    expect(collect(s, interval(s) * 3).some(warned)).toBe(false);
  });
});

describe('time limited profile', () => {
  const c = defaultConfig();
  const at = (tick: number, level = 1, cubes = c.targetCubes) => paceIntervalTicks(c, 'timed', level, tick, cubes);

  it('is fast from the first second and faster to the end', () => {
    expect(at(0)).toBe(150); // 3 s
    expect(at(c.timedTicks / 3)).toBe(125); // 2.5 s
    expect(at((c.timedTicks * 2) / 3)).toBe(100); // 2 s
    expect(at(c.timedTicks)).toBe(75); // 1.5 s
    for (let tick = 0; tick < c.timedTicks; tick += 50) expect(at(tick + 50)).toBeLessThanOrEqual(at(tick));
    expect(at(0)).toBeLessThan(paceIntervalTicks(c, 'endless', 1, 0, c.targetCubes));
  });

  it('depends on the tick alone, not on the level', () => {
    for (const tick of [0, 1000, 4000, 8999]) {
      for (const cubes of [0, 13, 14, 22, 30]) {
        expect(at(tick, 9, cubes)).toBe(at(tick, 1, cubes));
        expect(at(tick, 40, cubes)).toBe(at(tick, 1, cubes));
      }
    }
  });

  it('counts three phases by the clock', () => {
    expect(timedPhase(c, 0)).toBe(1);
    expect(timedPhase(c, c.timedTicks / 3 - 1)).toBe(1);
    expect(timedPhase(c, c.timedTicks / 3)).toBe(2);
    expect(timedPhase(c, (c.timedTicks * 2) / 3)).toBe(3);
    expect(timedPhase(c, c.timedTicks * 5)).toBe(3);
  });

  it('takes its level from the clock: cubes removed do not raise it', () => {
    const s = createRun({ seed: 5, config: defaultConfig({}, { cubesPerLevel: 1 }), timed: true });
    for (const cube of s.cubes.slice(1, 5)) cube.state = 'sinking';
    const third = s.config.timedTicks / 3;
    const first = collect(s, third);
    expect(s.removed).toBe(4);
    expect(s.level).toBe(1);
    expect(first.some((e) => e.type === 'levelUp')).toBe(false);
    step(s, null);
    expect(s.level).toBe(2);
    expect(s.events).toContainEqual({ type: 'levelUp', level: 2 });
    const rest = collect(s, s.config.timedTicks);
    expect(s.level).toBe(3);
    expect(rest.filter((e) => e.type === 'levelUp')).toEqual([{ type: 'levelUp', level: 3 }]);
    expect(s.endReason).toBe('time');
  });

  it('rests for a moment at the start of the second and the third minute', () => {
    // Nobody plays: the pace is slowed so that the board does not fill before the clock runs out.
    const slow = { timedStartMs: 6000, timedEndMs: 6000 };
    const s = createRun({ seed: 5, config: defaultConfig({ gentleStart: false, floorLift: false }, slow), timed: true });
    const third = s.config.timedTicks / 3;
    const calm = msToTicks(DEFAULT_TUNING.timedCalmMs);
    expect(s.calmLeft).toBe(0);
    expect(collect(s, third).filter(warned).length).toBeGreaterThan(5);
    expect(collect(s, calm).some(warned)).toBe(false);
    expect(collect(s, third - calm).some(warned)).toBe(true);
    expect(s.over).toBe(false);
    expect(collect(s, calm).some(warned)).toBe(false);
    expect(collect(s, third - calm - 1).some(warned)).toBe(true);
    expect(s.over).toBe(false);
  });

  it('keeps Endless on the cubes removed', () => {
    const s = createRun({ seed: 5, config: defaultConfig() });
    run(s, s.config.timedTicks);
    expect(s.level).toBe(1);
  });
});

describe('run report', () => {
  it('counts the time, the cubes that came and the cubes removed for every level', () => {
    const s = emptyRun({}, 1, { cubesPerLevel: 2 });
    for (let x = 0; x < 3; x++) put(s, x, 0, 6, 'sinking');
    spawnCube(s, 5, 5, ori({ top: 5 }));
    run(s, s.config.sinkingTicks);
    expect(s.level).toBe(2);
    expect(s.stats.levels.length).toBe(2);
    expect(s.stats.levels[0]).toMatchObject({ spawned: 1, removed: 2 });
    expect(s.stats.levels[1]).toMatchObject({ spawned: 0, removed: 1 });
    expect(s.stats.levels[0].ticks + s.stats.levels[1].ticks).toBe(s.tick);
    expect(s.stats.levels[0].ticks).toBeGreaterThan(s.stats.levels[1].ticks);
  });

  it('counts every cube that timed spawning brings', () => {
    const s = createRun({ seed: 11, config: defaultConfig({ gentleStart: false, floorLift: false }) });
    const spawns = collect(s, 3000).filter((e) => e.type === 'spawn').length;
    expect(spawns).toBeGreaterThan(0);
    expect(s.stats.levels.reduce((sum, level) => sum + level.spawned, 0)).toBe(spawns);
  });

  it('counts the time the board spent at the danger mark', () => {
    const s = emptyRun();
    for (let i = 0; i < 41; i++) put(s, i % 7, Math.floor(i / 7), (i % 7 + Math.floor(i / 7)) % 2 === 0 ? 6 : 5);
    place(s, 0, 0, 'top');
    run(s, 10);
    expect(s.stats.dangerTicks).toBe(0);
    put(s, 6, 5, 5);
    run(s, 10);
    expect(s.stats.dangerTicks).toBe(10);
  });

  it('remembers the longest silence a chain has bought', () => {
    const s = emptyRun({}, 1, { feedRate: 0, helpRate: 0 });
    put(s, 2, 3, 3);
    put(s, 3, 3, 3);
    land(s, put(s, 4, 3, 3));
    land(s, put(s, 5, 3, 3));
    s.spawnEnabled = true;
    expect(s.stats.longestChainQuiet).toBe(0);
    const whole = s.config.sinkingTicks + msToTicks(2 * DEFAULT_TUNING.chainCalmMs);
    run(s, whole + 200);
    expect(s.stats.longestChainQuiet).toBeGreaterThan(whole - 3);
    expect(s.stats.longestChainQuiet).toBeLessThanOrEqual(whole);
  });
});

describe('determinism of the pace', () => {
  function play(timed: boolean, config = defaultConfig()): string {
    const s = createRun({ seed: 99, config, timed });
    const dirs: Dir[] = ['N', 'E', 'S', 'W'];
    for (let i = 0; i < 9000 && !s.over; i++) {
      step(s, i % 7 === 0 ? dirs[(i / 7) % 4 | 0] : null);
    }
    return JSON.stringify(s);
  }

  it('gives one run for one seed, counters of silence and report included', () => {
    expect(play(false)).toBe(play(false));
    expect(play(true)).toBe(play(true));
    expect(play(true)).not.toBe(play(false));
  });

  it('leaves the config it was given untouched', () => {
    const config = defaultConfig();
    const before = JSON.stringify(config);
    play(false, config);
    play(true, config);
    expect(JSON.stringify(config)).toBe(before);
  });
});
