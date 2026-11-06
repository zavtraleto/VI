import type { ControlSetting } from '../platform/settings';
import type { GoalLine } from '../rules';
import { word, type LanguageCode } from '../ui/i18n';
import type { Climb } from './climb';
import { CELL_W, textWidth } from './layout';
import type { PanelCommand, PanelRow, PanelSpec, TableLine } from './screens/panel';
import { README_SAY_SIZE } from './theme';
import { CALL, COMMANDS, EXEC, LANGUAGE_NAMES, PANELS, RECORDS, RESULT, SYSTEM, digits, goalLabel, goalProgress, type PanelName } from './text';

/** A time in ticks as minutes and seconds. */
function clock(ticks: number, tickMs: number): string {
  const seconds = Math.floor((ticks * tickMs) / 1000);
  return `${digits(Math.floor(seconds / 60), 2)}:${digits(seconds % 60, 2)}`;
}

/**
 * The session waits: it goes on, starts over, or is left for the menu. On a board the player has
 * been stuck on, the way of the board may stand after starting over, for an advertisement (`onWay`,
 * given only then). The list of the levels opens from a board of the row (`onLevels`, given only
 * there: the owner, 5 November 2026), and the settings (`onSystem`); both come back to this window.
 */
export function pausePanel(actions: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onWay?: () => void;
  onLevels?: () => void;
  onSystem?: () => void;
}): PanelSpec {
  const rows: PanelRow[] = [
    { kind: 'command', id: 'resume', label: COMMANDS.resume, action: actions.onResume },
    { kind: 'command', id: 'restart', label: COMMANDS.restart, action: actions.onRestart },
  ];
  if (actions.onWay) rows.push({ kind: 'command', id: 'way', label: COMMANDS.showWay, action: actions.onWay });
  if (actions.onLevels) rows.push({ kind: 'command', id: 'levels', label: COMMANDS.levels, action: actions.onLevels });
  if (actions.onSystem) rows.push({ kind: 'command', id: 'system', label: COMMANDS.system, action: actions.onSystem });
  rows.push({ kind: 'command', id: 'menu', label: COMMANDS.menu, action: actions.onMenu });
  return { title: PANELS.pause, home: 'resume', back: actions.onResume, rows };
}

/** What the player can set. */
export interface SystemValues {
  muted: boolean;
  reducedMotion: boolean;
  control: ControlSetting;
  language: LanguageCode;
}

export function systemPanel(actions: {
  values: () => SystemValues;
  onToggle: (key: Exclude<keyof SystemValues, 'language'>) => void;
  /** The screen is touched, not pointed at with a mouse: the ways to play are named swipes and taps, and not keys and the mouse. */
  touch?: boolean;
  /** The languages are many: the line opens their list. */
  onLanguage: () => void;
  /** Commands of the development tools; a production build passes none. */
  tools?: readonly PanelCommand[];
  /** The line the panel opens on; the first one when left out. */
  home?: string;
  onBack: () => void;
}): PanelSpec {
  const { values } = actions;
  const [byDirection, byAim] = actions.touch ? [SYSTEM.swipe, SYSTEM.tap] : [SYSTEM.keys, SYSTEM.mouse];
  return {
    title: PANELS.system,
    home: actions.home ?? 'sound',
    back: actions.onBack,
    rows: [
      { kind: 'switch', id: 'sound', label: SYSTEM.sound, value: () => word(values().muted ? SYSTEM.off : SYSTEM.on), action: () => actions.onToggle('muted') },
      {
        kind: 'switch',
        id: 'effects',
        label: SYSTEM.effects,
        value: () => word(values().reducedMotion ? SYSTEM.calm : SYSTEM.all),
        action: () => actions.onToggle('reducedMotion'),
      },
      { kind: 'switch', id: 'control', label: SYSTEM.control, value: () => word(values().control === 'tap' ? byAim : byDirection), action: () => actions.onToggle('control') },
      { kind: 'switch', id: 'language', label: SYSTEM.language, value: () => LANGUAGE_NAMES[values().language].name, action: actions.onLanguage },
      { kind: 'gap' },
      { kind: 'commands', commands: [...(actions.tools ?? []), { id: 'back', label: COMMANDS.back, action: actions.onBack }] },
    ],
  };
}

/** The languages the voice speaks, each under its own name; the panel opens on the one that is set. */
export function languagePanel(actions: { languages: readonly LanguageCode[]; current: LanguageCode; onPick: (language: LanguageCode) => void; onBack: () => void }): PanelSpec {
  return {
    title: PANELS.language,
    home: `language-${actions.current}`,
    back: actions.onBack,
    rows: [
      ...actions.languages.map((code) => ({ kind: 'command' as const, id: `language-${code}`, label: LANGUAGE_NAMES[code], action: () => actions.onPick(code) })),
      { kind: 'gap' },
      { kind: 'command', id: 'back', label: COMMANDS.back, action: actions.onBack },
    ],
  };
}

export interface ResultData {
  score: number;
  best: number;
  /** The best there was before this session: what the result shows until the session has taken its place. */
  before?: number;
  maxChain: number;
  ticks: number;
  tickMs: number;
  /** What there is to say about the record, in the language of the player. */
  note: string | null;
}

/** Rows of the log a result shows around the session on its way up. */
const CLIMB_LINES = 7;

/** The score of a session and its place, and the lines of the log it goes past on its way up. */
function climbRows(climb: Climb): PanelRow[] {
  return [
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
    {
      kind: 'climb',
      rows: (count, shift) => climb.rows(count, shift).map((line) => line && { ...line, name: fitName(line.name) }),
      lines: CLIMB_LINES,
      // Once the place is taken, the log around it can be scrolled.
      range: (count) => climb.shiftRange(count),
    },
  ];
}

/**
 * What a session came to. With `climb`, the session goes up the log of its kind under the eyes
 * of the player: its score is counted up and its place beside it, lines of the log go by, and
 * what there is to say about a record is said once the place is taken.
 */
export function resultPanel(data: ResultData, actions: { onAgain: () => void; onRecords: () => void; onMenu: () => void }, climb?: Climb): PanelSpec {
  const name = PANELS.result;
  const settled = (): boolean => climb?.done ?? true;
  const rows: PanelRow[] = [];
  if (climb) {
    rows.push(...climbRows(climb));
  } else {
    rows.push({ kind: 'number', label: RESULT.score, value: data.score, places: 6 });
  }
  rows.push(
    { kind: 'field', label: RESULT.best, value: () => digits(settled() ? data.best : (data.before ?? data.best), 6) },
    { kind: 'field', label: RESULT.chain, value: `×${digits(data.maxChain, 2)}` },
    { kind: 'field', label: RESULT.time, value: clock(data.ticks, data.tickMs) },
  );
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

/**
 * The result of a call (docs/superpowers/specs/2026-11-05-vi-live-calls-design.md, section 7.3): its
 * score, the best of its step, the longest chain. With `climb`, the score goes up the log of that
 * step as a session of Endless goes up its own (the owner, 28 October 2026). Again, on (from the row,
 * to the board after; from the list of calls, back to it), the score doubled for an advertisement
 * where there is one, or the menu. A call the board filled says over its score that the line was lost.
 */
export function callResultPanel(
  data: { score: number; best: number; maxChain: number; doubled?: boolean; before?: number; lost?: boolean; fromList?: boolean },
  actions: { onAgain: () => void; onNext: () => void; onMenu: () => void; onDouble?: () => void },
  climb?: Climb,
): PanelSpec {
  // The score doubled for an advertisement is shown doubled; the call itself is as it ended.
  const score = data.doubled ? data.score * 2 : data.score;
  const settled = (): boolean => climb?.done ?? true;
  const rows: PanelRow[] = [];
  if (data.lost) rows.push({ kind: 'field', label: CALL.lineLost, value: '' });
  if (climb) rows.push(...climbRows(climb));
  else rows.push({ kind: 'number', label: RESULT.score, value: score, places: 6 });
  rows.push(
    { kind: 'field', label: RESULT.best, value: () => digits(settled() ? data.best : (data.before ?? data.best), 6) },
    { kind: 'field', label: RESULT.chain, value: `×${digits(data.maxChain, 2)}` },
    { kind: 'gap' },
    {
      kind: 'commands',
      stacked: true,
      commands: [
        { id: 'again', label: COMMANDS.again, action: actions.onAgain },
        { id: 'next', label: data.fromList ? COMMANDS.back : COMMANDS.next, action: actions.onNext },
        // Where the platform has an advertisement to watch for it, and the score has not been doubled yet.
        ...(actions.onDouble ? [{ id: 'double', label: COMMANDS.double, action: actions.onDouble }] : []),
        { id: 'menu', label: COMMANDS.menu, action: actions.onMenu },
      ],
    },
  );
  if (!climb) return { title: PANELS.result, home: 'next', rows };
  return {
    title: () => (climb.done && climb.record ? PANELS.record : PANELS.result),
    flash: () => climb.record && climb.lit,
    live: (timeMs) => climb.update(timeMs),
    home: 'next',
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

/** The log of the session. */
export interface RecordsTable {
  lines: readonly RecordLine[];
  /** How the asking for the players of the platform stands, while they are not in the log. */
  link?: 'waiting' | 'failed' | null;
}

export interface RecordsActions {
  onBack: () => void;
  /** The player is a guest the platform can give a name to. */
  onRegister?: () => void;
  /**
   * Sends out what the player has in the log in sight, with a link to the game. `label` is what
   * the command reads: its name, or what came of the last sending.
   */
  share?: { label: () => PanelName; action: () => void };
}

/** Widest a name gets in the table, in places of the font. */
const NAME_PLACES = 16;

/** A name of a player, cut to the room the table has for it. */
function fitName(name: string): string {
  let fitted = '';
  for (const sign of name.replace(/\s+/g, ' ').trim()) {
    if (textWidth(fitted + sign) > CELL_W * NAME_PLACES) break;
    fitted += sign;
  }
  return fitted.trim() || word(RECORDS.nameless);
}

/**
 * The log of sessions: what the program had in it before the player, the players a platform
 * knows, and the one who plays, by score.
 */
export function recordsPanel(table: () => RecordsTable, actions: RecordsActions): PanelSpec {
  const rows: PanelRow[] = [
    {
      kind: 'table',
      head: () => word(RECORDS.name),
      status: () => {
        const link = table().link;
        return link === 'waiting' ? word(RECORDS.waiting) : link === 'failed' ? word(RECORDS.failed) : '';
      },
      empty: () => `${RECORDS.empty.native} ${word(RECORDS.empty.name)}`,
      lines: 12,
      rows: (): readonly TableLine[] => table().lines.map((line) => [fitName(line.name), digits(line.score, 6), line.own, line.rank] as const),
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
    rows.push({ kind: 'command', id: 'share', label, action: () => share.action(), instant: true });
  }
  return { title: RECORDS.title, home: 'back', back: actions.onBack, rows };
}

/** A cell of the list of the levels: a board. */
export type LevelsEntry = { passed: boolean; goal: readonly GoalLine[]; faces?: readonly number[]; stars?: number };

/**
 * Every board of the campaign in one list, the pieces of the road first: a cell to a board,
 * numbered from one, with the stars of the ones passed, out of three: those of its best pass,
 * and one where `stars` is not said; nothing is written under them (the owner, 30 October 2026).
 * Every cell is open. Only boards stand in it: the calls are a layer of their own (the owner,
 * 5 November 2026). `current` is the index of the board in focus. Opened from the pause of a
 * board (`onReturn`), the list leads back to that board, the number of its place given, beside
 * the menu; back, as Esc and the system's "back", leads to the board too.
 */
export function levelsPanel(
  levels: readonly LevelsEntry[],
  current: number,
  actions: { onPick: (index: number) => void; onBack: () => void; onReturn?: { number: number; action: () => void } },
): PanelSpec {
  const menu: PanelCommand = { id: 'back', label: COMMANDS.menu, action: actions.onBack };
  const { onReturn } = actions;
  const commands: PanelCommand[] = onReturn
    ? [{ id: 'return', label: { native: COMMANDS.toLevel.native, name: `← ${word(COMMANDS.toLevel.name)} ${digits(onReturn.number, 2)}` }, action: onReturn.action }, menu]
    : [menu];
  return {
    title: PANELS.levels,
    // On the whole screen (the owner, 4 November 2026: «полноэкранный визуально понятный список»).
    full: true,
    home: `level-${current}`,
    back: onReturn ? onReturn.action : actions.onBack,
    rows: [
      {
        kind: 'levels',
        id: 'level',
        levels: levels.map((level) => ({ stars: level.stars ?? (level.passed ? 1 : 0) })),
        marks: 3,
        current,
        pick: (index) => {
          if (index >= 0 && index < levels.length) actions.onPick(index);
        },
      },
      // Two commands side by side where they fit, one over the other where they do not: the board first.
      { kind: 'commands', commands },
    ],
  };
}

/** Signs of the window a level opens with come one in so many milliseconds: printed, at a pace a click to a sign can be heard at. */
const INTRO_SIGN_MS = 30;

/**
 * The window a level that brings a rule opens with: what is said of the rule, in the language of
 * the player and in large letters, a message at a time, as a game speaks. A message is typed out
 * sign by sign; with `still`, all of it is there at once. A press while the words are coming
 * brings the rest of them; the next press clears the window for the message that follows, and
 * after the last one starts the level. The window keeps the room of its longest message.
 * `onSign` is told of every sign that comes by itself, by its place in the message: it is what
 * the printing is heard by. Signs brought at once by a press, or all there from the start, are
 * not told of.
 */
export function levelIntroPanel(
  data: { number: number; pages: readonly string[]; page: number; still?: boolean },
  actions: { onPage: (page: number) => void; onStart: () => void; onBack: () => void; onSign?: (index: number) => void },
): PanelSpec {
  const last = Math.max(0, data.pages.length - 1);
  const at = Math.min(Math.max(0, data.page), last);
  const text = data.pages[at] ?? '';
  const total = text.length;
  let began = -1;
  /** Signs that are there, as the window was last asked; and whether a press has called for the rest. */
  let there = 0;
  let hurried = false;
  const onward = (then: () => void) => (): void => {
    if (there < total) hurried = true;
    else then();
  };
  const go = at < last ? { id: 'next', label: COMMANDS.next, action: onward(() => actions.onPage(at + 1)) } : { id: 'start', label: COMMANDS.start, action: onward(actions.onStart) };
  return {
    title: { native: PANELS.levels.native, name: `LEVEL ${digits(data.number, 2)}` },
    home: go.id,
    back: actions.onBack,
    rows: [
      { kind: 'say', text, after: 0, large: true, room: data.pages },
      { kind: 'gap' },
      { kind: 'command', ...go },
      { kind: 'command', id: 'back', label: COMMANDS.back, action: actions.onBack },
    ],
    // The count starts on the frame the window is first there.
    typed: (timeMs) => {
      if (began < 0) began = timeMs;
      if (data.still || hurried) {
        there = total;
        return there;
      }
      const now = Math.min(total, Math.floor((timeMs - began) / INTRO_SIGN_MS));
      if (now > there) actions.onSign?.(now - 1);
      there = now;
      return there;
    },
  };
}

/** Rules of the levels shown in one window: each is a line or two of its own, and the window of a phone holds no more of them and its commands. */
export const LEVEL_RULES_PAGE = 3;

/**
 * The rules of the levels up to the one that waits, to read again: numbered through, a few to a
 * window, the window saying which one of how many it is. `NEXT` leads to the rules that follow
 * and, past the last of them, back to the first. Rules that fit one window have no way on.
 * `name` is what the windows go under where they are not the rules of a level: the file of
 * the menu that says how the game is played.
 */
export function levelRulesPanel(
  lines: readonly string[],
  page: number,
  actions: { onPage: (page: number) => void; onBack: () => void },
  name: PanelName = PANELS.rules,
): PanelSpec {
  const pages = Math.max(1, Math.ceil(lines.length / LEVEL_RULES_PAGE));
  const at = Math.min(Math.max(0, page), pages - 1);
  const first = at * LEVEL_RULES_PAGE;
  const rows: PanelRow[] = lines.slice(first, first + LEVEL_RULES_PAGE).map((text, i) => ({ kind: 'say', text: `${first + i + 1}. ${text}`, large: true }));
  rows.push({ kind: 'gap' });
  if (pages > 1) rows.push({ kind: 'command', id: 'next', label: COMMANDS.next, action: () => actions.onPage((at + 1) % pages) });
  rows.push({ kind: 'command', id: 'back', label: COMMANDS.back, action: actions.onBack });
  return {
    title: pages > 1 ? { native: name.native, name: `${word(name.name)} ${at + 1}/${pages}` } : name,
    home: pages > 1 ? 'next' : 'back',
    back: actions.onBack,
    rows,
  };
}

/**
 * The note that came with the program, in the language of the player: a page to a window, a
 * paragraph to a line of the panel, the window saying which page of how many it is. `BACK`
 * returns to the preceding page (or the menu from the first); the last page has `EXIT` in place
 * of `NEXT`.
 */
export function readmePanel(
  pages: readonly (readonly string[])[],
  page: number,
  actions: { onPage: (page: number) => void; onBack: () => void },
): PanelSpec {
  const at = Math.min(Math.max(0, page), pages.length - 1);
  const rows: PanelRow[] = (pages[at] ?? []).map((text) => ({ kind: 'say', text, size: README_SAY_SIZE }));
  const goBack = at > 0 ? () => actions.onPage(at - 1) : actions.onBack;
  const back: PanelCommand = { id: 'back', label: COMMANDS.back, action: goBack };
  const forward: PanelCommand = at === pages.length - 1
    ? { id: 'exit', label: COMMANDS.exit, action: actions.onBack }
    : { id: 'next', label: COMMANDS.next, action: () => actions.onPage(at + 1) };
  // Side by side where the picture is wide: a low screen has no room for one under the other.
  rows.push({ kind: 'gap' }, { kind: 'commands', stacked: true, commands: [back, forward] });
  return {
    title: { native: PANELS.readme.native, name: `${word(PANELS.readme.name)} ${at + 1}/${pages.length}` },
    home: forward.id,
    back: goBack,
    rows,
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
  if (data.reason) rows.push({ kind: 'say', text: data.reason, large: true });
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
  if (undo) rows.push({ kind: 'command', id: 'undo', label: { native: COMMANDS.undo.native, name: `${word(COMMANDS.undo.name)} ${data.undos}` }, action: onUndo });
  rows.push(
    { kind: 'command', id: 'again', label: COMMANDS.again, action: actions.onAgain },
    { kind: 'command', id: 'levels', label: COMMANDS.levels, action: actions.onLevels },
  );
  return { title: data.passed ? PANELS.cleared : PANELS.failed, home: next ? 'next' : undo ? 'undo' : 'again', rows };
}

/** What the window between two boards shows of the board that is passed. */
export interface ClearedData {
  moves: number;
  /** The fewest moves the board is cleared in; null where they are not known, and then it has no stars. */
  par: number | null;
  /** Stars of the pass, out of three; null where the board is not rated. */
  stars: number | null;
  /** Motion kept low: the stars stand at once. */
  still: boolean;
  /** How many stars are left to the next record of the link, a line under the stars; none after the last record. */
  starLine?: string;
}

/**
 * The small window between two boards (word of the owner, 29 October 2026): over the board that
 * is passed, the stars of the pass light up one after another, under them the moves made and the
 * fewest; then the large command that goes on to the next board, in focus, and under it the
 * command that starts this one over, of the size of a line of the menu.
 */
export function clearedPanel(data: ClearedData, actions: { onNext: () => void; onAgain: () => void; onStar?: (index: number) => void; onAllStars?: () => void }): PanelSpec {
  const rows: PanelRow[] = [];
  if (data.stars !== null) rows.push({ kind: 'stars', count: data.stars, shine: { still: data.still, onLit: actions.onStar, onAll: actions.onAllStars } });
  if (data.starLine !== undefined) rows.push({ kind: 'field', label: RESULT.toRecord, value: data.starLine });
  rows.push(
    { kind: 'field', label: RESULT.moves, value: digits(data.moves, 3) },
    { kind: 'field', label: RESULT.par, value: data.par === null ? '---' : digits(data.par, 3) },
    // Twice the gap between the lines, not three times: the readings belong to the stars over them.
    { kind: 'gap', h: 0 },
    { kind: 'command', id: 'next', label: COMMANDS.next, action: actions.onNext, large: true },
    { kind: 'command', id: 'again', label: COMMANDS.again, action: actions.onAgain },
  );
  return { title: PANELS.cleared, home: 'next', back: actions.onNext, rows };
}

/**
 * What the file `STORY` of the menu opens (the owner, 6 November 2026: «сделай просто ячейки (как на
 * списке уровней), которые поначалу закрыты и постепенно открываются»): the records of the link as
 * the cells of the list of the levels, numbered from one, and no words. A record the sum of the
 * stars has not come to is closed: faint, and not pressed. `current` is the cell in focus, the last
 * open one; -1 where none is open.
 */
export function storyPanel(records: readonly { open: boolean }[], current: number, actions: { onRecord: (number: number) => void; onBack: () => void }): PanelSpec {
  return {
    title: PANELS.story,
    full: true,
    home: current >= 0 ? `record-${current}` : 'back',
    back: actions.onBack,
    rows: [
      {
        kind: 'levels',
        id: 'record',
        levels: records.map((record) => ({ stars: 0, closed: !record.open })),
        current,
        pick: (index) => {
          if (records[index]?.open) actions.onRecord(index + 1);
        },
      },
      { kind: 'commands', commands: [{ id: 'back', label: COMMANDS.menu, action: actions.onBack }] },
    ],
  };
}

/** A line of the screen of `ENDLESS`: a call that has come, by its step and its best. */
export interface CallsEntry {
  step: number;
  best: number;
}

/**
 * What the file `ENDLESS` of the menu opens once a call has come (docs/superpowers/specs/2026-11-05-vi-live-calls-design.md,
 * section 7.4): free Endless first, then the calls that have come, each to be played again with no
 * screen of the call before it. A call that has not come is not shown: what comes next, the game does
 * not say. The talks heard are gone with the talks (5 November 2026). Modelled on `storyPanel`.
 */
export function callsPanel(
  entries: readonly CallsEntry[],
  actions: { onPlay: () => void; onCall: (step: number) => void; onBack: () => void },
  home = 'play',
): PanelSpec {
  const rows: PanelRow[] = [{ kind: 'command', id: 'play', label: { native: EXEC.play.native, name: EXEC.play.name }, action: actions.onPlay }];
  if (entries.length > 0) rows.push({ kind: 'gap' });
  for (const entry of entries) {
    rows.push({ kind: 'command', id: `call-${entry.step}`, label: { native: CALL.calls.native, name: `${digits(entry.step, 2)} · ${digits(entry.best, 6)}` }, action: () => actions.onCall(entry.step) });
  }
  rows.push({ kind: 'gap' }, { kind: 'command', id: 'back', label: COMMANDS.back, action: actions.onBack });
  return { title: PANELS.endless, home, back: actions.onBack, rows };
}
