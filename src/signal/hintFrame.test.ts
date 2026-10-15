import { describe, expect, it } from 'vitest';
import { HINT_RECIPE, HINT_SCENE, hintCard, hintComposition } from './hintFrame';
import { thingParam } from './compose';

/** A chance that is the same every time it starts from the same seed. */
const seq = (seed: number) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

describe('the scene of a hint', () => {
  it('puts the pole and the sun on two sides of the frame, each on its third', () => {
    for (let i = 1; i < 200; i++) {
      const wide = hintComposition(seq(i), 16 / 9);
      expect(Math.sign(wide.pole)).toBe(-Math.sign(wide.sun));
      expect(Math.abs(wide.pole)).toBeGreaterThanOrEqual(0.25);
      expect(Math.abs(wide.pole)).toBeLessThanOrEqual(0.45);
      expect(Math.abs(wide.sun)).toBeGreaterThanOrEqual(0.2);
      expect(Math.abs(wide.sun)).toBeLessThanOrEqual(0.45);
      expect(wide.elevation).toBeGreaterThanOrEqual(2);
      expect(wide.elevation).toBeLessThanOrEqual(14);
    }
  });

  it('keeps the pole nearer the middle and the sun higher on a tall screen', () => {
    for (let i = 1; i < 200; i++) {
      const tall = hintComposition(seq(i), 9 / 16);
      expect(Math.abs(tall.pole)).toBeGreaterThanOrEqual(0.15);
      expect(Math.abs(tall.pole)).toBeLessThanOrEqual(0.3);
      expect(Math.sign(tall.pole)).toBe(-Math.sign(tall.sun));
      expect(tall.elevation).toBeGreaterThanOrEqual(4);
      expect(tall.elevation).toBeLessThanOrEqual(18);
    }
  });

  it('is the sea with the pole and the sun, light, and the same for the same chance', () => {
    const a = hintCard(seq(7), 1.5, 'x');
    expect(a.frame.recipe).toEqual(HINT_RECIPE);
    expect(a.frame.recipe.things[0]).toBe('pole');
    expect(a.frame.mixing).toBe(1);
    expect(a.contact).toBeGreaterThanOrEqual(0);
    expect(a.contact).toBeLessThanOrEqual(0.25);
    expect(a.caption).toBe('x');
    expect(a.seconds).toBe(Infinity);
    expect(hintCard(seq(7), 1.5, 'x')).toEqual(a);
  });

  it('takes its colours as one set of the table', () => {
    for (let i = 1; i < 50; i++) {
      const { values } = hintCard(seq(i), 1.5, 'x').frame;
      const set = HINT_SCENE.palettes.find((p) => p.skyTop === values.skyTop);
      expect(set).toBeDefined();
      expect(values.skyHorizon).toBe(set!.skyHorizon);
      expect(values.ground).toBe(set!.ground);
    }
  });

  it('turns the light to the side of the sun and moves the pole to the other', () => {
    for (let i = 1; i < 50; i++) {
      const random = seq(i);
      const comp = hintComposition(seq(i), 1.5);
      const { values } = hintCard(random, 1.5, 'x').frame;
      // The camera looks down -z; the light comes from straight ahead at 180, from the right below it.
      expect(Math.sign(180 - Number(values.lightAngle))).toBe(Math.sign(comp.sun));
      expect(Math.sign(Number(values[thingParam('pole', 'x')]))).toBe(Math.sign(comp.pole));
    }
  });
});
