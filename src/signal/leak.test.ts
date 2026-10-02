import { describe, expect, it } from 'vitest';
import { leakRect } from './leak';

const WIDE = { width: 1280, height: 720 };
const TALL = { width: 375, height: 812 };

describe('leakRect', () => {
  it('stays on the screen wherever chance puts it', () => {
    for (const window of [WIDE, TALL]) {
      for (const edge of [true, false]) {
        for (const along of [0, 0.25, 0.49, 0.5, 0.75, 1]) {
          for (const across of [0, 0.5, 1]) {
            const rect = leakRect(window, 0.36, along, across, edge);
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.y).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(window.width + 1e-6);
            expect(rect.y + rect.height).toBeLessThanOrEqual(window.height + 1e-6);
          }
        }
      }
    }
  });

  it('is four wide to three high and as tall as asked', () => {
    for (const window of [WIDE, TALL]) {
      const rect = leakRect(window, 0.3, 0.2, 0.5);
      expect(rect.height).toBeCloseTo(Math.min(window.width, window.height) * 0.3);
      expect(rect.width / rect.height).toBeCloseTo(4 / 3);
    }
  });

  it('keeps to the ends of the longer side, where the board leaves room', () => {
    for (const along of [0, 0.1, 0.3, 0.49, 0.5, 0.7, 0.9, 1]) {
      const wide = leakRect(WIDE, 0.36, along, 0.5);
      const middle = (wide.x + wide.width / 2) / WIDE.width;
      expect(Math.abs(middle - 0.5)).toBeGreaterThan(0.12);
      const tall = leakRect(TALL, 0.36, along, 0.5);
      const centre = (tall.y + tall.height / 2) / TALL.height;
      expect(Math.abs(centre - 0.5)).toBeGreaterThan(0.12);
    }
  });

  it('may stand in the middle, behind the board, when it is not kept to the edge', () => {
    const rect = leakRect(WIDE, 0.3, 0.5, 0.5, false);
    expect((rect.x + rect.width / 2) / WIDE.width).toBeCloseTo(0.5);
    expect((rect.y + rect.height / 2) / WIDE.height).toBeCloseTo(0.5);
  });
});
