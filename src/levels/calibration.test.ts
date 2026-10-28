import { describe, expect, it } from 'vitest';
import { D_ROWS, OWNER_REPEATS, SIMILAR_PAIRS, UNLIKE_PAIRS } from './calibration';
import { CAMPAIGN } from './campaign';
import { goalFaces } from './goalFaces';

const known = new Set(CAMPAIGN.map((place) => place.code));
const codeOfNumber = (number: number) => CAMPAIGN.find((place) => place.number === number)!.code;

describe('the calibration set', () => {
  it('names only boards the row holds', () => {
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
    expect(thirty.codes).toEqual(CAMPAIGN.filter((place) => place.number <= 30).map((place) => place.code));
    expect([thirty.lo, thirty.hi]).toEqual([1, 4]);
    for (const row of D_ROWS) expect(row.lo).toBeLessThanOrEqual(row.hi);
  });

  it('pairs place 61 with every board among places 1-30 whose goal faces, without 1, are exactly 3', () => {
    const threes = CAMPAIGN.filter((place) => place.number <= 30)
      .filter((place) => {
        const faces = goalFaces(place.spec).filter((face) => face !== 1);
        return faces.length === 1 && faces[0] === 3;
      })
      .map((place) => place.code);
    expect(SIMILAR_PAIRS.find((pair) => pair.a === 'fixed-wall-1')!.b).toEqual(threes);
  });

  it('holds eight similar pairs and six unlike ones', () => {
    expect(SIMILAR_PAIRS).toHaveLength(8);
    expect(UNLIKE_PAIRS).toHaveLength(6);
    for (const pair of SIMILAR_PAIRS) expect(pair.b.length).toBeGreaterThan(0);
  });

  it('keeps the places the owner named by the codes of the row', () => {
    expect(OWNER_REPEATS[0]).toBe(codeOfNumber(48));
    expect(D_ROWS.find((row) => row.lo === 8 && row.hi === 9)!.codes).toEqual([codeOfNumber(100)]);
  });
});
