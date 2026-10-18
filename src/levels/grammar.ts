import { scoreOf } from '../rules/levelScore';
import { moveOf } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import type { Stop } from './campaign';
import { goalFaces } from './goalFaces';
import { loopOf, startsUnder, turnsOf, visibleFaces } from './measures';
import type { HintKey, Technique } from './row';
import { sameBoard } from './variety';

/**
 * The grammar of the row (docs/superpowers/specs/2026-10-14-vi-campaign-2-design.md, section 3):
 * the boards are words, the row a sentence, and these are the rules of which board may stand after
 * which. Each rule reads the row (`CAMPAIGN`) and the scores of the ways the boards keep, and says
 * every place it is broken in words, with the numbers of the places and the codes of the boards.
 *
 * The fast rules (1, 3, 4 and the count of moves of rule 5) ask nothing of a search and are a test
 * (`grammar.test.ts`). The slow ones (2 and the planner of rule 5) are given what the walk over the
 * boards and the personas found (`node scripts/ladder.mjs campaign`) and are printed under its table.
 * Rule 6, that after N comes N + 1, is the game's own (`boardAfter`).
 */

/** A rule broken: its number, the place in the row (from 1) it is broken at, and what is wrong, in words. */
export interface Violation {
  rule: 1 | 2 | 3 | 4 | 5 | 7 | 8 | 10 | 11 | 12 | 13;
  at: number;
  text: string;
  /** A part of a rule that only warns, whatever the rule: the fast part of rule 12, read off the way a board keeps. */
  warning?: true;
}

/**
 * The rules that hold the row before it is published, at step 4 of the third campaign
 * (docs/superpowers/specs/2026-10-16-vi-campaign-3-design.md, sections 7, 13, 14 and 15): 4, 8, 10, 11 and 13
 * are printed as warnings. There is no rule 9: the floor and the push before their lesson are the
 * player's (the owner, 17 October 2026). Rule 11, the step of seven, is a warning from step 4: «7 это
 * скорее примерное измерение» (the owner, 18 October 2026). Rule 12 holds, but for its fast part.
 */
export const HELD: ReadonlySet<Violation['rule']> = new Set([1, 2, 3, 5, 7, 12]);
/** Whether a rule broken holds the row back, or is a warning for now. */
export const held = (one: Violation): boolean => HELD.has(one.rule) && !one.warning;
/** What the line of a rule that does not hold the row back yet ends with, under the table and in the workshop. */
export const WARNING = ' (предупреждение)';

/** What the walk and the personas found of a board, for the slow rules. */
export interface SlowFacts {
  /** The walk over the boards the player can come to found one from which the board cannot be cleared. */
  lost: boolean;
  /** The share of the runs of the planning persona that clear the board. */
  planner: number;
  /** The share of the runs of the casual persona that clear the board (rule 8); where it is not given, rule 8 asks nothing of it. */
  casual?: number;
  /**
   * For a board that teaches a move the solver can be barred from: the fewest moves it is cleared in
   * without that move, looked for up to two over its own; null where it is not cleared so.
   */
  without?: number | null;
  /**
   * Rule 12: for each move the solver can be barred from, the fewest moves the board is cleared in
   * without it, looked for up to three over its own; null where it is not cleared so. A move left out
   * asks nothing of the board.
   */
  cleared?: Partial<Record<Barred, number | null>>;
  /**
   * The board is a trap of order (third campaign, section 13): its way makes two combos or links at least (a link counts, section 14), and a
   * combo can be made first or second after which it cannot be cleared (`trapOf`). Rule 1 for a board
   * that teaches the order counts it; where it is not given, the board is no trap.
   */
  order?: boolean;
}

/**
 * Rule 2, how many moves the move taught has to save (уточнено 14 октября по шагу 1): the walk over
 * leaving dice one, as the meeting of the walk (`R11`) is laid in the spec; every other move two.
 * A move the solver cannot be barred from (two faces, the seven, time) is not held to rule 2 at all.
 */
export const SAVES: Partial<Record<Technique, number>> = { walk: 1, link: 2, glass: 2, lift: 2, push: 2, ones: 2 };

/** Rule 5: the planner after a meeting may clear its board this much less often than on the meeting, two runs of thirty (уточнено 14 октября по шагу 1). */
export const PLANNER_SLACK = 2 / 30;

/** Rule 7: the move a window of a hint tells of, which the board after it teaches and asks for. */
export const HINT_TECHNIQUE: Readonly<Record<HintKey, Technique>> = {
  roadHintChain: 'link',
  roadHintWalk: 'walk',
  roadHintPush: 'push',
  roadHintClimb: 'lift',
  hintSeven: 'seven',
  hintLinkMove: 'link',
};

/**
 * The moves a board asks for, read off the score of the way it keeps (`scoreOf`): a link (`L`, `Q`),
 * a walk over a leaving die (`~`), a way down or up (`v`, `!`, `^`), a roll onto a leaving die
 * (`glass`), a push (`P`, `Q`, `U`), the 1s (`O`, `U`); two faces where combos of two faces go;
 * the seven where the way starts on a die with a working face under and turns it up; the loop where
 * one die goes aside, across and back (`loopOf`). The order is no part of it: a trap is found by a
 * search, and the slow part of the grammar is given it (`SlowFacts.order`).
 */
export function needsOf(spec: LevelSpec): ReadonlySet<Technique> {
  const needs = new Set<Technique>();
  const way = (spec.solution ?? []).map(moveOf);
  const { beats, route } = scoreOf(spec, way);
  const signs = route.split(' ');
  if (signs.some((sign) => sign === 'L' || sign === 'Q')) needs.add('link');
  if (signs.includes('~')) needs.add('walk');
  if (signs.some((sign) => sign === 'v' || sign === '!' || sign === '^')) needs.add('lift');
  if (beats.some((beat) => beat.how === 'glass')) needs.add('glass');
  if (signs.some((sign) => sign === 'P' || sign === 'Q' || sign === 'U')) needs.add('push');
  if (signs.some((sign) => sign === 'O' || sign === 'U')) needs.add('ones');
  if (new Set(beats.filter((beat) => beat.event === 'combo').map((beat) => beat.face)).size > 1) needs.add('twoFaces');
  if (startsUnder(spec, way) && turnsOf(spec, way) >= 1) needs.add('seven');
  if (loopOf(spec, way)) needs.add('loop');
  return needs;
}

const placeOf = (stop: Stop): string => `место ${stop.number} (${stop.spec.id})`;

/** Rule 12: the moves the solver can be barred from, and so the moves a board can be shown to need. */
export const BARRED = ['walk', 'link', 'glass', 'lift', 'push'] as const;
export type Barred = (typeof BARRED)[number];
/** Rule 12: what the line says of the lesson of a move: «звену учат на месте 16». */
const LESSON_WORD: Readonly<Record<Barred, string>> = { link: 'звену', walk: 'проходу', glass: 'накату', lift: 'подъёму', push: 'толчку' };

/** The number of the first place that teaches a move, or Infinity where none does. */
export function lessonOf(row: readonly Stop[], technique: Technique): number {
  return row.find((stop) => stop.teaches === technique)?.number ?? Infinity;
}

const lessonText = (row: readonly Stop[], technique: Barred): string => {
  const at = lessonOf(row, technique);
  return at === Infinity ? `а ${LESSON_WORD[technique]} в ряду не учат` : `а ${LESSON_WORD[technique]} учат на месте ${at}`;
};

/**
 * The moves of rule 12 the way a board keeps asks for: as `needsOf`, but the lift is the climb onto a
 * leaving die alone (`^`), as for the window of the climb (rule 7): a way down and a push are the push's.
 */
function barredNeeds(spec: LevelSpec): Barred[] {
  const needs = needsOf(spec);
  return BARRED.filter((one) => (one === 'lift' ? climbsUp(spec) : needs.has(one)));
}

/**
 * Rule 12 (third campaign, section 15), its fast part, a warning: a board before the lesson of a move
 * whose kept way uses it. That it cannot be cleared in its count without the move is the slow part's.
 */
function nothingBeforeLesson(row: readonly Stop[]): Violation[] {
  return row.flatMap((stop) =>
    barredNeeds(stop.spec)
      .filter((one) => stop.number < lessonOf(row, one))
      .map((one): Violation => ({ rule: 12, at: stop.number, text: `${placeOf(stop)} по записанному пути требует ${one}, ${lessonText(row, one)}`, warning: true })),
  );
}

/**
 * Rule 13 (third campaign, section 15), a warning: every goal face of a board is to be seen at the start
 * on one die at least, on its top or its south or east side (`visibleFaces`): the faces the player sees lead.
 */
function goalFacesSeen(row: readonly Stop[]): Violation[] {
  return row.flatMap((stop) => {
    const seen = visibleFaces(stop.spec);
    return goalFaces(stop.spec)
      .filter((face) => !seen.has(face))
      .map((face): Violation => ({ rule: 13, at: stop.number, text: `${placeOf(stop)}: грань ${face} не видна в начале` }));
  });
}

/** Rule 1, its first part: the move taught at a place is asked for by `using` of the boards after it, and that is two at least. */
function usedAfter(stop: Stop, after: readonly Stop[], using: number): Violation | null {
  if (using >= Math.min(2, after.length)) return null;
  const span = after.length === 1 ? `места ${after[0].number}` : `мест ${after[0].number}–${after[after.length - 1].number}`;
  return { rule: 1, at: stop.number, text: `${placeOf(stop)} учит ${stop.teaches}, а из ${span} его требует ${using} досок` };
}

/**
 * Rule 1: a move taught at N is asked for by at least two of N+1…N+3, and the next board that teaches
 * is not before N+2, but where the board at N already asked for the move that board brings in. The
 * seven is not held to the first part: reading a face is needed everywhere unsaid (third campaign, rule 7);
 * nor is the order here, since a trap of order is found by a search: the slow part counts it (`slowGrammar`);
 * nor two faces, which is no lesson from step 4 (third campaign, section 15).
 */
function taughtAndUsed(row: readonly Stop[]): Violation[] {
  const out: Violation[] = [];
  row.forEach((stop, index) => {
    if (!stop.teaches) return;
    const after = row.slice(index + 1, index + 4);
    if (after.length > 0 && stop.teaches !== 'seven' && stop.teaches !== 'order' && stop.teaches !== 'twoFaces') {
      const using = after.filter((next) => needsOf(next.spec).has(stop.teaches!)).length;
      const broken = usedAfter(stop, after, using);
      if (broken) out.push(broken);
    }
    const next = row[index + 1];
    // Two meetings side by side are let be where the first already asked for the move the second names (spec, section 3).
    const named = next?.teaches !== undefined && needsOf(stop.spec).has(next.teaches);
    if (next?.teaches && !named) out.push({ rule: 1, at: next.number, text: `${placeOf(next)} учит сразу после места ${stop.number} (${stop.spec.id})` });
  });
  return out;
}

/**
 * Rule 3 (ужесточено 14 октября по плейтесту): one archetype no more than twice in a row, a meeting
 * and one use; an archetype of a chapter comes back in the next chapter only as its twist; and no
 * two boards of the row one figure, turned, mirrored or on other faces.
 */
function oneThought(row: readonly Stop[]): Violation[] {
  const out: Violation[] = [];
  let from = 0;
  row.forEach((stop, index) => {
    if (index > 0 && stop.archetype !== row[index - 1].archetype) from = index;
    if (index - from + 1 === 3) out.push({ rule: 3, at: stop.number, text: `места ${row[from].number}–${stop.number} — три доски архетипа ${stop.archetype} подряд` });
  });
  for (const stop of row) {
    if (stop.role === 'twist') continue;
    const before = row.some((other) => other.chapter === stop.chapter - 1 && other.archetype === stop.archetype);
    if (before) out.push({ rule: 3, at: stop.number, text: `${placeOf(stop)} — архетип ${stop.archetype} был в главе ${stop.chapter - 1}, а здесь не поворот` });
  }
  // Boards on other faces are held side by side on the same: a figure is a figure, whatever face its dice show.
  const plain = (spec: LevelSpec): LevelSpec => ({ ...spec, faces: [0], values: [0] });
  row.forEach((stop, index) => {
    for (const other of row.slice(index + 1)) {
      if (sameBoard(plain(stop.spec), plain(other.spec))) out.push({ rule: 3, at: other.number, text: `места ${stop.number} (${stop.spec.id}) и ${other.number} (${other.spec.id}) — одна фигура` });
    }
  });
  return out;
}

/**
 * Rule 4 (third campaign, section 7): the faces a board names are those of the combos and links on
 * the way it keeps (`goalFaces`), but for the 1s it may name besides; and no board of the row plays
 * on `only`, since every face works (0.2.66).
 */
function facesByWay(row: readonly Stop[]): Violation[] {
  const out: Violation[] = [];
  for (const stop of row) {
    const named = (stop.spec.faces ?? []).filter((face) => face >= 2).sort((x, y) => x - y);
    const way = goalFaces(stop.spec);
    if (String(named) !== String(way)) out.push({ rule: 4, at: stop.number, text: `${placeOf(stop)} называет грани ${named.join(' ')}, а на пути — ${way.join(' ')}` });
    if (stop.spec.only) out.push({ rule: 4, at: stop.number, text: `${placeOf(stop)} ставит only, а доска ряда его не ставит` });
  }
  return out;
}

/**
 * Rule 7 (third campaign, section 7): the window of a hint speaks of the board it stands before, so
 * the board teaches the move of the window and its way asks for that move. The climb window asks
 * for a way up onto a leaving die (`^`): a way down alone is no climb.
 */
function windowTeaches(row: readonly Stop[]): Violation[] {
  const out: Violation[] = [];
  for (const stop of row) {
    const hint = stop.help.hint;
    if (!hint) continue;
    const want = HINT_TECHNIQUE[hint];
    if (stop.teaches !== want) out.push({ rule: 7, at: stop.number, text: `${placeOf(stop)}: окно ${hint}, а доска учит ${stop.teaches ?? 'ничему'}` });
    const climb = hint === 'roadHintClimb';
    const asked = climb ? climbsUp(stop.spec) : needsOf(stop.spec).has(want);
    if (!asked) out.push({ rule: 7, at: stop.number, text: `${placeOf(stop)}: окно ${hint}, а путь доски не требует ${want}${climb ? ' (^)' : ''}` });
  }
  return out;
}

/** Whether the way a board keeps goes up onto a leaving die (`^` in its score). */
function climbsUp(spec: LevelSpec): boolean {
  return scoreOf(spec, (spec.solution ?? []).map(moveOf)).route.split(' ').includes('^');
}

/**
 * Rule 8 (third campaign, section 7), what it asks of no search: every place says its emotion, no
 * three alike in a row, and the board after a peak is cleared in a move fewer than the peak at least.
 */
function emotionRhythm(row: readonly Stop[]): Violation[] {
  const out: Violation[] = [];
  let from = 0;
  row.forEach((stop, index) => {
    if (!stop.emotion) out.push({ rule: 8, at: stop.number, text: `${placeOf(stop)} без эмоции` });
    if (index > 0 && stop.emotion !== row[index - 1].emotion) from = index;
    if (stop.emotion && index - from + 1 === 3) out.push({ rule: 8, at: stop.number, text: `места ${row[from].number}–${stop.number} — три доски с эмоцией ${stop.emotion} подряд` });
    const peak = row[index - 1];
    if (peak?.role !== 'peak') return;
    const [top, after] = [peak.spec.par ?? 0, stop.spec.par ?? 0];
    if (after > top - 1) out.push({ rule: 8, at: stop.number, text: `${placeOf(stop)} после пика на месте ${peak.number}: ${after} ходов, а пик — ${top}; после пика легче хотя бы на ход` });
  });
  return out;
}

const ROLE_WORD: Partial<Record<Stop['role'], string>> = { peak: 'пик', twist: 'поворот' };

/** Rule 10: the moves the way of a peak or a twist asks for, the seven left out (it is asked for everywhere unsaid), and the order where the search found a trap. */
function joinedBy(stop: Stop, order: boolean): string[] {
  const needs = [...needsOf(stop.spec)].filter((one) => one !== 'seven');
  if (order) needs.push('order');
  return needs.sort();
}

/**
 * Rule 10, of the moves given: each was brought in (`teaches`) at a place before this one or at this one:
 * a twist that teaches (`roll-in-1`, the glass) counts its own move as brought in (third campaign, section 14).
 */
function taughtBefore(row: readonly Stop[], stop: Stop, needs: readonly string[]): Violation[] {
  const taught = new Set(row.filter((other) => other.number <= stop.number && other.teaches).map((other) => other.teaches as string));
  return needs.filter((one) => !taught.has(one)).map((one) => ({ rule: 10, at: stop.number, text: `${placeOf(stop)}: ${ROLE_WORD[stop.role]} требует ${one}, а его не вводили раньше` }));
}

/**
 * Rule 10 (third campaign, section 13), what it asks of no search: every move the way of a peak or a
 * twist asks for was taught before. That it joins two moves at least is the slow part's, which knows the order.
 */
function joinsTwo(row: readonly Stop[]): Violation[] {
  return row.filter((stop) => ROLE_WORD[stop.role]).flatMap((stop) => taughtBefore(row, stop, joinedBy(stop, false)));
}

/** Rule 11: the windows of the lessons that come a block apart; the climb is a beat of the block of the floor, the seven a lesson of the first layer. */
const BLOCK_HINTS: ReadonlySet<HintKey> = new Set(['roadHintWalk', 'roadHintChain', 'roadHintPush']);
/** Rule 11: the fewest places from one lesson with a window to the next. */
export const LESSON_STEP = 7;

/**
 * Rule 11 (third campaign, section 14, the step of seven): the places with the window of a walk, a chain or
 * a push stand seven places apart at least, and the place with the window of the climb stands one place
 * after the nearest push before it at least. The seven and the move of a link are no part of it.
 */
function lessonsSevenApart(row: readonly Stop[]): Violation[] {
  const out: Violation[] = [];
  const lessons = row.filter((stop) => stop.help.hint !== undefined && BLOCK_HINTS.has(stop.help.hint));
  lessons.forEach((stop, index) => {
    const before = lessons[index - 1];
    if (before && stop.number - before.number < LESSON_STEP) out.push({ rule: 11, at: stop.number, text: `места ${before.number} (${before.spec.id}) и ${stop.number} (${stop.spec.id}): уроки ближе семи мест` });
  });
  for (const stop of row) {
    if (stop.help.hint !== 'roadHintClimb') continue;
    const push = [...row].reverse().find((other) => other.number < stop.number && other.help.hint === 'roadHintPush');
    if (push && stop.number - push.number < 2) out.push({ rule: 11, at: stop.number, text: `${placeOf(stop)}: подъём сразу после толчка на месте ${push.number}` });
  }
  return out;
}

/** Rule 5, its count of moves: the board after a meeting is cleared in at most a move more than the meeting. */
function easyAfterMeeting(row: readonly Stop[]): Violation[] {
  const out: Violation[] = [];
  row.forEach((stop, index) => {
    const next = row[index + 1];
    if (stop.role !== 'meet' || !next) return;
    const [met, after] = [stop.spec.par ?? 0, next.spec.par ?? 0];
    if (after > met + 1) out.push({ rule: 5, at: next.number, text: `${placeOf(next)} после встречи на месте ${stop.number}: ${after} ходов, а встреча — ${met}` });
  });
  return out;
}

/** The rules that ask nothing of a search: 1, 3, 4, the count of moves of 5, 7, the count of moves of 8, the moves taught before of 10, 11, the kept way of 12, and 13. */
export function fastGrammar(row: readonly Stop[]): Violation[] {
  return [
    ...taughtAndUsed(row),
    ...oneThought(row),
    ...facesByWay(row),
    ...easyAfterMeeting(row),
    ...windowTeaches(row),
    ...emotionRhythm(row),
    ...joinsTwo(row),
    ...lessonsSevenApart(row),
    ...nothingBeforeLesson(row),
    ...goalFacesSeen(row),
  ].sort((a, b) => a.at - b.at || a.rule - b.rule);
}

const percent = (share: number): string => `${Math.round(share * 100)}%`;

/**
 * The rules that ask what the walk and the personas found (`facts`): rule 1 for the order, two of the
 * three boards after the place that teaches it are traps of order; rule 2, a board that teaches
 * can be lost and its move is the short way (`SAVES`), past the first three places of the row; and rule 5,
 * the planner does as well after a meeting as on it (but for `PLANNER_SLACK`), and the hardest board of a chapter (the lowest
 * share of the planner, the latest of those alike) stands fourth in it or later. The prologue is
 * held to the first and not to the second: its order is the owner's. And rule 8: the casual persona
 * does as well after a peak as on it. And rule 10: a peak and a twist join two moves at least, the order
 * among them where the search found a trap, and the order was taught before. And rule 12: a board before
 * the lesson of a move the solver can be barred from is cleared without it in its own count.
 */
export function slowGrammar(row: readonly Stop[], facts: (stop: Stop) => SlowFacts): Violation[] {
  const out: Violation[] = [];
  const known = new Map(row.map((stop) => [stop, facts(stop)]));
  row.forEach((stop, index) => {
    if (stop.teaches !== 'order') return;
    const after = row.slice(index + 1, index + 4);
    const broken = after.length > 0 ? usedAfter(stop, after, after.filter((next) => known.get(next)!.order === true).length) : null;
    if (broken) out.push(broken);
  });
  for (const stop of row) {
    const saves = stop.teaches ? SAVES[stop.teaches] : undefined;
    if (saves === undefined || stop.number <= 3) continue;
    const fact = known.get(stop)!;
    if (!fact.lost) out.push({ rule: 2, at: stop.number, text: `${placeOf(stop)} учит ${stop.teaches}, а проиграть на нём нельзя` });
    const saved = fact.without === null || fact.without === undefined ? Infinity : fact.without - (stop.spec.par ?? 0);
    if (saved < saves) {
      const text = saved <= 0 ? 'а без него решение не длиннее' : `а без него решение длиннее только на ${saved} ход`;
      out.push({ rule: 2, at: stop.number, text: `${placeOf(stop)} учит ${stop.teaches}, ${text}` });
    }
  }
  row.forEach((stop, index) => {
    const next = row[index + 1];
    if (stop.role !== 'meet' || !next) return;
    const [met, after] = [known.get(stop)!.planner, known.get(next)!.planner];
    if (after < met - PLANNER_SLACK - 1e-9) out.push({ rule: 5, at: next.number, text: `${placeOf(next)} после встречи на месте ${stop.number}: планирующий ${percent(after)}, а на встрече — ${percent(met)}` });
  });
  row.forEach((peak, index) => {
    const next = row[index + 1];
    if (peak.role !== 'peak' || !next) return;
    const [top, after] = [known.get(peak)!.casual, known.get(next)!.casual];
    if (top === undefined || after === undefined) return;
    if (after < top - 1e-9) out.push({ rule: 8, at: next.number, text: `${placeOf(next)} после пика на месте ${peak.number}: обычный ${percent(after)}, а на пике — ${percent(top)}` });
  });
  for (const stop of row) {
    if (!ROLE_WORD[stop.role]) continue;
    const order = known.get(stop)!.order === true;
    const needs = joinedBy(stop, order);
    // The moves read off the score are the fast part's; the order, found by a search, is said here.
    if (order) out.push(...taughtBefore(row, stop, ['order']));
    if (needs.length < 2) {
      const what = needs.length === 0 ? 'не требует приёмов' : `требует один приём (${needs[0]})`;
      out.push({ rule: 10, at: stop.number, text: `${placeOf(stop)}: ${ROLE_WORD[stop.role]} ${what}, а соединяет не меньше двух` });
    }
  }
  for (const stop of row) {
    const cleared = known.get(stop)!.cleared ?? {};
    const par = stop.spec.par ?? 0;
    for (const one of BARRED) {
      const without = cleared[one];
      if (without === undefined || stop.number >= lessonOf(row, one)) continue;
      if (without === null || without > par) out.push({ rule: 12, at: stop.number, text: `${placeOf(stop)} без ${one} не проходится в ${par} хода, ${lessonText(row, one)}` });
    }
  }
  for (const chapter of new Set(row.map((stop) => stop.chapter))) {
    if (chapter === 0) continue;
    const boards = row.filter((stop) => stop.chapter === chapter);
    let hardest = 0;
    boards.forEach((stop, index) => {
      if (known.get(stop)!.planner <= known.get(boards[hardest])!.planner) hardest = index;
    });
    // A chapter shorter than four (the tail of the first hour, third campaign, section 14) has its hardest board last.
    const short = boards.length < 4;
    if (hardest < (short ? boards.length - 1 : 3)) {
      const stop = boards[hardest];
      out.push({ rule: 5, at: stop.number, text: `самая трудная доска главы ${chapter} — ${placeOf(stop)}, ${hardest + 1}-я в главе, а должна стоять ${short ? 'последней' : 'не раньше 4-й'}` });
    }
  }
  return out.sort((a, b) => a.at - b.at || a.rule - b.rule);
}
