import { describe, expect, it } from 'vitest';
import { NOVEL } from '../app/novel';
import { LANGUAGES } from '../ui/i18n';
import { novelEpisode } from '../ui/novel';
import { MOOD_SPRITES, RECORD_MOODS, moodAt, spriteOf } from './sprites';

describe('the moods of the voice in the records', () => {
  it('are said for every line of a record of act II, in every language, and are moods there is a picture of', () => {
    for (const code of ['n04', 'n05', 'n06', 'n07']) {
      const moods = RECORD_MOODS[code];
      expect(moods, code).toBeDefined();
      for (const language of LANGUAGES) expect(moods.length, `${code} ${language}`).toBe(novelEpisode(code, language)?.lines.length);
      for (const mood of moods) expect(MOOD_SPRITES[mood], `${code} ${mood}`).toBeDefined();
    }
  });

  it('are none in act I: its silhouette keeps the one picture', () => {
    for (const code of ['n01', 'n02', 'n03']) {
      expect(RECORD_MOODS[code]).toBeUndefined();
      expect(spriteOf(moodAt(code, 0))).toBe(spriteOf());
    }
  });

  it('are said only for records there are', () => {
    const codes = NOVEL.map((entry) => entry.code);
    for (const code of Object.keys(RECORD_MOODS)) expect(codes).toContain(code);
  });

  it('give a line past the end the last mood, and her face on the line where he says she looks at him is the direct one', () => {
    expect(moodAt('n04', 99)).toBe('stare');
    expect(moodAt('n04', 6)).toBe('stare');
    expect(moodAt('n06', 2)).toBe('longing');
  });
});
