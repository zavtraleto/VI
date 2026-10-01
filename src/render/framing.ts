/** Extents of the scene along the camera's right and up axes. */
export interface FrameBounds {
  /** Left and right ends of the cells. */
  minR: number;
  maxR: number;
  /** Bottom of the slab, and the top of a die with the figure on it. */
  minU: number;
  maxU: number;
  /** Highest point of the floor: the far corner of the slab. */
  floorU: number;
}

export interface Frame {
  /** Half the height of the orthographic view, in world units. */
  halfHeight: number;
  centreR: number;
  centreU: number;
}

/**
 * Fits the board into a view that is `aspect` times as wide as it is tall.
 *
 * `clear` is the share of the height, from the top, that something else occupies - the
 * tutorial's text. The floor never reaches into it: where the screen has height to spare
 * the board moves down, and where it has none the board is drawn smaller.
 */
export function fitBoard(b: FrameBounds, aspect: number, clear: number, sideMargin: number, margin: number): Frame {
  const centreR = (b.minR + b.maxR) / 2;
  const forWidth = ((b.maxR - b.minR) / 2 + sideMargin) / aspect;
  const forHeight = (b.maxU - b.minU) / 2 + margin;
  const middle = (b.minU + b.maxU) / 2;
  if (clear <= 0) return { halfHeight: Math.max(forWidth, forHeight), centreR, centreU: middle };

  const share = Math.min(clear, 0.7);
  // Tall enough for the floor to start below the clear part and the slab to end above the bottom.
  const forClear = (b.floorU - b.minU + margin) / (2 * (1 - share));
  const halfHeight = Math.max(forWidth, forHeight, forClear);
  // The lowest the view may look for the floor to stay clear, and the highest for the slab to stay in.
  const lowest = b.floorU - halfHeight * (1 - 2 * share);
  const highest = b.minU - margin + halfHeight;
  return { halfHeight, centreR, centreU: Math.min(Math.max(middle, lowest), highest) };
}
