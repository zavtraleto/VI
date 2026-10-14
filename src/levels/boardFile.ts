import { defaultConfig, levelConfig } from '../rules';
import { LEVEL_LIFT_MOVES, LEVEL_SINK_MOVES } from '../rules/level';
import { moveOf, moveText } from '../rules/levelSolver';
import { ALL_ORIENTATIONS } from '../rules/orientation';
import type { LevelLayout, LevelSpec, PuzzleDie } from '../rules/types';

/**
 * A board of a level as a file of text: the one thing the page of the lab, the script
 * `scripts/level.mjs` and an agent with an editor all read and write. The head is lines of
 * `key: value`, then `---`, then the board row by row from the north.
 *
 *   # строки с # — комментарии, пропускаются
 *   id: H01
 *   note: третья кость подъезжает толчком      (свободный текст, не входит в LevelSpec)
 *   status: D                                 (D | RC | R | X: черновик, кандидат, в ряду, снята)
 *   origin: проба 7 октября                   (откуда доска; свободная строка)
 *   mark: огонь                               (огонь | норм | мимо: последняя оценка владельца)
 *   words: 2026-10-14: слова                  (слова владельца с датой; ключ повторяется)
 *   tags: мост накат                          (свободные метки через пробел)
 *   faces: 3 5                                (рабочие грани через пробел; обязательно)
 *   sink: 2                                   (sinkMoves; по умолчанию 2)
 *   lift: 1                                   (liftMoves; по умолчанию 1)
 *   floor: open                               (open | shut; по умолчанию open → floor не пишется / false)
 *   climb: on                                 (необязательно)
 *   undos: 3                                  (необязательно)
 *   seed: 0                                   (необязательно; 0 по умолчанию)
 *   chapter: 0                                (необязательно)
 *   lesson: roadHintClimb                     (необязательно; так же story, until, guard: on, guide: on)
 *   par: 6                                    (необязательно)
 *   exact: yes                                (yes | no; только вместе с par)
 *   way: 0,1,N 1,1,E 2,1,S                    (ходы через пробел в нотации moveText)
 *   ---
 *    -   .   .  54*
 *    .  21   .   .
 *    .   .  64  21~2
 *    .   .  24+  -
 *
 * The grid has as many rows as the board is wide, and every row as many signs, with spaces
 * between. A sign: `-` a cell cut out; `.` an empty cell; `f` an empty cell the player starts on,
 * down on the floor; a die is two digits, its top face and the face to the north, with marks in
 * any order: `*` the player starts on it, `+` it is fixed, `~k` it is leaving and goes in `k`
 * moves (1 to `sink`). One start to a board, `*` or `f`. A dot here is an empty cell, where in
 * `cutFrom` of `recipes.ts` it is a cell cut out: the two are not the same writing.
 *
 * The level read from a file is a board to clear that nothing comes to, with no limit of moves:
 * its dice in the order of the rows, as many named as are laid. It is held against the rules by
 * `levelConfig`, and what they refuse is said with the name of the board before it.
 */

/**
 * Where a board stands (the library of the boards, docs/superpowers/specs/2026-10-14-vi-board-library-design.md):
 * `D` a draft, `RC` a candidate for the row, `R` in the row, `X` taken off. Not a part of its code.
 */
export type BoardStatus = 'D' | 'RC' | 'R' | 'X';
export const BOARD_STATUSES: readonly BoardStatus[] = ['D', 'RC', 'R', 'X'];
/** The last word of the owner on a board after playing it. */
export type BoardMark = 'огонь' | 'норм' | 'мимо';
export const BOARD_MARKS: readonly BoardMark[] = ['огонь', 'норм', 'мимо'];
/** The statuses of a file before the library, and what each is read as: a place and a mark. */
const OLD_STATUSES: Readonly<Record<string, { status: BoardStatus; mark?: BoardMark }>> = {
  idea: { status: 'D' },
  work: { status: 'D' },
  good: { status: 'RC', mark: 'норм' },
  fire: { status: 'RC', mark: 'огонь' },
  miss: { status: 'X', mark: 'мимо' },
};
/** A word of the owner on a board, with the day it was said. */
export interface BoardWords {
  date: string;
  text: string;
}
/** What a file says that a level does not keep. */
export interface BoardHead {
  note?: string;
  status?: BoardStatus;
  origin?: string;
  mark?: BoardMark;
  words?: BoardWords[];
  tags?: string[];
  /** The file said a status of the old words (`idea`, `fire`…), read here as the new; written again, it says the new. */
  migrated?: boolean;
}

const KEYS = ['id', 'note', 'status', 'origin', 'mark', 'words', 'tags', 'faces', 'sink', 'lift', 'floor', 'climb', 'undos', 'seed', 'chapter', 'lesson', 'story', 'until', 'guard', 'guide', 'par', 'exact', 'way'] as const;
type Key = (typeof KEYS)[number];
const DIE = /^([1-6])([1-6])((?:[*+]|~\d+)*)$/;
const UNTIL: readonly NonNullable<LevelSpec['until']>[] = ['move', 'combo', 'chain', 'push', 'climb', 'end'];
/** The moves a die of a file leaves in, and the moves it comes up in, where the file does not say. */
const SINK = 2;
const LIFT = 1;

/** A key that may be said more than once, a line to each: the words of the owner. */
const MANY: readonly Key[] = ['words'];
const WORDS = /^(\d{4}-\d{2}-\d{2}):\s*(.*)$/;

/** Splits a file into its head lines and the rows of its grid; `---` stands between them. */
function partsOf(text: string, name: string): { head: Map<Key, string>; many: Map<Key, string[]>; rows: string[][] } {
  const head = new Map<Key, string>();
  const many = new Map<Key, string[]>();
  const rows: string[][] = [];
  let grid = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (!grid && /^-{3,}$/.test(line)) {
      grid = true;
      continue;
    }
    if (grid) {
      rows.push(line.split(/\s+/));
      continue;
    }
    const at = line.indexOf(':');
    const key = at < 0 ? '' : line.slice(0, at).trim();
    if (!(KEYS as readonly string[]).includes(key)) throw new Error(`board ${name}: cannot read the line "${line}"`);
    if (MANY.includes(key as Key)) {
      many.set(key as Key, [...(many.get(key as Key) ?? []), line.slice(at + 1).trim()]);
      continue;
    }
    if (head.has(key as Key)) throw new Error(`board ${name}: "${key}" is said twice`);
    head.set(key as Key, line.slice(at + 1).trim());
  }
  if (!grid) throw new Error(`board ${name}: no "---" before the rows of the board`);
  return { head, many, rows };
}

/**
 * Reads a file as a level. With `loose` the file is read as far as its signs go and is not held
 * against the rules: a board with no start, or with two, with a die that leaves in more moves
 * than a die can, or one the rules refuse, is given as it is written, the first start taken and
 * none written as a start off the board. That is how the editor opens a board it can show and
 * the rules will not play. A sign that cannot be read is refused either way.
 */
export function parseBoard(text: string, name = '?', loose = false): LevelSpec {
  const { head, many, rows } = partsOf(text, name);
  const wrong = (what: string): never => {
    throw new Error(`board ${name}: ${what}`);
  };
  const whole = (key: Key, least: number): number | undefined => {
    const said = head.get(key);
    if (said === undefined) return undefined;
    if (!/^\d+$/.test(said) || Number(said) < least) wrong(`"${key}: ${said}" is not a number from ${least}`);
    return Number(said);
  };
  const one = <T extends string>(key: Key, of: readonly T[]): T | undefined => {
    const said = head.get(key);
    if (said === undefined) return undefined;
    if (!(of as readonly string[]).includes(said)) wrong(`"${key}: ${said}" is none of ${of.join(', ')}`);
    return said as T;
  };
  const word = (key: Key): string | undefined => head.get(key) || undefined;

  const id = head.get('id') ?? '';
  if (!/^[A-Za-z0-9_-]+$/.test(id)) wrong(id === '' ? 'no "id:" line' : `"id: ${id}" has more than letters, digits, - and _`);
  const said = head.get('faces') ?? '';
  const faces = said.split(/\s+/).filter((face) => face !== '');
  if (faces.length === 0) wrong('no "faces:" line');
  if (faces.some((face) => !/^[1-6]$/.test(face)) || new Set(faces).size !== faces.length) wrong(`"faces: ${said}" is not faces of a die, each once`);
  const status = head.get('status');
  if (status !== undefined && !(BOARD_STATUSES as readonly string[]).includes(status) && !(status in OLD_STATUSES)) wrong(`"status: ${status}" is none of ${BOARD_STATUSES.join(' ')}`);
  one('mark', BOARD_MARKS);
  for (const said of many.get('words') ?? []) if (!WORDS.test(said)) wrong(`"words: ${said}" has no date: words are "YYYY-MM-DD: text"`);
  const sink = whole('sink', 1) ?? SINK;
  const lift = whole('lift', 0) ?? LIFT;
  const par = whole('par', 1);
  const exact = one('exact', ['yes', 'no']);
  if (exact !== undefined && par === undefined) wrong('"exact:" is said of a "par:", and there is none');
  const floor = one('floor', ['open', 'shut']);
  const climb = one('climb', ['on', 'off']);
  const guard = one('guard', ['on', 'off']);
  const guide = one('guide', ['on', 'off']);
  const way = head.has('way') ? head.get('way')!.split(/\s+/).filter((move) => move !== '') : undefined;
  for (const move of way ?? []) {
    if (!/^[0-7],[0-7],[NSEW](,p)?$/.test(move) || moveText(moveOf(move)) !== move) wrong(`"${move}" of the way is no move: a move is x,z,D or x,z,D,p`);
  }

  const size = rows.length;
  if (size === 0) wrong('no rows after "---"');
  const dice: PuzzleDie[] = [];
  const holes: { x: number; z: number }[] = [];
  const leaving: { die: number; moves: number }[] = [];
  const starts: { x: number; z: number; onFloor: boolean }[] = [];
  rows.forEach((row, z) => {
    if (row.length !== size) wrong(`row ${z + 1} has ${row.length} cells, the board is ${size} wide`);
    row.forEach((sign, x) => {
      if (sign === '.') return;
      if (sign === '-') return void holes.push({ x, z });
      if (sign === 'f') return void starts.push({ x, z, onFloor: true });
      const read = DIE.exec(sign);
      if (!read) return wrong(`cell ${x},${z}: cannot read "${sign}": a cell is -, ., f or a die as 54, with * + ~k after it`);
      const top = Number(read[1]);
      const north = Number(read[2]);
      if (!ALL_ORIENTATIONS.some((o) => o.top === top && o.north === north)) wrong(`cell ${x},${z}: "${read[1]}${read[2]}" is no way a die lies`);
      const marks = read[3].match(/[*+]|~\d+/g) ?? [];
      if (new Set(marks.map((mark) => mark[0])).size !== marks.length) wrong(`cell ${x},${z}: "${sign}" says a mark twice`);
      const die: PuzzleDie = { x, z, top, north };
      for (const mark of marks) {
        if (mark === '*') starts.push({ x, z, onFloor: false });
        else if (mark === '+') die.fixed = true;
        else {
          const moves = Number(mark.slice(1));
          if (moves < 1) wrong(`cell ${x},${z}: "${sign}" leaves in ${mark}, where it is ~1 to ~${sink}`);
          if (moves > sink && !loose) wrong(`cell ${x},${z}: "${sign}" leaves in ${mark}, more moves than sink (${sink})`);
          leaving.push({ die: dice.length, moves });
        }
      }
      dice.push(die);
    });
  });
  if (starts.length !== 1 && !loose) wrong(`one start is needed, found ${starts.length}`);
  const start = starts[0] ?? { x: -1, z: -1, onFloor: false };

  const layout: LevelLayout = {
    start: { x: start.x, z: start.z },
    dice,
    ...(leaving.length > 0 ? { leaving } : {}),
    ...(start.onFloor ? { onFloor: true } : {}),
  };
  const spec: LevelSpec = {
    id,
    seed: whole('seed', 0) ?? 0,
    size,
    ...(holes.length > 0 ? { holes } : {}),
    goal: { kind: 'clear' },
    moves: 0,
    values: faces.map(Number),
    norm: dice.length,
    arrival: 'none',
    sinkMoves: sink,
    liftMoves: lift,
    faces: faces.map(Number),
    layout,
    ...(head.has('undos') ? { undos: whole('undos', 0) } : {}),
    ...(word('lesson') ? { lesson: word('lesson') } : {}),
    ...(head.has('chapter') ? { chapter: whole('chapter', 0) } : {}),
    ...(floor === 'shut' ? { floor: false } : {}),
    ...(climb ? { climb: climb === 'on' } : {}),
    ...(guard ? { guard: guard === 'on' } : {}),
    ...(head.has('until') ? { until: one('until', UNTIL) } : {}),
    ...(guide ? { guide: guide === 'on' } : {}),
    ...(word('story') ? { story: word('story') } : {}),
    ...(par !== undefined ? { par } : {}),
    ...(exact ? { exact: exact === 'yes' } : {}),
    ...(way ? { solution: way } : {}),
  };
  if (loose) return spec;
  try {
    levelConfig(defaultConfig(), spec);
  } catch (error) {
    wrong((error as Error).message);
  }
  return spec;
}

/**
 * The lines of a file that are about the board and not of it: the note, the status, where it is
 * from, the mark and the words of the owner, the tags. Reads no more of the file, and takes what
 * it can of a file that is no board. A status of the old words is read as the new one, with the
 * mark it said, and the head says it was (`migrated`).
 */
export function readBoardHead(text: string): BoardHead {
  const head: BoardHead = {};
  let oldMark: BoardMark | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^-{3,}$/.test(line)) break;
    const read = /^(note|status|origin|mark|words|tags):\s*(.*)$/.exec(line);
    if (!read || read[2] === '') continue;
    const [, key, value] = read;
    if (key === 'note') head.note = value;
    else if (key === 'origin') head.origin = value;
    else if (key === 'mark' && (BOARD_MARKS as readonly string[]).includes(value)) head.mark = value as BoardMark;
    else if (key === 'tags') head.tags = value.split(/\s+/);
    else if (key === 'words') {
      const words = WORDS.exec(value);
      if (words) head.words = [...(head.words ?? []), { date: words[1], text: words[2] }];
    } else if (key === 'status') {
      if ((BOARD_STATUSES as readonly string[]).includes(value)) head.status = value as BoardStatus;
      else if (value in OLD_STATUSES) {
        head.status = OLD_STATUSES[value].status;
        oldMark = OLD_STATUSES[value].mark;
        head.migrated = true;
      }
    }
  }
  // The mark the file says stands before the one its old status meant.
  if (oldMark && !head.mark) head.mark = oldMark;
  return head;
}

/** The sign of every cell of a board, row by row from the north: what `printBoard` writes and `parseBoard` reads. */
export function boardSigns(spec: LevelSpec): string[][] {
  const { size, layout } = spec;
  const signs: string[][] = [];
  for (let z = 0; z < size; z++) {
    const row: string[] = [];
    for (let x = 0; x < size; x++) {
      const at = layout ? layout.dice.findIndex((die) => die.x === x && die.z === z) : -1;
      const start = layout !== undefined && layout.start.x === x && layout.start.z === z;
      if (at < 0) {
        row.push((spec.holes ?? []).some((cell) => cell.x === x && cell.z === z) ? '-' : start ? 'f' : '.');
        continue;
      }
      const die = layout!.dice[at];
      const leaves = (layout!.leaving ?? []).find((leaving) => leaving.die === at);
      row.push(`${die.top}${die.north}${start ? '*' : ''}${die.fixed ? '+' : ''}${leaves ? `~${leaves.moves}` : ''}`);
    }
    signs.push(row);
  }
  return signs;
}

/**
 * A level as a file. The head goes in the order of the keys, and a key is written where the
 * level says something the file would not take for granted. A die is written from the first
 * column of its cell and the other signs from the second, so that the digits stand in columns.
 */
export function printBoard(spec: LevelSpec, extra: BoardHead = {}): string {
  if (!spec.layout) throw new Error(`board ${spec.id}: a level with no board given die by die is not written as a file`);
  const onOff = (value: boolean | undefined): string | undefined => (value === undefined ? undefined : value ? 'on' : 'off');
  const said: Record<Key, string | undefined> = {
    id: spec.id,
    note: extra.note,
    status: extra.status,
    origin: extra.origin,
    mark: extra.mark,
    words: undefined,
    tags: extra.tags && extra.tags.length > 0 ? extra.tags.join(' ') : undefined,
    faces: (spec.faces ?? spec.values).join(' '),
    sink: spec.sinkMoves === SINK ? undefined : String(spec.sinkMoves ?? LEVEL_SINK_MOVES),
    lift: spec.liftMoves === LIFT ? undefined : String(spec.liftMoves ?? LEVEL_LIFT_MOVES),
    floor: spec.floor === false ? 'shut' : undefined,
    climb: onOff(spec.climb),
    undos: spec.undos?.toString(),
    seed: spec.seed === 0 ? undefined : String(spec.seed),
    chapter: spec.chapter?.toString(),
    lesson: spec.lesson,
    story: spec.story,
    until: spec.until,
    guard: onOff(spec.guard),
    guide: onOff(spec.guide),
    par: spec.par?.toString(),
    exact: spec.par === undefined || spec.exact === undefined ? undefined : spec.exact ? 'yes' : 'no',
    way: spec.solution?.join(' '),
  };
  const lines = KEYS.flatMap((key) =>
    key === 'words' ? (extra.words ?? []).map((words) => `words: ${words.date}: ${words.text}`) : said[key] === undefined ? [] : [`${key}: ${said[key]}`],
  );
  const signs = boardSigns(spec);
  const wide = Math.max(3, ...signs.flat().map((sign) => sign.length));
  const rows = signs.map((row) => row.map((sign) => (sign.length === 1 ? ` ${sign}` : sign).padEnd(wide)).join(' ').trimEnd());
  return `${[...lines, '---', ...rows].join('\n')}\n`;
}

/**
 * A level with nothing left in it that two files of one board could differ by: the dice in the
 * order of the rows with the leaving ones named by their new places, the cells cut out in that
 * order too, the faces sorted, a floor said to be open and a field said to be nothing dropped.
 * Two levels are the same board with the same head when these are equal.
 */
export function normalSpec(spec: LevelSpec): LevelSpec {
  const byRow = (a: { x: number; z: number }, b: { x: number; z: number }): number => a.z - b.z || a.x - b.x;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(spec)) if (value !== undefined) out[key] = value;
  if (spec.floor !== false) delete out.floor;
  out.values = [...spec.values].sort((a, b) => a - b);
  if (spec.holes && spec.holes.length > 0) out.holes = spec.holes.map(({ x, z }) => ({ x, z })).sort(byRow);
  else delete out.holes;
  if (spec.solution) out.solution = [...spec.solution];
  if (spec.layout) {
    const order = spec.layout.dice.map((_, index) => index).sort((a, b) => byRow(spec.layout!.dice[a], spec.layout!.dice[b]));
    const dice = order.map((index) => {
      const { x, z, top, north, fixed } = spec.layout!.dice[index];
      return { x, z, top, north, ...(fixed ? { fixed: true } : {}) };
    });
    const leaving = (spec.layout.leaving ?? []).map(({ die, moves }) => ({ die: order.indexOf(die), moves })).sort((a, b) => a.die - b.die);
    out.layout = {
      start: { x: spec.layout.start.x, z: spec.layout.start.z },
      dice,
      ...(leaving.length > 0 ? { leaving } : {}),
      ...(spec.layout.onFloor ? { onFloor: true } : {}),
    };
  }
  return out as unknown as LevelSpec;
}
