import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Size } from '../display/sizing';
import { LANGUAGES, setLanguage } from '../ui/i18n';
import { MIN_ZONE, pictureSize, type Box } from './layout';
import type { ShellContext } from './screen';
import { MenuScreen, type MenuActions } from './screens/menu';
import { shellDefaults } from './theme';
import type { Voice } from './voice';

const nothing = (): void => undefined;
const DATA = { bestEndless: 870, levelsDone: 7, levelsTotal: 100, rules: 9, sessions: 12, storyOpen: 1, storyTotal: 3, language: 'ENGLISH', place: 8 };

/** Actions that write down which one ran. */
function recorded(): { actions: MenuActions; ran: string[] } {
  const ran: string[] = [];
  const say = (name: string) => () => void ran.push(name);
  return {
    ran,
    actions: { onEndless: say('endless'), onLevels: say('levels'), onHowTo: say('howto'), onReadme: say('readme'), onRecords: say('records'), onSystem: say('system'), onPlay: say('play') },
  };
}

function context(window: Size, ratio: number, focus: (id: string) => void = nothing, coarse = false): ShellContext {
  const values = shellDefaults();
  const picture = pictureSize({ width: window.width * ratio, height: window.height * ratio }, Number(values.pixelsTall), Number(values.pixelsWide));
  return {
    values,
    window: () => window,
    picture: () => picture,
    safe: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    reducedMotion: () => false,
    coarse: () => coarse,
    voice: {} as Voice,
    sound: nothing,
    focus,
  };
}

const meet = (one: Box, other: Box): boolean => one.x < other.x + other.w && other.x < one.x + one.w && one.y < other.y + other.h && other.y < one.y + one.h;
const inside = (inner: Box, outer: Box): boolean => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

/** A phone held upright and a desk screen: the window in CSS pixels and the pixels of the canvas to one of them. */
const PHONE: [Size, number] = [{ width: 360, height: 640 }, 3];
const DESK: [Size, number] = [{ width: 1920, height: 1080 }, 1];
/** A small window of a desk, near 4:3: its picture 512 by 384, narrower than three cards a side want. */
const SMALL: [Size, number] = [{ width: 1024, height: 768 }, 1];

type DeskPlan = { kind: 'desk'; net: Box; command: Box; cards: { file: { id: string }; box: Box }[] };
type PhonePlan = { kind: 'phone'; net: Box; card: Box; prev: Box; next: Box; command: Box; dots: number };
const planOf = <P>(menu: MenuScreen): P => (menu as unknown as { plan(): P }).plan();

// The dice of the menu paint their pips on a canvas: here a canvas that keeps nothing will do.
beforeAll(() => {
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect: nothing, fillStyle: '' }) };
  vi.stubGlobal('document', { createElement: () => canvas });
});
afterAll(() => vi.unstubAllGlobals());

describe('the main menu on a desk', () => {
  it('stands as the spec lays it out at 1920 by 1080: three cards a side, the dice between them, the command under the dice', () => {
    const menu = new MenuScreen(context(...DESK), recorded().actions, DATA);
    const plan = planOf<DeskPlan>(menu);
    expect(plan.kind).toBe('desk');
    expect(plan.net).toEqual({ x: 192, y: 40, w: 256, h: 256 });
    expect(plan.command).toEqual({ x: 192, y: 304, w: 256, h: 40 });
    const at = (id: string): Box => plan.cards.find((card) => card.file.id === id)!.box;
    expect([at('howto'), at('records'), at('system')]).toEqual([40, 164, 288].map((y) => ({ x: 8, y, w: 160, h: 56 })));
    expect([at('protocol'), at('levels'), at('readme')]).toEqual([40, 164, 288].map((y) => ({ x: 472, y, w: 160, h: 56 })));
    menu.dispose();
  });

  it('keeps the logo, the cards, the dice and the command apart and in the picture', () => {
    const menu = new MenuScreen(context(...DESK), recorded().actions, DATA);
    const plan = planOf<DeskPlan>(menu);
    const whole: Box = { x: 0, y: 0, w: 640, h: 360 };
    const blocks: [string, Box][] = [['logo', { x: 8, y: 8, w: 96, h: 16 }], ['dice', plan.net], ['command', plan.command], ...plan.cards.map((card): [string, Box] => [card.file.id, card.box])];
    for (const [name, box] of blocks) expect(inside(box, whole), name).toBe(true);
    for (let a = 0; a < blocks.length; a++) for (let b = a + 1; b < blocks.length; b++) expect(meet(blocks[a][1], blocks[b][1]), `${blocks[a][0]} ${blocks[b][0]}`).toBe(false);
    menu.dispose();
  });

  it('opens a file at once by its card or by its die, the two one zone; the command starts the place', () => {
    const { actions, ran } = recorded();
    const menu = new MenuScreen(context(...DESK), actions, DATA);
    const items = menu.items();
    const records = items.filter((item) => item.id === 'records');
    expect(records).toHaveLength(2);
    for (const item of records) {
      expect(item.confirm).toBeFalsy();
      item.action();
    }
    items.find((item) => item.id === 'play')!.action();
    expect(ran).toEqual(['records', 'records', 'play']);
    for (const { id, rect } of items) {
      expect(rect.height, id).toBeGreaterThanOrEqual(MIN_ZONE);
      expect(rect.x, id).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width, id).toBeLessThanOrEqual(1920 + 1e-6);
    }
    menu.dispose();
  });

  it('opens with the focus on the command and the figure on the levels, or on the file the player came back from', () => {
    const menu = new MenuScreen(context(...DESK), recorded().actions, DATA);
    expect(menu.home).toBe('play');
    expect(menu.move('play', 'up')).toBe('levels');
    menu.dispose();
    const back = new MenuScreen(context(...DESK), recorded().actions, DATA, 'system');
    expect(back.move('play', 'up')).toBe('system');
    back.dispose();
  });

  it('walks the net with the keys, and goes down to the command where the net ends', () => {
    const menu = new MenuScreen(context(...DESK), recorded().actions, DATA);
    expect(menu.move('levels', 'up')).toBe('protocol');
    expect(menu.move('levels', 'left')).toBe('howto');
    expect(menu.move('levels', 'down')).toBe('records');
    expect(menu.move('system', 'down')).toBe('play');
    expect(menu.swipe('left')).toBeNull();
    menu.dispose();
  });

  it('keeps the desk in a small window where a mouse points, its columns as narrow as its longest line in every language', () => {
    for (const language of LANGUAGES) {
      setLanguage(language);
      const menu = new MenuScreen(context(...SMALL), recorded().actions, DATA);
      const plan = planOf<DeskPlan>(menu);
      expect(plan.kind, language).toBe('desk');
      const whole: Box = { x: 0, y: 0, w: 512, h: 384 };
      const blocks: [string, Box][] = [['dice', plan.net], ['command', plan.command], ...plan.cards.map((card): [string, Box] => [card.file.id, card.box])];
      for (const [name, box] of blocks) expect(inside(box, whole), `${language} ${name}`).toBe(true);
      for (let a = 0; a < blocks.length; a++) for (let b = a + 1; b < blocks.length; b++) expect(meet(blocks[a][1], blocks[b][1]), `${language} ${blocks[a][0]} ${blocks[b][0]}`).toBe(false);
      expect(plan.net.w, language).toBeGreaterThanOrEqual(128);
      menu.dispose();
    }
    setLanguage('en');
    // Narrower still, the columns go in: a picture 450 wide is too narrow for cards 160 wide.
    const narrow = new MenuScreen(context({ width: 900, height: 700 }, 1), recorded().actions, DATA);
    const squeezed = planOf<DeskPlan>(narrow);
    expect(squeezed.kind).toBe('desk');
    expect(squeezed.cards[0].box.w).toBeLessThan(160);
    narrow.dispose();
    // Where a finger points, the same window is a phone's.
    const touch = new MenuScreen(context(...SMALL, nothing, true), recorded().actions, DATA);
    expect(planOf<PhonePlan>(touch).kind).toBe('phone');
    touch.dispose();
  });
});

describe('the main menu on a phone', () => {
  it('has one card at the bottom with its command, the dots under it, its neighbours a gap away at the sides', () => {
    const menu = new MenuScreen(context(...PHONE), recorded().actions, DATA);
    const plan = planOf<PhonePlan>(menu);
    const picture = { x: 0, y: 0, w: 270, h: 480 };
    expect(plan.kind).toBe('phone');
    expect(plan.card).toEqual({ x: 23, y: 332, w: 224, h: 128 });
    expect(inside(plan.card, picture)).toBe(true);
    expect(inside(plan.command, plan.card)).toBe(true);
    expect(plan.command.h).toBe(48);
    expect(plan.dots).toBe(480 - 8 - 6);
    expect(plan.prev.x + plan.prev.w + 8).toBe(plan.card.x);
    expect(plan.next.x).toBe(plan.card.x + plan.card.w + 8);
    // The dice under the logo, behind the cards.
    expect(plan.net.y).toBeGreaterThanOrEqual(8 + 16 + 16);
    menu.dispose();
  });

  it('has every zone in the window and a finger tall; the command a finger tall in every language', () => {
    for (const language of LANGUAGES) {
      setLanguage(language);
      const menu = new MenuScreen(context(...PHONE), recorded().actions, DATA);
      for (const { id, rect } of menu.items()) {
        expect(rect.y, `${language} ${id}`).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width, `${language} ${id}`).toBeLessThanOrEqual(360 + 1e-6);
        expect(rect.y + rect.height, `${language} ${id}`).toBeLessThanOrEqual(640 + 1e-6);
        expect(rect.height, `${language} ${id}`).toBeGreaterThanOrEqual(MIN_ZONE);
      }
      menu.dispose();
    }
    setLanguage('en');
  });

  it('turns the cards by a swipe, by a tap on a neighbour, by a tap on a die; opens nothing by them', () => {
    const focused: string[] = [];
    const { actions, ran } = recorded();
    const menu = new MenuScreen(context(...PHONE, (id) => focused.push(id)), actions, DATA);
    const settle = (): void => void (menu.update(0), menu.update(1000));
    // The row goes first; the focus, and the figure with it, follow when the card is in the middle.
    expect(menu.swipe('left')).toBe('levels');
    expect(focused).toEqual([]);
    expect(menu.update(0)).toBe(true);
    expect(menu.update(100)).toBe(true);
    expect(focused).toEqual([]);
    menu.update(1000);
    expect(focused).toEqual(['protocol']);
    expect(menu.update(1100)).toBe(false);
    menu.swipe('right');
    settle();
    menu.swipe('right');
    settle();
    menu.items().find((item) => item.id === 'next')!.action();
    settle();
    menu.items().find((item) => item.id === 'prev')!.action();
    settle();
    menu.items().find((item) => item.id === 'die-readme')!.action();
    expect(focused).toEqual(['protocol', 'levels', 'system', 'levels', 'system', 'readme']);
    // Two quick taps go two cards on: the first lands as the second sets off.
    menu.items().find((item) => item.id === 'next')!.action();
    menu.items().find((item) => item.id === 'next')!.action();
    settle();
    expect(focused.slice(-2)).toEqual(['records', 'system']);
    expect(ran).toEqual([]);
    menu.dispose();
  });

  it('turns the cards by the keys left and right as by a tap on a neighbour: the row goes, the focus follows', () => {
    const focused: string[] = [];
    const menu = new MenuScreen(context(...PHONE, (id) => focused.push(id)), recorded().actions, DATA);
    expect(menu.move('levels', 'right')).toBe('levels');
    expect(focused).toEqual([]);
    menu.update(0);
    menu.update(100);
    expect((menu as unknown as { offset: number }).offset).toBeLessThan(0);
    menu.update(1000);
    expect(focused).toEqual(['protocol']);
    menu.move('protocol', 'left');
    menu.update(0);
    menu.update(1000);
    expect(focused).toEqual(['protocol', 'levels']);
    menu.dispose();
  });

  it('takes the row with a finger drawn sideways, one card at most; lets it go on, or back', () => {
    const focused: string[] = [];
    const menu = new MenuScreen(context(...PHONE, (id) => focused.push(id)), recorded().actions, DATA);
    const settle = (): void => void (menu.update(0), menu.update(1000));
    // A step of the row is 232 pixels of the picture, 309 CSS pixels of this window; a third of it is enough.
    expect(menu.slide(-60)).toBe(true);
    menu.slideEnd(0);
    settle();
    expect(focused).toEqual([]);
    menu.slide(-60);
    menu.slide(-60);
    menu.slideEnd(0);
    settle();
    expect(focused).toEqual(['protocol']);
    // Drawn as far as it goes, the row stops at the next card.
    menu.slide(2000);
    expect((menu as unknown as { offset: number }).offset).toBe(232);
    menu.slideEnd(0);
    settle();
    expect(focused).toEqual(['protocol', 'levels']);
    // A flick is enough the way it goes, and takes the row back against the way it was drawn.
    menu.slide(-10);
    menu.slideEnd(-0.5);
    settle();
    menu.slide(150);
    menu.slideEnd(-0.5);
    settle();
    expect(focused).toEqual(['protocol', 'levels', 'protocol']);
    menu.dispose();
    const desk = new MenuScreen(context(...DESK), recorded().actions, DATA);
    expect(desk.slide(-60)).toBe(false);
    desk.dispose();
  });

  it('opens the list of the levels from their card and starts the place from their command; any other command opens its file', () => {
    const { actions, ran } = recorded();
    const menu = new MenuScreen(context(...PHONE), actions, DATA);
    menu.items().find((item) => item.id === 'levels')!.action();
    menu.items().find((item) => item.id === 'play')!.action();
    menu.swipe('left');
    menu.items().find((item) => item.id === 'play')!.action();
    menu.items().find((item) => item.id === 'protocol')!.action();
    expect(ran).toEqual(['levels', 'play', 'endless', 'endless']);
    menu.dispose();
  });
});
