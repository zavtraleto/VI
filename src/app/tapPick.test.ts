import { describe, expect, it } from 'vitest';
import { boxCorners, hull, pickCell, type CellShape } from './tapPick';

/** A plain view from the side and above: x to the right, the floor's z up the page, height up the page too. */
const project = (x: number, y: number, z: number) => ({ x: 100 + x * 40, y: 300 - z * 20 - y * 10 });
/** Nearer the camera is lower on the page: the cells of small z. */
const shape = (x: number, z: number, top: number): CellShape => ({ x, z, outline: boxCorners(x, z, top, project), depth: z - top * 0.01 });

describe('picking a cell from a point of the page', () => {
  it('finds the floor of an empty cell', () => {
    const shapes = [shape(0, 0, 0), shape(1, 0, 0), shape(0, 1, 0)];
    expect(pickCell(shapes, project(1, 0, 0))).toEqual({ x: 1, z: 0 });
    expect(pickCell(shapes, project(0, 0, 1))).toEqual({ x: 0, z: 1 });
  });

  it('takes the die in front over the floor of the cell behind it', () => {
    // The die at (0, 0) rises over the floor of (0, 1) on the page.
    const shapes = [shape(0, 0, 1), shape(0, 1, 0)];
    expect(pickCell(shapes, project(0, 0.9, 0.4))).toEqual({ x: 0, z: 0 });
    expect(pickCell(shapes, project(0, 0, 1.4))).toEqual({ x: 0, z: 1 });
  });

  it('finds nothing off the board', () => {
    expect(pickCell([shape(0, 0, 0)], { x: 900, y: 900 })).toBeNull();
  });

  it('builds a hull that holds every corner', () => {
    const corners = boxCorners(2, 3, 1, project);
    const outline = hull(corners);
    expect(outline.length).toBe(4);
  });
});
