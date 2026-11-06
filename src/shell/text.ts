import type { GoalLine } from '../rules';
import { word, type LanguageCode } from '../ui/i18n';

/**
 * Everything the shell says, in one place. Beside each word stands its Japanese, in kana; the word
 * itself is said in the language of the player: it is asked for by its English name through
 * `word()`. The owner, 30 October 2026: the game speaks to people, plainly and kindly, and keeps
 * its mystery without the voice of an office.
 *
 * Every kanji used here has to be in the font: run `npm run fonts` after changing the Japanese.
 */

export const LOGO_TEXT = 'VIZAVI';
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

/** What the line under the name of a card of the menu shows. */
export type FileField = 'levels' | 'bestEndless' | 'rules' | 'story' | 'sessions' | 'language';

export interface MenuFile {
  id: string;
  /** The face of the die this file is, 1 to 6. */
  face: number;
  /** Its name, by its English one, said through `word()`. */
  name: string;
  /** What its command says it does. */
  exec: (typeof EXEC)[keyof typeof EXEC];
  /** The line under its name: what it counts, by its English name, and the kind of the value. */
  field: readonly [label: string, kind: FileField];
}

/**
 * The six files of the main menu, one on each face of the die. The levels are the one, the
 * middle of the net, where the figure waits. Opposite faces add up to seven: the levels face
 * the settings of the program, the session without a limit faces the log, and what is read -
 * how the game is played, and the note that came with the program - stands on either side.
 * The exercise and the tasks had the three and the four until 6 October 2026; both are gone
 * from the program since 15 October 2026. Since 5 November 2026 a file is a card, named in the
 * language of the player alone (docs/superpowers/specs/2026-11-05-vi-menu-design.md).
 */
export const MENU_FILES: readonly MenuFile[] = [
  { id: 'levels', face: 1, name: 'LEVELS', exec: EXEC.play, field: ['CLEARED', 'levels'] },
  { id: 'protocol', face: 2, name: 'ENDLESS', exec: EXEC.play, field: ['BEST', 'bestEndless'] },
  { id: 'howto', face: 3, name: 'HOW TO PLAY', exec: EXEC.read, field: ['RULES', 'rules'] },
  /** The note that came with the program and the records of the link: how many of the records are open. */
  { id: 'readme', face: 4, name: 'STORY', exec: EXEC.read, field: ['RECORDS', 'story'] },
  /** The best scores of the endless game; how many sessions there are on record. */
  { id: 'records', face: 5, name: 'HIGH SCORES', exec: EXEC.open, field: ['GAMES', 'sessions'] },
  { id: 'system', face: 6, name: 'SETTINGS', exec: EXEC.open, field: ['LANGUAGE', 'language'] },
];

/** The command of the menu: it goes on with the levels where the player stopped, or plays the first. */
export const MENU_COMMAND = { going: 'CONTINUE', first: 'PLAY' } as const;

/** A count as the program writes it: with leading zeros. */
export function digits(value: number, places: number): string {
  return String(Math.max(0, Math.round(value))).padStart(places, '0');
}

/** What the session shows while it runs: the names of its readings, in English, said through `word()`. */
export const HUD = {
  /** The steps the contact has taken, and the dice sent at which the next one comes. */
  link: 'LINK',
  /** What the link reads once the program has found a pattern on it. */
  found: 'SIGNAL',
  /** "Take back", "again": what can be pressed over the board. */
  undo: 'とりけし',
  retry: 'やりなおし',
} as const;

/**
 * The one word of the readings over the board: `LEVEL 17`, large, in the top left corner of a
 * level (the owner, 30 October 2026; the moves and the par under it go with no names, and a
 * session reads its score and its clock with none). A word of the program, not translated.
 */
export const READS = { level: 'LEVEL' } as const;

/** What a line of the goal of a level goes under, where it is written and not drawn: English names, said through `word()`. */
export const GOAL = { dice: 'DICE', face: 'FACE', links: 'CHAIN', cleared: 'LEFT', clear: 'CLEAR' } as const;


/** Links of a chain are few: their count takes one place while it fits; a count of dice takes two. */
const goalPlaces = (line: GoalLine): number => (line.what === 'links' && line.need < 10 ? 1 : 2);

/** The name of a line of a goal: what it counts. A face is named with its number. */
export function goalLabel(line: GoalLine): string {
  return line.what === 'face' ? `${word(GOAL.face)} ${line.value}` : word(GOAL[line.what]);
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
      if (line.what === 'cleared') return `${word(GOAL.clear)} ${digits(line.need, 2)}`;
      if (line.what === 'face') return `${word(GOAL.face)} ${line.value} ×${digits(line.need, 2)}`;
      return `${word(GOAL[line.what])} ${digits(line.need, goalPlaces(line))}`;
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
  records: { native: 'きろく', name: 'HIGH SCORES' },
  /** "Settings". */
  system: { native: 'せってい', name: 'SETTINGS' },
  /** "Rules". */
  rules: { native: 'ルール', name: 'RULES' },
  /** "Explanation": how the game is played. */
  howto: { native: 'せつめい', name: 'HOW TO PLAY' },
  /** "Story": the note that came with the program. */
  readme: { native: 'ものがたり', name: 'STORY' },
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
  /** "Record": a record of the link (docs/superpowers/specs/2026-11-04-vi-star-novel-design.md). */
  novel: { native: 'きろく', name: 'RECORD' },
  /** "Story": the list the file of the menu opens, the note first and the records after it. */
  story: { native: 'ものがたり', name: 'STORY' },
  /** "Incoming": the screen of a call (docs/superpowers/specs/2026-11-05-vi-live-calls-design.md, section 7.1). */
  incoming: { native: 'ちゃくしん', name: 'INCOMING' },
  /** "Endless": the screen the file of the menu opens once a call has come, free Endless and the calls (section 7.4). */
  endless: { native: 'むげん', name: 'ENDLESS' },
} as const satisfies Record<string, PanelName>;

/** What a panel can be told to do. */
export const COMMANDS = {
  /** "Resume". */
  resume: { native: 'つづける', name: 'RESUME' },
  /** "Try again". */
  restart: { native: 'やりなおす', name: 'RESTART' },
  again: { native: 'もういちど', name: 'AGAIN' },
  records: { native: 'きろく', name: 'HIGH SCORES' },
  system: { native: 'せってい', name: 'SETTINGS' },
  /** "Menu". */
  menu: { native: 'メニュー', name: 'MENU' },
  levels: { native: 'レベル', name: 'LEVELS' },
  /** "Back". */
  back: { native: 'もどる', name: 'BACK' },
  /** "Back": from the list of the levels to the board left in pause; its number is written after it. */
  toLevel: { native: 'もどる', name: 'TO LEVEL' },
  /** "To the next". */
  next: { native: 'つぎへ', name: 'NEXT' },
  /** "Exit". */
  exit: { native: 'おわる', name: 'EXIT' },
  /** "Start". */
  start: { native: 'はじめる', name: 'START' },
  /** "Skip": a record of the link, closed before its last line. */
  skip: { native: 'スキップ', name: 'SKIP' },
  /** "Take back": the last move of a level, from its result. */
  undo: { native: 'とりけし', name: 'UNDO' },
  /** "Registration": the platform gives the player a name. */
  register: { native: 'とうろく', name: 'REGISTER' },
  /** "Sharing": the player's result goes out with a link to the game. What it answers: "copied", "sent", "failure". */
  share: { native: 'シェア', name: 'SHARE' },
  copied: { native: 'コピーずみ', name: 'COPIED' },
  sent: { native: 'そうしんずみ', name: 'SENT' },
  failed: { native: 'しっぱい', name: 'FAILED' },
  /**
   * "Hint": the way of a board shown by the swipe sign, for an advertisement of the platform; and
   * "doubling": the score of a live session doubled for one. `AD` says beforehand that one comes
   * (docs/superpowers/specs/2026-10-23-vi-rewarded-ads-design.md).
   */
  showWay: { native: 'ヒント', name: 'HINT · AD' },
  double: { native: 'ダブル', name: 'DOUBLE · AD' },
  /** "Answer", "refuse": a call is taken, or declined. "Cut": the call is hung up, from under the board. */
  accept: { native: 'おうとう', name: 'ACCEPT' },
  decline: { native: 'きょひ', name: 'DECLINE' },
  hangUp: { native: 'きる', name: 'HANG UP' },
} as const satisfies Record<string, PanelName>;

/** The words of the calls (docs/superpowers/specs/2026-11-05-vi-live-calls-design.md, section 11), said through `word()`. */
export const CALL = {
  /** "Number": who calls, over the line saying that the number is not known. */
  number: { native: 'ばんごう', name: '??????' },
  /** "Call": the calls that have come, on the screen of `ENDLESS`. */
  calls: { native: 'つうわ', name: 'CALLS' },
  /** "Cut off": the board filled, and the call ended before its time. */
  lineLost: { native: 'せつだん', name: 'LINE LOST' },
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
  /** "Par": the fewest moves a board is cleared in. A word of the program, not translated (the owner, 28 October 2026). */
  par: { native: 'パー', name: 'PAR' },
  /** "Still": the moves a passed level had left. */
  left: { native: 'あと', name: 'MOVES LEFT' },
  /** "Rank": the place the session took in the log. */
  rank: { native: 'ランク', name: 'RANK' },
  /** "Stars": the sum of the stars of the row. */
  stars: { native: 'ほし', name: 'STARS' },
  /** "To the record": the stars that are left to the next record of the link. */
  toRecord: { native: 'きろくまで', name: 'TO RECORD' },
} as const satisfies Record<string, PanelName>;

/** The log of sessions: its name and the heads of its columns. */
export const RECORDS = {
  /** The best scores of the endless game, under the name of the file of the menu that opens them. */
  title: { native: 'きろく', name: 'HIGH SCORES' },
  /** "No entries". */
  empty: { native: 'きろくなし', name: 'NO ENTRY' },
  /** The head of the column of whose game a line is. English names, said through `word()`. */
  name: 'NAME',
  /** The players of the platform are on their way. */
  waiting: 'CONNECTING',
  /** They did not come. */
  failed: 'OFFLINE',
  /** A player the platform has no name for. */
  nameless: 'NO NAME',
  /** The line of the one who plays, where no platform has a name for them. */
  you: 'YOU',
} as const;

/** What the program lets the player set, and the values it shows. */
export const SYSTEM = {
  /** "Sound". */
  sound: { native: 'サウンド', name: 'SOUND' },
  /** "Effects": the shake of the screen and the motion of the board, all of them, or calm (the owner, 30 October 2026: one line for the two). */
  effects: { native: 'こうか', name: 'EFFECTS' },
  /** "Operation": by direction (swipes, keys) or by aim (taps, the mouse); its values name what the player does on this device. */
  control: { native: 'そうさ', name: 'CONTROLS' },
  /** "Language": the one the voice speaks to the player in. The program keeps its own. */
  language: { native: 'ことば', name: 'LANGUAGE' },
  on: 'ON',
  off: 'OFF',
  all: 'ALL',
  calm: 'CALM',
  /** The two ways to play, on a phone. */
  swipe: 'SWIPE',
  tap: 'TAP',
  /** The same two, at a computer. */
  keys: 'KEYS',
  mouse: 'MOUSE',
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
