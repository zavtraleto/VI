import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, defaultConfig, livePhase, livePhases, msToTicks, paceIntervalTicks } from './config';
import { LIVE_STEPS, liveConfig } from './live';
import { createRun, step } from './sim';
import { run } from './testkit';
import type { Dir, GameEvent, RunState } from './types';
import { swell } from './wave';

function collect(s: RunState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

const minute = msToTicks(60_000);

describe('a live session on its clock', () => {
  it('ends when the clock runs out and says why', () => {
    const s = createRun({ seed: 5, config: defaultConfig({}, { liveSec: 30 }), live: true });
    expect(s.mode).toBe('live');
    run(s, s.config.liveTicks - 1);
    expect(s.over).toBe(false);
    step(s, null);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('time');
    expect(s.events).toContainEqual({ type: 'gameOver' });
    expect(s.tick).toBe(s.config.liveTicks);
  });

  it('does not put a clock on Endless', () => {
    const s = createRun({ seed: 5, config: defaultConfig({}, { liveSec: 30 }) });
    expect(s.mode).toBe('endless');
    run(s, s.config.liveTicks + 100);
    expect(s.over).toBe(false);
    expect(s.endReason).toBeNull();
  });
});

describe('the pace of a live session', () => {
  const c = defaultConfig();
  const at = (tick: number, level = 1, cubes = c.targetCubes) => paceIntervalTicks(c, 'live', level, tick, cubes);
  const levelUp = (e: GameEvent) => e.type === 'levelUp';
  // Nobody plays: the pace is slowed so that the board does not fill before the clock runs out.
  const slow = { liveStartMs: 12000, liveEndMs: 12000 };

  it('lasts three minutes', () => {
    expect(c.liveTicks).toBe(3 * minute);
  });

  it('is fast from the first second and faster to the end', () => {
    expect(at(0)).toBe(150); // 3 s
    expect(at(c.liveTicks / 2)).toBe(113); // 2.25 s
    expect(at(c.liveTicks)).toBe(75); // 1.5 s
    for (let tick = 0; tick < c.liveTicks; tick += 50) expect(at(tick + 50)).toBeLessThanOrEqual(at(tick));
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

  it('stretches on the last sliver of the board as Endless does', () => {
    expect(at(0, 1, 49)).toBeGreaterThan(at(0, 1, 42));
    expect(at(0, 1, 49)).toBe(msToTicks(DEFAULT_TUNING.liveStartMs * DEFAULT_TUNING.edgeFactor));
  });

  it('takes the swell of a wave, and never goes under the interval it ends at', () => {
    expect(paceIntervalTicks(c, 'live', 1, 0, c.targetCubes, 1.2)).toBe(180); // 3 s x 1.2
    expect(paceIntervalTicks(c, 'live', 1, 0, c.targetCubes, 0.75)).toBe(113); // 3 s x 0.75
    expect(paceIntervalTicks(c, 'live', 1, c.liveTicks, c.targetCubes, 0.75)).toBe(75); // 1.5 s
    expect(paceIntervalTicks(c, 'live', 1, c.liveTicks, c.targetCubes, 1.2)).toBe(90); // 1.5 s x 1.2
  });

  it('counts three phases by the clock, a minute each', () => {
    expect(livePhases(c)).toBe(3);
    expect(livePhase(c, 0)).toBe(1);
    expect(livePhase(c, minute - 1)).toBe(1);
    expect(livePhase(c, minute)).toBe(2);
    expect(livePhase(c, 2 * minute)).toBe(3);
    expect(livePhase(c, c.liveTicks * 5)).toBe(3);
  });

  it('has a phase to every minute of a session of another length', () => {
    const five = defaultConfig({}, { liveSec: 300 });
    expect(livePhases(five)).toBe(5);
    expect(livePhase(five, 10 * minute)).toBe(5);
    expect(livePhases(defaultConfig({}, { liveSec: 30 }))).toBe(1);
  });

  it('takes its level from the clock through all three phases: cubes removed do not raise it', () => {
    const config = defaultConfig({ gentleStart: false, floorLift: false }, { cubesPerLevel: 1, ...slow });
    const s = createRun({ seed: 5, config, live: true });
    for (const cube of s.cubes.slice(1, 5)) cube.state = 'sinking';
    const first = collect(s, minute);
    expect(s.removed).toBe(4);
    expect(s.level).toBe(1);
    expect(first.some(levelUp)).toBe(false);
    step(s, null);
    expect(s.level).toBe(2);
    expect(s.events).toContainEqual({ type: 'levelUp', level: 2 });
    const rest = collect(s, s.config.liveTicks);
    expect(rest.filter(levelUp)).toEqual([{ type: 'levelUp', level: 3 }]);
    expect(s.level).toBe(3);
    expect(s.endReason).toBe('time');
    expect(s.tick).toBe(3 * minute);
  });

  it('comes in waves that are the same whatever the player does', () => {
    const played = (moves: boolean): RunState => {
      const s = createRun({ seed: 42, config: liveConfig(1), live: true });
      const dirs: Dir[] = ['N', 'E', 'S', 'W'];
      for (let i = 0; i < 3500 && !s.over; i++) step(s, moves && i % 7 === 0 ? dirs[(i / 7) % 4 | 0] : null);
      return s;
    };
    const idle = played(false);
    const busy = played(true);
    expect(idle.over || busy.over).toBe(false);
    expect(busy.wave.index).toBeGreaterThanOrEqual(1);
    expect(busy.wave).toEqual(idle.wave);
    expect(swell(busy)).toBe(swell(idle));
    expect(played(true).wave).toEqual(busy.wave);
  });

  it('gives one run for one seed', () => {
    const play = (): string => {
      const s = createRun({ seed: 99, config: liveConfig(2), live: true });
      const dirs: Dir[] = ['N', 'E', 'S', 'W'];
      for (let i = 0; i < 16000 && !s.over; i++) step(s, i % 7 === 0 ? dirs[(i / 7) % 4 | 0] : null);
      return JSON.stringify([s.tick, s.score, s.cubes, s.stats]);
    };
    expect(play()).toBe(play());
  });
});

describe('the steps of the live sessions', () => {
  it('are seven, every one three minutes long', () => {
    expect(LIVE_STEPS).toHaveLength(7);
    for (let step = 1; step <= 7; step++) expect(liveConfig(step).liveTicks).toBe(3 * minute);
  });

  it('grow harder: a faster pace, a shorter gentle start, fewer gifts', () => {
    const [one, two, three] = [1, 2, 3].map((step) => liveConfig(step));
    expect(one.gentleTicks).toBeGreaterThanOrEqual(one.liveTicks);
    expect(two.gentleTicks).toBeLessThan(one.gentleTicks);
    expect(three.giftRate).toBeLessThan(two.giftRate);
    for (let step = 1; step < 7; step++) {
      const [now, next] = [liveConfig(step), liveConfig(step + 1)];
      expect(next.liveStartMs, `step ${step + 1}`).toBeLessThanOrEqual(now.liveStartMs);
      expect(next.liveEndMs, `step ${step + 1}`).toBeLessThanOrEqual(now.liveEndMs);
      expect(next.giftRate, `step ${step + 1}`).toBeLessThanOrEqual(now.giftRate);
      const harder = next.liveStartMs < now.liveStartMs || next.liveEndMs < now.liveEndMs || next.giftRate < now.giftRate;
      expect(harder, `step ${step + 1}`).toBe(true);
    }
    for (let step = 3; step <= 7; step++) expect(liveConfig(step).gentleTicks, `step ${step}`).toBe(0);
  });

  it('play the last step past the last, and the first below the first', () => {
    expect(liveConfig(9)).toEqual(liveConfig(7));
    expect(liveConfig(0)).toEqual(liveConfig(1));
  });

  it('keep the first one from being lost with nobody at it: it is all gentle start', () => {
    const s = createRun({ seed: 5, config: liveConfig(1, { floorLift: false }), live: true });
    run(s, s.config.liveTicks);
    expect(s.endReason).toBe('time');
  });

  it('let the third one and those after it be lost: with nobody at it the board fills before the clock runs out', () => {
    for (const at of [3, 4, 7]) {
      const s = createRun({ seed: 5, config: liveConfig(at, { floorLift: false }), live: true });
      run(s, s.config.liveTicks);
      expect(s.endReason, `step ${at}`).toBe('full');
      expect(s.tick, `step ${at}`).toBeLessThan(s.config.liveTicks);
    }
  });
});
