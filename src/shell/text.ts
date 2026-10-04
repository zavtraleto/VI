import type { GoalLine } from '../rules';
import type { TextKey } from '../ui/i18n';

/**
 * Everything the shell says, in one place. The program speaks Japanese and English: its labels
 * are Japanese, its names and values English. One dry line per file is in the language of the
 * player and comes through `t()`.
 *
 * Every kanji used here has to be in the font: run `npm run fonts` after changing the Japanese.
 */

export const LOGO_TEXT = 'VI';
export const REVISION = 'REV 2.06';

/** The check of the first start: what is checked and what it answers. The last line is the link device. */
export const BOOT_CHECK: readonly (readonly [label: string, value: string])[] = [
  ['MEMORY CHECK', '64M'],
  ['VI CORE', '2.06'],
  ['DISPLAY', 'OK'],
  ['AUDIO', 'OK'],
  ['LINK DEVICE', 'NOT FOUND'],
];

/** The heading of the check: "starting up". */
export const BOOT_HEAD = '起動中';
/** The line after the check, and the one line of every later start. */
export const BOOT_TAIL = 'EMULATION MODE AVAILABLE';
export const BOOT_SHORT = 'EMULATION MODE';

/** The record of the one who sits at the program: the seventh, whom it does not know. */
export const SUBJECT = {
  /** "Subject file". */
  title: '被験者ファイル',
  number: 'No.07',
  fields: [
    /** "Subject". */
    ['被験者', '07'],
    /** "Registration". */
    ['登録', 'UNREGISTERED'],
    /** "Connection". */
    ['接続', 'NONE'],
    /** "Previous start", by the era: Heisei 13 is 2001. */
    ['前回起動', 'H13.03.21'],
  ],
} as const;

/** Over the six dice: "Fig. 1, development" — the net of a die. */
export const SPACE_CAPTION = '図1 展開図';

/** "Run". */
export const EXEC_LABEL = '実行';
export const EXEC_NAME = 'EXECUTE';

export const STATUS = {
  channels: 'CH',
  mode: 'EMULATION',
  /** "Sessions". */
  sessions: '回数',
} as const;

/** The keys, on a screen that has them: "move", "run". */
export const LEGEND = '←↑↓→ 移動   ENTER 実行';

/** What a file of the menu shows under its name. */
export type FileField = 'bestEndless' | 'levels' | 'exercise' | 'tasks' | 'sessions' | 'revision';

export interface MenuFile {
  id: string;
  /** The face of the die this file is, 1 to 6. */
  face: number;
  name: string;
  /** The same in the language of the program. */
  native: string;
  /** The one dry line, in the language of the player. */
  line: TextKey;
  /** Label and kind of the value under the name. */
  field: readonly [label: string, kind: FileField];
}

/**
 * The six files of the main menu, one on each face of the die. Opposite faces add up to
 * seven: the session without a limit faces the settings of the program, the levels face the
 * log, the two exercises stand side by side. The levels stand where the session of the day
 * stood: that session is still in the program and in its log, and has no file of its own.
 */
export const MENU_FILES: readonly MenuFile[] = [
  /** "Protocol"; "best record". */
  { id: 'protocol', face: 1, name: 'PROTOCOL', native: 'プロトコル', line: 'shellProtocol', field: ['最高記録', 'bestEndless'] },
  /** "Stages": the levels of the game; "completed". */
  { id: 'levels', face: 2, name: 'LEVELS', native: '段階', line: 'shellLevels', field: ['完了', 'levels'] },
  /** "Exercise"; "state". */
  { id: 'exercise', face: 3, name: 'EXERCISE', native: '演習', line: 'shellExercise', field: ['状態', 'exercise'] },
  /** "Tasks"; "completed". */
  { id: 'tasks', face: 4, name: 'TASKS', native: '課題', line: 'shellTasks', field: ['完了', 'tasks'] },
  /** "Records"; "number of entries". */
  { id: 'records', face: 5, name: 'RECORDS', native: '記録', line: 'shellRecords', field: ['件数', 'sessions'] },
  /** "Settings"; "revision". */
  { id: 'system', face: 6, name: 'SYSTEM', native: '設定', line: 'shellSystem', field: ['改訂', 'revision'] },
];

/** A date given as YYYY-MM-DD, as the program writes it: by the era, where Heisei 38 is 2026. */
export function eraDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `H${String(year - 1988).padStart(2, '0')}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
}

/** A count as the program writes it: with leading zeros. */
export function digits(value: number, places: number): string {
  return String(Math.max(0, Math.round(value))).padStart(places, '0');
}

/**
 * The dry line of a file as its record shows it. The session with a limit says how long it
 * lasts where its words have `{time}`: the length is the rules', not the words'.
 */
export function fileLine(words: string, limitSec: number): string {
  return words.replace('{time}', `${digits(Math.floor(limitSec / 60), 2)}:${digits(limitSec % 60, 2)}`);
}

/** What the session shows while it runs: the names of its readings. */
export const HUD = {
  /** "Score". */
  score: '得点',
  /** "Highest". */
  best: '最高',
  level: 'LV',
  /** "Connection": the steps the contact has taken, and the dice sent at which the next one comes. */
  link: '接続',
  /** "Detected": what the link reads once the program has found a pattern on it. */
  found: '検出',
  /** A session that is not counted: the exercise. */
  practice: 'TEST',
  /** "Full": every cell holds a die, and the seconds left to free one. */
  full: '満杯',
  /** "Moves", "task", "target": the readings of a task. */
  moves: '手数',
  task: '課題',
  target: '目標',
  /** "Calibration": a part of the exercise sets one channel of the device, and says which. */
  exercise: '較正',
  channel: 'CH',
  /** "Next": the words have been read. */
  next: '次へ',
  /** "Take back", "again", "skip": what can be pressed over the board. */
  undo: '取消',
  retry: '再試',
  skip: '省略 SKIP',
} as const;

/** What a line of the goal of a level goes under, where it is written and not drawn. */
export const GOAL = { dice: 'SEND', face: 'FACE', links: 'CHAIN', cleared: 'LEFT', clear: 'CLEAR' } as const;

/** Links of a chain are few: their count takes one place while it fits; a count of dice takes two. */
const goalPlaces = (line: GoalLine): number => (line.what === 'links' && line.need < 10 ? 1 : 2);

/** The name of a line of a goal: what it counts. A face is named with its number. */
export function goalLabel(line: GoalLine): string {
  return line.what === 'face' ? `${GOAL.face} ${line.value}` : GOAL[line.what];
}

/** How far a line of a goal has come: `03/04`; of a board to clear, the dice that still stand. */
export function goalProgress(line: GoalLine): string {
  if (line.what === 'cleared') return digits(line.need - line.have, 2);
  return `${digits(line.have, goalPlaces(line))}/${digits(line.need, goalPlaces(line))}`;
}

/** A goal as it is asked for, with nothing counted yet: `FACE 2 ×04 · FACE 3 ×06`. */
export function goalText(lines: readonly GoalLine[]): string {
  return lines
    .map((line) => {
      if (line.what === 'cleared') return `${GOAL.clear} ${digits(line.need, 2)}`;
      if (line.what === 'face') return `${GOAL.face} ${line.value} ×${digits(line.need, 2)}`;
      return `${GOAL[line.what]} ${digits(line.need, goalPlaces(line))}`;
    })
    .join(' · ');
}

/** A panel of the program: its name in its own language and in English. */
export interface PanelName {
  native: string;
  name: string;
}

export const PANELS = {
  /** "Pause". */
  pause: { native: '一時停止', name: 'PAUSE' },
  /** "Result". */
  result: { native: '結果', name: 'RESULT' },
  /** "Time is out". */
  timeUp: { native: '時間切れ', name: 'TIME UP' },
  /** "Records". */
  records: { native: '記録', name: 'RECORDS' },
  /** "Settings". */
  system: { native: '設定', name: 'SYSTEM' },
  /** "Rules". */
  rules: { native: '規則', name: 'RULES' },
  /** "Tasks". */
  tasks: { native: '課題', name: 'TASKS' },
  /** "Completed". */
  cleared: { native: '完了', name: 'CLEARED' },
  /** "Stages": the levels of the game. */
  levels: { native: '段階', name: 'LEVELS' },
  /** "Failure": a level has come to a dead end, or its moves are spent with its goal not met. */
  failed: { native: '失敗', name: 'FAILED' },
  /** "New record": what a result is named once the session has taken its place above the best there was. */
  record: { native: '新記録', name: 'NEW RECORD' },
} as const satisfies Record<string, PanelName>;

/** What a panel can be told to do. */
export const COMMANDS = {
  /** "Resume". */
  resume: { native: '再開', name: 'RESUME' },
  /** "Try again". */
  restart: { native: '再試行', name: 'RESTART' },
  again: { native: '再試行', name: 'AGAIN' },
  records: { native: '記録', name: 'RECORDS' },
  system: { native: '設定', name: 'SYSTEM' },
  /** "End". */
  menu: { native: '終了', name: 'MENU' },
  tasks: { native: '課題', name: 'TASKS' },
  levels: { native: '段階', name: 'LEVELS' },
  /** "Back". */
  back: { native: '戻る', name: 'BACK' },
  /** "To the next". */
  next: { native: '次へ', name: 'NEXT' },
  /** "Start". */
  start: { native: '開始', name: 'START' },
  /** "Take back": the last move of a level, from its result. */
  undo: { native: '取消', name: 'UNDO' },
  rules: { native: '規則', name: 'RULES' },
  /** "Registration": the platform gives the player a name. */
  register: { native: '登録', name: 'REGISTER' },
  /** "Sharing": the player's result goes out with a link to the game. What it answers: "copied", "sent", "failure". */
  share: { native: '共有', name: 'SHARE' },
  copied: { native: '複写済', name: 'COPIED' },
  sent: { native: '送信済', name: 'SENT' },
  failed: { native: '失敗', name: 'FAILED' },
} as const satisfies Record<string, PanelName>;

/** The readings of a result. */
export const RESULT = {
  score: { native: '得点', name: 'SCORE' },
  best: { native: '最高', name: 'BEST' },
  /** "Chain". */
  chain: { native: '連鎖', name: 'MAX CHAIN' },
  /** "Time". */
  time: { native: '時間', name: 'TIME' },
  moves: { native: '手数', name: 'MOVES' },
  /** "Fewest". */
  least: { native: '最少', name: 'FEWEST' },
  /** "Remaining": the moves a passed level had left. */
  left: { native: '残り', name: 'MOVES LEFT' },
  /** "Today": the day a session of the day belongs to. */
  day: { native: '本日', name: 'TODAY' },
  /** "Rank": the place the session took in the log. */
  rank: { native: '順位', name: 'RANK' },
} as const satisfies Record<string, PanelName>;

/** The answers to the question a passed level asks: "yes" and "no". */
export const ANSWERS = { yes: 'はい YES', no: 'いいえ NO' } as const;

/** The log of sessions: which sessions, and the heads of its columns. */
export const RECORDS = {
  modes: ['PROTOCOL', 'LIMITED'],
  /** "No entries". */
  empty: '記録なし NO ENTRY',
  /** "Name": the head of the column of whose session a line is. */
  name: '名前',
  /** "Connecting": the players of the platform are on their way. */
  waiting: '接続中',
  /** "No connection": they did not come. */
  failed: '接続なし',
  /** A player the platform has no name for. */
  nameless: 'NO NAME',
  /**
   * "Subject": a record of one of the six in the program's own archive is written with its
   * number, and so is the line of the one who plays where no platform has a name for them.
   */
  subject: '被験者',
  /** The number of the one who plays: the seventh. */
  seventh: '07',
} as const;

/** What the program lets the player set, and the values it shows. */
export const SYSTEM = {
  /** "Sound". */
  sound: { native: '音声', name: 'SOUND' },
  /** "Motion". */
  motion: { native: '動作', name: 'MOTION' },
  /** "Shake". */
  shake: { native: '振動', name: 'SHAKE' },
  /** "Operation": swipes or buttons. */
  control: { native: '操作', name: 'CONTROL' },
  /** "Camera": follows the player where the whole board would be small, or stays on the whole board. */
  view: { native: 'カメラ', name: 'CAMERA' },
  on: 'ON',
  off: 'OFF',
  full: 'FULL',
  reduced: 'LESS',
  swipe: 'SWIPE',
  buttons: 'BUTTONS',
  auto: 'AUTO',
  fixed: 'FIXED',
} as const;
