import { describe, expect, it } from 'vitest';
import { cubeAt, freeCells } from './board';
import { defaultConfig, ruleKey, spawnIntervalTicks } from './config';
import { ALL_ORIENTATIONS, orientationKey } from './orientation';
import { createRun, step } from './sim';
import { fallbackLayout, hasReadyGroup, spawnCube, TUTORIAL_A } from './spawn';
import { emptyRun, ori, place, put, run } from './testkit';
import type { Dir, GameEvent, RunState } from './types';

function topsOf(s: RunState): number[] {
  const tops = new Array<number>(49).fill(0);
  for (const c of s.cubes) tops[c.z * 7 + c.x] = c.ori.top;
  return tops;
}

/** 5/6 checkerboard: no two equal neighbours, so nothing clears. */
function fill(s: RunState, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = i % 7;
    const z = Math.floor(i / 7);
    put(s, x, z, (x + z) % 2 === 0 ? 6 : 5);
  }
}

describe('start layout', () => {
  it('places 14 cubes with the player on top of the start cube', () => {
    const s = createRun({ seed: 7, config: defaultConfig() });
    expect(s.cubes.length).toBe(14);
    expect(s.player).toEqual({ x: 3, z: 4, level: 'top' });
    expect(cubeAt(s, 3, 4)?.id).toBe(1);
    expect(s.mode).toBe('endless');
  });

  it('never starts with a ready group and always gives the start cube a way out', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = createRun({ seed, config: defaultConfig() });
      expect(hasReadyGroup(topsOf(s), 7)).toBe(false);
      const around = [cubeAt(s, 3, 3), cubeAt(s, 3, 5), cubeAt(s, 2, 4), cubeAt(s, 4, 4)];
      expect(around.some((c) => c !== undefined)).toBe(true);
      expect(around.some((c) => c === undefined)).toBe(true);
      const keys = new Set(ALL_ORIENTATIONS.map(orientationKey));
      for (const c of s.cubes) expect(keys.has(orientationKey(c.ori))).toBe(true);
    }
  });

  it('is reproducible by seed and differs between seeds', () => {
    const a = JSON.stringify(createRun({ seed: 42, config: defaultConfig() }).cubes);
    const b = JSON.stringify(createRun({ seed: 42, config: defaultConfig() }).cubes);
    const c = JSON.stringify(createRun({ seed: 43, config: defaultConfig() }).cubes);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('has a valid fallback layout', () => {
    expect(fallbackLayout().length).toBe(14);
    const s = createRun({ seed: 1, config: defaultConfig(), forceFallback: true });
    expect(s.cubes.length).toBe(14);
    expect(hasReadyGroup(topsOf(s), 7)).toBe(false);
    expect(cubeAt(s, 4, 4)).toBeDefined();
    expect(cubeAt(s, 3, 3)).toBeUndefined();
  });
});

describe('cube lifecycle', () => {
  it('turns a rising cube idle after 800 ms', () => {
    const s = emptyRun();
    const cube = put(s, 0, 0, 6, 'rising');
    run(s, 39);
    expect(cube.state).toBe('rising');
    run(s, 1);
    expect(cube.state).toBe('idle');
  });

  it('removes a sinking cube after 2400 ms and frees the cell', () => {
    const s = emptyRun();
    put(s, 0, 0, 6, 'sinking');
    run(s, 119);
    expect(s.cubes.length).toBe(1);
    run(s, 1);
    expect(s.cubes.length).toBe(0);
    expect(cubeAt(s, 0, 0)).toBeUndefined();
    expect(s.removed).toBe(1);
  });

  it('drops the player to the ground in the same cell when their cube is removed', () => {
    const s = emptyRun();
    put(s, 2, 2, 6, 'sinking');
    place(s, 2, 2, 'top');
    run(s, 120);
    expect(s.player).toEqual({ x: 2, z: 2, level: 'ground' });
    expect(s.stats.falls).toBe(1);
    step(s, 'N');
    expect(s.events).toContainEqual({ type: 'move', kind: 'walk', dir: 'N' });
  });

  it('lifts a player standing where a cube appears and lets them roll once it has risen', () => {
    const s = emptyRun();
    spawnCube(s, 3, 4, ori({ top: 6 }));
    expect(s.player.level).toBe('top');
    expect(s.events).toContainEqual({ type: 'lifted' });
    run(s, 25);
    step(s, 'N');
    expect(s.player.z).toBe(4); // too high to step down, cannot roll while rising
    run(s, 15);
    step(s, 'N');
    expect(s.events).toContainEqual({ type: 'move', kind: 'roll', dir: 'N' });
  });

  it('keeps the cell a cube is leaving reserved until the move ends', () => {
    const s = emptyRun();
    put(s, 3, 4, 6);
    place(s, 3, 4, 'top');
    step(s, 'N');
    const free = freeCells(s).map((c) => `${c.x},${c.z}`);
    expect(free).not.toContain('3,4');
    expect(free).not.toContain('3,3');
    run(s, 10);
    expect(freeCells(s).map((c) => `${c.x},${c.z}`)).toContain('3,4');
  });

  it('levels up every 20 removed cubes', () => {
    const s = emptyRun();
    for (let i = 0; i < 20; i++) put(s, i % 7, Math.floor(i / 7), 6, 'sinking');
    const events: GameEvent[] = [];
    for (let i = 0; i < 120; i++) {
      step(s, null);
      events.push(...s.events);
    }
    expect(s.level).toBe(2);
    expect(events.filter((e) => e.type === 'levelUp')).toEqual([{ type: 'levelUp', level: 2 }]);
  });
});

describe('spawn and pressure', () => {
  it('speeds up by 150 ms per level down to 900 ms', () => {
    const c = defaultConfig();
    expect(spawnIntervalTicks(c, 1)).toBe(150);
    expect(spawnIntervalTicks(c, 3)).toBe(135);
    expect(spawnIntervalTicks(c, 15)).toBe(45);
    expect(spawnIntervalTicks(c, 40)).toBe(45);
  });

  it('uses slower intervals with relaxedPace and a separate record key', () => {
    const c = defaultConfig({ relaxedPace: true });
    expect(spawnIntervalTicks(c, 1)).toBe(200);
    expect(spawnIntervalTicks(c, 40)).toBe(60);
    expect(ruleKey(c)).not.toBe(ruleKey(defaultConfig()));
    expect(ruleKey(defaultConfig({ boardPreview: true, matchHint: true }))).toBe(ruleKey(defaultConfig()));
  });

  it('spawns one rising cube per interval', () => {
    const s = emptyRun();
    s.spawnEnabled = true;
    run(s, 149);
    expect(s.cubes.length).toBe(0);
    run(s, 1);
    expect(s.cubes.length).toBe(1);
    expect(s.cubes[0].state).toBe('rising');
    run(s, 150);
    expect(s.cubes.length).toBe(2);
  });

  it('ends the run after 3 seconds on a full board', () => {
    const s = emptyRun();
    fill(s, 49);
    place(s, 0, 0, 'top');
    s.spawnEnabled = true;
    run(s, 149);
    expect(s.over).toBe(false);
    run(s, 1);
    expect(s.over).toBe(true);
    expect(s.events).toContainEqual({ type: 'gameOver' });
    expect(s.spawnTimer).toBe(0);
  });

  it('is saved by a removal on the last tick of the countdown', () => {
    const saved = emptyRun();
    fill(saved, 49);
    place(saved, 0, 0, 'top');
    run(saved, 100);
    const cube = cubeAt(saved, 6, 6)!;
    cube.state = 'sinking';
    cube.t = 70;
    run(saved, 50);
    expect(saved.over).toBe(false);
    expect(saved.fullTicks).toBe(0);

    const lost = emptyRun();
    fill(lost, 49);
    place(lost, 0, 0, 'top');
    run(lost, 100);
    const late = cubeAt(lost, 6, 6)!;
    late.state = 'sinking';
    late.t = 69;
    run(lost, 50);
    expect(lost.over).toBe(true);
  });

  it('does not queue spawns while full and resumes after a full interval', () => {
    const s = emptyRun();
    fill(s, 49);
    place(s, 0, 0, 'top');
    s.spawnEnabled = true;
    run(s, 100);
    const cube = cubeAt(s, 6, 6)!;
    cube.state = 'sinking';
    cube.t = 100;
    run(s, 20);
    expect(s.cubes.length).toBe(48);
    run(s, 148); // the interval restarts on the tick the cell is freed
    expect(s.cubes.length).toBe(48);
    run(s, 1);
    expect(s.cubes.length).toBe(49);
  });

  it('holds spawning at 42 cubes during a gentle start only', () => {
    const gentle = emptyRun({ gentleStart: true });
    fill(gentle, 42);
    place(gentle, 0, 0, 'top');
    gentle.spawnEnabled = true;
    run(gentle, 600);
    expect(gentle.cubes.length).toBe(42);

    const normal = emptyRun();
    fill(normal, 42);
    place(normal, 0, 0, 'top');
    normal.spawnEnabled = true;
    run(normal, 600);
    expect(normal.cubes.length).toBeGreaterThan(42);

    const late = emptyRun({ gentleStart: true });
    fill(late, 42);
    place(late, 0, 0, 'top');
    late.spawnEnabled = true;
    late.tick = late.config.gentleTicks;
    run(late, 600);
    expect(late.cubes.length).toBeGreaterThan(42);
  });

  it('raises the next cube under a player stuck on the ground with floorLift', () => {
    const s = emptyRun({ floorLift: true }, 5);
    s.spawnEnabled = true;
    place(s, 0, 6, 'ground');
    run(s, 150);
    expect(s.player.level).toBe('ground'); // first spawn is still random
    run(s, 150);
    expect(s.player.level).toBe('top');
    expect(cubeAt(s, 0, 6)?.state).toBe('rising');

    const off = emptyRun({}, 5);
    off.spawnEnabled = true;
    place(off, 0, 6, 'ground');
    run(off, 300);
    expect(off.player.level).toBe('ground');
  });
});

describe('tutorial', () => {
  it('stages the first clear with a single roll north', () => {
    const s = createRun({ seed: 3, config: defaultConfig(), tutorial: true });
    expect(s.mode).toBe('practice');
    expect(s.spawnEnabled).toBe(false);
    expect(cubeAt(s, 3, 4)?.ori).toEqual(TUTORIAL_A);
    expect(cubeAt(s, 2, 3)?.ori.top).toBe(2);
    expect(cubeAt(s, 3, 3)).toBeUndefined();
    run(s, 500);
    expect(s.cubes.length).toBe(2); // nothing spawns while waiting

    step(s, 'N');
    run(s, 10);
    expect(s.score).toBe(4);
    expect(s.tutorial?.phase).toBe('cleared');
  });

  it('refills the board one second later without feeding the running clear', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = createRun({ seed, config: defaultConfig(), tutorial: true });
      step(s, 'N');
      const events: GameEvent[] = [];
      for (let i = 0; i < 10 + 50 + 45; i++) {
        step(s, null);
        events.push(...s.events);
      }
      expect(events.filter((e) => e.type === 'tutorialRefill').length).toBe(1);
      expect(s.cubes.length).toBe(14);
      expect(s.spawnEnabled).toBe(true);
      expect(s.tutorial?.phase).toBe('done');
      expect(events.some((e) => e.type === 'chain' || e.type === 'happyOne')).toBe(false);
      expect(events.filter((e) => e.type === 'match').length).toBe(1);
      expect(s.score).toBe(4);
      // One of the new cubes stands next to the player's sinking cube.
      const beside = [cubeAt(s, 3, 2), cubeAt(s, 4, 3), cubeAt(s, 3, 4)];
      expect(beside.some((c) => c !== undefined)).toBe(true);
    }
  });
});

describe('determinism', () => {
  function play(config = defaultConfig()): string {
    const s = createRun({ seed: 99, config });
    const dirs: Dir[] = ['N', 'E', 'S', 'W'];
    for (let i = 0; i < 4000 && !s.over; i++) {
      step(s, i % 7 === 0 ? dirs[(i / 7) % 4 | 0] : null);
    }
    return JSON.stringify({ cubes: s.cubes, player: s.player, score: s.score, tick: s.tick });
  }

  it('gives the same result for the same seed and commands', () => {
    expect(play()).toBe(play());
  });

  it('is not affected by flags that only change presentation', () => {
    expect(play(defaultConfig({ boardPreview: true, matchHint: true, guidedStart: false }))).toBe(play());
  });

  it('emits each event once per occurrence', () => {
    const s = emptyRun();
    put(s, 0, 0, 2);
    put(s, 1, 0, 2);
    const seen: string[] = [];
    for (let i = 0; i < 130; i++) {
      step(s, null);
      seen.push(...s.events.map((e) => e.type));
    }
    expect(seen.filter((t) => t === 'match').length).toBe(1);
    expect(seen.filter((t) => t === 'removed').length).toBe(2);
    expect(s.stats.clears).toBe(1);
    expect(s.stats.clearTicks).toEqual([0]);
  });
});
