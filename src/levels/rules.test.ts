import { describe, expect, it } from 'vitest';
import { shortOf } from '../app/levelStats';
import { levelStuck, smallestGroup } from '../rules/level';
import { moveOf, replay } from '../rules/levelSolver';
import { LANGUAGES, setLanguage, t, type TextKey } from '../ui/i18n';
import { LEVELS } from './levels';
import { LESSONS, lessonsAt, ruleOf } from './rules';
import { messagesOf } from './voices';

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

describe('what is said in the windows of the levels', () => {
  const inBoth = (check: (language: string) => void): void => {
    for (const language of LANGUAGES) {
      setLanguage(language);
      check(language);
    }
    setLanguage('en');
  };
  /** Every lesson the game has words for: those of the ladder of lessons, and the one the old ladder still says. */
  const SAID = [...LESSONS, 'lessonStep'] as const;
  const sung = (lesson: (typeof SAID)[number]): string[] => messagesOf(t(lesson)).map((said) => [...said.text].filter((_, i) => said.other[i]).join(''));

  it('is a few messages to a lesson, each short enough for the window of a phone, in every language', () => {
    inBoth((language) => {
      for (const lesson of SAID) {
        const messages = messagesOf(t(lesson));
        expect(messages.length, `${lesson} ${language}`).toBeGreaterThan(0);
        expect(messages.length, `${lesson} ${language}`).toBeLessThanOrEqual(4);
        for (const said of messages) expect(said.text.length, `${lesson} ${language}: ${said.text}`).toBeLessThanOrEqual(230);
      }
    });
  });

  it('covers every rule a level of the game brings', () => {
    for (const level of LEVELS) {
      if (level.lesson) expect(SAID, level.id).toContain(level.lesson);
    }
  });

  it('begins with a greeting, the name of the program and the dice of Rhine', () => {
    setLanguage('ru');
    const [hello, rhine] = messagesOf(t('lessonThrees'));
    expect(hello.text).toMatch(/^Привет!/);
    expect(hello.text).toContain('Visual Interconnection');
    expect(rhine.text).toContain('Райн');
    setLanguage('en');
    expect(messagesOf(t('lessonThrees'))[1].text).toContain('Rhine');
    // Whatever the language, the program is named as it is and the man is named by his name.
    inBoth((language) => {
      const [first, second] = messagesOf(t('lessonThrees'));
      expect(first.text, language).toContain('Visual Interconnection');
      expect(second.text, language).toMatch(/Rhine|Райн/);
    });
  });

  it('is the laboratory’s alone through the first chapter, and has a word or two of the other side after it', () => {
    inBoth((language) => {
      for (const lesson of ['lessonThrees', 'lessonStep', 'lessonWalk', 'lessonLink', 'lessonHold', 'lessonSeven', 'lessonClimb'] as const) {
        expect(sung(lesson).join(''), `${lesson} ${language}`).toBe('');
      }
      for (const lesson of ['lessonTwos', 'lessonGlass', 'lessonFloor', 'lessonFives'] as const) {
        const words = sung(lesson).join('');
        expect(words.length, `${lesson} ${language}`).toBeGreaterThan(0);
        expect(words.length, `${lesson} ${language}`).toBeLessThanOrEqual(34);
      }
    });
    setLanguage('ru');
    expect(sung('lessonTwos').join('')).toBe('принимаются');
    expect(sung('lessonGlass').join('')).toBe('уже наполовину здесь');
    expect(sung('lessonFloor').join('')).toBe('мы подождём');
    expect(sung('lessonFives').join('')).toBe('к нам');
    setLanguage('en');
  });

  it('says of a combo at the last what it said at the first, and to whom it leaves', () => {
    setLanguage('ru');
    const first = messagesOf(t('lessonThrees')).at(-1)!.text;
    const last = messagesOf(t('lessonFives')).at(-1)!.text;
    expect(first).toContain('это комбо, и оно уйдёт.');
    expect(last).toContain('это комбо, и оно уйдёт к нам.');
    // What is under a die is "there" for the laboratory and "here" for those who take it.
    expect(t('lessonSeven')).toContain('она там');
    expect(t('lessonGlass')).toContain('наполовину здесь');
    setLanguage('en');
  });

  it('says how many moves a die that joins a chain gives, where it says what a chain is', () => {
    const said: Record<string, RegExp> = {
      ru: /ещё один ход/,
      en: /one more move/,
      es: /un movimiento más/,
      pt: /mais uma jogada/,
      tr: /bir hamle daha/,
      de: /einen Zug mehr/,
      fr: /un coup de plus/,
    };
    inBoth((language) => {
      for (const lesson of ['lessonLink', 'lessonHold'] as const) expect(t(lesson), `${lesson} ${language}`).toMatch(said[language]);
    });
  });

  it('leaves every lesson a rule to read again: one line, with no one speaking and nothing marked', () => {
    inBoth((language) => {
      for (const lesson of SAID) {
        const rule = ruleOf(lesson);
        expect(rule, lesson).not.toBeNull();
        const line = t(rule!);
        expect(line.length, `${lesson} ${language}`).toBeGreaterThan(0);
        expect(line.length, `${lesson} ${language}`).toBeLessThanOrEqual(230);
        expect(line, `${lesson} ${language}`).not.toMatch(/[\[\]\n]/);
      }
    });
    expect(ruleOf('lessonOfNothing')).toBeNull();
  });

  it('leaves a dead end its two numbers to fill in: the dice that stand and the dice a combo takes', () => {
    inBoth((language) => {
      expect(t('levelStuck'), language).toContain('{left}');
      expect(t('levelStuck'), language).toContain('{need}');
    });
  });

  it('has those numbers at a dead end: on the level of the chain, one die left where a combo takes three', () => {
    const chain = LEVELS.find((level) => level.lesson === 'lessonLink')!;
    // The combo is made and no die is brought to it: two moves on it is gone, and the fourth die stands alone.
    const state = replay(chain, ['0,0,S', '2,0,S', '1,0,E', '2,0,S'].map(moveOf));
    expect(state.endReason).toBe('failed');
    expect(levelStuck(state)).toBe(true);
    expect(shortOf(state)).toBe(1);
    expect(smallestGroup(chain)).toBe(3);
  });
});
