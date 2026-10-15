import { describe, expect, it } from 'vitest';
import { createRun, defaultConfig, step, type Dir, type RunState } from '../rules';
import { packRun, unpackRun } from './savedRun';
import { RunTally } from './telemetry';

/** Plays a run for a while with a steady hand on the keys. */
function play(state: RunState, ticks: number): void {
  const dirs: Dir[] = ['N', 'E', 'S', 'W'];
  for (let i = 0; i < ticks && !state.over; i++) step(state, i % 7 === 0 ? dirs[(i / 7) % 4 | 0] : null);
}

function running(): RunState {
  const state = createRun({ seed: 11, config: defaultConfig() });
  play(state, 900);
  return state;
}

/** What storage does to a kept run: text and back. */
const stored = (kept: unknown): unknown => JSON.parse(JSON.stringify(kept));

describe('a run kept for later', () => {
  it('comes back as it was left and goes on as it would have', () => {
    const state = running();
    const kept = packRun('endless', state, new RunTally());
    expect(kept).not.toBeNull();
    const back = unpackRun(stored(kept));
    expect(back).not.toBeNull();
    expect(back!.kind).toBe('endless');
    expect(JSON.stringify(back!.state)).toBe(JSON.stringify({ ...state, events: [] }));
    play(state, 2000);
    play(back!.state, 2000);
    expect(back!.state.tick).toBe(state.tick);
    expect(JSON.stringify(back!.state)).toBe(JSON.stringify(state));
  });

  it('is not kept when there is nothing to come back to', () => {
    const tally = new RunTally();
    expect(packRun('endless', createRun({ seed: 11, config: defaultConfig() }), tally)).toBeNull();
    const over = running();
    over.over = true;
    expect(packRun('endless', over, tally)).toBeNull();
  });

  it('is not taken back under other rules, or when what was kept is not a run', () => {
    const kept = stored(packRun('endless', running(), new RunTally())) as { state: RunState };
    expect(unpackRun(kept)).not.toBeNull();
    kept.state.config.rulesVersion = '0.1';
    expect(unpackRun(kept)).toBeNull();
    expect(unpackRun(null)).toBeNull();
    expect(unpackRun({})).toBeNull();
    expect(unpackRun('a run')).toBeNull();
    const broken = stored(packRun('endless', running(), new RunTally())) as { state: RunState };
    broken.state.grid = [1, 2, 3];
    expect(unpackRun(broken)).toBeNull();
    const other = stored(packRun('endless', running(), new RunTally())) as { version: number };
    other.version = 99;
    expect(unpackRun(other)).toBeNull();
  });

  it('lets a session of the day that was kept go: there is no such session any more', () => {
    const kept = { version: 1, kind: 'timed', day: '2026-10-03', state: { ...running(), mode: 'timed' }, tally: new RunTally().keep() };
    expect(unpackRun(stored(kept))).toBeNull();
  });

  it('reads a run of Endless kept with the day it was started on, as runs were kept before', () => {
    const kept = { ...packRun('endless', running(), new RunTally())!, day: '2026-10-03' };
    expect(unpackRun(stored(kept))).not.toBeNull();
  });

  it('brings the count of the run back with it', () => {
    const tally = new RunTally();
    tally.note({ type: 'match', reactionId: 1, value: 3, count: 3, points: 9 });
    tally.note({ type: 'chain', reactionId: 1, value: 3, chain: 2, count: 4, points: 24 });
    tally.note({ type: 'happyOne', count: 2, points: 2 });
    const back = unpackRun(stored(packRun('endless', running(), tally)))!;
    const again = new RunTally();
    again.take(back.tally);
    expect(again.values()).toEqual(tally.values());
  });
});
