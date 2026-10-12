import { describe, expect, it } from 'vitest';
import { DOWN_AND_UP } from './boardSamples';
import { byOrder, judgeBoard, offersFor } from './orderSearch';
import { BASE_ORDER, type Order } from './orders';
import { sameBoard } from './variety';

/** A small order that many boards meet: two dice of one face on three by three, a pair in a few moves. */
const SMALL: Order = { size: 3, dice: 2, faces: [2], floorShut: true, par: [1, 4] };

describe('judgeBoard', () => {
  it('finds nothing amiss in a board that is what the order says, and writes its way into it', () => {
    const order: Order = { ...BASE_ORDER, par: [4, 4], needs: ['link', 'floor'], events: [3, 3], endsOn: { event: 'link' } };
    const judged = judgeBoard(order, DOWN_AND_UP)!;
    expect(judged.misses).toEqual([]);
    expect(judged).toMatchObject({ par: 4, exact: true, distance: 0 });
    expect(judged.spec.solution).toHaveLength(4);
  });
  it('says every thing a board misses of an order, and is the farther from it the more it misses', () => {
    const near = judgeBoard({ ...BASE_ORDER, par: [5, 6] }, DOWN_AND_UP)!;
    expect(near.misses).toEqual(['moves 4, not 5-6']);
    expect(near.distance).toBe(1);
    const far = judgeBoard({ ...BASE_ORDER, par: [7, 9], avoid: ['floor'], dice: 6, endsOn: { event: 'combo' } }, DOWN_AND_UP)!;
    expect(far.misses).toEqual(expect.arrayContaining(['5 dice, not 6', 'moves 4, not 7-9', 'the way leans on floor', 'the way ends on link, not on combo']));
    expect(far.distance).toBeGreaterThan(near.distance);
  });
  it('asks nothing of what the order does not say', () => {
    expect(judgeBoard({ size: 4, dice: 5, faces: [2], par: [1, 99] }, DOWN_AND_UP)!.misses).toEqual([]);
  });
  it('gives nothing for a board the rules do not lay', () => {
    const none = { ...DOWN_AND_UP, layout: { ...DOWN_AND_UP.layout!, start: { x: 0, z: 0 } } };
    expect(judgeBoard(BASE_ORDER, none)).toBeNull();
  });
});

describe('offersFor', () => {
  it('lays boards that meet an order, the best first and no two alike', () => {
    const { offers, tried } = offersFor(SMALL, { seeds: 40, budgetMs: 60_000, keep: 3 });
    expect(tried).toBeGreaterThan(0);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0].misses).toEqual([]);
    expect([...offers].sort(byOrder)).toEqual(offers);
    for (const offer of offers) {
      expect(offer.spec.size).toBe(3);
      expect(offer.spec.layout!.dice).toHaveLength(2);
      expect(offer.spec.par).toBe(offer.par);
    }
    offers.forEach((a, index) => offers.slice(index + 1).forEach((b) => expect(sameBoard(a.spec, b.spec)).toBe(false)));
  });
  it('gives the nearest boards where none meets the order, each with what it misses', () => {
    const { offers } = offersFor({ ...SMALL, par: [30, 30] }, { seeds: 20, budgetMs: 60_000, keep: 2 });
    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0].misses[0]).toMatch(/^moves \d+, not 30$/);
  });
  it('leaves out the boards it is told were offered already', () => {
    const first = offersFor(SMALL, { seeds: 40, budgetMs: 60_000, keep: 2 }).offers;
    const second = offersFor(SMALL, { seeds: 40, budgetMs: 60_000, keep: 2, skip: first.map((offer) => offer.spec) }).offers;
    for (const offer of second) expect(first.some((taken) => sameBoard(taken.spec, offer.spec))).toBe(false);
  });
  it('stops when its time is spent, and says where the next search begins', () => {
    let clock = 0;
    const { tried, next } = offersFor(SMALL, { from: 5, seeds: 1000, budgetMs: 10, now: () => (clock += 4) });
    expect(tried).toBeLessThan(6);
    expect(next).toBeGreaterThan(5);
  });
});
