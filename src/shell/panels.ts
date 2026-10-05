import type { ControlMode, ViewSetting } from '../platform/settings';
import type { GoalLine } from '../rules';
import type { Climb } from './climb';
import { textWidth } from './layout';
import type { PanelCommand, PanelRow, PanelSpec, TableLine } from './screens/panel';
import { COMMANDS, GOAL, LADDER, PANELS, RECORDS, RESULT, SYSTEM, digits, goalLabel, goalProgress, goalText, type PanelName } from './text';

/** A time in ticks as minutes and seconds. */
function clock(ticks: number, tickMs: number): string {
  const seconds = Math.floor((ticks * tickMs) / 1000);
  return `${digits(Math.floor(seconds / 60), 2)}:${digits(seconds % 60, 2)}`;
}

/**
 * The session waits. In a task the log of sessions gives way to the list of tasks; `list` names
 * that list where it is another one, the levels.
 */
export function pausePanel(actions: {
  task: boolean;
  list?: PanelName;
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
        ? { kind: 'command', id: 'tasks', label: actions.list ?? COMMANDS.tasks, action: actions.onTasks }
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
  view: ViewSetting;
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
      { kind: 'switch', id: 'view', label: SYSTEM.view, value: () => (values().view === 'auto' ? SYSTEM.auto : SYSTEM.fixed), action: () => actions.onToggle('view') },
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
  /** The best there was before this session: what the result shows until the session has taken its place. */
  before?: number;
  /** The day a session of the day belongs to, as the program writes it; null for any other session. */
  day?: string | null;
  maxChain: number;
  ticks: number;
  tickMs: number;
  /** What there is to say about the record, in the language of the player. */
  note: string | null;
}

/** Rows of the log a result shows around the session on its way up. */
const CLIMB_LINES = 7;

/**
 * What a session came to. With `climb`, the session goes up the log of its kind under the eyes
 * of the player: its score is counted up and its place beside it, lines of the log go by, and
 * what there is to say about a record is said once the place is taken.
 */
export function resultPanel(data: ResultData, actions: { onAgain: () => void; onRecords: () => void; onMenu: () => void }, climb?: Climb): PanelSpec {
  const name = data.timeUp ? PANELS.timeUp : PANELS.result;
  const settled = (): boolean => climb?.done ?? true;
  const rows: PanelRow[] = [];
  if (climb) {
    rows.push(
      {
        kind: 'standing',
        label: RESULT.score,
        value: () => climb.shownScore(),
        places: 6,
        rank: RESULT.rank,
        place: () => climb.shownPlace(),
        of: () => climb.total,
        lit: () => climb.lit,
      },
      { kind: 'climb', rows: (count) => climb.rows(count).map((line) => line && { ...line, name: fitName(line.name) }), lines: CLIMB_LINES },
    );
  } else {
    rows.push({ kind: 'number', label: RESULT.score, value: data.score, places: 6 });
  }
  rows.push(
    { kind: 'field', label: RESULT.best, value: () => digits(settled() ? data.best : (data.before ?? data.best), 6) },
    { kind: 'field', label: RESULT.chain, value: `×${digits(data.maxChain, 2)}` },
    { kind: 'field', label: RESULT.time, value: clock(data.ticks, data.tickMs) },
  );
  if (data.day) rows.push({ kind: 'field', label: RESULT.day, value: data.day });
  if (data.note) rows.push({ kind: 'say', text: data.note, when: settled });
  rows.push(
    { kind: 'gap' },
    {
      kind: 'commands',
      stacked: true,
      commands: [
        { id: 'again', label: COMMANDS.again, action: actions.onAgain },
        { id: 'records', label: COMMANDS.records, action: actions.onRecords },
        { id: 'menu', label: COMMANDS.menu, action: actions.onMenu },
      ],
    },
  );
  if (!climb) return { title: name, home: 'again', rows };
  return {
    // The place is taken above the best there was: the bar says so, and blinks while the place is lit.
    title: () => (climb.done && climb.record ? PANELS.record : name),
    flash: () => climb.record && climb.lit,
    live: (timeMs) => climb.update(timeMs),
    home: 'again',
    rows,
  };
}

/** A line of the log of sessions. */
export interface RecordLine {
  rank: number;
  name: string;
  score: number;
  /** The line of the one who is playing. */
  own: boolean;
}

/** The log of one kind of session. */
export interface RecordsTable {
  lines: readonly RecordLine[];
  /** How the asking for the players of the platform stands, while they are not in the log. */
  link?: 'waiting' | 'failed' | null;
  /** The day the log is of, as the program writes it, where it starts anew every day. */
  day?: string | null;
}

export interface RecordsActions {
  onBack: () => void;
  /** The player is a guest the platform can give a name to. */
  onRegister?: () => void;
  /**
   * Sends out what the player has in the log in sight, with a link to the game. `label` is what
   * the command reads: its name, or what came of the last sending.
   */
  share?: { label: () => PanelName; action: (section: number) => void };
}

/** Widest a name gets in the table, in places of the font. */
const NAME_PLACES = 16;

/** A name of a player, cut to the room the table has for it. */
function fitName(name: string): string {
  let fitted = '';
  for (const sign of name.replace(/\s+/g, ' ').trim()) {
    if (textWidth(fitted + sign) > textWidth('0') * NAME_PLACES) break;
    fitted += sign;
  }
  return fitted.trim() || RECORDS.nameless;
}

/**
 * The log of sessions, one for each kind of session: what the program had in it before the
 * player, the players a platform knows, and the one who plays, by score.
 */
export function recordsPanel(table: (section: number) => RecordsTable, initial: number, actions: RecordsActions): PanelSpec {
  let section = Math.min(Math.max(initial, 0), RECORDS.modes.length - 1);
  const rows: PanelRow[] = [
    { kind: 'tabs', id: 'mode', labels: () => RECORDS.modes, selected: () => section, pick: (index) => (section = index) },
    {
      kind: 'table',
      head: () => {
        const day = table(section).day;
        return day ? `${RECORDS.name} ${day}` : RECORDS.name;
      },
      status: () => {
        const link = table(section).link;
        return link === 'waiting' ? RECORDS.waiting : link === 'failed' ? RECORDS.failed : '';
      },
      empty: () => RECORDS.empty,
      lines: 12,
      rows: (): readonly TableLine[] => table(section).lines.map((line) => [fitName(line.name), digits(line.score, 6), line.own, line.rank] as const),
    },
  ];
  const back: PanelCommand = { id: 'back', label: COMMANDS.back, action: actions.onBack };
  if (actions.onRegister) rows.push({ kind: 'commands', commands: [{ id: 'register', label: COMMANDS.register, action: actions.onRegister }, back] });
  else rows.push({ kind: 'command', ...back });
  const { share } = actions;
  if (share) {
    // What the command reads is asked for every time it is drawn: it answers the last sending for a moment.
    const label: PanelName = {
      get native() {
        return share.label().native;
      },
      get name() {
        return share.label().name;
      },
    };
    rows.push({ kind: 'command', id: 'share', label, action: () => share.action(section), instant: true });
  }
  return { title: PANELS.records, home: 'back', back: actions.onBack, rows };
}

/** What a command reads, asked for every time it is drawn: the command of sharing answers the last sending for a moment. */
function liveLabel(label: () => PanelName): PanelName {
  return {
    get native() {
      return label().native;
    },
    get name() {
      return label().name;
    },
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

/**
 * Every level, with the stars of the ones passed, out of three: those of its best pass, and
 * one where `stars` is not said. Under them the goal of the level in focus is written as
 * the readings of a level write it, with nothing counted yet. A level of a chapter that is not
 * open is `locked`: it cannot be picked, and what is written under it is the stars the player
 * holds against the stars its chapter asks for.
 * `share` sends out what the player did on the levels, as text: the report of the playtest.
 */
export function levelsPanel(
  levels: readonly { passed: boolean; goal: readonly GoalLine[]; faces?: readonly number[]; stars?: number; locked?: { have: number; need: number } }[],
  current: number,
  actions: { onPick: (index: number) => void; share: { label: () => PanelName; action: () => void }; onBack: () => void },
): PanelSpec {
  return {
    title: PANELS.levels,
    home: `level-${current}`,
    back: actions.onBack,
    rows: [
      {
        kind: 'levels',
        id: 'level',
        levels: levels.map((level) => ({ stars: level.locked ? 0 : (level.stars ?? (level.passed ? 1 : 0)), locked: level.locked !== undefined })),
        marks: 3,
        current,
        pick: (index) => {
          if (!levels[index]?.locked) actions.onPick(index);
        },
        // The faces that work on the level come first: they are what its chapter is about.
        note: (index) => {
          const level = levels[index];
          if (!level) return '';
          if (level.locked) return `${LADDER.locked} · ${LADDER.stars} ${digits(level.locked.have, 2)}/${digits(level.locked.need, 2)}`;
          return level.faces ? `${GOAL.face} ${level.faces.join(' ')} · ${goalText(level.goal)}` : goalText(level.goal);
        },
        program: true,
      },
      {
        kind: 'commands',
        commands: [
          { id: 'share', label: liveLabel(actions.share.label), action: actions.share.action, instant: true },
          { id: 'back', label: COMMANDS.menu, action: actions.onBack },
        ],
      },
    ],
  };
}

/** Signs of the window a level opens with come one in so many milliseconds: typed, at the pace of quick typing. */
const INTRO_SIGN_MS = 24;

/**
 * The window a level that brings a rule opens with: the rule, in the language of the player, a
 * thought to a line, typed out sign by sign, one line after another; with `still`, all of it
 * is there at once. The level begins when the window is left: `START` does not wait for the
 * typing to end.
 */
export function levelIntroPanel(
  data: { number: number; lines: readonly string[]; still?: boolean },
  actions: { onStart: () => void; onBack: () => void },
): PanelSpec {
  let total = 0;
  const rows: PanelRow[] = data.lines.map((text) => {
    const after = total;
    total += text.length;
    return { kind: 'say', text, after };
  });
  let began = -1;
  rows.push(
    { kind: 'gap' },
    { kind: 'command', id: 'start', label: COMMANDS.start, action: actions.onStart },
    { kind: 'command', id: 'back', label: COMMANDS.back, action: actions.onBack },
  );
  return {
    title: { native: PANELS.levels.native, name: `LEVEL ${digits(data.number, 2)}` },
    home: 'start',
    back: actions.onBack,
    rows,
    // The count starts on the frame the window is first there.
    typed: (timeMs) => {
      if (data.still) return total;
      if (began < 0) began = timeMs;
      return Math.min(total, Math.floor((timeMs - began) / INTRO_SIGN_MS));
    },
  };
}

/** What a level that is over shows. */
export interface LevelResult {
  passed: boolean;
  /** Moves left of a limit; null on a level with none. */
  left: number | null;
  moves: number;
  /** Fewest moves the player has passed the level in; null before the first pass. */
  best?: number | null;
  goal: readonly GoalLine[];
  hasNext: boolean;
  /** Why the level was not passed, in the language of the player. */
  reason?: string;
  /** Moves that can still be taken back: with any, a failed level offers to take the last one back. */
  undos?: number;
  /** Stars of the pass, where a level is rated by its moves. */
  stars?: number;
}

/**
 * A level is over. Passed, it says how many moves were left, or how many it took where there
 * was no limit and the fewest the player has done it in; a level rated by its moves shows the
 * stars of the pass, its moves and the fewest of the player, and not the fewest there are: what
 * the top mark takes is the player's to find;
 * failed, why, in the language of the player, and how far every line of its goal had come. A
 * failed level whose moves can still be taken back offers that first: the level goes on from
 * before its last move. The next level is offered after a pass.
 */
export function levelResultPanel(
  data: LevelResult,
  actions: { onNext: () => void; onAgain: () => void; onLevels: () => void; onUndo?: () => void },
): PanelSpec {
  const rows: PanelRow[] = [];
  if (data.reason) rows.push({ kind: 'say', text: data.reason });
  if (!data.passed) rows.push(...data.goal.map((line): PanelRow => ({ kind: 'field', label: { native: goalLabel(line), name: '' }, value: goalProgress(line) })));
  else if (data.stars !== undefined) {
    rows.push({ kind: 'stars', count: data.stars }, { kind: 'field', label: RESULT.moves, value: digits(data.moves, 2) });
    if (data.best !== undefined && data.best !== null) rows.push({ kind: 'field', label: RESULT.best, value: digits(data.best, 2) });
  } else if (data.left === null) {
    rows.push({ kind: 'field', label: RESULT.moves, value: digits(data.moves, 2) });
    if (data.best !== undefined && data.best !== null) rows.push({ kind: 'field', label: RESULT.best, value: digits(data.best, 2) });
  } else rows.push({ kind: 'field', label: RESULT.left, value: digits(data.left, 2) });
  const { onUndo } = actions;
  rows.push({ kind: 'gap' });
  const next = data.passed && data.hasNext;
  const undo = !data.passed && onUndo !== undefined && (data.undos ?? 0) > 0;
  if (next) rows.push({ kind: 'command', id: 'next', label: COMMANDS.next, action: actions.onNext });
  if (undo) rows.push({ kind: 'command', id: 'undo', label: { native: COMMANDS.undo.native, name: `${COMMANDS.undo.name} ${data.undos}` }, action: onUndo });
  rows.push(
    { kind: 'command', id: 'again', label: COMMANDS.again, action: actions.onAgain },
    { kind: 'command', id: 'levels', label: COMMANDS.levels, action: actions.onLevels },
  );
  return { title: data.passed ? PANELS.cleared : PANELS.failed, home: next ? 'next' : undo ? 'undo' : 'again', rows };
}
