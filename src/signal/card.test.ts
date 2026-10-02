import { describe, expect, it } from 'vitest';
import { textWidth } from '../shell/layout';
import { ANSWER_SECONDS, GLIMPSE_SECONDS, cardScene, cardTitle, figureOf, moodFor, randomCard, type SignalCard } from './card';
import { nativeRecipe } from './recipes';
import { LINES } from './lines';
import { MOODS, contactValues, seededRandom, sceneValues } from './scene';

describe('moodFor', () => {
  it('goes from the lightest mood to the heaviest as the contact grows', () => {
    expect(moodFor(0)).toBe('dream');
    expect(moodFor(1)).toBe('fear');
    const order = [0, 0.25, 0.5, 0.75, 1].map((contact) => MOODS.indexOf(moodFor(contact)));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(MOODS.length);
  });

  it('keeps inside the moods for any number', () => {
    expect(moodFor(-3)).toBe('dream');
    expect(moodFor(7)).toBe('fear');
  });
});

describe('figureOf', () => {
  it('gives the first pictures the numbers the art document gives them', () => {
    expect(figureOf({ recipe: nativeRecipe('sea'), variant: 'a', values: {}, mixing: 1 })).toBe(1);
    expect(figureOf({ recipe: nativeRecipe('room'), variant: 'a', values: {}, mixing: 1 })).toBe(2);
    expect(figureOf({ recipe: nativeRecipe('sea'), variant: 'b', values: {}, mixing: 1 })).toBe(3);
    expect(figureOf({ recipe: nativeRecipe('corridor'), variant: 'a', values: {}, mixing: 1 })).toBe(4);
    expect(figureOf({ recipe: nativeRecipe('room'), variant: 'b', values: {}, mixing: 1 })).toBe(6);
  });

  it('gives any other frame a number of its own, the same every time, of four digits at most', () => {
    const random = seededRandom(6);
    for (let i = 0; i < 80; i++) {
      const card = randomCard(random, 0.6);
      expect(card.figure).toBe(figureOf(card.frame));
      expect(card.figure).toBeGreaterThanOrEqual(100);
      expect(card.figure).toBeLessThan(10000);
    }
  });
});

describe('randomCard', () => {
  it('answers with the time asked for, a seed, and a frame as heavy as the contact', () => {
    const random = seededRandom(5);
    for (let i = 0; i < 40; i++) {
      const card = randomCard(random, 0.8);
      expect(card.contact).toBe(0.8);
      expect(card.frame.mixing).toBe(4);
      expect(card.seed).toBeGreaterThan(0);
      expect(card.seconds).toBe(ANSWER_SECONDS);
    }
    expect(randomCard(random, 0, GLIMPSE_SECONDS).seconds).toBe(GLIMPSE_SECONDS);
    expect(randomCard(seededRandom(3), 0.5)).toEqual(randomCard(seededRandom(3), 0.5));
  });

  it('says only what is written down, and sometimes nothing', () => {
    const random = seededRandom(11);
    const said = new Set<string | null>();
    for (let i = 0; i < 600; i++) said.add(randomCard(random, 0.3).caption);
    expect(said.has(null)).toBe(true);
    const lines = LINES.map((line) => line.text);
    for (const caption of said) if (caption !== null) expect(lines).toContain(caption);
    expect(said.size).toBeGreaterThan(lines.length / 2);
  });
});

describe('cardScene', () => {
  it('is the frame at its contact, with the way its things stand laid over', () => {
    const card: SignalCard = {
      frame: { recipe: nativeRecipe('room'), variant: 'b', values: { 'chair.sink': 0.5, 'nothing.here': 1 }, mixing: 3 },
      contact: 0.5,
      seed: 4,
      figure: 6,
      caption: null,
      seconds: 3,
    };
    const { def, values } = cardScene(card);
    expect(def.id).toBe('room_chair');
    expect(values['chair.sink']).toBe(0.5);
    expect(values['chair.twin']).toBe(true);
    expect('nothing.here' in values).toBe(false);
    const plain = contactValues(def, 'b', 0.5);
    expect(values.wall).toBe(plain.wall);
    expect(plain).toEqual(sceneValues(def, 'b', 'strange'));
  });

  it('builds every frame chance comes up with, at every strength of the contact', () => {
    const random = seededRandom(21);
    for (let i = 0; i < 60; i++) {
      const card = randomCard(random, i / 59);
      const { def, values } = cardScene(card);
      const instance = def.build(values, card.seed);
      instance.update(1200, 4 / 3);
      const { position } = instance.camera;
      expect([position.x, position.y, position.z].every(Number.isFinite), def.id).toBe(true);
      instance.dispose();
    }
  });
});

describe('cardTitle', () => {
  const card: SignalCard = {
    frame: { recipe: nativeRecipe('sea'), variant: 'b', values: {}, mixing: 1 },
    contact: 0.5,
    seed: 300,
    figure: 3,
    caption: null,
    seconds: 3,
  };

  it('names the file by the number of its figure, four signs and a byte of the seed', () => {
    const title = cardTitle(card);
    expect(title).toMatch(/^図0003 [ｦ-ﾝ]{4}:2C$/);
    // Half-width signs: the name takes little room in the title of a narrow window.
    expect(textWidth(title)).toBe((2 + 4 + 1 + 4 + 3) * 8);
  });

  it('gives the same picture the same name, and tells places and moods apart', () => {
    expect(cardTitle(card)).toBe(cardTitle({ ...card }));
    const word = (c: SignalCard) => cardTitle(c).slice(6, 10);
    const room: SignalCard = { ...card, frame: { ...card.frame, recipe: nativeRecipe('room') } };
    expect(word(room)[0]).not.toBe(word(card)[0]);
    expect(word({ ...card, contact: 1 })[2]).not.toBe(word(card)[2]);
    expect(word({ ...card, contact: 1 }).slice(0, 2)).toBe(word(card).slice(0, 2));
  });
});
