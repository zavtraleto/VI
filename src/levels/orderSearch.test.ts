import { describe, expect, it } from 'vitest';
import { DOWN_AND_UP } from './boardSamples';
import { byOrder, completeFor, improveFor, judgeBoard, offersFor, repairFor } from './orderSearch';
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

describe('completeFor', () => {
  // The two dice of the pair are put down by hand; the board is to have five.
  const pinned = [{ x: 1, z: 1 }, { x: 3, z: 2 }];
  const order: Order = { size: 4, dice: 5, faces: [2], par: [2, 8] };
  it('lays the rest of the dice about those that are pinned, which stay as they lie', () => {
    const { offers, tried } = completeFor(order, DOWN_AND_UP, pinned, { tries: 60, budgetMs: 60_000, keep: 3 });
    expect(tried).toBeGreaterThan(0);
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      const dice = offer.spec.layout!.dice;
      expect(dice).toHaveLength(5);
      expect(dice).toContainEqual({ x: 1, z: 1, top: 2, north: 1 });
      expect(dice).toContainEqual({ x: 3, z: 2, top: 2, north: 1 });
      expect(offer.spec.par).toBe(offer.par);
    }
    expect([...offers].sort(byOrder)).toEqual(offers);
  });
  it('lays the same boards from the same seeds, and nothing where every die is pinned already', () => {
    const once = completeFor(order, DOWN_AND_UP, pinned, { tries: 20, budgetMs: 60_000 }).offers.map((offer) => offer.spec.layout);
    const again = completeFor(order, DOWN_AND_UP, pinned, { tries: 20, budgetMs: 60_000 }).offers.map((offer) => offer.spec.layout);
    expect(again).toEqual(once);
    const all = DOWN_AND_UP.layout!.dice.map(({ x, z }) => ({ x, z }));
    const whole = completeFor(order, DOWN_AND_UP, all, { tries: 5, budgetMs: 60_000 }).offers;
    expect(whole).toHaveLength(1);
    expect(whole[0].spec.layout!.dice).toEqual(DOWN_AND_UP.layout!.dice);
  });
});

describe('repairFor', () => {
  const order: Order = { size: 4, dice: 5, faces: [2], par: [4, 4], needs: ['link', 'floor'] };
  it('gives a board that meets the order back as it is', () => {
    const { mended, tried } = repairFor(order, DOWN_AND_UP, []);
    expect(tried).toBe(0);
    expect(mended).toHaveLength(1);
    expect(mended[0]).toMatchObject({ edits: [], misses: [] });
  });
  it('mends a board with one die spoilt by one change', { timeout: 120_000 }, () => {
    // The die of the push shows another face: the way of four moves is gone.
    const dice = DOWN_AND_UP.layout!.dice.map((die) => (die.x === 3 && die.z === 2 ? { ...die, top: 3, north: 1 } : die));
    const spoilt = { ...DOWN_AND_UP, layout: { ...DOWN_AND_UP.layout!, dice } };
    expect(judgeBoard(order, spoilt)!.misses.length).toBeGreaterThan(0);
    const { mended } = repairFor(order, spoilt, [], { budgetMs: 100_000, keep: 1 });
    expect(mended[0].misses).toEqual([]);
    expect(mended[0].edits).toHaveLength(1);
  });
  it('changes no die that is pinned', { timeout: 120_000 }, () => {
    const dice = DOWN_AND_UP.layout!.dice.map((die) => (die.x === 3 && die.z === 2 ? { ...die, top: 3, north: 1 } : die));
    const spoilt = { ...DOWN_AND_UP, layout: { ...DOWN_AND_UP.layout!, dice } };
    const { mended } = repairFor(order, spoilt, [{ x: 3, z: 2 }], { budgetMs: 20_000, keep: 2 });
    for (const board of mended) {
      expect(board.edits.every((edit) => !edit.startsWith('die 3,2'))).toBe(true);
      expect(board.spec.layout!.dice).toContainEqual({ x: 3, z: 2, top: 3, north: 1 });
    }
  });
});

describe('improveFor', () => {
  const order: Order = { size: 4, dice: 5, faces: [2], par: [4, 4], needs: ['link', 'floor'] };
  const dice = DOWN_AND_UP.layout!.dice.map((die) => (die.x === 3 && die.z === 2 ? { ...die, top: 3, north: 1 } : die));
  const spoilt = { ...DOWN_AND_UP, layout: { ...DOWN_AND_UP.layout!, dice } };
  it('keeps a pool no bigger than it is told, and its best board never gets worse', { timeout: 120_000 }, () => {
    const bests: number[] = [];
    let most = 0;
    improveFor(order, spoilt, [], { budgetMs: 100_000, steps: 25, pool: 4, onStep: (best, pool) => {
      bests.push(best.misses.length * 1000 + best.distance);
      most = Math.max(most, pool);
    } });
    expect(most).toBeLessThanOrEqual(4);
    expect(bests.length).toBeGreaterThan(0);
    expect([...bests].sort((a, b) => b - a)).toEqual(bests);
  });
  it('searches the same way from the same seed, and stops at once on a board that meets the order', { timeout: 120_000 }, () => {
    const once = improveFor(order, spoilt, [], { budgetMs: 100_000, steps: 12, seed: 3 }).mended.map((board) => board.edits);
    const again = improveFor(order, spoilt, [], { budgetMs: 100_000, steps: 12, seed: 3 }).mended.map((board) => board.edits);
    expect(again).toEqual(once);
    const { mended, tried } = improveFor(order, DOWN_AND_UP, []);
    expect(tried).toBe(0);
    expect(mended[0]).toMatchObject({ edits: [], misses: [] });
  });
});
