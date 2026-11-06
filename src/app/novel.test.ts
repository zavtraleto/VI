import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../ui/i18n';
import { novelEpisode } from '../ui/novel';
import { NOVEL, novelDue, novelKey, novelNext } from './novel';

describe('the records of the link', () => {
  it('are fifteen, acts I to IV, one every 20 stars, in order, the last on all the stars of the row', () => {
    expect(NOVEL.map((entry) => entry.code)).toEqual(Array.from({ length: 15 }, (_, i) => `n${String(i + 1).padStart(2, '0')}`));
    expect(NOVEL.map((entry) => entry.stars)).toEqual(Array.from({ length: 15 }, (_, i) => (i + 1) * 20));
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
    expect(novelNext(140)?.entry.code).toBe('n08');
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

  it('has the other side speak in small letters till act IV, and from act III his lines lose their capitals; in act IV hers have them', () => {
    const lines = (from: number, to: number) => NOVEL.slice(from, to).flatMap(({ code }) => novelEpisode(code, 'ru')!.lines);
    const small = (text: string) => text === text.toLowerCase();
    for (const line of lines(0, 11)) if (line.who === 'voice') expect(line.text).toBe(line.text.toLowerCase());
    expect(lines(9, 11).filter((line) => line.who === 'operator').every((line) => small(line.text))).toBe(true);
    expect(lines(11, 14).filter((line) => line.who === 'voice').every((line) => !small(line.text))).toBe(true);
    expect(lines(11, 14).filter((line) => line.who === 'operator').every((line) => small(line.text))).toBe(true);
  });

  it('ends act III with her wish to get out and his «we hear», the words of the other side in 01', () => {
    const last = (code: string) => novelEpisode(code, 'ru')!.lines.at(-1)!;
    expect(novelEpisode('n11', 'ru')!.lines.some((line) => line.who === 'voice' && line.text === 'я хочу выйти.')).toBe(true);
    expect(last('n11')).toEqual({ who: 'operator', text: '…мы слышим.' });
    expect(novelEpisode('n01', 'ru')!.lines.some((line) => line.text === '…мы слышим.')).toBe(true);
  });
});
