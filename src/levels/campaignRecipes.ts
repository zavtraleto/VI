import type { Role } from './chapters';
import { cutFrom, type Recipe } from './recipes';

/**
 * The places of the acts of the campaign that get a new board
 * (docs/superpowers/specs/2026-10-12-vi-campaign-design.md, section 7): what the board of a place
 * is to show, in the words of a recipe. A board is looked for among the boards laid for its place
 * (`node scripts/level.mjs gen place=K17`), judged against it (`fit`), chosen by the passport of
 * the spec (its section 5.4) and by eye on a phone, and written into `levels.ts` under the code
 * of the place. The levels of the probe that an act takes as they are stay places of `recipes.ts`.
 *
 * The floor is open on every board after the prologue, and a board is cut only by its outline.
 */
export type CampaignPlace = Recipe & {
  id: string;
  /** The edition of the campaign the place was laid for: 1, the acts of 12 October 2026; 2, the chapters of 14 October. */
  edition: 1 | 2;
  /** The act (edition 1) or the chapter (edition 2) the place was laid for. */
  act: number;
  role: ActRole | Role;
  brief: string;
};

/** The six roles of an act of the first edition (its section 5.4). */
export type ActRole = 'opening' | 'apply' | 'twist' | 'join' | 'peak' | 'rest';

/** Four cells wide and three long: the square of four with its north row cut off. */
const WIDE = cutFrom(['....', '####', '####', '####']);

/** Three cells wide and four long: the square of four with its east column cut out. */
const LONG = cutFrom(['###.', '###.', '###.', '###.']);

const ACT = { chapter: 0, compact: false, edition: 1 } as const;
const CHAPTER = { chapter: 0, compact: false, edition: 2 } as const;

export const CAMPAIGN_PLACES: readonly CampaignPlace[] = [
  {
    // Four cells by three and not three by three: on a square of three the fourth die joins only by a roll onto a leaving die
    // or after a walk over leaving dice, and neither is this board's to ask. One first move keeps the fewest moves (the others
    // make the way longer, none loses); the walk is not asked of an open board; the hasty persona clears it in 0.57 of its runs.
    ...ACT, slot: 1017, id: 'K17', act: 1, role: 'opening', size: 4, holes: WIDE, dice: 4, faces: [3], standing: [{ value: 3, count: 2 }],
    seven: true, under: true, par: [3, 4], firsts: [1, 99], needs: ['link'], avoid: ['glass'], kinds: ['top'], ends: { event: 'link' }, personas: { hasty: 0.5, casual: 0.9 },
    brief: 'the rule of seven: a pair of 3s stands, the own die shows a 4 with its 3 underneath; two rolls one way bring it up; the fourth die joins as a link or is left alone',
  },
  {
    // No `ride` (the way begins with another die, rolled out of the way) and no floors for the hasty and the casual persona:
    // they clear a board of hidden faces in a run out of thirty and a run out of five, as they do `P03`, `P16` and `P09`.
    ...ACT, slot: 1021, id: 'K21', act: 1, role: 'peak', size: 3, dice: 5, faces: [3], under: true, movers: 2,
    par: [4, 6], firsts: [1, 2], tail: [0, 1], last: [5, 5], kinds: ['top'], safeFirst: true, gap: [0.3, 1],
    brief: 'eureka on 3s: two hidden faces, one roll away and back, and the five go at once',
  },
  {
    // The 3 of the own die is on the side that looks at the player, and one roll brings it up: `front` is not asked, it is of a
    // face that rides, and here nothing rides. Not `lossless`: a player who wanders seven moves and more can join one pair alone
    // and leave the other; every first move but the one keeps the board cleared in three.
    ...ACT, slot: 1022, id: 'K22', act: 1, role: 'rest', size: 4, holes: WIDE, dice: 5, more: 1, faces: [3], standing: [{ value: 3, count: 2 }, { value: 3, count: 2 }],
    under: false, par: [1, 2], safeFirst: true, last: [5, 6], kinds: ['top'], personas: { hasty: 0.9, casual: 1 },
    brief: 'the breather: two pairs of 3s a cell apart, the own 3 on the side the player sees; one roll into the gap and all of them go',
  },
  {
    // Four dice and not five, three cells wide: with 2s any two dice left make a pair of their own, so a fifth die gives a way
    // round the lesson. The far 2 comes over a leaving die (`glass`): laid backwards from its end on a square of four, no board
    // of this route does without it (of the 36 000 laid, the 112 whose laid way is the shortest all roll over one), and the level after it, `P20`, stands on the same roll. One first move keeps
    // the fewest moves; the hasty persona clears it in 0.30 of its runs.
    ...ACT, slot: 1023, id: 'K23', act: 2, role: 'opening', size: 4, holes: LONG, dice: 4, faces: [2], standing: [{ value: 2, count: 1 }],
    shows: ['link', 'glass'], scenes: [{ event: 'combo', face: 2, by: 'roll', moves: [1, 1] }, { event: 'link', face: 2, by: 'roll', moves: [1, 1] }, { event: 'link', face: 2, by: 'roll', moves: [2, 2] }],
    ends: { event: 'link', spare: 0 }, par: [3, 4], firsts: [1, 99], kinds: ['top'], route: '^K L L$', safeFirst: true, personas: { hasty: 0.25, casual: 0.8 },
    brief: 'time: the pair of 2s goes; the near link on the first move gives the group two more, and the far 2 makes it; a link on the second move leaves it alone',
  },
  {
    // No floors for the hasty and the casual persona: they clear it in a run out of twelve and in none, as they do the twist
    // of act I. The greedy one loses nine runs in ten, and no first move loses the board.
    ...ACT, slot: 1025, id: 'K25', act: 2, role: 'twist', size: 4, holes: WIDE, dice: 5, faces: [3], standing: [{ value: 3, count: 2 }],
    trap: 'floor', traps: [0.8, 1], safeFirst: true, par: [4, 6], firsts: [1, 99], shows: ['link'], avoid: ['glass'], kinds: ['top'], route: '^K L L$', gap: [0.3, 1],
    brief: 'greed: the combo of 3s that asks to be made on the second move strands two dice; bring the own die round to make it, then link the two',
  },
  {
    // Four cells by three, as the breather of act I: its rows are the ones the way and a cell round it take. Not `lossless`,
    // as `K22` is not: the walk finds a board lost seven commands from the start.
    ...ACT, slot: 1028, id: 'K28', act: 2, role: 'rest', size: 4, holes: WIDE, dice: 5, faces: [4], standing: [{ value: 4, count: 3 }],
    under: false, par: [1, 2], safeFirst: true, last: [5, 5], kinds: ['top'], personas: { hasty: 0.9, casual: 0.9 },
    brief: 'the breather and the first 4s: three stand together, the fourth beside the gap, the own die a roll away with its 4 on the side the player sees; one roll and five go',
  },
  // Chapter 1 of the second edition, the road over leaving dice, on 2s and 3s (docs/superpowers/specs/2026-10-14-vi-campaign-2-design.md, section 4.1).
  {
    ...CHAPTER, slot: 2104, id: 'C1-04', act: 1, role: 'meet', size: 4, holes: LONG, dice: 3, more: 1, faces: [2, 3], standing: [{ value: 2, count: 1 }],
    needs: ['glass'], par: [3, 4], firsts: [1, 99],
    brief: 'a leaving die is a cell: a pair of 2s goes, and the own die comes to the cell it needs only by a roll onto a leaving die, which goes from under it; round it is two moves longer or no way at all',
  },
  {
    ...CHAPTER, slot: 2105, id: 'C1-05', act: 1, role: 'apply', size: 4, dice: 5, faces: [2, 3], standing: [{ value: 3, count: 2 }],
    needs: ['glass'], par: [3, 5],
    brief: 'the roll onto a leaving die again, another figure, on 3s: rolled onto a die of the link and not of the pair',
  },
  {
    ...CHAPTER, slot: 2106, id: 'C1-06', act: 1, role: 'twist', size: 4, dice: 6, faces: [2, 3], route: '~', shows: ['glass'], par: [4, 6],
    brief: 'the road both ways, briefly: over a leaving combo to a die beyond it, a move there, and back over the same combo, or by a roll onto its last die, to the third heap before it goes; a move late leaves the player cut off',
  },
  {
    // The rest of chapter 1 with a way of its own (the owner, 14 October 2026: a one-move board in its place, K22, was «нелепый»):
    // a few quiet moves that read, and the last roll takes four dice and more.
    ...CHAPTER, slot: 2107, id: 'C1-07', act: 1, role: 'rest', size: 4, dice: 6, faces: [2, 3], par: [3, 4], last: [4, 6], firsts: [2, 99],
    personas: { hasty: 0.6, casual: 0.9 },
    brief: 'the rest with a way: two or three quiet moves that read, and the last roll takes four dice and more, two heaps that meet in one or a link that closes',
  },
  // Chapter 2 of the second edition, which first, on 2s and 3s (the spec, section 4.1).
  {
    ...CHAPTER, slot: 2205, id: 'C2-05', act: 2, role: 'twist', size: 4, dice: 5, more: 1, faces: [2, 3], standing: [{ value: 3, count: 2 }],
    trap: 'any', traps: [0.8, 1], safeFirst: true, par: [4, 6], firsts: [1, 99], kinds: ['top', 'bridge'],
    brief: 'the decoy of the wrong channel: a combo nearly made asks to be made on the second move; made, it leaves the dice of the other face with no pair, a dead end said at once; first the other combo, or bring a die, then make it',
  },
];
