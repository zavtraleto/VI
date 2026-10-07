import { describe, expect, it } from 'vitest';
import type { GoalLine } from '../rules';
import { textWidth } from './layout';
import { LANGUAGES, setLanguage } from '../ui/i18n';
import { readmePages } from '../ui/readme';
import { LEVEL_RULES_PAGE, levelIntroPanel, levelResultPanel, levelRulesPanel, levelsPanel, pausePanel, readmePanel } from './panels';
import type { PanelRow, PanelSpec } from './screens/panel';
import { COMMANDS, PANELS, RESULT, goalLabel, goalProgress, goalText, type PanelName } from './text';

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
  const share = { label: (): PanelName => COMMANDS.share, action: nothing };
  const levels = [
    { passed: true, goal: SEND },
    { passed: false, goal: ORDER },
    { passed: false, goal: CHAIN },
  ];

  it('has a cell for every level, with the stars of the ones passed, out of three', () => {
    const spec = levelsPanel(levels, 1, { onPick: nothing, share, onBack: nothing });
    const cells = row(spec, 'levels');
    expect(spec.title).toBe(PANELS.levels);
    expect(cells.levels).toEqual([
      { stars: 1, locked: false },
      { stars: 0, locked: false },
      { stars: 0, locked: false },
    ]);
    expect(cells.marks).toBe(3);
    expect(cells.current).toBe(1);
    expect(spec.home).toBe('level-1');
    const starred = levelsPanel(
      [
        { passed: true, goal: SEND, stars: 3 },
        { passed: true, goal: ORDER, stars: 2 },
      ],
      0,
      { onPick: nothing, share, onBack: nothing },
    );
    expect(row(starred, 'levels').levels.map((level) => level.stars)).toEqual([3, 2]);
  });

  it('keeps a level of a chapter that is not open shut: it says the stars its chapter asks for, and is not started', () => {
    const picked: number[] = [];
    const gated = [
      { passed: true, goal: SEND, stars: 2 },
      { passed: false, goal: CLEAR, locked: { have: 7, need: 10 } },
    ];
    const cells = row(levelsPanel(gated, 0, { onPick: (index) => picked.push(index), share, onBack: nothing }), 'levels');
    expect(cells.levels).toEqual([
      { stars: 2, locked: false },
      { stars: 0, locked: true },
    ]);
    expect(cells.note(0)).toBe('SEND 12');
    expect(cells.note(1)).toBe('LOCKED · STARS 07/10');
    cells.pick(1);
    cells.pick(0);
    expect(picked).toEqual([0]);
  });

  it('writes the goal of the level in focus in the font of the program', () => {
    const cells = row(levelsPanel(levels, 0, { onPick: nothing, share, onBack: nothing }), 'levels');
    expect(cells.program).toBe(true);
    expect(cells.note(0)).toBe('SEND 12');
    expect(cells.note(1)).toBe('FACE 2 ×04 · FACE 3 ×06');
    expect(cells.note(2)).toBe('CHAIN 3');
    expect(cells.note(9)).toBe('');
  });

  it('starts the level picked', () => {
    const picked: number[] = [];
    row(levelsPanel(levels, 0, { onPick: (index) => picked.push(index), share, onBack: nothing }), 'levels').pick(2);
    expect(picked).toEqual([2]);
  });

  it('shares the report and leads back to the menu', () => {
    let shared = 0;
    let back = 0;
    let label: PanelName = COMMANDS.share;
    const spec = levelsPanel(levels, 0, { onPick: nothing, share: { label: () => label, action: () => shared++ }, onBack: () => back++ });
    expect(commands(spec)).toEqual(['share', 'back']);
    const [send, menu] = row(spec, 'commands').commands;
    expect(menu.label).toBe(COMMANDS.menu);
    // The press itself must send: a browser copies only inside one.
    expect(send.instant).toBe(true);
    send.action();
    menu.action();
    spec.back?.();
    expect([shared, back]).toEqual([1, 2]);
    // The command reads what came of the last sending for as long as the game says so.
    expect(send.label.name).toBe('SHARE');
    label = COMMANDS.copied;
    expect(send.label.name).toBe('COPIED');
    expect(send.label.native).toBe(COMMANDS.copied.native);
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
    expect(spec.rows.some((candidate) => candidate.kind === 'field' && candidate.label === RESULT.least)).toBe(false);
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
  const PAUSE = { onResume: nothing, onRestart: nothing, onRecords: nothing, onTasks: nothing, onSystem: nothing, onMenu: nothing };

  it('leads back to the levels under their own name', () => {
    const spec = pausePanel({ task: true, list: COMMANDS.levels, ...PAUSE });
    const back = spec.rows.find((candidate) => candidate.kind === 'command' && candidate.id === 'tasks');
    expect(back).toMatchObject({ label: COMMANDS.levels });
    expect(commands(spec)).not.toContain('records');
  });

  it('leaves the pause of a task as it was', () => {
    const spec = pausePanel({ task: true, ...PAUSE });
    expect(spec.rows.find((candidate) => candidate.kind === 'command' && candidate.id === 'tasks')).toMatchObject({ label: COMMANDS.tasks });
    expect(commands(spec)).toEqual(['resume', 'restart', 'tasks', 'system', 'menu']);
  });

  it('has the rules to read again, between starting over and the list', () => {
    let read = 0;
    const spec = pausePanel({ task: true, list: COMMANDS.levels, onRules: () => read++, ...PAUSE });
    expect(commands(spec)).toEqual(['resume', 'restart', 'rules', 'tasks', 'system', 'menu']);
    const rules = spec.rows.find((candidate) => candidate.kind === 'command' && candidate.id === 'rules');
    expect(rules).toMatchObject({ label: COMMANDS.rules });
    if (rules?.kind === 'command') rules.action();
    expect(read).toBe(1);
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
