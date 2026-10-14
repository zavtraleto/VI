import { describe, expect, it } from 'vitest';
import { packRun } from '../app/savedRun';
import { RunTally } from '../app/telemetry';
import { NO_CELL, cellIndex, isCell } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { scoreOf } from '../rules/levelScore';
import { moveOf, moveText, movesAt, playMove, solveLevel, tryWay } from '../rules/levelSolver';
import { createRun, step } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import type { LevelSpec } from '../rules/types';
import { CAMPAIGN_PLACES } from './campaignRecipes';
import { levelId } from './generate';
import { ACT_1, ACT_2, LEVELS, PARKED, SPARES } from './levels';
import { decoyOf, islandsOf, safeFirstOf, silenceOf, tailOf, turnsOf, underOf } from './measures';
import { chaptersOf, ladderProgress } from './progress';
import { LADDER_LIFT_MOVES, LADDER_SINK_MOVES, PLACES, type Recipe } from './recipes';
import { lessonsAt } from './rules';
import { UNLIKE_BY, sameBoard, traitsOf, unlike } from './variety';

/**
 * The list of the levels, whatever boards it holds: levels of the probe in the order the owner
 * gave them on 12 October 2026, the rest of the probe parked beside it, and every board is what
 * its place asks for as far as that is cheap to ask. What takes a search of its own for every board - the parts of a route with no way
 * round, the trap of order, the count of the faces - is proved when a board is picked
 * (`select.ts`), and not here.
 */

/** The place a board is for, by the name of its level: a place of the probe, or a place of an act of the campaign. */
const placeOf = (spec: LevelSpec): Recipe | undefined => [...PLACES, ...CAMPAIGN_PLACES].find((place) => levelId(place) === spec.id);
const wayOf = (spec: LevelSpec) => (spec.solution ?? []).map(moveOf);
/** The tail of the row of the probe list, parked on 14 October 2026, in the order it had. */
const TAIL_ORDER = ['P13', 'P04', 'P02', 'P14', 'P07', 'P01', 'P12', 'P08', 'P17', 'P15', 'P31', 'P19'];
/** The levels that wait: for a lesson of the 1s, and for the look of the cells cut out. */
const WAITING = ['P10', 'P18', 'P21', 'P22', 'P23', 'P24', 'P25', 'P26', 'P27', 'P28', 'P29', 'P30'];
const ALL: readonly LevelSpec[] = [...LEVELS, ...PARKED, ...SPARES];
/** The level that is a board of the road and not of its place: P08 is R10 of the second edition of the road (levels.ts). */
const FROM_ROAD = PARKED.find((level) => level.id === 'P08')!;
/** The levels and the boards in reserve that are boards of their places. */
const OF_PLACE: readonly LevelSpec[] = ALL.filter((level) => level !== FROM_ROAD);

/** The cells cut out of the board of a level, written out and in order. */
const cutOf = (spec: LevelSpec): string[] => (spec.holes ?? []).map((cell) => `${cell.x},${cell.z}`).sort();
/** The levels and the boards in reserve whose boards are not squares. */
const CUT: readonly LevelSpec[] = ALL.filter((level) => (level.holes?.length ?? 0) > 0);

const within = (value: number, [from, to]: readonly [number, number]): boolean => value >= from - 1e-9 && value <= to + 1e-9;
const range = ([from, to]: readonly [number, number]): string => (from === to ? String(from) : `${from}-${to}`);

/**
 * What of its place a level does not meet, of the things that are read off its board and off the
 * score of the way it keeps: nothing, for a level that is what its place asks for.
 */
function offPlace(level: LevelSpec, place: Recipe): string[] {
  const off: string[] = [];
  const ask = (met: boolean, what: string): void => {
    if (!met) off.push(what);
  };
  // The board as it lies.
  const dice = level.layout!.dice;
  // A cell that is cut out of the board is not a free one.
  const free = level.size * level.size - (level.holes?.length ?? 0) - dice.length;
  if (place.room) ask(within(free, place.room), `${free} free cells, not ${range(place.room)}`);
  if (place.blind) ask(!dice.some((die) => level.faces?.includes(die.top)), 'a die starts showing a face that works');
  if (place.underShare !== undefined) ask(underOf(level) >= place.underShare * dice.length - 1e-9, `${underOf(level)} dice with a working face at the bottom`);
  if (place.islands !== undefined) ask(islandsOf(level) >= place.islands, `${islandsOf(level)} clusters, fewer than ${place.islands}`);
  // The way the level keeps, and its score.
  const way = wayOf(level);
  const report = tryWay(level, way);
  const score = scoreOf(level, way);
  if (place.kinds) ask(place.kinds.includes(score.kind), `a route that is ${score.kind}`);
  if (place.route) ask(new RegExp(place.route).test(score.route), `the route "${score.route}" does not read as ${place.route}`);
  if (place.quiet) ask(within(score.quiet, place.quiet), `${score.quiet} quiet moves, not ${range(place.quiet)}`);
  if (place.counted) ask(within(score.counted, place.counted), `${score.counted} moves under the count, not ${range(place.counted)}`);
  if (place.last) ask(within(score.last, place.last), `the last event of ${score.last} dice, not ${range(place.last)}`);
  if (place.links) ask(within(score.chain, place.links), `${score.chain} links, not ${range(place.links)}`);
  const tail = tailOf(report.cleared);
  if (place.tail) ask(within(tail, place.tail), `a tail of ${tail}, not ${range(place.tail)}`);
  const silence = silenceOf(report.cleared);
  if (place.silence !== undefined) ask(silence <= place.silence, `a silence of ${silence}, longer than ${place.silence}`);
  const { ends } = place;
  const last = score.beats[score.beats.length - 1];
  if (ends) {
    ask(last?.event === ends.event, `the way ends with ${last?.event}, not ${ends.event}`);
    if (ends.how) ask((last?.how === 'push' ? 'push' : 'roll') === ends.how, `the way does not end with a ${ends.how}`);
    if (ends.spare !== undefined) ask(last?.spare === ends.spare, `the last link comes with ${last?.spare} to spare, not ${ends.spare}`);
  }
  // What the way leans on.
  for (const technique of place.avoid ?? []) ask(!report.uses.includes(technique), `the way leans on ${technique}`);
  for (const technique of [...(place.needs ?? []), ...(place.shows ?? [])]) ask(report.uses.includes(technique), `the way does without ${technique}`);
  if (place.movers !== undefined) ask(new Set(report.dice).size >= place.movers, `fewer dice moved than ${place.movers}`);
  if (place.decoy) ask(decoyOf(level, way), 'no combo nearly made that goes as another face');
  return off;
}

describe('the levels of the game', () => {
  it('are the acts, and nothing after them', () => {
    expect(LEVELS).toEqual([...ACT_1, ...ACT_2]);
    expect(LEVELS).toHaveLength(12);
  });

  it('are each a level of a place', () => {
    for (const level of [...LEVELS, ...PARKED]) expect(placeOf(level), level.id).toBeDefined();
  });

  it('keep parked the levels that wait, and have P11 nowhere', () => {
    expect(PARKED.map((level) => level.id)).toEqual([...WAITING, ...TAIL_ORDER]);
    expect(ALL.filter((level) => level.id === 'P11')).toEqual([]);
  });

  it('keep in reserve boards of those places, three to a place at the most', () => {
    for (const spare of SPARES) expect(placeOf(spare), `spare ${spare.id}`).toBeDefined();
    for (const place of PLACES) expect(SPARES.filter((spare) => spare.id === levelId(place)).length, place.id).toBeLessThanOrEqual(3);
  });

  it('are one chapter, open from the first level to the last', () => {
    expect(chaptersOf(LEVELS)).toEqual([{ chapter: 0, from: 0, to: LEVELS.length }]);
    for (const level of ALL) expect(level.chapter, level.id).toBe(0);
    const fresh = ladderProgress(LEVELS, () => null);
    expect(fresh.chapters.map((chapter) => [chapter.gate, chapter.open])).toEqual([[0, true]]);
    expect(fresh.locked).toEqual(LEVELS.map(() => false));
  });

  it('are boards to clear, given die by die: nothing comes, and the level as it is kept has no limit of moves', () => {
    for (const level of ALL) {
      expect(level.goal, level.id).toEqual({ kind: 'clear' });
      expect(level.arrival, level.id).toBe('none');
      expect(level.moves, level.id).toBe(0);
      expect(level.norm, level.id).toBe(level.layout!.dice.length);
    }
  });

  it('teach nothing and are played by the rules as they stand: no line, no window, no net, the floor open and strict', () => {
    for (const level of ALL) {
      for (const key of ['lesson', 'guide', 'story', 'until', 'guard', 'climb'] as const) expect(level[key], `${level.id} ${key}`).toBeUndefined();
      expect(level.floor, level.id).not.toBe(false);
      const state = createRun({ seed: level.seed, config: defaultConfig(), level });
      // A die that cannot be pushed is not climbed from the floor: the one way up is a die that is leaving.
      expect(state.config.experiments.floorClimb, level.id).toBe(false);
    }
    LEVELS.forEach((level, index) => expect(lessonsAt(LEVELS, index), level.id).toEqual([]));
  });

  it('let only the faces of their places work, the 1s with them where the place sweeps the 1s, and send a die that has joined a combo off in two moves', () => {
    for (const level of OF_PLACE) {
      const place = placeOf(level);
      expect(place, level.id).toBeDefined();
      if (!place) continue;
      const faces = [...place.faces, ...(place.ones ? [1] : [])].sort((a, b) => a - b);
      expect(level.faces, level.id).toEqual(faces);
      expect(level.values, level.id).toEqual(faces);
      expect(level.sinkMoves, level.id).toBe(LADDER_SINK_MOVES);
      expect(level.liftMoves, level.id).toBe(LADDER_LIFT_MOVES);
      const state = createRun({ seed: level.seed, config: defaultConfig(), level });
      expect(state.config.sinkingTicks, level.id).toBe(2 * state.config.actionTicks + 1);
    }
  });

  it('have the boards, the numbers of dice and the fewest moves of their places', () => {
    for (const level of OF_PLACE) {
      const place = placeOf(level);
      expect(place, level.id).toBeDefined();
      if (!place) continue;
      // The size is that of the square a board is cut from: three cells a side to five.
      expect(level.size, level.id).toBe(place.size);
      expect([3, 4, 5], level.id).toContain(level.size);
      // And the board is the board of the place: the same cells cut out, or none.
      expect(cutOf(level), level.id).toEqual((place.holes ?? []).map(([x, z]) => `${x},${z}`).sort());
      if (!place.holes) expect(level.holes, level.id).toBeUndefined();
      expect(level.norm, level.id).toBeGreaterThanOrEqual(place.dice);
      expect(level.norm, level.id).toBeLessThanOrEqual(place.dice + (place.more ?? 0));
      expect(within(level.par ?? 0, place.par), `${level.id}: ${level.par} moves, not ${range(place.par)}`).toBe(true);
      // The fewest moves of every board are proved: the solver saw every board nearer.
      expect(level.exact, level.id).toBe(true);
    }
  });

  it('start as they are given, with no combo ready to go, and a 1 on top only where the 1s work', () => {
    for (const level of ALL) {
      const state = createRun({ seed: level.seed, config: defaultConfig(), level });
      expect(state.cubes, level.id).toHaveLength(level.norm);
      expect([state.player.x, state.player.z, state.player.level], level.id).toEqual([level.layout!.start.x, level.layout!.start.z, 'top']);
      const tops = new Array<number>(level.size * level.size).fill(0);
      for (const cube of state.cubes) tops[cube.z * level.size + cube.x] = cube.ori.top;
      expect(hasReadyGroup(tops, level.size), level.id).toBe(false);
      if (!level.faces?.includes(1)) expect(tops.includes(1), level.id).toBe(false);
    }
  });

  it('keep for every board a way that clears it in exactly as many moves as the level says', () => {
    for (const level of ALL) {
      expect(level.solution, level.id).toHaveLength(level.par!);
      const { state } = tryWay(level, wayOf(level));
      expect(state.endReason, level.id).toBe('passed');
      expect(state.levelRun!.moves, level.id).toBe(level.par);
    }
  });

  it('have, where cells are cut out, every die and the start on a cell that is there, and a board in one part', () => {
    expect(CUT.length).toBeGreaterThanOrEqual(10);
    for (const level of CUT) {
      const cut = new Set(cutOf(level));
      // No cell is cut out twice, and none off the square.
      expect(cut.size, level.id).toBe(level.holes!.length);
      for (const { x, z } of level.holes!) expect(x >= 0 && z >= 0 && x < level.size && z < level.size, `${level.id}: ${x},${z}`).toBe(true);
      for (const die of level.layout!.dice) expect(cut.has(`${die.x},${die.z}`), `${level.id}: a die at ${die.x},${die.z}`).toBe(false);
      const { start } = level.layout!;
      expect(cut.has(`${start.x},${start.z}`), `${level.id}: the start`).toBe(false);
      // The run is the judge of the rest: it takes no board in two parts, and marks the cells that are not there.
      const state = createRun({ seed: level.seed, config: defaultConfig(), level });
      for (let z = 0; z < level.size; z++) {
        for (let x = 0; x < level.size; x++) expect(isCell(state, x, z), `${level.id}: ${x},${z}`).toBe(!cut.has(`${x},${z}`));
      }
    }
  });

  it('keep ways that never bring a die or the player to a cell that is cut out', () => {
    for (const level of CUT) {
      let state = createRun({ seed: level.seed, config: defaultConfig(), level });
      for (const [index, move] of wayOf(level).entries()) {
        const what = `${level.id}, seed ${level.seed}, move ${index + 1}`;
        // A move of the way is one the rules offer on the board as it stands: nothing is forced through.
        expect(movesAt(state).map(moveText), what).toContain(moveText(move));
        state = playMove(state, move);
        for (const cube of state.cubes) expect(isCell(state, cube.x, cube.z), `${what}: a die at ${cube.x},${cube.z}`).toBe(true);
        expect(isCell(state, state.player.x, state.player.z), `${what}: the player`).toBe(true);
        // The cells stay cut out all the way.
        for (const { x, z } of level.holes!) expect(state.grid[cellIndex(level.size, x, z)], what).toBe(NO_CELL);
      }
      expect(state.endReason, level.id).toBe('passed');
    }
  });

  it('make on their ways only combos of the faces that work', () => {
    for (const level of ALL) {
      const { values } = tryWay(level, wayOf(level));
      expect(values.length, level.id).toBeGreaterThan(0);
      for (const value of values) expect(level.faces, level.id).toContain(value);
    }
  });

  it('are what their places ask for, as far as a board and the score of its way tell', () => {
    for (const level of OF_PLACE) {
      const place = placeOf(level);
      expect(place, level.id).toBeDefined();
      if (!place) continue;
      expect(offPlace(level, place), `${level.id}, seed ${level.seed}`).toEqual([]);
    }
  });

  it('lose no board by the first move where the place asks it: the trap of P17 and of P19 waits further on, and the new boards of the acts have none', () => {
    const asked = [...LEVELS, ...PARKED].filter((level) => placeOf(level)?.safeFirst);
    expect(asked.map((level) => level.id).sort()).toEqual(['K21', 'K22', 'K23', 'K25', 'K28', 'P17', 'P19']);
    for (const level of asked) expect(safeFirstOf(level), level.id).toBe(true);
    // The board P19 had before, kept in reserve, is what the owner played on 12 October: lost by a first move.
    const before = SPARES.filter((spare) => spare.id === 'P19' && spare.seed === 30263);
    expect(before).toHaveLength(1);
    for (const spare of before) expect(safeFirstOf(spare), `${spare.id}, seed ${spare.seed}`).toBe(false);
  });

  it('keep parked the breather of the tail: P31 is of the place of P13 once more, and a board unlike it', () => {
    const breather = PARKED.find((level) => level.id === 'P31')!;
    const collapse = PARKED.find((level) => level.id === 'P13')!;
    expect([breather.id, collapse.id]).toEqual(['P31', 'P13']);
    expect(unlike(traitsOf({ spec: breather }), traitsOf({ spec: collapse }))).toBeGreaterThanOrEqual(UNLIKE_BY);
    // Four of its six 6s are up from the start: two dice are turned, and all six go with one move.
    expect(breather.layout!.dice.filter((die) => die.top === 6)).toHaveLength(4);
    expect(turnsOf(breather, wayOf(breather))).toBe(2);
  });

  it('hold one board of the road: P08 is R10 of the second edition, played by the rules of the list, and its place is not asked of it', () => {
    expect(FROM_ROAD.id).toBe('P08');
    expect(placeOf(FROM_ROAD)).toBeDefined();
    expect(offPlace(FROM_ROAD, placeOf(FROM_ROAD)!)).not.toEqual([]);
    // The faces of the list, its two moves of leaving, the floor open: what any level of the list is played with.
    expect(FROM_ROAD.faces).toEqual([2, 3]);
    expect(FROM_ROAD.floor).toBeUndefined();
    expect(FROM_ROAD.layout!.dice).toHaveLength(6);
    // Its fewest moves are those it had on the road, with the floor open as well, and the way it keeps is of the road.
    expect(solveLevel(FROM_ROAD).solution!.par).toBe(4);
    expect(FROM_ROAD.par).toBe(4);
    expect(tryWay(FROM_ROAD, wayOf(FROM_ROAD)).uses).toEqual(['link']);
    // The boards in reserve of P08 are of its place.
    expect(SPARES.filter((spare) => spare.id === 'P08').every((spare) => offPlace(spare, placeOf(spare)!).length === 0)).toBe(true);
  });

  it('have no board twice, and no level that is another one turned or mirrored', () => {
    const boards = ALL.map((level) => JSON.stringify(level.layout));
    expect(new Set(boards).size).toBe(boards.length);
    // Seen from above: the cells of the dice, the faces on top, the die of the start.
    const played = [...LEVELS, ...PARKED];
    played.forEach((level, index) => {
      for (const other of played.slice(index + 1)) expect(sameBoard(level, other), `${level.id} and ${other.id}`).toBe(false);
    });
  });
});

describe('a level as it is played', () => {
  it('has no limit of moves: it is played as it is kept, and is cleared by its way', () => {
    for (const level of LEVELS) {
      expect(level.moves, level.id).toBe(0);
      const end = wayOf(level).reduce(playMove, createRun({ seed: level.seed, config: defaultConfig(), level }));
      expect(end.endReason, level.id).toBe('passed');
      expect(end.levelRun!.moves, level.id).toBe(level.par);
    }
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
