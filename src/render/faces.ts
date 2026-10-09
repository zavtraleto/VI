/**
 * A face that does not work on the level in hand is told on the face alone: its pips are
 * hollow, rings where the others have dots, and it gives no light to the tube. Its colour and
 * its brightness are those of a face that works: a die that is faded is a fixed one, and the
 * two are not to be taken for one another.
 */

/** The least a ring is thick, in pixels of the picture: under that it does not read on a phone. */
export const RING_LEAST_PX = 2;
/** The most of the radius of a pip its ring takes: there is always a hole to see. */
export const RING_MOST = 0.65;

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

/**
 * The radius of the hole of a hollow pip, in the measure its `radius` is given in. The ring is
 * a share `ring` of the radius, never thinner than a ring can be read at with a pixel of the
 * picture `px` of that measure wide, and never so thick that the hole is gone. The shader of the
 * die works it out the same way, from the same numbers.
 */
export function ringHole(radius: number, ring: number, px: number): number {
  return radius - Math.min(Math.max(radius * ring, RING_LEAST_PX * px), radius * RING_MOST);
}
