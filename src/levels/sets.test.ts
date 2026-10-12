import { describe, expect, it } from 'vitest';
import { BASE_ORDER, PRESETS, applyPreset } from './orders';
import { orderInSet, setFor } from './sets';
import { sameBoard } from './variety';

describe('orderInSet', () => {
  it('is the order of the preset where nothing was played before it', () => {
    for (const key of Object.keys(PRESETS)) expect(orderInSet(key, [])).toEqual(applyPreset(BASE_ORDER, key));
  });
  it('asks mastery for the trick met last, in no more moves than it took then', () => {
    const order = orderInSet('mastery', [{ par: 6, uses: ['link'] }, { par: 4, uses: ['floor', 'link'] }, { par: 3, uses: [] }]);
    expect(order.needs).toEqual(['link']);
    expect(order.par).toEqual([3, 4]);
    // With no trick met there is nothing to master: the preset stands as it is.
    expect(orderInSet('mastery', [{ par: 5, uses: ['ones'] }])).toEqual(applyPreset(BASE_ORDER, 'mastery'));
  });
  it('makes a gift short after a long board, and a wall longer than all before it', () => {
    expect(orderInSet('gift', [{ par: 8, uses: [] }]).par).toEqual([2, 3]);
    expect(orderInSet('gift', [{ par: 4, uses: [] }]).par).toEqual([2, 2]);
    expect(orderInSet('gift', [{ par: 3, uses: [] }]).par).toEqual([2, 2]);
    expect(orderInSet('wall', [{ par: 9, uses: [] }]).par).toEqual([10, 12]);
    expect(orderInSet('wall', [{ par: 3, uses: [] }]).par).toEqual([7, 10]);
  });
});

describe('setFor', () => {
  it('lays a board to every preset, no two alike, and says the preset it found none for', { timeout: 120_000 }, () => {
    const { boards, missing } = setFor(['gift', 'gift'], { budgetMs: 20_000, seeds: 40 });
    expect(boards.length + missing.length).toBe(2);
    expect(boards.length).toBeGreaterThan(0);
    for (const board of boards) expect(board.offer.spec.par).toBe(board.offer.par);
    if (boards.length === 2) expect(sameBoard(boards[0].offer.spec, boards[1].offer.spec)).toBe(false);
  });
  it('refuses a preset there is none of', () => {
    expect(() => setFor(['gift', 'nothing'])).toThrow(/no preset "nothing"/);
  });
});
