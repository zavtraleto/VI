import { describe, expect, it } from 'vitest';
import { textWidth } from './layout';
import { clearedPanel, pausePanel, recordsPanel, resultPanel, rulesPanel, systemPanel, tasksPanel } from './panels';
import type { PanelRow, PanelSpec } from './screens/panel';

const nothing = (): void => undefined;
const run = (score: number, chain: number, ticks: number, date: string) => ({ score, chain, ticks, date });

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
      recordsPanel([{ runs: [], survival: true }], 0, 20, nothing),
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
    expect(spec.title.name).toBe('TIME UP');
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

describe('the log of sessions', () => {
  const sections = [
    { runs: [run(100, 2, 500, '2026-10-01'), run(900, 3, 300, '2026-10-02'), run(400, 9, 700, '2026-10-02')], survival: true },
    { runs: [run(50, 1, 9000, '2026-10-02')], survival: false },
  ];

  it('orders the sessions by the reading that is picked', () => {
    const spec = recordsPanel(sections, 0, 20, nothing);
    const table = row(spec, 'table');
    expect(table.rows().map(([, value]) => value)).toEqual(['000900', '000400', '000100']);
    row(spec, 'tabs', 1).pick(1);
    expect(table.rows()[0][1]).toBe('×09');
    row(spec, 'tabs', 1).pick(2);
    expect(table.rows()[0][1]).toBe('00:14');
  });

  it('has no survival time for sessions with a limit', () => {
    const spec = recordsPanel(sections, 0, 20, nothing);
    const modes = row(spec, 'tabs', 0);
    const metrics = row(spec, 'tabs', 1);
    expect(metrics.labels()).toHaveLength(3);
    metrics.pick(2);
    modes.pick(1);
    expect(metrics.labels()).toHaveLength(2);
    expect(metrics.selected()).toBe(1);
    expect(row(spec, 'table').rows()).toHaveLength(1);
  });

  it('opens on the kind of session that was asked for', () => {
    expect(row(recordsPanel(sections, 1, 20, nothing), 'tabs', 0).selected()).toBe(1);
    expect(row(recordsPanel(sections, 7, 20, nothing), 'tabs', 0).selected()).toBe(1);
  });
});

describe('the result of a session', () => {
  const data = { timeUp: true, score: 10, best: 20, maxChain: 2, ticks: 9000, tickMs: 20, note: null };
  const actions = { onAgain: nothing, onRecords: nothing, onMenu: nothing };
  const fields = (spec: PanelSpec) => spec.rows.flatMap((candidate) => (candidate.kind === 'field' ? [`${candidate.label.name} ${candidate.value}`] : []));

  it('names its day when it is the session of the day, and only then', () => {
    expect(fields(resultPanel({ ...data, day: 'H38.10.03' }, actions))).toContain('TODAY H38.10.03');
    expect(fields(resultPanel({ ...data, day: null }, actions)).join()).not.toContain('TODAY');
    expect(fields(resultPanel(data, actions)).join()).not.toContain('TODAY');
  });
});

describe('the table of players of a platform', () => {
  const sections = [
    { runs: [run(100, 2, 500, '2026-10-01')], survival: true },
    { runs: [], survival: false },
  ];
  const line = (rank: number, name: string, score: number, own = false) => ({ rank, name, score, own });
  const tables: Record<number, ReturnType<typeof line>[] | 'waiting' | 'failed'> = {
    0: [line(1, 'Ada', 5200), line(2, '  ', 900), line(41, 'A name far too long for the table', 70, true)],
    1: 'waiting',
  };
  const network = { lines: (section: number) => tables[section] };

  it('is not in the log where the platform has none', () => {
    const spec = recordsPanel(sections, 0, 20, nothing);
    expect(spec.rows.filter((candidate) => candidate.kind === 'tabs')).toHaveLength(2);
    expect(pressed(spec)).toEqual(['back']);
  });

  it('shows the players by name, with their places and the line of the one who plays', () => {
    const spec = recordsPanel(sections, 0, 20, nothing, network);
    const table = row(spec, 'table');
    expect(table.head()).toBe('日付');
    row(spec, 'tabs', 0).pick(1);
    expect(table.head()).toBe('名前');
    expect(table.rows()).toEqual([
      ['Ada', '005200', false, 1],
      ['NO NAME', '000900', false, 2],
      ['A name far too l', '000070', true, 41],
    ]);
  });

  it('is kept by score alone', () => {
    const spec = recordsPanel(sections, 0, 20, nothing, network);
    row(spec, 'tabs', 2).pick(2);
    row(spec, 'tabs', 0).pick(1);
    expect(row(spec, 'tabs', 2).labels()).toEqual(['SCORE']);
    expect(row(spec, 'tabs', 2).selected()).toBe(0);
  });

  it('says that the table is on its way, or did not come', () => {
    const spec = recordsPanel(sections, 1, 20, nothing, network);
    const table = row(spec, 'table');
    expect(table.empty()).toBe('記録なし NO ENTRY');
    row(spec, 'tabs', 0).pick(1);
    expect(table.rows()).toEqual([]);
    expect(table.empty()).toBe('接続中 CONNECTING');
    tables[1] = 'failed';
    expect(table.empty()).toBe('接続なし NO LINK');
  });

  it('names the day of a table that starts anew every day', () => {
    const spec = recordsPanel(sections, 0, 20, nothing, { ...network, day: (section) => (section === 1 ? 'H38.10.03' : null) });
    const table = row(spec, 'table');
    row(spec, 'tabs', 0).pick(1);
    expect(table.head()).toBe('名前');
    row(spec, 'tabs', 1).pick(1);
    expect(table.head()).toBe('名前 H38.10.03');
    row(spec, 'tabs', 0).pick(0);
    expect(table.head()).toBe('日付');
  });

  it('lets a guest be given a name where the platform can give one', () => {
    expect(pressed(recordsPanel(sections, 0, 20, nothing, network))).toEqual(['back']);
    const spec = recordsPanel(sections, 0, 20, nothing, { ...network, onRegister: nothing });
    expect(pressed(spec)).toEqual(['register', 'back']);
    expect(spec.home).toBe('back');
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
