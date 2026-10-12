import { describe, expect, it } from 'vitest';
import { DOWN_AND_UP } from './boardSamples';
import { BASE_ORDER, PRESETS, applyPreset, orderMisses, orderOf, orderText, recipeOf, trapDepthOf, type Order } from './orders';

describe('recipeOf', () => {
  it('asks of a board only what the order says', () => {
    const recipe = recipeOf(BASE_ORDER);
    expect(recipe).toMatchObject({ size: 4, dice: 5, faces: [2], par: [3, 6], chapter: 0 });
    for (const key of ['needs', 'avoid', 'quiet', 'tail', 'ends', 'firsts', 'trap', 'under', 'far', 'last', 'floor', 'scenes', 'personas', 'hasty', 'casual', 'traps', 'random', 'lossless'] as const) {
      expect(recipe, key).not.toHaveProperty(key);
    }
  });
  it('puts what the order says where the judge of a place reads it', () => {
    const order: Order = { ...BASE_ORDER, faces: [1, 3], floorShut: true, needs: ['link'], avoid: ['floor'], quiet: [1, 2], tail: [0, 1], endsOn: { event: 'link', spare: 0 }, firsts: [1, 1], trap: 'any', hidden: 'hidden', far: 2, last: [2, 3] };
    expect(recipeOf(order)).toMatchObject({ faces: [3], ones: 1, floor: false, needs: ['link'], avoid: ['floor'], quiet: [1, 2], tail: [0, 1], ends: { event: 'link', spare: 0 }, firsts: [1, 1], trap: 'any', under: true, far: 2, last: [2, 3] });
    expect(recipeOf({ ...BASE_ORDER, hidden: 'shown', trap: 'none' })).toMatchObject({ under: false });
    expect(recipeOf({ ...BASE_ORDER, trap: 'none' })).not.toHaveProperty('trap');
  });
});

describe('the line of an order', () => {
  it('is read back as the order it was written from', () => {
    const order: Order = { ...BASE_ORDER, holes: [[0, 0], [3, 3]], more: 1, faces: [2, 3], floorShut: true, needs: ['link', 'floor'], avoid: ['ones'], quiet: [1, 2], events: [2, 4], tail: [0, 1], endsOn: { event: 'link', spare: 0 }, firsts: [1, 1], trap: 'any', trapDepth: [1, 3], hidden: 'hidden', far: 2, last: [2, 3] };
    expect(orderOf(orderText(order))).toEqual(order);
    expect(orderOf(orderText(BASE_ORDER))).toEqual(BASE_ORDER);
  });
  it('begins from a preset where one is named, and is changed by the words after it', () => {
    expect(orderOf('preset=tricky')).toEqual(applyPreset(BASE_ORDER, 'tricky'));
    expect(orderOf('preset=tricky par=5-7 dice=6')).toMatchObject({ preset: 'tricky', par: [5, 7], dice: 6, trap: 'any' });
    for (const key of Object.keys(PRESETS)) expect(orderOf(orderText(applyPreset(BASE_ORDER, key)))).toEqual(applyPreset(BASE_ORDER, key));
  });
  it('says what it cannot read', () => {
    expect(() => orderOf('size=4 colour=red')).toThrow(/colour/);
    expect(() => orderOf('par=6-3')).toThrow(/goes down/);
    expect(() => orderOf('needs=magic')).toThrow(/technique/);
    expect(() => orderOf('preset=nothing')).toThrow(/no preset/);
  });
});

describe('what a recipe has no word for', () => {
  const way = DOWN_AND_UP.solution!;
  it('counts the events of a way, and says where they are not as many as ordered', () => {
    // The way of the sample makes a pair, a second pair and a link: three events.
    expect(orderMisses({ ...BASE_ORDER, events: [3, 3] }, DOWN_AND_UP, way)).toEqual([]);
    expect(orderMisses({ ...BASE_ORDER, events: [4, 6] }, DOWN_AND_UP, way)).toEqual(['events 3, not 4-6']);
    expect(orderMisses(BASE_ORDER, DOWN_AND_UP, way)).toEqual([]);
  });
  it('measures how deep the trap of a board is, and holds it against the order', () => {
    const depth = trapDepthOf(DOWN_AND_UP, way);
    if (depth === null) {
      expect(orderMisses({ ...BASE_ORDER, trap: 'none' }, DOWN_AND_UP, way)).toEqual([]);
      expect(orderMisses({ ...BASE_ORDER, trap: 'any', trapDepth: [1, 3] }, DOWN_AND_UP, way)[0]).toMatch(/no trap/);
    } else {
      expect(depth).toBeGreaterThanOrEqual(0);
      expect(orderMisses({ ...BASE_ORDER, trap: 'none' }, DOWN_AND_UP, way)[0]).toMatch(/a trap/);
      expect(orderMisses({ ...BASE_ORDER, trap: 'any', trapDepth: [depth, depth] }, DOWN_AND_UP, way)).toEqual([]);
    }
  });
});
