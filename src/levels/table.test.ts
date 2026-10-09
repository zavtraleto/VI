import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { MEASURE_HEAD } from './select';
import { ROAD } from './road';
import { ROAD_HEAD, measureBoard, roadRow, roadTable, tableOf } from './table';

/**
 * A level as the list keeps one, written for this test: two pairs where 2s work. The die of the
 * start makes the first in the corner; the die beside the corner die makes the second, and is come
 * to over the first while it is leaving.
 */
const TWO_PAIRS: LevelSpec = {
  id: 'X02', chapter: 0, seed: 20001, size: 4, values: [2], norm: 4, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces: [2], sinkMoves: 2, liftMoves: 1, par: 2, exact: true,
  solution: ['2,0,W', '0,1,S'],
  layout: { start: { x: 2, z: 0 }, dice: [{ x: 2, z: 0, top: 6, north: 3 }, { x: 0, z: 0, top: 2, north: 1 }, { x: 0, z: 1, top: 6, north: 2 }, { x: 0, z: 3, top: 2, north: 1 }] },
};
/** One die where pairs go: a board with no way to clear it. */
const ALONE: LevelSpec = { ...TWO_PAIRS, id: 'X00', norm: 1, par: undefined, exact: undefined, solution: undefined, layout: { start: { x: 2, z: 0 }, dice: [TWO_PAIRS.layout!.dice[0]] } };

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
    const lesson = ROAD.find((spec) => spec.id === 'R15')!;
    expect(roadRow(lesson, 'lesson', 300, 4)).toEqual(['R15', 'lesson', '4x3', '5', '2 3', '2', '1', '4', '0', '11', '100%', '100%']);
    expect(roadRow(lesson, 'lesson', 300, 4)).toHaveLength(ROAD_HEAD.length);
  });

  it('marks what the walk counted with a plus where it was cut: the numbers are of the boards nearest the start', () => {
    const free = ROAD.find((spec) => spec.id === 'R03')!;
    const row = roadRow(free, 'free', 12, 2);
    expect(row.slice(0, 7)).toEqual(['R03', 'free', '3x3', '2', '2', '2', '2']);
    expect(row[ROAD_HEAD.indexOf('boards')]).toBe('12+');
    expect(row[ROAD_HEAD.indexOf('lost')]).toBe('0+');
    expect(row[ROAD_HEAD.indexOf('worst')]).toMatch(/^\d+\+$/);
    expect(roadTable([row]).split('\n')).toHaveLength(2);
  });
});
