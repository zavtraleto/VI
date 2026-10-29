import { describe, expect, it } from 'vitest';
import { emptyRun, place, put } from '../rules/testkit';
import { boardShapes, boxCorners, hull, pickCell, type CellShape } from './tapPick';

/** A plain view from the side and above: x to the right, the floor's z up the page, height up the page too. */
const project = (x: number, y: number, z: number) => ({ x: 100 + x * 40, y: 300 - z * 20 - y * 10 });
/** Nearer the camera is lower on the page: the cells of small z. */
const shape = (x: number, z: number, top: number): CellShape => ({ x, z, outline: boxCorners(x, z, top, project), centre: project(x, top, z), depth: z - top * 0.01 });

describe('picking a cell from a point of the page', () => {
  it('finds the floor of an empty cell', () => {
    const shapes = [shape(0, 0, 0), shape(1, 0, 0), shape(0, 1, 0)];
    expect(pickCell(shapes, project(1, 0, 0))).toEqual({ x: 1, z: 0 });
    expect(pickCell(shapes, project(0, 0, 1))).toEqual({ x: 0, z: 1 });
  });

  it('shares the place where a die stands over the cell behind it: what has its middle nearer is picked', () => {
    // The die at (0, 0) rises over the floor of (0, 1) on the page: its top face is at y 290, that floor at 280.
    const shapes = [shape(0, 0, 1), shape(0, 1, 0)];
    expect(pickCell(shapes, { x: 100, y: 298 })).toEqual({ x: 0, z: 0 });
    expect(pickCell(shapes, { x: 100, y: 287 })).toEqual({ x: 0, z: 0 });
    // Near the middle of the cell behind, hidden as it is, the cell.
    expect(pickCell(shapes, { x: 100, y: 282 })).toEqual({ x: 0, z: 1 });
  });

  it('takes the cell a tap would go to first, of all that are under the point', () => {
    const shapes = [shape(0, 0, 1), shape(0, 1, 0)];
    expect(pickCell(shapes, { x: 100, y: 287 }, (_x, z) => z === 1)).toEqual({ x: 0, z: 1 });
    // Where none of them would do, the nearest is taken all the same.
    expect(pickCell(shapes, { x: 100, y: 287 }, () => false)).toEqual({ x: 0, z: 0 });
  });

  it('finds nothing off the board', () => {
    expect(pickCell([shape(0, 0, 0)], { x: 900, y: 900 })).toBeNull();
  });

  it('builds a hull that holds every corner', () => {
    const corners = boxCorners(2, 3, 1, project);
    const outline = hull(corners);
    expect(outline.length).toBe(4);
  });

  it('sees through the die the player stands on to the cell behind it', () => {
    const s = emptyRun();
    put(s, 0, 0, 6);
    place(s, 0, 0, 'top');
    const depth = (_x: number, y: number, z: number) => z - y * 0.01;
    // Where the player's die stands over the floor of the cell behind it, that cell is picked.
    expect(pickCell(boardShapes(s, project, depth), { x: 100, y: 287 })).toEqual({ x: 0, z: 1 });
    // Another die there is the die.
    place(s, 1, 1, 'ground');
    expect(pickCell(boardShapes(s, project, depth), { x: 100, y: 287 })).toEqual({ x: 0, z: 0 });
  });
});
