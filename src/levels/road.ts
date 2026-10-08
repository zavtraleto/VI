import type { Dir, LevelSpec } from '../rules/types';

/**
 * The road: the boards one who is new is led through before the levels of the list, played with
 * no word said and joined one to the next, so that they are one board that goes on. Each is a
 * piece: a level as any is, on a board of its own, laid with its start on the cell the player
 * stood on when the piece before was cleared. They are not in the list of the levels
 * (`levels.ts`).
 *
 * The road is four blocks (`ROAD_BLOCKS`). The first, `R01` to `R07`, teaches the roll, the faces
 * and the combo; the second, `R08` to `R12`, two combos one after the other and the chain; the
 * third, `R13` to `R16`, the walk over dice that are leaving; the fourth, `R17` to `R20`, the push
 * from the floor. A block after the first is a piece that teaches its move and cannot be cleared
 * without it, two easy pieces, and a piece that mixes what has been taught; `R08` comes before
 * the first of those lessons. The pieces are small and their ways short: the owner asked for
 * all of it to be elementary.
 *
 * The first block cannot be lost. The dice that wait for the player are fixed, so the only die
 * that moves is their own. The player starts in the southmost row of a piece and the piece lies to the north of them and
 * to the sides: the road goes up the screen, with turns. The camera sees the south and the east
 * side of a die, and the face of the combo is on one of the two before the roll that brings it
 * up: a roll to the north brings up the south side, a roll to the west the east side. The cells
 * the die of the player can come to are a tree, so the face it shows on a cell is always the
 * same and it cannot be turned beyond repair. From every board the player can come to a piece is
 * cleared in a few moves (`road.test.ts` walks them), and `par` and `solution` are proved by the
 * solver.
 *
 * In the blocks after it a piece can come to a dead end, and a move can be taken back; it does
 * so only where a chain is asked for, since a die rolled the wrong way while a combo leaves has
 * missed it. Everywhere else every board the player can come to still leads to the cleared one.
 * Where a chain is asked for it is the last thing asked, and the dice are turned so, that a
 * board which can no longer be cleared is a dead end the level says at once: nothing is left to
 * be rolled about on with no way on. Most of the dice are fixed there too: what is free is what
 * the way of the piece rolls or pushes. A die that is to be pushed is beside no die the player
 * can stand on, so that it is never stepped onto and turned. The last roll of every die is to
 * the north or to the west, as in the first block.
 *
 * In the pictures `z` grows downwards, as the board is seen: north is up. `#` is a cell, `.`
 * a cell cut out, a digit a fixed die by its face, a letter a die of the player (`A` the one
 * they start on or by, the others in the order of the list), `s` the stair and `f` the floor
 * the player starts on. A piece lies in the middle of its square, as nearly as
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
  // . # # .    Two combos again, and the way to the second leads over the dice. A roll to the
  // 3 2 B .    west and one to the north make the 3s. The die under the player is leaving: they
  // 3 # . .    step onto the fixed 2, which stands, and from it onto the second die, which goes
  // . # A .    north and west to the other side of that 2. No chain is asked for.
  {
    ...COMMON, id: 'R08', seed: 8108, size: 4, values: [3, 2], faces: [3, 2], norm: 5, floor: false,
    holes: cutAllBut(4, [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [1, 3], [2, 3]]),
    layout: {
      start: { x: 2, z: 3 },
      dice: [
        { x: 2, z: 3, top: 5, north: 4 },
        { x: 2, z: 1, top: 4, north: 6 },
        { x: 0, z: 1, top: 3, north: 1, fixed: true },
        { x: 0, z: 2, top: 3, north: 1, fixed: true },
        { x: 1, z: 1, top: 2, north: 1, fixed: true },
      ],
    },
    par: 4, solution: ['2,3,W', '1,3,N', '2,1,N', '2,0,W'],
  },
  // . # B .    The chain. Three 2s, and a combo takes two: two rolls to the north make it, and
  // . 2 # .    the third die is a step away, to the north. One roll to the west puts it against
  // . . # .    the fixed 2 while that is leaving, and it leaves with the two. A roll the wrong
  // . . A .    way, over the die the player has left, still leaves the roll that joins.
  {
    ...COMMON, id: 'R09', seed: 8109, size: 4, values: [2], faces: [2], norm: 3, floor: false,
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
  // 4 4 4 #    A rest: three 4s in a row and the die of the player round a corner from the end
  // . . . #    of the row. East, and two rolls to the north. Nothing here can be lost.
  // . . A #
  // . . . .
  {
    ...COMMON, id: 'R10', seed: 8110, size: 4, values: [4], faces: [4], norm: 4, floor: false,
    holes: cutAllBut(4, [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 2], [3, 2]]),
    layout: {
      start: { x: 2, z: 2 },
      dice: [
        { x: 2, z: 2, top: 6, north: 2 },
        { x: 0, z: 0, top: 4, north: 1, fixed: true },
        { x: 1, z: 0, top: 4, north: 1, fixed: true },
        { x: 2, z: 0, top: 4, north: 1, fixed: true },
      ],
    },
    par: 3, solution: ['2,2,E', '3,2,N', '3,1,N'],
  },
  // . # 3 3    The chain once more, with 3s and turned on its side: two rolls north make the
  // . B # .    combo under the fixed pair, the die to add is a step to the west and one roll
  // . . # .    to the north brings its 3 up beside them.
  // . . A .
  {
    ...COMMON, id: 'R11', seed: 8111, size: 4, values: [3], faces: [3], norm: 4, floor: false,
    holes: cutAllBut(4, [[1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [2, 2], [2, 3]]),
    layout: {
      start: { x: 2, z: 3 },
      dice: [
        { x: 2, z: 3, top: 4, north: 5 },
        { x: 1, z: 1, top: 5, north: 4 },
        { x: 2, z: 0, top: 3, north: 1, fixed: true },
        { x: 3, z: 0, top: 3, north: 1, fixed: true },
      ],
    },
    par: 3, solution: ['2,3,N', '2,2,N', '1,1,N'],
  },
  // . # C .    The mix of the block, and the chain comes last, so that a chain that is missed
  // 3 3 # 2    is said at once. A roll north: the 2s. A step west to the second die and a roll
  // . . B #    north: the 3s. A step north to the third and a roll west: it joins the 3s as
  // . . . A    they leave.
  {
    ...COMMON, id: 'R12', seed: 8112, size: 4, values: [2, 3], faces: [2, 3], norm: 6, floor: false,
    holes: cutAllBut(4, [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2], [3, 2], [3, 3]]),
    layout: {
      start: { x: 3, z: 3 },
      dice: [
        { x: 3, z: 3, top: 4, north: 5 },
        { x: 2, z: 2, top: 6, north: 4 },
        { x: 2, z: 0, top: 6, north: 5 },
        { x: 3, z: 1, top: 2, north: 1, fixed: true },
        { x: 0, z: 1, top: 3, north: 1, fixed: true },
        { x: 1, z: 1, top: 3, north: 1, fixed: true },
      ],
    },
    par: 3, solution: ['3,3,N', '2,2,N', '2,0,W'],
  },
  // 2 # # .    The walk. One roll north makes the 3s, and the die that is to make the 2s is at
  // . . B .    the far end of them: the only way to it is over the dice that are leaving. Steps
  // # 3 3 .    are no moves, so the dice wait while the player walks. Then north and west.
  // A . . .
  {
    ...COMMON, id: 'R13', seed: 8113, size: 4, values: [3, 2], faces: [3, 2], norm: 5, floor: false,
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
  // 3 # # .    A rest, with a stair: the player on the floor, a die half down to the north of
  // 3 . A .    them, their own die beyond it. Up, over, a roll north and a roll west to the 3s.
  // . . s .
  // . . f .
  {
    ...COMMON, id: 'R14', seed: 8114, size: 4, values: [3], faces: [3], norm: 4, floor: true,
    holes: cutAllBut(4, [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [2, 2], [2, 3]]),
    layout: {
      start: { x: 2, z: 3 }, onFloor: true, leaving: [{ die: 0, moves: 1 }],
      dice: [
        { x: 2, z: 2, top: 6, north: 2 },
        { x: 2, z: 1, top: 5, north: 1 },
        { x: 0, z: 0, top: 3, north: 1, fixed: true },
        { x: 0, z: 1, top: 3, north: 1, fixed: true },
      ],
    },
    par: 2, solution: ['2,1,N', '2,0,W'],
  },
  // 4 4 . .    A rest, with the walk: a roll north makes the 2s, the player walks over the fixed
  // # 4 . .    one of them to the second die, and one roll north fills the corner of the 4s.
  // B 2 # .
  // . . A .
  {
    ...COMMON, id: 'R15', seed: 8115, size: 4, values: [2, 4], faces: [2, 4], norm: 6, floor: false,
    holes: cutAllBut(4, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2], [2, 3]]),
    layout: {
      start: { x: 2, z: 3 },
      dice: [
        { x: 2, z: 3, top: 6, north: 5 },
        { x: 0, z: 2, top: 6, north: 3 },
        { x: 1, z: 2, top: 2, north: 1, fixed: true },
        { x: 0, z: 0, top: 4, north: 1, fixed: true },
        { x: 1, z: 0, top: 4, north: 1, fixed: true },
        { x: 1, z: 1, top: 4, north: 1, fixed: true },
      ],
    },
    par: 2, solution: ['2,3,N', '0,2,N'],
  },
  // . . # C    The mix of the block. A roll north: the 3s. Over the two that waited, which are
  // . . 2 #    leaving, to the die at their far end, and a roll north: the 2s. A step north to
  // # 3 3 B    the third die and a roll west: it joins the 2s as they leave.
  // A . . .
  {
    ...COMMON, id: 'R16', seed: 8116, size: 4, values: [3, 2], faces: [3, 2], norm: 6, floor: false,
    holes: cutAllBut(4, [[2, 0], [3, 0], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [0, 3]]),
    layout: {
      start: { x: 0, z: 3 },
      dice: [
        { x: 0, z: 3, top: 5, north: 4 },
        { x: 3, z: 2, top: 4, north: 5 },
        { x: 3, z: 0, top: 6, north: 3 },
        { x: 1, z: 2, top: 3, north: 1, fixed: true },
        { x: 2, z: 2, top: 3, north: 1, fixed: true },
        { x: 2, z: 1, top: 2, north: 1, fixed: true },
      ],
    },
    par: 3, solution: ['0,3,N', '3,2,N', '3,0,W'],
  },
  // 3 . . .    The push. A roll north makes the 2s, and the die under the player is leaving:
  // 3 . . 2    nothing is left to roll. A step to the west is the floor, and from the floor the
  // # B # #    die that shows a 3 is pushed west, to the fixed 3s. No step leads onto that die,
  // . . . A    so it cannot be turned, and no push but this one can be made.
  {
    ...COMMON, id: 'R17', seed: 8117, size: 4, values: [2, 3], faces: [2, 3], norm: 5, floor: true,
    holes: cutAllBut(4, [[0, 0], [0, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [3, 3]]),
    layout: {
      start: { x: 3, z: 3 },
      dice: [
        { x: 3, z: 3, top: 4, north: 5 },
        { x: 1, z: 2, top: 3, north: 1 },
        { x: 3, z: 1, top: 2, north: 1, fixed: true },
        { x: 0, z: 0, top: 3, north: 1, fixed: true },
        { x: 0, z: 1, top: 3, north: 1, fixed: true },
      ],
    },
    par: 2, solution: ['3,3,N', '1,2,W,p'],
  },
  // . . 3 .    A rest: the player starts on the floor, and two dice that show 3s are pushed
  // . # # .    north, one after the other, up to the fixed 3. Neither can go anywhere else.
  // . A B .
  // . f # .
  {
    ...COMMON, id: 'R18', seed: 8118, size: 4, values: [3], faces: [3], norm: 3, floor: true,
    holes: cutAllBut(4, [[2, 0], [1, 1], [2, 1], [1, 2], [2, 2], [1, 3], [2, 3]]),
    layout: {
      start: { x: 1, z: 3 }, onFloor: true,
      dice: [
        { x: 1, z: 2, top: 3, north: 1 },
        { x: 2, z: 2, top: 3, north: 1 },
        { x: 2, z: 0, top: 3, north: 1, fixed: true },
      ],
    },
    par: 2, solution: ['1,2,N,p', '2,2,N,p'],
  },
  // 4 4 # .    A rest: a roll north makes the 2s, a step east is the floor, and the die that
  // 4 . B .    shows a 4 is pushed north to the end of the fixed 4s.
  // 2 # # .
  // . A . .
  {
    ...COMMON, id: 'R19', seed: 8119, size: 4, values: [2, 4], faces: [2, 4], norm: 6, floor: true,
    holes: cutAllBut(4, [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2], [1, 3]]),
    layout: {
      start: { x: 1, z: 3 },
      dice: [
        { x: 1, z: 3, top: 6, north: 5 },
        { x: 2, z: 1, top: 4, north: 1 },
        { x: 0, z: 2, top: 2, north: 1, fixed: true },
        { x: 0, z: 0, top: 4, north: 1, fixed: true },
        { x: 1, z: 0, top: 4, north: 1, fixed: true },
        { x: 0, z: 1, top: 4, north: 1, fixed: true },
      ],
    },
    par: 2, solution: ['1,3,N', '2,1,N,p'],
  },
  // . . # 2 .    Everything. West and north: the 3s. Over the two that waited, which are leaving,
  // . . B # .    and down to the floor beyond them. The die that shows a 2 is pushed north to the
  // . . . C .    fixed 2. Up onto it as it leaves, a step west to the last die, and a roll north:
  // # 3 3 # .    it joins the 2s. The chain comes last, so a chain that is missed is said at once.
  // # A . . .
  {
    ...COMMON, id: 'R20', seed: 8120, size: 5, values: [3, 2], faces: [3, 2], norm: 6, floor: true,
    holes: cutAllBut(5, [[2, 0], [3, 0], [2, 1], [3, 1], [3, 2], [0, 3], [1, 3], [2, 3], [3, 3], [0, 4], [1, 4]]),
    layout: {
      start: { x: 1, z: 4 },
      dice: [
        { x: 1, z: 4, top: 5, north: 4 },
        { x: 2, z: 1, top: 6, north: 5 },
        { x: 3, z: 2, top: 2, north: 1 },
        { x: 1, z: 3, top: 3, north: 1, fixed: true },
        { x: 2, z: 3, top: 3, north: 1, fixed: true },
        { x: 3, z: 0, top: 2, north: 1, fixed: true },
      ],
    },
    par: 4, solution: ['1,4,W', '0,4,N', '3,2,N,p', '2,1,N'],
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
  { from: 0, to: 6, oneScale: true },
  { from: 7, to: 11, oneScale: false },
  { from: 12, to: 15, oneScale: false },
  { from: 16, to: 19, oneScale: false },
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
 * owner: «они скорее подсказка, а не наставление»): `R09` the chain, `R13` the walk over dice
 * that are leaving, `R17` the push.
 */
export const ROAD_HINTS: Readonly<Record<string, RoadHint>> = {
  R09: { key: 'roadHintChain', until: 'chain' },
  R13: { key: 'roadHintWalk', until: 'walk' },
  R17: { key: 'roadHintPush', until: 'push' },
};

/** A piece that has come to a dead end this many times shows the sign of the way at once: the second time is a mistake that is repeated. */
export const DEAD_ENDS_FOR_SIGN = 2;

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
