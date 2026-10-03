import { describe, expect, it } from 'vitest';
import { lensInverse } from '../display/lens';
import { cellPixels, fitBoard, follow, followAxis, followFocus, followFrame, viewMode, type Frame, type FrameBounds } from './framing';

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

describe('viewMode', () => {
  const plain = { forced: 'auto', whole: false, reducedMotion: false } as const;

  it('follows the player where a cell of the whole board would be small', () => {
    // A phone held upright: the board is as wide as the screen.
    const phone = cellPixels(fitBoard(BOARD, 375 / 600, 0, SIDE, MARGIN), 600);
    expect(phone).toBeCloseTo(375 / (9.6 + 2 * SIDE));
    expect(viewMode(phone, 56, plain)).toBe('follow');
    // A wide screen: the board is as tall as the screen.
    const desk = cellPixels(fitBoard(BOARD, 1.6, 0, SIDE, MARGIN), 800);
    expect(viewMode(desk, 56, plain)).toBe('full');
    expect(viewMode(56, 56, plain)).toBe('full');
    expect(viewMode(55.9, 56, plain)).toBe('follow');
  });

  it('keeps the whole board for a player who asks for it, and with motion kept low', () => {
    expect(viewMode(30, 56, { ...plain, whole: true })).toBe('full');
    expect(viewMode(30, 56, { ...plain, reducedMotion: true })).toBe('full');
  });

  it('takes a view named in the address as it is', () => {
    expect(viewMode(90, 56, { ...plain, forced: 'follow' })).toBe('follow');
    expect(viewMode(90, 56, { forced: 'follow', whole: true, reducedMotion: true })).toBe('follow');
    expect(viewMode(30, 56, { ...plain, forced: 'full' })).toBe('full');
  });
});

describe('followFocus', () => {
  it('enlarges the board only as far as a cell under the player needs', () => {
    // A cell of 38.4 with the whole board in view, 64 asked for: six tenths of the board fit.
    expect(followFocus(38.4, 64, 0.5)).toBeCloseTo(0.6);
    // A smaller board on the same screen is enlarged less, and its lens is weaker.
    expect(followFocus(54, 64, 0.5)).toBeCloseTo(54 / 64);
    // A cell that is large enough is left as it is.
    expect(followFocus(64, 64, 0.5)).toBe(1);
    expect(followFocus(90, 64, 0.5)).toBe(1);
  });

  it('never shows less of the board than the share asked for', () => {
    expect(followFocus(20, 64, 0.6)).toBeCloseTo(0.6);
    expect(followFocus(38.4, 64, 0.8)).toBeCloseTo(0.8);
    // No size of a cell asked for: the share alone sets the scale.
    expect(followFocus(38.4, 0, 0.6)).toBeCloseTo(0.6);
  });
});

describe('followAxis', () => {
  it('leaves a board that fits where it is, with no lens', () => {
    // The screen shows 10 at the scale of the middle; the board is 6 long.
    for (const at of [-3, -1.2, 0, 2, 3]) {
      const axis = followAxis(-3, 3, at, 10, 0.1, 0);
      expect(axis.lensBefore).toBeCloseTo(0);
      expect(axis.lensAfter).toBeCloseTo(0);
      // What is drawn is what the screen shows, and the start of the board stays at 0.2 of it.
      expect(axis.before + axis.after).toBeCloseTo(10);
      expect(axis.centre - (axis.at - -3) / 10).toBeCloseTo(0.2);
    }
  });

  it('holds the ends of a longer board at the ends of the screen', () => {
    // Twice as long as the screen shows: the lens draws it together, alike towards both ends.
    for (const at of [-10, -4, 0, 7, 10]) {
      const axis = followAxis(-10, 10, at, 10, 0, 0);
      expect(axis.at - axis.before).toBeCloseTo(-10);
      expect(axis.at + axis.after).toBeCloseTo(10);
      expect(axis.centre).toBeCloseTo((at + 10) / 20);
      if (at > -10) expect(axis.lensBefore).toBeCloseTo(1);
      if (at < 10) expect(axis.lensAfter).toBeCloseTo(1);
    }
  });

  it('keeps the centre of the lens away from the ends of the screen', () => {
    const start = followAxis(-10, 10, -10, 10, 0.1, 0);
    expect(start.centre).toBeCloseTo(0.1);
    // Beside the end of the board the screen shows the dark, at the scale of the middle.
    expect(start.before).toBeCloseTo(1);
    expect(start.lensBefore).toBeCloseTo(0);
    // The far end is still at the far end of the screen.
    expect(start.at + start.after).toBeCloseTo(10);
    expect(followAxis(-10, 10, 10, 10, 0.1, 0).centre).toBeCloseTo(0.9);
    expect(followAxis(-10, 10, 0, 10, 0.1, 0).centre).toBeCloseTo(0.5);
  });

  it('takes a point outside the board as the nearest point of it', () => {
    expect(followAxis(-10, 10, 14, 10, 0, 0).at).toBe(10);
    expect(followAxis(-10, 10, -99, 10, 0, 0).at).toBe(-10);
  });

  it('has the whole board drawn, one scale in the middle, and a lens never weaker than asked', () => {
    for (const shown of [4, 10, 19, 25]) {
      for (const edge of [0, 0.1, 0.3, 0.5]) {
        for (const least of [0, 0.25]) {
          for (const at of [-10, -9.3, -2, 0, 5, 10]) {
            const axis = followAxis(-10, 10, at, shown, edge, least);
            expect(axis.at - axis.before).toBeLessThanOrEqual(-10 + 1e-9);
            expect(axis.at + axis.after).toBeGreaterThanOrEqual(10 - 1e-9);
            expect(axis.centre).toBeGreaterThanOrEqual(Math.min(edge, 0.5) - 1e-9);
            expect(axis.centre).toBeLessThanOrEqual(1 - Math.min(edge, 0.5) + 1e-9);
            // The middle shows `shown` across the whole screen, towards either end.
            expect(axis.before / (1 + axis.lensBefore)).toBeCloseTo(axis.centre * shown);
            expect(axis.after / (1 + axis.lensAfter)).toBeCloseTo((1 - axis.centre) * shown);
            expect(axis.lensBefore).toBeGreaterThanOrEqual(least - 1e-9);
            expect(axis.lensAfter).toBeGreaterThanOrEqual(least - 1e-9);
          }
        }
      }
    }
  });
});

describe('followFrame', () => {
  // A phone held upright, the stage under the header.
  const PORTRAIT = 375 / 733;
  const FOCUS = 0.6;
  const width = BOARD.maxR - BOARD.minR;
  const frameAt = (aspect: number, r: number, u: number, least = 0, edge = 0) =>
    followFrame(BOARD, aspect, FOCUS, least, edge, { r, u }, SIDE, MARGIN);

  it('shows the asked share of the board in the middle of the screen', () => {
    const frame = followFrame(BOARD, PORTRAIT, FOCUS, 0, 0, { r: 0, u: 0 }, 0, MARGIN);
    // Upright the board is fitted by its width: at the scale of the middle, the screen is as wide as `focus` of it.
    expect(frame.halfHeight * PORTRAIT * 2).toBeCloseTo(FOCUS * width);
    // And a cell there is that much larger than with the whole board in view.
    const whole = fitBoard(BOARD, PORTRAIT, 0, 0, MARGIN);
    expect(whole.halfHeight / frame.halfHeight).toBeCloseTo(1 / FOCUS);
    // On a wide screen the board is fitted by its height, and the share is counted along it.
    const wide = frameAt(1.8, 0, -0.25);
    expect(wide.halfHeight).toBeCloseTo(FOCUS * fitBoard(BOARD, 1.8, 0, SIDE, MARGIN).halfHeight);
  });

  it('fills an upright screen from side to side wherever the player is, and bends only that way', () => {
    const still = frameAt(PORTRAIT, 0, 0);
    const bottomOf = (frame: typeof still): number => frame.centre.y - (frame.at.u - (BOARD.minU - MARGIN)) / (frame.halfHeight * 2);
    for (const r of [-4.1, -2, 0, 1.3, 4.1]) {
      for (const u of [-3, 0, 2.5]) {
        const frame = frameAt(PORTRAIT, r, u);
        expect(frame.at.r - frame.left).toBeCloseTo(BOARD.minR - SIDE);
        expect(frame.at.r + frame.right).toBeCloseTo(BOARD.maxR + SIDE);
        expect(frame.lens.left).toBeCloseTo(1 / FOCUS - 1);
        expect(frame.lens.right).toBeCloseTo(1 / FOCUS - 1);
        // Top to bottom the board fits at the scale of the middle: it is not pressed together, and does not move.
        expect(frame.lens.bottom).toBeCloseTo(0);
        expect(frame.lens.top).toBeCloseTo(0);
        expect(frame.down + frame.up).toBeCloseTo(frame.halfHeight * 2);
        expect(bottomOf(frame)).toBeCloseTo(bottomOf(still));
      }
    }
  });

  it('has the lens over the player: in the middle of the screen with the player in the middle of the board', () => {
    const middle = frameAt(PORTRAIT, 0, (BOARD.minU + BOARD.maxU) / 2);
    expect(middle.centre.x).toBeCloseTo(0.5);
    expect(middle.centre.y).toBeCloseTo(0.5);
    const right = frameAt(PORTRAIT, 3, 1);
    expect(right.centre.x).toBeGreaterThan(0.5);
    expect(right.centre.y).toBeGreaterThan(0.5);
    expect(right.at).toEqual({ r: 3, u: 1 });
  });

  it('on a screen on its side bends top to bottom instead', () => {
    const frame = frameAt(1.8, 2, 1);
    expect(frame.at.u - frame.down).toBeCloseTo(BOARD.minU - MARGIN);
    expect(frame.at.u + frame.up).toBeCloseTo(BOARD.maxU + MARGIN);
    expect(frame.lens.top).toBeCloseTo(1 / FOCUS - 1);
    expect(frame.lens.bottom).toBeCloseTo(1 / FOCUS - 1);
    expect(frame.lens.left).toBeCloseTo(0);
    expect(frame.lens.right).toBeCloseTo(0);
  });

  it('says how much denser the board has to be drawn for its middle to stay sharp', () => {
    const upright = frameAt(PORTRAIT, 1, 1);
    expect(upright.dense.x).toBeCloseTo(1 / FOCUS);
    expect(upright.dense.y).toBeCloseTo(1);
    // It is the same wherever the player stands: the layer keeps its size.
    expect(frameAt(PORTRAIT, -4, -3, 0, 0.1).dense).toEqual(frameAt(PORTRAIT, 2, 2, 0, 0.1).dense);
    // A lens asked for all round costs as much on the side the board fits along.
    expect(frameAt(PORTRAIT, 0, 0, 0.25).dense.y).toBeCloseTo(1.25);
  });

  it('keeps the whole board in the frame wherever the target is', () => {
    for (const aspect of [0.45, PORTRAIT, 1, 1.8]) {
      for (const edge of [0, 0.1, 0.3]) {
        for (const r of [-3.3, -1, 0, 2, 3.3]) {
          for (const u of [-2.5, 0, 2.5]) {
            const frame = frameAt(aspect, r, u, 0.2, edge);
            expect(frame.at.r - frame.left).toBeLessThanOrEqual(BOARD.minR - SIDE + 1e-9);
            expect(frame.at.r + frame.right).toBeGreaterThanOrEqual(BOARD.maxR + SIDE - 1e-9);
            expect(frame.at.u - frame.down).toBeLessThanOrEqual(BOARD.minU - MARGIN + 1e-9);
            expect(frame.at.u + frame.up).toBeGreaterThanOrEqual(BOARD.maxU + MARGIN - 1e-9);
            for (const strength of Object.values(frame.lens)) expect(strength).toBeGreaterThanOrEqual(0.2 - 1e-9);
          }
        }
      }
    }
  });

  it('has the same scale in the middle towards every side, whatever the lens there', () => {
    const frame = frameAt(PORTRAIT, 2.7, -1.2, 0.2, 0.1);
    const halfWidth = frame.halfHeight * PORTRAIT;
    // A small step on the screen is the same step of the world to the left, to the right and upwards.
    const step = 1e-4;
    const { x, y } = frame.centre;
    const left = -lensInverse(-step / x, 0, frame.lens).x * frame.left;
    const right = lensInverse(step / (1 - x), 0, frame.lens).x * frame.right;
    const up = lensInverse(0, step / (1 - y), frame.lens).y * frame.up;
    expect(left).toBeCloseTo(step * halfWidth * 2, 9);
    expect(right).toBeCloseTo(step * halfWidth * 2, 9);
    expect(up).toBeCloseTo(step * frame.halfHeight * 2, 9);
  });
});

describe('follow', () => {
  it('comes up with a target that stands still and never passes it', () => {
    let state = { at: 0, speed: 0 };
    let last = 0;
    for (let t = 0; t < 1000; t += 16) {
      state = follow(state.at, state.speed, 1, 16, 250);
      expect(state.at).toBeGreaterThanOrEqual(last);
      expect(state.at).toBeLessThanOrEqual(1);
      last = state.at;
    }
    expect(state.at).toBeCloseTo(1, 4);
    expect(state.speed).toBeCloseTo(0, 6);
  });

  it('has covered nine tenths of the way after the time it is given', () => {
    let state = { at: 0, speed: 0 };
    for (let t = 0; t < 250; t += 10) state = follow(state.at, state.speed, 1, 10, 250);
    expect(state.at).toBeGreaterThan(0.88);
    expect(state.at).toBeLessThan(0.94);
  });

  it('does not depend on how the time is cut into frames', () => {
    let fine = { at: 0, speed: 0 };
    for (let i = 0; i < 20; i++) fine = follow(fine.at, fine.speed, 3, 8, 250);
    const coarse = follow(0, 0, 3, 160, 250);
    expect(coarse.at).toBeCloseTo(fine.at, 9);
    expect(coarse.speed).toBeCloseTo(fine.speed, 9);
  });

  it('stops behind a target that has stopped, without going past it', () => {
    // Walking: the target moves a cell every 200 ms, then stands.
    let state = { at: 0, speed: 0 };
    let target = 0;
    for (let t = 0; t < 1200; t += 16) {
      target += 16 / 200;
      state = follow(state.at, state.speed, target, 16, 250);
      expect(state.at).toBeLessThanOrEqual(target);
    }
    for (let t = 0; t < 1000; t += 16) {
      state = follow(state.at, state.speed, target, 16, 250);
      expect(state.at).toBeLessThanOrEqual(target + 1e-9);
    }
    expect(state.at).toBeCloseTo(target, 4);
  });

  it('is there at once with no time to take', () => {
    expect(follow(0, 0.2, 5, 16, 0)).toEqual({ at: 5, speed: 0 });
    expect(follow(2, 0.1, 5, 0, 250)).toEqual({ at: 2, speed: 0.1 });
  });
});
