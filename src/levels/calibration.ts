/**
 * The calibration set of the progression tools (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md,
 * sections 5 and 6): what the owner said of the row on 28 October 2026 (row 0.2.87), held as codes of the
 * boards because the numbers of the places shift once the row is rebuilt. The similarity and the scale of
 * difficulty are tuned until they agree with these words; the owner's numbers in the comments are those of
 * the row as it stood then.
 */

/**
 * Pairs that must read as alike, similarity at least 0.7 (spec section 5): `a` against the board of any
 * code in `b` ("to one of" where `b` holds several).
 */
export const SIMILAR_PAIRS: readonly { a: string; b: readonly string[] }[] = [
  // Places 50 and 51: "the same just after the 50th, another layout".
  { a: 'two-combos-3', b: ['two-combos-5'] },
  // Places 74 and 76: the same thought, K L with grasp glass, faces 2.
  { a: 'act-k25', b: ['roll-in-transfer-1'] },
  // Places 56, 75 and 78 against place 29: "the push taught again".
  { a: 'dd-09-push-link', b: ['floor-first-1'] },
  { a: 'dd-12-ice-corridor', b: ['floor-first-1'] },
  { a: 'far-faces-1', b: ['floor-first-1'] },
  // Place 98 to one of the tight rooms of the row, places 88 and 91.
  { a: 'tight-room-4', b: ['tight-room-5', 'tight-room-1'] },
  // Place 61 to any board among places 1-30 whose goal faces (without 1) are exactly [3]:
  // places 2, 5, 7, 8, 14, 16 and 23.
  { a: 'fixed-wall-1', b: ['side-up-1', 'H06', 'H07', 'three-under-1', 'C1-07', 'act-k17', 'C1-05'] },
  // Place 68 to `dd-25-pocket` (place 67); the spec's "or `probe-25`" is place 68 itself, so the pair is one.
  { a: 'probe-25', b: ['dd-25-pocket'] },
];

/** Pairs the owner called different or good side by side, similarity at most 0.5 (spec section 5). */
export const UNLIKE_PAIRS: readonly [string, string][] = [
  ['bridge-5', 'hidden-face-1'], // places 54 and 55
  ['pair-and-fours-1', 'collapse-5'], // places 58 and 57
  ['dd-15-no-way-down', 'dd-21-wood-fives'], // places 80 and 82
  ['ones-over-leaving-1', 'act-k21'], // places 86 and 87
  ['three-moves-1', 'dd-20-chain-on-the-run'], // places 89 and 90
  ['dd-19-three-threes-apart', 'three-moves-2'], // places 96 and 97
];

/**
 * Rows of the scale of difficulty (spec section 6): the boards the owner placed by words, and the band of `D`
 * (lo to hi, in halves) they must fall into.
 */
export const D_ROWS: readonly { words: string; codes: readonly string[]; lo: number; hi: number }[] = [
  {
    // "the start", "up to the 20th", "around the 5th": places 48, 53, 59, 60, 64, 79, 84, 99.
    words: 'начало, до 20-го, в районе 5-го',
    codes: ['dd-04-three-on-six', 'dd-06-find-the-two', 'ready-fours-1', 'R09', 'C2-05', 'R16', 'dd-72-fours-and-one', 'last-rest-1'],
    lo: 1,
    hi: 3,
  },
  {
    // "up to the 30th", "around 20-40": places 67, 69, 70, 71, 75, 92, 95.
    words: 'до 30-го, в районе 20–40',
    codes: ['dd-25-pocket', 'act-k23', 'dd-11-wood-pushes', 'rescue-1', 'dd-12-ice-corridor', 'rescue-4', 'dd-13-stone-row'],
    lo: 3,
    hi: 4,
  },
  {
    // "40-55", "around 50": places 80, 82, 83, 91.
    words: '40–55, около 50',
    codes: ['dd-15-no-way-down', 'dd-21-wood-fives', 'dd-14-turn-to-fours', 'tight-room-1'],
    lo: 5,
    hi: 6,
  },
  {
    // "60-70", "for a later game", "hard": places 87, 88, 89, 97, and 50 as the sharp peak after 48-49.
    words: '60–70, для более поздней игры, сложно',
    codes: ['act-k21', 'tight-room-5', 'three-moves-1', 'three-moves-2', 'two-combos-3'],
    lo: 7,
    hi: 8,
  },
  {
    // "not solvable perfectly", the finale: place 100.
    words: 'нерешаемый идеально, финал',
    codes: ['finale-1'],
    lo: 8,
    hi: 9,
  },
  {
    // Places 1-30, kept as they are by the owner's decision 1: 1 to 4, not falling off sharply.
    words: 'первые тридцать',
    codes: [
      'R01', 'side-up-1', 'R03', 'B01_s290', 'H06', 'H08', 'H07', 'three-under-1', 'which-first-2', 'bridge-first-1',
      'R11', 'two-pairs-2', 'P07', 'C1-07', 'R07', 'act-k17', 'R05', 'P02', 'which-first-3', 'R08',
      'first-sixes-1', 'roll-in-1', 'C1-05', 'two-pairs-1', 'C1-06', 'first-fours-1', 'P24', 'domino-3', 'floor-first-1', 'carry-1',
    ],
    lo: 1,
    hi: 4,
  },
];

/**
 * Places the owner called repeats on 28 October (places 48, 49, 51-53, 56, 57, 60, 61, 64, 65, 68, 71-76,
 * 79, 84, 92, 98, 99 of row 0.2.87): the rule against repeats must catch these as known repeats.
 */
export const OWNER_REPEATS: readonly string[] = [
  'dd-04-three-on-six', // 48
  'hidden-face-3', // 49
  'two-combos-5', // 51
  'seven-1', // 52
  'dd-06-find-the-two', // 53
  'dd-09-push-link', // 56
  'collapse-5', // 57
  'R09', // 60
  'fixed-wall-1', // 61
  'C2-05', // 64
  'collapse-4', // 65
  'probe-25', // 68
  'rescue-1', // 71
  'chaser-1', // 72
  'P08', // 73
  'act-k25', // 74
  'dd-12-ice-corridor', // 75
  'roll-in-transfer-1', // 76
  'R16', // 79
  'dd-72-fours-and-one', // 84
  'rescue-4', // 92
  'tight-room-4', // 98
  'last-rest-1', // 99
];

/**
 * The places the owner's word puts where the rules of the row would not (docs/superpowers/specs/2026-10-28-vi-rebuild-31-100-design.md,
 * section 3.6): the board, the rule its line breaks (17, too alike, or 18, out of the band of its decade), and the
 * owner's words of it, quoted from the `words:` of its file. A line of that rule on that board is let be (`ownerWord`
 * in `src/levels/grammar.ts`) and marked so under the table. The list grows only by a quotation.
 */
export const OWNER_WORD: readonly { board: string; rule: 17 | 18; words: string }[] = [
  // Place 44 of the rebuild (0.2.89), a step out of the band of its decade: the owner's word of 28 October at the rebuild.
  { board: 'ones-fours-2', rule: 18, words: 'если что-то получается не идеално - оставляй. поправим позже.' },
  // Place 54 of the rebuild (0.2.89), a step out of the band of its decade: the owner's word of 28 October at the rebuild.
  { board: 'roll-threes-1', rule: 18, words: 'если что-то получается не идеално - оставляй. поправим позже.' },
  // Place 55 of the rebuild (0.2.89), a step out of the band of its decade: the owner's word of 28 October at the rebuild.
  { board: 'ones-over-leaving-1', rule: 18, words: 'если что-то получается не идеално - оставляй. поправим позже.' },
  // Place 56 of the rebuild (0.2.89), a step out of the band of its decade: the owner's word of 28 October at the rebuild.
  { board: 'two-combos-3', rule: 18, words: 'если что-то получается не идеално - оставляй. поправим позже.' },
  // Place 58 of the rebuild (0.2.89), a step out of the band of its decade: the owner's word of 28 October at the rebuild.
  { board: 'P08', rule: 18, words: 'если что-то получается не идеално - оставляй. поправим позже.' },
];
