import { defaultConfig } from '../rules/config';
import { levelConfig } from '../rules/level';
import { moveText, solveLevel, type SolverMove } from '../rules/levelSolver';
import { scoreOf } from '../rules/levelScore';
import { ALL_ORIENTATIONS } from '../rules/orientation';
import { createRun } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import type { LevelSpec, Technique } from '../rules/types';
import { layKey, type Laid } from './layBack';
import { baitOf, keepsOf, safeFirstOf, type Bait, type Keeps } from './measures';
import { readWay, type Lesson, type Plot } from './plot';

/**
 * The judge of a laid board (docs/superpowers/specs/2026-10-14-vi-level-generator-design.md,
 * section 5; the plan docs/superpowers/plans/2026-10-28-vi-level-generator.md, step 3): stages
 * from the cheap to the dear, the first check a board does not hold being the reason it is
 * dropped. 0, the layout: nothing ready, no 1 up but where the plot has the 1s, the rules take
 * it, it has not been seen, the faces hidden as the plot wants. 1, the way: the shortest way is
 * the one laid, as long, with the same events made by the same dice. 2, the lesson.
 */

/** How far a judge goes: the layout, the way, the lesson. */
export type Upto = 'laid' | 'path' | 'lesson';
const STAGES: Record<Upto, number> = { laid: 0, path: 1, lesson: 2 };

/** What a lesson came to. */
export type LessonValue =
  | { kind: 'safeFirst'; ok: boolean }
  | ({ kind: 'keeps'; ok: boolean } & Keeps)
  | ({ kind: 'bait'; ok: boolean } & Bait);

export interface Judged {
  /** The stages the board held: the number of the stage it was dropped at, or of the stages asked where it held them all (3 up to the lesson). */
  stage: number;
  /** The check it did not hold, a short key to count by; null where it held every stage asked. */
  reason: string | null;
  detail: string;
  /** The shortest way the solver found, as a file keeps it. */
  way?: string[];
  par?: number;
  uses?: Technique[];
  lessons?: LessonValue[];
}

const SIDES = ['top', 'south', 'east'] as const;

export function judgeLaid(plot: Plot, laid: Laid, opts: { states?: number; seen?: Set<string>; upto?: Upto } = {}): Judged {
  const { spec } = laid;
  const upto = STAGES[opts.upto ?? 'lesson'];
  const layout = spec.layout!;
  const fail = (stage: number, reason: string, detail: string, more: Partial<Judged> = {}): Judged => ({ stage, reason, detail, ...more });

  // 0. The layout.
  const tops = new Array<number>(spec.size * spec.size).fill(0);
  for (const die of layout.dice) tops[die.z * spec.size + die.x] = die.top;
  if (hasReadyGroup(tops, spec.size)) return fail(0, 'ready', 'a group is ready at the start');
  const ones = layout.dice.findIndex((die, i) => die.top === 1 && plot.events[plot.dice[i].event].kind !== 'ones');
  if (ones >= 0) return fail(0, 'one', `${plot.dice[ones].name} shows a 1 and goes with no 1s`);
  try {
    levelConfig(defaultConfig(), spec);
    createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
  } catch (error) {
    return fail(0, 'rules', (error as Error).message);
  }
  if (opts.seen) {
    const key = layKey(spec);
    if (opts.seen.has(key)) return fail(0, 'repeat', 'laid before');
    opts.seen.add(key);
  }
  const hidden = plot.want?.hidden;
  if (hidden) {
    const count = layout.dice.filter((die, i) => {
      if (die.fixed) return false;
      const lie = ALL_ORIENTATIONS.find((one) => one.top === die.top && one.north === die.north)!;
      return !SIDES.some((side) => lie[side] === plot.dice[i].face);
    }).length;
    if (count < hidden[0] || count > hidden[1]) return fail(0, 'hidden', `${count} faces hidden, not ${hidden[0]}-${hidden[1]}`);
  }
  if (upto < 1) return { stage: 1, reason: null, detail: '' };

  // 1. The way.
  const solved = solveLevel(spec, { maxMoves: laid.length, maxStates: opts.states ?? 20_000 });
  const solution = solved.solution;
  if (!solution) return solved.exhausted ? fail(1, 'longer', `no way in ${laid.length} moves`) : fail(1, 'gaveUp', `the solver gave up after ${solved.states} boards`);
  const way = solution.moves.map(moveText);
  const found = { way, par: solution.par, uses: solution.uses };
  const read = readWay(spec, solution.moves);
  if (solution.par < laid.length) {
    const made = plot.dice.map((_, i) => read.beats.filter((beat, at) => beat.die === i && (read.leftOn[i] < 0 || at <= read.leftOn[i])).length);
    const fewer = plot.dice.flatMap((die, i) => (made[i] < laid.moves[i] ? [`${die.name} ${made[i]}<${laid.moves[i]}`] : []));
    return fail(1, 'shorter', `${solution.par} moves, not ${laid.length}${fewer.length > 0 ? `: ${fewer.join(', ')}` : ''}`, found);
  }
  const wrong = eventsMiss(plot, read);
  if (wrong) return fail(1, 'events', wrong, found);
  const lacks = (plot.needs ?? []).filter((one) => !solution.uses.includes(one));
  if (lacks.length > 0) return fail(1, 'needs', `the way does without ${lacks.join(', ')}`, found);
  const leans = (plot.avoid ?? []).filter((one) => solution.uses.includes(one));
  if (leans.length > 0) return fail(1, 'avoid', `the way leans on ${leans.join(', ')}`, found);
  if (plot.route !== undefined) {
    const route = scoreOf(spec, solution.moves).route;
    if (route !== plot.route) return fail(1, 'route', `the way goes ${route}, not ${plot.route}`, found);
  }
  if (upto < 2) return { stage: 2, reason: null, detail: '', ...found };

  // 2. The lesson.
  const lessons: LessonValue[] = [];
  for (const lesson of plot.lessons ?? [{ kind: 'safeFirst' }]) {
    const value = lessonOf(spec, solution.moves, lesson);
    lessons.push(value);
    if (!value.ok) return fail(2, lesson.kind, lessonText(value), { ...found, lessons });
  }
  // The fixed dice are to stand in the way: with dice that roll in their place, the board is cleared this much sooner.
  const cost = plot.want?.fixedCost;
  if (cost !== undefined && cost > 0) {
    const free: LevelSpec = { ...spec, layout: { ...layout, dice: layout.dice.map(({ fixed: _, ...die }) => die) } };
    if (solveLevel(free, { maxMoves: solution.par - cost, maxStates: opts.states ?? 20_000 }).solution === null) {
      return fail(2, 'fixedCost', `with dice that roll in place of the fixed ones it is no ${cost} moves shorter`, { ...found, lessons });
    }
  }
  return { stage: 3, reason: null, detail: '', ...found, lessons };
}

/** What a way does not do of the plot's events: their kinds, the dice that make them, the dice that go with each, the spare of a link. Null where it does it all. */
function eventsMiss(plot: Plot, read: ReturnType<typeof readWay>): string | null {
  const events = read.beats.flatMap((beat, at) => (beat.event === 'none' ? [] : [{ ...beat, at }]));
  if (events.length !== plot.events.length) return `${events.length} events, not ${plot.events.length}`;
  for (let e = 0; e < events.length; e++) {
    const want = plot.events[e];
    const got = events[e];
    if (got.event !== want.kind) return `event ${e} is a ${got.event}, not a ${want.kind}`;
    const by = plot.dice[got.die].name;
    if (by !== want.by) return `event ${e} is made by ${by}, not ${want.by}`;
    if (want.spare !== undefined && got.spare !== want.spare) return `event ${e} spares ${got.spare}, not ${want.spare}`;
  }
  for (let i = 0; i < plot.dice.length; i++) {
    const die = plot.dice[i];
    const on = read.leftOn[i];
    if (on !== events[die.event].at) return `${die.name} goes ${on < 0 ? 'never' : `on move ${on + 1}`}, not with event ${die.event}`;
    if (read.leftAs[i] !== die.face) return `${die.name} goes as a ${read.leftAs[i]}, not a ${die.face}`;
  }
  return null;
}

function lessonOf(spec: LevelSpec, way: readonly SolverMove[], lesson: Lesson): LessonValue {
  if (lesson.kind === 'safeFirst') return { kind: 'safeFirst', ok: safeFirstOf(spec) };
  if (lesson.kind === 'keeps') {
    const keeps = keepsOf(spec, way, lesson.after, lesson.slack ?? 0);
    return { kind: 'keeps', ok: keeps.keeps >= lesson.moves[0] && keeps.keeps <= lesson.moves[1], ...keeps };
  }
  const bait = baitOf(spec, way, lesson.at, lesson.move, lesson.fate, lesson.over ?? 1);
  const deep = !lesson.depth || (bait.depth !== null && bait.depth >= lesson.depth[0] && bait.depth <= lesson.depth[1]);
  return { kind: 'bait', ok: bait.bait && deep, ...bait };
}

function lessonText(value: LessonValue): string {
  if (value.kind === 'safeFirst') return 'a first move loses the board';
  if (value.kind === 'keeps') return `keeps ${value.keeps} (dead ${value.dead}, later ${value.deadLater}, detour ${value.detour} up to ${value.longestDetour})`;
  return value.bait ? `bait ${value.moves.join(' ')} is ${value.depth} deep` : 'no bait';
}
