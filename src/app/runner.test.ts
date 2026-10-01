import { describe, expect, it } from 'vitest';
import { createRun, defaultConfig, type Dir } from '../rules';
import { Runner } from './runner';

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
});
