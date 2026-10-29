import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Size } from '../display/sizing';
import { LANGUAGES, setLanguage } from '../ui/i18n';
import { MIN_ZONE, pictureSize, type Box, type MenuLayout } from './layout';
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

type Rect = { x: number; y: number; width: number; height: number };

/** How far two rectangles reach into each other: the smaller of how far across and how far down, 0 where they do not meet. */
const reach = (one: Rect, other: Rect): number =>
  Math.max(0, Math.min(Math.min(one.x + one.width, other.x + other.width) - Math.max(one.x, other.x), Math.min(one.y + one.height, other.y + other.height) - Math.max(one.y, other.y)));

const meet = (one: Box, other: Box): boolean => one.x < other.x + other.w && other.x < one.x + one.w && one.y < other.y + other.h && other.y < one.y + one.h;

/** A phone held upright and a desk screen: the window in CSS pixels and the pixels of the canvas to one of them. */
const SCREENS: readonly [name: string, window: Size, ratio: number][] = [
  ['phone', { width: 360, height: 640 }, 3],
  ['desk', { width: 1920, height: 1080 }, 1],
];

/** What the screen has worked out for its picture: the blocks of the menu, where the dice hang, the key under them. */
interface Plan {
  layout: MenuLayout;
  zoom: number;
  names: { net: Box; key: Box | null };
}
const planOf = (menu: MenuScreen): Plan => (menu as unknown as { plan(): Plan }).plan();

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
      // Two names a row apart may reach over each other by a step of the grid: the nearer middle takes the press.
      const { zoom } = planOf(menu);
      for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) expect(reach(names[a].rect, names[b].rect), `${language} ${names[a].id} ${names[b].id}`).toBeLessThanOrEqual(4 * zoom + 1e-6);
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

describe('the main menu', () => {
  it('has every zone in the window, a finger large, none reaching over another by more than a step of the grid, on a phone and on a desk', () => {
    setLanguage('en');
    for (const [name, window, ratio] of SCREENS) {
      const menu = new MenuScreen(context(window, ratio), ACTIONS, DATA);
      const { zoom } = planOf(menu);
      const items = menu.items();
      for (const { id, rect } of items) {
        expect(rect.x, `${name} ${id}`).toBeGreaterThanOrEqual(0);
        expect(rect.y, `${name} ${id}`).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width, `${name} ${id}`).toBeLessThanOrEqual(window.width + 1e-6);
        expect(rect.y + rect.height, `${name} ${id}`).toBeLessThanOrEqual(window.height + 1e-6);
        expect(rect.height, `${name} ${id}`).toBeGreaterThanOrEqual(MIN_ZONE);
      }
      for (let a = 0; a < items.length; a++) {
        for (let b = a + 1; b < items.length; b++) {
          expect(reach(items[a].rect, items[b].rect), `${name} ${items[a].id} ${items[b].id}`).toBeLessThanOrEqual(4 * zoom + 1e-6);
        }
      }
      menu.dispose();
    }
  });

  it('has square zones a finger wide on the dice and on the arrows of the record', () => {
    for (const [name, window, ratio] of SCREENS) {
      const menu = new MenuScreen(context(window, ratio), ACTIONS, DATA);
      for (const { id, rect } of menu.items().filter((item) => !item.id.startsWith('name-') && item.id !== 'exec')) {
        expect(rect.width, `${name} ${id}`).toBeGreaterThanOrEqual(MIN_ZONE);
        expect(rect.width, `${name} ${id}`).toBeCloseTo(rect.height);
      }
      menu.dispose();
    }
  });

  it('keeps the header, the dice, the key and the record apart', () => {
    for (const [name, window, ratio] of SCREENS) {
      const menu = new MenuScreen(context(window, ratio), ACTIONS, DATA);
      const { layout, names } = planOf(menu);
      const blocks: [string, Box | null][] = [
        ['header', layout.header.box],
        ['dice', names.net],
        ['key', names.key],
        ['subject', layout.subject],
        ['record', layout.record],
      ];
      const present = blocks.filter((block): block is [string, Box] => block[1] !== null);
      for (let a = 0; a < present.length; a++) {
        for (let b = a + 1; b < present.length; b++) expect(meet(present[a][1], present[b][1]), `${name} ${present[a][0]} ${present[b][0]}`).toBe(false);
      }
      menu.dispose();
    }
  });

  it('has a key of three rows under the dice of a phone, a gap of the grid from them', () => {
    const menu = new MenuScreen(context({ width: 360, height: 640 }, 3), ACTIONS, DATA);
    const { layout, names } = planOf(menu);
    expect(names.net).toEqual({ x: 8, y: 52, w: 254, h: 186 });
    expect(names.key).toEqual({ x: 8, y: 246, w: 254, h: 68 });
    expect(names.key!.y + names.key!.h + 8).toBe(layout.record.y);
    menu.dispose();
  });

  it('puts the arrows of the record in its top corners, as large as a finger: 36 dots on a phone, 24 on a desk', () => {
    const sides: Record<string, number> = { phone: 36, desk: 24 };
    for (const [name, window, ratio] of SCREENS) {
      const side = sides[name];
      const menu = new MenuScreen(context(window, ratio), ACTIONS, DATA);
      const { layout, zoom } = planOf(menu);
      const items = menu.items();
      const prev = items.find((item) => item.id === 'prev')!.rect;
      const next = items.find((item) => item.id === 'next')!.rect;
      const { record } = layout;
      expect(prev, name).toEqual({ x: record.x * zoom, y: record.y * zoom, width: side * zoom, height: side * zoom });
      expect(next.x + next.width, name).toBeCloseTo((record.x + record.w) * zoom);
      menu.dispose();
    }
  });
});
