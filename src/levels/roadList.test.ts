import { describe, expect, it } from 'vitest';
import { goalOf } from '../rules/level';
import { THREE_STARS_OVER, TWO_STARS_OVER } from './progress';
import { FIRST_PASSED, ROAD, ROAD_END } from './road';
import { roadCells, roadDone, roadFocus } from './roadList';

const NEW = { passed: {}, stats: {} };

describe('the list of the pieces of the road', () => {
  it('has a cell for every piece, numbered from one in the order of the road', () => {
    const cells = roadCells(NEW);
    expect(cells).toHaveLength(18);
    expect(cells.map((cell) => cell.number)).toEqual(ROAD.map((_, index) => index + 1));
  });

  it('shows nothing passed and no stars to one who is new', () => {
    for (const cell of roadCells(NEW)) expect([cell.passed, cell.stars]).toEqual([false, 0]);
    expect(roadDone(NEW)).toBe(0);
  });

  it('gives a piece the stars of the fewest moves it was passed in, from its own record', () => {
    const [first, second, third, fourth] = ROAD;
    const cells = roadCells({
      passed: { [first.id]: true, [second.id]: true, [third.id]: true, [fourth.id]: true },
      stats: {
        [first.id]: { bestMoves: first.par! },
        [second.id]: { bestMoves: second.par! + THREE_STARS_OVER + TWO_STARS_OVER },
        [third.id]: { bestMoves: third.par! + THREE_STARS_OVER + TWO_STARS_OVER + 1 },
      },
    });
    expect(cells.slice(0, 5).map((cell) => cell.stars)).toEqual([3, 2, 1, 1, 0]);
    expect(cells.slice(0, 5).map((cell) => cell.passed)).toEqual([true, true, true, true, false]);
  });

  it('counts a piece as passed by its own code only: the levels of the list are not pieces', () => {
    const kept = { passed: { P01: true, F1: true, [ROAD[4].id]: true, [ROAD[17].id]: true }, stats: { P01: { bestMoves: 1 } } };
    expect(roadDone(kept)).toBe(2);
    expect(roadCells(kept).filter((cell) => cell.passed).map((cell) => cell.number)).toEqual([5, 18]);
  });

  it('carries the faces and the goal of every piece, for the line under the cells', () => {
    roadCells(NEW).forEach((cell, index) => {
      expect(cell.goal).toEqual(goalOf(ROAD[index]));
      expect(cell.faces).toEqual(ROAD[index].faces);
    });
  });
});

describe('the cell the list of the pieces opens on', () => {
  it('is the piece the player is on', () => {
    expect(roadFocus(undefined, false)).toBe(0);
    expect(roadFocus('R04', false)).toBe(3);
    expect(roadFocus('R18', false)).toBe(17);
    expect(roadFocus(undefined, true)).toBe(ROAD.findIndex((spec) => spec.id === FIRST_PASSED));
  });

  it('is the first piece for one who is past the road', () => {
    expect(roadFocus(ROAD_END, false)).toBe(0);
    expect(roadFocus(ROAD_END, true)).toBe(0);
  });
});
