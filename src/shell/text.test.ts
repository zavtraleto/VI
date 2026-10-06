import { describe, expect, it } from 'vitest';
import { LANGUAGES, languageOf, setLanguage, t } from '../ui/i18n';
import kanji from './fonts/kanji.txt?raw';
import { textWidth } from './layout';
import { MENU_FILES, eraDate, fileLine } from './text';
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
