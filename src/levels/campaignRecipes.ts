import type { Role } from './campaign';
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
export type CampaignPlace = Recipe & { id: string; act: number; role: Role; brief: string };

/** Four cells wide and three long: the square of four with its north row cut off. */
const WIDE = cutFrom(['....', '####', '####', '####']);

const ACT = { chapter: 0, compact: false } as const;

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
];
