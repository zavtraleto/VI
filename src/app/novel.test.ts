import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../ui/i18n';
import { novelEpisode } from '../ui/novel';
import { NOVEL, novelDue, novelKey, novelNext } from './novel';

describe('the records of the link', () => {
  it('are seven, acts I and II, one every 20 stars, in order', () => {
    expect(NOVEL.map((entry) => entry.code)).toEqual(['n01', 'n02', 'n03', 'n04', 'n05', 'n06', 'n07']);
    expect(NOVEL.map((entry) => entry.stars)).toEqual([20, 40, 60, 80, 100, 120, 140]);
  });

  it('are kept among the windows told as novel:<code>', () => {
    expect(novelKey('n02')).toBe('novel:n02');
  });
});

describe('the record due', () => {
  it('is none before the first star', () => {
    expect(novelDue(0, [])).toBeUndefined();
  });

  it('is the one the sum has come to, and none once its window was shown, skipped or seen', () => {
    expect(novelDue(19, [])).toBeUndefined();
    expect(novelDue(20, [])?.code).toBe('n01');
    expect(novelDue(39, [novelKey('n01')])).toBeUndefined();
    expect(novelDue(40, [novelKey('n01')])?.code).toBe('n02');
  });

  it('is the lower first where the sum has passed two at once; the other comes on the next passage', () => {
    expect(novelDue(45, [])?.code).toBe('n01');
    expect(novelDue(45, [novelKey('n01')])?.code).toBe('n02');
    expect(novelDue(300, [novelKey('n01'), novelKey('n02')])?.code).toBe('n03');
    expect(novelDue(130, ['n01', 'n02', 'n03', 'n04', 'n05'].map(novelKey))?.code).toBe('n06');
    expect(novelDue(300, NOVEL.map((entry) => novelKey(entry.code)))).toBeUndefined();
  });

  it('pays no heed to other windows told', () => {
    expect(novelDue(20, ['live:L1', 'end:100'])?.code).toBe('n01');
  });
});

describe('the record next', () => {
  it('is the first the sum has not come to, with the stars still wanting', () => {
    expect(novelNext(0)).toEqual({ entry: NOVEL[0], number: 1, left: 20 });
    expect(novelNext(20)).toEqual({ entry: NOVEL[1], number: 2, left: 20 });
    expect(novelNext(37)).toEqual({ entry: NOVEL[1], number: 2, left: 3 });
    expect(novelNext(59)).toEqual({ entry: NOVEL[2], number: 3, left: 1 });
    expect(novelNext(60)).toEqual({ entry: NOVEL[3], number: 4, left: 20 });
    expect(novelNext(139)).toEqual({ entry: NOVEL[6], number: 7, left: 1 });
  });

  it('is none once the sum has come to the last', () => {
    expect(novelNext(140)).toBeUndefined();
    expect(novelNext(300)).toBeUndefined();
  });
});

describe('what a record says', () => {
  it('is there for every record in every language, a title and lines, the same voices in Russian and English', () => {
    for (const { code } of NOVEL) {
      for (const language of LANGUAGES) {
        const episode = novelEpisode(code, language);
        expect(episode?.title, `${code} ${language}`).toBeTruthy();
        expect(episode?.lines.length, `${code} ${language}`).toBeGreaterThan(0);
      }
      expect(novelEpisode(code, 'ru')?.lines.map((line) => line.who)).toEqual(novelEpisode(code, 'en')?.lines.map((line) => line.who));
    }
    expect(novelEpisode('n01', 'de')).toEqual(novelEpisode('n01', 'en'));
    expect(novelEpisode('n99', 'en')).toBeUndefined();
  });

  it('has the other side speak in small letters', () => {
    for (const { code } of NOVEL) for (const line of novelEpisode(code, 'ru')!.lines) if (line.who === 'voice') expect(line.text).toBe(line.text.toLowerCase());
  });
});
