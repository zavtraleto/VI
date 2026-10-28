import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Size } from '../display/sizing';
import { LANGUAGES, setLanguage } from '../ui/i18n';
import { MIN_ZONE, pictureSize } from './layout';
import type { ShellContext } from './screen';
import { MenuScreen } from './screens/menu';
import { shellDefaults } from './theme';
import type { Voice } from './voice';

const nothing = (): void => undefined;
const ACTIONS = { onEndless: nothing, onLevels: nothing, onHowTo: nothing, onReadme: nothing, onRecords: nothing, onSystem: nothing };
const DATA = { bestEndless: 12840, levelsDone: 7, levelsTotal: 34, rules: 8, sessions: 12 };

function context(window: Size, ratio: number, focus: (id: string) => void = nothing): ShellContext {
  const values = shellDefaults();
  const picture = pictureSize({ width: window.width * ratio, height: window.height * ratio }, Number(values.pixelsTall), Number(values.pixelsWide));
  return {
    values,
    window: () => window,
    picture: () => picture,
    safe: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    reducedMotion: () => false,
    voice: {} as Voice,
    sound: nothing,
    focus,
  };
}

const apart = (one: { x: number; y: number; width: number; height: number }, other: typeof one): boolean =>
  one.x + one.width <= other.x || other.x + other.width <= one.x || one.y + one.height <= other.y || other.y + other.height <= one.y;

// The dice of the menu paint their pips on a canvas: here a canvas that keeps nothing will do.
beforeAll(() => {
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect: nothing, fillStyle: '' }) };
  vi.stubGlobal('document', { createElement: () => canvas });
});
afterAll(() => vi.unstubAllGlobals());

describe('the names of the files of the menu', () => {
  it('stand beside their dice on a desk in every language: one for each file, in the window, large enough for a finger, none over another', () => {
    const window = { width: 1920, height: 1080 };
    for (const language of LANGUAGES) {
      setLanguage(language);
      const menu = new MenuScreen(context(window, 1), ACTIONS, DATA);
      const names = menu.items().filter((item) => item.id.startsWith('name-'));
      expect(names.map((item) => item.id).sort(), language).toEqual(['name-howto', 'name-levels', 'name-protocol', 'name-readme', 'name-records', 'name-system']);
      for (const item of names) {
        expect(item.rect.height, language).toBeGreaterThanOrEqual(MIN_ZONE);
        expect(item.rect.x, language).toBeGreaterThanOrEqual(0);
        expect(item.rect.x + item.rect.width, language).toBeLessThanOrEqual(window.width);
      }
      for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) expect(apart(names[a].rect, names[b].rect), `${language} ${names[a].id} ${names[b].id}`).toBe(true);
      menu.dispose();
    }
    setLanguage('en');
  });

  it('stand the figure on their file when pressed', () => {
    const focused: string[] = [];
    const menu = new MenuScreen(context({ width: 1920, height: 1080 }, 1, (id) => focused.push(id)), ACTIONS, DATA);
    menu.items().find((item) => item.id === 'name-records')!.action();
    expect(focused).toEqual(['records']);
    menu.dispose();
  });

  it('are a key under the net on a phone, which is not pressed: the dice are', () => {
    const menu = new MenuScreen(context({ width: 360, height: 640 }, 3), ACTIONS, DATA);
    expect(menu.items().filter((item) => item.id.startsWith('name-'))).toEqual([]);
    menu.dispose();
  });
});
