import { describe, expect, it } from 'vitest';
import { cubeHeight } from './board';
import { DEFAULT_TUNING, defaultConfig, msToTicks, paceIntervalTicks, ruleKey, sinkTicksAt, timedPhase, timedPhases } from './config';
import { createRun, step } from './sim';
import { chainQuiet, population, spawnCube } from './spawn';
import { emptyRun, land, ori, place, put, run } from './testkit';
import type { Dir, ExperimentConfig, GameEvent, RunState, Tuning, Wave } from './types';

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
  const at = (level: number, config = c) => paceIntervalTicks(config, 'endless', level, 0, config.targetCubes);

  /** Cubes in a tick at a level: the flow, where the interval is the time between two of them. */
  const flow = (level: number, config = c) => 1 / at(level, config);

  it('holds the starting interval on the first level alone: the second is already faster', () => {
    expect(at(1)).toBe(250); // 5 s
    expect(at(2)).toBeLessThan(at(1));
    expect(at(3)).toBeLessThan(at(2));
  });

  it('holds it for as many levels as the variable says', () => {
    const flat = defaultConfig({}, { paceFlatLevels: 3 });
    expect(at(2, flat)).toBe(at(1, flat));
    expect(at(3, flat)).toBe(at(1, flat));
    expect(at(4, flat)).toBe(at(2));
  });

  it('adds the same flow with every level: cubes in a minute grow by a line, not by a curve', () => {
    const growth = DEFAULT_TUNING.paceGrowth;
    expect(growth).toBeGreaterThan(0);
    expect(flow(11) / flow(1)).toBeCloseTo(1 + growth * 10, 1);
    expect(flow(21) / flow(1)).toBeCloseTo(1 + growth * 20, 1);
    // Five levels add the same flow wherever they are, give or take the rounding of an interval to ticks.
    const added = flow(6) - flow(1);
    expect(Math.abs(flow(11) - flow(6) - added) / added).toBeLessThan(0.1);
    expect(Math.abs(flow(21) - flow(16) - added) / added).toBeLessThan(0.1);
  });

  it('speeds up less the faster it goes: skill buys time in proportion', () => {
    expect(at(1) - at(2)).toBeGreaterThan(at(11) - at(12));
    expect(at(11) - at(12)).toBeGreaterThan(at(31) - at(32));
  });

  it('follows the growth it is given', () => {
    const steep = defaultConfig({}, { paceGrowth: 0.2 });
    expect(at(6, steep)).toBe(125); // 5 s at twice the starting flow
    expect(at(6, defaultConfig({}, { paceGrowth: 0 }))).toBe(250);
  });

  it('never slows down with the level: the rests are the waves\' own', () => {
    for (let level = 1; level < 60; level++) expect(at(level + 1)).toBeLessThanOrEqual(at(level));
  });

  it('stops at the lowest interval', () => {
    const steep = defaultConfig({}, { paceGrowth: 0.2 });
    expect(at(45, steep)).toBeGreaterThan(25);
    expect(at(46, steep)).toBe(25); // 0.5 s: ten times the starting flow
    expect(at(90, steep)).toBe(25);
    expect(at(200)).toBe(25);
  });

  it('keeps the step, the warning and the rise of a cube the same on every level', () => {
    const s = emptyRun();
    const { actionTicks, warnTicks, risingTicks } = s.config;
    reach(s, 30);
    expect(s.level).toBe(30);
    expect(s.config).toMatchObject({ actionTicks, warnTicks, risingTicks });
  });
});

describe('level of an endless run', () => {
  const levelTicks = msToTicks(DEFAULT_TUNING.levelSec * 1000);
  const levelUp = (e: GameEvent) => e.type === 'levelUp';

  it('rises with the time alone: a level every 40 s with no cube removed', () => {
    const s = emptyRun();
    expect(DEFAULT_TUNING.levelSec).toBe(40);
    expect(collect(s, levelTicks).some(levelUp)).toBe(false);
    expect(s.level).toBe(1);
    step(s, null);
    expect(s.level).toBe(2);
    expect(s.events).toContainEqual({ type: 'levelUp', level: 2 });
    // When the sixth minute is out the run is on the tenth level.
    run(s, levelTicks * 8);
    expect(s.level).toBe(10);
    expect(s.removed).toBe(0);
  });

  it('takes sixteen cubes for a level', () => {
    expect(defaultConfig().cubesPerLevel).toBe(16);
  });

  it('is led by the cubes when they go faster than the clock: the greater of the two', () => {
    const s = emptyRun();
    reach(s, 4);
    expect(s.level).toBe(4);
    run(s, levelTicks * 2);
    expect(s.level).toBe(4);
    run(s, levelTicks * 2);
    expect(s.level).toBe(5);
  });

  it('is an experiment: switched off, only the cubes removed raise the level', () => {
    const s = emptyRun({ timeFloor: false });
    run(s, levelTicks * 3);
    expect(s.level).toBe(1);
    reach(s, 2);
    expect(s.level).toBe(2);
  });

  it('is on by default and belongs to the record key', () => {
    expect(defaultConfig().experiments.timeFloor).toBe(true);
    expect(ruleKey(defaultConfig({ timeFloor: false }))).not.toBe(ruleKey(defaultConfig()));
  });

  it('leaves the exercise on its own level', () => {
    const s = createRun({ seed: 1, config: defaultConfig(), tutorial: true });
    run(s, levelTicks * 2);
    expect(s.level).toBe(1);
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

  it('holds regular cubes while the chain runs and for 0.8 s a link after it', () => {
    const s = chainOfTwo({}, { chainCalmMaxMs: 20000 });
    expect(s.reactions).toMatchObject([{ chain: 2 }]);
    expect(collect(s, s.config.sinkingTicks).some(warned)).toBe(false);
    expect(s.cubes.length).toBe(0);
    expect(s.reactions.length).toBe(0);
    expect(DEFAULT_TUNING.chainCalmMs).toBe(800);
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

  it('holds the noise no longer than its limit in one stretch, however long the chain runs', () => {
    const s = chainOfTwo({}, { chainCalmMaxMs: 3000 });
    const limit = msToTicks(3000);
    expect(limit).toBeLessThan(s.config.sinkingTicks);
    expect(collect(s, limit).some(warned)).toBe(false);
    // The chain is still running, and the noise is back.
    expect(s.reactions).toMatchObject([{ chain: 2 }]);
    expect(chainQuiet(s)).toBe(false);
    expect(collect(s, interval(s)).some(warned)).toBe(true);
  });

  it('is bought anew by the next chain, once the one that spent it is over', () => {
    // No cube comes by itself: the board is what the test puts on it.
    const s = chainOfTwo({}, { chainCalmMaxMs: 3000, targetCubes: 0, paceStartMs: 600000 });
    run(s, s.config.sinkingTicks + msToTicks(3000));
    expect(s.cubes.length).toBe(0);
    expect(s.reactions.length).toBe(0);
    expect(chainQuiet(s)).toBe(false);
    put(s, 0, 0, 2);
    land(s, put(s, 1, 0, 2));
    land(s, put(s, 2, 0, 2));
    expect(s.reactions).toMatchObject([{ chain: 2 }]);
    expect(chainQuiet(s)).toBe(true);
    run(s, msToTicks(3000));
    expect(chainQuiet(s)).toBe(false);
  });

  it('adds no more silence after a chain than its limit', () => {
    const s = chainOfTwo({}, { chainCalmMs: 30000 });
    run(s, s.config.sinkingTicks);
    expect(s.reactions.length).toBe(0);
    expect(DEFAULT_TUNING.chainCalmMaxMs).toBe(8000);
    const limit = msToTicks(DEFAULT_TUNING.chainCalmMaxMs);
    expect(s.chainCalmLeft).toBeLessThanOrEqual(limit);
    expect(s.chainCalmLeft).toBeGreaterThan(limit - 5);
  });

  it('can be tuned away: with no limit to spend there is no silence', () => {
    const s = chainOfTwo({}, { chainCalmMaxMs: 0 });
    expect(chainQuiet(s)).toBe(false);
    expect(collect(s, interval(s)).some(warned)).toBe(true);
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
    expect(ruleKey(defaultConfig()).startsWith('0.9')).toBe(true);
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

  /** A wave that has broken and rests for longer than a test lasts. */
  const AT_REST: Wave = { index: 0, start: 0, build: 0, rest: 100000 };

  function sinkingThrees(seed: number, joined: boolean): RunState {
    const s = emptyRun({ waves: true }, seed, { feedRate: 1, helpRate: 0, restFlow: 0 });
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

  it('come through the rest of a wave', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = sinkingThrees(seed, false);
      s.wave = AT_REST;
      run(s, interval(s));
      expectFeeder(s);
    }
  });

  it('are the only ones that do: with no feeding the silence is complete', () => {
    const s = emptyRun({ waves: true }, 1, { feedRate: 0, helpRate: 0, restFlow: 0 });
    put(s, 2, 3, 3);
    put(s, 3, 3, 3);
    land(s, put(s, 4, 3, 3));
    s.spawnEnabled = true;
    s.wave = AT_REST;
    expect(collect(s, interval(s) * 3).some(warned)).toBe(false);
  });
});

describe('time limited profile', () => {
  const c = defaultConfig();
  const minute = msToTicks(60_000);
  const at = (tick: number, level = 1, cubes = c.targetCubes) => paceIntervalTicks(c, 'timed', level, tick, cubes);
  const levelUp = (e: GameEvent) => e.type === 'levelUp';
  // Nobody plays: the pace is slowed so that the board does not fill before the clock runs out.
  const slow = { timedStartMs: 12000, timedEndMs: 12000 };

  it('lasts three minutes', () => {
    expect(c.timedTicks).toBe(3 * minute);
  });

  it('is fast from the first second and faster to the end', () => {
    expect(at(0)).toBe(150); // 3 s
    expect(at(c.timedTicks / 2)).toBe(113); // 2.25 s
    expect(at(c.timedTicks)).toBe(75); // 1.5 s
    for (let tick = 0; tick < c.timedTicks; tick += 50) expect(at(tick + 50)).toBeLessThanOrEqual(at(tick));
    expect(at(0)).toBeLessThan(paceIntervalTicks(c, 'endless', 1, 0, c.targetCubes));
  });

  it('depends on the tick alone, not on the level', () => {
    for (const tick of [0, 1000, 4000, 8999, 14999]) {
      for (const cubes of [0, 13, 14, 22, 30]) {
        expect(at(tick, 9, cubes)).toBe(at(tick, 1, cubes));
        expect(at(tick, 40, cubes)).toBe(at(tick, 1, cubes));
      }
    }
  });

  it('counts three phases by the clock, a minute each', () => {
    expect(timedPhases(c)).toBe(3);
    expect(timedPhase(c, 0)).toBe(1);
    expect(timedPhase(c, minute - 1)).toBe(1);
    expect(timedPhase(c, minute)).toBe(2);
    expect(timedPhase(c, 2 * minute)).toBe(3);
    expect(timedPhase(c, c.timedTicks * 5)).toBe(3);
  });

  it('has a phase to every minute of a run of another length', () => {
    const five = defaultConfig({}, { timedSec: 300 });
    expect(timedPhases(five)).toBe(5);
    expect(timedPhase(five, 10 * minute)).toBe(5);
    expect(timedPhases(defaultConfig({}, { timedSec: 30 }))).toBe(1);
  });

  it('takes its level from the clock through all three phases: cubes removed do not raise it', () => {
    const config = defaultConfig({ gentleStart: false, floorLift: false }, { cubesPerLevel: 1, ...slow });
    const s = createRun({ seed: 5, config, timed: true });
    for (const cube of s.cubes.slice(1, 5)) cube.state = 'sinking';
    const first = collect(s, minute);
    expect(s.removed).toBe(4);
    expect(s.level).toBe(1);
    expect(first.some(levelUp)).toBe(false);
    step(s, null);
    expect(s.level).toBe(2);
    expect(s.events).toContainEqual({ type: 'levelUp', level: 2 });
    const rest = collect(s, s.config.timedTicks);
    expect(rest.filter(levelUp)).toEqual([{ type: 'levelUp', level: 3 }]);
    expect(s.level).toBe(3);
    expect(s.endReason).toBe('time');
    expect(s.tick).toBe(3 * minute);
  });

  it('can be lost: it has no gentle start, and with nobody at it the board fills before the clock runs out', () => {
    const s = createRun({ seed: 5, config: defaultConfig({ floorLift: false }), timed: true });
    expect(s.config.experiments.gentleStart).toBe(true);
    run(s, s.config.timedTicks);
    expect(s.endReason).toBe('full');
    expect(s.tick).toBeLessThan(s.config.timedTicks);
  });

  it('leaves Endless to be lost once its gentle start is over', () => {
    const s = createRun({ seed: 5, config: defaultConfig({ floorLift: false }) });
    run(s, s.config.gentleTicks);
    expect(s.over).toBe(false);
    run(s, s.config.timedTicks);
    expect(s.endReason).toBe('full');
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
    const s = emptyRun({}, 1, { feedRate: 0, helpRate: 0, chainCalmMaxMs: 20000 });
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
    for (let i = 0; i < 16000 && !s.over; i++) {
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
