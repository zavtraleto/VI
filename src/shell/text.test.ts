import { describe, expect, it } from 'vitest';
import { LANGUAGES, languageOf, setLanguage, t, word } from '../ui/i18n';
import { WORDS } from '../ui/lang/words';
import kanji from './fonts/kanji.txt?raw';
import { textWidth } from './layout';
import { COMMANDS, EXEC_NAME, HUD, LADDER, MENU_FILES, PANELS, RECORDS, RESULT, SYSTEM, eraDate, fileLine } from './text';
import source from './text.ts?raw';
import { dayAmount, mixHex, paletteAt, shellDefaults } from './theme';

describe('the Japanese of the shell', () => {
  it('uses only the kanji the cut-down font has: run `npm run fonts` after changing the text', () => {
    const kept = new Set(kanji.trim());
    const used = [...new Set([...source].filter((sign) => sign >= '㐀' && sign <= '鿿'))];
    expect(used.filter((sign) => !kept.has(sign))).toEqual([]);
  });
});

describe('the files of the menu', () => {
  it('are six, one on each face of the die', () => {
    expect(MENU_FILES.map((file) => file.face)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(MENU_FILES.map((file) => file.id)).size).toBe(6);
  });

  it('say how long the session of the day lasts as the rules have it, not in words of their own', () => {
    for (const code of LANGUAGES) {
      setLanguage(code);
      const line = t('shellLimited');
      expect(line, code).not.toMatch(/\d/);
      expect(fileLine(line, 300), code).toContain('05:00');
      expect(fileLine(line, 180), code).toContain('03:00');
    }
    setLanguage('en');
    expect(fileLine('SESSION WITHOUT LIMIT', 300)).toBe('SESSION WITHOUT LIMIT');
  });

  it('have dry lines short enough for the record of a phone, in every language', () => {
    for (const code of LANGUAGES) {
      setLanguage(code);
      for (const file of MENU_FILES) {
        const line = t(file.line);
        expect(line.length, `${file.line} ${code}`).toBeGreaterThan(0);
        expect(textWidth(line), `${file.line} ${code}`).toBeLessThanOrEqual(240);
        // The font of the program has no small letters worth reading at this size.
        expect(line, `${file.line} ${code}`).toBe(line.toLocaleUpperCase(code).replace('{TIME}', '{time}'));
      }
    }
    setLanguage('en');
  });

  it('have names that fit beside their Japanese at twice the size', () => {
    for (const file of MENU_FILES) expect(textWidth(file.name, 2) + 8 + textWidth(file.native)).toBeLessThanOrEqual(240);
  });
});

describe('the language of the player', () => {
  it('is found from what a browser or a platform calls it, and is English where the game does not speak it', () => {
    expect(languageOf('ru')).toBe('ru');
    expect(languageOf('pt-BR')).toBe('pt');
    expect(languageOf('es_419')).toBe('es');
    expect(languageOf('TR')).toBe('tr');
    expect(languageOf('ja')).toBe('en');
    expect(languageOf('')).toBe('en');
  });

  it('has every line said, with the places a number goes to, in every language', () => {
    setLanguage('ru');
    const keys = ['levelStuck', 'levelShort', 'shareScore', 'shellLimited'] as const;
    const places = keys.map((key) => (t(key).match(/\{\w+\}/g) ?? []).sort());
    for (const code of LANGUAGES) {
      setLanguage(code);
      keys.forEach((key, i) => expect((t(key).match(/\{\w+\}/g) ?? []).sort(), `${key} ${code}`).toEqual(places[i]));
    }
    setLanguage('en');
  });

  it('keeps the space French puts before a colon from ending a line', () => {
    setLanguage('fr');
    expect(t('levelShort')).toContain('\u00a0:');
    expect(t('levelShort')).not.toContain(' :');
    setLanguage('en');
  });
});

describe('the words of the program a player presses', () => {
  const names = (group: Record<string, unknown>): string[] =>
    Object.values(group).flatMap((value) => (typeof value === 'string' ? [value] : value && typeof value === 'object' && 'name' in value ? [String(value.name)] : []));
  const said = [...MENU_FILES.map((file) => file.name), EXEC_NAME, HUD.skip.name, ...names(PANELS), ...names(COMMANDS), ...names(RESULT), ...names(SYSTEM), ...names(LADDER), ...RECORDS.modes, RECORDS.empty.name, RECORDS.nameless, RECORDS.you];
  const inEvery = (check: (code: string) => void): void => {
    for (const code of LANGUAGES) {
      setLanguage(code);
      check(code);
    }
    setLanguage('en');
  };

  it('are each in the table of words, in every language, and in capitals', () => {
    for (const name of said) expect(Object.keys(WORDS), name).toContain(name);
    inEvery((code) => {
      for (const name of said) {
        expect(word(name).length, `${name} ${code}`).toBeGreaterThan(0);
        expect(word(name), `${name} ${code}`).toBe(word(name).toLocaleUpperCase(code));
      }
    });
  });

  it('are the words of the program in English, and a word the table does not have is itself', () => {
    expect(word('EXECUTE')).toBe('EXECUTE');
    setLanguage('ru');
    expect(word('EXECUTE')).toBe('ВЫПОЛНИТЬ');
    expect(word('DEUTSCH')).toBe('DEUTSCH');
    setLanguage('en');
  });

  it('fit where the English ones stand: the name of a file, a command, a setting with its value, a reading', () => {
    inEvery((code) => {
      for (const file of MENU_FILES) expect(textWidth(word(file.name), 2) + 8 + textWidth(file.native), `${file.name} ${code}`).toBeLessThanOrEqual(240);
      for (const command of Object.values(COMMANDS)) expect(textWidth(`${command.native} ${word(command.name)}`), `${command.name} ${code}`).toBeLessThanOrEqual(228);
      for (const title of Object.values(PANELS)) expect(textWidth(`${title.native}  ${word(title.name)} 0/0`), `${title.name} ${code}`).toBeLessThanOrEqual(252);
      const values = [SYSTEM.on, SYSTEM.off, SYSTEM.full, SYSTEM.reduced, SYSTEM.swipe, SYSTEM.buttons, SYSTEM.auto, SYSTEM.fixed];
      const widest = Math.max(...values.map((value) => textWidth(word(value))));
      for (const label of [SYSTEM.sound, SYSTEM.motion, SYSTEM.shake, SYSTEM.backdrop, SYSTEM.control, SYSTEM.view, SYSTEM.language]) {
        expect(textWidth(`${label.native} ${word(label.name)}`) + 16 + widest, `${label.name} ${code}`).toBeLessThanOrEqual(226);
      }
      for (const reading of Object.values(RESULT)) expect(textWidth(`${reading.native} ${word(reading.name)}`), `${reading.name} ${code}`).toBeLessThanOrEqual(160);
      // Two readings share a line of a result: the score and the place it took.
      expect(textWidth(`${RESULT.score.native} ${word(RESULT.score.name)}`) + 16 + textWidth(`${RESULT.rank.native} ${word(RESULT.rank.name)}`), code).toBeLessThanOrEqual(248);
      for (const mode of RECORDS.modes) expect(textWidth(word(mode)), `${mode} ${code}`).toBeLessThanOrEqual(112);
    });
  });
});

describe('a date of the program', () => {
  it('is written by the era, as the date of the previous start is', () => {
    expect(eraDate('2001-03-21')).toBe('H13.03.21');
    expect(eraDate('2026-10-03')).toBe('H38.10.03');
  });
});

describe('the colours of the hour', () => {
  it('are darkest in the dead of night and lightest after noon', () => {
    expect(dayAmount(1)).toBeCloseTo(0);
    expect(dayAmount(13)).toBeCloseTo(1);
    expect(dayAmount(7)).toBeCloseTo(0.5);
    expect(dayAmount(25)).toBeCloseTo(dayAmount(1));
  });

  it('mix the night and the day', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#102030', '#102030', 0.3)).toBe('#102030');
    const values = shellDefaults();
    expect(paletteAt(values, 1).bg).toBe(String(values.bgNight));
    expect(paletteAt(values, 13).ink).toBe(String(values.toneDay));
    expect(paletteAt({ ...values, hour: 13 }, 1).bg).toBe(String(values.bgDay));
    expect(paletteAt(values, 13).channels).toHaveLength(6);
  });
});
