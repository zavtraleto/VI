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
  /** "Time limit". */
  { id: 'limited', face: 2, name: 'LIMITED', native: '時限', line: 'shellLimited', field: ['最高記録', 'bestTimed'] },
  /** "Exercise"; "state". */
  { id: 'exercise', face: 3, name: 'EXERCISE', native: '演習', line: 'shellExercise', field: ['状態', 'exercise'] },
  /** "Tasks"; "completed". */
  { id: 'tasks', face: 4, name: 'TASKS', native: '課題', line: 'shellTasks', field: ['完了', 'tasks'] },
  /** "Records"; "number of entries". */
  { id: 'records', face: 5, name: 'RECORDS', native: '記録', line: 'shellRecords', field: ['件数', 'sessions'] },
  /** "Settings"; "revision". */
  { id: 'system', face: 6, name: 'SYSTEM', native: '設定', line: 'shellSystem', field: ['改訂', 'revision'] },
];

/** A count as the program writes it: with leading zeros. */
export function digits(value: number, places: number): string {
  return String(Math.max(0, Math.round(value))).padStart(places, '0');
}
