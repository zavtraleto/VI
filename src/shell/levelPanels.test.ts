import { describe, expect, it } from 'vitest';
import type { GoalLine } from '../rules';
import { textWidth } from './layout';
import { readmePages } from '../ui/readme';
import { LEVEL_RULES_PAGE, levelIntroPanel, levelResultPanel, levelRulesPanel, levelsPanel, pausePanel, readmePanel } from './panels';
import type { PanelRow, PanelSpec } from './screens/panel';
import { COMMANDS, PANELS, RESULT, goalLabel, goalProgress, goalText, type PanelName } from './text';

const nothing = (): void => undefined;

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
  const lines = ['Make only 3s.', 'The other faces do not work.'];
  /** After how many signs of the window each line starts. */
  const starts = (spec: PanelSpec): number[] => spec.rows.flatMap((candidate) => (candidate.kind === 'say' ? [candidate.after ?? -1] : []));

  it('says the rule a line to a row, under the number of the level, and starts on START', () => {
    const run: string[] = [];
    const spec = levelIntroPanel({ number: 3, lines }, { onStart: () => run.push('start'), onBack: () => run.push('back') });
    expect(spec.title).toEqual({ native: PANELS.levels.native, name: 'LEVEL 03' });
    expect(spec.rows.filter((candidate) => candidate.kind === 'say').map((candidate) => (candidate.kind === 'say' ? candidate.text : ''))).toEqual(lines);
    expect(commands(spec)).toEqual(['start', 'back']);
    expect(spec.home).toBe('start');
    for (const candidate of spec.rows) if (candidate.kind === 'command') candidate.action();
    spec.back?.();
    expect(run).toEqual(['start', 'back', 'back']);
  });

  it('types its words out: sign by sign, a line after the line above it', () => {
    const spec = levelIntroPanel({ number: 1, lines }, { onStart: nothing, onBack: nothing });
    // The second line waits for the first to end.
    expect(starts(spec)).toEqual([0, lines[0].length]);
    // The first frame starts the count, and signs come at one pace from it.
    expect(spec.typed?.(5000)).toBe(0);
    expect(spec.typed?.(5000 + 24 * 5)).toBe(5);
    expect(spec.typed?.(5000 + 24 * (lines[0].length + 4))).toBe(lines[0].length + 4);
    // Once all is said the count stands.
    const all = lines[0].length + lines[1].length;
    expect(spec.typed?.(5000 + 60000)).toBe(all);
    expect(spec.typed?.(5000 + 61000)).toBe(all);
    // The panel is not drawn again for the words: they are written by themselves.
    expect(spec.live).toBeUndefined();
  });

  it('has all its words at once for a player who has asked for less motion', () => {
    const spec = levelIntroPanel({ number: 1, lines, still: true }, { onStart: nothing, onBack: nothing });
    expect(spec.typed?.(0)).toBe(lines[0].length + lines[1].length);
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
    expect(spec.rows[0]).toEqual({ kind: 'say', text: 'Out of moves. Short by: 2' });
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
    expect(spec.rows[0]).toEqual({ kind: 'say', text: 'Dead end: one die is left' });
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
    expect(spec.rows[0]).toEqual({ kind: 'say', text: 'Out of moves. Short by: 7' });
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

  it('are shown a few to a window, numbered through', () => {
    const first = levelRulesPanel(RULES, 0, { onPage: nothing, onBack: nothing });
    expect(said(first)).toEqual(RULES.slice(0, LEVEL_RULES_PAGE).map((text, i) => `${i + 1}. ${text}`));
    const last = levelRulesPanel(RULES, 2, { onPage: nothing, onBack: nothing });
    expect(said(last)).toEqual(['7. seven']);
    expect(LEVEL_RULES_PAGE).toBeLessThanOrEqual(3);
  });

  it('say in their title which window of how many this is', () => {
    expect(levelRulesPanel(RULES, 1, { onPage: nothing, onBack: nothing }).title).toEqual({ native: PANELS.rules.native, name: 'RULES 2/3' });
  });

  it('lead on to the rules that follow and, past the last, back to the first', () => {
    const turned: number[] = [];
    const turn = (page: number): void => {
      const next = pick(levelRulesPanel(RULES, page, { onPage: (to) => turned.push(to), onBack: nothing }), 'next');
      expect(next).toMatchObject({ label: COMMANDS.next });
      if (next?.kind === 'command') next.action();
    };
    turn(0);
    turn(1);
    turn(2);
    expect(turned).toEqual([1, 2, 0]);
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

  it('show the note that came with the program a page to a window, and go round from the last to the first', () => {
    const pages = [['one', 'two'], ['three']];
    const turned: number[] = [];
    const first = readmePanel(pages, 0, { onPage: (to) => turned.push(to), onBack: nothing });
    expect(first.title).toEqual({ native: PANELS.readme.native, name: 'README 1/2' });
    expect(first.rows.filter((candidate) => candidate.kind === 'say').map((candidate) => (candidate as { text: string }).text)).toEqual(['one', 'two']);
    const last = readmePanel(pages, 1, { onPage: (to) => turned.push(to), onBack: nothing });
    for (const spec of [first, last]) row(spec, 'commands').commands.find((command) => command.id === 'next')!.action();
    expect(turned).toEqual([1, 0]);
  });

  it('cut the pages of the note into smaller windows for a low screen, with every paragraph whole and in its place', () => {
    for (const code of ['ru', 'en', 'de'] as const) {
      const pages = readmePages(code);
      const windows = readmePages(code, 330);
      expect(windows.length).toBeGreaterThan(pages.length);
      expect(windows.flat()).toEqual(pages.flat());
      for (const window of windows) {
        expect(window.length).toBeGreaterThan(0);
        if (window.length > 1) expect(window.join('').length).toBeLessThanOrEqual(330);
      }
    }
    expect(readmePages('de')).toEqual(readmePages('en'));
    expect(readmePages('ru')).toHaveLength(5);
  });
});
