import { describe, expect, it } from 'vitest';
import type { GoalLine } from '../rules';
import type { Size } from '../display/sizing';
import { fileBoard } from '../levels/boardFiles';
import { campaignCells, campaignList } from '../levels/campaign';
import { FIXTURE } from '../levels/rowFixture';
import { MIN_ZONE, pictureSize, textWidth } from './layout';
import { LANGUAGES, setLanguage, word } from '../ui/i18n';
import { readmePages } from '../ui/readme';
import { LEVEL_RULES_PAGE, levelIntroPanel, levelResultPanel, levelRulesPanel, levelsPanel, liveResultPanel, pausePanel, readmePanel, recordsPanel } from './panels';
import { Climb } from './climb';
import { nextFocus } from './input';
import type { ShellContext } from './screen';
import { PanelScreen, type PanelRow, type PanelSpec } from './screens/panel';
import { COMMANDS, PANELS, RESULT, goalLabel, goalProgress, goalText } from './text';
import { shellDefaults } from './theme';
import type { Voice } from './voice';

const nothing = (): void => undefined;

// The words of the program are looked at in English here.
setLanguage('en');

function row<K extends PanelRow['kind']>(spec: PanelSpec, kind: K, nth = 0): Extract<PanelRow, { kind: K }> {
  return spec.rows.filter((candidate) => candidate.kind === kind)[nth] as Extract<PanelRow, { kind: K }>;
}

/** Ids of the commands of a panel, in order. */
function commands(spec: PanelSpec): string[] {
  return spec.rows.flatMap((candidate) =>
    candidate.kind === 'command' ? [candidate.id] : candidate.kind === 'commands' ? candidate.commands.map((command) => command.id) : [],
  );
}

const SEND: GoalLine[] = [{ what: 'dice', value: 0, have: 4, need: 12 }];
const ORDER: GoalLine[] = [
  { what: 'face', value: 2, have: 3, need: 4 },
  { what: 'face', value: 3, have: 0, need: 6 },
];
const CHAIN: GoalLine[] = [{ what: 'links', value: 0, have: 1, need: 3 }];
const CLEAR: GoalLine[] = [{ what: 'cleared', value: 0, have: 11, need: 16 }];

describe('the goal of a level, as the program writes it', () => {
  it('names dice of any face, dice of one face, links of a chain and dice left to clear', () => {
    expect(goalLabel(SEND[0])).toBe('SEND');
    expect(goalLabel(ORDER[0])).toBe('FACE 2');
    expect(goalLabel(CHAIN[0])).toBe('CHAIN');
    expect(goalLabel(CLEAR[0])).toBe('LEFT');
  });

  it('counts how far a line has come, dice in two places and links in one', () => {
    expect(goalProgress(SEND[0])).toBe('04/12');
    expect(goalProgress(ORDER[0])).toBe('03/04');
    expect(goalProgress(CHAIN[0])).toBe('1/3');
    expect(goalProgress({ what: 'links', value: 0, have: 4, need: 12 })).toBe('04/12');
  });

  it('counts a board to be cleared down: the dice that still stand', () => {
    expect(goalProgress(CLEAR[0])).toBe('05');
    expect(goalProgress({ what: 'cleared', value: 0, have: 16, need: 16 })).toBe('00');
  });

  it('is written with nothing counted where a level is only picked', () => {
    expect(goalText(SEND)).toBe('SEND 12');
    expect(goalText(ORDER)).toBe('FACE 2 ×04 · FACE 3 ×06');
    expect(goalText(CHAIN)).toBe('CHAIN 3');
    expect(goalText(CLEAR)).toBe('CLEAR 16');
  });
});

describe('the list of levels', () => {
  const levels = [
    { passed: true, goal: SEND },
    { passed: false, goal: ORDER },
    { passed: false, goal: CHAIN },
  ];

  it('has a cell for every level, with the stars of the ones passed, out of three', () => {
    const spec = levelsPanel(levels, 1, { onPick: nothing, onBack: nothing });
    const cells = row(spec, 'levels');
    expect(spec.title).toBe(PANELS.levels);
    expect(cells.levels).toEqual([{ stars: 1 }, { stars: 0 }, { stars: 0 }]);
    expect(cells.marks).toBe(3);
    expect(cells.current).toBe(1);
    expect(spec.home).toBe('level-1');
    const starred = levelsPanel(
      [
        { passed: true, goal: SEND, stars: 3 },
        { passed: true, goal: ORDER, stars: 2 },
      ],
      0,
      { onPick: nothing, onBack: nothing },
    );
    expect(row(starred, 'levels').levels.map((level) => level.stars)).toEqual([3, 2]);
  });

  it('lists every place of the row, through its chapters, numbered from one, every one open', () => {
    const fixture = FIXTURE.places;
    const cells = campaignCells({ passed: { F1: true }, stats: { F1: { bestMoves: fixture[0].spec.par } } }, fixture);
    const picked: number[] = [];
    const items = row(levelsPanel(cells, 0, { onPick: (index) => picked.push(index), onBack: nothing }), 'levels');
    expect(items.levels.length).toBe(fixture.length);
    expect(items.levels[0]).toMatchObject({ stars: 3 });
    expect(items.levels[3]).toMatchObject({ stars: 0 });
    expect(items.note(0)).toBe(`FACE ${fixture[0].spec.faces!.join(' ')} · ${goalText(cells[0].goal)}`);
    expect(items.note(3)).toBe(`FACE ${fixture[3].spec.faces!.join(' ')} · ${goalText(cells[3].goal)}`);
    items.pick(3);
    items.pick(2);
    expect(picked).toEqual([3, 2]);
  });

  it('writes the goal of the level in focus in the font of the program', () => {
    const cells = row(levelsPanel(levels, 0, { onPick: nothing, onBack: nothing }), 'levels');
    expect(cells.program).toBe(true);
    expect(cells.note(0)).toBe('SEND 12');
    expect(cells.note(1)).toBe('FACE 2 ×04 · FACE 3 ×06');
    expect(cells.note(2)).toBe('CHAIN 3');
    expect(cells.note(9)).toBe('');
  });

  it('starts the level picked', () => {
    const picked: number[] = [];
    row(levelsPanel(levels, 0, { onPick: (index) => picked.push(index), onBack: nothing }), 'levels').pick(2);
    expect(picked).toEqual([2]);
  });

  it('leads back to the menu, and shares nothing', () => {
    let back = 0;
    const spec = levelsPanel(levels, 0, { onPick: nothing, onBack: () => back++ });
    expect(commands(spec)).toEqual(['back']);
    const [menu] = row(spec, 'commands').commands;
    expect(menu.label).toBe(COMMANDS.menu);
    menu.action();
    spec.back?.();
    expect(back).toBe(2);
  });
});

describe('a live session in the list of levels', () => {
  const live = (best: number | null) => ({ live: { code: 'live-1', best } });
  const levels = [{ passed: true, goal: SEND }, live(null), { passed: false, goal: ORDER }];

  it('stands among the boards with no number: a board picked is told by its index among the boards, a session by its code', () => {
    const picked: (number | string)[] = [];
    const spec = levelsPanel(levels, 2, { onPick: (index) => picked.push(index), onLive: (code) => picked.push(code), onBack: nothing });
    const cells = row(spec, 'levels');
    expect(cells.levels).toEqual([{ stars: 1 }, { stars: 0, live: { best: null } }, { stars: 0 }]);
    expect(spec.home).toBe('level-2');
    cells.pick(0);
    cells.pick(1);
    cells.pick(2);
    expect(picked).toEqual([0, 'live-1', 1]);
  });

  it('writes LIVE SESSION under it in the font of the program, as a board its goal, and says nothing in the voice', () => {
    const cells = row(levelsPanel(levels, 0, { onPick: nothing, onBack: nothing }), 'levels');
    expect(cells.note(1)).toBe('LIVE SESSION');
    expect(cells.program).toBe(true);
    expect(cells.said).toBeUndefined();
    const played = row(levelsPanel([live(2471)], 0, { onPick: nothing, onBack: nothing }), 'levels');
    expect(played.note(0)).toBe('LIVE SESSION');
    expect(played.levels[0]).toEqual({ stars: 0, live: { best: 2471 } });
  });
});

describe('the result of a live session', () => {
  it('reads its score, its best and its chain, and leads again, on, or to the menu', () => {
    const done: string[] = [];
    const spec = liveResultPanel({ score: 1200, best: 2471, maxChain: 5 }, { onAgain: () => done.push('again'), onNext: () => done.push('next'), onMenu: () => done.push('menu') });
    expect(spec.title).toBe(PANELS.result);
    expect(spec.home).toBe('next');
    expect(row(spec, 'number')).toMatchObject({ label: RESULT.score, value: 1200 });
    const value = (one: PanelRow): string => {
      const { value } = one as { value: string | (() => string) };
      return typeof value === 'function' ? value() : value;
    };
    expect(spec.rows.filter((one) => one.kind === 'field').map(value)).toEqual(['002471', '×05']);
    expect(spec.rows.some((one) => one.kind === 'climb' || one.kind === 'standing')).toBe(false);
    expect(commands(spec)).toEqual(['again', 'next', 'menu']);
    for (const command of row(spec, 'commands').commands) command.action();
    expect(done).toEqual(['again', 'next', 'menu']);
  });
  it('goes up the log of its session where it is given one, as a session of Endless does, the best shown as it was until the place is taken', () => {
    const climb = new Climb({ lines: [{ name: 'Teal Otter', score: 3000, own: false }, { name: 'YOU', score: 900, own: true }], score: 1200, name: 'YOU', record: true, reduced: true });
    const spec = liveResultPanel({ score: 1200, best: 1200, before: 900, maxChain: 5 }, { onAgain: nothing, onNext: nothing, onMenu: nothing }, climb);
    expect(spec.rows.map((one) => one.kind).slice(0, 2)).toEqual(['standing', 'climb']);
    expect(spec.home).toBe('next');
    climb.update(0);
    climb.update(60_000);
    expect(climb.done).toBe(true);
    expect(typeof spec.title === 'function' ? spec.title() : spec.title).toBe(PANELS.record);
  });
});

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

describe('the panels on the grid', () => {
  it.each(SCREENS)('stand the commands of the pause on a %s a button and a gap apart, under the bar of the name, the plate as tall as its lines and their gaps', (name, window, ratio) => {
    const shown = context(window, ratio);
    const picture = shown.picture();
    const zoom = window.height / picture.height;
    const items = new PanelScreen(shown, pausePanel({ onResume: nothing, onRestart: nothing, onMenu: nothing }), false).items();
    expect(items.map((item) => item.id)).toEqual(['resume', 'restart', 'menu']);
    // Frame and bar 21, a gap 8, then three buttons 24 each with a gap 8 after it, and the frame: 30 + 3 × 32.
    const plate = 30 + 3 * (24 + 8);
    const top = Math.round(8 + Math.max(0, (picture.height - 16 - plate) / 2));
    const finger = name === 'phone' ? 36 : 24;
    items.forEach((item, i) => {
      const drawn = top + 29 + i * 32;
      expect(item.rect.height / zoom).toBeCloseTo(finger, 6);
      expect(item.rect.y / zoom).toBeCloseTo(drawn - (finger - 24) / 2, 6);
      expect(item.rect.height).toBeGreaterThanOrEqual(MIN_ZONE);
    });
  });

  it.each(SCREENS)('lay the cells of the levels on a %s six across, four apart, square enough for a large number', (name, window, ratio) => {
    const shown = context(window, ratio);
    const zoom = window.height / shown.picture().height;
    const cells = new PanelScreen(shown, levelsPanel(campaignCells({ passed: {}, stats: {} }), 0, { onPick: nothing, onBack: nothing }), true)
      .items()
      .filter((item) => item.id.startsWith('level-'))
      .map((item) => ({ x: item.rect.x / zoom, y: item.rect.y / zoom, w: item.rect.width / zoom, h: item.rect.height / zoom }));
    const [w, h, across] = name === 'phone' ? [36, 36, 6] : [38, 36, 6];
    expect(cells[0].w).toBeCloseTo(w, 6);
    expect(cells[0].h).toBeCloseTo(h, 6);
    expect(cells[1].x - cells[0].x).toBeCloseTo(w + 4, 6);
    expect(cells[across].y - cells[0].y).toBeCloseTo(h + 4, 6);
    expect(cells[across].x).toBeCloseTo(cells[0].x, 6);
  });
});

describe('the result of a live session on a screen', () => {
  const lines = Array.from({ length: 60 }, (_, i) => ({ name: `Player ${i}`, score: 6000 - i * 100, own: false }));

  it.each(SCREENS)('fits the window of a %s in every language, with its log and four commands, no word over the edge of its command, and no command over another but by the field of a finger', (_name, window, ratio) => {
    for (const language of LANGUAGES) {
      setLanguage(language);
      const climb = new Climb({ lines, score: 2471, name: 'YOU', record: true, reduced: true });
      const spec = liveResultPanel({ score: 2471, best: 2471, before: 0, maxChain: 6 }, { onAgain: nothing, onNext: nothing, onMenu: nothing, onDouble: nothing }, climb);
      const shown = context(window, ratio);
      const screen = new PanelScreen(shown, spec, false);
      const items = screen.items();
      expect(items.map((item) => item.id).sort(), language).toEqual(['again', 'double', 'menu', 'next']);
      const scale = window.width / shown.picture().width;
      for (const item of items) {
        expect(item.rect.y + item.rect.height, language).toBeLessThanOrEqual(window.height);
        const command = [COMMANDS.again, COMMANDS.next, COMMANDS.double, COMMANDS.menu][['again', 'next', 'double', 'menu'].indexOf(item.id)];
        expect(textWidth(word(command.name)) * scale, `${language} ${item.id}`).toBeLessThanOrEqual(item.rect.width - 20 * scale + 1e-6);
      }
      for (let a = 0; a < items.length; a++) {
        for (let b = a + 1; b < items.length; b++) {
          const one = items[a].rect;
          const other = items[b].rect;
          // Zones grown for a finger may reach over a neighbour above or below by the grid's step, and no more.
          const reach = 4 * scale + 1e-6;
          const apart = one.x + one.width <= other.x || other.x + other.width <= one.x || one.y + one.height <= other.y + reach || other.y + other.height <= one.y + reach;
          expect(apart, language).toBe(true);
        }
      }
    }
    setLanguage('en');
  });
});

describe('the logs of the panels on a screen', () => {
  const lines = Array.from({ length: 60 }, (_, i) => ({ name: `Player ${i}`, score: 6000 - i * 100, own: false }));

  it.each(SCREENS)('scroll on a %s: the log of the records by the wheel and a finger, as far as its end and no further', (_name, window, ratio) => {
    const screen = new PanelScreen(context(window, ratio), recordsPanel(() => ({ lines: lines.map((line, i) => ({ ...line, rank: i + 1 })) }), { onBack: nothing }), true);
    expect(screen.scroll('up', 400, 'back', true)).toBeNull();
    expect(screen.scroll('down', 30, 'back')).toBe('back');
    expect(screen.scroll('down', 100_000, 'back')).toBe('back');
    expect(screen.scroll('down', 400, 'back', true)).toBeNull();
    expect(screen.scroll('up', 400, 'back', true)).toBe('back');
  });

  it.each(SCREENS)('scroll on a %s the log a result goes up once the place is taken, and not before', (_name, window, ratio) => {
    const climb = new Climb({ lines, score: 3050, name: 'YOU', record: false });
    const screen = new PanelScreen(context(window, ratio), liveResultPanel({ score: 3050, best: 3050, maxChain: 2 }, { onAgain: nothing, onNext: nothing, onMenu: nothing }, climb), false);
    climb.update(0);
    expect(screen.scroll('down', 100, 'next')).toBeNull();
    climb.finish();
    expect(screen.scroll('down', 100, 'next')).toBe('next');
    expect(screen.scroll('up', 100_000, 'next')).toBe('next');
    expect(screen.scroll('up', 400, 'next', true)).toBeNull();
  });
});

describe('the list of the levels on a screen', () => {
  const cells = campaignCells({ passed: { R01: true, R02: true }, stats: { R01: { bestMoves: fileBoard('R01').par! }, R02: { bestMoves: 99 } } });
  const actions = { onPick: nothing, onBack: nothing };

  it.each(SCREENS)('fits the window of a %s: the cells in sight from the first, the arrows where the list scrolls, and the menu, each large enough for a finger', (_name, window, ratio) => {
    const screen = new PanelScreen(context(window, ratio), levelsPanel(cells, 0, actions), true);
    const items = screen.items();
    const shown = items.filter((item) => item.id.startsWith('level-')).length;
    expect(shown).toBeGreaterThan(0);
    const cellIds = cells.slice(0, shown).map((_, index) => `level-${index}`);
    expect(items.map((item) => item.id)).toEqual(shown < cells.length ? ['scroll-up', ...cellIds, 'scroll-down', 'back'] : [...cellIds, 'back']);
    expect(screen.home).toBe('level-0');
    for (const item of items) {
      expect(item.rect.height).toBeGreaterThanOrEqual(MIN_ZONE);
      expect(item.rect.width).toBeGreaterThanOrEqual(MIN_ZONE);
      expect(item.rect.x).toBeGreaterThanOrEqual(0);
      expect(item.rect.y).toBeGreaterThanOrEqual(0);
      expect(item.rect.x + item.rect.width).toBeLessThanOrEqual(window.width);
      expect(item.rect.y + item.rect.height).toBeLessThanOrEqual(window.height);
    }
    // No zone lies over another.
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const one = items[a].rect;
        const other = items[b].rect;
        const apart = one.x + one.width <= other.x || other.x + other.width <= one.x || one.y + one.height <= other.y || other.y + other.height <= one.y;
        expect(apart).toBe(true);
      }
    }
  });

  it.each(SCREENS)('scrolls on a %s where the cells do not fit: the keys walk down to the last cell, every cell comes in sight', (_name, window, ratio) => {
    const screen = new PanelScreen(context(window, ratio), levelsPanel(cells, 0, actions), true);
    const seen = new Set<string>();
    let focus: string | null = 'level-0';
    for (let step = 0; step < cells.length; step++) {
      for (const item of screen.items()) if (item.id.startsWith('level-')) seen.add(item.id);
      const told: string | null | undefined = screen.move(focus, 'down');
      const next: string | null = told === undefined ? nextFocus(screen.items(), focus, 'down') : told;
      if (next === null || !next.startsWith('level-') || next === focus) break;
      expect(screen.items().map((item) => item.id), next).toContain(next);
      focus = next;
    }
    for (const item of screen.items()) if (item.id.startsWith('level-')) seen.add(item.id);
    expect(seen.size).toBe(cells.length);
    for (const item of screen.items()) {
      expect(item.rect.y).toBeGreaterThanOrEqual(0);
      expect(item.rect.y + item.rect.height).toBeLessThanOrEqual(window.height);
    }
  });

  it('scrolls the list on a phone by a finger drawn up and down, and keeps the focus in sight', () => {
    const screen = new PanelScreen(context(SCREENS[0][1], SCREENS[0][2]), levelsPanel(cells, 0, actions), true);
    const ids = () => screen.items().filter((item) => item.id.startsWith('level-')).map((item) => item.id);
    const first = ids();
    expect(first.length).toBeLessThan(cells.length);
    // A finger drawn at the end of the list is taken all the same: it starts no level.
    expect(screen.scroll('up', 400, 'level-0')).toBe('level-0');
    const focus = screen.scroll('down', 2000, 'level-0')!;
    expect(ids()).toContain(`level-${cells.length - 1}`);
    expect(ids()).toContain(focus);
    expect(screen.scroll('down', 400, focus)).toBe(focus);
    screen.scroll('up', 4000, focus);
    expect(ids()).toEqual(first);
  });

  it('scrolls the list on a phone by the wheel row by row as the small steps of a touchpad add up', () => {
    const screen = new PanelScreen(context(SCREENS[0][1], SCREENS[0][2]), levelsPanel(cells, 0, actions), true);
    const ids = () => screen.items().filter((item) => item.id.startsWith('level-')).map((item) => item.id);
    const first = ids();
    expect(screen.scroll('down', 10, 'level-0', true)).toBeNull();
    expect(ids()).toEqual(first);
    for (let i = 0; i < 9; i++) screen.scroll('down', 10, 'level-0', true);
    expect(ids()).not.toEqual(first);
    expect(ids()).toContain('level-6');
    expect(ids()).not.toContain(`level-${cells.length - 1}`);
  });

  it('brings a cell out of sight back with a key, as after the window was turned', () => {
    const screen = new PanelScreen(context(SCREENS[0][1], SCREENS[0][2]), levelsPanel(cells, 0, actions), true);
    screen.scroll('down', 4000, 'level-0');
    const next = screen.move('level-0', 'down');
    expect(next).toBe('level-6');
    expect(screen.items().map((item) => item.id)).toContain(next);
  });

  it('opens the list on a phone with the cell of the place in sight, though it is the last', () => {
    const last = cells.length - 1;
    const screen = new PanelScreen(context(SCREENS[0][1], SCREENS[0][2]), levelsPanel(cells, last, actions), true);
    expect(screen.home).toBe(`level-${last}`);
    expect(screen.items().map((item) => item.id)).toContain(`level-${last}`);
  });

  it('scrolls the list on a phone a page at a time by its arrows, a thin one over the cells and one under them', () => {
    const screen = new PanelScreen(context(SCREENS[0][1], SCREENS[0][2]), levelsPanel(cells, 0, actions), true);
    const ids = () => screen.items().filter((item) => item.id.startsWith('level-')).map((item) => item.id);
    const press = (id: string) => screen.items().find((item) => item.id === id)!.action();
    const first = ids();
    const [up, down] = ['scroll-up', 'scroll-down'].map((id) => screen.items().find((item) => item.id === id)!.rect);
    const cellRects = screen.items().filter((item) => item.id.startsWith('level-')).map((item) => item.rect);
    const last = cellRects[cellRects.length - 1];
    expect(up.width).toBeGreaterThanOrEqual(last.x + last.width - cellRects[0].x - 1);
    expect(up.y + up.height).toBeLessThanOrEqual(cellRects[0].y);
    expect(down.y).toBeGreaterThanOrEqual(last.y + last.height);
    press('scroll-up');
    expect(ids()).toEqual(first);
    press('scroll-down');
    const second = ids();
    expect(second).not.toEqual(first);
    // A page: the last row in sight stays in sight, at the top.
    expect(second).toContain(first[first.length - 1]);
    for (let i = 0; i < 20; i++) press('scroll-down');
    expect(ids()).toContain(`level-${cells.length - 1}`);
    for (let i = 0; i < 20; i++) press('scroll-up');
    expect(ids()).toEqual(first);
  });

  it('scrolls on a desk too, since the row is a hundred places: four rows of six in sight from the first, the rest a scroll away', () => {
    const screen = new PanelScreen(context(SCREENS[1][1], SCREENS[1][2]), levelsPanel(cells, 0, actions), true);
    const shown = screen.items().filter((item) => item.id.startsWith('level-')).length;
    expect(shown).toBeLessThan(cells.length);
    expect(shown).toBe(24);
    screen.scroll('down', 4000, 'level-0');
    expect(screen.items().map((item) => item.id)).toContain(`level-${cells.length - 1}`);
  });
});

describe('the list of the levels with its live sessions on a screen', () => {
  const kept = { passed: { R01: true }, stats: {}, lives: { 'live-2': { best: 24261, plays: 1 } } };
  const entries = campaignList(kept).map((item) => (item.kind === 'board' ? item.cell : { live: { code: item.code, best: item.best } }));
  const actions = { onPick: nothing, onBack: nothing };

  it.each(SCREENS)('fits the window of a %s: a cell for every board and session, none over another, each large enough for a finger', (_name, window, ratio) => {
    const screen = new PanelScreen(context(window, ratio), levelsPanel(entries, 0, actions), true);
    const items = screen.items().filter((item) => item.id.startsWith('level-'));
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(entries.length);
    expect(entries.filter((entry) => 'live' in entry)).toHaveLength(7);
    for (const item of items) {
      expect(item.rect.height).toBeGreaterThanOrEqual(MIN_ZONE);
      expect(item.rect.width).toBeGreaterThanOrEqual(MIN_ZONE);
      expect(item.rect.x + item.rect.width).toBeLessThanOrEqual(window.width);
      expect(item.rect.y + item.rect.height).toBeLessThanOrEqual(window.height);
    }
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const one = items[a].rect;
        const other = items[b].rect;
        expect(one.x + one.width <= other.x || other.x + other.width <= one.x || one.y + one.height <= other.y || other.y + other.height <= one.y).toBe(true);
      }
    }
    // A session's cell holds its word: as wide as a board's where the word fits, two of them where it does not.
    const picture = context(window, ratio).picture();
    const zoom = window.height / picture.height;
    const board = items[0].rect.width / zoom;
    const live = items[entries.findIndex((entry) => 'live' in entry)].rect.width / zoom;
    expect(live).toBeGreaterThanOrEqual(textWidth('LIVE') + 4 - 0.5);
    expect(live === board || live > board * 2).toBe(true);
  });
});

describe('the window a level opens with', () => {
  const pages = ['Make only 3s.\nThree of them side by side leave.', 'The other faces do not work.'];
  const said = (spec: PanelSpec) => spec.rows.filter((candidate) => candidate.kind === 'say');
  const press = (spec: PanelSpec, id: string): void => {
    const command = spec.rows.find((candidate) => candidate.kind === 'command' && candidate.id === id);
    if (command?.kind === 'command') command.action();
  };

  it('says one message at a time, in large letters, under the number of the level', () => {
    const spec = levelIntroPanel({ number: 3, pages, page: 0 }, { onPage: nothing, onStart: nothing, onBack: nothing });
    expect(spec.title).toEqual({ native: PANELS.levels.native, name: 'LEVEL 03' });
    // The window keeps the room of its longest message, so that it does not jump from one to the next.
    expect(said(spec)).toEqual([{ kind: 'say', text: pages[0], after: 0, large: true, room: pages }]);
    expect(said(levelIntroPanel({ number: 3, pages, page: 1 }, { onPage: nothing, onStart: nothing, onBack: nothing }))[0]).toMatchObject({ text: pages[1] });
  });

  it('leads on to the next message, and starts the level after the last one', () => {
    const run: string[] = [];
    const actions = { onPage: (page: number) => run.push(`page ${page}`), onStart: () => run.push('start'), onBack: () => run.push('back') };
    const first = levelIntroPanel({ number: 1, pages, page: 0, still: true }, actions);
    expect(commands(first)).toEqual(['next', 'back']);
    expect(first.home).toBe('next');
    expect(first.rows.find((candidate) => candidate.kind === 'command' && candidate.id === 'next')).toMatchObject({ label: COMMANDS.next });
    first.typed?.(0);
    press(first, 'next');
    const last = levelIntroPanel({ number: 1, pages, page: 1, still: true }, actions);
    expect(commands(last)).toEqual(['start', 'back']);
    expect(last.home).toBe('start');
    last.typed?.(0);
    press(last, 'start');
    last.back?.();
    expect(run).toEqual(['page 1', 'start', 'back']);
  });

  it('types its words out sign by sign, each message from its own start', () => {
    const spec = levelIntroPanel({ number: 1, pages, page: 0 }, { onPage: nothing, onStart: nothing, onBack: nothing });
    // The first frame starts the count, and signs come at one pace from it.
    expect(spec.typed?.(5000)).toBe(0);
    expect(spec.typed?.(5000 + 30 * 5)).toBe(5);
    // Once all is said the count stands.
    expect(spec.typed?.(5000 + 60000)).toBe(pages[0].length);
    expect(spec.typed?.(5000 + 61000)).toBe(pages[0].length);
    // The panel is not drawn again for the words: they are written by themselves.
    expect(spec.live).toBeUndefined();
  });

  it('brings all the words on a press made while they are coming, and goes on with the next press', () => {
    const run: string[] = [];
    const spec = levelIntroPanel({ number: 1, pages, page: 0 }, { onPage: (page) => run.push(`page ${page}`), onStart: nothing, onBack: nothing });
    expect(spec.typed?.(1000)).toBe(0);
    press(spec, 'next');
    expect(run).toEqual([]);
    expect(spec.typed?.(1010)).toBe(pages[0].length);
    press(spec, 'next');
    expect(run).toEqual(['page 1']);
  });

  it('tells of every sign that comes by itself, by its place in the message, and of none that a press brings', () => {
    const heard: number[] = [];
    const spec = levelIntroPanel({ number: 1, pages, page: 0 }, { onPage: nothing, onStart: nothing, onBack: nothing, onSign: (index) => heard.push(index) });
    spec.typed?.(1000);
    spec.typed?.(1000 + 30);
    spec.typed?.(1000 + 30 * 2);
    // Nothing new has come: nothing is told.
    spec.typed?.(1000 + 30 * 2 + 5);
    expect(heard).toEqual([0, 1]);
    // Several signs in one frame are one sound: the last of them.
    spec.typed?.(1000 + 30 * 5);
    expect(heard).toEqual([0, 1, 4]);
    press(spec, 'next');
    spec.typed?.(1000 + 30 * 6);
    expect(heard).toEqual([0, 1, 4]);
  });

  it('is silent for a player who has asked for less motion: the words are all there at once', () => {
    const heard: number[] = [];
    const spec = levelIntroPanel({ number: 1, pages, page: 0, still: true }, { onPage: nothing, onStart: nothing, onBack: nothing, onSign: (index) => heard.push(index) });
    spec.typed?.(0);
    spec.typed?.(5000);
    expect(heard).toEqual([]);
  });

  it('has all its words at once for a player who has asked for less motion', () => {
    const spec = levelIntroPanel({ number: 1, pages, page: 0, still: true }, { onPage: nothing, onStart: nothing, onBack: nothing });
    expect(spec.typed?.(0)).toBe(pages[0].length);
  });

  it('keeps to its messages: a page past the last is the last, one before the first is the first', () => {
    const at = (page: number) => said(levelIntroPanel({ number: 1, pages, page }, { onPage: nothing, onStart: nothing, onBack: nothing }))[0];
    expect(at(7)).toMatchObject({ text: pages[1] });
    expect(at(-1)).toMatchObject({ text: pages[0] });
  });
});

describe('the result of a level', () => {
  const actions = { onNext: nothing, onAgain: nothing, onLevels: nothing };

  it('says how many moves a passed level had left, and offers the next one', () => {
    const spec = levelResultPanel({ passed: true, left: 7, moves: 13, goal: SEND, hasNext: true }, actions);
    expect(spec.title).toBe(PANELS.cleared);
    expect(row(spec, 'field')).toMatchObject({ label: RESULT.left, value: '07' });
    expect(spec.rows.filter((candidate) => candidate.kind === 'field')).toHaveLength(1);
    expect(spec.rows.some((candidate) => candidate.kind === 'say')).toBe(false);
    expect(commands(spec)).toEqual(['next', 'again', 'levels']);
    expect(spec.home).toBe('next');
  });

  it('says how many moves a level with no limit took, and the fewest the player has done it in', () => {
    const spec = levelResultPanel({ passed: true, left: null, moves: 17, best: 12, goal: CLEAR, hasNext: true }, actions);
    expect(row(spec, 'field', 0)).toMatchObject({ label: RESULT.moves, value: '17' });
    expect(row(spec, 'field', 1)).toMatchObject({ label: RESULT.best, value: '12' });
    // Before the first pass there is no best to show.
    const first = levelResultPanel({ passed: true, left: null, moves: 17, best: null, goal: CLEAR, hasNext: true }, actions);
    expect(first.rows.filter((candidate) => candidate.kind === 'field')).toHaveLength(1);
  });

  it('rates a pass with its stars, and says its moves and the fewest of the player', () => {
    const spec = levelResultPanel({ passed: true, left: 21, moves: 9, best: 7, stars: 1, goal: CLEAR, hasNext: true }, actions);
    expect(row(spec, 'stars')).toEqual({ kind: 'stars', count: 1 });
    expect(row(spec, 'field', 0)).toMatchObject({ label: RESULT.moves, value: '09' });
    expect(row(spec, 'field', 1)).toMatchObject({ label: RESULT.best, value: '07' });
    // Neither the moves a limit had left nor the fewest the level takes are readings of their own: the stars say how the pass went.
    expect(spec.rows.filter((candidate) => candidate.kind === 'field')).toHaveLength(2);
    expect(commands(spec)).toEqual(['next', 'again', 'levels']);
  });

  it('shows no stars on a level that is not passed', () => {
    const spec = levelResultPanel({ passed: false, left: 0, moves: 30, stars: 0, goal: CLEAR, hasNext: true, reason: 'Out of moves. Short by: 2' }, actions);
    expect(spec.rows.some((candidate) => candidate.kind === 'stars')).toBe(false);
    expect(spec.rows[0]).toEqual({ kind: 'say', text: 'Out of moves. Short by: 2', large: true });
  });

  it('asks nothing of the player: a level that is passed shows its numbers and its commands', () => {
    const spec = levelResultPanel({ passed: true, left: null, moves: 5, best: 5, goal: CLEAR, hasNext: true }, actions);
    expect(spec.rows.some((candidate) => candidate.kind === 'tabs' || candidate.kind === 'say')).toBe(false);
    expect(commands(spec)).toEqual(['next', 'again', 'levels']);
  });

  it('offers to take the last move back at a dead end, while there are moves to take back', () => {
    const run: string[] = [];
    const stuck = { passed: false, left: null, moves: 6, goal: CLEAR, hasNext: true, reason: 'Dead end: one die is left' };
    const spec = levelResultPanel({ ...stuck, undos: 2 }, { ...actions, onUndo: () => run.push('undo') });
    expect(spec.title).toBe(PANELS.failed);
    expect(spec.rows[0]).toEqual({ kind: 'say', text: 'Dead end: one die is left', large: true });
    expect(row(spec, 'field')).toMatchObject({ label: { native: 'LEFT' }, value: '05' });
    expect(commands(spec)).toEqual(['undo', 'again', 'levels']);
    expect(spec.home).toBe('undo');
    const undo = spec.rows.find((candidate) => candidate.kind === 'command' && candidate.id === 'undo');
    expect(undo).toMatchObject({ label: { native: COMMANDS.undo.native, name: 'UNDO 2' } });
    if (undo?.kind === 'command') undo.action();
    expect(run).toEqual(['undo']);
    // With none left the level is lost.
    const lost = levelResultPanel({ ...stuck, undos: 0 }, { ...actions, onUndo: () => run.push('undo') });
    expect(commands(lost)).toEqual(['again', 'levels']);
    expect(lost.home).toBe('again');
  });

  it('has no next level after the last one', () => {
    const spec = levelResultPanel({ passed: true, left: 112, moves: 8, goal: SEND, hasNext: false }, actions);
    expect(row(spec, 'field').value).toBe('112');
    expect(commands(spec)).toEqual(['again', 'levels']);
    expect(spec.home).toBe('again');
  });

  it('says why a level failed and how far every line of its goal had come, and does not lead on', () => {
    const spec = levelResultPanel({ passed: false, left: 0, moves: 20, goal: ORDER, hasNext: true, reason: 'Out of moves. Short by: 7' }, actions);
    expect(spec.title).toBe(PANELS.failed);
    expect(spec.rows[0]).toEqual({ kind: 'say', text: 'Out of moves. Short by: 7', large: true });
    expect(row(spec, 'field', 0)).toMatchObject({ label: { native: 'FACE 2' }, value: '03/04' });
    expect(row(spec, 'field', 1)).toMatchObject({ label: { native: 'FACE 3' }, value: '00/06' });
    expect(commands(spec)).toEqual(['again', 'levels']);
    expect(spec.home).toBe('again');
  });

  it('runs what its commands say', () => {
    const run: string[] = [];
    const spec = levelResultPanel(
      { passed: true, left: 1, moves: 5, goal: CHAIN, hasNext: true },
      { onNext: () => run.push('next'), onAgain: () => run.push('again'), onLevels: () => run.push('levels') },
    );
    for (const candidate of spec.rows) if (candidate.kind === 'command') candidate.action();
    expect(run).toEqual(['next', 'again', 'levels']);
  });

  it('has commands short enough for the panel of a phone', () => {
    const spec = levelResultPanel({ passed: true, left: 1, moves: 5, goal: CHAIN, hasNext: true }, actions);
    for (const candidate of spec.rows) {
      if (candidate.kind === 'command') expect(textWidth(`${candidate.label.native} ${candidate.label.name}`)).toBeLessThanOrEqual(200);
    }
  });
});

describe('the rules of the levels, read again', () => {
  const RULES = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
  const said = (spec: PanelSpec): string[] => spec.rows.flatMap((candidate) => (candidate.kind === 'say' ? [candidate.text] : []));
  const pick = (spec: PanelSpec, id: string) => spec.rows.find((candidate) => candidate.kind === 'command' && candidate.id === id);

  /** Windows the seven rules take. */
  const WINDOWS = Math.ceil(RULES.length / LEVEL_RULES_PAGE);

  it('are shown a few to a window, numbered through, in large letters', () => {
    const first = levelRulesPanel(RULES, 0, { onPage: nothing, onBack: nothing });
    expect(said(first)).toEqual(RULES.slice(0, LEVEL_RULES_PAGE).map((text, i) => `${i + 1}. ${text}`));
    const start = (WINDOWS - 1) * LEVEL_RULES_PAGE;
    const last = levelRulesPanel(RULES, WINDOWS - 1, { onPage: nothing, onBack: nothing });
    expect(said(last)).toEqual(RULES.slice(start).map((text, i) => `${start + i + 1}. ${text}`));
    for (const candidate of first.rows) if (candidate.kind === 'say') expect(candidate.large).toBe(true);
    expect(LEVEL_RULES_PAGE).toBeLessThanOrEqual(3);
  });

  it('say in their title which window of how many this is', () => {
    expect(levelRulesPanel(RULES, 1, { onPage: nothing, onBack: nothing }).title).toEqual({ native: PANELS.rules.native, name: `RULES 2/${WINDOWS}` });
  });

  it('lead on to the rules that follow and, past the last, back to the first', () => {
    const turned: number[] = [];
    for (let page = 0; page < WINDOWS; page++) {
      const next = pick(levelRulesPanel(RULES, page, { onPage: (to) => turned.push(to), onBack: nothing }), 'next');
      expect(next).toMatchObject({ label: COMMANDS.next });
      if (next?.kind === 'command') next.action();
    }
    expect(turned).toEqual([...Array.from({ length: WINDOWS - 1 }, (_, i) => i + 1), 0]);
  });

  it('are one window with no way on when they are few', () => {
    const spec = levelRulesPanel(RULES.slice(0, LEVEL_RULES_PAGE), 0, { onPage: nothing, onBack: nothing });
    expect(commands(spec)).toEqual(['back']);
    expect(spec.title).toEqual(PANELS.rules);
    expect(spec.home).toBe('back');
  });

  it('lead back where they were asked for', () => {
    let back = 0;
    const spec = levelRulesPanel(RULES, 0, { onPage: nothing, onBack: () => back++ });
    expect(commands(spec)).toEqual(['next', 'back']);
    expect(spec.home).toBe('next');
    spec.back?.();
    expect(back).toBe(1);
  });
});

describe('the pause of a level', () => {
  it('has the three commands of every pause: no list, no rules, no settings', () => {
    let left = 0;
    const spec = pausePanel({ onResume: nothing, onRestart: nothing, onMenu: () => left++ });
    expect(commands(spec)).toEqual(['resume', 'restart', 'menu']);
    const menu = spec.rows.find((candidate) => candidate.kind === 'command' && candidate.id === 'menu');
    if (menu?.kind === 'command') menu.action();
    expect(left).toBe(1);
  });
});

describe('the files of the menu that are read', () => {
  it('say how the game is played in the windows of the rules, under a name of their own', () => {
    const spec = levelRulesPanel(['a', 'b', 'c', 'd'], 1, { onPage: nothing, onBack: nothing }, PANELS.howto);
    expect(spec.title).toEqual({ native: PANELS.howto.native, name: 'HOW TO PLAY 2/2' });
    expect(row(spec, 'say').text).toBe('4. d');
  });

  it('moves through the note without wrapping, with back on the left and exit on the last page', () => {
    const pages = [['one', 'two'], ['three'], ['four']];
    const turned: number[] = [];
    let exited = 0;
    const actions = { onPage: (to: number) => turned.push(to), onBack: () => exited++ };
    const first = readmePanel(pages, 0, actions);
    const middle = readmePanel(pages, 1, actions);
    const last = readmePanel(pages, 2, actions);
    expect(first.title).toEqual({ native: PANELS.readme.native, name: 'README 1/3' });
    expect(first.rows.filter((candidate) => candidate.kind === 'say').map((candidate) => (candidate as { text: string }).text)).toEqual(['one', 'two']);
    expect(commands(first)).toEqual(['back', 'next']);
    expect(commands(middle)).toEqual(['back', 'next']);
    expect(commands(last)).toEqual(['back', 'exit']);
    expect(row(last, 'commands').commands[1].label).toEqual(COMMANDS.exit);
    row(first, 'commands').commands[1].action();
    row(middle, 'commands').commands[0].action();
    row(middle, 'commands').commands[1].action();
    row(last, 'commands').commands[0].action();
    expect(turned).toEqual([1, 0, 2, 1]);
    row(last, 'commands').commands[1].action();
    first.back?.();
    expect(exited).toBe(2);
    expect(last.home).toBe('exit');
  });

  it('cut the pages of the note into smaller windows for a low screen, with every paragraph whole and in its place', () => {
    for (const code of LANGUAGES) {
      const pages = readmePages(code);
      const windows = readmePages(code, 330);
      expect(pages).toHaveLength(5);
      for (const paragraph of pages.flat()) expect.soft(paragraph.length, `${code}: ${paragraph.slice(0, 48)}`).toBeLessThanOrEqual(330);
      expect(windows.length).toBeGreaterThan(pages.length);
      expect(windows.flat()).toEqual(pages.flat());
      for (const window of windows) {
        expect(window.length).toBeGreaterThan(0);
        if (window.length > 1) expect(window.join('').length).toBeLessThanOrEqual(330);
      }
    }
    expect(new Set(LANGUAGES.map((code) => readmePages(code).flat().join('\n'))).size).toBe(LANGUAGES.length);
  });
});
