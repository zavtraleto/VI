import type { Dir, LevelSpec } from '../rules/types';

/**
 * The road: the boards one who is new is led through before the levels of the list, played with
 * no word said and joined one to the next, so that they are one board that goes on. Each is a
 * piece: a level as any is, on a board of its own, laid with its start on the cell the player
 * stood on when the piece before was cleared. They are not in the list of the levels
 * (`levels.ts`).
 *
 * The first block, `R01` to `R07`, teaches the roll, the faces and the combo, and cannot be
 * lost. The dice that wait for the player are fixed, so the only die that moves is their own.
 * The player starts in the southmost row of a piece and the piece lies to the north of them and
 * to the sides: the road goes up the screen, with turns. The camera sees the south and the east
 * side of a die, and the face of the combo is on one of the two before the roll that brings it
 * up: a roll to the north brings up the south side, a roll to the west the east side. The cells
 * the die of the player can come to are a tree, so the face it shows on a cell is always the
 * same and it cannot be turned beyond repair. From every board the player can come to a piece is
 * cleared in a few moves (`road.test.ts` walks them), and `par` and `solution` are proved by the
 * solver.
 *
 * In the pictures `z` grows downwards, as the board is seen: north is up. `#` is a cell, `.`
 * a cell cut out, a digit a fixed die by its face, a letter a die of the player, `s` the stair
 * and `f` the floor the player starts on. A piece lies in the middle of its square, as nearly as
 * its cells let it: where the player is followed, on a small screen, the window is moved over
 * the square, and a piece at the side of its square would be seen at the side of the screen.
 */

/** A square `size` a side with only the cells given left in it. */
function cutAllBut(size: number, cells: readonly [number, number][]): { x: number; z: number }[] {
  const holes: { x: number; z: number }[] = [];
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) if (!cells.some(([cx, cz]) => cx === x && cz === z)) holes.push({ x, z });
  }
  return holes;
}

/** What the pieces have alike: a clear, nothing comes, no limit, three moves taken back, the dice leaving in two moves. */
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

export const ROAD: readonly LevelSpec[] = [
  // . . 2 .    A strip of six that runs north. The 2 on top goes 2, 3, 5, 4, 2 as the die rolls,
  // . . # .    and beside the fixed 2 at the far end it is a combo.
  // . . # .
  // . . # .
  // . . # .
  // . . A .
  {
    ...COMMON, id: 'R01', seed: 8101, size: 6, values: [2], faces: [2], norm: 2, floor: false,
    holes: cutAllBut(6, [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5]]),
    layout: { start: { x: 2, z: 5 }, dice: [{ x: 2, z: 5, top: 2, north: 4 }, { x: 2, z: 0, top: 2, north: 1, fixed: true }] },
    par: 4, solution: ['2,5,N', '2,4,N', '2,3,N', '2,2,N'],
  },
  // . 3 # #    The player on the floor, a die half down to the north of them for a stair, and their
  // . 3 . #    own die beyond it. It rides three cells north with the 3 on its east side all the
  // . . . #    way, and the turn to the west brings the 3 up beside the two that wait.
  // . . . A
  // . . . s
  // . . . f
  {
    ...COMMON, id: 'R02', seed: 8102, size: 6, values: [3], faces: [3], norm: 4, floor: true,
    holes: cutAllBut(6, [[1, 0], [2, 0], [3, 0], [1, 1], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]]),
    layout: {
      start: { x: 3, z: 5 }, onFloor: true, leaving: [{ die: 0, moves: 1 }],
      dice: [{ x: 3, z: 4, top: 6, north: 2 }, { x: 3, z: 3, top: 1, north: 2 }, { x: 1, z: 0, top: 3, north: 1, fixed: true }, { x: 1, z: 1, top: 3, north: 1, fixed: true }],
    },
    par: 4, solution: ['3,3,N', '3,2,N', '3,1,N', '3,0,W'],
  },
  // 2 #        A 2 on the east side of the die under the player: one roll to the west and it is
  // # A        under the fixed 2. The other way leads into a cell with only the way back.
  {
    ...COMMON, id: 'R03', seed: 8103, size: 2, values: [2], faces: [2], norm: 2, floor: false,
    layout: { start: { x: 1, z: 1 }, dice: [{ x: 1, z: 1, top: 6, north: 3 }, { x: 0, z: 0, top: 2, north: 1, fixed: true }] },
    par: 1, solution: ['1,1,W'],
  },
  // . 3 3      A 3 on the south side: a roll to the west leaves it there, and the roll to the
  // . # .      north brings it up under the two that wait.
  // # # A
  {
    ...COMMON, id: 'R04', seed: 8104, size: 3, values: [3], faces: [3], norm: 3, floor: false,
    holes: cutAllBut(3, [[1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]]),
    layout: { start: { x: 2, z: 2 }, dice: [{ x: 2, z: 2, top: 5, north: 4 }, { x: 1, z: 0, top: 3, north: 1, fixed: true }, { x: 2, z: 0, top: 3, north: 1, fixed: true }] },
    par: 2, solution: ['2,2,W', '1,2,N'],
  },
  // . . 2 .    The 2 that waits is round a turn: two rolls to the east with the 2 on the south
  // . . # .    side, and the roll to the north. A cell past the turn is the way too far.
  // A # # #
  {
    ...COMMON, id: 'R05', seed: 8105, size: 4, values: [2], faces: [2], norm: 2, floor: false,
    holes: cutAllBut(4, [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2]]),
    layout: { start: { x: 0, z: 2 }, dice: [{ x: 0, z: 2, top: 6, north: 5 }, { x: 2, z: 0, top: 2, north: 1, fixed: true }] },
    par: 3, solution: ['0,2,E', '1,2,E', '2,2,N'],
  },
  // 4 4 . .    Three 4s stand as a corner, and the cell in the corner is where the fourth goes:
  // 4 # # #    a roll to the north, and the roll to the west brings the 4 up from the east side.
  // . . A .
  {
    ...COMMON, id: 'R06', seed: 8106, size: 4, values: [4], faces: [4], norm: 4, floor: false,
    holes: cutAllBut(4, [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2]]),
    layout: {
      start: { x: 2, z: 2 },
      dice: [{ x: 2, z: 2, top: 6, north: 2 }, { x: 0, z: 0, top: 4, north: 1, fixed: true }, { x: 1, z: 0, top: 4, north: 1, fixed: true }, { x: 0, z: 1, top: 4, north: 1, fixed: true }],
    },
    par: 2, solution: ['2,2,N', '2,1,W'],
  },
  // 3 3 . .    Two combos, one after the other. The die under the player has one roll, to the
  // # # . .    north, and it is a combo with the fixed 2; the second die stands beside it there,
  // . # . .    a step to the west, and goes two cells north and one west to the 3s. No chain is
  // . B # 2    asked for: the 2s may be gone or not when the 3s go.
  // . . A .
  {
    ...COMMON, id: 'R07', seed: 8107, size: 5, values: [2, 3], faces: [2, 3], norm: 5, floor: false,
    holes: cutAllBut(5, [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [2, 4]]),
    layout: {
      start: { x: 2, z: 4 },
      dice: [
        { x: 2, z: 4, top: 4, north: 5 },
        { x: 1, z: 3, top: 1, north: 2 },
        { x: 0, z: 0, top: 3, north: 1, fixed: true },
        { x: 1, z: 0, top: 3, north: 1, fixed: true },
        { x: 3, z: 3, top: 2, north: 1, fixed: true },
      ],
    },
    par: 4, solution: ['2,4,N', '1,3,N', '1,2,N', '1,1,W'],
  },
];

/** A run of pieces of the road that are taught together, by the places of its first and its last. */
export interface RoadBlock {
  from: number;
  to: number;
  /** One scale for the whole block: the camera goes from piece to piece without coming nearer or going back. */
  oneScale: boolean;
}

/** The blocks of the road, in its order. */
export const ROAD_BLOCKS: readonly RoadBlock[] = [{ from: 0, to: 6, oneScale: true }];

/** The block the piece at this place of the road is in; null for a place that is in none. */
export function blockOf(index: number): RoadBlock | null {
  return ROAD_BLOCKS.find((block) => index >= block.from && index <= block.to) ?? null;
}

/** The sign a piece opens with, if any: the direction the swipe sign shows from the first frame. */
export const ROAD_SIGNS: Readonly<Record<string, Dir | undefined>> = { R01: 'N' };

/** What a piece does when the player waits, ms: when the plaque over the target blinks, when the sign comes, how many wasted moves bring it at once. */
type Wait = { blinkMs: number | null; signMs: number; wasted: number | null };

/** The first piece shows its sign from the start, and after a move brings it back in six seconds. */
const FIRST_WAIT: Wait = { blinkMs: null, signMs: 6000, wasted: null };
/** Every other piece blinks its plaque from four seconds and shows the sign from eight, or at once after three moves that led nowhere. */
const WAIT: Wait = { blinkMs: 4000, signMs: 8000, wasted: 3 };

/** The waiting of every piece of the road, by its code. */
export const ROAD_IDLE: Readonly<Record<string, Wait>> = Object.fromEntries(ROAD.map((spec, index) => [spec.id, index === 0 ? FIRST_WAIT : WAIT]));

/** The code of the piece at a place of the road, whether the road has come that far or not: `R01` is at place 0. */
function codeAt(index: number): string {
  return `R${String(index + 1).padStart(2, '0')}`;
}

/**
 * The code kept for one who has cleared the piece at this place: that of the piece after it.
 * After the last piece it names none, and will name the first piece that is added to the road.
 */
export function pieceAfter(index: number): string {
  return ROAD[index + 1]?.id ?? codeAt(index + 1);
}

/**
 * Where one who passed the first level of the build before this one stands: it was what the
 * first block is, so they stand at the piece after the block.
 */
export const FIRST_PASSED = codeAt(ROAD_BLOCKS[0].to + 1);

/**
 * The place of the player on the road, from what is kept of them: `road`, the code of the piece
 * they are on, and whether they passed the first level of the build before (`passed['F1']`),
 * which is read where no code is kept. One who is new is on the first piece. Null is past the
 * road: a code that names no piece of it is the code of a piece after its last.
 */
export function roadPlace(road: string | undefined, firstPassed: boolean): number | null {
  const code = road ?? (firstPassed ? FIRST_PASSED : ROAD[0].id);
  const index = ROAD.findIndex((spec) => spec.id === code);
  return index < 0 ? null : index;
}

/**
 * The middle of the cells of a board, in its own coordinates: of the smallest rectangle that
 * holds the cells left of its square. A piece is a few cells of a square, wherever in it they
 * lie, and the camera is put over these and not over the square.
 */
export function pieceMiddle(spec: Pick<LevelSpec, 'size' | 'holes'>): { x: number; z: number } {
  const cut = new Set((spec.holes ?? []).map((cell) => `${cell.x},${cell.z}`));
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let z = 0; z < spec.size; z++) {
    for (let x = 0; x < spec.size; x++) {
      if (cut.has(`${x},${z}`)) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
}
