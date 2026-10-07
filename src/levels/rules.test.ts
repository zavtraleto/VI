import { describe, expect, it } from 'vitest';
import { shortOf } from '../app/levelStats';
import { levelDeadEnd, levelStuck, smallestGroup } from '../rules/level';
import { moveOf, replay } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { LANGUAGES, setLanguage, t, type TextKey } from '../ui/i18n';
import { LESSONS, lessonsAt, ruleOf } from './rules';
import { messagesOf } from './voices';

/**
 * The levels of the game bring no rule now: they are played by one who knows the rules. The
 * lines of the rules, and what finds the rules a level can be asked for, are kept for the levels
 * that will teach, and are tried here on lists written for the test.
 */

/** A ladder as far as its rules go: the rule a level brings, where it brings one. */
const LADDER = [{ lesson: 'combo' }, { lesson: 'step' }, {}, { lesson: 'link' }, { lesson: 'faces' }, {}, { lesson: 'link' }];

describe('the rules a level can be asked for again', () => {
  it('are every rule the levels up to it have brought, in the order they came', () => {
    expect(lessonsAt(LADDER, 0)).toEqual(['combo']);
    expect(lessonsAt(LADDER, 1)).toEqual(['combo', 'step']);
    expect(lessonsAt(LADDER, 4)).toEqual(['combo', 'step', 'link', 'faces']);
  });

  it('are the same on a level that brings no rule as on the one before it', () => {
    expect(lessonsAt(LADDER, 2)).toEqual(lessonsAt(LADDER, 1));
  });

  it('name a rule once, where a later level says it again', () => {
    expect(lessonsAt(LADDER, 6)).toEqual(['combo', 'step', 'link', 'faces']);
  });

  it('say nothing of a level further on', () => {
    expect(lessonsAt(LADDER, 2)).not.toContain('link');
  });

  it('are none on a ladder that brings no rule, and none past its end', () => {
    expect(lessonsAt([{}, {}], 1)).toEqual([]);
    expect(lessonsAt(LADDER, 7)).toEqual([]);
  });

  it('are rules the game has words for, where the levels say the lines it keeps', () => {
    const lines = LESSONS.map((lesson) => ({ lesson }));
    const lessons = lessonsAt(lines, lines.length - 1);
    expect(lessons).toEqual([...LESSONS]);
    for (const lesson of lessons) expect(t(lesson as TextKey).length, lesson).toBeGreaterThan(0);
  });
});

describe('the line a level says beside its board', () => {
  const words = (line: string): number => line.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

  it('is one of nine, each said once', () => {
    expect(LESSONS).toHaveLength(9);
    expect(new Set(LESSONS).size).toBe(LESSONS.length);
  });

  it('leaves a rule to read again from the pause of a level, but for the combo and the ride on the side', () => {
    for (const lesson of LESSONS) {
      const rule = ruleOf(lesson);
      if (lesson === 'lineCombo' || lesson === 'lineSide') expect(rule, lesson).toBeNull();
      else expect(t(rule!).length, lesson).toBeGreaterThan(0);
    }
  });

  it('is one message of some fifteen words in Russian, and short in every language', () => {
    for (const language of LANGUAGES) {
      setLanguage(language);
      for (const lesson of LESSONS) {
        const line = t(lesson);
        expect(messagesOf(line), `${lesson} ${language}`).toHaveLength(1);
        expect(line.length, `${lesson} ${language}: ${line}`).toBeLessThanOrEqual(160);
        if (language === 'ru') expect(words(line), `${lesson}: ${line}`).toBeLessThanOrEqual(17);
      }
    }
    setLanguage('en');
  });

  it('says its rule in the words of the player: a combo, a chain, a move, a step', () => {
    setLanguage('ru');
    expect(t('lineCombo')).toContain('комбо');
    expect(t('lineStep')).toMatch(/шаг — не ход/);
    expect(t('lineLink')).toContain('цепочка');
    setLanguage('en');
  });

  it('is said by a person: the first one greets the player, and the second names the man who threw dice', () => {
    setLanguage('ru');
    expect(t('lineCombo')).toMatch(/^Привет!/);
    expect(t('lineCombo')).toContain('лаборант');
    expect(t('lineStep')).toContain('Райна');
    for (const language of LANGUAGES) {
      setLanguage(language);
      expect(t('lineStep'), language).toMatch(/Rhine|Райн/);
    }
    setLanguage('en');
  });

  it('is the laboratory’s alone in the six first lines, and has words of the other side in those after them', () => {
    const others = (lesson: TextKey): number => messagesOf(t(lesson))[0]!.other.filter(Boolean).length;
    for (const language of LANGUAGES) {
      setLanguage(language);
      for (const lesson of ['lineCombo', 'lineStep', 'lineWalk', 'lineSide', 'lineSeven', 'lineLink'] as const) {
        expect(others(lesson), `${lesson} ${language}`).toBe(0);
      }
      for (const lesson of ['lineFloor', 'lineFaces', 'lineGlass'] as const) {
        expect(others(lesson), `${lesson} ${language}`).toBeGreaterThan(0);
      }
    }
    setLanguage('ru');
    const said = messagesOf(t('lineFloor'))[0]!;
    expect([...said.text].filter((_, at) => said.other[at]).join('')).toBe('мы подождём');
    setLanguage('en');
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
  /** The lessons of the ladder as it was: their windows are not opened any more, and their words are kept until the lines take their place. */
  const SAID = ['lessonThrees', 'lessonStep', 'lessonWalk', 'lessonLink', 'lessonHold', 'lessonFloor', 'lessonClimb', 'lessonSeven', 'lessonTwos', 'lessonGlass', 'lessonFives'] as const;
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

  it('is the laboratory’s alone in the lessons that came first, and has a word or two of the other side in the later ones', () => {
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

  it('has those numbers at a dead end: on a board of a chain, one die left where a combo takes three', () => {
    // Four dice where 3s work: three make the combo, and the fourth has to join it while it is leaving.
    const chain: LevelSpec = {
      id: 'chain', seed: 368, size: 3, values: [3], norm: 4, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces: [3], sinkMoves: 2, liftMoves: 1,
      layout: { start: { x: 2, z: 0 }, dice: [{ x: 1, z: 0, top: 6, north: 5 }, { x: 0, z: 0, top: 2, north: 3 }, { x: 1, z: 1, top: 3, north: 1 }, { x: 2, z: 0, top: 2, north: 3 }] },
    };
    // The combo is made and no die is brought to it: two moves on it is gone, and the fourth die stands alone.
    const state = replay(chain, ['0,0,S', '2,0,S', '1,0,E', '2,0,S'].map(moveOf));
    expect(state.endReason).toBe('failed');
    expect(levelStuck(state)).toBe(true);
    expect(levelDeadEnd(state)).toBe('count');
    expect(shortOf(state)).toBe(1);
    expect(smallestGroup(chain)).toBe(3);
  });

  it('says the two dead ends of the floor in a line each, in every language, with nothing to fill in', () => {
    const said = (key: TextKey): string[] =>
      LANGUAGES.map((language) => {
        setLanguage(language);
        return t(key);
      });
    for (const key of ['levelFloorStuck', 'levelFloorFaces'] as const) {
      const lines = said(key);
      expect(lines).toHaveLength(7);
      for (const [index, line] of lines.entries()) {
        expect(line.length, `${key} ${LANGUAGES[index]}`).toBeGreaterThan(10);
        expect(line, `${key} ${LANGUAGES[index]}`).not.toMatch(/[{}\[\]\n]/);
      }
      // Every language says it in its own words.
      expect(new Set(lines).size, key).toBe(lines.length);
    }
    // Nothing to push and nothing to go up by is one dead end; too few faces for a combo is another.
    inBoth((language) => {
      const lines = [t('levelStuck'), t('levelStranded'), t('levelFloorStuck'), t('levelFloorFaces')];
      expect(new Set(lines).size, language).toBe(lines.length);
    });
    setLanguage('en');
  });
});
