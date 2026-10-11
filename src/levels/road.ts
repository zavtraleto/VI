import type { Dir, LevelSpec } from '../rules/types';

/**
 * The road: the boards one who is new is led through before the levels of the list, played with
 * no word said and joined one to the next, so that they are one board that goes on. Each is a
 * piece: a level as any is, on a board of its own, laid with its start on the cell the player
 * stood on when the piece before was cleared. They are not in the list of the levels
 * (`levels.ts`).
 *
 * This is the third edition of the road (docs/superpowers/specs/2026-10-09-vi-road-free-pieces-design.md,
 * section 15): sixteen pieces in four blocks (`ROAD_BLOCKS`), set by the owner after he played the
 * second. `R01` to `R05` teach the roll, the faces and the combo; `R06` to `R10` the chain;
 * `R11` and `R12` the walk over dice that are leaving; `R13` to `R16` the floor and the push.
 *
 * A lesson is the piece that brings a move, with a line above the board. `R01`, `R02`, `R11` and
 * `R13` are boards cut to few cells, and none of them can be lost: the dice that wait are fixed,
 * but for the pair of 2s and the two 3s of `R13`, whose fixed 3 is the one they are pushed to.
 * The lesson of the chain (`R06`) is an open board of three dice that all roll: the first pair
 * is the player's own to find, and the chain missed leaves one die alone, a dead end said at
 * once. The camera sees the south and the east side of a die, and the face of a lesson's combo
 * is on one of the two before the roll that brings it up.
 *
 * A free piece is a small level: a rectangle with no cell cut out of it, or a square with one
 * line cut off its side (`R04`, `R05`), every die a die that rolls, at least two first moves that
 * keep the board in hand where its board allows. Its board is picked among the boards laid for
 * its place (`roadRecipes.ts`), and what the place asks is asked of it again in `road.test.ts`.
 * `R03` and `R04` cannot be lost: as many dice as the one combo of their face takes, and the
 * floor shut. From `R05` on a piece can come to a dead end, and a move can be taken back.
 * Nothing is asked of the walk over the boards the player can come to: on an open board they are
 * thousands and more.
 *
 * In the pictures `z` grows downwards, as the board is seen: north is up. `#` is a cell and `.`
 * a cell cut out. On a lesson a digit is a fixed die by its face and a capital a die that rolls
 * (`A` the one the player starts on or by). On a free piece every die is a letter in the order
 * of the list, `A` the one under the player. `s` is the stair and `f` the floor the player
 * starts on. A lesson lies in the middle of its square, as nearly
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
  // . . . .    A5, free: the board that was R08 of the second edition, turned half round so that the
  // # d # #    2 of the die under the player is on its east side, where it is seen, and with the row
  // # # b A    no way used cut off. North and west: the 2s at the top. A step back to the die beside
  // # c # #    and a roll west joins it and the 2 below to the pair as it leaves. Two pairs one after
  //            the other clear the board as well, in five moves: the chain is a gain and not a must.
  {
    ...COMMON, id: 'R05', seed: 8105, size: 4, values: [2], faces: [2], norm: 4, floor: false,
    holes: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }, { x: 3, z: 0 }],
    layout: { start: { x: 3, z: 2 }, dice: [{ x: 3, z: 2, top: 4, north: 6 }, { x: 2, z: 2, top: 4, north: 6 }, { x: 1, z: 3, top: 2, north: 3 }, { x: 1, z: 1, top: 2, north: 1 }] },
    par: 3, solution: ['3,2,N', '3,1,W', '2,2,W'],
  },
  // # B # A    B1, the lesson of the chain, on an open board: three 2s, every die one that rolls, and
  // C # # #    a combo takes two. The 2 of the die under the player is on its south side: south and
  // # # # #    twice west put it under the 2 that stands, and the pair goes. The third die is then a
  // # # # #    step away, and one roll north joins it to the pair as it leaves. Two pairs cannot be
  //            made of three: without the chain one die is left alone, a dead end said at once.
  {
    ...COMMON, id: 'R06', seed: 8106, size: 4, values: [2], faces: [2], norm: 3, floor: false,
    layout: { start: { x: 3, z: 0 }, dice: [{ x: 3, z: 0, top: 4, north: 5 }, { x: 1, z: 0, top: 2, north: 1 }, { x: 0, z: 1, top: 6, north: 5 }] },
    par: 4, solution: ['3,0,S', '3,1,W', '2,1,W', '0,1,N'],
  },
  // # b # #    B2, free: 3s and one over. Two 3s stand in a column, and two dice show 2s with their
  // # c # #    3s on the south side. A roll north under the column: the 3s go. The fourth die is a
  // # # d #    step to the east, and one roll north puts it against them while they leave. Within
  // # A # #    a few moves nothing clears the board but the chain.
  {
    ...COMMON, id: 'R07', seed: 8107, size: 4, values: [3], faces: [3], norm: 4, floor: false,
    layout: { start: { x: 1, z: 3 }, dice: [{ x: 1, z: 3, top: 2, north: 4 }, { x: 1, z: 0, top: 3, north: 6 }, { x: 1, z: 1, top: 3, north: 6 }, { x: 2, z: 2, top: 2, north: 4 }] },
    par: 2, solution: ['1,3,N', '2,2,N'],
  },
  // b # # A    B3, free: the board of P08 of the list, a long chain. Two rolls west bring a 2 up
  // # c # #    beside the 2 that stands. Then one die after another is rolled to the pair while it
  // d # e #    leaves: the one in the corner south, the one below it east, the last north, each
  // # # # #    joining what is still going. The board came to the road, and R10 of the second
  //            edition went to the list in its place, by the word of the owner of 11 October.
  {
    ...COMMON, id: 'R08', seed: 8108, size: 4, values: [2], faces: [2], norm: 5, floor: false,
    layout: { start: { x: 3, z: 0 }, dice: [{ x: 3, z: 0, top: 5, north: 6 }, { x: 0, z: 0, top: 3, north: 2 }, { x: 1, z: 1, top: 2, north: 1 }, { x: 0, z: 2, top: 3, north: 6 }, { x: 2, z: 2, top: 6, north: 5 }] },
    par: 5, solution: ['3,0,W', '2,0,W', '0,0,S', '0,2,E', '2,2,N'],
  },
  // b # # A    B4, free: the walk as a short cut. Two rolls west bring a 3 up over the column of
  // # c # #    3s. The die that makes the 2s is at the foot of that column: three moves by the walk
  // d e # #    over the 3s as they leave, four by the way round them. Not hurrying pays.
  // # # # #
  {
    ...COMMON, id: 'R09', seed: 8109, size: 4, values: [3, 2], faces: [3, 2], norm: 5, floor: false,
    layout: {
      start: { x: 3, z: 0 },
      dice: [{ x: 3, z: 0, top: 4, north: 6 }, { x: 0, z: 0, top: 2, north: 3 }, { x: 1, z: 1, top: 3, north: 6 }, { x: 0, z: 2, top: 6, north: 5 }, { x: 1, z: 2, top: 3, north: 5 }],
    },
    par: 3, solution: ['3,0,W', '2,0,W', '0,2,N'],
  },
  // # # b c    B5, the mix of the block: two faces, two combos, either first. The die under the
  // # # # A    player has a 3 on its east side: a roll west and the 3s go. The die to the south of
  // # # d e    it then makes the 2s in two rolls, round the 2 that waits.
  // # # # #
  {
    ...COMMON, id: 'R10', seed: 8110, size: 4, values: [3, 2], faces: [3, 2], norm: 5, floor: false,
    layout: {
      start: { x: 3, z: 1 },
      dice: [{ x: 3, z: 1, top: 6, north: 5 }, { x: 2, z: 0, top: 3, north: 5 }, { x: 3, z: 0, top: 3, north: 5 }, { x: 2, z: 2, top: 6, north: 4 }, { x: 3, z: 2, top: 2, north: 6 }],
    },
    par: 3, solution: ['3,1,W', '2,2,S', '2,3,E'],
  },
  // 3 3 . .    C1, the lesson of the walk. One roll north makes the 2s, with the 2 that waits. The
  // . # B .    die that is to make the 3s is beyond it, and the only way to it is over the 2 while it
  // . . 2 #    leaves: a step is no move, so the dice wait while the player walks. Then one roll
  // . . . A    west, under the 3s.
  {
    ...COMMON, id: 'R11', seed: 8111, size: 4, values: [2, 3], faces: [2, 3], norm: 5, floor: false,
    holes: cutAllBut(4, [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3]]),
    layout: {
      start: { x: 3, z: 3 },
      dice: [
        { x: 3, z: 3, top: 6, north: 5 },
        { x: 2, z: 1, top: 5, north: 1 },
        { x: 2, z: 2, top: 2, north: 1, fixed: true },
        { x: 0, z: 0, top: 3, north: 1, fixed: true },
        { x: 1, z: 0, top: 3, north: 1, fixed: true },
      ],
    },
    par: 2, solution: ['3,3,N', '2,1,W'],
  },
  // b # # #    C2, the mix of the block: a bridge over a long combo. A roll north makes the 3s, a row
  // # c d #    of three. Two steps north and west and a roll west: the 2s at the top. Back over the
  // e f # #    three 3s as they leave, and the last die rolled west joins the 2s: the chain last.
  // # # A #    Without the walk the board takes a move more.
  {
    ...COMMON, id: 'R12', seed: 8112, size: 4, values: [3, 2], faces: [3, 2], norm: 6, floor: false,
    layout: {
      start: { x: 2, z: 3 },
      dice: [
        { x: 2, z: 3, top: 6, north: 4 },
        { x: 0, z: 0, top: 2, north: 1 },
        { x: 1, z: 1, top: 4, north: 6 },
        { x: 2, z: 1, top: 6, north: 3 },
        { x: 0, z: 2, top: 3, north: 5 },
        { x: 1, z: 2, top: 3, north: 1 },
      ],
    },
    par: 3, solution: ['2,3,N', '1,1,W', '2,1,W'],
  },
  // # C # .    D1, the lesson of the way down and of the push. A roll west makes the 2s in the
  // # # 3 #    corner, and the die under the player is leaving. One empty cell is beside it, the one
  // # . . D    it came from: a step back is a step down. Two dice show their 3s and are pushed to
  // B # A #    the 3 that waits, one north and one east, in either order: the one beyond the 2s is
  //            come to over them while they leave. On the floor there is nothing else to push.
  {
    ...COMMON, id: 'R13', seed: 8113, size: 4, values: [2, 3], faces: [2, 3], norm: 5, floor: true,
    holes: [{ x: 3, z: 0 }, { x: 1, z: 2 }, { x: 2, z: 2 }],
    layout: {
      start: { x: 2, z: 3 },
      dice: [
        { x: 2, z: 3, top: 6, north: 3 },
        { x: 0, z: 3, top: 2, north: 1 },
        { x: 1, z: 0, top: 3, north: 1 },
        { x: 3, z: 2, top: 3, north: 1 },
        { x: 2, z: 1, top: 3, north: 1, fixed: true },
      ],
    },
    par: 3, solution: ['2,3,W', '1,0,E,p', '3,2,N,p'],
  },
  // # b # A    D2, free: down and back. A roll west: the 2s, and the die under the player is
  // # # # #    leaving. Down, round to the north of the die that shows a 3, and a push south: the
  // # c d #    3s. Up by them as they leave, a step to the last die, and a roll west puts it on
  // e # f #    the place of the die that was pushed.
  {
    ...COMMON, id: 'R14', seed: 8114, size: 4, values: [2, 3], faces: [2, 3], norm: 6, floor: true,
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
  // # # # #    D3, free: the lesson of the walk of the second edition (its R11), opened: no cell cut
  // # e b #    out, no die fixed, the floor open. One roll north makes the 3s; over them as they
  // # c d #    leave to the die beyond, and north and west put its 2 beside the 2 that stands. The
  // A # # #    floor and the push are known by now.
  {
    ...COMMON, id: 'R15', seed: 8115, size: 4, values: [3, 2], faces: [3, 2], norm: 5, floor: true,
    layout: {
      start: { x: 0, z: 3 },
      dice: [
        { x: 0, z: 3, top: 6, north: 4 },
        { x: 2, z: 1, top: 6, north: 3 },
        { x: 1, z: 2, top: 3, north: 1 },
        { x: 2, z: 2, top: 3, north: 1 },
        { x: 1, z: 1, top: 2, north: 1 },
      ],
    },
    par: 3, solution: ['0,3,N', '2,1,N', '2,0,W'],
  },
  // b # c #    D4, the mix of everything. A roll north: the 3s. Down, and a push west makes the 2s
  // # # d e    at the top. A second push brings the last die under them; up by the 2s as they
  // f # # #    leave, a step onto it, and a roll east joins it to them on the last move it can.
  // # # A #
  {
    ...COMMON, id: 'R16', seed: 8116, size: 4, values: [3, 2], faces: [3, 2], norm: 6, floor: true,
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
  { from: 0, to: 4, oneScale: true },
  { from: 5, to: 9, oneScale: false },
  { from: 10, to: 11, oneScale: false },
  { from: 12, to: 15, oneScale: false },
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
 * owner: «они скорее подсказка, а не наставление»): `R06` the chain, `R11` the walk over dice
 * that are leaving, `R13` the way down and the push.
 */
export const ROAD_HINTS: Readonly<Record<string, RoadHint>> = {
  R06: { key: 'roadHintChain', until: 'chain' },
  R11: { key: 'roadHintWalk', until: 'walk' },
  R13: { key: 'roadHintPush', until: 'push' },
};

/** A piece that has come to a dead end this many times shows the sign of the way at once: the second time is a mistake that is repeated. */
export const DEAD_ENDS_FOR_SIGN = 2;

/** What a piece does when the player waits, ms: when the plaque over the target blinks, when the sign comes, how many wasted moves bring it at once. */
type Wait = { blinkMs: number | null; signMs: number; wasted: number | null };

/**
 * The lessons whose boards are few, a few dozen each, where the way is cheap to find after every
 * move: only they count the moves that led nowhere. The lesson of the chain (`R06`) is not among
 * them: it is an open board, and waits as a free piece does.
 */
export const ROAD_LESSONS: readonly string[] = ['R01', 'R02', 'R11', 'R13'];

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
 * The edition of the road. Its pieces were given their codes anew with the second, and again
 * with the third: `R07` of the second is the lesson of the chain, of the third a free piece, so
 * what a player of an edition before has kept under those codes is brought over by board
 * (`toRoadEdition`).
 */
export const ROAD_EDITION = 3;

/** What was kept under the codes of the road: the codes of its pieces are `R` and two digits, and no level of the list has such a code. */
const ROAD_CODE = /^R\d\d$/;
/** The pieces the first edition had: a code after its last was that of one who had cleared it. */
const FIRST_EDITION_PIECES = 20;

/**
 * The boards of the second edition that are in this one, by the code each had there and the code
 * it has here. Two went between the road and the list: `R10` of the second edition is the level
 * `P08` now, and the board of `P08` is the piece `R08`.
 */
const SECOND_EDITION_BOARDS: Readonly<Record<string, string>> = {
  R01: 'R01', R02: 'R02', R03: 'R03', R04: 'R04', R06: 'R10', R09: 'R07', R10: 'P08', R12: 'R09', R17: 'R14', R18: 'R16', P08: 'R08',
};

/**
 * Where one who stood on a piece of the second edition stands on this one: on the piece of the
 * same role, the first of its block they have not played as the board it is. Its lessons are the
 * lessons here; a piece that went is followed by the one that does its work; one past the end of
 * the second edition (`R19`) is past this one.
 */
const SECOND_EDITION_PLACES: Readonly<Record<string, string>> = {
  R01: 'R01', R02: 'R02', R03: 'R03', R04: 'R04', R05: 'R05', R06: 'R05',
  R07: 'R06', R08: 'R07', R09: 'R07', R10: 'R08',
  R11: 'R11', R12: 'R12', R13: 'R12', R14: 'R12',
  R15: 'R13', R16: 'R14', R17: 'R14', R18: 'R16',
};

/** What is kept of a player that the road reads and writes: see `LevelProgress` in `src/platform/settings.ts`. */
export interface RoadKept {
  passed: Record<string, boolean>;
  stats: Record<string, unknown>;
  road?: string;
  roadEdition?: number;
}

/**
 * Brings what is kept of a player to this edition of the road; what is of this edition already
 * is given back as it is.
 *
 * From the second edition: what was passed and counted on a board that is still played goes
 * with it to its code here (`SECOND_EDITION_BOARDS`), the stars of `P08` and of `R10` among it,
 * each to where its board is now; what was of the pieces that went is dropped, and the other
 * levels of the list are left as they were. The place goes to the piece of the same role
 * (`SECOND_EDITION_PLACES`), one past the road stays past it, any other code leads to the first
 * piece.
 *
 * From the first edition, which had no mark: what was passed and counted under the codes of the
 * road is dropped, since the stars were earned on other boards. One who was on the road is put
 * on its first piece; one who had cleared it stays past it. One with no place kept has none still.
 */
export function toRoadEdition<T extends RoadKept>(kept: T): T {
  if (kept.roadEdition === ROAD_EDITION) return kept;
  const second = kept.roadEdition === 2;
  // A board kept under a code it no longer has is moved to the code it has; any other code of the road is dropped.
  const carried = <V>(all: Record<string, V>): Record<string, V> => {
    const out: Record<string, V> = {};
    for (const [code, value] of Object.entries(all ?? {})) {
      const to = second ? SECOND_EDITION_BOARDS[code] : undefined;
      if (to !== undefined) out[to] = value;
      else if (!ROAD_CODE.test(code)) out[code] = value;
    }
    return out;
  };
  const moved: T = { ...kept, passed: carried(kept.passed), stats: carried(kept.stats), roadEdition: ROAD_EDITION };
  if (kept.road !== undefined) {
    if (second) moved.road = kept.road === 'R19' ? ROAD_END : (SECOND_EDITION_PLACES[kept.road] ?? ROAD[0].id);
    else {
      const place = ROAD_CODE.test(kept.road) ? Number(kept.road.slice(1)) : 0;
      moved.road = place > FIRST_EDITION_PIECES ? ROAD_END : ROAD[0].id;
    }
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
