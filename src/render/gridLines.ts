/**
 * The lines of the surface of a board as what they are: the sides of its cells. Nothing here
 * draws. A cell (x, z) of the rules lies between the corners (x, z) and (x + 1, z + 1); whoever
 * draws puts the corners half a cell back, where the dice have their cells.
 *
 * The lines are drawn as a wave from a cell. First the four sides of that cell, around it; then
 * from its corners the drawing runs on along the lines of the board, a side a step, and parts
 * at every corner it comes to into the sides that are not drawn yet. So a side is never begun
 * before the drawing has come to one of its ends: nothing appears out of the dark apart from
 * the rest, and on a board with cells cut out the drawing goes round them, as the player does.
 */

/** A side of a cell, from one corner to the next. */
export interface GridSegment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** There is no cell beyond it: it is part of the heavy line around the board. */
  edge: boolean;
  /**
   * Steps of the wave from the cell it starts from to the nearer end, `a`: 0 for the sides of
   * that cell, 1 for the sides that leave its corners, one more for every side on the way
   * after that. A step is a cell: a side is one cell long. The side is drawn from `a` to `b`.
   */
  reach: number;
}

interface Cell {
  x: number;
  z: number;
}

/**
 * One for every side of every cell of a board of `size` cells a side with `holes` cut out of
 * it, none twice. They are not directed yet and none is further than another: a wave has to be
 * sent through them (`waveFrom`).
 */
export function gridSegments(size: number, holes: readonly Cell[]): GridSegment[] {
  const cut = new Set(holes.map(({ x, z }) => z * size + x));
  const there = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < size && z < size && !cut.has(z * size + x);
  const segments: GridSegment[] = [];
  const add = (ax: number, az: number, bx: number, bz: number, edge: boolean): void => {
    segments.push({ ax, az, bx, bz, edge, reach: 0 });
  };
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      if (!there(x, z)) continue;
      // The sides to the north and to the west belong to the cell beyond them, where there is one.
      if (!there(x, z - 1)) add(x, z, x + 1, z, true);
      if (!there(x - 1, z)) add(x, z, x, z + 1, true);
      add(x + 1, z, x + 1, z + 1, !there(x + 1, z));
      add(x, z + 1, x + 1, z + 1, !there(x, z + 1));
    }
  }
  return segments;
}

const cornerKey = (x: number, z: number): string => `${x},${z}`;

/**
 * The same sides as a wave from `cell` finds them: each with how far it is and directed from
 * its nearer end to its farther one. The sides of the cell itself are the start, and run
 * clockwise around it; from its corners the wave goes along the sides, and a side is as far as
 * the nearer of its ends. Where both ends are as near - two runs of the drawing meet on that
 * side - it is drawn from the end nearer the middle of the cell, or clockwise around it where
 * that says nothing either. Sides no line leads to (a part of the board that does not touch the
 * rest) come one step after everything else. Where `cell` is not a cell of the board the wave
 * starts from the corner of the board nearest to it.
 */
export function waveFrom(segments: readonly GridSegment[], cell: Cell): GridSegment[] {
  const mx = cell.x + 0.5;
  const mz = cell.z + 0.5;
  const away = (x: number, z: number): number => (x - mx) ** 2 + (z - mz) ** 2;
  /** Both ends are corners of the cell: it is one of its sides. */
  const own = (s: GridSegment): boolean => away(s.ax, s.az) < 0.75 && away(s.bx, s.bz) < 0.75;

  // The sides that meet at every corner, and when the wave comes to the corner.
  const meet = new Map<string, number[]>();
  const came = new Map<string, number>();
  const queue: string[] = [];
  const reach: number[] = segments.map(() => Infinity);
  const come = (corner: string, step: number): void => {
    if (came.has(corner)) return;
    came.set(corner, step);
    queue.push(corner);
  };
  segments.forEach((segment, i) => {
    const ends = [cornerKey(segment.ax, segment.az), cornerKey(segment.bx, segment.bz)];
    for (const end of ends) meet.set(end, [...(meet.get(end) ?? []), i]);
    if (!own(segment)) return;
    reach[i] = 0;
    for (const end of ends) come(end, 1);
  });
  if (queue.length === 0) {
    let nearest = Infinity;
    for (const { ax, az, bx, bz } of segments) nearest = Math.min(nearest, away(ax, az), away(bx, bz));
    for (const { ax, az, bx, bz } of segments) {
      if (away(ax, az) === nearest) come(cornerKey(ax, az), 0);
      if (away(bx, bz) === nearest) come(cornerKey(bx, bz), 0);
    }
  }
  for (let at = 0; at < queue.length; at++) {
    const step = came.get(queue[at])!;
    for (const i of meet.get(queue[at]) ?? []) {
      if (reach[i] !== Infinity) continue;
      reach[i] = step;
      const { ax, az, bx, bz } = segments[i];
      come(cornerKey(ax, az), step + 1);
      come(cornerKey(bx, bz), step + 1);
    }
  }

  let reached = -1;
  for (const steps of reach) if (steps !== Infinity) reached = Math.max(reached, steps);
  return segments.map((segment, i) => {
    const { ax, az, bx, bz } = segment;
    const a = came.get(cornerKey(ax, az)) ?? Infinity;
    const b = came.get(cornerKey(bx, bz)) ?? Infinity;
    // As it lies, unless its other end is nearer.
    let turned = a === b ? 0 : b - a;
    if (turned === 0) turned = away(bx, bz) - away(ax, az);
    // Clockwise, as the board is seen from above with the south towards the viewer.
    if (Math.abs(turned) < 1e-9) turned = (ax - mx) * (bz - mz) - (az - mz) * (bx - mx);
    const back = turned < 0;
    return {
      ax: back ? bx : ax,
      az: back ? bz : az,
      bx: back ? ax : bx,
      bz: back ? az : bz,
      edge: segment.edge,
      reach: reach[i] === Infinity ? reached + 1 : reach[i],
    };
  });
}

/** How far the farthest side is: the wave has that many steps to make, and one more to draw it. */
export function farthest(segments: readonly GridSegment[]): number {
  let far = 0;
  for (const segment of segments) far = Math.max(far, segment.reach);
  return far;
}

/**
 * How much of a side is drawn at share 0..1 of the whole wave: 0 not yet, 1 whole. The wave
 * has `far + 1` equal parts: in the first the nearest sides are drawn, in the last the farthest,
 * which are whole at 1. Erasing is the same run backwards.
 */
export function drawnShare(reach: number, far: number, share: number): number {
  if (share >= 1) return 1;
  return Math.min(1, Math.max(0, share * (far + 1) - reach));
}

/**
 * The share of the wave at which the cell it starts from stands whole and nothing else of the
 * board is there: where an erasing can stop to leave the cell, and a drawing start from it.
 */
export function cellShare(far: number): number {
  return 1 / (far + 1);
}
