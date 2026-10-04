import { describe, expect, it } from 'vitest';
import type { GoalLine } from '../rules';
import { textWidth } from './layout';
import { levelResultPanel, levelsPanel, pausePanel } from './panels';
import type { PanelRow, PanelSpec } from './screens/panel';
import { ANSWERS, COMMANDS, PANELS, RESULT, goalLabel, goalProgress, goalText, type PanelName } from './text';

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

  it('has a cell for every level, with one mark on the ones passed', () => {
    const spec = levelsPanel(levels, 1, { onPick: nothing, share, onBack: nothing });
    const cells = row(spec, 'levels');
    expect(spec.title).toBe(PANELS.levels);
    expect(cells.levels).toEqual([{ stars: 1 }, { stars: 0 }, { stars: 0 }]);
    expect(cells.marks).toBe(1);
    expect(cells.current).toBe(1);
    expect(spec.home).toBe('level-1');
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

  it('asks a passed level whether it was liked, and takes yes or no', () => {
    let liked: boolean | null = null;
    const spec = levelResultPanel(
      { passed: true, left: null, moves: 5, best: 5, goal: CLEAR, hasNext: true, liked: { question: 'Did you like it?', answer: () => liked } },
      { ...actions, onLiked: (answer) => (liked = answer) },
    );
    expect(spec.rows.find((candidate) => candidate.kind === 'say')).toEqual({ kind: 'say', text: 'Did you like it?' });
    const answers = row(spec, 'tabs');
    expect(answers.labels()).toEqual([ANSWERS.yes, ANSWERS.no]);
    // Nothing is picked until the player answers.
    expect(answers.selected()).toBe(-1);
    answers.pick(1);
    expect(liked).toBe(false);
    expect(answers.selected()).toBe(1);
    answers.pick(0);
    expect(liked).toBe(true);
    expect(answers.selected()).toBe(0);
    // The question does not stand in the way: the next level is still the first thing to press.
    expect(spec.home).toBe('next');
    expect(commands(spec)).toEqual(['next', 'again', 'levels']);
  });

  it('does not ask after a level that failed', () => {
    const spec = levelResultPanel(
      { passed: false, left: null, moves: 5, goal: CLEAR, hasNext: true, reason: 'Dead end', liked: { question: 'Did you like it?', answer: () => null } },
      { ...actions, onLiked: nothing },
    );
    expect(spec.rows.some((candidate) => candidate.kind === 'tabs')).toBe(false);
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
  });
});
