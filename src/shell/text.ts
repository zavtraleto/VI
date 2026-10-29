import type { GoalLine } from '../rules';
import type { LanguageCode, TextKey } from '../ui/i18n';

/**
 * Everything the shell says, in one place. The program speaks Japanese and English: its labels
 * are Japanese, its names and values English. One dry line per file is in the language of the
 * player and comes through `t()`.
 *
 * Every kanji used here has to be in the font: run `npm run fonts` after changing the Japanese.
 */

export const LOGO_TEXT = 'VIZAVI';
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
export const BOOT_HEAD = 'きどうちゅう';
/** The line after the check, and the one line of every later start. */
export const BOOT_TAIL = 'EMULATION MODE AVAILABLE';
export const BOOT_SHORT = 'EMULATION MODE';

/** The record of the one who sits at the program: the seventh, whom it does not know. */
export const SUBJECT = {
  /** "Subject file". */
  title: 'ひけんしゃファイル',
  number: 'No.07',
  fields: [
    /** "Subject". */
    ['ひけんしゃ', '07'],
    /** "Registration". */
    ['とうろく', 'UNREGISTERED'],
    /** "Connection". */
    ['せつぞく', 'NONE'],
    /** "Previous start", by the era: Heisei 13 is 2001. */
    ['ぜんかいきどう', 'H13.03.21'],
  ],
} as const;

/** Over the six dice: "Fig. 1, development" — the net of a die. */
export const SPACE_CAPTION = 'ず1 てんかいず';

/**
 * What the bar of a file of the menu says it does (the owner, 28 October 2026: «"выполнить" это
 * играть, тоже наверное старт нужно писать»): a file that is played is started, one that is read
 * is read, any other is opened.
 */
export const EXEC = {
  play: { native: 'はじめる', name: 'PLAY' },
  read: { native: 'よむ', name: 'READ' },
  open: { native: 'ひらく', name: 'OPEN' },
} as const;

export const STATUS = {
  channels: 'CH',
  mode: 'EMULATION',
  /** "Sessions". */
  sessions: 'かいすう',
} as const;

/** The keys, on a screen that has them: "move", "decide". */
export const LEGEND = '←↑↓→ いどう   ENTER けってい';

/** What a file of the menu shows under its name. */
export type FileField = 'bestEndless' | 'levels' | 'rules' | 'readme' | 'sessions' | 'revision';

export interface MenuFile {
  id: string;
  /** The face of the die this file is, 1 to 6. */
  face: number;
  name: string;
  /** The same in the language of the program. */
  native: string;
  /** The one dry line, in the language of the player. */
  line: TextKey;
  /** What the bar of its record says it does. */
  exec: (typeof EXEC)[keyof typeof EXEC];
  /** Label and kind of the value under the name. */
  field: readonly [label: string, kind: FileField];
}

/**
 * The six files of the main menu, one on each face of the die. The levels are the one, the
 * middle of the net, where the figure waits. Opposite faces add up to seven: the levels face
 * the settings of the program, the session without a limit faces the log, and what is read -
 * how the game is played, and the note that came with the program - stands on either side.
 * The exercise and the tasks had the three and the four until 6 October 2026; both are gone
 * from the program since 15 October 2026.
 */
export const MENU_FILES: readonly MenuFile[] = [
  /** "Level": the levels of the game; "clear". */
  { id: 'levels', face: 1, name: 'LEVELS', native: 'レベル', line: 'shellLevels', exec: EXEC.play, field: ['クリア', 'levels'] },
  /** "Protocol"; "high score". */
  { id: 'protocol', face: 2, name: 'PROTOCOL', native: 'プロトコル', line: 'shellProtocol', exec: EXEC.play, field: ['ハイスコア', 'bestEndless'] },
  /** "Explanation": how the game is played, on the pieces of the road; "rules". */
  { id: 'howto', face: 3, name: 'HOW TO PLAY', native: 'せつめい', line: 'shellHowTo', exec: EXEC.read, field: ['ルール', 'rules'] },
  /** "To begin with": the note that came with the program; "last": the day it was last written to. */
  { id: 'readme', face: 4, name: 'README', native: 'はじめに', line: 'shellReadme', exec: EXEC.read, field: ['さいしゅう', 'readme'] },
  /** "Records"; "number of entries". */
  { id: 'records', face: 5, name: 'RECORDS', native: 'きろく', line: 'shellRecords', exec: EXEC.open, field: ['けんすう', 'sessions'] },
  /** "Settings"; "revision". */
  { id: 'system', face: 6, name: 'SYSTEM', native: 'せってい', line: 'shellSystem', exec: EXEC.open, field: ['かいてい', 'revision'] },
];

/** The day the note that came with the program was last written to, by the era: the day before the last start. */
export const README_DATE = 'H13.03.20';

/** The arrows that turn the record of the menu to the file before and the file after. */
export const PAGER = { prev: '←', next: '→' } as const;

/** A count as the program writes it: with leading zeros. */
export function digits(value: number, places: number): string {
  return String(Math.max(0, Math.round(value))).padStart(places, '0');
}

/** What a live session of the row is called in the list of the levels, where a board has its number. */
export const LIVE_WORD = 'LIVE';
/** What the list of the levels writes under the cell of a live session, as it writes the goal of a board. */
export const LIVE_SESSION = 'LIVE SESSION';

/** A score in four signs at most, where a cell has no more room: 2471, 24K, 710K, 1M. */
export function shortScore(score: number): string {
  const value = Math.max(0, Math.round(score));
  if (value < 10_000) return String(value);
  if (value < 1_000_000) return `${Math.floor(value / 1000)}K`;
  return `${Math.floor(value / 1_000_000)}M`;
}

/** What the session shows while it runs: the names of its readings. */
export const HUD = {
  /** "Score". */
  score: 'スコア',
  /** "Best". */
  best: 'ベスト',
  level: 'LV',
  /** "Connection": the steps the contact has taken, and the dice sent at which the next one comes. */
  link: 'せつぞく',
  /** "Detected": what the link reads once the program has found a pattern on it. */
  found: 'けんしゅつ',
  /** "Full": every cell holds a die, and the seconds left to free one. */
  full: 'まんぱい',
  /** "Take back", "again": what can be pressed over the board. */
  undo: 'とりけし',
  retry: 'やりなおし',
} as const;

/**
 * The three lines of a level in the top left corner: its number, the moves of this try, and the
 * fewest the board is known to be cleared in (the owner, 28 October 2026: BEST → PAR; 29 October
 * 2026: LEVEL, CURRENT, PAR one under the other). Words of the program, not translated.
 */
export const READS = { level: 'LEVEL', current: 'CURRENT', best: 'PAR' } as const;

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
  pause: { native: 'ポーズ', name: 'PAUSE' },
  /** "Result". */
  result: { native: 'けっか', name: 'RESULT' },
  /** "Records". */
  records: { native: 'きろく', name: 'RECORDS' },
  /** "Settings". */
  system: { native: 'せってい', name: 'SYSTEM' },
  /** "Rules". */
  rules: { native: 'ルール', name: 'RULES' },
  /** "Explanation": how the game is played. */
  howto: { native: 'せつめい', name: 'HOW TO PLAY' },
  /** "To begin with": the note that came with the program. */
  readme: { native: 'はじめに', name: 'README' },
  /** "Clear". */
  cleared: { native: 'クリア', name: 'CLEARED' },
  /** "Level": the levels of the game. */
  levels: { native: 'レベル', name: 'LEVELS' },
  /** "Language". */
  language: { native: 'ことば', name: 'LANGUAGE' },
  /** "Failure": a level has come to a dead end, or its moves are spent with its goal not met. */
  failed: { native: 'しっぱい', name: 'FAILED' },
  /** "New record": what a result is named once the session has taken its place above the best there was. */
  record: { native: 'しんきろく', name: 'NEW RECORD' },
} as const satisfies Record<string, PanelName>;

/** What a panel can be told to do. */
export const COMMANDS = {
  /** "Resume". */
  resume: { native: 'つづける', name: 'RESUME' },
  /** "Try again". */
  restart: { native: 'やりなおす', name: 'RESTART' },
  again: { native: 'もういちど', name: 'AGAIN' },
  records: { native: 'きろく', name: 'RECORDS' },
  system: { native: 'せってい', name: 'SYSTEM' },
  /** "Menu". */
  menu: { native: 'メニュー', name: 'MENU' },
  levels: { native: 'レベル', name: 'LEVELS' },
  /** "Back". */
  back: { native: 'もどる', name: 'BACK' },
  /** "To the next". */
  next: { native: 'つぎへ', name: 'NEXT' },
  /** "Exit". */
  exit: { native: 'おわる', name: 'EXIT' },
  /** "Start". */
  start: { native: 'はじめる', name: 'START' },
  /** "Skip": the long boot of the first start, passed. */
  skip: { native: 'スキップ', name: 'SKIP' },
  /** "Take back": the last move of a level, from its result. */
  undo: { native: 'とりけし', name: 'UNDO' },
  /** The move taken back that brings an advertisement of the platform after it says so. */
  undoAd: { native: 'とりけし', name: 'UNDO · AD' },
  /** "Registration": the platform gives the player a name. */
  register: { native: 'とうろく', name: 'REGISTER' },
  /** "Sharing": the player's result goes out with a link to the game. What it answers: "copied", "sent", "failure". */
  share: { native: 'シェア', name: 'SHARE' },
  copied: { native: 'コピーずみ', name: 'COPIED' },
  sent: { native: 'そうしんずみ', name: 'SENT' },
  failed: { native: 'しっぱい', name: 'FAILED' },
  /**
   * "Route": the way of a board shown by the swipe sign, for an advertisement of the platform; and
   * "doubling": the score of a live session doubled for one. `AD` says beforehand that one comes
   * (docs/superpowers/specs/2026-10-23-vi-rewarded-ads-design.md).
   */
  showWay: { native: 'ルート', name: 'SHOW WAY · AD' },
  double: { native: 'ダブル', name: 'DOUBLE · AD' },
} as const satisfies Record<string, PanelName>;

/** The readings of a result. */
export const RESULT = {
  score: { native: 'スコア', name: 'SCORE' },
  best: { native: 'ベスト', name: 'BEST' },
  /** "Chain". */
  chain: { native: 'れんさ', name: 'MAX CHAIN' },
  /** "Time". */
  time: { native: 'タイム', name: 'TIME' },
  moves: { native: 'てかず', name: 'MOVES' },
  /** "Still": the moves a passed level had left. */
  left: { native: 'あと', name: 'MOVES LEFT' },
  /** "Rank": the place the session took in the log. */
  rank: { native: 'ランク', name: 'RANK' },
} as const satisfies Record<string, PanelName>;

/** The log of sessions: its name and the heads of its columns. */
export const RECORDS = {
  /** The log is of the one session there is, and goes under its name: the file of the menu that plays it. */
  title: { native: 'プロトコル', name: 'PROTOCOL' },
  /** "No entries". */
  empty: { native: 'きろくなし', name: 'NO ENTRY' },
  /** "Name": the head of the column of whose session a line is. */
  name: 'なまえ',
  /** "Connecting": the players of the platform are on their way. */
  waiting: 'せつぞくちゅう',
  /** "No connection": they did not come. */
  failed: 'せつぞくなし',
  /** A player the platform has no name for. */
  nameless: 'NO NAME',
  /** The line of the one who plays, where no platform has a name for them. */
  you: 'YOU',
} as const;

/** What the program lets the player set, and the values it shows. */
export const SYSTEM = {
  /** "Sound". */
  sound: { native: 'サウンド', name: 'SOUND' },
  /** "Motion". */
  motion: { native: 'うごき', name: 'MOTION' },
  /** "Shake". */
  shake: { native: 'ゆれ', name: 'SHAKE' },
  /** "Camera": follows the player where the whole board would be small, or stays on the whole board. */
  view: { native: 'カメラ', name: 'CAMERA' },
  /** "Language": the one the voice speaks to the player in. The program keeps its own. */
  language: { native: 'ことば', name: 'LANGUAGE' },
  on: 'ON',
  off: 'OFF',
  full: 'FULL',
  reduced: 'LESS',
  auto: 'AUTO',
  fixed: 'FIXED',
} as const;

/**
 * The languages the player picks from: what the program calls each, and what it calls itself,
 * so that it is found by one who does not read the language that is set.
 */
export const LANGUAGE_NAMES = {
  en: { native: 'えいご', name: 'ENGLISH' },
  ru: { native: 'ロシアご', name: 'РУССКИЙ' },
  es: { native: 'スペインご', name: 'ESPAÑOL' },
  pt: { native: 'ポルトガルご', name: 'PORTUGUÊS' },
  tr: { native: 'トルコご', name: 'TÜRKÇE' },
  de: { native: 'ドイツご', name: 'DEUTSCH' },
  fr: { native: 'フランスご', name: 'FRANÇAIS' },
} as const satisfies Record<LanguageCode, PanelName>;
