import { describe, expect, it } from 'vitest';
import { DELTA, cubeAt, isFree } from './board';
import { findPlans } from './bot';
import { DEFAULT_TUNING, defaultConfig, msToTicks, paceIntervalTicks, ruleKey } from './config';
import { roll } from './orientation';
import { createRun, step } from './sim';
import { population } from './spawn';
import { previewMove } from './preview';
import { act, emptyRun, land, put, run } from './testkit';
import type { Dir, ExperimentConfig, GameEvent, RunState, Tuning } from './types';

const warned = (e: GameEvent) => e.type === 'warned';

function collect(s: RunState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

function interval(s: RunState): number {
  return paceIntervalTicks(s.config, s.mode, s.level, s.tick, population(s));
}

/** A board one cube under the danger mark, with nothing on it that goes together. */
function crowded(experiments: Partial<ExperimentConfig> = {}, tuning: Partial<Tuning> = {}): RunState {
  const s = emptyRun(experiments, 1, { feedRate: 0, helpRate: 0, ...tuning });
  for (let i = 0; i < 41; i++) put(s, i % 7, Math.floor(i / 7), (i % 7 + Math.floor(i / 7)) % 2 === 0 ? 6 : 5);
  return s;
}

describe('the last sliver', () => {
  const c = defaultConfig();
  const at = (cubes: number, config = c) => paceIntervalTicks(config, 'endless', 1, 0, cubes);

  it('leaves the pace alone up to the danger mark', () => {
    expect(c.warnOccupied).toBe(42);
    expect(at(30)).toBe(300); // 5 s x 1.2
    expect(at(42)).toBe(300);
  });

  it('stretches the interval past the danger mark, the more the nearer the board is to full', () => {
    for (let cubes = 42; cubes < 49; cubes++) expect(at(cubes + 1)).toBeGreaterThan(at(cubes));
    expect(DEFAULT_TUNING.edgeFactor).toBeGreaterThan(DEFAULT_TUNING.crowdedFactor);
    expect(at(49)).toBe(msToTicks(DEFAULT_TUNING.paceStartMs * DEFAULT_TUNING.edgeFactor));
  });

  it('does the same for the session of the day', () => {
    const timed = (cubes: number) => paceIntervalTicks(c, 'timed', 1, 0, cubes);
    expect(timed(49)).toBeGreaterThan(timed(42));
    expect(timed(49)).toBe(msToTicks(DEFAULT_TUNING.timedStartMs * DEFAULT_TUNING.edgeFactor));
  });

  it('holds the noise for a while after a clear made at the danger mark', () => {
    const s = crowded();
    put(s, 0, 6, 2);
    land(s, put(s, 1, 6, 2));
    expect(s.reactions).toMatchObject([{ chain: 1 }]);
    const calm = msToTicks(DEFAULT_TUNING.edgeCalmMs);
    expect(calm).toBeGreaterThan(0);
    expect(s.edgeCalmLeft).toBe(calm);
    s.spawnEnabled = true;
    expect(collect(s, calm).some(warned)).toBe(false);
    expect(collect(s, interval(s)).some(warned)).toBe(true);
  });

  it('holds it once for a stay at the danger mark: more clears there buy no more, until the board has been out of danger', () => {
    const s = crowded();
    put(s, 0, 6, 2);
    land(s, put(s, 1, 6, 2));
    const calm = msToTicks(DEFAULT_TUNING.edgeCalmMs);
    expect(s.edgeCalmLeft).toBe(calm);
    // The silence runs out with the board still at the mark; the next clear there adds nothing.
    s.edgeCalmLeft = 0;
    put(s, 3, 6, 2);
    land(s, put(s, 4, 6, 2));
    expect(s.cubes.length).toBeGreaterThanOrEqual(s.config.warnOccupied);
    expect(s.edgeCalmLeft).toBe(0);
    // The 2s go; the board is under the mark again, and then at it once more.
    run(s, s.config.sinkingTicks + 1);
    expect(s.cubes.length).toBeLessThan(s.config.warnOccupied);
    put(s, 0, 6, 2);
    land(s, put(s, 1, 6, 2));
    expect(s.cubes.length).toBeGreaterThanOrEqual(s.config.warnOccupied);
    expect(s.edgeCalmLeft).toBe(calm);
  });

  it('gives nothing for a clear on a board that is not in danger', () => {
    const s = emptyRun({}, 1, { feedRate: 0, helpRate: 0 });
    put(s, 0, 6, 2);
    land(s, put(s, 1, 6, 2));
    expect(s.reactions).toMatchObject([{ chain: 1 }]);
    expect(s.edgeCalmLeft).toBe(0);
  });

  it('is an experiment: switched off, the edge is as hard as the rest of the board', () => {
    const off = defaultConfig({ lastSliver: false });
    expect(at(49, off)).toBe(at(42, off));
    const s = crowded({ lastSliver: false });
    put(s, 0, 6, 2);
    land(s, put(s, 1, 6, 2));
    expect(s.edgeCalmLeft).toBe(0);
    expect(defaultConfig().experiments.lastSliver).toBe(true);
    expect(ruleKey(off)).not.toBe(ruleKey(defaultConfig()));
  });
});

describe('a gift', () => {
  const SHOWN: readonly Dir[] = ['N', 'W'];

  /** Two 3s side by side wait for a third; nothing has been cleared for a while, and a gift is certain. */
  function waiting(seed: number, experiments: Partial<ExperimentConfig> = {}, tuning: Partial<Tuning> = {}): RunState {
    const s = emptyRun({ gift: true, ...experiments }, seed, { feedRate: 0, helpRate: 0, giftRate: 1, giftMax: 1, ...tuning });
    put(s, 3, 3, 3);
    put(s, 4, 3, 3);
    s.sinceClear = 4;
    s.spawnEnabled = true;
    return s;
  }

  /** The rolls that would bring the announced cube into the group, showing the group's value. */
  function finishingRolls(s: RunState): Dir[] {
    const { x, z, ori } = s.pending[0];
    return SHOWN.filter((dir) => {
      const tx = x + DELTA[dir].dx;
      const tz = z + DELTA[dir].dz;
      if (!isFree(s, tx, tz) || roll(ori, dir).top !== 3) return false;
      return (['N', 'E', 'S', 'W'] as const).some((d) => cubeAt(s, tx + DELTA[d].dx, tz + DELTA[d].dz)?.ori.top === 3);
    });
  }

  it('comes up one roll away from a group that lacks one die, with the value on a face the camera shows', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = waiting(seed);
      run(s, interval(s));
      expect(s.pending.length).toBe(1);
      expect(finishingRolls(s).length).toBeGreaterThan(0);
      expect(s.stats.gifts).toBe(1);
    }
  });

  it('comes up where it can be stepped onto: beside a standing die, when there is such a place', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = waiting(seed);
      put(s, 2, 5, 6);
      run(s, interval(s));
      const { x, z } = s.pending[0];
      expect(finishingRolls(s).length).toBeGreaterThan(0);
      expect(Math.abs(x - 2) + Math.abs(z - 5)).toBe(1);
    }
  });

  it('clears nothing by itself: it does not show the value and does not stand beside the group', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = waiting(seed);
      run(s, interval(s));
      const { x, z, ori } = s.pending[0];
      expect(ori.top).not.toBe(3);
      expect(Math.min(Math.abs(x - 3) + Math.abs(z - 3), Math.abs(x - 4) + Math.abs(z - 3))).toBe(2);
    }
  });

  it('is likelier with every cube that has come since the last clear, up to its limit, and starts over with a clear', () => {
    const count = (since: number, tuning: Partial<Tuning>) => {
      let gifts = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const s = waiting(seed, {}, tuning);
        s.sinceClear = since;
        run(s, interval(s));
        gifts += s.stats.gifts;
      }
      return gifts;
    };
    const slow = { giftRate: 0.1, giftMax: 0.5 };
    expect(count(0, slow)).toBe(0);
    expect(count(2, slow)).toBeGreaterThan(0);
    expect(count(5, slow)).toBeGreaterThan(count(2, slow));
    expect(count(50, slow)).toBeLessThan(40);
    // A clear starts the count of cubes over.
    const s = waiting(1);
    put(s, 0, 6, 2);
    land(s, put(s, 1, 6, 2));
    expect(s.sinceClear).toBe(0);
  });

  it('counts the cubes that come without a clear', () => {
    const s = emptyRun({ gift: true }, 3, { feedRate: 0, helpRate: 0, giftRate: 0 });
    s.spawnEnabled = true;
    const came = collect(s, 600).filter(warned).length;
    expect(came).toBeGreaterThan(2);
    expect(s.sinceClear).toBe(came);
  });

  it('is a plain cube when no group on the board lacks just one die', () => {
    const s = emptyRun({ gift: true }, 1, { feedRate: 0, helpRate: 0, giftRate: 1, giftMax: 1 });
    put(s, 3, 3, 4);
    put(s, 4, 3, 4);
    s.sinceClear = 4;
    s.spawnEnabled = true;
    run(s, interval(s));
    expect(s.pending.length).toBe(1);
    expect(s.stats.gifts).toBe(0);
  });

  it('is not given in the session of the day', () => {
    const config = defaultConfig({ gift: true, floorLift: false, gentleStart: false, waves: false }, { feedRate: 0, helpRate: 0, giftRate: 1, giftMax: 1 });
    const s = createRun({ seed: 1, config, timed: true, empty: true });
    put(s, 3, 3, 3);
    put(s, 4, 3, 3);
    s.sinceClear = 4;
    run(s, 2000);
    expect(s.pending.length + s.cubes.length).toBeGreaterThan(3);
    expect(s.stats.gifts).toBe(0);
  });

  it('is an experiment, on by default, and belongs to the record key', () => {
    const s = waiting(1, { gift: false });
    run(s, interval(s));
    expect(s.pending.length).toBe(1);
    expect(s.stats.gifts).toBe(0);
    expect(defaultConfig().experiments.gift).toBe(true);
    expect(ruleKey(defaultConfig({ gift: false }))).not.toBe(ruleKey(defaultConfig()));
  });
});

describe('the opening', () => {
  const SHOWN: readonly Dir[] = ['N', 'W'];
  const firstClears = (s: RunState) => SHOWN.filter((dir) => previewMove(s, dir).clears);

  /**
   * The clear the opening lays out, if the board has it: within two moves, made by one roll that
   * turns up a face the camera shows. A board may hold another clear as near by chance.
   */
  const nearest = (s: RunState) =>
    findPlans(s, 2, 200, 16, 1).find((plan) => plan.kinds.at(-1) === 'roll' && SHOWN.includes(plan.moves.at(-1)!));

  it('lays an Endless run out with a clear a move or two away: one roll, of a face the camera shows, by the die under the player or the one beside it', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = createRun({ seed, config: defaultConfig() });
      const plan = nearest(s)!;
      expect(plan).toBeDefined();
      if (plan.moves.length === 2) expect(plan.kinds[0]).toBe('hop');
      for (const dir of plan.moves) act(s, dir);
      expect(s.stats.clears).toBe(1);
      expect(s.reactions).toMatchObject([{ chain: 1 }]);
    }
  });

  it('is not the same every time: the group is of 2s, 3s or 4s, and the die that finishes it is not always the player\'s own', () => {
    const values: number[] = [];
    const moves: number[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      const s = createRun({ seed, config: defaultConfig() });
      const plan = nearest(s)!;
      for (const dir of plan.moves) act(s, dir);
      values.push(s.reactions[0].value);
      moves.push(plan.moves.length);
    }
    expect([...new Set(values)].sort()).toEqual([2, 3, 4]);
    expect([...new Set(moves)].sort()).toEqual([1, 2]);
    // No one kind of group takes most of the openings.
    for (const value of [2, 3, 4]) expect(values.filter((v) => v === value).length).toBeLessThan(36);
  });

  it('leaves the clear to the player: nothing on the board goes together by itself', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = createRun({ seed, config: defaultConfig() });
      run(s, 40);
      expect(s.stats.clears).toBe(0);
      expect(s.reactions.length).toBe(0);
    }
  });

  it('finds room at an edge, and does without at a corner that has none', () => {
    for (let seed = 1; seed <= 20; seed++) {
      // West of the start there is no board: the opening is laid out with the rolls that are left.
      const edge = { ...defaultConfig(), startX: 0, startZ: 3 };
      expect(nearest(createRun({ seed, config: edge }))).toBeDefined();
      // In the north-west corner neither roll has a cell to go to: the run is laid out as it would be without an opening.
      const corner = { ...defaultConfig(), startX: 0, startZ: 0 };
      const s = createRun({ seed, config: corner });
      expect(s.cubes.length).toBe(s.config.startCubes);
      expect(new Set(s.cubes.map((c) => c.ori.top)).size).toBeGreaterThan(1);
    }
  });

  it('is not laid out for the session of the day, nor with the experiment off', () => {
    const ready = (make: (seed: number) => RunState) => {
      let count = 0;
      for (let seed = 1; seed <= 40; seed++) if (firstClears(make(seed)).length > 0) count++;
      return count;
    };
    expect(ready((seed) => createRun({ seed, config: defaultConfig(), timed: true }))).toBeLessThan(20);
    expect(ready((seed) => createRun({ seed, config: defaultConfig({ opening: false }) }))).toBeLessThan(20);
    expect(defaultConfig().experiments.opening).toBe(true);
    expect(ruleKey(defaultConfig({ opening: false }))).not.toBe(ruleKey(defaultConfig()));
  });
});

describe('a clean board', () => {
  const bonus = DEFAULT_TUNING.wipeBonus;

  /** An empty board on which a clean board is worth what it is in the game. */
  const board = () => emptyRun({}, 1, { wipeBonus: bonus });

  it('is an event with a reward: a clear that leaves no die standing gives points', () => {
    const s = board();
    expect(bonus).toBeGreaterThan(0);
    put(s, 0, 6, 2);
    land(s, put(s, 1, 6, 2));
    expect(s.events.map((e) => e.type)).toEqual(['match', 'wiped']);
    expect(s.events).toContainEqual({ type: 'wiped', points: bonus });
    expect(s.score).toBe(4 + bonus);
    expect(s.stats.wipes).toBe(1);
  });

  it('is worth more the further the run has gone', () => {
    const s = board();
    s.level = 5;
    put(s, 0, 6, 2);
    land(s, put(s, 1, 6, 2));
    expect(s.events).toContainEqual({ type: 'wiped', points: bonus * 5 });
  });

  it('is not given while a die still stands', () => {
    const s = board();
    put(s, 5, 5, 5);
    put(s, 0, 6, 2);
    land(s, put(s, 1, 6, 2));
    expect(s.events.some((e) => e.type === 'wiped')).toBe(false);
    expect(s.stats.wipes).toBe(0);
  });

  it('does not wait for dice that are still coming up: they do not stand yet', () => {
    const s = board();
    put(s, 5, 5, 5, 'rising');
    put(s, 0, 6, 2);
    land(s, put(s, 1, 6, 2));
    expect(s.stats.wipes).toBe(1);
  });

  it('can be tuned away', () => {
    const s = emptyRun({}, 1, { wipeBonus: 0 });
    put(s, 0, 6, 2);
    land(s, put(s, 1, 6, 2));
    expect(s.events.some((e) => e.type === 'wiped')).toBe(false);
    expect(s.score).toBe(4);
  });
});
