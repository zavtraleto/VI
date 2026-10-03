import { describe, expect, it } from 'vitest';
import { cubeAt, freeCells } from './board';
import { DEFAULT_TUNING, defaultConfig, helpChance, isCustomTuning, paceIntervalTicks, ruleKey, topWeights } from './config';
import { ALL_ORIENTATIONS, orientationKey } from './orientation';
import { createRun, step } from './sim';
import { fallbackLayout, hasReadyGroup, population, spawnCube } from './spawn';
import { act, emptyRun, land, ori, place, put, run } from './testkit';
import type { Dir, ExperimentConfig, GameEvent, RunState } from './types';

function topsOf(s: RunState): number[] {
  const tops = new Array<number>(49).fill(0);
  for (const c of s.cubes) if (c.state !== 'sinking') tops[c.z * 7 + c.x] = c.ori.top;
  return tops;
}

/** 5/6 checkerboard: no two equal neighbours, so nothing can clear. */
function fill(s: RunState, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = i % 7;
    const z = Math.floor(i / 7);
    put(s, x, z, (x + z) % 2 === 0 ? 6 : 5);
  }
}

/** Ticks until the next regular spawn is announced, for the board as it is now. */
function interval(s: RunState): number {
  return paceIntervalTicks(s.config, s.mode, s.level, s.tick, population(s));
}

function collect(s: RunState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

describe('start layout', () => {
  it('places the starting cubes with the player on top of the start cube', () => {
    const s = createRun({ seed: 7, config: defaultConfig() });
    expect(s.cubes.length).toBe(DEFAULT_TUNING.startCubes);
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
    expect(s.cubes.length).toBe(DEFAULT_TUNING.startCubes);
    expect(hasReadyGroup(topsOf(s), 7)).toBe(false);
    expect(cubeAt(s, 4, 4)).toBeDefined();
    expect(cubeAt(s, 3, 3)).toBeUndefined();
  });

  it('builds the layout around any start cell', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = createRun({ seed, config: { ...defaultConfig(), startX: 3, startZ: 1 } });
      expect(s.player).toMatchObject({ x: 3, z: 1, level: 'top' });
      expect(cubeAt(s, 3, 1)).toBeDefined();
      expect(s.cubes.length).toBe(s.config.startCubes);
      expect(hasReadyGroup(topsOf(s), 7)).toBe(false);
    }
    const fallback = createRun({ seed: 1, config: { ...defaultConfig(), startX: 5, startZ: 5 }, forceFallback: true });
    expect(cubeAt(fallback, 5, 5)).toBeDefined();
    expect(fallback.cubes.length).toBe(fallback.config.startCubes);
  });
});

describe('cube lifecycle', () => {
  it('turns a rising cube idle after the rise time', () => {
    const s = emptyRun();
    const cube = put(s, 0, 0, 6, 'rising');
    run(s, s.config.risingTicks - 1);
    expect(cube.state).toBe('rising');
    run(s, 1);
    expect(cube.state).toBe('idle');
  });

  it('removes a sinking cube after the sink time and frees the cell', () => {
    const s = emptyRun();
    put(s, 0, 0, 6, 'sinking');
    run(s, s.config.sinkingTicks - 1);
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
    run(s, s.config.sinkingTicks);
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
    step(s, 'N');
    expect(s.player.z).toBe(4); // cannot fall off a rising cube, cannot roll it yet
    run(s, s.config.risingTicks);
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
    run(s, s.config.actionTicks);
    expect(freeCells(s).map((c) => `${c.x},${c.z}`)).toContain('3,4');
  });

  it('levels up every 20 removed cubes', () => {
    const s = emptyRun();
    for (let i = 0; i < 20; i++) put(s, i % 7, Math.floor(i / 7), 6, 'sinking');
    const events = collect(s, s.config.sinkingTicks);
    expect(s.level).toBe(2);
    expect(events.filter((e) => e.type === 'levelUp')).toEqual([{ type: 'levelUp', level: 2 }]);
  });
});

describe('spawn and pressure', () => {
  it('refills a board below its target sooner and gives a crowded one more room', () => {
    const c = defaultConfig();
    const at = (cubes: number) => paceIntervalTicks(c, 'endless', 1, 0, cubes);
    expect(c.targetCubes).toBe(14);
    expect(at(0)).toBe(110); // 2.2 s
    expect(at(10)).toBe(110);
    expect(at(12)).toBe(110);
    expect(at(13)).toBe(205); // half way from 2.2 s to 6 s
    expect(at(14)).toBe(300); // 6 s: the interval of the level is the one at the target
    expect(at(22)).toBe(330); // 6 s x 1.1
    expect(at(30)).toBe(360); // 6 s x 1.2
    expect(at(49)).toBe(360);
  });

  it('refills faster as the level rises: from 2.2 s to 1 s by level 15', () => {
    const c = defaultConfig();
    const at = (level: number) => paceIntervalTicks(c, 'endless', level, 0, 0);
    expect(at(3)).toBe(110);
    expect(at(9)).toBe(80); // half way
    expect(at(15)).toBe(50);
    expect(at(40)).toBe(50);
  });

  it('never refills slower than the level itself spawns', () => {
    expect(paceIntervalTicks(defaultConfig({}, { paceStartMs: 1500 }), 'endless', 1, 0, 0)).toBe(75);
    expect(paceIntervalTicks(defaultConfig({}, { targetCubes: 0 }), 'endless', 1, 0, 0)).toBe(300);
  });

  it('counts a sinking cube as gone: what is cleared starts coming back at once', () => {
    const s = emptyRun();
    fill(s, 14);
    expect(interval(s)).toBe(300);
    for (const cube of s.cubes.slice(0, 4)) cube.state = 'sinking';
    expect(population(s)).toBe(10);
    expect(interval(s)).toBe(110);
  });

  it('speeds up by a ratio per level from the 4th one, down to the minimum', () => {
    const c = defaultConfig();
    const crowded = (level: number) => paceIntervalTicks(c, 'endless', level, 0, 30);
    expect(crowded(3)).toBe(360);
    expect(crowded(4)).toBe(338); // 6 s x 0.94 x 1.2
    expect(crowded(90)).toBe(84); // 1.4 s x 1.2
  });

  it('favours low values and helpful spawns early, and evens out with the level', () => {
    const c = defaultConfig();
    const early = topWeights(c, 1);
    expect(early[1]).toBeGreaterThan(early[5]); // 2s over 6s
    expect(early[2]).toBeGreaterThan(early[4]); // 3s over 5s
    expect(topWeights(c, c.easyLevels)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(topWeights(c, 40)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(helpChance(c, 1)).toBeCloseTo(0.65);
    expect(helpChance(c, 5)).toBeLessThan(helpChance(c, 1));
    expect(helpChance(c, 40)).toBeCloseTo(0.65 * 0.35);
  });

  it('applies tuning, marks it as custom and keeps presentation flags out of the record key', () => {
    const c = defaultConfig({}, { paceStartMs: 2000, sinkStartMs: 1000 });
    expect(paceIntervalTicks(c, 'endless', 1, 0, 30)).toBe(120);
    expect(c.sinkingTicks).toBe(50);
    expect(c.custom).toBe(true);
    expect(defaultConfig().custom).toBe(false);
    expect(isCustomTuning({ sinkStartMs: DEFAULT_TUNING.sinkStartMs })).toBe(false);
    expect(ruleKey(defaultConfig({ boardPreview: true, matchHint: true }))).toBe(ruleKey(defaultConfig()));
    expect(ruleKey(defaultConfig({ floorClimb: false }))).not.toBe(ruleKey(defaultConfig()));
    expect(ruleKey(defaultConfig({ dockSteps: false }))).not.toBe(ruleKey(defaultConfig()));
    expect(ruleKey(defaultConfig({ dockSteps: false }))).not.toBe(ruleKey(defaultConfig({ floorClimb: false })));
  });

  it('climbs from the floor and steps on docks by default, under rules of their own version', () => {
    const { experiments, rulesVersion } = defaultConfig();
    expect(experiments).toMatchObject({ floorClimb: true, dockSteps: true, floorLift: true });
    expect(rulesVersion).toBe('0.8');
    expect(ruleKey(defaultConfig())).toBe('0.8-gclqd');
  });

  it('announces a cube, then raises it when the warning ends', () => {
    const s = emptyRun({}, 1, { targetCubes: 0 });
    s.spawnEnabled = true;
    run(s, interval(s) - 1);
    expect(s.pending.length).toBe(0);
    step(s, null);
    expect(s.pending.length).toBe(1);
    expect(s.events.some((e) => e.type === 'warned')).toBe(true);
    expect(s.cubes.length).toBe(0);
    run(s, s.config.warnTicks);
    expect(s.pending.length).toBe(0);
    expect(s.cubes.length).toBe(1);
    expect(s.cubes[0].state).toBe('rising');
  });

  it('raises the cube in the nearest free cell when the announced one got taken', () => {
    const s = emptyRun();
    s.spawnEnabled = true;
    run(s, interval(s));
    const { x, z } = s.pending[0];
    put(s, x, z, 6);
    run(s, s.config.warnTicks);
    expect(s.cubes.length).toBe(2);
    const risen = s.cubes[1];
    expect(Math.abs(risen.x - x) + Math.abs(risen.z - z)).toBe(1);
  });

  it('skips the warning when it is tuned to zero', () => {
    const s = emptyRun({}, 1, { warnMs: 0 });
    s.spawnEnabled = true;
    run(s, interval(s));
    expect(s.pending.length).toBe(0);
    expect(s.cubes.length).toBe(1);
  });

  it('ends the run after the rescue time on a full board', () => {
    const s = emptyRun();
    fill(s, 49);
    place(s, 0, 0, 'top');
    s.spawnEnabled = true;
    run(s, s.config.rescueTicks - 1);
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
    run(saved, saved.config.rescueTicks - 50);
    const cube = cubeAt(saved, 6, 6)!;
    cube.state = 'sinking';
    cube.t = saved.config.sinkingTicks - 50;
    run(saved, 50);
    expect(saved.over).toBe(false);
    expect(saved.fullTicks).toBe(0);

    const lost = emptyRun();
    fill(lost, 49);
    place(lost, 0, 0, 'top');
    run(lost, lost.config.rescueTicks - 50);
    const late = cubeAt(lost, 6, 6)!;
    late.state = 'sinking';
    late.t = lost.config.sinkingTicks - 51;
    run(lost, 50);
    expect(lost.over).toBe(true);
  });

  it('does not queue spawns while full and resumes after a full interval', () => {
    const s = emptyRun();
    fill(s, 49);
    place(s, 0, 0, 'top');
    s.spawnEnabled = true;
    run(s, 50);
    const cube = cubeAt(s, 6, 6)!;
    cube.state = 'sinking';
    cube.t = s.config.sinkingTicks - 20;
    run(s, 20);
    expect(s.cubes.length).toBe(48);
    expect(s.pending.length).toBe(0);
    run(s, interval(s) - 2); // the interval restarts on the tick the cell is freed
    expect(s.pending.length).toBe(0);
    run(s, 1);
    expect(s.pending.length).toBe(1);
  });

  it('holds spawning at 42 cubes during a gentle start only', () => {
    const gentle = emptyRun({ gentleStart: true });
    fill(gentle, 42);
    place(gentle, 0, 0, 'top');
    gentle.spawnEnabled = true;
    run(gentle, 1200);
    expect(gentle.cubes.length).toBe(42);

    const normal = emptyRun();
    fill(normal, 42);
    place(normal, 0, 0, 'top');
    normal.spawnEnabled = true;
    run(normal, 1200);
    expect(normal.cubes.length).toBeGreaterThan(42);

    const late = emptyRun({ gentleStart: true });
    fill(late, 42);
    place(late, 0, 0, 'top');
    late.spawnEnabled = true;
    late.tick = late.config.gentleTicks;
    run(late, 1200);
    expect(late.cubes.length).toBeGreaterThan(42);
  });

  it('never clears anything when nobody plays', () => {
    let latent = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = createRun({ seed, config: defaultConfig({ gentleStart: false, floorLift: false }) });
      const events = collect(s, 6000);
      expect(s.score).toBe(0);
      expect(events.some((e) => e.type === 'match' || e.type === 'chain' || e.type === 'happyOne')).toBe(false);
      if (hasReadyGroup(topsOf(s), 7)) latent++;
    }
    // The generator avoids ready-made groups; a waiting one should be the exception.
    expect(latent).toBeLessThanOrEqual(3);
  });
});

describe('spawn director', () => {
  /** Share of spawned cubes that came up within three steps of the player, who stays put. */
  function nearShare(helpRate: number): number {
    let near = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = createRun({ seed, config: defaultConfig({ gentleStart: false, floorLift: false }, { helpRate }) });
      for (let i = 0; i < 1500; i++) {
        step(s, null);
        for (const e of s.events) {
          if (e.type !== 'spawn') continue;
          const cube = s.cubes.find((c) => c.id === e.cubeId)!;
          total++;
          if (Math.abs(cube.x - s.player.x) + Math.abs(cube.z - s.player.z) <= 3) near++;
        }
      }
    }
    return near / total;
  }

  it('puts helpful spawns within a few steps of the player far more often than chance', () => {
    expect(nearShare(1)).toBeGreaterThan(nearShare(0) + 0.1);
  });

  /** Where the first cube of a run with nothing but helpful spawns is announced. */
  function firstSpawn(seed: number, level: 'top' | 'ground', wall: boolean) {
    const s = emptyRun({}, seed, { helpRate: 1 });
    if (level === 'top') put(s, 0, 0, 6);
    place(s, 0, 0, level);
    // A row of rising cubes cuts the board in two: the player's corner and the rest.
    if (wall) for (let x = 0; x < 7; x++) put(s, x, 3, 5, 'rising');
    s.spawnEnabled = true;
    run(s, interval(s));
    return s.pending[0];
  }

  it('brings a player on the floor a cube right beside them most of the time', () => {
    let beside = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { x, z } = firstSpawn(seed, 'ground', false);
      if (x + z >= 1 && x + z <= 2) beside++;
    }
    expect(beside).toBeGreaterThan(20); // 5 cells of 48 would get 6 by chance
  });

  it('keeps helpful spawns on the side of a wall of rising cubes the player can get to', () => {
    let cutOff = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const level of ['top', 'ground'] as const) {
        if (firstSpawn(seed, level, true).z > 3) cutOff++;
      }
    }
    expect(cutOff).toBeLessThan(20); // of 120: half of the free cells lie behind the wall
  });

  it('decides on helpful spawns from a deck: seven in every ten at level 1', () => {
    const s = emptyRun();
    s.spawnEnabled = true;
    run(s, interval(s));
    expect(s.helpDeck.length).toBe(9);
    const dealt = s.helpDeck.filter(Boolean).length;
    expect(dealt === 6 || dealt === 7).toBe(true);
  });

  it('shows mostly low values on new cubes at level 1', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (let seed = 1; seed <= 60; seed++) {
      const s = createRun({ seed, config: defaultConfig({ gentleStart: false, floorLift: false }, { helpRate: 0 }) });
      const before = s.cubes.length;
      run(s, 1500);
      for (const c of s.cubes.slice(before)) counts[c.ori.top - 1]++;
    }
    expect(counts[1] + counts[2]).toBeGreaterThan((counts[4] + counts[5]) * 2);
  });

  /** Three sinking 3s in the middle of an empty board, with spawning switched on. */
  function chainRunning(feedRate: number, seed: number): RunState {
    const s = emptyRun({}, seed, { feedRate, helpRate: 0 });
    put(s, 2, 3, 3);
    put(s, 3, 3, 3);
    land(s, put(s, 4, 3, 3));
    s.spawnEnabled = true;
    return s;
  }

  it('brings a cube for a running chain one move away from it, with the value where it can be seen', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = chainRunning(1, seed);
      run(s, interval(s));
      expect(s.pending.length).toBe(1);
      const { x, z, ori: o } = s.pending[0];
      const distance = Math.min(...s.cubes.map((c) => Math.abs(c.x - x) + Math.abs(c.z - z)));
      expect(distance).toBe(2);
      expect([o.top, o.south, o.east]).toContain(3);
      // It never comes up as part of the chain or of a group of its own.
      expect(hasReadyGroup(topsOf(s).map((top, i) => (i === z * 7 + x ? o.top : top)), 7)).toBe(false);
    }
  });

  it('feeds a chain on two spawns in five, dealt from a deck', () => {
    const s = chainRunning(DEFAULT_TUNING.feedRate, 3);
    run(s, interval(s));
    expect(s.feedDeck.length).toBe(4);
    const left = s.feedDeck.filter(Boolean).length;
    expect(left === 1 || left === 2).toBe(true);
  });

  it('deals nothing when no chain is running or feeding is off', () => {
    const idle = emptyRun({}, 3, { helpRate: 0 });
    put(idle, 2, 3, 3);
    idle.spawnEnabled = true;
    run(idle, interval(idle));
    expect(idle.pending.length).toBe(1);
    expect(idle.feedDeck.length).toBe(0);

    const off = chainRunning(0, 3);
    run(off, interval(off));
    expect(off.pending.length).toBe(1);
    expect(off.feedDeck.length).toBe(0);
  });

  it('never brings a cube to be pushed in from a dock: from a dock it would be stepped onto', () => {
    /**
     * Two cubes of one chain with three cells between them. A cube for the chain on the middle
     * cell could be pushed in only from the cell beside it, and that cell is a dock.
     */
    function between(experiments: Partial<ExperimentConfig>, seed: number) {
      const s = emptyRun(experiments, seed, { feedRate: 1, helpRate: 0 });
      for (const x of [1, 5]) put(s, x, 3, 3, 'sinking').reactionId = 1;
      s.reactions.push({ id: 1, value: 3, chain: 1, total: 2 });
      s.nextReactionId = 2;
      place(s, 0, 0, 'ground');
      s.spawnEnabled = true;
      run(s, interval(s));
      return s.pending[0];
    }
    let toPush = 0;
    let toRoll = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const on = between({}, seed);
      if (on.x === 3 && on.z === 3) {
        // It still comes there to be rolled in: with the 3 on a side, never on top.
        expect(on.ori.top).not.toBe(3);
        toRoll++;
      }
      const off = between({ dockSteps: false }, seed);
      if (off.x === 3 && off.z === 3 && off.ori.top === 3) toPush++;
    }
    expect(toPush).toBeGreaterThan(0);
    expect(toRoll).toBeGreaterThan(0);
  });
});

describe('lift', () => {
  /** Regular spawning slowed right down so the lift can be watched on its own. */
  function grounded(experiments: Partial<ExperimentConfig> = { floorLift: true }) {
    const s = emptyRun(experiments, 1, { paceStartMs: 10000, targetCubes: 0 });
    s.spawnEnabled = true;
    place(s, 0, 6, 'ground');
    return s;
  }

  it('sends the next cube under a player left on the ground', () => {
    const s = grounded();
    run(s, s.config.floorLiftTicks - 1);
    expect(s.pending.length).toBe(0);
    step(s, null);
    expect(s.pending).toMatchObject([{ x: 0, z: 6 }]);
    expect(s.events).toContainEqual({ type: 'warned', x: 0, z: 6 });
    expect(s.spawnTimer).toBeLessThanOrEqual(1); // it replaces the next regular spawn
    const events = collect(s, s.config.warnTicks);
    expect(events).toContainEqual({ type: 'lifted' });
    expect(s.player.level).toBe('top');
    expect(cubeAt(s, 0, 6)?.state).toBe('rising');
    run(s, s.config.floorLiftTicks + s.config.warnTicks);
    expect(s.cubes.length).toBe(1); // no further lifts once the player is up
  });

  it('does nothing when the flag is off', () => {
    const s = grounded({ floorLift: false });
    run(s, s.config.floorLiftTicks + s.config.warnTicks + 10);
    expect(s.cubes.length).toBe(0);
    expect(s.player.level).toBe('ground');
  });

  it('is not sent on top of a cube that is already on its way', () => {
    const s = grounded();
    run(s, 100);
    s.pending.push({ x: 5, z: 1, ori: ori({ top: 6 }), t: 0 });
    run(s, s.config.floorLiftTicks - 100 + 5);
    // The announced cube has come up and can still be stepped onto: no lift yet.
    expect(s.cubes.length).toBe(1);
    expect(s.pending.length).toBe(0);
    const mountable = Math.ceil(s.config.risingTicks * s.config.mountHeight);
    run(s, 100 + s.config.warnTicks + mountable - s.config.floorLiftTicks);
    expect(s.pending).toMatchObject([{ x: 0, z: 6 }]); // too tall to mount now: the lift comes
  });

  it('does not wait for a cube the player cannot walk to', () => {
    const s = grounded();
    // Two cubes shut the player in the corner; the cube on its way comes up beyond them.
    put(s, 1, 6, 5);
    put(s, 0, 5, 6);
    s.pending.push({ x: 5, z: 1, ori: ori({ top: 6 }), t: 0 });
    run(s, s.config.floorLiftTicks);
    expect(cubeAt(s, 5, 1)?.state).toBe('rising');
    expect(s.pending).toMatchObject([{ x: 0, z: 6 }]);
  });

  it('tries again if the player walked away from the announced cell', () => {
    const s = grounded();
    // In the open: the cube that comes up there has room on every side, so it can only be pushed.
    place(s, 3, 3, 'ground');
    run(s, s.config.floorLiftTicks);
    act(s, 'E');
    act(s, 'E');
    run(s, s.config.warnTicks);
    expect(cubeAt(s, 3, 3)?.state).toBe('rising');
    expect(s.player).toEqual({ x: 5, z: 3, level: 'ground' });
    run(s, s.config.floorLiftTicks + s.config.warnTicks);
    expect(s.player).toEqual({ x: 5, z: 3, level: 'top' });
    expect(cubeAt(s, 5, 3)?.state).toBe('rising');
  });

  it('is not sent while a cube that can be climbed is within the player\'s reach', () => {
    // At the edge of the board: from the side the player comes from it cannot be pushed.
    const s = grounded();
    const cube = put(s, 6, 6, 5);
    run(s, s.config.floorLiftTicks + 60);
    expect(s.pending.length).toBe(0);
    expect(s.cubes.length).toBe(1);
    // The cube goes: nothing is left to climb, and the lift comes at once.
    cube.state = 'sinking';
    cube.t = s.config.sinkingTicks - 1;
    run(s, 2);
    expect(s.pending).toMatchObject([{ x: 0, z: 6 }]);

    // Propped by another cube.
    const t = grounded();
    put(t, 3, 3, 5);
    put(t, 3, 2, 6);
    run(t, t.config.floorLiftTicks + 60);
    expect(t.pending.length).toBe(0);
    expect(t.cubes.length).toBe(2);

    // By the rules before, neither is a way up.
    const off = grounded({ floorLift: true, floorClimb: false });
    put(off, 6, 6, 5);
    run(off, off.config.floorLiftTicks);
    expect(off.pending).toMatchObject([{ x: 0, z: 6 }]);
  });

  it('is sent when the cubes within reach can only be pushed', () => {
    const s = grounded();
    put(s, 3, 3, 5);
    run(s, s.config.floorLiftTicks);
    expect(s.pending).toMatchObject([{ x: 0, z: 6 }]);
  });

  it('is not held back by a cube that could be climbed only from where the player cannot walk', () => {
    const s = grounded();
    // Two cubes shut the player in the corner; each has room behind it, so neither is climbed.
    put(s, 1, 6, 5);
    put(s, 0, 5, 6);
    // Beyond them, a cube at the edge.
    put(s, 6, 0, 4);
    run(s, s.config.floorLiftTicks);
    expect(s.pending).toMatchObject([{ x: 0, z: 6 }]);
  });

  it('is not sent while a dock with a standing cube beside it is within reach', () => {
    /** An open chain in the middle and, a cell away from it, a cube with room on every side. */
    function withDock(experiments: Partial<ExperimentConfig>): RunState {
      const s = grounded({ floorLift: true, ...experiments });
      put(s, 3, 3, 2);
      land(s, put(s, 4, 3, 2));
      put(s, 4, 5, 6);
      return s;
    }
    const s = withDock({});
    run(s, s.config.floorLiftTicks + 60);
    expect(s.pending.length).toBe(0);
    expect(s.cubes.length).toBe(3);

    // Without the steps the cube can only be pushed: the lift comes as it did.
    const off = withDock({ dockSteps: false });
    run(off, off.config.floorLiftTicks);
    expect(off.pending).toMatchObject([{ x: 0, z: 6 }]);
  });

  it('comes as fast as it did: three seconds on the floor, whatever the new ways up', () => {
    expect(defaultConfig().floorLiftTicks).toBe(150);
    expect(DEFAULT_TUNING.liftMs).toBe(3000);
  });
});

describe('time limited', () => {
  it('ends when the clock runs out and says why', () => {
    const s = createRun({ seed: 5, config: defaultConfig({}, { timedSec: 30 }), timed: true });
    expect(s.mode).toBe('timed');
    run(s, s.config.timedTicks - 1);
    expect(s.over).toBe(false);
    step(s, null);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('time');
    expect(s.events).toContainEqual({ type: 'gameOver' });
    expect(s.tick).toBe(s.config.timedTicks);
  });

  it('does not put a clock on Endless', () => {
    const s = createRun({ seed: 5, config: defaultConfig({}, { timedSec: 30 }) });
    run(s, s.config.timedTicks + 100);
    expect(s.over).toBe(false);
    expect(s.endReason).toBeNull();
  });

  it('reports a full board as the reason in Endless', () => {
    const s = emptyRun();
    fill(s, 49);
    place(s, 0, 0, 'top');
    run(s, s.config.rescueTicks);
    expect(s.endReason).toBe('full');
  });
});

describe('determinism', () => {
  function play(config = defaultConfig()): string {
    const s = createRun({ seed: 99, config });
    const dirs: Dir[] = ['N', 'E', 'S', 'W'];
    for (let i = 0; i < 6000 && !s.over; i++) {
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
    const own = put(s, 2, 0, 6);
    own.ori = ori({ top: 6, east: 2 });
    place(s, 2, 0, 'top');
    step(s, 'W');
    const seen = collect(s, s.config.actionTicks + s.config.sinkingTicks + 5).map((e) => e.type);
    expect(seen.filter((t) => t === 'match').length).toBe(1);
    expect(seen.filter((t) => t === 'removed').length).toBe(2);
    expect(seen.filter((t) => t === 'fell').length).toBe(1);
    expect(s.stats.clears).toBe(1);
    expect(s.stats.clearTicks.length).toBe(1);
  });
});
