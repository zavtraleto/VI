import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../ui/i18n';
import { captionWords } from './caption';
import { SCENE_STEPS, STEP_LOOKS, lightFrame, stepFrame, stepLook } from './director';
import { seededRandom } from './scene';
import { LINE_TIERS, SCENE_LINES, lineText, linesFor, pickLine } from './sceneLines';

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

  it('have ids of their own, and every tier has many', () => {
    expect(new Set(SCENE_LINES.map((line) => line.id)).size).toBe(SCENE_LINES.length);
    for (let tier = 1; tier <= LINE_TIERS; tier++) expect(SCENE_LINES.filter((line) => line.tier === tier).length).toBeGreaterThanOrEqual(12);
  });

  it('say nothing twice until every line of the tier has been said', () => {
    const heard: string[] = [];
    const random = seededRandom(7);
    const tierOne = SCENE_LINES.filter((line) => line.tier === 1).length;
    const said = Array.from({ length: tierOne }, () => pickLine(1, heard, random).id);
    expect(new Set(said).size).toBe(tierOne);
    // The tier begins anew.
    pickLine(1, heard, random);
    expect(heard.length).toBe(1);
  });

  it('go back to an earlier tier only when the later one is all heard', () => {
    const heard = SCENE_LINES.filter((line) => line.tier === 3).map((line) => line.id);
    expect(linesFor(3, heard).lines.every((line) => line.tier === 2)).toBe(true);
    expect(linesFor(3, []).lines.every((line) => line.tier === 3)).toBe(true);
  });

  it('fall back to English where a language has no words', () => {
    const line = { ...SCENE_LINES[0], text: { ...SCENE_LINES[0].text, de: '' } };
    expect(lineText(line, 'de')).toBe(line.text.en);
  });
});

describe('the steps of scenes', () => {
  it('go from light to dark: the contact and the merge never fall back, the tier of words neither', () => {
    expect(STEP_LOOKS).toHaveLength(SCENE_STEPS);
    for (let i = 1; i < STEP_LOOKS.length; i++) {
      expect(STEP_LOOKS[i].contact).toBeGreaterThanOrEqual(STEP_LOOKS[i - 1].contact);
      expect(STEP_LOOKS[i].mixing).toBeGreaterThanOrEqual(STEP_LOOKS[i - 1].mixing);
      expect(STEP_LOOKS[i].tier).toBeGreaterThanOrEqual(STEP_LOOKS[i - 1].tier);
    }
    expect(stepLook(0)).toBe(STEP_LOOKS[0]);
    expect(stepLook(99)).toBe(STEP_LOOKS[SCENE_STEPS - 1]);
  });

  it('show the first live sessions a light day by the sea or in the field, empty or with its own thing', () => {
    const random = seededRandom(3);
    for (let i = 0; i < 50; i++) {
      const frame = stepFrame(random, 1);
      expect(['sea', 'field']).toContain(frame.recipe.place);
      expect(frame.mixing).toBe(1);
      expect(frame.recipe.things.length).toBeLessThanOrEqual(1);
      expect(frame.values.glint).toBe(0);
    }
  });

  it('bring one stranger to the light day, and never a mannequin', () => {
    const random = seededRandom(5);
    for (let i = 0; i < 50; i++) {
      const frame = lightFrame(random, true);
      expect(frame.recipe.things).not.toContain('mannequin');
      expect(frame.recipe.things.length).toBe(2);
    }
  });

  it('keep the red sun for the last step', () => {
    const random = seededRandom(9);
    for (let step = 1; step < SCENE_STEPS; step++) {
      for (let i = 0; i < 40; i++) {
        const frame = stepFrame(random, step);
        expect(frame.recipe.things, `step ${step}`).not.toContain('sun');
        expect(frame.recipe.place, `step ${step}`).not.toBe('glare');
      }
    }
  });
});
