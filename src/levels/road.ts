import type { Dir, LevelSpec } from '../rules/types';

/**
 * The road: the boards one who is new is led through before the levels of the list, played with
 * no word said and joined one to the next, so that they are one board that goes on. Each is a
 * piece: a level as any is, on a board of its own, laid with its start on the cell the player
 * stood on when the piece before was cleared. They are not in the list of the levels
 * (`levels.ts`).
 *
 * This is the prologue of the campaign of the second edition
 * (docs/superpowers/specs/2026-10-14-vi-campaign-2-design.md, sections 4.1 and 5): seven pieces in two
 * blocks (`ROAD_BLOCKS`), set by the owner's notes of 14 October 2026. `R01` to `R05` teach the roll,
 * the faces, the combo and the choice of the first die; `R07` the chain, and `R08` is the reward after
 * it. The nine pieces the road had besides are in spare (`ROAD_SPARES`): boards that the chapters of
 * the campaign take by their thought (`campaign.ts`), each under its code still.
 *
 * A lesson is the piece that brings a move, with a line above the board. `R01` and `R02` are
 * boards cut to few cells, and neither can be lost: the dice that wait are fixed. The lesson of
 * the chain (`R06`) is an open board of three dice that all roll: the first pair is the player's
 * own to find, and the chain missed leaves one die alone, a dead end said at once. The lesson of
 * the way down and up (`R10`) is a whole board with its two 2s that wait fixed, and can be lost
 * (the owner, 12 October: «сделай урок R10 таким, в котором можно проиграть»). The lesson of the
 * push (`R13`) is a whole board too, its one fixed die the 3 the two 3s are pushed to: a push
 * amiss can lose it, and is taken back. The camera sees the south and the east side of a die, and the face of a lesson's combo
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
  // . . 3 # # . .    A2, a lesson. The player on the floor, and to the north of them a stair of two
  // . . 3 . # . .    dice: the lower laid as leaving in one move, near the floor, the upper in two,
  // . . . . # . .    half way up. Up them to the own die beyond. It rides three cells north with the
  // . . . . A . .    3 on its east side all the way, and the turn to the west brings the 3 up beside
  // . . . . t . .    the two that wait. The lower stair goes with the first roll and the upper comes
  // . . . . s . .    down to where the lower was; with the second it goes too. The stair of two is
  // . . . . f . .    the owner's of 12 October; the strip is a cell longer for it, on a square of seven.
  {
    ...COMMON, id: 'R02', seed: 8102, size: 7, values: [3], faces: [3], norm: 5, floor: true,
    holes: cutAllBut(7, [[2, 0], [3, 0], [4, 0], [2, 1], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6]]),
    layout: {
      start: { x: 4, z: 6 }, onFloor: true, leaving: [{ die: 0, moves: 1 }, { die: 1, moves: 2 }],
      dice: [
        { x: 4, z: 5, top: 6, north: 2 },
        { x: 4, z: 4, top: 6, north: 2 },
        { x: 4, z: 3, top: 1, north: 2 },
        { x: 2, z: 0, top: 3, north: 1, fixed: true },
        { x: 2, z: 1, top: 3, north: 1, fixed: true },
      ],
    },
    par: 4, solution: ['4,3,N', '4,2,N', '4,1,N', '4,0,W'],
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
  // . . . .    A5, free: the board that was R08 of the second edition, turned half round, with the
  // # d # #    row no way used cut off. The player starts on the die a cell west of the east edge,
  // # # A b    nearer the middle (the owner, 14 October 2026): the first die to roll is the one beside,
  // # c # #    whose 2 is on its east side, where it is seen. A step east, north and west: the 2s at
  //            the top. A step back to the die of the start and a roll west joins it and the 2 below
  //            to the pair as it leaves. Two pairs one after the other clear the board as well, in
  //            five moves: the chain is a gain and not a must.
  {
    ...COMMON, id: 'R05', seed: 8105, size: 4, values: [2], faces: [2], norm: 4, floor: false,
    holes: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }, { x: 3, z: 0 }],
    layout: { start: { x: 2, z: 2 }, dice: [{ x: 2, z: 2, top: 4, north: 6 }, { x: 3, z: 2, top: 4, north: 6 }, { x: 1, z: 3, top: 2, north: 3 }, { x: 1, z: 1, top: 2, north: 1 }] },
    par: 3, solution: ['3,2,N', '3,1,W', '2,2,W'],
  },
  // # B # A    B2, the chain again, on an open board and with no line: three 2s, every die one that
  // C # # #    rolls, and a combo takes two. The 2 of the die under the player is on its south side:
  // # # # #    south and twice west put it under the 2 that stands, and the pair goes. The third die
  // # # # #    is then a step away, and one roll north joins it to the pair as it leaves. Two pairs
  //            cannot be made of three: without the chain one die is left alone, a dead end said at
  //            once. It was the lesson of the chain, the first of the block, until 12 October 2026.
  {
    ...COMMON, id: 'R07', seed: 8107, size: 4, values: [2], faces: [2], norm: 3, floor: false,
    layout: { start: { x: 3, z: 0 }, dice: [{ x: 3, z: 0, top: 4, north: 5 }, { x: 1, z: 0, top: 2, north: 1 }, { x: 0, z: 1, top: 6, north: 5 }] },
    par: 4, solution: ['3,0,S', '3,1,W', '2,1,W', '0,1,N'],
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
];

/**
 * The pieces the road had that the prologue has not: boards in spare, each the board it was, that the
 * chapters of the campaign take by their thought. In the order of their codes.
 */
export const ROAD_SPARES: readonly LevelSpec[] = [
  // # b # #    B1, the first board of the chain, and the line of it stands over this one: 3s and one
  // # c # #    over. Two 3s stand in a column, and two dice show 2s with their 3s on the south side.
  // # # d #    A roll north under the column: the 3s go. The fourth die is a step to the east, and
  // # A # #    one roll north puts it against them while they leave. Within a few moves nothing
  //            clears the board but the chain. It was the piece after the lesson until 12 October
  //            2026, when the owner had the two change places.
  {
    ...COMMON, id: 'R06', seed: 8106, size: 4, values: [3], faces: [3], norm: 4, floor: false,
    layout: { start: { x: 1, z: 3 }, dice: [{ x: 1, z: 3, top: 2, north: 4 }, { x: 1, z: 0, top: 3, north: 6 }, { x: 1, z: 1, top: 3, north: 6 }, { x: 2, z: 2, top: 2, north: 4 }] },
    par: 2, solution: ['1,3,N', '2,2,N'],
  },
  // # # b c    B4, the mix of the block: two faces, two combos, either first. The die under the
  // # # # A    player has a 3 on its east side: a roll west and the 3s go. The die to the south of
  // # # d e    it then makes the 2s in two rolls, round the 2 that waits.
  // # # # #
  {
    ...COMMON, id: 'R09', seed: 8109, size: 4, values: [3, 2], faces: [3, 2], norm: 5, floor: false,
    layout: {
      start: { x: 3, z: 1 },
      dice: [{ x: 3, z: 1, top: 6, north: 5 }, { x: 2, z: 0, top: 3, north: 5 }, { x: 3, z: 0, top: 3, north: 5 }, { x: 2, z: 2, top: 6, north: 4 }, { x: 3, z: 2, top: 2, north: 6 }],
    },
    par: 3, solution: ['3,1,W', '2,2,S', '2,3,E'],
  },
  // # # # #    C1, the lesson of the way down and up, on a whole board. One roll north makes the 2s with
  // 2 # s B    the 2 that waits, and the player stands on a die that is leaving. The die that is to make
  // # # # #    the other 2s is off to the east, beside no die of the pair: no step over the dice leads to
  // A 2 # #    it. Down to the floor, along it to the stair, a die laid as leaving in two moves that
  //            still stands after the first, up it, a step onto the die, and three rolls, south and
  //            twice west, bring its 2 up beside the 2 that waits in the south row. The stair goes
  //            with the first of them. The lesson of the walk of the third edition went: the walk is
  //            done from the fifth piece on (the owner, 12 October). The cells cut out of it were
  //            given back by the word of the owner of 12 October, so that it can be lost: the own die
  //            rolled about the floor can leave a 2 with no pair. Since 12 October 2026 the 2 that
  //            waits stands at (1,3), not (2,0): there the board has no way round without the floor
  //            at all (the campaign, docs/superpowers/specs/2026-10-12-vi-campaign-design.md, section 6).
  {
    ...COMMON, id: 'R10', seed: 8110, size: 4, values: [2], faces: [2], norm: 5, floor: true,
    layout: {
      start: { x: 0, z: 3 }, leaving: [{ die: 4, moves: 2 }],
      dice: [
        { x: 0, z: 3, top: 6, north: 5 },
        { x: 0, z: 1, top: 2, north: 1, fixed: true },
        { x: 3, z: 1, top: 4, north: 5 },
        { x: 1, z: 3, top: 2, north: 1, fixed: true },
        { x: 2, z: 1, top: 6, north: 3 },
      ],
    },
    par: 4, solution: ['0,3,N', '3,1,S', '3,2,W', '2,2,W'],
  },
  // b # # A    C2, free: the walk as a short cut. Two rolls west bring a 3 up over the column of
  // # c # #    3s. The die that makes the 2s is at the foot of that column: three moves by the walk
  // d e # #    over the 3s as they leave, four by the way round them. Not hurrying pays. It was R09
  // # # # #    of the third edition, in the block of the chain; it is two combos and the walk, and
  //            came here, after the lesson of the walk, by the word of the owner of 12 October.
  {
    ...COMMON, id: 'R11', seed: 8111, size: 4, values: [3, 2], faces: [3, 2], norm: 5, floor: false,
    layout: {
      start: { x: 3, z: 0 },
      dice: [{ x: 3, z: 0, top: 4, north: 6 }, { x: 0, z: 0, top: 2, north: 3 }, { x: 1, z: 1, top: 3, north: 6 }, { x: 0, z: 2, top: 6, north: 5 }, { x: 1, z: 2, top: 3, north: 5 }],
    },
    par: 3, solution: ['3,0,W', '2,0,W', '0,2,N'],
  },
  // b # # #    C3, the mix of the block: a bridge over a long combo. A roll north makes the 3s, a row
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
  // # C # #    D1, the lesson of the way down and of the push, on a whole board. A roll west makes
  // # # 3 #    the 2s in the corner, and the die under the player is leaving: a step off it is a step
  // # # # D    down. Two dice show their 3s and are pushed to the 3 that waits, one north and one
  // B # A #    east, in either order: the one beyond the 2s is come to over them while they leave.
  //            The cells cut out of it were given back by the word of the owner of 12 October, the
  //            dice where they were: on the floor there are other pushes now, some of them lead to a
  //            dead end, and a move taken back undoes it.
  {
    ...COMMON, id: 'R13', seed: 8113, size: 4, values: [2, 3], faces: [2, 3], norm: 5, floor: true,
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
  { from: 5, to: 6, oneScale: false },
];

/** The block the piece at this place of the road is in; null for a place that is in none. */
export function blockOf(index: number): RoadBlock | null {
  return ROAD_BLOCKS.find((block) => index >= block.from && index <= block.to) ?? null;
}

/** The sign a piece opens with, if any: the direction the swipe sign shows from the first frame. */
export const ROAD_SIGNS: Readonly<Record<string, Dir | undefined>> = { R01: 'N' };

/** The hints of the texts (`src/ui/i18n.ts`) that a piece can show before its board. */
export type RoadHintKey = 'roadHintChain' | 'roadHintWalk' | 'roadHintPush' | 'roadHintClimb';

export interface RoadHint {
  /** The key of the hint, in the seven languages. */
  key: RoadHintKey;
}

/**
 * The pieces that teach a move show a hint before the board, in a window of its own, once for a
 * player (the owner, 15 October 2026). In the prologue only the lesson of the chain (`R07`) does;
 * the hints of the chapters stand by the codes of their boards in `HINTS` (`src/levels/campaign.ts`).
 */
export const ROAD_HINTS: Readonly<Record<string, RoadHint>> = {
  R07: { key: 'roadHintChain' },
};

/** A piece that has come to a dead end this many times shows the sign of the way at once: the second time is a mistake that is repeated. */
export const DEAD_ENDS_FOR_SIGN = 2;

/** What a piece does when the player waits, ms: when the plaque over the target blinks, when the sign comes, how many wasted moves bring it at once. */
type Wait = { blinkMs: number | null; signMs: number; wasted: number | null };

/**
 * The lessons whose boards are few, a few dozen each, where the way is cheap to find after every
 * move: only they count the moves that led nowhere. The lesson of the chain (`R07`) is not among
 * them: it is an open board, and waits as a free piece does.
 */
export const ROAD_LESSONS: readonly string[] = ['R01', 'R02'];

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

/** The code kept for one who has cleared the last piece: they are past the road. No piece has it. */
export const ROAD_END = 'R00';

/** The code kept for one who has cleared the piece at this place: that of the piece after it, and after the last the end of the road. */
export function pieceAfter(index: number): string {
  return ROAD[index + 1]?.id ?? ROAD_END;
}

/**
 * Where one who passed the first level of the build before the road stands: it was what the
 * first block is, so they stand at the piece after the block, the lesson of the chain.
 */
export const FIRST_PASSED = ROAD[ROAD_BLOCKS[0].to + 1].id;

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
 * The edition of the road. Its pieces were given their codes anew with every edition up to the
 * sixth, and what was kept under them was brought over board by board. The seventh is the prologue
 * of the campaign of the second edition: from it the progress starts again, by the word of the owner
 * of 14 October 2026 («переносить сейчас можно всё… игра ещё не в релизе»). An edition after it
 * decides for itself what it brings over.
 */
export const ROAD_EDITION = 7;

/** What is kept of a player that the road reads and writes: see `LevelProgress` in `src/platform/settings.ts`. */
export interface RoadKept {
  passed: Record<string, boolean>;
  stats: Record<string, unknown>;
  road?: string;
  roadEdition?: number;
}

/**
 * Brings what is kept of a player to this edition of the road; what is of this edition already
 * is given back as it is. From any edition before the seventh nothing is brought over: what was
 * passed and counted and the place on the road are dropped, and the rest of what is kept (what
 * the player has been told) stays.
 */
export function toRoadEdition<T extends RoadKept>(kept: T): T {
  if (kept.roadEdition === ROAD_EDITION) return kept;
  return { ...kept, passed: {}, stats: {}, road: undefined, roadEdition: ROAD_EDITION };
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
