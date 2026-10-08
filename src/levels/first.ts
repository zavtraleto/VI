import type { Dir, LevelSpec } from '../rules/types';

/**
 * The first level: four boards one after the other, played with no word said. The first is a strip
 * with a 2 at each end, the second a stair of a die that is leaving and a 3 behind a turn, and the
 * last two the same asks with the player left to find the roll. They are not in the list of the
 * levels (`levels.ts`): they are a level of their own, and it is passed when the fourth is.
 *
 * Each board is a level as any is. A pass is a clear, nothing comes to it, there is no limit of
 * moves and no way to lose it: from every board the player can come to the board is cleared in
 * five moves at the most (`first.test.ts` walks them), and `par` and `solution` are proved by the
 * solver. The pictures of the boards, and why each is what it is, are in the spec of the first
 * level, docs/superpowers/specs/2026-10-08-vi-first-level-design.md, section 6.
 */

/** The code the first level is kept under in the store: one level, whatever the number of its stages. */
export const FIRST_ID = 'F1';

/** A square `size` a side with only the cells given left in it. */
function cutAllBut(size: number, cells: readonly [number, number][]): { x: number; z: number }[] {
  const holes: { x: number; z: number }[] = [];
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) if (!cells.some(([cx, cz]) => cx === x && cz === z)) holes.push({ x, z });
  }
  return holes;
}

/** What the four stages have alike: a clear, nothing comes, no limit, three moves taken back, the dice leaving in two moves. */
const COMMON = {
  arrival: 'none',
  goal: { kind: 'clear' },
  moves: 0,
  undos: 3,
  sinkMoves: 2,
  liftMoves: 1,
  chapter: 0,
  exact: true,
} as const;

export const FIRST_LEVEL: readonly LevelSpec[] = [
  // A strip of six, the player on the die at its west end: the 2 on top goes 2, 6, 5, 1, 2 as it rolls east, and beside the 2 at the east end it is a combo.
  {
    ...COMMON, id: 'F1a', seed: 8001, size: 6, values: [2], faces: [2], norm: 2, floor: false,
    holes: cutAllBut(6, [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2]]),
    layout: { start: { x: 0, z: 2 }, dice: [{ x: 0, z: 2, top: 2, north: 3 }, { x: 5, z: 2, top: 2, north: 3 }] },
    par: 4, solution: ['0,2,E', '1,2,E', '2,2,E', '3,2,E'],
  },
  // The player on the floor of a pocket, a die half down beside it for a stair, a strip and a turn: the 3 is to the south of the die and comes up at the turn, beside the two above.
  {
    ...COMMON, id: 'F1b', seed: 8002, size: 5, values: [3], faces: [3], norm: 4, floor: true,
    holes: cutAllBut(5, [[2, 0], [3, 0], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [0, 3]]),
    layout: {
      start: { x: 0, z: 3 }, onFloor: true, leaving: [{ die: 0, moves: 1 }],
      dice: [{ x: 0, z: 2, top: 6, north: 2 }, { x: 1, z: 2, top: 1, north: 4 }, { x: 3, z: 0, top: 3, north: 1 }, { x: 2, z: 0, top: 3, north: 2 }],
    },
    par: 3, solution: ['1,2,E', '2,2,E', '3,2,N'],
  },
  // A 2 on the south side of the die under the player: one roll to the north and it is beside the other, and the two other ways lead into cells with only the way back.
  {
    ...COMMON, id: 'F1c', seed: 8003, size: 3, values: [2], faces: [2], norm: 2, floor: false,
    holes: cutAllBut(3, [[0, 0], [1, 0], [1, 1], [2, 1], [1, 2]]),
    layout: { start: { x: 1, z: 1 }, dice: [{ x: 1, z: 1, top: 6, north: 5 }, { x: 0, z: 0, top: 2, north: 3 }] },
    par: 1, solution: ['1,1,N'],
  },
  // A 3 on the east side of the die under the player: one roll to the west and it is beside the two above.
  {
    ...COMMON, id: 'F1d', seed: 8004, size: 3, values: [3], faces: [3], norm: 3, floor: false,
    holes: cutAllBut(3, [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1]]),
    layout: { start: { x: 1, z: 1 }, dice: [{ x: 1, z: 1, top: 1, north: 2 }, { x: 0, z: 0, top: 3, north: 1 }, { x: 1, z: 0, top: 3, north: 2 }] },
    par: 1, solution: ['1,1,W'],
  },
];

/** The sign the stage opens with, if any: the direction the swipe sign shows from the first frame. */
export const STAGE_SIGNS: Readonly<Record<string, Dir | undefined>> = { F1a: 'E' };

/** Idle thresholds of a stage, ms: when the plaque over the target blinks, when the sign comes, how many wasted moves bring it at once. */
export const STAGE_IDLE: Readonly<Record<string, { blinkMs: number | null; signMs: number; wasted: number | null }>> = {
  F1a: { blinkMs: null, signMs: 6000, wasted: null },
  F1b: { blinkMs: 4000, signMs: 8000, wasted: 3 },
  F1c: { blinkMs: 4000, signMs: 8000, wasted: 3 },
  F1d: { blinkMs: 4000, signMs: 8000, wasted: 3 },
};
