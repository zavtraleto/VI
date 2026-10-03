/** The canvas is never denser than this, whatever the screen: the fill rate of a phone is the limit. */
export const MAX_PIXEL_RATIO = 1.5;

export interface Size {
  width: number;
  height: number;
}

/** A rectangle in CSS pixels from the top left corner of the window. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pixels of the canvas per CSS pixel: those of the screen, up to `max`. */
export function pixelRatio(devicePixelRatio: number, max = MAX_PIXEL_RATIO): number {
  return Math.min(devicePixelRatio > 0 ? devicePixelRatio : 1, max);
}

/** Drawing buffer of the canvas for a window; the same rounding as the renderer's own. */
export function canvasSize(window: Size, ratio: number): Size {
  return {
    width: Math.max(1, Math.floor(window.width * ratio)),
    height: Math.max(1, Math.floor(window.height * ratio)),
  };
}

/**
 * Size of a layer's target. `lines` is its height in pixels, the width follows the proportion
 * of the window; `null` is the size of the canvas itself, pixel for pixel.
 */
export function targetSize(window: Size, lines: number | null, ratio: number): Size {
  if (lines === null) return canvasSize(window, ratio);
  const height = Math.max(1, Math.round(lines));
  const aspect = window.height > 0 ? window.width / window.height : 1;
  return { width: Math.max(1, Math.round(height * aspect)), height };
}

/**
 * A part of the window as a viewport of a target: in the target's pixels, from its bottom
 * left corner. The edges are rounded to whole pixels one by one, so rectangles that touch in
 * the window touch in the target too.
 */
export function targetViewport(rect: Rect, window: Size, target: Size): Rect {
  const sx = target.width / window.width;
  const sy = target.height / window.height;
  const left = Math.round(rect.x * sx);
  const right = Math.round((rect.x + rect.width) * sx);
  const top = Math.round(rect.y * sy);
  const bottom = Math.round((rect.y + rect.height) * sy);
  return { x: left, y: target.height - bottom, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
