import { defaultConfig } from '../rules/config';
import { humanFacts, HUMANS, type HumanFacts } from '../rules/humanBot';
import { scoreOf } from '../rules/levelScore';
import { moveOf, playMove, solveFrom, solveLevel, tellMove, type SolverMove } from '../rules/levelSolver';
import { scan } from '../rules/reach';
import { createRun } from '../rules/sim';
import type { LevelSpec, RunState } from '../rules/types';
import { hiddenOf, safeFirstOf } from './measures';

/**
 * The passport of the kind of a board and its troubles (docs/superpowers/specs/2026-11-04-vi-level-craft-design.md,
 * sections 1, 2 and 4, step 4): what its way asks of a player move by move, how two people of `humanBot.ts` play it,
 * and which of the troubles the owner named in his playtests it has. These describe a board; they are no score of it:
 * the owner said a board that held every sign could be «довольно отвратительным» (docs/VI_Puzzle_Principles.md, 3).
 */

/** What the way of a board asks of a player. */
export interface CraftFacts {
  /**
   * Moves of the way against what looks like progress: a move that sets nothing off where another move would, or a
   * step down to the floor from the dice. People leave a plan at such a «back to go forward» move (Sokoban: the count
   * of these went with the time people took at 0.69).
   */
  counter: number;
  /** Share of the moves of the way where two moves or more still clear the board within par and one: a choice. */
  choice: number;
  /** Moves of the way where one move only keeps the board within par and one, out of three or more: a narrow step. */
  narrow: number;
  /** Share of the dice that go with the last group set off: a domino, a big end. */
  lastShare: number;
  /** The route of the way with its repeats run together, faces and lengths left out (`K ~ L v ^ L` → `K ~ L v ^ L`, `K K L` → `K L`). */
  motif: string;
}

/** What a choice may cost: a move is still a good one if the board is cleared within par and this. */
const CHOICE_SLACK = 1;
/** Boards the solver may see to say whether a move still keeps the board within par and the slack. */
const CHOICE_STATES = 20_000;

const startOf = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });
const standing = (state: RunState): number => state.cubes.filter((cube) => cube.state !== 'sinking').length;
const sameMove = (a: SolverMove, b: SolverMove): boolean => a.x === b.x && a.z === b.z && a.dir === b.dir && Boolean(a.push) === Boolean(b.push);
const setsOff = (state: RunState, move: SolverMove): boolean => {
  const { outcome } = tellMove(state, move);
  return outcome.cleared || outcome.link || outcome.ones;
};

/** The route with its repeats run together: what the way does, not how long. */
export function motifOf(route: string): string {
  const out: string[] = [];
  for (const sign of route.split(/\s+/).filter(Boolean)) if (out[out.length - 1] !== sign) out.push(sign);
  return out.join(' ');
}

/** What the way of a board asks of a player, move by move, on the real rules. */
export function craftOf(spec: LevelSpec, way: readonly SolverMove[], opts: { states?: number } = {}): CraftFacts {
  const par = way.length;
  const dice = spec.layout?.dice.length ?? 0;
  let state = startOf(spec);
  let counter = 0;
  let choices = 0;
  let narrow = 0;
  let lastBefore = 0;
  for (let at = 0; at < way.length; at++) {
    const move = way[at];
    const moves = scan(state).moves;
    const own = moves.find((one) => sameMove(one, move));
    const offered = moves.filter((one) => !sameMove(one, move));
    if ((!setsOff(state, move) && offered.some((one) => setsOff(state, one))) || (own?.floor && state.player.level === 'top' && !move.push)) counter++;
    const left = par - at - 1 + CHOICE_SLACK;
    const good = moves.filter((one) => {
      const next = playMove(state, one);
      if (next.endReason === 'passed') return true;
      if (next.over || left <= 0) return false;
      return solveFrom(next, { maxMoves: left, maxStates: opts.states ?? CHOICE_STATES }).solution !== null;
    }).length;
    if (good >= 2) choices++;
    if (good === 1 && moves.length >= 3) narrow++;
    const before = standing(state);
    state = playMove(state, move);
    if (standing(state) < before) lastBefore = before;
  }
  return {
    counter,
    choice: par > 0 ? choices / par : 0,
    narrow,
    lastShare: dice > 0 ? lastBefore / dice : 0,
    motif: motifOf(scoreOf(spec, way).route),
  };
}

/** How two people of `humanBot.ts` play a board, one person a seed. */
export interface People {
  newcomer: HumanFacts;
  owner: HumanFacts;
}

export function peopleOf(spec: LevelSpec, people = 20): People {
  return { newcomer: humanFacts(spec, HUMANS.newcomer, people), owner: humanFacts(spec, HUMANS.owner, people) };
}

/** What the troubles are read off. */
export interface TroubleFacts {
  par: number;
  hidden: number;
  safeFirst: boolean;
  craft: CraftFacts;
  people: People;
}

/**
 * The troubles of the owner's playtests (the spec, section 2) a board has, each in his word: a warning of the passport,
 * never a gate by itself. Only those that held against his marks of places 31-60 (row 0.2.93, the spec, section 4, «Паспорт
 * вида»): the rest he named (it leads by itself, rolling round and round, a stupor) were tried and fell on the boards he
 * liked, and stay numbers of the passport, not troubles.
 *
 * - «видно сразу»: the new player clears it on the first try nine times in ten, nothing on the way goes against what looks
 *   like progress, and the way has one narrow step at most (43: «как проходить видно сразу… тухляк»; 36: «совсем простой»);
 * - «облом первым ходом»: a first move loses the board (17, 19: «обидно такое, хочется бросить»).
 */
export function troublesOf(facts: TroubleFacts): string[] {
  const { craft, people } = facts;
  const out: string[] = [];
  if (people.newcomer.first >= 0.9 && craft.counter === 0 && craft.narrow <= 1) out.push('видно сразу');
  if (!facts.safeFirst) out.push('облом первым ходом');
  return out;
}

/**
 * What the table of the row keeps of a board beside its slow measures, in a cache of its own (`boards/.craft/<key>.json`,
 * scripts/measureCache.mjs): the way move by move, the two people, and what the troubles read. JSON values only.
 */
export interface CraftMeasures {
  par: number;
  hidden: number;
  safeFirst: boolean;
  craft: CraftFacts;
  people: People;
}

/** The craft measures of a board, on its own way or the solver's. */
export function craftMeasuresOf(spec: LevelSpec, people = 20): CraftMeasures {
  const way = spec.solution ? spec.solution.map(moveOf) : (solveLevel(spec).solution?.moves ?? []);
  const measured: LevelSpec = { ...spec, par: spec.par ?? way.length };
  return {
    par: measured.par ?? way.length,
    hidden: hiddenOf(measured, way),
    safeFirst: safeFirstOf(measured),
    craft: craftOf(measured, way),
    people: peopleOf(measured, people),
  };
}
