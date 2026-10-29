import { READER } from '../rules/levelBot';
import { ALL_ORIENTATIONS } from '../rules/orientation';
import { moveOf, moveText, solveLevel, type SolverMove } from '../rules/levelSolver';
import { scoreOf } from '../rules/levelScore';
import type { LevelSpec } from '../rules/types';
import { normalSpec } from './boardFile';
import { depthOf, type Depth } from './depth';
import { firstsOf, hiddenOf, rankOf, rankShares, shareOf, type Shares } from './measures';
import type { Plot, Want } from './plot';
import { difficulty } from './scale';
import { coreKey, coreOf, layoutSim, SAME_LAYOUT, SIMILAR_ROW, similarityOf, type Core } from './signature';

/**
 * The last stage of the generator (docs/superpowers/plans/2026-10-28-vi-level-generator.md, step 4): the slow
 * measures of a board that came through the funnel, read as its passport, held against the gates of its plot
 * (`Want`), and the finalists picked and put in order. The measures are those of the scale of difficulty
 * (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md): the rank, the graph of the board, the hidden
 * faces, the reader, D; and how like the boards of the row it is.
 */

/** A board of the row as the passport holds a new board against it: its code, its core and the board. */
export interface RowBoard {
  code: string;
  number: number;
  spec: LevelSpec;
  core: Core;
}

/** The boards of the row, each with its core read once. */
export function rowBoardsOf(places: readonly { code: string; number: number; spec: LevelSpec }[]): RowBoard[] {
  return places.map(({ code, number, spec }) => ({ code, number, spec, core: coreOf(spec) }));
}

export interface Passport {
  /** The fewest moves, and the way the board is cleared in them. */
  par: number;
  way: string[];
  route: string;
  kind: string;
  dice: number;
  rank: number | null;
  shares: Shares;
  reader: number;
  depth: Depth;
  hidden: number;
  d: number;
  firsts: number;
  sig: string;
  /** The board of the row most like this one, and how like; and the place whose core it repeats (rule 16), if one does. */
  nearest: { code: string; number: number; sim: number } | null;
  sameCore: string | null;
  sameLayout: string | null;
  /** The fewest moves with every fixed die made one that rolls: what the fixed dice cost the player. Null with none fixed. */
  unfixedPar: number | null;
  /** The gates of the plot the board does not hold, each said in a few words. */
  misses: string[];
  /** The longest way round after one mistake, where the lessons counted it (`keepsOf`). */
  longestDetour: number;
}

/**
 * How like a board of the row a new board may not be (spec of the rebuild of 31–100, section 3.6): rule 17 is a warning
 * from `SIMILAR_ROW` (0.75) and there may be up to ten of those on 31–100, but none from 0.85. Rule 16 (the same core or
 * layout) is a gate of its own. A board between the two is written, and its passport says how like it is.
 */
export const TOO_LIKE = 0.85;

/** The bounds of the graph of a finalist: boards walked, boards solved to say whether they are lost, and boards each such solve may see. */
export const DEPTH_STATES = 60_000;
export const LOSS_SOLVES = 60;
export const LOSS_STATES = 8_000;

export interface FinalOptions {
  runs?: number;
  row?: readonly RowBoard[];
  longestDetour?: number;
}

/** The fewest moves of a board with its fixed dice made dice that roll; null where none is fixed or no way is found within the bound. */
function unfixedParOf(spec: LevelSpec, par: number): number | null {
  const dice = spec.layout?.dice ?? [];
  if (!dice.some((die) => die.fixed)) return null;
  const free: LevelSpec = { ...spec, solution: undefined, par: undefined, exact: undefined, layout: { ...spec.layout!, dice: dice.map(({ fixed: _, ...die }) => die) } };
  return solveLevel(free, { maxMoves: par, maxStates: 200_000 }).solution?.par ?? null;
}

/** The gates of a plot a passport does not hold. */
export function missesOf(want: Want | undefined, p: Omit<Passport, 'misses'>): string[] {
  const misses: string[] = [];
  const w = want ?? {};
  if (w.d && (p.d < w.d[0] || p.d > w.d[1])) misses.push(`D ${p.d} not ${w.d[0]}–${w.d[1]}`);
  if (w.rank !== undefined && p.rank !== null && p.rank < w.rank) misses.push(`rank ${p.rank} < ${w.rank}`);
  if (w.forks !== undefined && p.depth.forks < w.forks) misses.push(`forks ${p.depth.forks} < ${w.forks}`);
  if (w.ways !== undefined && p.depth.waysLong < w.ways) misses.push(`ways ${p.depth.waysLong} < ${w.ways}`);
  if (w.hidden && (p.hidden < w.hidden[0] || p.hidden > w.hidden[1])) misses.push(`hidden ${p.hidden} not ${w.hidden[0]}–${w.hidden[1]}`);
  if (w.par && (p.par < w.par[0] || p.par > w.par[1])) misses.push(`par ${p.par} not ${w.par[0]}–${w.par[1]}`);
  if (w.fixedCost !== undefined && (p.unfixedPar === null ? 0 : p.par - p.unfixedPar) < w.fixedCost) misses.push(`fixed cost ${p.unfixedPar === null ? 0 : p.par - p.unfixedPar} < ${w.fixedCost}`);
  if (w.novel !== false) {
    if (p.sameCore) misses.push(`core of ${p.sameCore}`);
    if (p.sameLayout) misses.push(`layout of ${p.sameLayout}`);
    if (p.nearest && p.nearest.sim >= TOO_LIKE) misses.push(`like ${p.nearest.code} ${p.nearest.sim.toFixed(2)}`);
  }
  return misses;
}

/**
 * How like the row a board is: the key of its core, the board of the row most like it, and the boards whose core or
 * layout it repeats (rules 16 and 17). The boards the plot names in `instead` are passed over. Read anew by `rejudge`,
 * where the row it is held against is another.
 */
export function kinOf(plot: Plot | null, spec: LevelSpec, row: readonly RowBoard[]): Pick<Passport, 'sig' | 'nearest' | 'sameCore' | 'sameLayout'> {
  const core = coreOf(spec);
  const key = coreKey(core);
  const skip = new Set(plot?.want?.instead ?? []);
  let nearest: Passport['nearest'] = null;
  let sameCore: string | null = null;
  let sameLayout: string | null = null;
  for (const board of row) {
    if (skip.has(board.code)) continue;
    const layout = layoutSim(spec, board.spec);
    const sim = similarityOf(core, board.core, layout);
    if (!nearest || sim > nearest.sim) nearest = { code: board.code, number: board.number, sim };
    if (!sameCore && coreKey(board.core) === key) sameCore = board.code;
    if (!sameLayout && layout >= SAME_LAYOUT) sameLayout = board.code;
  }
  return { sig: key, nearest, sameCore, sameLayout };
}

/** The passport of a board: every slow measure of it, and the gates of its plot it misses. */
export function passportOf(plot: Plot | null, spec: LevelSpec, opts: FinalOptions = {}): Passport {
  const runs = opts.runs ?? 30;
  const solved = spec.solution ? null : solveLevel(spec);
  const way: SolverMove[] = spec.solution ? spec.solution.map(moveOf) : (solved?.solution?.moves ?? []);
  const par = spec.par ?? way.length;
  const measured: LevelSpec = { ...spec, par, solution: way.map(moveText) };
  const score = scoreOf(measured, way);
  const shares = rankShares(measured, runs);
  const rank = rankOf(shares);
  // The graph bounded: the table of the row may spend minutes on a board, the generator measures forty of them.
  const depth = depthOf(measured, { par, maxStates: DEPTH_STATES, lossSolves: LOSS_SOLVES, lossStates: LOSS_STATES });
  const hidden = hiddenOf(measured, way);
  const d = difficulty({ rank, forks: depth.forks, hidden, lossAt: depth.lossAt, par });
  const { sig: key, nearest, sameCore, sameLayout } = kinOf(plot, measured, opts.row ?? []);
  const passport: Omit<Passport, 'misses'> = {
    par,
    way: way.map(moveText),
    route: score.route,
    kind: score.kind,
    dice: spec.layout?.dice.length ?? 0,
    rank,
    shares,
    reader: shareOf(measured, READER, runs),
    depth,
    hidden,
    d,
    firsts: firstsOf(measured, par),
    sig: key,
    nearest,
    sameCore,
    sameLayout,
    unfixedPar: unfixedParOf(measured, par),
    longestDetour: opts.longestDetour ?? 0,
  };
  return { ...passport, misses: missesOf(plot?.want, passport) };
}

/**
 * The shape of a board: the cells of its dice and the side each shows its goal face on, moved up against the
 * corner (not turned: there is one camera). Five turns of one board say nothing to the owner, so the finalists
 * are taken one to a shape while there are shapes.
 */
export function shapeOf(spec: LevelSpec, sides: readonly string[]): string {
  const dice = spec.layout?.dice ?? [];
  const left = Math.min(...dice.map((die) => die.x));
  const top = Math.min(...dice.map((die) => die.z));
  return dice
    .map((die, index) => `${die.x - left}.${die.z - top}${sides[index] ?? ''}`)
    .sort()
    .join(' ');
}

/** The side each die shows the face it goes with on at the start, as the player sees it; the dice in the order of the layout. */
export function sidesOf(spec: LevelSpec, faces: readonly number[]): string[] {
  return (spec.layout?.dice ?? []).map((die, index) => {
    const ori = ALL_ORIENTATIONS.find((o) => o.top === die.top && o.north === die.north);
    const face = faces[index];
    if (!ori || face === undefined) return '';
    if (ori.top === face) return 'top';
    if (ori.south === face) return 'south';
    if (ori.east === face) return 'east';
    if (ori.north === face) return 'north';
    if (ori.west === face) return 'west';
    return 'under';
  });
}

/** A board that came through the lesson stage, with what is known of it so far. */
export interface Passed {
  spec: LevelSpec;
  shape: string;
  /** Its order in the run, mixed by the seed: within a shape, the first come is the first taken. */
  order: number;
}

/** The finalists: one to a shape first, then the rest, up to `final`; within a shape by their order. */
export function pickFinalists<T extends Passed>(passed: readonly T[], final: number): T[] {
  const byShape = new Map<string, T[]>();
  for (const one of [...passed].sort((a, b) => a.order - b.order)) {
    const list = byShape.get(one.shape) ?? [];
    list.push(one);
    byShape.set(one.shape, list);
  }
  const picked: T[] = [];
  for (let round = 0; picked.length < final; round++) {
    let any = false;
    for (const list of byShape.values()) {
      if (round < list.length) {
        any = true;
        picked.push(list[round]);
        if (picked.length >= final) break;
      }
    }
    if (!any) break;
  }
  return picked;
}

/** A way round after one mistake longer than this sends a board to the end of the line, marked (spec, section 6.1). */
export const DETOUR_MARK = 6;

/**
 * The order the finalists are given in: fewer gates missed first; then a way round after a mistake no longer than
 * `DETOUR_MARK`; then D nearer the middle of the plot's band; then more long ways; then a shorter way round.
 */
export function rankPassports<T extends { passport: Passport }>(finalists: readonly T[], want: Want | undefined, liked: readonly Passport[] = []): T[] {
  const middle = want?.d ? (want.d[0] + want.d[1]) / 2 : null;
  const near = new Map(finalists.map((one) => [one, likeDistance(one.passport, liked)]));
  return [...finalists].sort((a, b) => {
    const pa = a.passport;
    const pb = b.passport;
    return (
      pa.misses.length - pb.misses.length ||
      near.get(a)! - near.get(b)! ||
      Number(pa.longestDetour > DETOUR_MARK) - Number(pb.longestDetour > DETOUR_MARK) ||
      (middle === null ? 0 : Math.abs(pa.d - middle) - Math.abs(pb.d - middle)) ||
      pb.depth.waysLong - pa.depth.waysLong ||
      pa.longestDetour - pb.longestDetour
    );
  });
}

/**
 * How far a passport is from the nearest of the boards the owner called good (spec, section 8.2): the measures of the
 * passport, each brought to one scale, and the plain distance between them. A comparison, not a model: there are a
 * handful of marks. Zero where none is called good yet, so that the marks change nothing until there are some.
 */
export function likeDistance(p: Passport, liked: readonly Passport[]): number {
  if (liked.length === 0) return 0;
  const point = (q: Passport) => [q.par / 10, q.d / 10, q.depth.forks / 10, q.hidden / 5, q.dice / 10, q.depth.waysLong / 20];
  const at = point(p);
  return Math.min(...liked.map((one) => Math.hypot(...point(one).map((value, i) => value - at[i]))));
}

/** A board of a batch as the next round reads it: its name, its status, and its number in the batch. */
export interface Marked {
  name: string;
  status: string;
  number: number;
}

/**
 * Whether the batch of a plot is to stop and the owner be asked about the plot itself (spec, decision 14; the
 * workshop reads «мимо» as «убрать», X): the last two boards of the batch he marked were both taken off.
 */
export function twoOff(boards: readonly Marked[]): boolean {
  const marked = boards.filter((board) => board.status !== 'N').sort((a, b) => a.number - b.number);
  return marked.length >= 2 && marked.slice(-2).every((board) => board.status === 'X');
}

/** The key a board is known by in one run, so that no board is laid twice. */
export function boardKey(spec: LevelSpec): string {
  return JSON.stringify(normalSpec({ ...spec, id: '', seed: 0, solution: undefined, par: undefined, exact: undefined }));
}

/** The passport as one line of text, for the report and the command `passport`. */
export function passportLine(name: string, p: Passport): string {
  const shares = (['hasty', 'casual', 'careful', 'planner', 'deep'] as const)
    .filter((persona) => p.shares[persona] !== undefined)
    .map((persona) => `${persona[0]}${Math.round((p.shares[persona] ?? 0) * 100)}`)
    .join(' ');
  return [
    name,
    `D ${p.d}`,
    `rank ${p.rank ?? '>8'}`,
    `par ${p.par}`,
    `dice ${p.dice}`,
    `forks ${p.depth.forks}`,
    `ways ${p.depth.ways}/${p.depth.waysLong}`,
    `loss ${p.depth.lossAt ?? '-'}`,
    `hid ${p.hidden}`,
    `reader ${Math.round(p.reader * 100)}%`,
    `[${shares}]`,
    `route ${p.route}`,
    p.nearest ? `near ${p.nearest.code}(${p.nearest.number}) ${p.nearest.sim.toFixed(2)}${p.nearest.sim >= SIMILAR_ROW ? ' (rule 17)' : ''}` : 'near -',
    p.unfixedPar === null ? '' : `unfixed ${p.unfixedPar}`,
    p.longestDetour > DETOUR_MARK ? `обход ${p.longestDetour}` : '',
    p.misses.length ? `misses: ${p.misses.join('; ')}` : 'holds',
  ]
    .filter(Boolean)
    .join('  ');
}
