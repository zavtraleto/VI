import { describe, expect, it } from 'vitest';
import { FRAME_MARGIN, SIDE_MARGIN, boardBounds, frameOf, shapeKey, sightOf, toFloor, toPlane, type BoardShape, type CameraAxes } from './board';
import { cellPixels, fitBoard } from './framing';

/** The axes of a camera that is turned by `yaw` and looks down by `pitch`, in degrees: what the view reads off its camera. */
function axes(yaw: number, pitch: number): CameraAxes {
  const [y, p] = [(yaw * Math.PI) / 180, (pitch * Math.PI) / 180];
  return {
    right: { x: Math.cos(y), y: 0, z: -Math.sin(y) },
    up: { x: -Math.sin(y) * Math.sin(p), y: Math.cos(p), z: -Math.cos(y) * Math.sin(p) },
  };
}

const STRAIGHT = axes(0, 55);
const DIAMOND = axes(45, 35);
const board = (size: number, x = 0, z = 0): BoardShape => ({ size, holes: [], origin: { x, z } });

describe('toPlane and toFloor', () => {
  it('are each the other turned round, at any camera', () => {
    for (const a of [STRAIGHT, DIAMOND, axes(20, 85), axes(0, 20)]) {
      for (const [x, z] of [[0, 0], [3, 3], [-7.5, 12], [40, -2]]) {
        const { r, u } = toPlane(a, x, z);
        const back = toFloor(a, r, u);
        expect(back.x).toBeCloseTo(x);
        expect(back.z).toBeCloseTo(z);
      }
    }
  });

  it('put the east to the right and the north up for a camera that looks straight', () => {
    expect(toPlane(STRAIGHT, 1, 0).r).toBeCloseTo(1);
    expect(toPlane(STRAIGHT, 1, 0).u).toBeCloseTo(0);
    expect(toPlane(STRAIGHT, 0, -1).r).toBeCloseTo(0);
    expect(toPlane(STRAIGHT, 0, -1).u).toBeGreaterThan(0);
  });
});

describe('boardBounds', () => {
  it('has the cells from side to side and the margin with a die and the figure from bottom to top', () => {
    const b = boardBounds(6, STRAIGHT);
    expect(b.minR).toBeCloseTo(-3);
    expect(b.maxR).toBeCloseTo(3);
    const sin = Math.sin((55 * Math.PI) / 180);
    const cos = Math.cos((55 * Math.PI) / 180);
    expect(b.minU).toBeCloseTo(-3.25 * sin);
    expect(b.floorU).toBeCloseTo(3.25 * sin);
    expect(b.maxU).toBeCloseTo(3.25 * sin + 1.9 * cos);
  });

  it('is the same wherever the board lies: it is counted from the middle of the board', () => {
    expect(boardBounds(5, DIAMOND)).toEqual(boardBounds(5, DIAMOND));
    expect(boardBounds(3, DIAMOND).maxR).toBeLessThan(boardBounds(6, DIAMOND).maxR);
  });
});

describe('frameOf', () => {
  const [width, height] = [360, 640];

  it('is the frame the whole board is fitted into', () => {
    for (const a of [STRAIGHT, DIAMOND]) {
      for (const clear of [0, 120]) {
        const fit = fitBoard(boardBounds(6, a), width / height, clear / height, SIDE_MARGIN, FRAME_MARGIN);
        const frame = frameOf(board(6), a, width, height, clear);
        expect(frame.cell).toBeCloseTo(cellPixels(fit, height));
        // The middle of the picture is where the fitted view looks, counted from the middle of the board.
        const middle = toPlane(a, 2.5, 2.5);
        const sight = sightOf(frame, a, height);
        expect(sight.r - middle.r).toBeCloseTo(fit.centreR);
        expect(sight.u - middle.u).toBeCloseTo(fit.centreU);
        expect(sight.half).toBeCloseTo(fit.halfHeight);
      }
    }
  });

  it('gives a small board a larger cell than a large one on the same window', () => {
    const small = frameOf(board(3), STRAIGHT, width, height, 0);
    const large = frameOf(board(6), STRAIGHT, width, height, 0);
    expect(small.cell).toBeGreaterThan(large.cell);
    expect(large.cell).toBeCloseTo(width / (6 + 2 * SIDE_MARGIN));
  });

  it('gives a board the same cell wherever it lies, and moves the frame with the board', () => {
    const home = frameOf(board(4), DIAMOND, width, height, 0);
    for (const [x, z] of [[1, 0], [-3, -8], [12, 40.5]]) {
      const moved = frameOf(board(4, x, z), DIAMOND, width, height, 0);
      expect(moved.cell).toBeCloseTo(home.cell, 9);
      expect(moved.x - home.x).toBeCloseTo(x);
      expect(moved.z - home.z).toBeCloseTo(z);
    }
  });
});

describe('sightOf', () => {
  it('shows as much of the world from top to bottom as the window has cells of that size', () => {
    const sight = sightOf({ x: 2, z: -5, cell: 40 }, STRAIGHT, 640);
    expect(sight.half).toBeCloseTo(8);
    expect(sight.r).toBeCloseTo(toPlane(STRAIGHT, 2, -5).r);
    expect(sight.u).toBeCloseTo(toPlane(STRAIGHT, 2, -5).u);
  });
});

describe('shapeKey', () => {
  it('tells boards apart by their size and the cells cut out, not by where they lie', () => {
    const cut: BoardShape = { size: 5, holes: [{ x: 0, z: 0 }, { x: 4, z: 2 }], origin: { x: 0, z: 0 } };
    expect(shapeKey(cut)).toBe(shapeKey({ ...cut, origin: { x: 7, z: -2 } }));
    expect(shapeKey(cut)).not.toBe(shapeKey(board(5)));
    expect(shapeKey(cut)).not.toBe(shapeKey({ ...cut, holes: [{ x: 0, z: 0 }] }));
    expect(shapeKey(board(5))).not.toBe(shapeKey(board(6)));
  });
});
