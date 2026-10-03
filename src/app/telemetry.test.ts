import { describe, expect, it } from 'vitest';
import { createRun, defaultConfig, type GameEvent } from '../rules';
import { FrameSampler, RunTally, checkpoint, levelSummary, runSummary, type EventData } from './telemetry';

const run = () => createRun({ seed: 7, config: defaultConfig() });

describe('what a run adds up to', () => {
  it('counts groups by their number, chains by how long they got, and the ones', () => {
    const tally = new RunTally();
    const events: GameEvent[] = [
      { type: 'match', reactionId: 1, value: 2, count: 2, points: 4 },
      { type: 'match', reactionId: 2, value: 2, count: 2, points: 4 },
      { type: 'match', reactionId: 3, value: 5, count: 5, points: 25 },
      { type: 'chain', reactionId: 1, value: 2, chain: 2, count: 3, points: 12 },
      { type: 'chain', reactionId: 1, value: 2, chain: 3, count: 4, points: 24 },
      { type: 'chain', reactionId: 3, value: 5, chain: 2, count: 6, points: 60 },
      { type: 'chain', reactionId: 9, value: 4, chain: 6, count: 9, points: 200 },
      { type: 'happyOne', count: 3, points: 3 },
    ];
    for (const event of events) tally.note(event);
    expect(tally.values()).toMatchObject({ match_2: 2, match_3: 0, match_5: 1, chains_2: 1, chains_3: 1, chains_4plus: 1, ones: 3, saves: 0 });
    tally.reset();
    expect(tally.values()).toMatchObject({ match_2: 0, chains_2: 0, chains_4plus: 0, ones: 0 });
  });

  it('counts a board that came back from the danger mark as saved', () => {
    const tally = new RunTally();
    const state = run();
    const crowd = (count: number) => (state.cubes.length = count);
    const cube = state.cubes[0];
    while (state.cubes.length < state.config.warnOccupied) state.cubes.push({ ...cube });
    tally.watch(state);
    crowd(state.config.warnOccupied - 1);
    tally.watch(state);
    tally.watch(state);
    expect(tally.values().saves).toBe(1);
  });
});

describe('the summary of a session', () => {
  it('is made of plain values, with the rules it was played by', () => {
    const state = run();
    const data = runSummary(state, new RunTally());
    expect(typeof data.rules).toBe('string');
    for (const value of Object.values(data)) expect(['string', 'number', 'boolean']).toContain(typeof value);
    expect(data).toMatchObject({ score: 0, level: 1, clears: 0, cubes_end: state.cubes.length });
  });

  it('counts the ways up from the floor and the steps the docks gave', () => {
    const state = run();
    expect(runSummary(state, new RunTally())).toMatchObject({ floor_climbs: 0, dock_descents: 0, dock_climbs: 0 });
    state.stats.floorClimbs = 3;
    state.stats.dockDescents = 2;
    state.stats.dockClimbs = 1;
    expect(runSummary(state, new RunTally())).toMatchObject({ floor_climbs: 3, dock_descents: 2, dock_climbs: 1 });
  });

  it('leaves the first group out where there was none, and gives its time where there was', () => {
    const state = run();
    expect('first_clear_sec' in runSummary(state, new RunTally())).toBe(false);
    state.stats.clearTicks.push(500);
    expect(runSummary(state, new RunTally()).first_clear_sec).toBe((500 * state.config.tickMs) / 1000);
  });

  it('says how long a passed level took and what it did to the board', () => {
    const state = run();
    state.stats.levels = [
      { ticks: 1000, spawned: 12, removed: 10 },
      { ticks: 10, spawned: 1, removed: 0 },
    ];
    expect(levelSummary(state, 1)).toMatchObject({ step_index: 1, duration_sec: (1000 * state.config.tickMs) / 1000, spawned: 12, removed: 10 });
    expect('duration_sec' in levelSummary(state, 5)).toBe(false);
    expect(checkpoint(state, 3)).toMatchObject({ minute: 3, level: 1, cubes: state.cubes.length });
  });
});

describe('the sample of frames', () => {
  const sampler = () => {
    const sent: EventData[] = [];
    return { sent, sampler: new FrameSampler((sample) => sent.push(sample)) };
  };

  it('is sent once for about every thirty seconds of play', () => {
    const { sent, sampler: frames } = sampler();
    let now = 0;
    for (let i = 0; i < 60 * 31; i++) frames.frame(true, 1000 / 60, (now += 1000 / 60));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ target_fps: 60, frames_over_50ms: 0, frames_over_1000ms: 0, js_error_count: 0 });
    expect(sent[0].fps_avg).toBeCloseTo(60, 0);
    expect(sent[0].fps_p10).toBeCloseTo(60, 0);
    expect(Number(sent[0].active_ms)).toBeGreaterThanOrEqual(30_000);
    expect(Math.abs(Number(sent[0].frame_count) - 1800)).toBeLessThanOrEqual(1);
  });

  it('does not take a pause or a hidden page for a frozen frame', () => {
    const { sent, sampler: frames } = sampler();
    let now = 0;
    for (let i = 0; i < 600; i++) frames.frame(true, 16, (now += 16));
    frames.frame(false, 16, (now += 16));
    // A minute away, and the first frame back carries the whole of it.
    now += 60_000;
    frames.frame(true, 60_000, now);
    for (let i = 0; i < 600; i++) frames.frame(true, 16, (now += 16));
    frames.flush(now);
    expect(sent).toHaveLength(1);
    expect(sent[0].frame_time_max_ms).toBe(16);
    expect(sent[0].frames_over_1000ms).toBe(0);
    expect(Number(sent[0].window_ms)).toBeGreaterThan(60_000);
    expect(Number(sent[0].active_ms)).toBeLessThan(20_000);
  });

  it('counts the slow frames and what went wrong, within the sample alone', () => {
    const { sent, sampler: frames } = sampler();
    let now = 0;
    frames.frame(true, 16, (now += 16));
    for (const time of [60, 120, 300, 16, 16]) frames.frame(true, time, (now += time));
    for (let i = 0; i < 400; i++) frames.frame(true, 16, (now += 16));
    frames.noteError('error');
    frames.noteError('contextLoss');
    frames.flush(now);
    expect(sent[0]).toMatchObject({ frames_over_50ms: 3, frames_over_100ms: 2, frames_over_250ms: 1, frames_over_500ms: 0, js_error_count: 1, webgl_context_loss_count: 1 });
    for (let i = 0; i < 400; i++) frames.frame(true, 16, (now += 16));
    frames.flush(now);
    expect(sent[1]).toMatchObject({ frames_over_50ms: 0, js_error_count: 0, webgl_context_loss_count: 0 });
  });

  it('sends nothing for a stretch of play too short to say anything', () => {
    const { sent, sampler: frames } = sampler();
    let now = 0;
    for (let i = 0; i < 100; i++) frames.frame(true, 16, (now += 16));
    frames.flush(now);
    expect(sent).toEqual([]);
  });
});
