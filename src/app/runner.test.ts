import { describe, expect, it } from 'vitest';
import { createRun, defaultConfig, type Dir } from '../rules';
import { ROAD } from '../levels/road';
import { Runner, frameBound } from './runner';

function record(): { log: { tick: number; dir: Dir }[]; endTick: number } {
  const runner = new Runner(createRun({ seed: 2024, config: defaultConfig() }));
  const dirs: Dir[] = ['N', 'E', 'N', 'W', 'S', 'S', 'E', 'W'];
  let n = 0;
  const frames = 60 * 40;
  for (let i = 0; i < frames; i++) {
    runner.advance(1000 / 60, () => (i % 9 === 0 ? dirs[n++ % dirs.length] : null));
  }
  return { log: runner.log, endTick: runner.state.tick };
}

describe('Runner', () => {
  it('reproduces a run from its seed and command log at any frame rate', () => {
    const { log, endTick } = record();
    expect(log.length).toBeGreaterThan(20);
    const results = [20, 1000 / 60, 1000 / 30, 13.7].map((frame) => {
      const s = createRun({ seed: 2024, config: defaultConfig() });
      const runner = new Runner(s);
      let cursor = 0;
      while (s.tick < endTick) {
        const remaining = (endTick - s.tick) * 20;
        runner.advance(Math.min(frame, remaining), () => {
          while (cursor < log.length && log[cursor].tick < s.tick) cursor++;
          return cursor < log.length && log[cursor].tick === s.tick ? log[cursor].dir : null;
        });
      }
      return JSON.stringify(s);
    });
    expect(JSON.parse(results[0]).tick).toBe(endTick);
    for (const r of results) expect(r).toBe(results[0]);
  });

  it('does not advance without time and clamps long frames', () => {
    const runner = new Runner(createRun({ seed: 1, config: defaultConfig() }));
    runner.advance(0, () => null);
    expect(runner.state.tick).toBe(0);
    runner.advance(10_000, () => null);
    expect(runner.state.tick).toBe(12); // 250 ms cap
  });

  it('asks for commands only when the player is free and logs the consumed ones', () => {
    const runner = new Runner(createRun({ seed: 1, config: defaultConfig() }));
    let asked = 0;
    runner.advance(400, () => {
      asked++;
      return 'N';
    });
    expect(runner.log.length).toBe(asked);
    expect(asked).toBeLessThanOrEqual(3);
    expect(runner.log[0]).toEqual({ tick: 0, dir: 'N' });
  });

  it('gives a level a small step of a late frame, and a session the frame as before', () => {
    expect(frameBound(false)).toBe(250);
    expect(frameBound(true)).toBe(40);
    // A session after a stall of a quarter of a second: all of it is played at once.
    const session = new Runner(createRun({ seed: 1, config: defaultConfig() }));
    session.advance(Math.min(250, frameBound(false)), () => null);
    expect(session.state.tick).toBe(12);
  });

  it('never plays a roll of a level out within one late frame', () => {
    const spec = ROAD[0];
    const runner = new Runner(createRun({ seed: spec.seed, config: defaultConfig(), level: spec }));
    const { state } = runner;
    // Every frame comes a quarter of a second late: the worst the page can do.
    let pictures = 0;
    let started = false;
    for (let i = 0; i < 200 && !(started && !state.player.action); i++) {
      const before = state.tick;
      runner.advance(Math.min(250, frameBound(true)), () => (started ? null : 'N'));
      expect(state.tick - before).toBeLessThanOrEqual(2);
      if (state.player.action) {
        started = true;
        pictures++;
      }
    }
    expect(started).toBe(true);
    // The roll is ten ticks, two to a frame at the most: five pictures of it, not one.
    expect(state.config.actionTicks).toBe(10);
    expect(pictures).toBeGreaterThanOrEqual(4);
  });
});
