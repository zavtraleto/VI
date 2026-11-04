import { describe, expect, it } from 'vitest';
import { cardScene } from './card';
import { thingParam } from './compose';
import { MOODS } from './scene';
import { NOVEL_LOOK, figureBox, figureMask, novelCard, novelScene } from './record';

const seq = (seed: number) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

/** How light a colour is, 0..1, as the eye takes it. */
function lightness(hex: string): number {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return (0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255)) / 255;
}

describe('the scene of a record of the link', () => {
  it('is the sea with the pole, the room and the corridor, for the three records, and the first for any other', () => {
    expect(novelCard('n01', seq(1), 16 / 9).frame.recipe.id).toBe('sea_pole');
    expect(novelCard('n02', seq(1), 16 / 9).frame.recipe.id).toBe('room_chair');
    expect(novelCard('n03', seq(1), 16 / 9).frame.recipe.id).toBe('corridor_door');
    expect(novelScene('n99')).toBe(NOVEL_LOOK.scenes.n01);
  });

  it('is in the cold mood, stays until it is closed, says nothing of its own, and is dark', () => {
    expect(NOVEL_LOOK.contact * (MOODS.length - 1)).toBe(1);
    expect(MOODS[1]).toBe('sad');
    for (const code of ['n01', 'n02', 'n03']) {
      const card = novelCard(code, seq(3), 9 / 16);
      expect(card.seconds).toBe(Infinity);
      expect(card.caption).toBeNull();
      expect(card.frame.mixing).toBe(1);
      const { values } = cardScene(card);
      for (const name of ['skyTop', 'skyHorizon', 'ground', 'wall', 'floor', 'ceiling']) {
        if (typeof values[name] === 'string') expect(lightness(String(values[name])), `${code}.${name}`).toBeLessThan(0.3);
      }
      expect(lightness(novelScene(code).fill), code).toBeLessThan(0.1);
      expect(lightness(novelScene(code).fill), code).toBeGreaterThan(0.02);
    }
  });

  it('puts the pole of the sea to the side, where the figure leaves room for it', () => {
    const { values } = cardScene(novelCard('n01', seq(5), 16 / 9));
    expect(Number(values[thingParam('pole', 'x')])).toBeGreaterThan(0);
  });
});

describe('the figure of the voice', () => {
  it('stands on the bottom of the frame in its middle, as tall as it is asked on a wide frame and narrower on a tall one', () => {
    const wide = figureBox(16 / 9, 0.75);
    expect(wide.height).toBeCloseTo(NOVEL_LOOK.figure.height);
    expect(wide.bottom).toBe(0);
    expect(wide.left + wide.width / 2).toBeCloseTo(0.5);
    const tall = figureBox(9 / 16, 0.75);
    expect(tall.width).toBeCloseTo(NOVEL_LOOK.figure.maxWidth);
    expect(tall.height).toBeLessThan(NOVEL_LOOK.figure.height);
    const breathing = figureBox(16 / 9, 0.75, 0.01);
    expect(breathing.height).toBeCloseTo(wide.height * 1.01);
    expect(breathing.bottom).toBe(0);
  });

  it('has light outside its edge and over it, none far from it, and none along the cut at the waist', () => {
    // A square figure in the middle of a picture, cut by its bottom edge.
    const width = 40;
    const height = 40;
    const alpha = new Uint8Array(width * height);
    for (let y = 10; y < height; y++) for (let x = 10; x < 30; x++) alpha[y * width + x] = 255;
    const mask = figureMask(alpha, width, height);
    const at = (x: number, y: number, channel: number): number => mask.data[((y + mask.pad) * mask.width + x + mask.pad) * 4 + channel];
    expect(mask.width).toBe(width + mask.pad * 2);
    // The figure itself.
    expect(at(20, 20, 0)).toBe(255);
    expect(at(5, 20, 0)).toBe(0);
    // The light past the edge, and none far from it.
    expect(at(8, 20, 1)).toBeGreaterThan(0);
    expect(at(-mask.pad, 20, 1)).toBe(0);
    // The light over the edge: less than full just inside it, full deep in.
    expect(at(10, 20, 2)).toBeLessThan(255);
    expect(at(20, 25, 2)).toBe(255);
    // The cut at the waist: the figure goes on below it, so the edge there is not one.
    expect(at(20, height - 1, 2)).toBe(255);
    expect(at(20, height + 1, 0)).toBe(255);
  });
});
