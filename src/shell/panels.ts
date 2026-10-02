import { topRuns, type ControlMode, type RecordMetric, type RunRecord } from '../platform/settings';
import type { PanelCommand, PanelRow, PanelSpec } from './screens/panel';
import { COMMANDS, PANELS, RECORDS, RESULT, SYSTEM, digits } from './text';

/** A time in ticks as minutes and seconds. */
function clock(ticks: number, tickMs: number): string {
  const seconds = Math.floor((ticks * tickMs) / 1000);
  return `${digits(Math.floor(seconds / 60), 2)}:${digits(seconds % 60, 2)}`;
}

/** The session waits. In a task the log of sessions gives way to the list of tasks. */
export function pausePanel(actions: {
  task: boolean;
  onResume: () => void;
  onRestart: () => void;
  onRecords: () => void;
  onTasks: () => void;
  onSystem: () => void;
  onMenu: () => void;
}): PanelSpec {
  return {
    title: PANELS.pause,
    home: 'resume',
    back: actions.onResume,
    rows: [
      { kind: 'command', id: 'resume', label: COMMANDS.resume, action: actions.onResume },
      { kind: 'command', id: 'restart', label: COMMANDS.restart, action: actions.onRestart },
      actions.task
        ? { kind: 'command', id: 'tasks', label: COMMANDS.tasks, action: actions.onTasks }
        : { kind: 'command', id: 'records', label: COMMANDS.records, action: actions.onRecords },
      { kind: 'command', id: 'system', label: COMMANDS.system, action: actions.onSystem },
      { kind: 'command', id: 'menu', label: COMMANDS.menu, action: actions.onMenu },
    ],
  };
}

/** What the player can set. */
export interface SystemValues {
  muted: boolean;
  reducedMotion: boolean;
  shake: boolean;
  control: ControlMode;
}

export function systemPanel(actions: {
  values: () => SystemValues;
  onToggle: (key: keyof SystemValues) => void;
  /** Commands of the development tools; a production build passes none. */
  tools?: readonly PanelCommand[];
  onBack: () => void;
}): PanelSpec {
  const { values } = actions;
  return {
    title: PANELS.system,
    home: 'sound',
    back: actions.onBack,
    rows: [
      { kind: 'switch', id: 'sound', label: SYSTEM.sound, value: () => (values().muted ? SYSTEM.off : SYSTEM.on), action: () => actions.onToggle('muted') },
      {
        kind: 'switch',
        id: 'motion',
        label: SYSTEM.motion,
        value: () => (values().reducedMotion ? SYSTEM.reduced : SYSTEM.full),
        action: () => actions.onToggle('reducedMotion'),
      },
      { kind: 'switch', id: 'shake', label: SYSTEM.shake, value: () => (values().shake ? SYSTEM.on : SYSTEM.off), action: () => actions.onToggle('shake') },
      {
        kind: 'switch',
        id: 'control',
        label: SYSTEM.control,
        value: () => (values().control === 'gesture' ? SYSTEM.swipe : SYSTEM.buttons),
        action: () => actions.onToggle('control'),
      },
      { kind: 'gap' },
      { kind: 'commands', commands: [...(actions.tools ?? []), { id: 'back', label: COMMANDS.back, action: actions.onBack }] },
    ],
  };
}

export interface ResultData {
  /** The session ran out of time, not of room. */
  timeUp: boolean;
  score: number;
  best: number;
  maxChain: number;
  ticks: number;
  tickMs: number;
  /** What there is to say about the record, in the language of the player. */
  note: string | null;
}

/** What a session came to. */
export function resultPanel(data: ResultData, actions: { onAgain: () => void; onRecords: () => void; onMenu: () => void }): PanelSpec {
  const rows: PanelRow[] = [
    { kind: 'number', label: RESULT.score, value: data.score, places: 6 },
    { kind: 'field', label: RESULT.best, value: digits(data.best, 6) },
    { kind: 'field', label: RESULT.chain, value: `×${digits(data.maxChain, 2)}` },
    { kind: 'field', label: RESULT.time, value: clock(data.ticks, data.tickMs) },
  ];
  if (data.note) rows.push({ kind: 'say', text: data.note });
  rows.push(
    { kind: 'gap' },
    { kind: 'command', id: 'again', label: COMMANDS.again, action: actions.onAgain },
    { kind: 'command', id: 'records', label: COMMANDS.records, action: actions.onRecords },
    { kind: 'command', id: 'menu', label: COMMANDS.menu, action: actions.onMenu },
  );
  return { title: data.timeUp ? PANELS.timeUp : PANELS.result, home: 'again', rows };
}

/** The sessions of one kind, for the log. */
export interface RecordsSection {
  runs: readonly RunRecord[];
  /** Survival time only means something where the session can end early. */
  survival: boolean;
}

/** The log of the best sessions of this device, by kind of session and by reading. */
export function recordsPanel(sections: readonly RecordsSection[], initial: number, tickMs: number, onBack: () => void): PanelSpec {
  const metrics: readonly { key: RecordMetric; format: (run: RunRecord) => string }[] = [
    { key: 'score', format: (run) => digits(run.score, 6) },
    { key: 'chain', format: (run) => `×${digits(run.chain, 2)}` },
    { key: 'ticks', format: (run) => clock(run.ticks, tickMs) },
  ];
  let section = Math.min(Math.max(initial, 0), sections.length - 1);
  let metric = 0;
  const shown = (): number => (sections[section].survival ? metrics.length : metrics.length - 1);
  return {
    title: PANELS.records,
    home: 'back',
    back: onBack,
    rows: [
      {
        kind: 'tabs',
        id: 'mode',
        labels: () => RECORDS.modes.slice(0, sections.length),
        selected: () => section,
        pick: (index) => {
          section = index;
          metric = Math.min(metric, shown() - 1);
        },
      },
      { kind: 'tabs', id: 'metric', labels: () => RECORDS.metrics.slice(0, shown()), selected: () => metric, pick: (index) => (metric = index) },
      {
        kind: 'table',
        head: RECORDS.date,
        empty: RECORDS.empty,
        lines: 10,
        rows: () => topRuns(sections[section].runs, metrics[metric].key, 10).map((run) => [run.date, metrics[metric].format(run)] as const),
      },
      { kind: 'command', id: 'back', label: COMMANDS.back, action: onBack },
    ],
  };
}

/** The rules of the tasks, in the language of the player. With `onStart` this is the showing before the first task. */
export function rulesPanel(lines: readonly string[], actions: { onStart?: () => void; onBack: () => void }): PanelSpec {
  const rows: PanelRow[] = lines.map((text, i) => ({ kind: 'say', text: `${i + 1}. ${text}` }));
  rows.push({ kind: 'gap' });
  if (actions.onStart) rows.push({ kind: 'command', id: 'start', label: COMMANDS.start, action: actions.onStart });
  rows.push({ kind: 'command', id: 'back', label: COMMANDS.back, action: actions.onBack });
  return { title: PANELS.rules, home: actions.onStart ? 'start' : 'back', back: actions.onBack, rows };
}

/** Every task, with what it has earned. All of them can be picked; `tier` is the kind of a task, in the language of the player. */
export function tasksPanel(
  levels: readonly { stars: number; tier: string }[],
  current: number,
  /** `tools` are commands of the development tools; a production build passes none. */
  actions: { onPick: (index: number) => void; onRules: () => void; tools?: readonly PanelCommand[]; onBack: () => void },
): PanelSpec {
  return {
    title: PANELS.tasks,
    home: `task-${current}`,
    back: actions.onBack,
    rows: [
      { kind: 'levels', id: 'task', levels, current, pick: actions.onPick, note: (index) => levels[index]?.tier ?? '' },
      {
        kind: 'commands',
        commands: [
          { id: 'rules', label: COMMANDS.rules, action: actions.onRules },
          ...(actions.tools ?? []),
          { id: 'back', label: COMMANDS.menu, action: actions.onBack },
        ],
      },
    ],
  };
}

/** A task is cleared: what it earned, in how many moves against the fewest. */
export function clearedPanel(
  data: { stars: number; moves: number; target: number; hasNext: boolean },
  actions: { onNext: () => void; onAgain: () => void; onTasks: () => void },
): PanelSpec {
  const rows: PanelRow[] = [
    { kind: 'stars', count: data.stars },
    { kind: 'field', label: RESULT.moves, value: digits(data.moves, 2) },
    { kind: 'field', label: RESULT.least, value: digits(data.target, 2) },
    { kind: 'gap' },
  ];
  if (data.hasNext) rows.push({ kind: 'command', id: 'next', label: COMMANDS.next, action: actions.onNext });
  rows.push(
    { kind: 'command', id: 'again', label: COMMANDS.again, action: actions.onAgain },
    { kind: 'command', id: 'tasks', label: COMMANDS.tasks, action: actions.onTasks },
  );
  return { title: PANELS.cleared, home: data.hasNext ? 'next' : 'again', rows };
}
