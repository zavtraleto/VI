import type { Dir, LevelSpec } from '../rules/types';

/**
 * The road: the boards one who is new is led through before the levels of the list, played with
 * no word said and joined one to the next, so that they are one board that goes on. Each is a
 * piece: a level as any is, on a board of its own, laid with its start on the cell the player
 * stood on when the piece before was cleared. They are not in the list of the levels
 * (`levels.ts`).
 *
 * This is the second edition of the road (docs/superpowers/specs/2026-10-09-vi-road-free-pieces-design.md):
 * eighteen pieces in four blocks (`ROAD_BLOCKS`). The owner played the first, twenty pieces of
 * which sixteen held the player to one way, and said it was following an instruction and not a
 * game. Now a block is a lesson, free pieces after it, and a mix. `R01` to `R06` teach the
 * roll, the faces and the combo; `R07` to `R10` the chain; `R11` to `R14` the walk over dice
 * that are leaving; `R15` to `R18` the floor and the push.
 *
 * A lesson (`R01`, `R02`, `R07`, `R11`, `R15`) is a board shaped like a tree, as all of the
 * first edition was: the dice that wait are fixed, the cells are cut to one way, and it cannot
 * be cleared without its move. The camera sees the south and the east side of a die, and the
 * face of the combo is on one of the two before the roll that brings it up.
 *
 * A free piece is a small level: a rectangle with no cell cut out of it, every die a die that
 * rolls (but for the one that waits on `R16`), at least two first moves that keep the board in
 * hand. Its board is picked among the boards laid for its place (`roadRecipes.ts`), and what
 * the place asks is asked of it again in `road.test.ts`. `R03`, `R04` and `R05` cannot be lost:
 * as many dice as the one combo of their face takes, and the floor shut. From `R06` on a piece
 * can come to a dead end, and a move can be taken back. Nothing is asked of the walk over the
 * boards the player can come to: on an open board they are thousands and more.
 *
 * In the pictures `z` grows downwards, as the board is seen: north is up. `#` is a cell and `.`
 * a cell cut out. On a lesson a digit is a fixed die by its face and a capital a die that rolls
 * (`A` the one the player starts on or by). On a free piece every die is a letter in the order
 * of the list, `A` the one under the player, and a digit is the one fixed die. `s` is the stair
 * and `f` the floor the player starts on. A lesson lies in the middle of its square, as nearly
 * as its cells let it: where the player is followed, on a small screen, the window is moved over
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
  // . . 2 .    A1, a lesson. A strip of six that runs north. The 2 on top goes 2, 3, 5, 4, 2 as the
  // . . # .    die rolls, and beside the fixed 2 at the far end it is a combo.
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
  // . 3 # #    A2, a lesson. The player on the floor, a die half down to the north of them for a
  // . 3 . #    stair, and their own die beyond it. It rides three cells north with the 3 on its east
  // . . . #    side all the way, and the turn to the west brings the 3 up beside the two that wait.
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
  // # # #      A3, free: the first board with nothing held. Two dice, and a pair of 2s is one combo.
  // # b #      The die under the player has its 2 on the south side, where it is seen: a roll to
  // # A #      either side keeps it there, and the roll to the north then brings it up beside the 2.
  {
    ...COMMON, id: 'R03', seed: 8103, size: 3, values: [2], faces: [2], norm: 2, floor: false,
    layout: { start: { x: 1, z: 2 }, dice: [{ x: 1, z: 2, top: 6, north: 5 }, { x: 1, z: 1, top: 2, north: 3 }] },
    par: 2, solution: ['1,2,E', '2,2,N'],
  },
  // # # # .    A4, free, on a board three cells wide and four long. Two 3s stand side by side and
  // b c # .    the die of the player is off to the south with its 3 on the east side: north, and
  // # # # .    the turn to the west under the pair. The pair can be rolled away, and comes back.
  // # A # .
  {
    ...COMMON, id: 'R04', seed: 8104, size: 4, values: [3], faces: [3], norm: 3, floor: false,
    holes: [{ x: 3, z: 0 }, { x: 3, z: 1 }, { x: 3, z: 2 }, { x: 3, z: 3 }],
    layout: { start: { x: 1, z: 3 }, dice: [{ x: 1, z: 3, top: 2, north: 6 }, { x: 0, z: 1, top: 3, north: 2 }, { x: 1, z: 1, top: 3, north: 2 }] },
    par: 2, solution: ['1,3,N', '1,2,W'],
  },
  // # # # #    A5, free. Three 4s stand as a corner and the player is on one of them: a 4 takes
  // # # # d    four dice, and the fourth is the die beside them, which shows a 2. A step onto it,
  // # b A c    which is the first step of the road the player is not led to, a roll north or south
  // # # # #    and the roll east into the corner.
  {
    ...COMMON, id: 'R05', seed: 8105, size: 4, values: [4], faces: [4], norm: 4, floor: false,
    layout: { start: { x: 2, z: 2 }, dice: [{ x: 2, z: 2, top: 4, north: 1 }, { x: 1, z: 2, top: 2, north: 6 }, { x: 3, z: 2, top: 4, north: 1 }, { x: 3, z: 1, top: 4, north: 1 }] },
    par: 2, solution: ['1,2,N', '1,1,E'],
  },
  // # # b c    A6, the mix of the block: two faces, two combos, either first, and no chain. The die
  // # # # A    under the player has a 3 on its east side: a roll west and the 3s go. The die to the
  // # # d e    south of it then makes the 2s in two rolls, round the 2 that waits.
  // # # # #
  {
    ...COMMON, id: 'R06', seed: 8106, size: 4, values: [3, 2], faces: [3, 2], norm: 5, floor: false,
    layout: {
      start: { x: 3, z: 1 },
      dice: [{ x: 3, z: 1, top: 6, north: 5 }, { x: 2, z: 0, top: 3, north: 5 }, { x: 3, z: 0, top: 3, north: 5 }, { x: 2, z: 2, top: 6, north: 4 }, { x: 3, z: 2, top: 2, north: 6 }],
    },
    par: 3, solution: ['3,1,W', '2,2,S', '2,3,E'],
  },
  // . # B .    B1, the lesson of the chain. Three 2s, and a combo takes two: two rolls to the north
  // . 2 # .    make it, and the third die is a step away, to the north. One roll to the west puts it
  // . . # .    against the fixed 2 while that is leaving, and it leaves with the two. A roll the
  // . . A .    wrong way, over the die the player has left, still leaves the roll that joins.
  {
    ...COMMON, id: 'R07', seed: 8107, size: 4, values: [2], faces: [2], norm: 3, floor: false,
    holes: cutAllBut(4, [[1, 0], [2, 0], [1, 1], [2, 1], [2, 2], [2, 3]]),
    layout: {
      start: { x: 2, z: 3 },
      dice: [
        { x: 2, z: 3, top: 5, north: 6 },
        { x: 2, z: 0, top: 6, north: 3 },
        { x: 1, z: 1, top: 2, north: 1, fixed: true },
      ],
    },
    par: 3, solution: ['2,3,N', '2,2,N', '2,0,W'],
  },
  // # # c #    B2, free: the chain as a gain. Two 2s wait apart and two dice show 4s. The die under
  // A b # #    the player goes north and east to the 2 at the top; the second die, a step back,
  // # # d #    is then rolled east between the two 2s, and takes the one that stands with it into
  // # # # #    the chain. Without the chain the four go as two pairs, in more moves.
  {
    ...COMMON, id: 'R08', seed: 8108, size: 4, values: [2], faces: [2], norm: 4, floor: false,
    layout: { start: { x: 0, z: 1 }, dice: [{ x: 0, z: 1, top: 4, north: 1 }, { x: 1, z: 1, top: 4, north: 1 }, { x: 2, z: 0, top: 2, north: 4 }, { x: 2, z: 2, top: 2, north: 6 }] },
    par: 3, solution: ['0,1,N', '0,0,E', '1,1,E'],
  },
  // # b # #    B3, free: 3s and one over. Two 3s stand in a column, and two dice show 2s with their
  // # c # #    3s on the south side. A roll north under the column: the 3s go. The fourth die is a
  // # # d #    step to the east, and one roll north puts it against them while they leave. Within
  // # A # #    a few moves nothing clears the board but the chain.
  {
    ...COMMON, id: 'R09', seed: 8109, size: 4, values: [3], faces: [3], norm: 4, floor: false,
    layout: { start: { x: 1, z: 3 }, dice: [{ x: 1, z: 3, top: 2, north: 4 }, { x: 1, z: 0, top: 3, north: 6 }, { x: 1, z: 1, top: 3, north: 6 }, { x: 2, z: 2, top: 2, north: 4 }] },
    par: 2, solution: ['1,3,N', '2,2,N'],
  },
  // # # # b    B4, the mix of the block: two faces, and the chain is the shorter of two whole ways.
  // # # c #    A roll south: the 3s. A step east, and that die goes north and west into the cell the
  // # d A #    first one left, beside the 3s as they leave. A step north, a roll east: the 2s.
  // # e # f    Without the chain the board is cleared in a move more.
  {
    ...COMMON, id: 'R10', seed: 8110, size: 4, values: [3, 2], faces: [3, 2], norm: 6, floor: false,
    layout: {
      start: { x: 2, z: 2 },
      dice: [
        { x: 2, z: 2, top: 6, north: 3 },
        { x: 3, z: 0, top: 2, north: 3 },
        { x: 2, z: 1, top: 6, north: 4 },
        { x: 1, z: 2, top: 3, north: 2 },
        { x: 1, z: 3, top: 3, north: 2 },
        { x: 3, z: 3, top: 6, north: 5 },
      ],
    },
    par: 4, solution: ['2,2,S', '3,3,N', '3,2,W', '2,1,E'],
  },
  // 2 # # .    C1, the lesson of the walk. One roll north makes the 3s, and the die that is to make
  // . . B .    the 2s is at the far end of them: the only way to it is over the dice that are
  // # 3 3 .    leaving. Steps are no moves, so the dice wait while the player walks. Then north
  // A . . .    and west.
  {
    ...COMMON, id: 'R11', seed: 8111, size: 4, values: [3, 2], faces: [3, 2], norm: 5, floor: false,
    holes: cutAllBut(4, [[0, 0], [1, 0], [2, 0], [2, 1], [0, 2], [1, 2], [2, 2], [0, 3]]),
    layout: {
      start: { x: 0, z: 3 },
      dice: [
        { x: 0, z: 3, top: 5, north: 4 },
        { x: 2, z: 1, top: 4, north: 6 },
        { x: 1, z: 2, top: 3, north: 1, fixed: true },
        { x: 2, z: 2, top: 3, north: 1, fixed: true },
        { x: 0, z: 0, top: 2, north: 1, fixed: true },
      ],
    },
    par: 3, solution: ['0,3,N', '2,1,N', '2,0,W'],
  },
  // b # # A    C2, free: the walk as a short cut. Two rolls west bring a 3 up over the column of
  // # c # #    3s. The die that makes the 2s is at the foot of that column: three moves by the walk
  // d e # #    over the 3s as they leave, four by the way round them.
  // # # # #
  {
    ...COMMON, id: 'R12', seed: 8112, size: 4, values: [3, 2], faces: [3, 2], norm: 5, floor: false,
    layout: {
      start: { x: 3, z: 0 },
      dice: [{ x: 3, z: 0, top: 4, north: 6 }, { x: 0, z: 0, top: 2, north: 3 }, { x: 1, z: 1, top: 3, north: 6 }, { x: 0, z: 2, top: 6, north: 5 }, { x: 1, z: 2, top: 3, north: 5 }],
    },
    par: 3, solution: ['3,0,W', '2,0,W', '0,2,N'],
  },
  // # # # #    C3, free: the stair again, onto an open board. The player on the floor, a die half
  // A # # #    down to the north of them, their own die beyond it. Up and over; east, south and
  // s # # b    east to the 3s. A push made from the floor first takes the stair away.
  // f # # c
  {
    ...COMMON, id: 'R13', seed: 8113, size: 4, values: [3], faces: [3], norm: 4, floor: true,
    layout: {
      start: { x: 0, z: 3 }, onFloor: true, leaving: [{ die: 0, moves: 1 }],
      dice: [{ x: 0, z: 2, top: 6, north: 2 }, { x: 0, z: 1, top: 4, north: 6 }, { x: 3, z: 2, top: 3, north: 1 }, { x: 3, z: 3, top: 3, north: 1 }],
    },
    par: 3, solution: ['0,1,E', '1,1,S', '1,2,E'],
  },
  // # # # #    C4, the mix of the block: two faces, the walk, and the chain last. A roll west: the
  // # # # b    3s. Two steps to the die in the corner and a roll north: the 2s. Back over the dice
  // c d # A    that are leaving to the last die, and a roll west puts it under the 3s.
  // # # e f
  {
    ...COMMON, id: 'R14', seed: 8114, size: 4, values: [3, 2], faces: [3, 2], norm: 6, floor: false,
    layout: {
      start: { x: 3, z: 2 },
      dice: [
        { x: 3, z: 2, top: 6, north: 5 },
        { x: 3, z: 1, top: 2, north: 6 },
        { x: 0, z: 2, top: 3, north: 2 },
        { x: 1, z: 2, top: 3, north: 5 },
        { x: 2, z: 3, top: 5, north: 1 },
        { x: 3, z: 3, top: 6, north: 5 },
      ],
    },
    par: 3, solution: ['3,2,W', '3,3,N', '2,3,W'],
  },
  // 3 . . 2    D1, the lesson of the way down and of the push. A roll north makes the 2s, and the
  // 3 . . #    die under the player is leaving. One empty cell is beside it, the one it came from:
  // # B # A    a step back is a step down. A step west along the floor, and the die that shows a
  // . . . .    3 is pushed west to the fixed 3s: the one push there is to make.
  {
    ...COMMON, id: 'R15', seed: 8115, size: 4, values: [2, 3], faces: [2, 3], norm: 5, floor: true,
    holes: cutAllBut(4, [[0, 0], [3, 0], [0, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2]]),
    layout: {
      start: { x: 3, z: 2 },
      dice: [
        { x: 3, z: 2, top: 4, north: 5 },
        { x: 1, z: 2, top: 3, north: 1 },
        { x: 3, z: 0, top: 2, north: 1, fixed: true },
        { x: 0, z: 0, top: 3, north: 1, fixed: true },
        { x: 0, z: 1, top: 3, north: 1, fixed: true },
      ],
    },
    par: 2, solution: ['3,2,N', '1,2,W,p'],
  },
  // # # a #    D2, free, and the one free piece with a fixed die: the 3 that waits in the middle.
  // # 3 # #    The player is on the floor and two dice show their 3s, one at the north edge and one
  // b # # #    at the west. A push does not turn a die: one is pushed west and the other north, in
  // # f # #    either order. Each has the one push, so no push here is a wrong one.
  {
    ...COMMON, id: 'R16', seed: 8116, size: 4, values: [3], faces: [3], norm: 3, floor: true,
    layout: {
      start: { x: 1, z: 3 }, onFloor: true,
      dice: [{ x: 2, z: 0, top: 3, north: 1 }, { x: 0, z: 2, top: 3, north: 1 }, { x: 1, z: 1, top: 3, north: 1, fixed: true }],
    },
    par: 2, solution: ['2,0,W,p', '0,2,N,p'],
  },
  // # b # A    D3, free: down and back. A roll west: the 2s, and the die under the player is
  // # # # #    leaving. Down, round to the north of the die that shows a 3, and a push south: the
  // # c d #    3s. Up by them as they leave, a step to the last die, and a roll west puts it on
  // e # f #    the place of the die that was pushed.
  {
    ...COMMON, id: 'R17', seed: 8117, size: 4, values: [2, 3], faces: [2, 3], norm: 6, floor: true,
    layout: {
      start: { x: 3, z: 0 },
      dice: [
        { x: 3, z: 0, top: 6, north: 3 },
        { x: 1, z: 0, top: 2, north: 6 },
        { x: 1, z: 2, top: 3, north: 1 },
        { x: 2, z: 2, top: 2, north: 6 },
        { x: 0, z: 3, top: 3, north: 1 },
        { x: 2, z: 3, top: 3, north: 2 },
      ],
    },
    par: 3, solution: ['3,0,W', '1,2,S,p', '2,2,W'],
  },
  // b # c #    D4, the mix of everything. A roll north: the 3s. Down, and a push west makes the 2s
  // # # d e    at the top. A second push brings the last die under them; up by the 2s as they
  // f # # #    leave, a step onto it, and a roll east joins it to them on the last move it can.
  // # # A #
  {
    ...COMMON, id: 'R18', seed: 8118, size: 4, values: [3, 2], faces: [3, 2], norm: 6, floor: true,
    layout: {
      start: { x: 2, z: 3 },
      dice: [
        { x: 2, z: 3, top: 2, north: 4 },
        { x: 0, z: 0, top: 2, north: 4 },
        { x: 2, z: 0, top: 2, north: 3 },
        { x: 2, z: 1, top: 3, north: 1 },
        { x: 3, z: 1, top: 3, north: 1 },
        { x: 0, z: 2, top: 4, north: 1 },
      ],
    },
    par: 4, solution: ['2,3,N', '2,0,W,p', '0,2,N,p', '0,1,E'],
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
export const ROAD_BLOCKS: readonly RoadBlock[] = [
  { from: 0, to: 5, oneScale: true },
  { from: 6, to: 9, oneScale: false },
  { from: 10, to: 13, oneScale: false },
  { from: 14, to: 17, oneScale: false },
];

/** The block the piece at this place of the road is in; null for a place that is in none. */
export function blockOf(index: number): RoadBlock | null {
  return ROAD_BLOCKS.find((block) => index >= block.from && index <= block.to) ?? null;
}

/** The sign a piece opens with, if any: the direction the swipe sign shows from the first frame. */
export const ROAD_SIGNS: Readonly<Record<string, Dir | undefined>> = { R01: 'N' };

/** The moves a piece can teach that a line above the board speaks of, and what ends the line: the first combo, a die joined to a combo that is leaving, a step onto a leaving die, a push. */
export type HintUntil = 'combo' | 'chain' | 'walk' | 'push';

/** The lines of the texts (`src/ui/i18n.ts`) that a piece can carry above its board. */
export type RoadHintKey = 'roadHintChain' | 'roadHintWalk' | 'roadHintPush';

export interface RoadHint {
  /** The key of the line, in the seven languages. */
  key: RoadHintKey;
  /** The line stands from the start of the piece and goes out when this has been done on it. */
  until: HintUntil;
}

/**
 * The pieces that teach a move carry a line above the board, a hint and not an instruction (the
 * owner: «они скорее подсказка, а не наставление»): `R07` the chain, `R11` the walk over dice
 * that are leaving, `R15` the way down and the push.
 */
export const ROAD_HINTS: Readonly<Record<string, RoadHint>> = {
  R07: { key: 'roadHintChain', until: 'chain' },
  R11: { key: 'roadHintWalk', until: 'walk' },
  R15: { key: 'roadHintPush', until: 'push' },
};

/** A piece that has come to a dead end this many times shows the sign of the way at once: the second time is a mistake that is repeated. */
export const DEAD_ENDS_FOR_SIGN = 2;

/** What a piece does when the player waits, ms: when the plaque over the target blinks, when the sign comes, how many wasted moves bring it at once. */
type Wait = { blinkMs: number | null; signMs: number; wasted: number | null };

/**
 * The lessons: boards shaped like a tree, a few dozen boards each, where the way is cheap to
 * find after every move. Only they count the moves that led nowhere.
 */
export const ROAD_LESSONS: readonly string[] = ['R01', 'R02', 'R07', 'R11', 'R15'];

/** The first piece shows its sign from the start, and after a move brings it back in six seconds, or at once after three moves that led nowhere. */
const FIRST_WAIT: Wait = { blinkMs: null, signMs: 6000, wasted: 3 };
/** A lesson after it blinks its plaque from four seconds and shows the sign from eight, or at once after three moves that led nowhere. */
const LESSON_WAIT: Wait = { blinkMs: 4000, signMs: 8000, wasted: 3 };
/**
 * A free piece or a mix blinks and shows the sign by the same seconds, and counts no wasted
 * moves: that count asks the solver after every move, and on an open board the answer costs a
 * frame that hangs. Its sign comes by waiting, and at the second dead end.
 */
const FREE_WAIT: Wait = { blinkMs: 4000, signMs: 8000, wasted: null };

/** The waiting of every piece of the road, by its code. */
export const ROAD_IDLE: Readonly<Record<string, Wait>> = Object.fromEntries(
  ROAD.map((spec, index) => [spec.id, index === 0 ? FIRST_WAIT : ROAD_LESSONS.includes(spec.id) ? LESSON_WAIT : FREE_WAIT]),
);

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
 * Where one who passed the first level of the build before the road stands: it was what the
 * first block is, so they stand at the piece after the block, the lesson of the chain.
 */
export const FIRST_PASSED = codeAt(ROAD_BLOCKS[0].to + 1);

/** The code kept for one who has cleared the last piece: they are past the road. */
export const ROAD_END = pieceAfter(ROAD.length - 1);

/**
 * The place of the player on the road, from what is kept of them: `road`, the code of the piece
 * they are on, and whether they passed the first level of the build before (`passed['F1']`),
 * which is read where no code is kept. One who is new is on the first piece. Null is past the
 * road: the code of the piece after its last (`ROAD_END`). Any other code that names no piece
 * leads to the first one: it is not known where on this road its player stood.
 */
export function roadPlace(road: string | undefined, firstPassed: boolean): number | null {
  const code = road ?? (firstPassed ? FIRST_PASSED : ROAD[0].id);
  if (code === ROAD_END) return null;
  const index = ROAD.findIndex((spec) => spec.id === code);
  return index < 0 ? 0 : index;
}

/**
 * The edition of the road. Its pieces were given their codes anew with the second: `R03` of the
 * first is another board than `R03` of this one, so what a player of the first has kept under
 * those codes is not of these boards.
 */
export const ROAD_EDITION = 2;

/** What was kept under the codes of the road: the codes of its pieces are `R` and two digits, and no level of the list has such a code. */
const ROAD_CODE = /^R\d\d$/;
/** The pieces the first edition had: a code after its last was that of one who had cleared it. */
const FIRST_EDITION_PIECES = 20;

/** What is kept of a player that the road reads and writes: see `LevelProgress` in `src/platform/settings.ts`. */
export interface RoadKept {
  passed: Record<string, boolean>;
  stats: Record<string, unknown>;
  road?: string;
  roadEdition?: number;
}

/**
 * Brings what is kept of a player to this edition of the road; what is of this edition already
 * is given back as it is. From an edition before it: what was passed and counted under the
 * codes of the road is dropped, since the stars were earned on other boards, and the levels of
 * the list are left as they were. One who was on the road is put on its first piece, since the
 * boards and their order are new; one who had cleared it stays past it, as they have been
 * taught all it teaches; one with no place kept has none still.
 */
export function toRoadEdition<T extends RoadKept>(kept: T): T {
  if (kept.roadEdition === ROAD_EDITION) return kept;
  const notRoad = <V>(all: Record<string, V>): Record<string, V> => Object.fromEntries(Object.entries(all ?? {}).filter(([code]) => !ROAD_CODE.test(code)));
  const moved: T = { ...kept, passed: notRoad(kept.passed), stats: notRoad(kept.stats), roadEdition: ROAD_EDITION };
  if (kept.road !== undefined) {
    const place = ROAD_CODE.test(kept.road) ? Number(kept.road.slice(1)) : 0;
    moved.road = place > FIRST_EDITION_PIECES ? ROAD_END : ROAD[0].id;
  }
  return moved;
}

/**
 * What is kept of the player's place on the road once the piece at `piece` is passed. The place
 * moves on, to the piece after it, only when that piece is the one the player is on; one who is
 * further on or behind, or past the road, and plays a piece by its address stays where they
 * were, and what was kept is given back as it was.
 */
export function placeAfter(road: string | undefined, firstPassed: boolean, piece: number): string | undefined {
  return roadPlace(road, firstPassed) === piece ? pieceAfter(piece) : road;
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
