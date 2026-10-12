import { cutFrom, type Recipe } from './recipes';

/**
 * The places of the road that are not lessons: the free pieces and the mixes of its fourth
 * edition (docs/superpowers/specs/2026-10-09-vi-road-free-pieces-design.md, sections 4, 15 and 16). A
 * lesson is laid by hand and holds the player to its move; a free piece is a small level on an
 * open board, every die of it a die that rolls, and its board is looked for among the boards
 * laid for its place here (`node scripts/ladder.mjs place=R05`), as the boards of the list are.
 * The board picked is written into `road.ts`, and `road.test.ts` asks of it what its place asks.
 *
 * What every place asks: at least two first moves that keep the board in hand (`firsts`), and
 * the shares of the hasty and the casual persona that clear it. The walk over the boards a
 * player can come to (`walk.ts`) is not asked of a place: on an open board the dice can be
 * rolled anywhere and turned any way, the boards are thousands and millions, and the walk is
 * cut long before it has seen them. `R03` and `R04` cannot be lost by what they are made of
 * (`safe`): as many dice as the one combo of their one face takes, and the floor shut.
 *
 * Seven boards are the ones their places lay from a seed (`ROAD_SEEDS`). A place keeps the number
 * (`slot`) it had in the edition its board was laid in: the seed lays with it. The other four are
 * the `sketch` of their place, judged by `judge` as any board is: `R05` is `R08` of the second
 * edition turned half round, `R07` was laid by hand for the second edition (its `R09`), `R08` is
 * the board of `P08` of the list, and `R15` is the lesson of the walk of the second edition
 * opened, with the 2 that waits moved a cell so that two first moves keep it in hand.
 *
 * Where a board misses what its place asks, in one number, `road.test.ts` holds it to exactly
 * that (`MISSES` there): the owner chose those boards by name.
 */

/** What a place of the road is: a free piece, or the mix that ends its block. */
export type RoadRole = 'free' | 'mix';
export type RoadPlace = Recipe & { id: string; role: RoadRole };

/** Three cells wide and four long: the square of four with its east column cut out. */
const LONG = cutFrom(['###.', '###.', '###.', '###.']);
/** Four cells wide and three long: the square of four with its north row cut off. */
const WIDE = cutFrom(['....', '####', '####', '####']);

/** The floors of the personas: the first block asks more of the casual one. */
const BLOCK_A = { hasty: 0.7, casual: 0.9 } as const;
const LATER = { hasty: 0.7, casual: 0.75 } as const;

const FREE = { chapter: 0, compact: false, firsts: [2, 99] } as const;

/** The seeds the boards of seven pieces were laid from by their places: above ten thousand from a solution, above thirty thousand from a route. */
export const ROAD_SEEDS: Readonly<Record<string, number>> = { R03: 10393, R04: 261, R09: 10307, R11: 11400, R12: 11118, R14: 30503, R16: 30547 };

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
    ...FREE, slot: 5, id: 'R05', role: 'free', size: 4, holes: WIDE, dice: 4, faces: [2], par: [2, 3], floor: false, shows: ['link'], kinds: ['top'], avoid: ['glass'], personas: BLOCK_A,
    // R08 of the second edition turned half round, the 2 of the own die on its east side, and the row no way used cut off.
    sketch: [{ start: { x: 3, z: 2 }, dice: [{ x: 3, z: 2, top: 4, north: 6 }, { x: 2, z: 2, top: 4, north: 6 }, { x: 1, z: 3, top: 2, north: 3 }, { x: 1, z: 1, top: 2, north: 1 }] }],
    brief: 'two pairs of 2s, or a pair and the two others brought to it: the chain is a gain, not a must',
  },
  {
    ...FREE, slot: 7, id: 'R07', role: 'free', size: 4, dice: 4, faces: [3], par: [2, 3], floor: false, needs: ['link'], kinds: ['top'], avoid: ['glass'], personas: LATER,
    sketch: [{ start: { x: 1, z: 3 }, dice: [{ x: 1, z: 3, top: 2, north: 4 }, { x: 1, z: 0, top: 3, north: 6 }, { x: 1, z: 1, top: 3, north: 6 }, { x: 2, z: 2, top: 2, north: 4 }] }],
    brief: 'three 3s and one more: the board is not cleared without the chain',
  },
  {
    ...FREE, slot: 8, id: 'R08', role: 'free', size: 4, dice: 5, faces: [2], par: [4, 6], floor: false, shows: ['link'], kinds: ['top'], avoid: ['glass'], personas: LATER,
    // The board of P08 of the list (levels.ts), a long chain, as the owner chose it for the road on 11 October.
    sketch: [{ start: { x: 3, z: 0 }, dice: [{ x: 3, z: 0, top: 5, north: 6 }, { x: 0, z: 0, top: 3, north: 2 }, { x: 1, z: 1, top: 2, north: 1 }, { x: 0, z: 2, top: 3, north: 6 }, { x: 2, z: 2, top: 6, north: 5 }] }],
    brief: 'a long chain: a pair, and one die after another brought to it while it leaves',
  },
  {
    ...FREE, slot: 6, id: 'R09', role: 'mix', size: 4, dice: 5, faces: [2, 3], par: [3, 4], floor: false, avoid: ['link', 'glass'], kinds: ['top'], personas: LATER,
    brief: 'two combos one after the other, in either order, and no chain',
  },
  {
    ...FREE, slot: 12, id: 'R11', role: 'free', size: 4, dice: 5, faces: [3, 2], par: [3, 3], floor: false, avoid: ['link', 'glass'], kinds: ['bridge'], personas: LATER,
    brief: 'the bridge as a short cut: the second combo is come to over the first as it leaves, or round it in a move more',
  },
  {
    ...FREE, slot: 12, id: 'R12', role: 'mix', size: 4, dice: 6, faces: [3, 2], par: [3, 4], floor: false, shows: ['link'], ends: { event: 'link' }, kinds: ['bridge'], avoid: ['glass'], personas: LATER,
    brief: 'a bridge over a long combo: three dice leaving, and the die of the last combo beyond them; the chain last',
  },
  {
    ...FREE, slot: 17, id: 'R14', role: 'free', size: 4, dice: 6, faces: [2, 3], par: [3, 4], floor: true, needs: ['floor'],
    scenes: [{ event: 'combo', face: 2, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 3, by: 'push', apart: true }, { event: 'link', face: 3, by: 'roll', moves: [1, 2] }],
    kinds: ['downAndUp'], route: 'P.*\\^', personas: LATER,
    brief: 'down and back: a pair lets the player down, a push makes the 3s, and they are the way up to the last die',
  },
  {
    ...FREE, slot: 15, id: 'R15', role: 'free', size: 4, dice: 5, faces: [3, 2], par: [3, 4], floor: true, personas: LATER,
    // The lesson of the walk of the second edition (its R11) on an open board, every die one that rolls; the 2 that waited
    // in the corner is a cell nearer, since there one first move only kept the board in hand.
    sketch: [{ start: { x: 0, z: 3 }, dice: [{ x: 0, z: 3, top: 6, north: 4 }, { x: 2, z: 1, top: 6, north: 3 }, { x: 1, z: 2, top: 3, north: 1 }, { x: 2, z: 2, top: 3, north: 1 }, { x: 1, z: 1, top: 2, north: 1 }] }],
    brief: 'the walk of the lesson, now that the floor and the push are known: over the 3s as they leave',
  },
  {
    ...FREE, slot: 18, id: 'R16', role: 'mix', size: 4, dice: 6, faces: [3, 2], par: [4, 5], floor: true, needs: ['floor'],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 2, by: 'push', apart: true }, { event: 'link', face: 2, by: 'roll', moves: [1, 2] }],
    kinds: ['downAndUp'], route: 'P.*\\^', ends: { event: 'link' }, personas: LATER,
    brief: 'everything: the 3s, down, a push that makes the 2s, up by them, and the chain last',
  },
];
