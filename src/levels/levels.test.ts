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
import { rides, startsUnder, underOf } from './measures';
import { chaptersOf } from './progress';
import { CHAPTERS, LADDER_LIFT_MOVES, LADDER_SINK_MOVES, PLACES, RECIPES, type Recipe } from './recipes';
import { sameBoard } from './variety';

/** The place a board is for, by the name of its level: a place of the course or of a chapter after it, or one of the ladder as it was. */
const recipeOf = (spec: LevelSpec): Recipe => [...PLACES, ...RECIPES].find((recipe) => levelId(recipe) === spec.id)!;
const way = (spec: LevelSpec) => tryWay(spec, spec.solution!.map(moveOf));
/** The levels of the course and of the chapters that teach, and those of the ladder as it was. */
const NEW = LEVELS.filter((level) => PLACES.some((recipe) => levelId(recipe) === level.id));
const OLD = LEVELS.filter((level) => !NEW.includes(level));
/** Levels of two faces whose shortest way made only 3s: there the 2s work no more, and they go with the chapter of 3s. */
const THREES_ALONE = ['B13', 'B14'];

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

describe('the ladder of levels', () => {
  it('begins with the course and the chapter after it, a level for every place, and goes on with levels of the ladder as it was', () => {
    expect(NEW.map((level) => level.id)).toEqual(PLACES.map(levelId));
    expect(LEVELS.slice(0, PLACES.length)).toEqual(NEW);
    expect(OLD.map((level) => level.id).sort()).toEqual(['B05', 'B06', 'B07', 'B08', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B19', 'B20', 'B21']);
    for (const level of [...LEVELS, ...SPARES]) expect(recipeOf(level), level.id).toBeDefined();
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length);
  });

  it('is in chapters that follow one another: the course, the faces of a die, then 3s, 2s and 3s, 5s', () => {
    expect(chaptersOf(LEVELS)).toEqual([
      { chapter: 0, from: 0, to: 9 },
      { chapter: 1, from: 9, to: 18 },
      { chapter: 5, from: 18, to: 24 },
      { chapter: 6, from: 24, to: 29 },
      { chapter: 7, from: 29, to: 32 },
    ]);
    for (const level of LEVELS) expect(CHAPTERS[level.chapter!], level.id).toBeDefined();
  });

  it('is made of boards to clear, given die by die: nothing comes, and the moves are not limited', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      expect(level.goal, level.id).toEqual({ kind: 'clear' });
      expect(level.arrival, level.id).toBe('none');
      expect(level.moves, level.id).toBe(0);
      expect(level.norm, level.id).toBe(level.layout!.dice.length);
    }
  });

  it('lets only the faces of its place work, and sends a die that has joined a group off in two moves', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      const recipe = recipeOf(level);
      const alone = LEVELS.includes(level) && THREES_ALONE.includes(level.id);
      expect(level.faces, level.id).toEqual(alone ? [3] : [...recipe.faces].sort());
      expect(level.sinkMoves, level.id).toBe(LADDER_SINK_MOVES);
      expect(level.liftMoves, level.id).toBe(LADDER_LIFT_MOVES);
      const state = createRun({ seed: level.seed, config: defaultConfig(), level });
      expect(state.config.sinkingTicks, level.id).toBe(2 * state.config.actionTicks + 1);
    }
  });

  it('names for every level the chapter of its place', () => {
    for (const level of LEVELS) expect(level.chapter, level.id).toBe(THREES_ALONE.includes(level.id) ? 5 : recipeOf(level).chapter);
    for (const level of SPARES) expect(level.chapter, level.id).toBe(recipeOf(level).chapter);
  });

  it('has the boards and the numbers of dice of its places', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      const recipe = recipeOf(level);
      expect(level.size, level.id).toBe(recipe.size);
      expect(level.norm, level.id).toBeGreaterThanOrEqual(recipe.dice);
      expect(level.norm, level.id).toBeLessThanOrEqual(recipe.dice + (recipe.more ?? 0));
    }
  });

  it('starts every level as it is given, with no group ready to go and no 1 on top', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      const state = createRun({ seed: level.seed, config: defaultConfig(), level });
      expect(state.cubes, level.id).toHaveLength(level.norm);
      expect([state.player.x, state.player.z, state.player.level], level.id).toEqual([level.layout!.start.x, level.layout!.start.z, 'top']);
      const tops = new Array<number>(level.size * level.size).fill(0);
      for (const cube of state.cubes) tops[cube.z * level.size + cube.x] = cube.ori.top;
      expect(hasReadyGroup(tops, level.size), level.id).toBe(false);
      expect(tops.includes(1), level.id).toBe(false);
    }
  });

  it('keeps for every level a way that clears its board in exactly as many moves as the level says', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      expect(level.solution, level.id).toHaveLength(level.par!);
      const { state } = way(level);
      expect(state.endReason, level.id).toBe('passed');
      expect(state.levelRun!.moves, level.id).toBe(level.par);
    }
  });

  it('makes on its ways only groups of the faces that work', () => {
    for (const level of LEVELS) {
      for (const value of way(level).values) expect(level.faces, level.id).toContain(value);
    }
  });

  it('has no board twice, and in a chapter no board that is another one turned', () => {
    const boards = [...LEVELS, ...SPARES].map((level) => JSON.stringify(level.layout));
    expect(new Set(boards).size).toBe(boards.length);
    // Seen from above: the cells of the dice, the faces on top, the die of the start. Across chapters two
    // levels may look alike so and be different levels: what lies on the sides of a die is what they differ in.
    LEVELS.forEach((level, index) => {
      for (const other of LEVELS.slice(index + 1)) {
        if (other.chapter === level.chapter) expect(sameBoard(level, other), `${level.id} and ${other.id}`).toBe(false);
      }
    });
  });

  it('is not kept for later when the page goes away: a level is started over', () => {
    const level = LEVELS[4];
    const state = createRun({ seed: level.seed, config: defaultConfig(), level });
    const first = moveOf(level.solution![0]);
    state.player = { x: first.x, z: first.z, level: 'top' };
    step(state, first.dir);
    for (let i = 0; i < 20; i++) step(state, null);
    expect(state.tick).toBeGreaterThan(0);
    expect(packRun('endless', '2026-10-04', state, new RunTally())).toBeNull();
  });
});

describe('the levels of the course and of the first chapter', () => {
  it('are played with the floor shut and a net under the player, and the fewest moves of each are proved', () => {
    for (const level of NEW) {
      expect(level.floor, level.id).toBe(false);
      expect(level.guard, level.id).toBe(true);
      expect(level.exact, level.id).toBe(true);
    }
  });

  it('are cleared by a way that leans on nothing that has not been taught: no chain, no floor, no roll over a leaving die', () => {
    for (const level of NEW) expect(way(level).uses, level.id).toEqual([]);
  });

  it('do what their places are there for', () => {
    for (const level of NEW) {
      const recipe = recipeOf(level);
      const report = way(level);
      const moves = level.solution!.map(moveOf);
      if (recipe.safe) expect([level.faces, level.norm], level.id).toEqual([[level.norm], level.faces![0]]);
      if (recipe.ownOnly) expect(report.inPlace.every(Boolean), level.id).toBe(true);
      if (recipe.walk) expect(report.ownFirst, level.id).toBe(false);
      if (recipe.combos !== undefined) expect(report.cleared.filter(Boolean), level.id).toHaveLength(recipe.combos);
      if (recipe.movers !== undefined) expect(new Set(report.dice).size, level.id).toBeGreaterThanOrEqual(recipe.movers);
      if (recipe.ride) expect(rides(level, moves), level.id).toBe(true);
      if (recipe.seven) expect(startsUnder(level, moves), level.id).toBe(true);
      if (recipe.under === false) expect(underOf(level), level.id).toBe(0);
      if (recipe.compact) expect(clusters(level), level.id).toBe(1);
      expect(report.depth, level.id).toBeLessThanOrEqual(recipe.depth![1]);
    }
  });

  it('cannot be lost on the six first levels: the dice are as many as the one combo takes', () => {
    for (const level of NEW.slice(0, 6)) {
      expect(level.faces, level.id).toHaveLength(1);
      expect(level.norm, level.id).toBe(level.faces![0]);
    }
  });

  it('keep the rule of seven out of the course: no die of it starts with a working face at the bottom', () => {
    for (const level of NEW.filter((other) => other.chapter === 0)) expect(underOf(level), level.id).toBe(0);
  });

  it('are unlike their neighbours in the faces that work or in the board', () => {
    NEW.slice(1).forEach((level, index) => {
      const before = NEW[index];
      expect(String(level.faces) !== String(before.faces) || level.size !== before.size, `${before.id} and ${level.id}`).toBe(true);
    });
  });
});

describe('the lines of the levels', () => {
  it('are said where the place says a rule, and shown with its first move', () => {
    for (const level of NEW) {
      const recipe = recipeOf(level);
      expect(level.lesson, level.id).toBe(recipe.lesson);
      expect(level.guide ?? false, level.id).toBe(recipe.lesson !== undefined);
      expect(level.until, level.id).toBe(recipe.until);
    }
  });

  it('stand, until the chapters that teach them are there, on three levels of the ladder as it was: the first that need them', () => {
    expect(OLD.filter((level) => level.lesson).map((level) => [level.id, level.lesson]).sort()).toEqual([
      ['B05', 'lineLink'],
      ['B11', 'lineFaces'],
      ['B13', 'lineFloor'],
    ]);
    // The chain is said on the first level of the chapter of 3s, two faces on the first level that has them.
    expect(OLD[0].id).toBe('B05');
    expect(OLD.find((level) => level.faces!.length > 1)!.id).toBe('B11');
  });

  it('have words in the game', () => {
    for (const level of LEVELS) {
      if (level.lesson) expect(t(level.lesson as TextKey).length, level.id).toBeGreaterThan(0);
    }
  });

  it('show the first roll on the first level and on no other, and that roll is the first move of its way', () => {
    expect(LEVELS.filter((level) => level.arrow).map((level) => level.id)).toEqual(['T01']);
    const first = LEVELS[0];
    const move = moveOf(first.solution![0]);
    expect(first.arrow).toBe(move.dir);
    expect([move.x, move.z]).toEqual([first.layout!.start.x, first.layout!.start.z]);
  });
});

describe('the levels of the ladder as it was', () => {
  it('teach with the ways they keep what their places were there to teach', () => {
    for (const level of OLD) {
      const recipe = recipeOf(level);
      const report = way(level);
      for (const technique of [...(recipe.needs ?? []), ...(recipe.shows ?? [])]) expect(report.uses, level.id).toContain(technique);
      for (const technique of recipe.avoid ?? []) expect(report.uses, level.id).not.toContain(technique);
      if (recipe.compact) expect(clusters(level), level.id).toBe(1);
    }
  });

  it('stand in their chapters with the ones most often cleared first', () => {
    for (const { chapter, from, to } of chaptersOf(LEVELS).filter((other) => other.chapter >= 5)) {
      expect(to - from, `chapter ${chapter}`).toBeGreaterThanOrEqual(3);
    }
  });
});
