import { describe, expect, it } from 'vitest';
import { readBoardHead } from './boardFile';
import { BOARD_TEXTS, fileBoard } from './boardFiles';
import { D_ROWS, OWNER_REPEATS, OWNER_WORD, SIMILAR_PAIRS, UNLIKE_PAIRS } from './calibration';
import { goalFaces } from './goalFaces';

/** The row as the owner played it on 28 October 2026 (0.2.87, the hundred places after 0f57abf): the numbers of his words. */
const ROW_0287: readonly string[] = [
  'R01', 'side-up-1', 'R03', 'B01_s290', 'H06', 'H08', 'H07', 'three-under-1', 'which-first-2', 'bridge-first-1',
  'R11', 'two-pairs-2', 'P07', 'C1-07', 'R07', 'act-k17', 'R05', 'P02', 'which-first-3', 'R08',
  'first-sixes-1', 'roll-in-1', 'C1-05', 'two-pairs-1', 'C1-06', 'first-fours-1', 'P24', 'domino-3', 'floor-first-1', 'carry-1',
  'lift-first-1', 'R14', 'roll-or-push-1', 'push-then-link-1', 'rescue-5', 'three-at-once-1', 'P12', 'ones-roll-1', 'ones-apply-1', 'chain-1',
  'ones-push-1', 'dd-10-three-ones', 'collapse-3', 'broom-3', 'link-from-below-1', 'corridor-push-1', 'rescue-3', 'dd-04-three-on-six', 'hidden-face-3', 'two-combos-3',
  'two-combos-5', 'seven-1', 'dd-06-find-the-two', 'bridge-5', 'hidden-face-1', 'dd-09-push-link', 'collapse-5', 'pair-and-fours-1', 'ready-fours-1', 'R09',
  'fixed-wall-1', 'dd-62-fours-around', 'fixed-combo-1', 'C2-05', 'collapse-4', 'two-lifts-1', 'dd-25-pocket', 'probe-25', 'act-k23', 'dd-11-wood-pushes',
  'rescue-1', 'chaser-1', 'P08', 'act-k25', 'dd-12-ice-corridor', 'roll-in-transfer-1', 'P09', 'far-faces-1', 'R16', 'dd-15-no-way-down',
  'trap-5', 'dd-21-wood-fives', 'dd-14-turn-to-fours', 'dd-72-fours-and-one', 'P06', 'ones-over-leaving-1', 'act-k21', 'tight-room-5', 'three-moves-1', 'dd-20-chain-on-the-run',
  'tight-room-1', 'rescue-4', 'ones-broom-below-1', 'collapse-after-prep-1', 'dd-13-stone-row', 'dd-19-three-threes-apart', 'three-moves-2', 'tight-room-4', 'last-rest-1', 'finale-1',
];

// The set names the boards of that row by their codes; they stay among the files of boards/ once the row is rebuilt.
const known = new Set(BOARD_TEXTS.keys());
const codeOfNumber = (number: number) => ROW_0287[number - 1];

describe('the calibration set', () => {
  it('names only boards that have files', () => {
    const named = [
      ...SIMILAR_PAIRS.flatMap((pair) => [pair.a, ...pair.b]),
      ...UNLIKE_PAIRS.flat(),
      ...D_ROWS.flatMap((row) => row.codes),
      ...OWNER_REPEATS,
    ];
    for (const code of named) expect(known.has(code), code).toBe(true);
  });

  // The brief says "24 codes" but its list of places holds 23; the list is held, not the count.
  it('holds the repeats the owner named, by the places of the row he played', () => {
    const places = [48, 49, 51, 52, 53, 56, 57, 60, 61, 64, 65, 68, 71, 72, 73, 74, 75, 76, 79, 84, 92, 98, 99];
    expect(OWNER_REPEATS).toEqual(places.map(codeOfNumber));
  });

  it('holds the rows of the scale by the places the owner placed', () => {
    const places = [
      [48, 53, 59, 60, 64, 79, 84, 99],
      [67, 69, 70, 71, 75, 92, 95],
      [80, 82, 83, 91],
      [87, 88, 89, 97, 50],
      [100],
    ];
    places.forEach((numbers, index) => expect(D_ROWS[index].codes).toEqual(numbers.map(codeOfNumber)));
  });

  it('holds six rows of the scale, the first thirty among them at 1 to 4', () => {
    expect(D_ROWS).toHaveLength(6);
    const thirty = D_ROWS.find((row) => row.words === 'первые тридцать')!;
    expect(thirty.codes).toEqual(ROW_0287.slice(0, 30));
    expect([thirty.lo, thirty.hi]).toEqual([1, 4]);
    for (const row of D_ROWS) expect(row.lo).toBeLessThanOrEqual(row.hi);
  });

  it('pairs place 61 with every board among places 1-30 whose goal faces, without 1, are exactly 3', () => {
    const threes = ROW_0287.slice(0, 30).filter((code) => {
      const faces = goalFaces(fileBoard(code)).filter((face) => face !== 1);
      return faces.length === 1 && faces[0] === 3;
    });
    expect(SIMILAR_PAIRS.find((pair) => pair.a === 'fixed-wall-1')!.b).toEqual(threes);
  });

  it('holds eight similar pairs and six unlike ones', () => {
    expect(SIMILAR_PAIRS).toHaveLength(8);
    expect(UNLIKE_PAIRS).toHaveLength(6);
    for (const pair of SIMILAR_PAIRS) expect(pair.b.length).toBeGreaterThan(0);
  });

  it('keeps the places the owner named by the codes of the row he played', () => {
    expect(OWNER_REPEATS[0]).toBe(codeOfNumber(48));
    expect(D_ROWS.find((row) => row.lo === 8 && row.hi === 9)!.codes).toEqual([codeOfNumber(100)]);
  });

  it('lets a place be by the word of the owner only where the words are quoted from the file of its board', () => {
    for (const word of OWNER_WORD) {
      const text = BOARD_TEXTS.get(word.board);
      expect(text, word.board).toBeDefined();
      const said = (readBoardHead(text!).words ?? []).map((one) => one.text).join(' ');
      expect(said, word.board).toContain(word.words);
    }
  });
});
