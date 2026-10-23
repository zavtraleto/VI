import { describe, expect, it } from 'vitest';
import { HINT_RECIPE, HINT_SCENE, hintCard, hintComposition } from './hintFrame';
import { thingParam } from './compose';

/** A chance that is the same every time it starts from the same seed. */
const seq = (seed: number) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

describe('the scene of a hint', () => {
  it('puts the pole on a third of the frame, nearer the middle on a tall screen', () => {
    for (let i = 1; i < 200; i++) {
      const wide = Math.abs(hintComposition(seq(i), 16 / 9).pole);
      expect(wide).toBeGreaterThanOrEqual(0.25);
      expect(wide).toBeLessThanOrEqual(0.45);
      const tall = Math.abs(hintComposition(seq(i), 9 / 16).pole);
      expect(tall).toBeGreaterThanOrEqual(0.15);
      expect(tall).toBeLessThanOrEqual(0.3);
    }
  });

  it('is the sea with the pole alone, calm, and the same for the same chance', () => {
    const a = hintCard(seq(7), 1.5, 'x');
    expect(a.frame.recipe).toEqual(HINT_RECIPE);
    expect(a.frame.recipe.things).toEqual(['pole']);
    expect(a.frame.mixing).toBe(1);
    expect(a.contact).toBe(0);
    expect(a.caption).toBe('x');
    expect(a.seconds).toBe(Infinity);
    expect(hintCard(seq(7), 1.5, 'x')).toEqual(a);
  });

  it('has no light on the water and nothing glowing', () => {
    for (let i = 1; i < 50; i++) {
      const { values } = hintCard(seq(i), 1.5, 'x').frame;
      expect(values.glint).toBe(0);
      expect(values.glow).toBe(0);
    }
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

  it('moves the pole to the side the composition puts it on', () => {
    for (let i = 1; i < 50; i++) {
      const comp = hintComposition(seq(i), 1.5);
      const { values } = hintCard(seq(i), 1.5, 'x').frame;
      expect(Math.sign(Number(values[thingParam('pole', 'x')]))).toBe(Math.sign(comp.pole));
    }
  });
});
