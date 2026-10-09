import { cutFrom, type Recipe } from './recipes';

/**
 * The places of the road that are not lessons: the free pieces and the mixes of its second
 * edition (docs/superpowers/specs/2026-10-09-vi-road-free-pieces-design.md, section 4). A lesson
 * is laid by hand and holds the player to one way; a free piece is a small level on an open
 * board, every die of it a die that rolls, and its board is looked for among the boards laid for
 * its place here (`node scripts/ladder.mjs place=R05`), as the boards of the list are. The board
 * picked is written into `road.ts`, and `road.test.ts` asks of it what its place asks.
 *
 * What every place asks: at least two first moves that keep the board in hand (`firsts`), and
 * the shares of the hasty and the casual persona that clear it. The walk over the boards a
 * player can come to (`walk.ts`) is not asked of a place: on an open board the dice can be
 * rolled anywhere and turned any way, the boards are thousands and millions, and the walk is
 * cut long before it has seen them. `R03`, `R04` and `R05` cannot be lost by what they are made
 * of (`safe`): as many dice as the one combo of their one face takes, and the floor shut.
 *
 * Five of the boards were not laid from a seed. `R13` and `R16` have what the layer of boards
 * does not lay, a stair and a fixed die. `R05`, `R08` and `R09` ask for what boards laid from a
 * seed gave none of in thousands: a first step onto another die, and a chain made with no walk
 * over dice that are leaving, which is taught a block later. Their boards were looked for among
 * boards laid by rules written for each (three 4s as a corner and a fourth die beside them; two
 * 3s side by side and two dice; two 2s apart and two dice), judged by `judge` as any board is.
 * The board picked is the `sketch` of its place, so `ladder.mjs place=` judges it with the rest.
 * The other eight are boards their places lay from a seed (`ROAD_SEEDS`).
 *
 * Three places are not met by their boards, each in one number, and nothing nearer was found:
 * the hasty persona clears `R05` and `R08` in 57 runs of a hundred where 70 are asked, and `R09`
 * has one first move that keeps it in hand where two are asked. `road.test.ts` holds the three
 * to exactly that.
 */

/** What a place of the road is: a free piece, or the mix that ends its block. */
export type RoadRole = 'free' | 'mix';
export type RoadPlace = Recipe & { id: string; role: RoadRole };

/** Three cells wide and four long: the square of four with its east column cut out. */
const LONG = cutFrom(['###.', '###.', '###.', '###.']);

/** The floors of the personas: the first block asks more of the casual one. */
const BLOCK_A = { hasty: 0.7, casual: 0.9 } as const;
const LATER = { hasty: 0.7, casual: 0.75 } as const;

const FREE = { chapter: 0, compact: false, firsts: [2, 99] } as const;

/** The seeds the boards of eight pieces were laid from by their places: above ten thousand from a solution, above thirty thousand from a route. */
export const ROAD_SEEDS: Readonly<Record<string, number>> = { R03: 10393, R04: 261, R06: 10307, R10: 10110, R12: 11400, R14: 10154, R17: 30503, R18: 30547 };

export const ROAD_PLACES: readonly RoadPlace[] = [
  {
    ...FREE, slot: 3, id: 'R03', role: 'free', size: 3, dice: 2, faces: [2], par: [1, 2], floor: false, safe: true, personas: BLOCK_A,
    brief: 'the first freedom: two dice, a pair of 2s, and the 2 of the own die on a side the player sees',
  },
  {
    ...FREE, slot: 4, id: 'R04', role: 'free', size: 4, holes: LONG, dice: 3, faces: [3], standing: [{ value: 3, count: 2 }], par: [1, 2], floor: false, safe: true, personas: BLOCK_A,
    brief: 'three 3s of dice that all roll: two stand side by side, the own one is off to a side',
  },
  {
    ...FREE, slot: 5, id: 'R05', role: 'free', size: 4, dice: 4, faces: [4], standing: [{ value: 4, count: 3 }], par: [2, 3], floor: false, safe: true, walk: true, personas: BLOCK_A,
    sketch: [{ start: { x: 2, z: 2 }, dice: [{ x: 2, z: 2, top: 4, north: 1 }, { x: 1, z: 2, top: 2, north: 6 }, { x: 3, z: 2, top: 4, north: 1 }, { x: 3, z: 1, top: 4, north: 1 }] }],
    brief: 'as many dice as pips: three 4s as a corner, and the fourth is a die the player steps to and rolls',
  },
  {
    ...FREE, slot: 6, id: 'R06', role: 'mix', size: 4, dice: 5, faces: [2, 3], par: [3, 4], floor: false, avoid: ['link', 'glass'], kinds: ['top'], personas: BLOCK_A,
    brief: 'two combos one after the other, in either order, and no chain',
  },
  {
    ...FREE, slot: 8, id: 'R08', role: 'free', size: 4, dice: 4, faces: [2], par: [2, 3], floor: false, shows: ['link'], kinds: ['top'], avoid: ['glass'], personas: LATER,
    sketch: [{ start: { x: 0, z: 1 }, dice: [{ x: 0, z: 1, top: 4, north: 1 }, { x: 1, z: 1, top: 4, north: 1 }, { x: 2, z: 0, top: 2, north: 4 }, { x: 2, z: 2, top: 2, north: 6 }] }],
    brief: 'the chain as a gain: two pairs apart, or a pair and the two others brought to it',
  },
  {
    ...FREE, slot: 9, id: 'R09', role: 'free', size: 4, dice: 4, faces: [3], par: [2, 3], floor: false, needs: ['link'], kinds: ['top'], avoid: ['glass'], personas: LATER,
    sketch: [{ start: { x: 1, z: 3 }, dice: [{ x: 1, z: 3, top: 2, north: 4 }, { x: 1, z: 0, top: 3, north: 6 }, { x: 1, z: 1, top: 3, north: 6 }, { x: 2, z: 2, top: 2, north: 4 }] }],
    brief: 'three 3s and one more: the board is not cleared without the chain',
  },
  {
    ...FREE, slot: 10, id: 'R10', role: 'mix', size: 4, dice: 6, faces: [2, 3], par: [3, 4], floor: false, shows: ['link'], kinds: ['top'], avoid: ['glass'],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 2, by: 'roll', moves: [1, 2] }, { event: 'link', face: 2, by: 'roll' }],
    personas: LATER,
    brief: 'two faces in either order, and the chain is the shorter of two whole ways',
  },
  {
    ...FREE, slot: 12, id: 'R12', role: 'free', size: 4, dice: 5, faces: [3, 2], par: [3, 3], floor: false, avoid: ['link', 'glass'], kinds: ['bridge'], personas: LATER,
    brief: 'the bridge as a short cut: the second combo is come to over the first as it leaves, or round it in a move more',
  },
  {
    ...FREE, slot: 13, id: 'R13', role: 'free', size: 4, dice: 4, faces: [3], par: [2, 3], floor: true, personas: LATER,
    // A stair as the first edition had it (its R14), on a board with nothing cut out and no die fixed; the die of the stair is the first of the four.
    // That piece itself, opened, is cleared in one move: its dice were laid again, by the rule of the stair and two 3s side by side.
    sketch: [{ start: { x: 0, z: 3 }, onFloor: true, leaving: [{ die: 0, moves: 1 }], dice: [{ x: 0, z: 2, top: 6, north: 2 }, { x: 0, z: 1, top: 4, north: 6 }, { x: 3, z: 2, top: 3, north: 1 }, { x: 3, z: 3, top: 3, north: 1 }] }],
    brief: 'the stair again: up from the floor by a die that is leaving, onto an open board',
  },
  {
    ...FREE, slot: 14, id: 'R14', role: 'mix', size: 4, dice: 6, faces: [3, 2], par: [3, 4], floor: false, shows: ['link'], ends: { event: 'link' }, kinds: ['bridge'], personas: LATER,
    brief: 'everything so far: two faces, the walk over a combo that is leaving, and the chain last',
  },
  {
    ...FREE, slot: 16, id: 'R16', role: 'free', size: 4, dice: 3, faces: [3], par: [2, 2], floor: true, personas: LATER,
    // Two dice that show their 3s and a fixed 3 they are pushed to, from the floor the player starts on. Of the boards of that kind
    // the one picked has no wrong push: a die pushed the wrong way on an open board is often lost, and the level does not say so.
    sketch: [{ start: { x: 1, z: 3 }, onFloor: true, dice: [{ x: 2, z: 0, top: 3, north: 1 }, { x: 0, z: 2, top: 3, north: 1 }, { x: 1, z: 1, top: 3, north: 1, fixed: true }] }],
    brief: 'what to push: a push does not turn a die, and two dice go to the one that waits in either order',
  },
  {
    ...FREE, slot: 17, id: 'R17', role: 'free', size: 4, dice: 6, faces: [2, 3], par: [3, 4], floor: true, needs: ['floor'],
    scenes: [{ event: 'combo', face: 2, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 3, by: 'push', apart: true }, { event: 'link', face: 3, by: 'roll', moves: [1, 2] }],
    kinds: ['downAndUp'], route: 'P.*\\^', personas: LATER,
    brief: 'down and back: a pair lets the player down, a push makes the 3s, and they are the way up to the last die',
  },
  {
    ...FREE, slot: 18, id: 'R18', role: 'mix', size: 4, dice: 6, faces: [3, 2], par: [4, 5], floor: true, needs: ['floor'],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 2, by: 'push', apart: true }, { event: 'link', face: 2, by: 'roll', moves: [1, 2] }],
    kinds: ['downAndUp'], route: 'P.*\\^', ends: { event: 'link' }, personas: LATER,
    brief: 'everything: the 3s, down, a push that makes the 2s, up by them, and the chain last',
  },
];
