import { describe, expect, it } from 'vitest';
import { Climb } from './climb';
import { textWidth } from './layout';
import { clearedPanel, pausePanel, recordsPanel, resultPanel, rulesPanel, systemPanel, tasksPanel, type RecordsTable } from './panels';
import type { PanelRow, PanelSpec } from './screens/panel';

const nothing = (): void => undefined;

function row<K extends PanelRow['kind']>(spec: PanelSpec, kind: K, nth = 0): Extract<PanelRow, { kind: K }> {
  return spec.rows.filter((candidate) => candidate.kind === kind)[nth] as Extract<PanelRow, { kind: K }>;
}

/** Ids of everything of a panel that can be pressed. */
function pressed(spec: PanelSpec): string[] {
  return spec.rows.flatMap((candidate) =>
    candidate.kind === 'command' || candidate.kind === 'switch'
      ? [candidate.id]
      : candidate.kind === 'commands'
        ? candidate.commands.map((command) => command.id)
        : [],
  );
}

const PAUSE = { onResume: nothing, onRestart: nothing, onRecords: nothing, onTasks: nothing, onSystem: nothing, onMenu: nothing };

describe('the panels of the program', () => {
  it('open with the focus on something that can be pressed', () => {
    const specs = [
      pausePanel({ task: false, ...PAUSE }),
      systemPanel({ values: () => ({ muted: false, reducedMotion: false, shake: true, control: 'gesture', view: 'auto' }), onToggle: nothing, onBack: nothing }),
      resultPanel({ timeUp: false, score: 10, best: 20, maxChain: 2, ticks: 100, tickMs: 20, note: null }, { onAgain: nothing, onRecords: nothing, onMenu: nothing }),
      recordsPanel(() => ({ lines: [] }), 0, { onBack: nothing }),
      rulesPanel(['a', 'b'], { onBack: nothing }),
      rulesPanel(['a', 'b'], { onStart: nothing, onBack: nothing }),
      clearedPanel({ stars: 2, moves: 5, target: 4, hasNext: true }, { onNext: nothing, onAgain: nothing, onTasks: nothing }),
    ];
    for (const spec of specs) expect(pressed(spec)).toContain(spec.home);
  });

  it('have commands short enough for the panel of a phone', () => {
    for (const candidate of pausePanel({ task: false, ...PAUSE }).rows) {
      if (candidate.kind === 'command') expect(textWidth(`${candidate.label.native} ${candidate.label.name}`)).toBeLessThanOrEqual(200);
    }
  });

  it('lead from the pause of a task to the tasks, and from the pause of a session to its log', () => {
    expect(pressed(pausePanel({ task: true, ...PAUSE }))).toContain('tasks');
    expect(pressed(pausePanel({ task: true, ...PAUSE }))).not.toContain('records');
    expect(pressed(pausePanel({ task: false, ...PAUSE }))).toContain('records');
  });

  it('show a setting as it stands now', () => {
    const values = { muted: false, reducedMotion: false, shake: true, control: 'gesture' as const, view: 'auto' as 'auto' | 'full' };
    const spec = systemPanel({
      values: () => values,
      onToggle: (key) => {
        if (key === 'muted') values.muted = !values.muted;
        if (key === 'view') values.view = values.view === 'auto' ? 'full' : 'auto';
      },
      onBack: nothing,
    });
    const sound = row(spec, 'switch');
    expect(sound.value()).toBe('ON');
    sound.action();
    expect(sound.value()).toBe('OFF');
    // The camera follows by itself, or is kept on the whole board.
    const view = spec.rows.find((candidate) => candidate.kind === 'switch' && candidate.id === 'view');
    if (view?.kind !== 'switch') throw new Error('no switch of the view');
    expect(view.value()).toBe('AUTO');
    view.action();
    expect(view.value()).toBe('FIXED');
  });

  it('offer the next task only where there is one', () => {
    const actions = { onNext: nothing, onAgain: nothing, onTasks: nothing };
    expect(pressed(clearedPanel({ stars: 3, moves: 4, target: 4, hasNext: true }, actions))).toContain('next');
    expect(pressed(clearedPanel({ stars: 3, moves: 4, target: 4, hasNext: false }, actions))).not.toContain('next');
  });

  it('say what there is to say about a record under the readings of a result', () => {
    const actions = { onAgain: nothing, onRecords: nothing, onMenu: nothing };
    const data = { timeUp: true, score: 10, best: 20, maxChain: 2, ticks: 9000, tickMs: 20, note: 'a new best' };
    const spec = resultPanel(data, actions);
    expect(spec.title).toMatchObject({ name: 'TIME UP' });
    expect(row(spec, 'say').text).toBe('a new best');
    expect(row(spec, 'field', 2).value).toBe('03:00');
    expect(resultPanel({ ...data, note: null }, actions).rows.some((candidate) => candidate.kind === 'say')).toBe(false);
  });

  it('name the kind of the task in focus', () => {
    const levels = [
      { stars: 0, tier: 'first' },
      { stars: 3, tier: 'second' },
    ];
    const spec = tasksPanel(levels, 1, { onPick: nothing, onRules: nothing, onBack: nothing });
    expect(spec.home).toBe('task-1');
    expect(row(spec, 'levels').note(1)).toBe('second');
  });
});

describe('the result of a session', () => {
  const data = { timeUp: true, score: 10, best: 20, maxChain: 2, ticks: 9000, tickMs: 20, note: null };
  const actions = { onAgain: nothing, onRecords: nothing, onMenu: nothing };
  const value = (field: Extract<PanelRow, { kind: 'field' }>): string => (typeof field.value === 'function' ? field.value() : field.value);
  const fields = (spec: PanelSpec) => spec.rows.flatMap((candidate) => (candidate.kind === 'field' ? [`${candidate.label.name} ${value(candidate)}`] : []));

  it('names its day when it is the session of the day, and only then', () => {
    expect(fields(resultPanel({ ...data, day: 'H38.10.03' }, actions))).toContain('TODAY H38.10.03');
    expect(fields(resultPanel({ ...data, day: null }, actions)).join()).not.toContain('TODAY');
    expect(fields(resultPanel(data, actions)).join()).not.toContain('TODAY');
  });

  it('has its three commands in one line that stacks on a tall picture', () => {
    const commands = row(resultPanel(data, actions), 'commands');
    expect(commands.stacked).toBe(true);
    expect(commands.commands.map((command) => command.id)).toEqual(['again', 'records', 'menu']);
  });
});

describe('the result of a session that goes up the log', () => {
  const actions = { onAgain: nothing, onRecords: nothing, onMenu: nothing };
  const lines = [
    { name: 'a', score: 900, own: false, subject: false },
    { name: 'me', score: 400, own: true, subject: false },
    { name: 'b', score: 100, own: false, subject: false },
  ];
  const result = (score: number) => {
    const climb = new Climb({ lines, score, name: 'me', record: score > 400 });
    const spec = resultPanel({ timeUp: false, score, best: Math.max(400, score), before: 400, maxChain: 2, ticks: 100, tickMs: 20, note: 'a new best' }, actions, climb);
    return { climb, spec };
  };
  const title = (spec: PanelSpec): string => (typeof spec.title === 'function' ? spec.title() : spec.title).name;
  const best = (spec: PanelSpec): string => {
    const field = row(spec, 'field');
    return typeof field.value === 'function' ? field.value() : field.value;
  };

  it('counts the score up beside its place, and shows the log around the session', () => {
    const { spec } = result(500);
    const standing = row(spec, 'standing');
    expect(standing.value()).toBe(0);
    expect(standing.place()).toBe(4);
    expect(standing.of()).toBe(4);
    expect(row(spec, 'climb').rows(3).map((line) => line?.name ?? null)).toEqual(['b', 'me', null]);
    expect(pressed(spec)).toContain(spec.home);
  });

  it('keeps the record to itself until the place is taken', () => {
    const { climb, spec } = result(500);
    expect(title(spec)).toBe('RESULT');
    expect(best(spec)).toBe('000400');
    expect(row(spec, 'say').when?.()).toBe(false);
    expect(spec.flash?.()).toBe(false);
    expect(spec.live?.(0)).toBe(true);
    climb.finish();
    spec.live?.(16);
    expect(title(spec)).toBe('NEW RECORD');
    expect(best(spec)).toBe('000500');
    expect(row(spec, 'say').when?.()).toBe(true);
    expect(spec.flash?.()).toBe(true);
    expect(row(spec, 'standing').place()).toBe(2);
    expect(row(spec, 'standing').of()).toBe(3);
    // The bar stops blinking a moment later, and the name stays.
    spec.live?.(5000);
    expect(spec.flash?.()).toBe(false);
    expect(title(spec)).toBe('NEW RECORD');
  });

  it('is a plain result where the session stays under the best there was', () => {
    const { climb, spec } = result(300);
    climb.finish();
    spec.live?.(16);
    expect(title(spec)).toBe('RESULT');
    expect(best(spec)).toBe('000400');
    expect(spec.flash?.()).toBe(false);
    expect(row(spec, 'standing').place()).toBe(3);
    expect(row(spec, 'standing').of()).toBe(4);
  });
});

describe('the log of sessions', () => {
  const line = (rank: number, name: string, score: number, own = false) => ({ rank, name, score, own });
  const tables: RecordsTable[] = [
    { lines: [line(1, 'Ada', 5200), line(2, '  ', 900), line(41, 'A name far too long for the table', 70, true)] },
    { lines: [], link: 'waiting', day: 'H38.10.03' },
  ];
  const table = (section: number): RecordsTable => tables[section];

  it('has a tab for each kind of session, and no other tabs', () => {
    const spec = recordsPanel(table, 0, { onBack: nothing });
    const tabs = spec.rows.filter((candidate) => candidate.kind === 'tabs');
    expect(tabs).toHaveLength(1);
    expect(row(spec, 'tabs').labels()).toEqual(['PROTOCOL', 'LIMITED']);
  });

  it('opens on the kind of session that was asked for', () => {
    expect(row(recordsPanel(table, 1, { onBack: nothing }), 'tabs').selected()).toBe(1);
    expect(row(recordsPanel(table, 7, { onBack: nothing }), 'tabs').selected()).toBe(1);
  });

  it('shows the lines by name, with their places and the line of the one who plays', () => {
    const spec = recordsPanel(table, 0, { onBack: nothing });
    const log = row(spec, 'table');
    expect(log.head()).toBe('名前');
    expect(log.status?.()).toBe('');
    expect(log.rows()).toEqual([
      ['Ada', '005200', false, 1],
      ['NO NAME', '000900', false, 2],
      ['A name far too l', '000070', true, 41],
    ]);
  });

  it('names the day of a log that starts anew every day, and says how the platform stands', () => {
    const spec = recordsPanel(table, 0, { onBack: nothing });
    const log = row(spec, 'table');
    row(spec, 'tabs').pick(1);
    expect(log.head()).toBe('名前 H38.10.03');
    expect(log.rows()).toEqual([]);
    expect(log.empty()).toBe('記録なし NO ENTRY');
    expect(log.status?.()).toBe('接続中');
    tables[1] = { ...tables[1], link: 'failed' };
    expect(log.status?.()).toBe('接続なし');
    // The head and what the platform has to say of itself fit the panel of a phone side by side.
    expect(textWidth(`No. ${log.head()} ${log.status?.()}`)).toBeLessThanOrEqual(248);
  });

  it('lets a guest be given a name where the platform can give one', () => {
    expect(pressed(recordsPanel(table, 0, { onBack: nothing }))).toEqual(['back']);
    const spec = recordsPanel(table, 0, { onBack: nothing, onRegister: nothing });
    expect(pressed(spec)).toEqual(['register', 'back']);
    expect(spec.home).toBe('back');
  });

  it('has the sharing under the way back: it sends the log in sight, and reads what came of it', () => {
    const sent: number[] = [];
    let label = { native: '共有', name: 'SHARE' };
    const spec = recordsPanel(table, 0, { onBack: nothing, share: { label: () => label, action: (section) => sent.push(section) } });
    expect(pressed(spec)).toEqual(['back', 'share']);
    const share = spec.rows[spec.rows.length - 1];
    if (share.kind !== 'command') throw new Error('no command of sharing');
    expect(share.label.name).toBe('SHARE');
    // Writing to the clipboard is allowed only inside a press.
    expect(share.instant).toBe(true);
    row(spec, 'tabs').pick(1);
    share.action();
    expect(sent).toEqual([1]);
    label = { native: '複写済', name: 'COPIED' };
    expect(share.label.name).toBe('COPIED');
    expect(share.label.native).toBe('複写済');
  });
});

describe('the tools of development', () => {
  const tool = { id: 'playtest', label: { native: 'DEV', name: 'PLAYTEST' }, action: nothing };

  it('are in a panel only when they are passed to it', () => {
    const values = () => ({ muted: false, reducedMotion: false, shake: true, control: 'gesture' as const, view: 'auto' as const });
    expect(pressed(systemPanel({ values, onToggle: nothing, onBack: nothing }))).toEqual(['sound', 'motion', 'shake', 'control', 'view', 'back']);
    expect(pressed(systemPanel({ values, onToggle: nothing, tools: [tool], onBack: nothing }))).toContain('playtest');
    const levels = [{ stars: 0, tier: 'first' }];
    expect(pressed(tasksPanel(levels, 0, { onPick: nothing, onRules: nothing, onBack: nothing }))).toEqual(['rules', 'back']);
    expect(pressed(tasksPanel(levels, 0, { onPick: nothing, onRules: nothing, tools: [tool], onBack: nothing }))).toContain('playtest');
  });
});
