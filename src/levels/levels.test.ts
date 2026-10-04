import { describe, expect, it } from 'vitest';
import { packRun } from '../app/savedRun';
import { RunTally } from '../app/telemetry';
import { DELTA, DIRS } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { moveOf, tryWay } from '../rules/levelSolver';
import { createRun, step } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import type { LevelSpec } from '../rules/types';
import { t, type TextKey } from '../ui/i18n';
import { levelId } from './generate';
import { LEVELS, SPARES } from './levels';
import { RECIPES } from './recipes';

/** The place of the ladder a board is for, by its name. */
const slotOf = (spec: LevelSpec): number => Number(spec.id.slice(1));
const recipeOf = (spec: LevelSpec) => RECIPES.find((recipe) => recipe.slot === slotOf(spec))!;
const way = (spec: LevelSpec) => tryWay(spec, spec.solution!.map(moveOf));

/** Clusters the dice of a board make, joined by their sides. */
function clusters(spec: LevelSpec): number {
  const dice = spec.layout!.dice;
  const seen = new Set<number>();
  let count = 0;
  dice.forEach((_, first) => {
    if (seen.has(first)) return;
    count++;
    const stack = [first];
    seen.add(first);
    while (stack.length > 0) {
      const at = dice[stack.pop()!];
      dice.forEach((die, index) => {
        if (seen.has(index) || !DIRS.some((dir) => die.x === at.x + DELTA[dir].dx && die.z === at.z + DELTA[dir].dz)) return;
        seen.add(index);
        stack.push(index);
      });
    }
  });
  return count;
}

describe('the ladder of the first twenty levels', () => {
  it('has twenty levels, named by their places', () => {
    expect(LEVELS).toHaveLength(20);
    expect(LEVELS.map((level) => level.id)).toEqual(Array.from({ length: 20 }, (_, index) => levelId(index + 1)));
  });

  it('is made of boards to clear, given die by die: nothing comes, and the moves are not limited', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      expect(level.goal, level.id).toEqual({ kind: 'clear' });
      expect(level.arrival, level.id).toBe('none');
      expect(level.moves, level.id).toBe(0);
      expect(level.layout, level.id).toBeDefined();
      expect(level.norm, level.id).toBe(level.layout!.dice.length);
    }
  });

  it('has the boards and the numbers of dice of its places', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      const recipe = recipeOf(level);
      expect(level.size, level.id).toBe(recipe.size);
      expect(level.norm, level.id).toBeGreaterThanOrEqual(recipe.dice);
      expect(level.norm, level.id).toBeLessThanOrEqual(recipe.dice + (recipe.more ?? 0));
    }
    expect(LEVELS.map((level) => level.size)).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 3, 4, 4, 5, 5, 5, 4, 5]);
  });

  it('starts every level as it is given, with no group ready to go', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      const state = createRun({ seed: level.seed, config: defaultConfig(), level });
      expect(state.mode, level.id).toBe('level');
      expect(state.cubes, level.id).toHaveLength(level.norm);
      expect(state.cubes.every((cube) => cube.state === 'idle'), level.id).toBe(true);
      expect([state.player.x, state.player.z, state.player.level], level.id).toEqual([level.layout!.start.x, level.layout!.start.z, 'top']);
      const tops = new Array<number>(level.size * level.size).fill(0);
      for (const cube of state.cubes) tops[cube.z * level.size + cube.x] = cube.ori.top;
      expect(hasReadyGroup(tops, level.size), level.id).toBe(false);
    }
  });

  it('keeps for every level a way that clears its board in exactly as many moves as the level says', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      expect(level.solution, level.id).toBeDefined();
      expect(level.solution, level.id).toHaveLength(level.par!);
      const { state } = way(level);
      expect(state.endReason, level.id).toBe('passed');
      expect(state.levelRun!.moves, level.id).toBe(level.par);
    }
  });

  it('shows no 1 on top before the level that teaches the 1s, the seventh', () => {
    for (const level of LEVELS.slice(0, 6)) {
      expect(level.layout!.dice.every((die) => die.top !== 1), level.id).toBe(true);
    }
    expect(LEVELS[6].layout!.dice.filter((die) => die.top === 1)).toHaveLength(3);
  });

  it('needs no floor before the level that teaches it, the fourteenth: the way kept never steps down', () => {
    for (const level of LEVELS.slice(0, 13)) expect(way(level).uses, level.id).not.toContain('floor');
    expect(way(LEVELS[13]).uses).toContain('floor');
  });

  it('stands its dice in one cluster before the fourteenth level, all but the two of the first', () => {
    // Two dice side by side cannot make a pair in one roll: the first board holds them a roll apart.
    expect(clusters(LEVELS[0])).toBe(2);
    for (const level of LEVELS.slice(1, 13)) expect(clusters(level), level.id).toBe(1);
  });

  it('says a line on the levels that bring a rule, and only there', () => {
    for (const level of LEVELS) {
      const recipe = recipeOf(level);
      expect(level.lesson, level.id).toBe(recipe.lesson);
      if (level.lesson) expect(t(level.lesson as TextKey).length, level.id).toBeGreaterThan(0);
    }
    expect(LEVELS.filter((level) => level.lesson).map(slotOf)).toEqual([1, 2, 3, 6, 7, 8, 9, 11, 12, 14, 16, 20]);
  });

  it('shows its first roll on the first level and on no other, and that roll is the first move of its way', () => {
    expect(LEVELS.filter((level) => level.arrow).map(slotOf)).toEqual([1]);
    const first = LEVELS[0];
    const move = moveOf(first.solution![0]);
    expect(first.arrow).toBe(move.dir);
    expect([move.x, move.z]).toEqual([first.layout!.start.x, first.layout!.start.z]);
  });

  it('teaches with the way it keeps what its place is there to teach', () => {
    for (const level of LEVELS) {
      const recipe = recipeOf(level);
      const report = way(level);
      for (const technique of recipe.needs ?? []) expect(report.uses, level.id).toContain(technique);
      for (const technique of recipe.avoid ?? []) expect(report.uses, level.id).not.toContain(technique);
      if (recipe.walk) expect(report.ownFirst, level.id).toBe(false);
      if (recipe.commit) expect(report.commits, level.id).toBeGreaterThan(0);
    }
  });

  it('has boards in reserve that are other boards', () => {
    const boards = [...LEVELS, ...SPARES].map((level) => JSON.stringify(level.layout));
    expect(new Set(boards).size).toBe(boards.length);
    for (const spare of SPARES) expect(slotOf(spare)).toBeGreaterThanOrEqual(1);
  });

  it('is not kept for later when the page goes away: a level is started over', () => {
    const level = LEVELS[3];
    const state = createRun({ seed: level.seed, config: defaultConfig(), level });
    // A die is rolled, and the world has moved: a session that far in would be kept.
    const first = moveOf(level.solution![0]);
    state.player = { x: first.x, z: first.z, level: 'top' };
    step(state, first.dir);
    for (let i = 0; i < 20; i++) step(state, null);
    expect(state.tick).toBeGreaterThan(0);
    expect(packRun('endless', '2026-10-04', state, new RunTally())).toBeNull();
  });
});
