import { describe, expect, it } from 'vitest';
import { DELTA, DIRS } from '../rules/board';
import { solveLevel } from '../rules/levelSolver';
import { hasReadyGroup } from '../rules/spawn';
import type { LevelLayout, PuzzleDie } from '../rules/types';
import { FROM_ROUTE, candidate, isBoard, levelOf } from './generate';
import { islandsOf, underOf } from './measures';
import { PLACES, type Recipe, type Scene } from './recipes';
import { layFromRoute } from './route';

/** Dice a scene puts on the board: a combo of as many as its face has pips unless it says, a link of one, the 1 that is brought and the 1s that wait for it. */
function diceOf(scene: Scene, faces: readonly number[]): number {
  if (scene.event === 'combo') return scene.dice ?? scene.face ?? faces[0];
  return scene.event === 'link' ? 1 : 1 + (scene.dice ?? 1);
}
/** Dice the route of a place puts on the board. */
const asked = (of: Recipe): number => of.scenes!.reduce((sum, scene) => sum + diceOf(scene, of.faces), 0);

/** Places written for these tests, each with a route of its own: none of them is a place of the game. */
const place = (slot: number, size: number, faces: number[], scenes: Scene[], more: Partial<Recipe> = {}): Recipe => ({
  slot, chapter: 0, size, dice: scenes.reduce((sum, scene) => sum + diceOf(scene, faces), 0), faces, compact: false, par: [1, 6], scenes, ...more,
});
/** Three 3s, one of them a roll away. */
const PLAIN = place(78, 4, [3], [{ event: 'combo', face: 3, by: 'roll' }]);
/** The same with every die rolled away: the die of the event twice, the two others once. */
const BLIND = place(77, 4, [3], [{ event: 'combo', face: 3, by: 'roll', moves: [2, 2], loose: 2, looseMoves: [1, 1] }]);
/** The die of the event rolled away twice, any way it can go, and along one line where it can. */
const TWICE = place(76, 4, [3], [{ event: 'combo', face: 3, by: 'roll', moves: [2, 2] }]);
const STRAIGHT = place(76, 4, [3], [{ event: 'combo', face: 3, by: 'roll', moves: [2, 2], straight: true }]);
/** Three 3s and a fourth that joins them, in one cluster. */
const COMPACT = place(73, 4, [3], [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2], loose: 1 }, { event: 'link', face: 3, by: 'roll', moves: [1, 2] }], { compact: true });
/**
 * A pair made by a roll, and five 5s that stand apart and are made by a push. A 2 rolled once
 * never shows its 5, which lies under it: the dice of the two scenes are told apart by the face.
 */
const PUSHED = place(71, 5, [2, 5], [{ event: 'combo', face: 2, by: 'roll' }, { event: 'combo', face: 5, by: 'push', apart: true }]);
/** Three 3s, and the 1s: one pushed to the combo, two that stand and wait. */
const ONES = place(74, 4, [3], [{ event: 'combo', face: 3, by: 'roll' }, { event: 'ones', by: 'push', dice: 2 }], { ones: 3 });
/** The same with the 1 rolled to the combo: rolled away from it, it shows another face at the start. */
const ONES_ROLLED = place(75, 4, [3], [{ event: 'combo', face: 3, by: 'roll' }, { event: 'ones', by: 'roll', dice: 2 }], { ones: 3 });

/** The boards the first seeds of a place lay from its route, with the seed of each. */
function boards(of: Recipe, seeds = 120): { seed: number; layout: LevelLayout }[] {
  const laid: { seed: number; layout: LevelLayout }[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const layout = layFromRoute(of, seed);
    if (layout) laid.push({ seed, layout });
  }
  return laid;
}

const showing = (layout: LevelLayout, face: number): PuzzleDie[] => layout.dice.filter((die) => die.top === face);
const at = (layout: LevelLayout, x: number, z: number): PuzzleDie | undefined => layout.dice.find((die) => die.x === x && die.z === z);

function tops(size: number, dice: readonly PuzzleDie[]): number[] {
  const grid = new Array<number>(size * size).fill(0);
  for (const die of dice) grid[die.z * size + die.x] = die.top;
  return grid;
}

/** The dice joined by their sides to the die at a cell, that die among them. */
function clusterOf(layout: LevelLayout, from: { x: number; z: number }): PuzzleDie[] {
  const cluster = [at(layout, from.x, from.z)!];
  for (let i = 0; i < cluster.length; i++) {
    for (const dir of DIRS) {
      const next = at(layout, cluster[i].x + DELTA[dir].dx, cluster[i].z + DELTA[dir].dz);
      if (next && !cluster.includes(next)) cluster.push(next);
    }
  }
  return cluster;
}

describe('a board laid from its route', () => {
  it('is the same for one seed and another for another', () => {
    const [first, second] = boards(PLAIN, 20);
    expect(layFromRoute(PLAIN, first.seed)).toEqual(first.layout);
    expect(first.layout).not.toEqual(second.layout);
  });

  it('holds as many dice as its scenes say, every one lying as a die can, with no group ready to go', () => {
    for (const of of [PLAIN, BLIND, STRAIGHT, COMPACT, PUSHED, ONES, ONES_ROLLED]) {
      const laid = boards(of);
      expect(laid.length, `place ${of.slot}`).toBeGreaterThan(20);
      for (const { layout } of laid) {
        expect(layout.dice, `place ${of.slot}`).toHaveLength(asked(of));
        expect(isBoard(layout)).toBe(true);
        expect(new Set(layout.dice.map((die) => `${die.x},${die.z}`)).size).toBe(layout.dice.length);
        expect(hasReadyGroup(tops(of.size, layout.dice), of.size)).toBe(false);
      }
    }
  });

  it('starts the player on a die', () => {
    for (const of of [PLAIN, COMPACT, PUSHED, ONES]) {
      for (const { layout } of boards(of)) expect(at(layout, layout.start.x, layout.start.z)).toBeDefined();
    }
  });

  it('is nothing for a place with no route, and for a route that begins with a die brought to no combo', () => {
    expect(layFromRoute({ ...PLAIN, scenes: undefined }, 1)).toBeNull();
    expect(layFromRoute({ ...PLAIN, scenes: [] }, 1)).toBeNull();
    for (let seed = 1; seed <= 20; seed++) {
      expect(layFromRoute({ ...PLAIN, scenes: [{ event: 'link', face: 3, by: 'roll' }] }, seed)).toBeNull();
      expect(layFromRoute({ ...PLAIN, scenes: [{ event: 'ones', by: 'push' }] }, seed)).toBeNull();
    }
  });

  it('is the board the seeds above thirty thousand give', () => {
    const [{ seed, layout }] = boards(PLAIN, 20);
    expect(candidate(PLAIN, FROM_ROUTE + seed)).toMatchObject({ seed: FROM_ROUTE + seed, norm: 3, faces: [3], layout });
    expect(candidate({ ...PLAIN, scenes: undefined }, FROM_ROUTE + seed)).toBeNull();
  });
});

describe('a die taken away from its scene', () => {
  it('is rolled, and shows another face: of a combo the dice left in place show theirs still', () => {
    // One die of three is rolled away, once: the two others show their 3s.
    for (const { layout } of boards(PLAIN)) expect(showing(layout, 3)).toHaveLength(2);
    // The die of the event and one of the others; the die of the link as well.
    for (const { layout } of boards(COMPACT)) expect(showing(layout, 3)).toHaveLength(1);
    // Every die of the combo: no 3 is to be seen.
    for (const { layout } of boards(BLIND)) expect(showing(layout, 3)).toHaveLength(0);
  });

  it('has its face at the bottom after two rolls along one line, which it makes where it can when the scene asks', () => {
    const under = (of: Recipe): number => boards(of).filter(({ seed, layout }) => underOf(levelOf(of, seed, layout)) > 0).length;
    // One roll lays the face on a side.
    expect(under(PLAIN)).toBe(0);
    const straight = under(STRAIGHT);
    expect(straight).toBeGreaterThan(boards(STRAIGHT).length / 2);
    // Rolled twice any way it can go, it turns as often as not.
    expect(straight).toBeGreaterThan(under(TWICE));
  });

  it('is slid where it is pushed home, and shows the same face: it stands in line with its combo, a cell off, with a free cell behind it', () => {
    const { size } = PUSHED;
    const free = (layout: LevelLayout, x: number, z: number): boolean => x >= 0 && z >= 0 && x < size && z < size && !at(layout, x, z);
    const laid = boards(PUSHED);
    expect(laid.length).toBeGreaterThan(20);
    for (const { seed, layout } of laid) {
      const fives = showing(layout, 5);
      expect(fives, `seed ${seed}`).toHaveLength(5);
      // One of the 5s, pushed a cell on from the free cell behind it, makes the five a combo.
      const home = fives.some((die) =>
        DIRS.some((dir) => {
          const { dx, dz } = DELTA[dir];
          if (!free(layout, die.x + dx, die.z + dz) || !free(layout, die.x - dx, die.z - dz)) return false;
          const moved = fives.map((other) => (other === die ? { ...other, x: die.x + dx, z: die.z + dz } : other));
          return hasReadyGroup(tops(size, moved), size);
        }),
      );
      expect(home, `seed ${seed}`).toBe(true);
    }
  });

  it('makes a board that is cleared with a push, more often than never', () => {
    let pushed = 0;
    for (const { seed, layout } of boards(PUSHED, 30)) {
      const { solution } = solveLevel(levelOf(PUSHED, seed, layout), { maxMoves: 4 });
      if (solution?.moves.some((move) => move.push)) pushed++;
    }
    expect(pushed).toBeGreaterThan(0);
  });
});

describe('a scene laid apart', () => {
  it('is in another cluster than the start: no step leads to it', () => {
    for (const { seed, layout } of boards(PUSHED)) {
      const home = clusterOf(layout, layout.start);
      expect(home.some((die) => die.top === 5), `seed ${seed}`).toBe(false);
      expect(islandsOf(levelOf(PUSHED, seed, layout)), `seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('a board of one cluster', () => {
  it('is what a place that asks for one gets, and not what every route lays', () => {
    const laid = boards(COMPACT);
    expect(laid.length).toBeGreaterThan(20);
    for (const { seed, layout } of laid) expect(islandsOf(levelOf(COMPACT, seed, layout)), `seed ${seed}`).toBe(1);
    const loose = boards({ ...COMPACT, compact: false });
    expect(loose.some(({ seed, layout }) => islandsOf(levelOf(COMPACT, seed, layout)) > 1)).toBe(true);
  });
});

describe('the 1s of a route', () => {
  it('are on the board only where a scene put them: the one pushed to the combo, and those that wait', () => {
    for (const of of [PLAIN, BLIND, STRAIGHT, COMPACT, PUSHED]) {
      for (const { layout } of boards(of)) expect(showing(layout, 1), `place ${of.slot}`).toHaveLength(0);
    }
    for (const { layout } of boards(ONES)) expect(showing(layout, 1)).toHaveLength(3);
  });

  it('are those that wait alone where the 1 is rolled to the combo: it shows another face until it comes', () => {
    for (const { layout } of boards(ONES_ROLLED)) expect(showing(layout, 1)).toHaveLength(2);
  });

  it('work on the level of the board', () => {
    const [{ seed, layout }] = boards(ONES, 20);
    expect(candidate(ONES, FROM_ROUTE + seed)).toMatchObject({ values: [1, 3], faces: [1, 3], layout });
  });
});

describe('the routes of the places of the game', () => {
  /** Seeds every place is tried with: the tightest of them, seven dice on nine cells, lays a board from one seed in fifteen or so. */
  const SEEDS = 60;

  it('lay boards of as many dice as the place asks for, with a 1 only where the place sweeps the 1s, in one cluster where it asks for one', () => {
    for (const of of PLACES) {
      const swept = of.scenes!.some((scene) => scene.event === 'ones');
      const laid = boards(of, SEEDS);
      // A route that cannot be laid gives its place no board at all.
      expect(laid.length, of.id).toBeGreaterThan(0);
      for (const { seed, layout } of laid) {
        const what = `${of.id} seed ${seed}`;
        expect(layout.dice.length, what).toBeGreaterThanOrEqual(of.dice);
        expect(layout.dice.length, what).toBeLessThanOrEqual(of.dice + (of.more ?? 0));
        expect(isBoard(layout), what).toBe(true);
        expect(hasReadyGroup(tops(of.size, layout.dice), of.size), what).toBe(false);
        if (!swept) expect(showing(layout, 1), what).toHaveLength(0);
        if (of.compact) expect(islandsOf(levelOf(of, seed, layout)), what).toBe(1);
        expect(at(layout, layout.start.x, layout.start.z), what).toBeDefined();
      }
    }
    // Twenty places, sixty seeds each, and a seed of a crowded board is tried sixty times before it gives up.
  }, 30_000);
});
