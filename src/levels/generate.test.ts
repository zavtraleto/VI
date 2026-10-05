import { describe, expect, it } from 'vitest';
import { DELTA, DIRS } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { moveOf, tryWay } from '../rules/levelSolver';
import { createRun } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import type { LevelLayout } from '../rules/types';
import { FROM_SOLUTION, boardText, builtWay, candidate, isBoard, layFromSolution, layOut, levelId } from './generate';
import { LEVELS } from './levels';
import { CHAPTERS, RECIPES, boundsOf, type Recipe } from './recipes';
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
  it('number their places from one, chapter after chapter', () => {
    expect(RECIPES.map((place) => place.slot)).toEqual(RECIPES.map((_, index) => index + 1));
    const chapters = RECIPES.map((place) => place.chapter!);
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
    expect(new Set(chapters)).toEqual(new Set(CHAPTERS.map((_, index) => index + 1)));
  });

  it('ask of a place the faces of its chapter, and enough dice for a group of them', () => {
    for (const place of RECIPES) {
      const { faces } = CHAPTERS[place.chapter! - 1];
      expect([...place.faces].sort(), `place ${place.slot}`).toEqual([...faces].sort());
      expect(place.dice, `place ${place.slot}`).toBeGreaterThanOrEqual(Math.min(...faces));
      expect(place.ones ?? 0).toBe(0);
    }
  });

  it('begin every chapter with a line that says which faces work', () => {
    CHAPTERS.forEach((_, index) => {
      const first = RECIPES.find((place) => place.chapter === index + 1)!;
      expect(first.lesson, `chapter ${index + 1}`).toBeDefined();
    });
  });

  it('list what a place is measured by, from what to what', () => {
    expect(boundsOf(recipe(1))).toEqual([
      { what: 'par', from: 1, to: 1 },
      { what: 'random', from: 0.4, to: 1 },
    ]);
  });

  it('name a level by its place', () => {
    expect(levelId(1)).toBe('B01');
    expect(levelId(20)).toBe('B20');
  });
});

describe('a board laid at random', () => {
  it('is the same for one seed and another for another', () => {
    const place = recipe(12);
    const [first, second] = boards(place, layOut, 30);
    expect(layOut(place, first.seed)).toEqual(first.layout);
    expect(first.layout).not.toEqual(second.layout);
  });

  it('holds the dice of its place, every one lying as a die can, with no group ready to go and no 1 on top', () => {
    for (const slot of [2, 5, 12, 15, 20, 23]) {
      const place = recipe(slot);
      const laid = boards(place, layOut);
      expect(laid.length, `place ${slot}`).toBeGreaterThan(5);
      for (const { layout } of laid) {
        expect(layout.dice.length).toBeGreaterThanOrEqual(place.dice);
        expect(layout.dice.length).toBeLessThanOrEqual(place.dice + (place.more ?? 0));
        expect(isBoard(layout)).toBe(true);
        expect(new Set(layout.dice.map((die) => `${die.x},${die.z}`)).size).toBe(layout.dice.length);
        expect(hasReadyGroup(tops(place, layout), place.size)).toBe(false);
        expect(layout.dice.some((die) => die.top === 1)).toBe(false);
        if (place.compact) expect(oneCluster(layout)).toBe(true);
      }
    }
  });

  it('puts down the dice that stand assembled side by side, fewer than their group', () => {
    for (const { layout } of boards(recipe(17), layOut)) {
      expect(layout.dice.filter((die) => die.top === 5).length).toBeGreaterThanOrEqual(4);
      expect(hasReadyGroup(tops(recipe(17), layout), 4)).toBe(false);
    }
  });

  it('starts the player on a die that can be rolled', () => {
    const place = recipe(12);
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
  });
});

describe('a board laid from its solution', () => {
  it('is the same for one seed, and is the board the seeds above ten thousand give', () => {
    const place = recipe(5);
    const [first] = boards(place, layFromSolution, 20);
    expect(layFromSolution(place, first.seed)).toEqual(first.layout);
    expect(candidate(place, FROM_SOLUTION + first.seed)?.layout).toEqual(first.layout);
  });

  it('holds the dice of its place with no group ready to go, in one cluster where the place asks for one', () => {
    for (const slot of [2, 5, 10, 19]) {
      const place = recipe(slot);
      const laid = boards(place, layFromSolution, 40);
      expect(laid.length, `place ${slot}`).toBeGreaterThan(10);
      for (const { layout } of laid) {
        expect(layout.dice.length).toBeGreaterThanOrEqual(place.dice);
        expect(isBoard(layout)).toBe(true);
        expect(hasReadyGroup(tops(place, layout), place.size)).toBe(false);
        expect(oneCluster(layout)).toBe(true);
        expect(layout.dice.some((die) => die.top === 1)).toBe(false);
      }
    }
  });

  it('brings the way it was built by: as many moves as the place takes, and on some boards they clear it', () => {
    const place = recipe(5);
    let cleared = 0;
    const laid = boards(place, layFromSolution, 40);
    for (const { seed } of laid) {
      const way = builtWay(place, seed)!;
      expect(way.length).toBeGreaterThanOrEqual(place.par[0]);
      expect(way.length).toBeLessThanOrEqual(place.par[1]);
      try {
        if (tryWay(candidate(place, FROM_SOLUTION + seed)!, way.map(moveOf)).state.endReason === 'passed') cleared++;
      } catch {
        // A way made backwards may not be one forwards: a die it rolls is out of reach, or a group has gone before the next die comes.
      }
    }
    expect(cleared).toBeGreaterThan(0);
    expect(builtWay(place, laid[0].seed)).toEqual(builtWay(place, laid[0].seed));
  });
});

describe('a candidate of a place', () => {
  it('is a level to clear by the rules of the ladder, that a run can be started on', () => {
    const place = recipe(12);
    const [{ seed }] = boards(place, layOut, 30);
    const level = candidate(place, seed)!;
    expect(level).toMatchObject({ id: 'B12', seed, size: 4, faces: [2, 3], sinkMoves: 2, liftMoves: 1, arrival: 'none', goal: { kind: 'clear' }, moves: 0 });
    const state = createRun({ seed: level.seed, config: defaultConfig(), level });
    expect(state.cubes).toHaveLength(level.norm);
    expect(boardText(level).split('\n')).toHaveLength(4);
  });

  it('is judged the same every time, and a seed that lays no board says so', () => {
    const place = recipe(1);
    const none = Array.from({ length: 60 }, (_, i) => i + 1).find((seed) => candidate(place, seed) === null)!;
    expect(judge(place, none)).toEqual({ seed: none, fit: null, why: 'no board laid' });
    expect(judge(place, 7)).toEqual(judge(place, 7));
  });

  it('gives the levels of the ladder back from their seeds: the first places, which are quick to judge', () => {
    for (const level of LEVELS.slice(0, 4)) {
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
    const distances = filled.fits.map((fit) => fit.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    for (const fit of filled.fits) expect(fit).toMatchObject({ par: 1, exact: true });
    expect(placeReport(filled, 3, 0).split('\n')[0]).toBe(`place 1: ${filled.fits.length} of 60 seeds fit`);
    if (filled.fits.length > 0) expect(levelSource(filled.fits[0].spec)).toMatch(/^ {2}\{ id: 'B01', seed: \d+, size: 3, .*faces: \[3\], sinkMoves: 2, liftMoves: 1, lesson: 'lessonThrees', arrow: '[NESW]', par: 1, exact: true, solution: \['\d,\d,[NESW]'\], layout: \{ start: .* \},$/);
  });
});
