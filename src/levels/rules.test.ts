import { describe, expect, it } from 'vitest';
import { shortOf } from '../app/levelStats';
import { levelStuck, smallestGroup } from '../rules/level';
import { moveOf, replay } from '../rules/levelSolver';
import { setLanguage, t, type TextKey } from '../ui/i18n';
import { LEVELS } from './levels';
import { LESSONS, lessonsAt } from './rules';

/** A ladder of two chapters, as far as its rules go: the faces of a level and the rule it brings. */
const LADDER = [
  { faces: [3], lesson: 'threes' },
  { faces: [3], lesson: 'step' },
  { faces: [3] },
  { faces: [3], lesson: 'link' },
  { faces: [2, 3], lesson: 'twos' },
  { faces: [2, 3] },
  { faces: [2, 3], lesson: 'floor' },
];

describe('the rules a level can be asked for again', () => {
  it('are the rule of its faces, then every rule the levels up to it have brought, in the order they came', () => {
    expect(lessonsAt(LADDER, 0)).toEqual(['threes']);
    expect(lessonsAt(LADDER, 1)).toEqual(['threes', 'step']);
    expect(lessonsAt(LADDER, 3)).toEqual(['threes', 'step', 'link']);
  });

  it('are the same on a level that brings no rule as on the one before it', () => {
    expect(lessonsAt(LADDER, 2)).toEqual(lessonsAt(LADDER, 1));
  });

  it('do not name the faces of a chapter left behind: its other rules stay', () => {
    expect(lessonsAt(LADDER, 4)).toEqual(['twos', 'step', 'link']);
    expect(lessonsAt(LADDER, 6)).toEqual(['twos', 'step', 'link', 'floor']);
  });

  it('say nothing of a level further on', () => {
    expect(lessonsAt(LADDER, 5)).not.toContain('floor');
  });

  it('are none on a ladder that brings no rule, and none past its end', () => {
    expect(lessonsAt([{ faces: [3] }, { faces: [3] }], 1)).toEqual([]);
    expect(lessonsAt(LADDER, 7)).toEqual([]);
  });

  it('on every level of the game begin with the faces that work there, in words the game has', () => {
    LEVELS.forEach((level, index) => {
      const lessons = lessonsAt(LEVELS, index);
      const opening = LEVELS.find((other) => String(other.faces) === String(level.faces))!;
      expect(lessons[0], level.id).toBe(opening.lesson);
      expect(new Set(lessons).size, level.id).toBe(lessons.length);
      for (const lesson of lessons) expect(t(lesson as TextKey).length, level.id).toBeGreaterThan(0);
    });
  });
});

describe('the rules the windows of the levels say', () => {
  const inBoth = (check: (language: string) => void): void => {
    for (const language of ['ru', 'en']) {
      setLanguage(language);
      check(language);
    }
    setLanguage('en');
  };

  it('are each a few thoughts, a thought to a line, in either language', () => {
    inBoth((language) => {
      for (const lesson of LESSONS) {
        const lines = t(lesson).split('\n');
        expect(lines.length, `${lesson} ${language}`).toBeGreaterThan(0);
        expect(lines.length, `${lesson} ${language}`).toBeLessThanOrEqual(3);
        for (const line of lines) expect(line.length, `${lesson} ${language}`).toBeLessThanOrEqual(110);
      }
    });
  });

  it('are every rule a level of the game brings, but for the one the old ladder still says', () => {
    for (const level of LEVELS) {
      if (level.lesson && level.lesson !== 'lessonStep') expect(LESSONS, level.id).toContain(level.lesson);
    }
  });

  it('say how many moves a link gives where they say what a link gives', () => {
    inBoth((language) => expect(t('lessonHold'), language).toMatch(language === 'ru' ? /ещё один ход/ : /one more move/));
  });

  it('begin as an instruction and end as the words of whoever receives the dice, a word or two at a time', () => {
    setLanguage('ru');
    const given = /к нам|здесь|принимаются|у нас|мы /;
    // The laboratory names no one and stands nowhere.
    for (const lesson of ['lessonThrees', 'lessonWalk', 'lessonLink', 'lessonHold', 'lessonFloor', 'lessonClimb'] as const) expect(t(lesson), lesson).not.toMatch(given);
    // What is under a die is "there" for the one who speaks first, and "here" for the one who speaks later.
    expect(t('lessonSeven')).toContain('она там');
    expect(t('lessonSeven')).not.toMatch(given);
    expect(t('lessonTwos')).toContain('принимаются');
    expect(t('lessonGlass')).toContain('уже наполовину здесь');
    // The last window says of a combo what the first one said, and to whom it leaves.
    expect(t('lessonThrees')).toContain('это комбо, и оно уходит.');
    expect(t('lessonFives')).toContain('это комбо, и оно уходит к нам.');
    setLanguage('en');
  });

  it('leave a dead end its two numbers to fill in: the dice that stand and the dice a combo takes', () => {
    inBoth((language) => {
      expect(t('levelStuck'), language).toContain('{left}');
      expect(t('levelStuck'), language).toContain('{need}');
    });
  });

  it('have those numbers at a dead end: on the level of the chain, one die left where a combo takes three', () => {
    const chain = LEVELS.find((level) => level.lesson === 'lessonLink')!;
    // The combo is made and no die is brought to it: two moves on it is gone, and the fourth die stands alone.
    const state = replay(chain, ['0,0,S', '2,0,S', '1,0,E', '2,0,S'].map(moveOf));
    expect(state.endReason).toBe('failed');
    expect(levelStuck(state)).toBe(true);
    expect(shortOf(state)).toBe(1);
    expect(smallestGroup(chain)).toBe(3);
  });
});

