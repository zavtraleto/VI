import { describe, expect, it } from 'vitest';
import { DELTA, DIRS } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { moveOf, tryWay } from '../rules/levelSolver';
import { createRun } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import type { LevelLayout } from '../rules/types';
import { FROM_ROUTE, FROM_SOLUTION, SKETCH, boardText, builtWay, candidate, isBoard, layFromSolution, layOut, levelId, levelOf } from './generate';
import { LEVELS } from './levels';
import { PLACES, type Recipe } from './recipes';
import { gather, judge, levelSource, placeReport } from './select';

/**
 * Places written for these tests: none of them is a place of the game. A board is laid from the
 * seed and the number of its place, so each keeps the number it was first tried with.
 */
/** Three dice where 3s work, in one cluster. */
const THREE: Recipe = { slot: 2, chapter: 0, size: 3, dice: 3, faces: [3], compact: true, par: [2, 3] };
/** Six dice where 3s work: two combos, or one and three links. */
const SIX: Recipe = { slot: 5, chapter: 0, size: 4, dice: 6, faces: [3], compact: true, par: [3, 5] };
/** Five dice of two faces on a small board. */
const FIVE: Recipe = { slot: 10, chapter: 0, size: 3, dice: 5, faces: [2, 3], compact: true, par: [4, 5] };
/** Seven dice of two faces. */
const SEVEN: Recipe = { slot: 12, id: 'X12', chapter: 0, size: 4, dice: 7, faces: [2, 3], compact: true, par: [5, 7] };
/** Nine dice on a wide board, in as many clusters as they fall into. */
const WIDE: Recipe = { slot: 15, chapter: 0, size: 5, dice: 9, faces: [2, 3], compact: false, par: [7, 10] };
/** Six dice, or seven, or eight. */
const MORE: Recipe = { slot: 20, chapter: 0, size: 5, dice: 6, more: 2, faces: [5], compact: false, par: [5, 7] };
/** Four 5s that stand assembled, and a fifth die. */
const STANDING: Recipe = { slot: 17, chapter: 0, size: 4, dice: 5, faces: [5], standing: [{ value: 5, count: 4 }], compact: true, par: [1, 2] };
/** Six dice where 5s work: a combo and a link. */
const FIVES: Recipe = { slot: 19, chapter: 0, size: 4, dice: 6, faces: [5], compact: true, par: [3, 5] };
/** Six dice, two of them 1s. */
const WITH_ONES: Recipe = { slot: 31, chapter: 0, size: 4, dice: 6, faces: [3], ones: 2, compact: false, par: [3, 5] };
/** Two 3s that stand and a third die one roll away: a board cleared with one move, which the place shows with an arrow. */
const ONE_ROLL: Recipe = { slot: 1, id: 'X01', chapter: 0, size: 3, dice: 3, faces: [3], standing: [{ value: 3, count: 2 }], compact: true, par: [1, 1], random: [0.4, 1], avoid: ['floor', 'glass', 'ones'], lesson: 'lineCombo', arrow: true };

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

describe('the name of a level', () => {
  it('is the one its place gives it, or `B` and the number of the place', () => {
    expect(levelId({ slot: 1 })).toBe('B01');
    expect(levelId({ slot: 20 })).toBe('B20');
    expect(levelId({ slot: 3, id: 'P03' })).toBe('P03');
  });
});

describe('a board laid at random', () => {
  it('is the same for one seed and another for another', () => {
    const [first, second] = boards(SEVEN, layOut, 30);
    expect(layOut(SEVEN, first.seed)).toEqual(first.layout);
    expect(first.layout).not.toEqual(second.layout);
  });

  it('holds the dice of its place, every one lying as a die can, with no group ready to go and no 1 on top', () => {
    for (const place of [THREE, SIX, SEVEN, WIDE, MORE, STANDING]) {
      const laid = boards(place, layOut);
      expect(laid.length, `place ${place.slot}`).toBeGreaterThan(5);
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

  it('holds some dice over the number of its place where the place lets it, and not on every board', () => {
    const counts = new Set(boards(MORE, layOut).map(({ layout }) => layout.dice.length));
    expect([...counts].sort()).toEqual([6, 7, 8]);
  });

  it('shows a 1 on as many dice as the place asks for', () => {
    const laid = boards(WITH_ONES, layOut);
    expect(laid.length).toBeGreaterThan(5);
    for (const { layout } of laid) expect(layout.dice.filter((die) => die.top === 1)).toHaveLength(2);
  });

  it('puts down the dice that stand assembled side by side, fewer than their group', () => {
    for (const { layout } of boards(STANDING, layOut)) {
      expect(layout.dice.filter((die) => die.top === 5).length).toBeGreaterThanOrEqual(4);
      expect(hasReadyGroup(tops(STANDING, layout), 4)).toBe(false);
    }
  });

  it('starts the player on a die that can be rolled', () => {
    for (const { layout } of boards(SEVEN, layOut)) {
      const { start } = layout;
      expect(layout.dice.some((die) => die.x === start.x && die.z === start.z)).toBe(true);
      const open = DIRS.some((dir) => {
        const x = start.x + DELTA[dir].dx;
        const z = start.z + DELTA[dir].dz;
        return x >= 0 && z >= 0 && x < SEVEN.size && z < SEVEN.size && !layout.dice.some((die) => die.x === x && die.z === z);
      });
      expect(open).toBe(true);
    }
  });
});

describe('a board laid from its solution', () => {
  it('is the same for one seed, and is the board the seeds above ten thousand give', () => {
    const [first] = boards(SIX, layFromSolution, 20);
    expect(layFromSolution(SIX, first.seed)).toEqual(first.layout);
    expect(candidate(SIX, FROM_SOLUTION + first.seed)?.layout).toEqual(first.layout);
  });

  it('holds the dice of its place with no group ready to go, in one cluster where the place asks for one', () => {
    for (const place of [THREE, SIX, FIVE, FIVES]) {
      const laid = boards(place, layFromSolution, 40);
      expect(laid.length, `place ${place.slot}`).toBeGreaterThan(10);
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
    let cleared = 0;
    const laid = boards(SIX, layFromSolution, 40);
    for (const { seed } of laid) {
      const way = builtWay(SIX, seed)!;
      expect(way.length).toBeGreaterThanOrEqual(SIX.par[0]);
      expect(way.length).toBeLessThanOrEqual(SIX.par[1]);
      try {
        if (tryWay(candidate(SIX, FROM_SOLUTION + seed)!, way.map(moveOf)).state.endReason === 'passed') cleared++;
      } catch {
        // A way made backwards may not be one forwards: a die it rolls is out of reach, or a group has gone before the next die comes.
      }
    }
    expect(cleared).toBeGreaterThan(0);
    expect(builtWay(SIX, laid[0].seed)).toEqual(builtWay(SIX, laid[0].seed));
  });
});

describe('a candidate of a place', () => {
  it('is a level to clear by the rules of the levels, that a run can be started on', () => {
    const [{ seed }] = boards(SEVEN, layOut, 30);
    const level = candidate(SEVEN, seed)!;
    expect(level).toMatchObject({ id: 'X12', chapter: 0, seed, size: 4, values: [2, 3], faces: [2, 3], sinkMoves: 2, liftMoves: 1, arrival: 'none', goal: { kind: 'clear' }, moves: 0 });
    expect(level.norm).toBe(level.layout!.dice.length);
    const state = createRun({ seed: level.seed, config: defaultConfig(), level });
    expect(state.cubes).toHaveLength(level.norm);
    // Nothing comes to the board, so its floor is strict: a die that cannot be pushed is not climbed.
    expect(state.config.experiments.floorClimb).toBe(false);
    expect(boardText(level).split('\n')).toHaveLength(4);
  });

  it('lets the 1s work with the faces of its place where the place has 1s', () => {
    const [{ seed, layout }] = boards(WITH_ONES, layOut, 30);
    expect(levelOf(WITH_ONES, seed, layout)).toMatchObject({ values: [1, 3], faces: [1, 3] });
    expect(levelOf({ ...WITH_ONES, ones: undefined }, seed, layout)).toMatchObject({ values: [3], faces: [3] });
  });

  it('is played as its place says: the floor shut, a net, a line and what the line waits for, the window before it', () => {
    const [{ seed, layout }] = boards(THREE, layOut, 30);
    const plain = levelOf(THREE, seed, layout);
    for (const key of ['floor', 'guard', 'lesson', 'until', 'guide', 'story'] as const) expect(plain[key], key).toBeUndefined();
    const told = levelOf({ ...THREE, floor: false, guard: true, lesson: 'lineCombo', until: 'combo', guide: true, story: 'storyHello' }, seed, layout);
    expect(told).toMatchObject({ floor: false, guard: true, lesson: 'lineCombo', until: 'combo', guide: true, story: 'storyHello' });
  });

  it('is laid by the way its seed says: at random, from its solution, by hand, from its route', () => {
    const [{ seed, layout }] = boards(SIX, layOut, 30);
    expect(candidate(SIX, seed)?.layout).toEqual(layout);
    // A place with no board laid by hand and no route has none above those marks.
    expect(candidate(SIX, SKETCH + 1)).toBeNull();
    expect(candidate(SIX, FROM_ROUTE + 1)).toBeNull();
    expect(candidate({ ...SIX, sketch: [layout] }, SKETCH + 1)).toMatchObject({ seed: SKETCH + 1, layout });
  });

  it('is judged the same every time, and a seed that lays no board says so', () => {
    const none = Array.from({ length: 60 }, (_, i) => i + 1).find((seed) => candidate(ONE_ROLL, seed) === null)!;
    expect(judge(ONE_ROLL, none)).toEqual({ seed: none, fit: null, why: 'no board laid' });
    expect(judge(ONE_ROLL, 7)).toEqual(judge(ONE_ROLL, 7));
    expect(judge(ONE_ROLL, FROM_SOLUTION + 1)).toEqual(judge(ONE_ROLL, FROM_SOLUTION + 1));
  });

  it('gives the levels of the game back from their seeds: the first places, which are quick to judge', () => {
    for (const level of LEVELS.slice(0, 4)) {
      const place = PLACES.find((other) => levelId(other) === level.id)!;
      const verdict = judge(place, level.seed);
      expect(verdict.why, level.id).toBe('');
      expect(verdict.fit?.spec, level.id).toEqual(level);
    }
  });

  it('is turned away for the first bound it does not meet, and the reasons are counted', () => {
    // Boards laid at random and boards laid from their solutions, judged together.
    const seeds = [...Array.from({ length: 30 }, (_, i) => i + 1), ...Array.from({ length: 30 }, (_, i) => FROM_SOLUTION + i + 1)];
    const verdicts = seeds.map((seed) => judge(ONE_ROLL, seed));
    const filled = gather(ONE_ROLL, verdicts);
    expect(filled.tried).toBe(60);
    expect(filled.fits.length + Object.values(filled.reasons).reduce((sum, count) => sum + count, 0)).toBe(60);
    expect(filled.reasons['no board laid']).toBeGreaterThan(0);
    expect(filled.fits.length).toBeGreaterThan(0);
    const distances = filled.fits.map((fit) => fit.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    for (const fit of filled.fits) {
      expect(fit).toMatchObject({ par: 1, exact: true, route: 'K', kind: 'top', misses: [] });
      // The board that fits is the one its seed lays, and the way it keeps clears it.
      expect(fit.spec.layout).toEqual(candidate(ONE_ROLL, fit.seed)!.layout);
      expect(tryWay(fit.spec, fit.spec.solution!.map(moveOf)).state.endReason).toBe('passed');
    }
    expect(placeReport(filled, 3, 0).split('\n')[0]).toBe(`place 1: ${filled.fits.length} of 60 seeds fit`);
    expect(levelSource(filled.fits[0].spec)).toMatch(/^ {2}\{ id: 'X01', chapter: 0, seed: \d+, size: 3, .*faces: \[3\], sinkMoves: 2, liftMoves: 1, lesson: 'lineCombo', arrow: '[NESW]', par: 1, exact: true, solution: \['\d,\d,[NESW]'\], layout: \{ start: .* \},$/);
  });
});
