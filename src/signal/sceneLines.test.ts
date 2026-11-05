import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../ui/i18n';
import { captionWords } from './caption';
import { CALL_SCENES, CALL_SCENE_COUNT, callFrame, callScene } from './director';
import { seededRandom } from './scene';
import { LINE_CALLS, SCENE_LINES, lineText, linesFor, pickLine } from './sceneLines';

const marks = (text: string) => ({
  bars: (text.match(/\|/g) ?? []).length,
  keys: (text.match(/\[/g) ?? []).length,
  words: captionWords(text).length > 0,
  ones: (text.match(/\[1:/g) ?? []).length,
});

describe('the lines of scenes', () => {
  it('are said in every language, with the same breaks and key words as in Russian', () => {
    for (const line of SCENE_LINES) {
      for (const language of LANGUAGES) {
        const text = line.text[language];
        expect(text, `${line.id} ${language}`).toBeTruthy();
        expect(marks(text), `${line.id} ${language}`).toEqual(marks(line.text.ru));
      }
    }
  });

  it('have ids of their own, and every call has several', () => {
    expect(new Set(SCENE_LINES.map((line) => line.id)).size).toBe(SCENE_LINES.length);
    expect(LINE_CALLS).toBe(CALL_SCENE_COUNT);
    for (let call = 1; call <= LINE_CALLS; call++) expect(SCENE_LINES.filter((line) => line.call === call).length).toBeGreaterThanOrEqual(6);
    expect(SCENE_LINES.every((line) => line.call >= 1 && line.call <= LINE_CALLS)).toBe(true);
  });

  it('say nothing of the seventh place being filled, and no dates of 2001 (the novel goes by variant A)', () => {
    const gone = ['b02', 'b09', 'b12', 'c06', 'd03', 'd10', 'd12'];
    expect(SCENE_LINES.filter((line) => gone.includes(line.id))).toEqual([]);
  });

  it('say nothing twice until every line of the call has been said', () => {
    const heard: string[] = [];
    const random = seededRandom(7);
    const first = SCENE_LINES.filter((line) => line.call === 1).length;
    const said = Array.from({ length: first }, () => pickLine(1, heard, random).id);
    expect(new Set(said).size).toBe(first);
    // The call begins anew.
    pickLine(1, heard, random);
    expect(heard.length).toBe(1);
  });

  it('go back to an earlier call only when the later one is all heard', () => {
    const heard = SCENE_LINES.filter((line) => line.call === 3).map((line) => line.id);
    expect(linesFor(3, heard).lines.every((line) => line.call === 2)).toBe(true);
    expect(linesFor(3, []).lines.every((line) => line.call === 3)).toBe(true);
  });

  it('fall back to English where a language has no words', () => {
    const line = { ...SCENE_LINES[0], text: { ...SCENE_LINES[0].text, de: '' } };
    expect(lineText(line, 'de')).toBe(line.text.en);
  });
});

describe('the scenes of the calls', () => {
  it('give every call a place of its own, with the telephone in it', () => {
    expect(new Set(CALL_SCENES.map((scene) => scene.place)).size).toBe(CALL_SCENE_COUNT);
    for (let call = 1; call <= CALL_SCENE_COUNT; call++) {
      const frame = callFrame(call);
      expect(frame.recipe.place).toBe(callScene(call).place);
      expect(frame.recipe.things).toContain('phone');
    }
  });

  it('are the same every time, and a call past the last shows the last', () => {
    expect(callFrame(3)).toEqual(callFrame(3));
    expect(callScene(0)).toBe(CALL_SCENES[0]);
    expect(callScene(99)).toBe(CALL_SCENES[CALL_SCENE_COUNT - 1]);
  });

  it('keep the red sun for the last call', () => {
    for (let call = 1; call < CALL_SCENE_COUNT; call++) expect(callFrame(call).recipe.things, `call ${call}`).not.toContain('sun');
    expect(callFrame(CALL_SCENE_COUNT).recipe.things).toContain('sun');
  });
});
