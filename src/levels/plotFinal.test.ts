import { describe, expect, it } from 'vitest';
import { fileBoard } from './boardFiles';
import { CAMPAIGN } from './campaign';
import { kindOrder, likeDistance, missesOf, otherShapesFirst, passportOf, pickFinalists, rankPassports, rowBoardsOf, shapeOf, twoOff, type Passport } from './plotFinal';

describe('the last stage of the generator', () => {
  it('reads a board of the row as a repeat of itself, and as new where it deepens that board', () => {
    const spec = fileBoard('act-k21');
    const row = rowBoardsOf(CAMPAIGN.filter((place) => place.code === 'act-k21'));
    const plot = { name: 'act-k21', size: 4, dice: [], events: [] };
    const repeat = passportOf(plot, spec, { runs: 6, row });
    expect(repeat.par).toBe(5);
    expect(repeat.nearest?.code).toBe('act-k21');
    expect(repeat.misses.some((miss) => miss.includes('act-k21'))).toBe(true);
    const deeper = passportOf({ ...plot, want: { instead: ['act-k21'] } }, spec, { runs: 6, row });
    expect(deeper.nearest).toBeNull();
    expect(deeper.misses).toEqual([]);
    expect(deeper.d).toBeGreaterThanOrEqual(1);
  });

  it('says the gates a passport misses', () => {
    const p = { d: 5, rank: 3, hidden: 0, depth: { forks: 1, waysLong: 1 }, nearest: null, sameCore: null, sameLayout: null } as unknown as Passport;
    expect(missesOf({ d: [7, 8], rank: 5, forks: 3, ways: 2, hidden: [1, 9] }, p)).toEqual(['D 5 not 7–8', 'rank 3 < 5', 'forks 1 < 3', 'ways 1 < 2', 'hidden 0 not 1–9']);
    expect(missesOf({ rank: 5 }, { ...p, rank: null })).toEqual([]);
  });

  it('stops a batch after two boards taken off in a row, and puts the boards near those called good first', () => {
    expect(twoOff([{ name: 'w-1', status: 'X', number: 1 }, { name: 'w-2', status: 'N', number: 2 }, { name: 'w-3', status: 'X', number: 3 }])).toBe(true);
    expect(twoOff([{ name: 'w-1', status: 'X', number: 1 }, { name: 'w-2', status: 'RC', number: 2 }, { name: 'w-3', status: 'X', number: 3 }])).toBe(false);
    expect(twoOff([{ name: 'w-1', status: 'X', number: 1 }])).toBe(false);
    const p = (d: number, par: number) => ({ d, par, hidden: 1, dice: 5, depth: { forks: 2, waysLong: 2 }, misses: [], longestDetour: 0 }) as unknown as Passport;
    expect(likeDistance(p(5, 5), [])).toBe(0);
    expect(likeDistance(p(5, 5), [p(5, 5)])).toBe(0);
    const ranked = rankPassports([{ passport: p(8, 9) }, { passport: p(5, 5) }], undefined, [p(5, 6)]);
    expect(ranked[0].passport.d).toBe(5);
  });

  it('takes the finalists one to a shape first, and puts the passports in order', () => {
    const spec = fileBoard('act-k21');
    expect(shapeOf(spec, ['top', 'top', 'south', 'top'])).toContain('top');
    const passed = [
      { spec, shape: 'a', order: 3 },
      { spec, shape: 'a', order: 1 },
      { spec, shape: 'b', order: 2 },
    ];
    expect(pickFinalists(passed, 2).map((one) => one.order)).toEqual([1, 2]);
    expect(pickFinalists(passed, 9).map((one) => one.order)).toEqual([1, 2, 3]);
    const at = (d: number, misses: string[]) => ({ passport: { d, misses, longestDetour: 0, depth: { waysLong: 1 } } as unknown as Passport });
    expect(rankPassports([at(9, []), at(7.5, []), at(7.5, ['x'])], { d: [7, 8] }).map((one) => one.passport.d)).toEqual([7.5, 9, 7.5]);
  });
});

describe('the five of a dozen (docs/superpowers/specs/2026-11-04-vi-level-craft-design.md, section 5)', () => {
  it('takes one of every shape first, then the rest in order', () => {
    const ranked = [{ shape: 'a', n: 1 }, { shape: 'a', n: 2 }, { shape: 'b', n: 3 }, { shape: 'c', n: 4 }, { shape: 'a', n: 5 }];
    expect(otherShapesFirst(ranked, 4).map((one) => one.n)).toEqual([1, 3, 4, 2]);
    expect(otherShapesFirst(ranked, 2).map((one) => one.n)).toEqual([1, 3]);
  });

  it('orders by the kind after the gates and the troubles: the narrow steps for an insight', () => {
    const p = (narrow: number) =>
      ({ d: 5, misses: [], troubles: [], longestDetour: 0, depth: { waysLong: 1 }, craft: { narrow, lastShare: 0 } }) as unknown as Passport;
    expect(kindOrder(p(4), 'insight')).toBeLessThan(kindOrder(p(1), 'insight'));
    expect(kindOrder(p(4), 'beauty')).toBe(0);
    const ranked = rankPassports([{ passport: p(1) }, { passport: p(4) }], undefined, [], 'insight');
    expect(ranked.map((one) => one.passport.craft.narrow)).toEqual([4, 1]);
    const troubled = { ...p(6), troubles: ['видно сразу'] } as Passport;
    expect(rankPassports([{ passport: troubled }, { passport: p(1) }], undefined, [], 'insight')[0].passport.craft.narrow).toBe(1);
  });
});
