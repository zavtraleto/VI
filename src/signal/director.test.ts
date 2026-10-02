import { describe, expect, it } from 'vitest';
import { frameDef } from './compose';
import { mixingFor, randomFrame } from './director';
import { PLACES } from './places';
import { seededRandom } from './scene';
import { THINGS } from './things';

describe('mixingFor', () => {
  it('goes through the four steps of the merge as the contact grows, never back', () => {
    expect(mixingFor(0)).toBe(1);
    expect(mixingFor(1)).toBe(4);
    let before = 0;
    const seen = new Set<number>();
    for (let contact = 0; contact <= 1.0001; contact += 0.01) {
      const step = mixingFor(contact);
      expect(step).toBeGreaterThanOrEqual(before);
      before = step;
      seen.add(step);
    }
    expect([...seen]).toEqual([1, 2, 3, 4]);
  });
});

describe('randomFrame', () => {
  const frames = (contact: number, count = 300) => {
    const random = seededRandom(17);
    return Array.from({ length: count }, () => randomFrame(random, contact));
  };
  const native = (id: string) => PLACES.find((place) => place.id === id)!.native;

  it('at the first step shows a place with what belongs to it and nothing else', () => {
    for (const frame of frames(0)) {
      expect(frame.mixing).toBe(1);
      expect(frame.values).toEqual({});
      const own = native(frame.recipe.place);
      expect(frame.recipe.things).toEqual(own ? [own] : frame.recipe.things);
      expect(frame.recipe.things.length).toBeLessThanOrEqual(1);
    }
    // Every place turns up.
    expect(new Set(frames(0).map((frame) => frame.recipe.place)).size).toBe(PLACES.length);
  });

  it('at the second step adds one thing that does not belong, and nothing is wrong with it', () => {
    for (const frame of frames(0.3)) {
      const own = native(frame.recipe.place);
      const visitors = frame.recipe.things.filter((id) => id !== own);
      expect(visitors.length).toBe(1);
      expect(THINGS.find((thing) => thing.id === visitors[0])!.sky).toBeFalsy();
      for (const name of Object.keys(frame.values)) expect(name.endsWith('.near')).toBe(true);
    }
    // Between them the frames bring in every thing that stands on the ground.
    const all = new Set(frames(0.3, 800).flatMap((frame) => frame.recipe.things));
    for (const thing of THINGS.filter((item) => !item.sky)) expect(all.has(thing.id), thing.id).toBe(true);
  });

  it('at the third step something is wrong with the visitor or with the place', () => {
    const wrong = new Set<string>();
    for (const frame of frames(0.6, 600)) {
      expect(frame.mixing).toBe(3);
      const names = Object.keys(frame.values).map((name) => name.split('.').pop()!);
      const found = names.filter((name) => ['flood', 'sink', 'twin', 'scale'].includes(name));
      const near = Object.entries(frame.values).some(([name, value]) => name.endsWith('.near') && Number(value) >= 0.6);
      expect(found.length > 0 || near, JSON.stringify(frame.values)).toBe(true);
      for (const name of found) wrong.add(name);
      if (near) wrong.add('near');
      // Water comes only into a place that has walls to hold it.
      if (names.includes('flood')) expect(['room', 'corridor']).toContain(frame.recipe.place);
    }
    expect([...wrong].sort()).toEqual(['flood', 'near', 'scale', 'sink', 'twin']);
  });

  it('at the last step gathers many things, many mannequins, and the sun where there is a sky', () => {
    for (const frame of frames(1)) {
      expect(frame.mixing).toBe(4);
      expect(frame.recipe.things.length).toBeGreaterThanOrEqual(4);
      expect(frame.recipe.things).toContain('mannequin');
      expect(Number(frame.values['mannequin.count'])).toBeGreaterThanOrEqual(3);
      const indoors = ['room', 'corridor'].includes(frame.recipe.place);
      expect(frame.recipe.things.includes('sun')).toBe(!indoors);
    }
  });

  it('never names a thing twice, a place or a thing that is not there, or a value the frame has no parameter for', () => {
    for (const contact of [0, 0.3, 0.6, 1]) {
      for (const frame of frames(contact, 150)) {
        expect(new Set(frame.recipe.things).size).toBe(frame.recipe.things.length);
        const def = frameDef(frame.recipe);
        expect(Object.keys(def.variants)).toContain(frame.variant);
        for (const [name, value] of Object.entries(frame.values)) {
          const spec = def.params[name];
          expect(spec, `${def.id} ${name}`).toBeDefined();
          if (spec.kind === 'number') {
            expect(value).toBeGreaterThanOrEqual(spec.min);
            expect(value).toBeLessThanOrEqual(spec.max);
          }
        }
      }
    }
  });

  it('is the same from the same chance', () => {
    expect(randomFrame(seededRandom(8), 0.7)).toEqual(randomFrame(seededRandom(8), 0.7));
  });
});
