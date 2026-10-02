import { describe, expect, it } from 'vitest';
import { canvasSize, pixelRatio, targetSize, targetViewport } from './sizing';

describe('pixelRatio', () => {
  it('follows the screen up to the limit', () => {
    expect(pixelRatio(1)).toBe(1);
    expect(pixelRatio(1.25)).toBe(1.25);
    expect(pixelRatio(3)).toBe(1.5);
  });

  it('falls back to one when the screen reports nothing', () => {
    expect(pixelRatio(0)).toBe(1);
    expect(pixelRatio(Number.NaN)).toBe(1);
  });
});

describe('targetSize', () => {
  const phone = { width: 375, height: 812 };
  const wide = { width: 1280, height: 720 };

  it('is the canvas itself when no height is given', () => {
    expect(targetSize(wide, null, 1.5)).toEqual({ width: 1920, height: 1080 });
    expect(targetSize(phone, null, 1.5)).toEqual({ width: 562, height: 1218 });
    expect(targetSize(phone, null, 1.5)).toEqual(canvasSize(phone, 1.5));
  });

  it('takes the height given and keeps the proportion of the window', () => {
    expect(targetSize(wide, 240, 1.5)).toEqual({ width: 427, height: 240 });
    expect(targetSize(phone, 240, 1.5)).toEqual({ width: 111, height: 240 });
  });

  it('does not depend on the pixel ratio when the height is given', () => {
    expect(targetSize(wide, 240, 1)).toEqual(targetSize(wide, 240, 1.5));
  });

  it('never comes out empty', () => {
    expect(targetSize({ width: 0, height: 0 }, null, 1.5)).toEqual({ width: 1, height: 1 });
    expect(targetSize({ width: 2, height: 900 }, 120, 1)).toEqual({ width: 1, height: 120 });
  });
});

describe('targetViewport', () => {
  const window = { width: 1280, height: 720 };

  it('covers the whole target for the whole window', () => {
    const target = { width: 1920, height: 1080 };
    expect(targetViewport({ x: 0, y: 0, ...window }, window, target)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it('counts from the bottom left corner of the target', () => {
    const target = { width: 1920, height: 1080 };
    // A stage below a 60 pixel header that reaches the bottom of the window.
    expect(targetViewport({ x: 0, y: 60, width: 1280, height: 660 }, window, target)).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 990,
    });
    // The same header on its own sits at the top of the target.
    expect(targetViewport({ x: 0, y: 0, width: 1280, height: 60 }, window, target)).toEqual({
      x: 0,
      y: 990,
      width: 1920,
      height: 90,
    });
  });

  it('scales to a target of another resolution', () => {
    const target = { width: 427, height: 240 };
    expect(targetViewport({ x: 640, y: 360, width: 640, height: 360 }, window, target)).toEqual({
      x: 214,
      y: 0,
      width: 213,
      height: 120,
    });
  });

  it('leaves no gap between parts that touch at a fraction of a pixel', () => {
    const target = { width: 1920, height: 1080 };
    const header = targetViewport({ x: 0, y: 0, width: 1280, height: 60.67 }, window, target);
    const stage = targetViewport({ x: 0, y: 60.67, width: 1280, height: 659.33 }, window, target);
    expect(stage.y).toBe(0);
    expect(stage.y + stage.height).toBe(header.y);
    expect(header.y + header.height).toBe(1080);
  });

  it('keeps at least a pixel', () => {
    const target = { width: 427, height: 240 };
    const tiny = targetViewport({ x: 10, y: 10, width: 0.2, height: 0.2 }, window, target);
    expect(tiny.width).toBe(1);
    expect(tiny.height).toBe(1);
  });
});
