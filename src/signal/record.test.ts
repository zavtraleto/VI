import { describe, expect, it } from 'vitest';
import { cardScene } from './card';
import { thingParam } from './compose';
import { MOODS } from './scene';
import { NOVEL } from '../app/novel';
import { NOVEL_LOOK, faceAt, figureBox, figureMask, novelCard, novelScene } from './record';

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
  it('is a place there is for every record: the sea, the room and the corridor, then the room, and the water for 06; the first for any other', () => {
    const places = NOVEL.map(({ code }) => novelCard(code, seq(1), 16 / 9).frame.recipe.id);
    expect(places).toEqual(['sea_pole', 'room_chair', 'corridor_door', 'room_chair', 'room_chair', 'nightwater_lamp', 'room_chair']);
    expect(novelScene('n99')).toBe(NOVEL_LOOK.scenes.n01);
  });

  it('shows her as a silhouette in act I, her face coming through on the second line of 04, and her face from 05 on', () => {
    expect(NOVEL.map(({ code }) => novelScene(code).figure)).toEqual(['silhouette', 'silhouette', 'silhouette', 'silhouette', 'face', 'face', 'face']);
    expect(NOVEL.map(({ code }) => novelScene(code).revealAt)).toEqual([null, null, null, 1, null, null, null]);
  });

  it('is in the cold mood, stays until it is closed, says nothing of its own, and is dark', () => {
    expect(NOVEL_LOOK.contact * (MOODS.length - 1)).toBe(1);
    expect(MOODS[1]).toBe('sad');
    for (const { code } of NOVEL) {
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

  it('puts the pole of the sea and the lamp of the water to the side, where the figure leaves room for them', () => {
    expect(Number(cardScene(novelCard('n01', seq(5), 16 / 9)).values[thingParam('pole', 'x')])).toBeGreaterThan(0);
    expect(Number(cardScene(novelCard('n06', seq(5), 16 / 9)).values[thingParam('lamp', 'x')])).toBeGreaterThan(0);
  });
});

describe('her face', () => {
  const silhouette = novelScene('n01');
  const coming = novelScene('n04');
  const face = novelScene('n05');

  it('is not there in a silhouette, and is there whole where it is shown from the start', () => {
    expect(faceAt(silhouette, 5, null, false)).toBe(0);
    expect(faceAt(silhouette, 5, 99999, false)).toBe(0);
    expect(faceAt(face, 0, null, false)).toBe(1);
  });

  it('comes through on its line, smoothly, in the time the look gives it; at once with motion kept low', () => {
    const { ms } = NOVEL_LOOK.figure.reveal;
    expect(faceAt(coming, 0, null, false)).toBe(0);
    expect(faceAt(coming, 1, 0, false)).toBe(0);
    let was = 0;
    for (let t = 16; t <= ms; t += 16) {
      const now = faceAt(coming, 1, t, false);
      expect(now).toBeGreaterThanOrEqual(was);
      expect(now - was).toBeLessThan(0.03);
      was = now;
    }
    expect(faceAt(coming, 1, ms, false)).toBe(1);
    expect(faceAt(coming, 3, ms * 3, false)).toBe(1);
    expect(faceAt(coming, 1, 0, true)).toBe(1);
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

  it('has light outside its edge and over it, none far from it, none along the cut at the waist, and a glow of its light parts', () => {
    // A square figure in the middle of a picture, cut by its bottom edge.
    const width = 40;
    const height = 40;
    // Dark, with a light patch on it high up: the face.
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 10; y < height; y++) {
      for (let x = 10; x < 30; x++) {
        const at = (y * width + x) * 4;
        const lit = y >= 12 && y < 20 && x >= 16 && x < 24;
        pixels.set(lit ? [230, 200, 180, 255] : [20, 20, 24, 255], at);
      }
    }
    const mask = figureMask(pixels, width, height);
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
    // Its picture is kept as it was; its light parts glow, and the dark does not.
    expect(Array.from(mask.color.slice(((16 + mask.pad) * mask.width + 20 + mask.pad) * 4, ((16 + mask.pad) * mask.width + 20 + mask.pad) * 4 + 4))).toEqual([230, 200, 180, 255]);
    expect(at(20, 16, 3)).toBeGreaterThan(0);
    expect(at(20, 35, 3)).toBe(0);
  });
});
