import { describe, expect, it } from 'vitest';
import { packRun } from '../app/savedRun';
import { RunTally } from '../app/telemetry';
import { defaultConfig } from '../rules/config';
import { playLevel, type LevelPlay } from '../rules/levelBot';
import { DIRS } from '../rules/board';
import { previewMove } from '../rules/preview';
import { createRun, step } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import { PROBE_LEVELS } from './levels';

/** The kind of a level: a board to clear, a combination, a chain. */
const kindOf = (id: string): string => id[0];

describe('levels of the probe', () => {
  it('are nine, each under a name of its own: three boards to clear, three combinations, three chains, by turns', () => {
    expect(PROBE_LEVELS).toHaveLength(9);
    expect(new Set(PROBE_LEVELS.map((level) => level.id)).size).toBe(9);
    expect(PROBE_LEVELS.map((level) => kindOf(level.id)).join('')).toBe('ckhckhckh');
    expect(new Set(PROBE_LEVELS.map((level) => level.size))).toEqual(new Set([5, 7]));
  });

  it('have the goal their kind is named for', () => {
    for (const level of PROBE_LEVELS) {
      const kind = kindOf(level.id);
      if (kind === 'c') expect(level.goal.kind).toBe('clear');
      if (kind === 'k') expect(level.goal.kind).toBe('order');
      if (kind === 'h') expect(level.goal.kind).toBe('chain');
    }
  });

  it('get no dice and have no limit where the board is to be cleared', () => {
    for (const level of PROBE_LEVELS.filter((candidate) => candidate.goal.kind === 'clear')) {
      expect(level.arrival).toBe('none');
      expect(level.moves).toBe(0);
    }
  });

  it('get dice and have a limit of forty moves or fewer everywhere else', () => {
    for (const level of PROBE_LEVELS.filter((candidate) => candidate.goal.kind !== 'clear')) {
      expect(level.arrival).toBe('refill');
      expect(level.moves).toBeGreaterThan(0);
      expect(level.moves).toBeLessThanOrEqual(40);
    }
  });

  it('get harder within a kind: more dice to clear, more to send, a longer chain', () => {
    const of = (kind: string) => PROBE_LEVELS.filter((level) => kindOf(level.id) === kind);
    expect(of('c').map((level) => level.norm)).toEqual([6, 12, 16]);
    expect(of('h').map((level) => (level.goal.kind === 'chain' ? level.goal.links : 0))).toEqual([3, 5, 8]);
    const asked = of('k').map((level) => (level.goal.kind === 'order' ? level.goal.items.reduce((sum, item) => sum + item.count, 0) : 0));
    expect(asked).toEqual([4, 6, 7]);
    // A chain is helped less and less by the dice that come.
    expect(of('h').map((level) => level.feedRate)).toEqual([1, 0.6, 0.4]);
  });

  it('each start with their number of dice standing and no group ready', () => {
    for (const level of PROBE_LEVELS) {
      const state = createRun({ seed: level.seed, config: defaultConfig(), level });
      expect(state.mode).toBe('level');
      expect(state.config.size).toBe(level.size);
      expect(state.cubes).toHaveLength(level.norm);
      expect(state.cubes.every((cube) => cube.state === 'idle')).toBe(true);
      for (const cube of state.cubes) expect(level.values).toContain(cube.ori.top);
      const tops = new Array<number>(level.size * level.size).fill(0);
      for (const cube of state.cubes) tops[cube.z * level.size + cube.x] = cube.ori.top;
      expect(hasReadyGroup(tops, level.size)).toBe(false);
    }
  });

  it('are not kept for later when the page goes away: a level is started over', () => {
    const level = PROBE_LEVELS[1];
    const state = createRun({ seed: level.seed, config: defaultConfig(), level: { ...level, moves: 0 } });
    // A die is rolled, and the world has moved: a session that far in would be kept.
    const roll = DIRS.find((dir) => previewMove(state, dir).kind === 'roll')!;
    step(state, roll);
    for (let i = 0; i < 20; i++) step(state, null);
    expect(state.tick).toBeGreaterThan(0);
    expect(state.over).toBe(false);
    expect(packRun('endless', '2026-10-04', state, new RunTally())).toBeNull();
  });

  /**
   * A run of a strong player of the rules that meets the goal: the proof that the level can be
   * passed. A run that will not make the limit is cut short there. Found once for a level.
   */
  const found = new Map<number, LevelPlay | null>();
  const witness = (index: number): LevelPlay | null => {
    if (found.has(index)) return found.get(index)!;
    const level = PROBE_LEVELS[index];
    let proof: LevelPlay | null = null;
    for (const skill of ['pro', 'esports', 'average'] as const) {
      for (let botSeed = 1; botSeed <= 10 && !proof; botSeed++) {
        const play = playLevel(level, skill, botSeed, level.moves > 0 ? level.moves : undefined);
        if (play.reached && (level.moves === 0 || play.moves <= level.moves)) proof = play;
      }
    }
    found.set(index, proof);
    return proof;
  };

  it('can each be passed, in their limit where they have one: a player of the rules does it', () => {
    PROBE_LEVELS.forEach((level, index) => expect(witness(index), level.id).not.toBeNull());
  });

  it('can each be cleared to the last die where the board is to be cleared', () => {
    PROBE_LEVELS.forEach((level, index) => {
      if (level.goal.kind !== 'clear') return;
      expect(witness(index), level.id).toMatchObject({ reached: true, left: 0 });
    });
  });
});
