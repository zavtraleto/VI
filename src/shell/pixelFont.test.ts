import { describe, expect, it } from 'vitest';
import { WORDS } from '../ui/lang/words';
import { LANGUAGES, setLanguage, t } from '../ui/i18n';
import { glyphAdvance, glyphOf } from './pixelFont';
import { MENU_FILES } from './text';

/** Letters of the scripts the program draws itself: Latin with its marks, and Cyrillic. */
const DRAWN = /[A-Za-zÀ-ɏЀ-џ]/u;

describe('the letters of the program', () => {
  it('are drawn for every word the program writes in its own font, in every language', () => {
    const words: string[] = [];
    for (const entry of Object.entries(WORDS)) words.push(entry[0], ...Object.values(entry[1] as Record<string, string>));
    for (const language of LANGUAGES) {
      setLanguage(language);
      for (const file of MENU_FILES) words.push(t(file.line));
    }
    setLanguage('en');
    const missing = new Set<string>();
    for (const text of words) for (const sign of text) if (DRAWN.test(sign) && !glyphOf(sign)) missing.add(sign);
    expect([...missing]).toEqual([]);
  });

  it('have the figures all as wide, so numbers stand in columns', () => {
    const widths = new Set([...'0123456789'].map((sign) => glyphAdvance(sign)));
    expect([...widths]).toEqual([7]);
  });

  it('keep every dot inside the sixteen rows of a line, every row of a sign as wide as the others', () => {
    for (const sign of 'AÁÄÉÇŞĞİЁЙДЦЩgjpqyçşğфщ¿¡,;_') {
      const glyph = glyphOf(sign)!;
      expect(glyph.top, sign).toBeGreaterThanOrEqual(0);
      expect(glyph.top + glyph.rows.length, sign).toBeLessThanOrEqual(16);
      for (const row of glyph.rows) expect(row.length, sign).toBe(glyph.rows[0].length);
    }
  });

  it('draw the kana and the arrows, and leave kanji and the rest to the font of the program', () => {
    for (const sign of 'あがぱっアガパッー←→↑↓') expect(glyphOf(sign), sign).not.toBeNull();
    for (const sign of '記録…') expect(glyphOf(sign)).toBeNull();
  });

  it('give every full sign of kana the same width, and keep a voiced one inside the line', () => {
    for (const sign of 'あいうかがぱアガパンー') {
      const glyph = glyphOf(sign)!;
      expect(glyph.rows[0].length, sign).toBe(11);
      expect(glyph.top + glyph.rows.length, sign).toBeLessThanOrEqual(14);
    }
  });
});
