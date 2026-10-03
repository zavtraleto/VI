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
export type FileField = 'bestEndless' | 'bestTimed' | 'exercise' | 'tasks' | 'sessions' | 'revision';

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
 * seven: the session without a limit faces the settings of the program, the session with a
 * limit faces its log, the two exercises stand side by side.
 */
export const MENU_FILES: readonly MenuFile[] = [
  /** "Protocol"; "best record". */
  { id: 'protocol', face: 1, name: 'PROTOCOL', native: 'プロトコル', line: 'shellProtocol', field: ['最高記録', 'bestEndless'] },
  /** "Time limit"; "today's record": the session with a limit is the session of the day. */
  { id: 'limited', face: 2, name: 'LIMITED', native: '時限', line: 'shellLimited', field: ['本日記録', 'bestTimed'] },
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

/** What the session shows while it runs: the names of its readings. */
export const HUD = {
  /** "Score". */
  score: '得点',
  /** "Highest". */
  best: '最高',
  level: 'LV',
  /** "Connection": the steps the contact has taken, and the score of the next one. */
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
  /** "Back". */
  back: { native: '戻る', name: 'BACK' },
  /** "To the next". */
  next: { native: '次へ', name: 'NEXT' },
  /** "Start". */
  start: { native: '開始', name: 'START' },
  rules: { native: '規則', name: 'RULES' },
  /** "Registration": the platform gives the player a name. */
  register: { native: '登録', name: 'REGISTER' },
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
  /** "Today": the day a session of the day belongs to. */
  day: { native: '本日', name: 'TODAY' },
} as const satisfies Record<string, PanelName>;

/** The log of sessions: which sessions, which reading, and the heads of its columns. */
export const RECORDS = {
  modes: ['PROTOCOL', 'LIMITED'],
  metrics: ['SCORE', 'CHAIN', 'TIME'],
  /** "Date". */
  date: '日付',
  /** "No entries". */
  empty: '記録なし NO ENTRY',
  /** Whose sessions: those of this device, or those of everyone on the platform. */
  sources: ['LOCAL', 'NETWORK'],
  /** "Name": the head of the column of players. */
  name: '名前',
  /** "Connecting": the table of the platform is on its way. */
  waiting: '接続中 CONNECTING',
  /** "No connection": the table did not come. */
  failed: '接続なし NO LINK',
  /** A player the platform has no name for. */
  nameless: 'NO NAME',
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
