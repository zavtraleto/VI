import { describe, expect, it } from 'vitest';
import { DELTA, DIRS } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { createRun } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import type { LevelLayout } from '../rules/types';
import { moveOf, tryWay } from '../rules/levelSolver';
import { FROM_SOLUTION, boardText, builtWay, candidate, isBoard, layFromSolution, layOut, levelId } from './generate';
import { LEVELS } from './levels';
import { RECIPES, boundsOf, type Recipe } from './recipes';
import { gather, judge, levelSource, placeReport } from './select';

const recipe = (slot: number): Recipe => RECIPES.find((candidate) => candidate.slot === slot)!;

/** The boards the first seeds of a place lay, with the seed of each. */
function boards(of: Recipe, lay: (recipe: Recipe, seed: number) => LevelLayout | null, seeds = 60): { seed: number; layout: LevelLayout }[] {
  const laid: { seed: number; layout: LevelLayout }[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const layout = lay(of, seed);
    if (layout) laid.push({ seed, layout });
  }
  return laid;
}

function tops(of: Recipe, layout: LevelLayout): number[] {
  const grid = new Array<number>(of.size * of.size).fill(0);
  for (const die of layout.dice) grid[die.z * of.size + die.x] = die.top;
  return grid;
}

function oneCluster(layout: LevelLayout): boolean {
  const { dice } = layout;
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length > 0) {
    const at = dice[stack.pop()!];
    dice.forEach((die, index) => {
      if (seen.has(index) || !DIRS.some((dir) => die.x === at.x + DELTA[dir].dx && die.z === at.z + DELTA[dir].dz)) return;
      seen.add(index);
      stack.push(index);
    });
  }
  return seen.size === dice.length;
}

describe('recipes of the ladder', () => {
  it('are twenty, one for each place, in four blocks of boards that grow', () => {
    expect(RECIPES.map((place) => place.slot)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(RECIPES.map((place) => place.size)).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 3, 4, 4, 5, 5, 5, 4, 5]);
    expect(RECIPES.map((place) => place.dice)).toEqual([2, 3, 2, 5, 2, 3, 5, 3, 4, 7, 4, 5, 7, 6, 10, 6, 8, 10, 12, 9]);
  });

  it('stand their dice in one cluster up to the fourteenth place, all but the two of the first', () => {
    expect(RECIPES.filter((place) => place.compact).map((place) => place.slot)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('keep the floor out of the way until the place that teaches it', () => {
    for (const place of RECIPES.filter((candidate) => candidate.slot < 14)) expect(place.avoid, `place ${place.slot}`).toContain('floor');
    expect(recipe(14).needs).toEqual(['floor']);
  });

  it('list what a place is measured by, from what to what', () => {
    expect(boundsOf(recipe(1))).toEqual([
      { what: 'par', from: 1, to: 1 },
      { what: 'traps', from: 0, to: 0 },
      { what: 'random', from: 0.5, to: 1 },
    ]);
    expect(boundsOf(recipe(12))).toEqual([{ what: 'par', from: 4, to: 5 }]);
  });

  it('name a level by its place', () => {
    expect(levelId(1)).toBe('L01');
    expect(levelId(20)).toBe('L20');
  });
});

describe('a board laid at random', () => {
  it('is the same for one seed and another for another', () => {
    const place = recipe(10);
    const [first, second] = boards(place, layOut, 30);
    expect(layOut(place, first.seed)).toEqual(first.layout);
    expect(first.layout).not.toEqual(second.layout);
  });

  it('holds the dice of its place, every one lying as a die can, with no group ready to go', () => {
    for (const slot of [1, 4, 7, 10, 14, 16, 20]) {
      const place = recipe(slot);
      const laid = boards(place, layOut);
      expect(laid.length, `place ${slot}`).toBeGreaterThan(5);
      for (const { layout } of laid) {
        expect(layout.dice.length).toBeGreaterThanOrEqual(place.dice);
        expect(layout.dice.length).toBeLessThanOrEqual(place.dice + (place.more ?? 0));
        expect(isBoard(layout)).toBe(true);
        expect(new Set(layout.dice.map((die) => `${die.x},${die.z}`)).size).toBe(layout.dice.length);
        expect(hasReadyGroup(tops(place, layout), place.size)).toBe(false);
      }
    }
  });

  it('stands as one cluster where the place asks for one', () => {
    for (const slot of [4, 10, 13]) for (const { layout } of boards(recipe(slot), layOut)) expect(oneCluster(layout), `place ${slot}`).toBe(true);
  });

  it('shows as many 1s as the place says, and none where it says none', () => {
    for (const { layout } of boards(recipe(7), layOut)) expect(layout.dice.filter((die) => die.top === 1)).toHaveLength(3);
    for (const { layout } of boards(recipe(4), layOut)) expect(layout.dice.some((die) => die.top === 1)).toBe(false);
  });

  it('puts down the dice that stand assembled side by side, fewer than their group', () => {
    for (const { layout } of boards(recipe(16), layOut)) {
      const fives = layout.dice.filter((die) => die.top === 5);
      expect(fives.length).toBeGreaterThanOrEqual(4);
      expect(fives.length).toBeLessThan(5 + 2);
      // Four of them touch one another: no group of five is ready, and the board has no other fives to spare.
      expect(hasReadyGroup(tops(recipe(16), layout), 5)).toBe(false);
    }
  });

  it('starts the player on a die that can be rolled', () => {
    for (const slot of [1, 10, 19]) {
      const place = recipe(slot);
      for (const { layout } of boards(place, layOut)) {
        const { start } = layout;
        expect(layout.dice.some((die) => die.x === start.x && die.z === start.z)).toBe(true);
        const open = DIRS.some((dir) => {
          const x = start.x + DELTA[dir].dx;
          const z = start.z + DELTA[dir].dz;
          return x >= 0 && z >= 0 && x < place.size && z < place.size && !layout.dice.some((die) => die.x === x && die.z === z);
        });
        expect(open).toBe(true);
      }
    }
  });
});

describe('a board laid from its solution', () => {
  it('is the same for one seed, and is the board the seeds above ten thousand give', () => {
    const place = recipe(4);
    const [first] = boards(place, layFromSolution, 20);
    expect(layFromSolution(place, first.seed)).toEqual(first.layout);
    expect(candidate(place, FROM_SOLUTION + first.seed)?.layout).toEqual(first.layout);
    expect(candidate(place, first.seed)?.layout ?? null).not.toEqual(first.layout);
  });

  it('holds the dice of its place with no group ready to go, in one cluster where the place asks for one', () => {
    for (const slot of [3, 4, 5, 12, 13]) {
      const place = recipe(slot);
      const laid = boards(place, layFromSolution, 40);
      expect(laid.length, `place ${slot}`).toBeGreaterThan(10);
      for (const { layout } of laid) {
        expect(layout.dice.length).toBeGreaterThanOrEqual(place.dice);
        expect(layout.dice.length).toBeLessThanOrEqual(place.dice + (place.more ?? 0));
        expect(isBoard(layout)).toBe(true);
        expect(hasReadyGroup(tops(place, layout), place.size)).toBe(false);
        expect(oneCluster(layout)).toBe(true);
        expect(layout.dice.some((die) => die.top === 1)).toBe(false);
      }
    }
  });

  it('brings the way it was built by: as many moves as the place takes, and on most boards they clear it', () => {
    const place = recipe(4);
    let cleared = 0;
    const laid = boards(place, layFromSolution, 30);
    for (const { seed } of laid) {
      const way = builtWay(place, seed)!;
      expect(way.length).toBeGreaterThanOrEqual(place.par[0]);
      expect(way.length).toBeLessThanOrEqual(place.par[1]);
      try {
        if (tryWay(candidate(place, FROM_SOLUTION + seed)!, way.map(moveOf)).state.endReason === 'passed') cleared++;
      } catch {
        // A way made backwards may not be one forwards: a die it rolls is out of reach, or the board is cleared before its end.
      }
    }
    expect(cleared).toBeGreaterThan(laid.length / 3);
    expect(builtWay(place, laid[0].seed)).toEqual(builtWay(place, laid[0].seed));
  });

  it('fits a place of few moves far more often than a board laid at random', () => {
    const place = recipe(4);
    const fits = (from: number): number => Array.from({ length: 80 }, (_, i) => judge(place, from + i + 1)).filter((verdict) => verdict.fit).length;
    expect(fits(FROM_SOLUTION)).toBeGreaterThan(fits(0) + 3);
  });
});

describe('a candidate of a place', () => {
  it('is a level to clear, given die by die, that a run can be started on', () => {
    const place = recipe(10);
    const [{ seed }] = boards(place, layOut, 30);
    const level = candidate(place, seed)!;
    expect(level).toMatchObject({ id: 'L10', seed, size: 4, values: [1, 2, 3], arrival: 'none', goal: { kind: 'clear' }, moves: 0 });
    const state = createRun({ seed: level.seed, config: defaultConfig(), level });
    expect(state.cubes).toHaveLength(level.norm);
    expect(boardText(level).split('\n')).toHaveLength(4);
  });

  it('is judged the same every time, and a seed that lays no board says so', () => {
    const place = recipe(2);
    const none = Array.from({ length: 40 }, (_, i) => i + 1).find((seed) => candidate(place, seed) === null)!;
    expect(judge(place, none)).toEqual({ seed: none, fit: null, why: 'no board laid' });
    expect(judge(place, 7)).toEqual(judge(place, 7));
  });

  it('gives the levels of the ladder back from their seeds: the first places, which are quick to judge', () => {
    for (const level of LEVELS.slice(0, 6)) {
      const verdict = judge(recipe(Number(level.id.slice(1))), level.seed);
      expect(verdict.fit?.spec, level.id).toEqual(level);
    }
  });

  it('is turned away for the first bound it does not meet, and the reasons are counted', () => {
    const place = recipe(1);
    const verdicts = Array.from({ length: 60 }, (_, i) => judge(place, i + 1));
    const filled = gather(place, verdicts);
    expect(filled.tried).toBe(60);
    expect(filled.fits.length + Object.values(filled.reasons).reduce((sum, count) => sum + count, 0)).toBe(60);
    expect(Object.keys(filled.reasons)).toContain('more moves than 1, or none');
    // The boards that fit come nearest the middles of the bounds first.
    const distances = filled.fits.map((fit) => fit.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    for (const fit of filled.fits) expect(fit).toMatchObject({ par: 1, exact: true, traps: 0 });
    const report = placeReport(filled, 3, 0);
    expect(report.split('\n')[0]).toBe(`place 1: ${filled.fits.length} of 60 seeds fit`);
    if (filled.fits.length > 0) expect(levelSource(filled.fits[0].spec)).toMatch(/^ {2}\{ id: 'L01', seed: \d+, size: 3, .*lesson: 'lessonRoll', arrow: '[NESW]', par: 1, exact: true, solution: \['\d,\d,[NESW]'\], layout: \{ start: .* \},$/);
  });
});
