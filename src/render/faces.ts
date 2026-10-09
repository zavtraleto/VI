/**
 * A face that does not work on the level in hand is told on the face alone: over its pips, in
 * the middle of it, stands a red cross half the face wide, and it gives no light to the tube.
 * Its colour and its brightness are those of a face that works: a die that is faded is a fixed
 * one, and the two are not to be taken for one another.
 */

/** The least a stroke of the cross is thick, in pixels of the picture: under that it does not read on a phone. */
export const CROSS_LEAST_PX = 3;
/** The least the dark line around a stroke is thick, in pixels of the picture. */
export const CROSS_RIM_LEAST_PX = 1;

/**
 * The faces that do not work, a bit for each, the one in the lowest: on a level that names its
 * faces, every other one. Nothing where no faces are named: a session, the exercise, a task.
 */
export function offMask(faces: readonly number[] | undefined): number {
  if (!faces) return 0;
  let mask = 0;
  for (let face = 1; face <= 6; face++) if (!faces.includes(face)) mask |= 1 << (face - 1);
  return mask;
}

/** The strokes of the cross, in the measure the face is given in. */
export interface CrossStrokes {
  /** Half the thickness of a stroke. */
  thick: number;
  /** How far from the middle of the face the middle line of a stroke runs, along the stroke. */
  reach: number;
  /** How far from the middle line of a stroke the dark line around it ends. */
  shell: number;
}

/**
 * The cross of a face that does not work: two strokes with round ends along the diagonals of
 * the face, `size` wide from end to end across the face, `width` thick, with a dark line
 * `rim` thick around them; all three are shares of the face. A stroke is never thinner than
 * can be read with a pixel of the picture `px` faces wide, nor the dark line thinner than a
 * pixel. The shader of the die works it out the same way, from the same numbers.
 */
export function crossStrokes(size: number, width: number, rim: number, px: number): CrossStrokes {
  const thick = Math.max(width / 2, (CROSS_LEAST_PX / 2) * px);
  const reach = Math.max(0, size / 2 - thick) * Math.SQRT2;
  return { thick, reach, shell: thick + Math.max(rim, CROSS_RIM_LEAST_PX * px) };
}
