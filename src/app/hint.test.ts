import { describe, expect, it } from 'vitest';
import { fileBoard } from '../levels/boardFiles';
import { CAMPAIGN } from '../levels/campaign';
import { defaultConfig } from '../rules/config';
import { createRun } from '../rules/sim';
import type { LevelSpec } from '../rules/types';
import { HINT_WORD_MS, captionWords, plainCaption, wordsShown } from '../signal/caption';
import { LANGUAGES, setLanguage, t, type TextKey } from '../ui/i18n';
import { DEAD_ENDS_FOR_SIGN, DeadEnds, endDue, endKey, probeHint, tellsHint } from './hint';
import { roadWait } from './signWay';

describe('the hints of the boards', () => {
  // The hints of the boards that teach a move, shown in a window before the board starts.
  const pieces: [string, { key: string }][] = CAMPAIGN.flatMap((place) => (place.help.hint ? [[place.code, { key: place.help.hint }] as [string, { key: string }]] : []));

  it('have their text in every one of the seven languages, in at most ten words, with no exclamation mark', () => {
    for (const code of LANGUAGES) {
      setLanguage(code);
      for (const [id, hint] of pieces) {
        const line = t(hint.key as TextKey);
        expect(line.length, `${id} ${code}`).toBeGreaterThan(0);
        expect(line.split(/\s+/).length, `${id} ${code}: ${line}`).toBeLessThanOrEqual(10);
        expect(line, `${id} ${code}`).not.toMatch(/[!！]/);
      }
    }
    setLanguage('en');
  });

  it('differ from one another and from the lines of a session that have names close to theirs', () => {
    for (const code of LANGUAGES) {
      setLanguage(code);
      const lines = [t('roadHintChain'), t('roadHintWalk'), t('roadHintPush'), t('roadHintClimb'), t('hintSeven')];
      expect(new Set(lines).size, code).toBe(5);
      expect(lines, code).not.toContain(t('hintChain'));
    }
    setLanguage('en');
  });

  it('are told once for a board', () => {
    expect(tellsHint('R07', [])).toBe(true);
    expect(tellsHint('R07', ['R11'])).toBe(true);
    expect(tellsHint('R07', ['R07'])).toBe(false);
  });
});

describe('the end of the row', () => {
  it('is said when every board of the row is passed, once for the length of the row', () => {
    const passed = { A: true, B: true };
    expect(endKey(2)).toBe('end:2');
    expect(endDue(passed, ['A', 'B'], [])).toBe(true);
    expect(endDue(passed, ['A', 'B'], ['end:2'])).toBe(false);
    expect(endDue({ A: true }, ['A', 'B'], [])).toBe(false);
    expect(endDue({ A: true, B: false }, ['A', 'B'], [])).toBe(false);
    // New boards make the row longer: when they are passed too, it is said again.
    expect(endDue({ A: true, B: true, C: true }, ['A', 'B', 'C'], ['end:2'])).toBe(true);
  });

  it('names its link once, in braces, in every language', () => {
    for (const code of LANGUAGES) {
      setLanguage(code);
      const text = t('campaignEnd');
      expect(text.match(/\{[^{}]+\}/g)?.length, code).toBe(1);
      expect(captionWords(text).some((word) => word.link), code).toBe(true);
      expect(plainCaption(text), code).not.toMatch(/[{}]/);
    }
    setLanguage('en');
  });
});

describe('the hint of the address of development', () => {
  it('is found by its short name or the name of its key, and is nothing for any other', () => {
    expect(probeHint('hintChain')).toEqual({ key: 'roadHintChain' });
    expect(probeHint('roadHintWalk')).toEqual({ key: 'roadHintWalk' });
    expect(probeHint('push')).toEqual({ key: 'roadHintPush' });
    expect(probeHint('roadHintClimb')).toEqual({ key: 'roadHintClimb' });
    expect(probeHint('seven')).toEqual({ key: 'hintSeven' });
    expect(probeHint('hintLinkMove')).toEqual({ key: 'hintLinkMove' });
    expect(probeHint('hintOne')).toBeNull();
    expect(probeHint('')).toBeNull();
    expect(probeHint(null)).toBeNull();
  });
});

describe('the dead ends of a piece', () => {
  it('are counted, and the second one is the first that hurries the sign', () => {
    const ends = new DeadEnds();
    ends.begin('R05');
    expect(ends.hurries).toBe(false);
    expect(ends.reach()).toBe(1);
    expect(ends.hurries).toBe(false);
    expect(ends.reach()).toBe(DEAD_ENDS_FOR_SIGN);
    expect(ends.hurries).toBe(true);
  });

  it('are not forgotten by a try started over, or a move taken back, which begin the same piece again', () => {
    const ends = new DeadEnds();
    ends.begin('R05');
    ends.reach();
    ends.begin('R05');
    expect(ends.count).toBe(1);
    ends.reach();
    ends.begin('R05');
    expect(ends.count).toBe(2);
    expect(ends.hurries).toBe(true);
  });

  it('are forgotten when another piece or level begins, or when the piece is passed', () => {
    const ends = new DeadEnds();
    ends.begin('R05');
    ends.reach();
    ends.reach();
    ends.begin('R06');
    expect(ends.count).toBe(0);
    expect(ends.hurries).toBe(false);
    ends.reach();
    ends.begin('P01');
    expect(ends.count).toBe(0);
    ends.reach();
    ends.reach();
    ends.forget();
    ends.begin('P01');
    expect(ends.count).toBe(0);
  });

  it('bring the sign at once to a piece that begins again, and not to one that has had none', () => {
    const spec: LevelSpec = fileBoard('R03');
    const state = createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
    expect(roadWait({ wait: 'free' }, false)!.frame(state, 0, true)).toEqual({ dir: null, blink: false });
    // Standing on the board the first moment, with no wait at all.
    expect(roadWait({ wait: 'free' }, true)!.frame(state, 0, true)).toEqual({ dir: 'E', blink: false });
  });
});

describe('the words of a hint', () => {
  const line = 'Тусклая кость стоит. Шагни на другую.';

  it('come one at a time: the first at once, one more every 180 ms, and then the whole line', () => {
    expect(HINT_WORD_MS).toBe(180);
    expect(wordsShown(line, 0)).toBe('Тусклая');
    expect(wordsShown(line, 179)).toBe('Тусклая');
    expect(wordsShown(line, 180)).toBe('Тусклая кость');
    expect(wordsShown(line, 180 * 4)).toBe('Тусклая кость стоит. Шагни на');
    expect(wordsShown(line, 180 * 5)).toBe(line);
    expect(wordsShown(line, 60_000)).toBe(line);
    expect(wordsShown(line, -50)).toBe('Тусклая');
  });

  it('are always the start of the line as it is written, so each stands where it will in the whole line', () => {
    for (const code of LANGUAGES) {
      setLanguage(code);
      for (const key of ['roadHintChain', 'roadHintWalk', 'roadHintPush', 'roadHintClimb', 'hintSeven', 'hintLinkMove'] as const) {
        const text = t(key);
        const count = text.split(' ').length;
        for (let n = 0; n <= count; n++) expect(text.startsWith(wordsShown(text, n * HINT_WORD_MS)), `${key} ${code}`).toBe(true);
        expect(wordsShown(text, (count - 1) * HINT_WORD_MS)).toBe(text);
      }
    }
    setLanguage('en');
  });

  it('wait as long as they are told to, and are all there at once where a word is given no time', () => {
    expect(wordsShown('a b c', 250, 100)).toBe('a b c');
    expect(wordsShown('a b c', 150, 100)).toBe('a b');
    expect(wordsShown('a b c', 0, 0)).toBe('a b c');
    expect(wordsShown('', 0)).toBe('');
  });
});

