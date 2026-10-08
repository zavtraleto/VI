import { describe, expect, it } from 'vitest';
import type { Size } from '../display/sizing';
import { LANGUAGES, setLanguage, word } from '../ui/i18n';
import { MIN_ZONE, pictureSize, textWidth } from './layout';
import type { ShellContext } from './screen';
import { BootScreen } from './screens/boot';
import { StartScreen } from './screens/start';
import { COMMANDS } from './text';
import { shellDefaults } from './theme';
import type { Voice } from './voice';

const nothing = (): void => undefined;

/** A phone held upright and a desk screen: the window in CSS pixels and the pixels of the canvas to one of them. */
const SCREENS: readonly [name: string, window: Size, ratio: number][] = [
  ['phone', { width: 360, height: 640 }, 3],
  ['desk', { width: 1920, height: 1080 }, 1],
];

/** What a screen is given, for a window: the picture is the one the shell would make for it. */
function context(window: Size, ratio: number): ShellContext {
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
    focus: nothing,
  };
}

describe('the screen the program opens on', () => {
  it('has one zone, in focus from the start, and pressing it starts', () => {
    let started = 0;
    const screen = new StartScreen(context(SCREENS[0][1], SCREENS[0][2]), () => started++);
    const items = screen.items();
    expect(items.map((item) => item.id)).toEqual(['start']);
    expect(screen.home).toBe('start');
    items[0].action();
    expect(started).toBe(1);
  });

  it('has a button two fingers tall and half the scene wide, in the middle, on a phone and on a desk', () => {
    setLanguage('en');
    for (const [name, window, ratio] of SCREENS) {
      const { rect } = new StartScreen(context(window, ratio), nothing).items()[0];
      expect(rect.height, name).toBeGreaterThanOrEqual(2 * MIN_ZONE);
      expect(rect.width, name).toBeGreaterThanOrEqual(window.width / 2 - 4);
      expect(rect.width, name).toBeLessThanOrEqual(window.width / 2 + 4);
      expect(Math.abs(rect.x + rect.width / 2 - window.width / 2), name).toBeLessThanOrEqual(4);
      expect(Math.abs(rect.y + rect.height / 2 - window.height / 2), name).toBeLessThanOrEqual(4);
    }
  });

  it('has room for its word at twice the size in every language, and stays on the screen', () => {
    for (const code of LANGUAGES) {
      setLanguage(code);
      for (const [name, window, ratio] of SCREENS) {
        const made = context(window, ratio);
        const { rect } = new StartScreen(made, nothing).items()[0];
        const zoom = window.width / made.picture().width;
        expect(textWidth(word(COMMANDS.start.name), 2) * zoom, `${code} ${name}`).toBeLessThan(rect.width);
        expect(rect.x, `${code} ${name}`).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width, `${code} ${name}`).toBeLessThanOrEqual(window.width);
        expect(rect.height, `${code} ${name}`).toBeGreaterThanOrEqual(2 * MIN_ZONE);
      }
    }
    setLanguage('en');
  });
});

describe('the boot', () => {
  it('has a command to pass it in the bottom right corner the first time on a device, in every language', () => {
    for (const code of LANGUAGES) {
      setLanguage(code);
      for (const [name, window, ratio] of SCREENS) {
        const items = new BootScreen(context(window, ratio), true, nothing).items();
        expect(items.map((item) => item.id), `${code} ${name}`).toEqual(['skip']);
        const { rect } = items[0];
        expect(rect.height, `${code} ${name}`).toBeGreaterThanOrEqual(MIN_ZONE);
        expect(rect.x, `${code} ${name}`).toBeGreaterThan(window.width / 2);
        expect(rect.y, `${code} ${name}`).toBeGreaterThan(window.height / 2);
        expect(rect.x + rect.width, `${code} ${name}`).toBeLessThanOrEqual(window.width);
        expect(rect.y + rect.height, `${code} ${name}`).toBeLessThanOrEqual(window.height);
      }
    }
    setLanguage('en');
  });

  it('is passed by that command, once', () => {
    let done = 0;
    const screen = new BootScreen(context(SCREENS[0][1], SCREENS[0][2]), true, () => done++);
    const [skip] = screen.items();
    skip.action();
    skip.action();
    expect(done).toBe(1);
  });

  it('has no such command on a later start', () => {
    expect(new BootScreen(context(SCREENS[0][1], SCREENS[0][2]), false, nothing).items()).toEqual([]);
  });
});
