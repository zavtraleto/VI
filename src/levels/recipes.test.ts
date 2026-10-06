import { describe, expect, it } from 'vitest';
import { levelId } from './generate';
import { CHAPTERS, CHAPTER_ONE, COURSE, PLACES, RECIPES } from './recipes';

describe('the chapters of the ladder', () => {
  it('are the course, the chapters that teach, and the ladder as it was', () => {
    expect(CHAPTERS.map((chapter) => chapter.key)).toEqual(['course', 'faces', 'chain', 'floor', 'twoFaces', 'threes', 'twosThrees', 'fives']);
  });

  it('open the course and the chapter after it for nothing: no stars are asked for', () => {
    expect(CHAPTERS.map((chapter) => chapter.gate)).toEqual([false, false, true, true, true, true, true, true]);
  });

  it('keep the floor shut until the chapter that teaches it, and the net under the player while the basics are taught', () => {
    expect(CHAPTERS.map((chapter) => chapter.floor)).toEqual([false, false, false, true, true, true, true, true]);
    expect(CHAPTERS.map((chapter) => chapter.guard)).toEqual(['all', 'all', 'lessons', 'lessons', 'lessons', 'none', 'none', 'none']);
  });
});

describe('the places of the course and of the first chapter', () => {
  it('are nine and nine, named in their order', () => {
    expect(COURSE.map(levelId)).toEqual(['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09']);
    expect(CHAPTER_ONE.map(levelId)).toEqual(['C101', 'C102', 'C103', 'C104', 'C105', 'C106', 'C107', 'C108', 'C109']);
    expect(PLACES).toEqual([...COURSE, ...CHAPTER_ONE]);
    const slots = [...PLACES, ...RECIPES].map((place) => place.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('are of their chapters, and played as their chapters say: the floor shut, a net under the player', () => {
    for (const place of PLACES) {
      const rule = CHAPTERS[place.chapter!];
      expect(place.chapter, place.id).toBe(COURSE.includes(place) ? 0 : 1);
      expect(place.floor, place.id).toBe(rule.floor);
      expect(place.guard, place.id).toBe(rule.guard === 'all');
    }
  });

  it('keep their dice in one cluster where the player has to walk: with the floor shut there is no other way to a die', () => {
    for (const place of PLACES) expect(place.compact, place.id).toBe(!place.ownOnly);
  });

  it('say what the player is to notice, each in its own words', () => {
    const briefs = PLACES.map((place) => place.brief);
    for (const brief of briefs) expect(brief?.length ?? 0).toBeGreaterThan(10);
    expect(new Set(briefs).size).toBe(briefs.length);
  });

  it('teach with a line where a block or half a chapter begins, and show the first move there', () => {
    expect(PLACES.filter((place) => place.lesson).map((place) => [place.id, place.lesson])).toEqual([
      ['T01', 'lineCombo'],
      ['T04', 'lineStep'],
      ['T07', 'lineWalk'],
      ['C101', 'lineSide'],
      ['C105', 'lineSeven'],
    ]);
    for (const place of PLACES) expect(place.guide ?? false, place.id).toBe(place.lesson !== undefined);
  });

  it('ask for a board of one combo only where the dice are as many as the one face has pips', () => {
    for (const place of PLACES.filter((other) => other.safe)) {
      expect(place.faces, place.id).toHaveLength(1);
      expect(place.dice, place.id).toBe(place.faces[0]);
      expect(place.more ?? 0, place.id).toBe(0);
    }
    // The six first levels of the course cannot be lost.
    expect(COURSE.slice(0, 6).every((place) => place.safe)).toBe(true);
  });

  it('have enough dice for the combos they ask for, and no more: the chain has not been taught', () => {
    for (const place of PLACES.filter((other) => other.combos !== undefined)) {
      expect(place.faces, place.id).toHaveLength(1);
      expect(place.dice % place.faces[0], place.id).toBe(0);
      expect(place.dice / place.faces[0], place.id).toBeGreaterThanOrEqual(place.combos!);
    }
    for (const place of PLACES) expect(place.avoid, place.id).toContain('link');
  });

  it('keep the rule of seven out of the course and bring it with its lesson', () => {
    for (const place of COURSE) expect(place.under, place.id).toBe(false);
    const seven = CHAPTER_ONE.findIndex((place) => place.lesson === 'lineSeven');
    for (const place of CHAPTER_ONE.slice(0, seven)) expect(place.under, place.id).toBe(false);
    expect(CHAPTER_ONE[seven]).toMatchObject({ under: true, seven: true });
  });

  it('are unlike their neighbours in the face that works or in the board', () => {
    PLACES.slice(1).forEach((place, index) => {
      const before = PLACES[index];
      expect(String(place.faces) !== String(before.faces) || place.size !== before.size, `${before.id} and ${place.id}`).toBe(true);
    });
  });
});
