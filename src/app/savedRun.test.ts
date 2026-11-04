import { describe, expect, it, vi } from 'vitest';
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

/**
 * The form of a run as it is kept: the names of the fields of the state, of its rules and of what
 * they hold. A kept run is put back as it was saved, so a build that changes this form reads the
 * runs of the build before it wrongly. When this test fails, raise `KEPT_VERSION` in
 * src/app/savedRun.ts (or `RULES_VERSION` in src/rules/config.ts, where the owner changes the
 * rules), so that a run kept before is let go, and then write the new names here.
 */
const KEPT_FORM = {
  state: ['chainCalmLeft', 'chainQuietSpent', 'config', 'cubes', 'edgeCalmLeft', 'edgeCalmSpent', 'endReason', 'events', 'feedDeck', 'fullTicks', 'grid', 'helpDeck', 'level', 'levelRun', 'liftTimer', 'maxChain', 'mode', 'nextCubeId', 'nextReactionId', 'over', 'pending', 'player', 'reactions', 'removed', 'rng', 'score', 'seed', 'sinceClear', 'spawnEnabled', 'spawnTimer', 'stats', 'tick', 'wave'],
  config: ['actionTicks', 'breatherEvery', 'breatherFactor', 'chainCalmMaxTicks', 'chainCalmTicks', 'chainLift', 'chainLiftMin', 'crowdedFactor', 'cubesPerLevel', 'custom', 'easyLevels', 'edgeCalmTicks', 'edgeFactor', 'experiments', 'feedRate', 'floorLiftTicks', 'gentleTicks', 'giftMax', 'giftRate', 'helpRate', 'levelTicks', 'liveEndMs', 'liveStartMs', 'liveTicks', 'lowHeight', 'mountHeight', 'paceFlatLevels', 'paceGrowth', 'paceMinMs', 'paceStartMs', 'refillEndMs', 'refillMs', 'rescueTicks', 'restFlow', 'restTicks', 'risingTicks', 'rulesVersion', 'sinkFloorTicks', 'sinkLowHeight', 'sinkStartTicks', 'sinkingTicks', 'size', 'startCubes', 'startX', 'startZ', 'stepDownHeight', 'surgeCubes', 'surgeMax', 'targetCubes', 'tickMs', 'warnOccupied', 'warnTicks', 'waveEase', 'wavePeak', 'waveSpread', 'waveTicks', 'wipeBonus'],
  experiments: ['boardPreview', 'chainCalm', 'dockSteps', 'floorClimb', 'floorLift', 'gentleStart', 'gift', 'guidedStart', 'lastSliver', 'matchHint', 'opening', 'soloOne', 'surge', 'timeFloor', 'waves'],
  player: ['level', 'x', 'z'],
  stats: ['bestChainScore', 'blockedSteps', 'chainQuietTicks', 'clearTicks', 'clears', 'dangerTicks', 'dockClimbs', 'dockDescents', 'falls', 'floorClimbs', 'gifts', 'groundTicks', 'levels', 'longestChainQuiet', 'steps', 'wipes'],
  wave: ['build', 'index', 'rest', 'start'],
};

describe('the form of a kept run', () => {
  it('is the one this version of the kept run was made for', () => {
    const state = createRun({ seed: 11, config: defaultConfig() });
    const names = (of: object): string[] => Object.keys(of).sort();
    const form = { state: names(state), config: names(state.config), experiments: names(state.config.experiments), player: names(state.player), stats: names(state.stats), wave: names(state.wave) };
    expect(form, 'The form of RunState or its config has changed: raise KeptRun.version (KEPT_VERSION in src/app/savedRun.ts) or RULES_VERSION, then write the new names in KEPT_FORM').toEqual(KEPT_FORM);
  });

  it('lets go of a run kept by a build before this form: the first version had other fields', () => {
    const kept = stored(packRun('endless', running(), new RunTally())) as { version: number };
    expect(kept.version).toBe(2);
    kept.version = 1;
    expect(unpackRun(kept)).toBeNull();
  });

  it('lets go of a run broken in its fields, and never throws', () => {
    const breaks: ((state: Record<string, unknown> & { config: Record<string, unknown> }) => void)[] = [
      (state) => (state.player = null),
      (state) => (state.cubes = [null]),
      (state) => (state.cubes = [{ id: 1 }]),
      (state) => (state.stats = 'none'),
      (state) => (state.wave = {}),
      (state) => delete state.levelRun,
      (state) => (state.score = null),
      (state) => (state.config.experiments = 5),
      (state) => delete state.config.liveTicks,
      (state) => (state.config.size = 'six'),
      (state) => (state.reactions = [3]),
      (state) => (state.grid = [...(state.grid as number[]).slice(1), null]),
    ];
    for (const broken of breaks) {
      const kept = stored(packRun('endless', running(), new RunTally())) as { state: Record<string, unknown> & { config: Record<string, unknown> } };
      broken(kept.state);
      expect(() => unpackRun(kept)).not.toThrow();
      expect(unpackRun(kept)).toBeNull();
    }
  });

  it('tells the analytics of a run broken in its fields, and not of one kept under other rules', async () => {
    vi.resetModules();
    const { platform } = await import('@platform');
    const tracked: string[] = [];
    vi.spyOn(platform, 'track').mockImplementation((event, data) => void tracked.push(`${event} ${JSON.stringify(data)}`));
    const fresh = await import('./savedRun');
    const old = stored(packRun('endless', running(), new RunTally())) as { state: RunState };
    old.state.config.rulesVersion = '0.1';
    expect(fresh.unpackRun(old)).toBeNull();
    expect(tracked).toEqual([]);
    const broken = stored(packRun('endless', running(), new RunTally())) as { state: { player: unknown } };
    broken.state.player = null;
    expect(fresh.unpackRun(broken)).toBeNull();
    expect(tracked).toEqual(['save_failed {"stage":"parse","store":"browser"}']);
  });
});
