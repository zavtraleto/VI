import { describe, expect, it } from 'vitest';
import { fitBoard, type Frame, type FrameBounds } from './framing';

// Roughly the board at the default camera: wider than tall, with headroom above the floor.
const BOARD: FrameBounds = { minR: -4.8, maxR: 4.8, minU: -5, maxU: 4.5, floorU: 3 };
const SIDE = 0.08;
const MARGIN = 0.25;

/** Where a height lands on screen: 0 is the top edge, 1 the bottom. */
function screenY(frame: Frame, u: number): number {
  return (frame.centreU + frame.halfHeight - u) / (frame.halfHeight * 2);
}

describe('fitBoard', () => {
  it('centres the board when nothing has to stay clear', () => {
    const tall = fitBoard(BOARD, 0.5, 0, SIDE, MARGIN);
    expect(tall.centreU).toBeCloseTo(-0.25);
    expect(tall.halfHeight).toBeCloseTo((4.8 + SIDE) / 0.5);
    const wide = fitBoard(BOARD, 1.8, 0, SIDE, MARGIN);
    expect(wide.halfHeight).toBeCloseTo(4.75 + MARGIN);
  });

  it('keeps the floor out of the clear part on any screen', () => {
    for (const aspect of [0.4, 0.5, 0.62, 0.8, 1, 1.4, 1.8, 2.3]) {
      for (const clear of [0.05, 0.12, 0.2, 0.3, 0.45]) {
        const frame = fitBoard(BOARD, aspect, clear, SIDE, MARGIN);
        expect(screenY(frame, BOARD.floorU)).toBeGreaterThanOrEqual(clear - 1e-9);
        // The slab is still whole at the bottom, and the cells still fit across.
        expect(screenY(frame, BOARD.minU - MARGIN)).toBeLessThanOrEqual(1 + 1e-9);
        expect(frame.halfHeight * aspect).toBeGreaterThanOrEqual(4.8 + SIDE - 1e-9);
      }
    }
  });

  it('moves the board down on a tall screen instead of shrinking it', () => {
    const free = fitBoard(BOARD, 0.5, 0, SIDE, MARGIN);
    const under = fitBoard(BOARD, 0.5, 0.45, SIDE, MARGIN);
    expect(under.halfHeight).toBeCloseTo(free.halfHeight);
    expect(under.centreU).toBeGreaterThan(free.centreU);
  });

  it('shrinks the board only when the screen has no height to spare', () => {
    const free = fitBoard(BOARD, 1.8, 0, SIDE, MARGIN);
    const under = fitBoard(BOARD, 1.8, 0.3, SIDE, MARGIN);
    expect(under.halfHeight).toBeGreaterThan(free.halfHeight);
    // A sliver of text costs nothing: the headroom above the floor already covers it.
    expect(fitBoard(BOARD, 1.8, 0.1, SIDE, MARGIN).halfHeight).toBeCloseTo(free.halfHeight);
  });
});
