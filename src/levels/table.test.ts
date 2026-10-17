import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { MEASURE_HEAD } from './select';
import { fileBoard } from './boardFiles';
import { FIXTURE } from './rowFixture';
import { PLACE_HEAD, ROAD_HEAD, grammarText, measureBoard, placeRow, roadRow, roadTable, slowFactsOf, tableOf } from './table';

/**
 * A level as the list keeps one, written for this test: two pairs where 2s work. The die of the
 * start makes the first in the corner; the die beside the corner die makes the second, and is come
 * to over the first while it is leaving.
 */
const TWO_PAIRS: LevelSpec = {
  id: 'X02', chapter: 0, seed: 20001, size: 4, values: [2], norm: 4, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces: [2], sinkMoves: 2, liftMoves: 1, par: 2, exact: true,
  solution: ['1,0,E', '3,1,S'],
  layout: { start: { x: 1, z: 0 }, dice: [{ x: 1, z: 0, top: 6, north: 3 }, { x: 3, z: 0, top: 2, north: 1 }, { x: 3, z: 1, top: 6, north: 2 }, { x: 3, z: 3, top: 2, north: 1 }] },
};
/** One die where pairs go: a board with no way to clear it. */
const ALONE: LevelSpec = { ...TWO_PAIRS, id: 'X00', norm: 1, par: undefined, exact: undefined, solution: undefined, layout: { start: { x: 1, z: 0 }, dice: [TWO_PAIRS.layout!.dice[0]] } };

const cell = (row: readonly string[], column: string): string => row[MEASURE_HEAD.indexOf(column)];

describe('a level measured again from what it keeps', () => {
  it('is a row of the table: the way it keeps played on the rules, with the route of the way and the kind of it', () => {
    const row = measureBoard('2', TWO_PAIRS, 1);
    expect(row).toHaveLength(MEASURE_HEAD.length);
    expect(['place', 'board', 'dice', 'seed', 'moves', 'exact', 'depth', 'tail'].map((column) => cell(row, column))).toEqual(['2', '4x4', '4', '20001', '2', 'yes', '1', '1']);
    expect([cell(row, 'route'), cell(row, 'kind')]).toEqual(['K ~ K', 'bridge']);
    // One first move keeps the board in hand, the roll that makes the pair: after the other roll of that die two moves do not clear it.
    expect(cell(row, 'firsts')).toBe('1');
    // The players made of the rules are asked, every one of them.
    for (const persona of ['hasty', 'casual', 'careful', 'planner']) expect(cell(row, persona), persona).toMatch(/^\d+%$/);
  });

  it('has no route for a board no way clears', () => {
    const row = measureBoard('0', ALONE, 1);
    expect(row).toHaveLength(MEASURE_HEAD.length);
    expect([cell(row, 'moves'), cell(row, 'exact'), cell(row, 'route'), cell(row, 'kind'), cell(row, 'firsts')]).toEqual(['0', 'no', '-', 'other', '-']);
  });
});

describe('the table of the levels', () => {
  it('lays its rows out under the head, a column to each thing measured', () => {
    const row = measureBoard('2', TWO_PAIRS, 1);
    const lines = tableOf([row, measureBoard('2 spare', TWO_PAIRS, 1)]).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0].split(/ {2,}/)).toEqual([...MEASURE_HEAD]);
    // The cells of a column begin under its name.
    for (const column of ['board', 'route', 'kind']) {
      const under = lines[1].slice(lines[0].indexOf(` ${column} `) + 1);
      expect(under.startsWith(cell(row, column)), column).toBe(true);
    }
  });
});

describe('the table of the road', () => {
  it('is a row for a piece: what it is, its board, its fewest moves, its first moves, the walk and two personas', () => {
    const lesson = fileBoard('R01');
    expect(roadRow(1, lesson, 'lesson', 300, 4)).toEqual(['1', 'R01', 'lesson', '1x6', '2', '2', '4', '0', '0', '1', '4', '0', '5', '100%', '100%']);
    expect(roadRow(1, lesson, 'lesson', 300, 4)).toHaveLength(ROAD_HEAD.length);
  });

  it('says the number of the board in its row, and the dice to turn and the rolls away of the way it keeps', () => {
    const second = fileBoard('R02');
    const row = roadRow(17, second, 'list', 12, 1);
    expect(row[ROAD_HEAD.indexOf('n')]).toBe('17');
    expect(row[ROAD_HEAD.indexOf('board')]).toBe('R02');
    expect(row[ROAD_HEAD.indexOf('turns')]).toBe('1');
    expect(row[ROAD_HEAD.indexOf('away')]).toBe('0');
  });

  it('marks what the walk counted with a plus where it was cut: the numbers are of the boards nearest the start', () => {
    const free = fileBoard('R03');
    const row = roadRow(3, free, 'free', 12, 2);
    expect(row.slice(0, 7)).toEqual(['3', 'R03', 'free', '3x3', '2', '2', '2']);
    expect(row[ROAD_HEAD.indexOf('boards')]).toBe('12+');
    expect(row[ROAD_HEAD.indexOf('lost')]).toBe('0+');
    expect(row[ROAD_HEAD.indexOf('worst')]).toMatch(/^\d+\+$/);
    expect(roadTable([row]).split('\n')).toHaveLength(2);
  });
});

describe('the passport of a place', () => {
  it('is the row of the table of the road, with the chapter and the role, and the boards near the start after it', () => {
    const place = FIXTURE.places[3];
    const row = placeRow(place, 50, 2);
    expect(row).toHaveLength(PLACE_HEAD.length);
    expect(row.slice(0, ROAD_HEAD.length)).toEqual(roadRow(4, place.spec, '1:meet', 50, 2));
    // Nine boards within two moves of the start, none a dead end or lost, five moves from the farthest.
    expect(row[PLACE_HEAD.indexOf('near')]).toBe('9 0 0 5');
    // A board of nine cells is walked whole: every board it can come to, none lost, twelve moves from the farthest.
    expect(row[PLACE_HEAD.indexOf('whole')]).toBe('8592 0 12');
  });

  it('walks no board whole that has more than nine cells', () => {
    const big = { ...FIXTURE.places[0], spec: { ...FIXTURE.places[0].spec, size: 4 } };
    expect(placeRow(big, 50, 2)[PLACE_HEAD.indexOf('whole')]).toBe('-');
  });
});

describe('slowFactsOf', () => {
  it('counts the share of the casual persona beside that of the planner, for rule 8', () => {
    const facts = slowFactsOf(TWO_PAIRS, undefined, 50, 2);
    expect(facts.casual).toBeGreaterThanOrEqual(0);
    expect(facts.casual! * 2).toBe(Math.round(facts.casual! * 2));
  });

  it('counts a link as the second event of a trap of order: R05 is a combo and a link (third campaign, section 14)', () => {
    expect(slowFactsOf(fileBoard('R05'), 'order', 50, 1).order).toBe(true);
  });
});

describe('grammarText', () => {
  it('says the rules broken in the order of the row, and marks those that do not hold it back yet as warnings', () => {
    expect(grammarText([{ rule: 4, at: 2, text: 'x' }, { rule: 1, at: 1, text: 'y' }])).toBe('grammar:\n  1  y\n  4  x (предупреждение)');
    expect(grammarText([])).toBe('grammar: clean');
  });
});
