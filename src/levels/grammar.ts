import { scoreOf } from '../rules/levelScore';
import { moveOf } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import type { Stop } from './campaign';
import type { Technique } from './row';
import { ROW } from './row.gen';
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
  rule: 1 | 2 | 3 | 4 | 5;
  at: number;
  text: string;
}

/** What the walk and the personas found of a board, for the slow rules. */
export interface SlowFacts {
  /** The walk over the boards the player can come to found one from which the board cannot be cleared. */
  lost: boolean;
  /** The share of the runs of the planning persona that clear the board. */
  planner: number;
  /**
   * For a board that teaches a move the solver can be barred from: the fewest moves it is cleared in
   * without that move, looked for up to two over its own; null where it is not cleared so.
   */
  without?: number | null;
  /** How many moves a push saves on the board: 0 where it is cleared in its fewest moves without one. */
  pushSaves?: number;
}

/**
 * Rule 2, how many moves the move taught has to save (уточнено 14 октября по шагу 1): the walk over
 * leaving dice one, as the meeting of the walk (`R11`) is laid in the spec; every other move two.
 * A move the solver cannot be barred from (two faces, the seven, time) is not held to rule 2 at all.
 */
export const SAVES: Partial<Record<Technique, number>> = { walk: 1, link: 2, glass: 2, lift: 2, push: 2, ones: 2 };

/** Rule 5: the planner after a meeting may clear its board this much less often than on the meeting, two runs of thirty (уточнено 14 октября по шагу 1). */
export const PLANNER_SLACK = 2 / 30;

/**
 * The moves a board asks for, read off the score of the way it keeps (`scoreOf`): a link (`L`, `Q`),
 * a walk over a leaving die (`~`), a way down or up (`v`, `!`, `^`), a roll onto a leaving die
 * (`glass`), a push (`P`, `Q`, `U`), the 1s (`O`, `U`); two faces where combos of two faces go.
 */
export function needsOf(spec: LevelSpec): ReadonlySet<Technique> {
  const needs = new Set<Technique>();
  const { beats, route } = scoreOf(spec, (spec.solution ?? []).map(moveOf));
  const signs = route.split(' ');
  if (signs.some((sign) => sign === 'L' || sign === 'Q')) needs.add('link');
  if (signs.includes('~')) needs.add('walk');
  if (signs.some((sign) => sign === 'v' || sign === '!' || sign === '^')) needs.add('lift');
  if (beats.some((beat) => beat.how === 'glass')) needs.add('glass');
  if (signs.some((sign) => sign === 'P' || sign === 'Q' || sign === 'U')) needs.add('push');
  if (signs.some((sign) => sign === 'O' || sign === 'U')) needs.add('ones');
  if (new Set(beats.filter((beat) => beat.event === 'combo').map((beat) => beat.face)).size > 1) needs.add('twoFaces');
  return needs;
}

const placeOf = (stop: Stop): string => `место ${stop.number} (${stop.spec.id})`;

/**
 * Rule 1: a move taught at N is asked for by at least two of N+1…N+3, and the next board that teaches
 * is not before N+2, but where the board at N already asked for the move that board brings in.
 */
function taughtAndUsed(row: readonly Stop[]): Violation[] {
  const out: Violation[] = [];
  row.forEach((stop, index) => {
    if (!stop.teaches) return;
    const after = row.slice(index + 1, index + 4);
    if (after.length > 0) {
      const using = after.filter((next) => needsOf(next.spec).has(stop.teaches!)).length;
      if (using < Math.min(2, after.length)) {
        const span = after.length === 1 ? `места ${after[0].number}` : `мест ${after[0].number}–${after[after.length - 1].number}`;
        out.push({ rule: 1, at: stop.number, text: `${placeOf(stop)} учит ${stop.teaches}, а из ${span} его требует ${using} досок` });
      }
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

/** Rule 4: a board of a chapter with faces works on the faces of its chapter; the prologue (`faces: null`) has its own. */
function facesOfChapter(row: readonly Stop[]): Violation[] {
  const out: Violation[] = [];
  for (const stop of row) {
    const faces = ROW.chapters[stop.chapter]?.faces;
    if (!faces) continue;
    const own = stop.spec.faces ?? [];
    if (String(own) !== String(faces)) out.push({ rule: 4, at: stop.number, text: `${placeOf(stop)} на гранях ${own.join(' ')}, а глава ${stop.chapter} — на гранях ${faces.join(' ')}` });
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

/** The places of the row before the first meeting of the push: all of it where there is none. */
function beforePush(row: readonly Stop[]): readonly Stop[] {
  const lesson = row.findIndex((stop) => stop.teaches === 'push');
  return lesson < 0 ? row : row.slice(0, lesson);
}

/**
 * Rule 1, the push (the owner, 14 October 2026: «главное, что у нас нет полей, которые решаются
 * толканием»): no board before the meeting of the push keeps a way that pushes.
 */
function noPushBeforeLesson(row: readonly Stop[]): Violation[] {
  return beforePush(row)
    .filter((stop) => needsOf(stop.spec).has('push'))
    .map((stop) => ({ rule: 1 as const, at: stop.number, text: `${placeOf(stop)} толкает, а толкать ещё не учили` }));
}

/** The rules that ask nothing of a search: 1, 3, 4 and the count of moves of 5. */
export function fastGrammar(row: readonly Stop[]): Violation[] {
  return [...taughtAndUsed(row), ...noPushBeforeLesson(row), ...oneThought(row), ...facesOfChapter(row), ...easyAfterMeeting(row)].sort((a, b) => a.at - b.at || a.rule - b.rule);
}

const percent = (share: number): string => `${Math.round(share * 100)}%`;

/**
 * The rules that ask what the walk and the personas found (`facts`): rule 2, a board that teaches
 * can be lost and its move is the short way (`SAVES`), past the first three places of the row; and rule 5,
 * the planner does as well after a meeting as on it (but for `PLANNER_SLACK`), and the hardest board of a chapter (the lowest
 * share of the planner, the latest of those alike) stands fourth in it or later. The prologue is
 * held to the first and not to the second: its order is the owner's.
 */
export function slowGrammar(row: readonly Stop[], facts: (stop: Stop) => SlowFacts): Violation[] {
  const out: Violation[] = [];
  const known = new Map(row.map((stop) => [stop, facts(stop)]));
  for (const stop of beforePush(row)) {
    const saves = known.get(stop)!.pushSaves ?? 0;
    if (saves > 0) out.push({ rule: 1, at: stop.number, text: `${placeOf(stop)} толчком короче на ${saves} ${saves === 1 ? 'ход' : 'хода'}, а толкать ещё не учили` });
  }
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
  for (const chapter of new Set(row.map((stop) => stop.chapter))) {
    if (chapter === 0) continue;
    const boards = row.filter((stop) => stop.chapter === chapter);
    let hardest = 0;
    boards.forEach((stop, index) => {
      if (known.get(stop)!.planner <= known.get(boards[hardest])!.planner) hardest = index;
    });
    if (hardest < 3) {
      const stop = boards[hardest];
      out.push({ rule: 5, at: stop.number, text: `самая трудная доска главы ${chapter} — ${placeOf(stop)}, ${hardest + 1}-я в главе, а должна стоять не раньше 4-й` });
    }
  }
  return out.sort((a, b) => a.at - b.at || a.rule - b.rule);
}
