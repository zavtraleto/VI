import { DELTA, DIRS, cellIndex, cubeAt } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { levelDeadEnd, levelStuck } from '../rules/level';
import { moveText, playMove, solveFrom, solveLevel, tellMove, type Outcome, type SolverMove } from '../rules/levelSolver';
import { ALL_ORIENTATIONS } from '../rules/orientation';
import { scan, type Reachable } from '../rules/reach';
import { createRun } from '../rules/sim';
import type { Dir, LevelSpec, Orientation, RunState } from '../rules/types';
import { turns } from './variety';

/**
 * How deep a board is, past the fewest moves it is cleared in: where on its shortest ways a player
 * has to choose the one move that keeps them short, how many ways there are, how soon the board can
 * be lost and how much of it is lost. All of it is read off the graph of the boards a level comes to
 * within a few moves more than its par, walked on the real rules by the moves of the solver.
 */

/** Moves past par the graph is walked to: the ways a little longer than the fewest are ways too. */
export const DEPTH_SLACK = 3;
/** Boards the graph holds before it stops: what it says past that is said of what it saw. */
export const DEPTH_MAX_STATES = 150_000;
/** Shortest ways counted, at most; and different long ways. */
export const WAYS_CAP = 200;
/** Ways no longer than par and the slack, gone through at most. */
export const LONG_PATHS_CAP = 300;
/** Boards the graph cannot settle that are solved to say whether they are lost, at most. */
export const LOSS_SOLVES = 400;
/** Boards one such solve may see before it gives up, and the board is taken not to be lost. */
export const LOSS_SOLVE_STATES = 50_000;

export interface Depth {
  par: number;
  /**
   * Boards on the shortest ways where two moves or more look good and just one of them keeps the way
   * short. A move looks good when it does not lose the board within two moves and is not undone by one.
   */
  forks: number;
  /** Shortest ways, told apart up to moves of other dice made in another order and up to a turn or a mirror of the board. */
  ways: number;
  /** Ways no longer than par and the slack, told apart in the same way. */
  waysLong: number;
  /** Moves past par within which more than half of the long ways are. */
  slack: number;
  /** Fewest moves after which the board can be lost, up to par; null where it cannot be lost so soon. */
  lossAt: number | null;
  /** Share of the boards one to par moves from the start that are lost. */
  lostShare: number;
  /** The graph was walked whole to par and the slack, and its par is the board's. */
  complete: boolean;
  /** There are more shortest ways than are counted. */
  waysCapped: boolean;
  /**
   * The long ways were not all gone through: the walk stopped at `LONG_PATHS_CAP` ways or at its limit of
   * steps, or there were more different long ways than are counted; `waysLong` and `slack` are then of those seen.
   */
  longCapped: boolean;
  /** Boards solved to say whether they are lost were too many, and some of them stand for the rest. */
  lossSampled: boolean;
}

/** How a board of the graph ends, where it does: too few dice for a group, or nothing more to be done. */
type End = 'count' | 'floor';

const startOf = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });

const packMove = (move: SolverMove): number => move.x + move.z * 8 + DIRS.indexOf(move.dir) * 64 + (move.push ? 256 : 0);
const unpackMove = (code: number): SolverMove => ({ x: code % 8, z: (code >> 3) % 8, dir: DIRS[(code >> 6) % 4], push: code >= 256 });

/** Index of an orientation among the twenty-four, by the two faces that fix it. */
const ORIENTATION_INDEX: number[] = [];
ALL_ORIENTATIONS.forEach((o, index) => (ORIENTATION_INDEX[o.top * 8 + o.north] = index));
const indexOfOrientation = (o: Orientation): number => ORIENTATION_INDEX[o.top * 8 + o.north];
/** As the solver names a die: its ticks of sinking and held go into one sign, so many to a tick held. */
const HOLD_STEP = 128;
const FIXED_MARK = ALL_ORIENTATIONS.length;

/**
 * The name of a board as the solver gives it: its dice cell by cell, each with how it lies, how far
 * it has sunk and which group it goes with, groups numbered as they are met, and then every place
 * the player can get to. Two boards with one name go on alike.
 */
function nameOf(state: RunState, places: Uint8Array): string {
  const { size } = state.config;
  const dice = state.cubes.slice().sort((a, b) => cellIndex(size, a.x, a.z) - cellIndex(size, b.x, b.z));
  const codes: number[] = [];
  const labels = new Map<number, number>();
  for (const die of dice) {
    const sinking = die.state === 'sinking';
    let label = 0;
    if (sinking && die.reactionId !== 0) {
      label = labels.get(die.reactionId) ?? labels.size + 1;
      labels.set(die.reactionId, label);
    }
    codes.push(cellIndex(size, die.x, die.z), indexOfOrientation(die.ori) + (die.fixed ? FIXED_MARK : 0), sinking ? 1 + die.t + HOLD_STEP * (die.hold ?? 0) : 0, label);
  }
  for (let i = 0; i < places.length; i += 8) {
    let bits = 0;
    for (let bit = 0; bit < 8 && i + bit < places.length; bit++) bits |= places[i + bit] << bit;
    codes.push(bits);
  }
  return String.fromCharCode(...codes);
}

/** How a board that stands ends, if nothing more can be done on it. */
function endOf(state: RunState, moves: readonly Reachable[]): End | null {
  if (state.over) return levelStuck(state) ? 'count' : 'floor';
  const dead = levelDeadEnd(state);
  if (dead !== null) return dead === 'count' ? 'count' : 'floor';
  return moves.length === 0 ? 'floor' : null;
}

/**
 * The boards a level comes to within so many moves, each named once, and the moves between them.
 * Only the boards of the last move are held as runs: any other is played again from the start.
 */
interface Graph {
  root: RunState;
  /** Fewest moves from the start to every board, the start first. */
  far: number[];
  /** The board each was first come to from, and by which move. */
  parent: number[];
  via: number[];
  end: (End | null)[];
  /** Every move made from a board, and the board it leads to: -1 for a move that clears it. */
  moves: number[][];
  to: number[][];
  /** All the moves of the board were made: the boards it leads to are all known. */
  expanded: boolean[];
  /** Every board by its name. */
  index: Map<string, number>;
  complete: boolean;
}

function graphOf(spec: LevelSpec, depth: number, maxStates: number): Graph {
  const root = startOf(spec);
  const index = new Map<string, number>();
  const g: Graph = { root, far: [], parent: [], via: [], end: [], moves: [], to: [], expanded: [], index, complete: true };
  const add = (state: RunState, found: { places: Uint8Array; moves: Reachable[] }, far: number, parent: number, via: number): number => {
    index.set(nameOf(state, found.places), g.far.length);
    g.far.push(far);
    g.parent.push(parent);
    g.via.push(via);
    g.end.push(endOf(state, found.moves));
    g.moves.push([]);
    g.to.push([]);
    g.expanded.push(false);
    return g.far.length - 1;
  };
  const rootScan = scan(root);
  add(root, rootScan, 0, -1, 0);
  let front = g.end[0] === null ? [{ at: 0, state: root, moves: rootScan.moves }] : [];
  for (let made = 0; made < depth && front.length > 0; made++) {
    const next: typeof front = [];
    for (const node of front) {
      for (const move of node.moves) {
        const after = playMove(node.state, move);
        const code = packMove(move);
        if (after.endReason === 'passed') {
          g.moves[node.at].push(code);
          g.to[node.at].push(-1);
          continue;
        }
        const found = scan(after);
        let to = index.get(nameOf(after, found.places));
        if (to === undefined) {
          if (g.far.length >= maxStates) {
            g.complete = false;
            return g;
          }
          to = add(after, found, made + 1, node.at, code);
          if (g.end[to] === null) next.push({ at: to, state: after, moves: found.moves });
        }
        g.moves[node.at].push(code);
        g.to[node.at].push(to);
      }
      g.expanded[node.at] = true;
    }
    front = next;
  }
  return g;
}

/** The run a board of the graph stands for, played again from the start by the moves that first came to it. */
function stateOf(g: Graph, at: number): RunState {
  const way: number[] = [];
  for (let node = at; g.parent[node] >= 0; node = g.parent[node]) way.push(g.via[node]);
  let state = g.root;
  for (let i = way.length - 1; i >= 0; i--) state = playMove(state, unpackMove(way[i]));
  return state;
}

/** Fewest moves from every board of the graph to the cleared one, the clearing move counted; -1 where the graph shows none. */
function toClearOf(g: Graph, from: number[][]): number[] {
  const n = g.far.length;
  const toClear = new Array<number>(n).fill(-1);
  const queue: number[] = [];
  for (let at = 0; at < n; at++) {
    if (g.to[at].includes(-1)) {
      toClear[at] = 1;
      queue.push(at);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    for (const before of from[at]) {
      if (toClear[before] >= 0) continue;
      toClear[before] = toClear[at] + 1;
      queue.push(before);
    }
  }
  return toClear;
}

/** For every board, the boards with a move that leads to it, once for every such move. */
function fromOf(g: Graph): number[][] {
  const from: number[][] = g.far.map(() => []);
  g.to.forEach((leads, at) => leads.forEach((to) => to >= 0 && from[to].push(at)));
  return from;
}

/**
 * The boards the graph knows to be lost: those that end, and those all of whose moves were made,
 * none of which clears and every one of which leads to a lost board. A board in a ring of boards
 * none of which gets out is not known to be lost by this.
 */
function lostOf(g: Graph, from: number[][]): Uint8Array {
  const n = g.far.length;
  const lost = new Uint8Array(n);
  const left = g.to.map((leads) => leads.filter((to) => to >= 0).length);
  const clears = g.to.map((leads) => leads.includes(-1));
  const queue: number[] = [];
  for (let at = 0; at < n; at++) {
    if (g.end[at] !== null) {
      lost[at] = 1;
      queue.push(at);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    for (const before of from[queue[head]]) {
      if (lost[before] || --left[before] > 0 || !g.expanded[before] || clears[before]) continue;
      lost[before] = 1;
      queue.push(before);
    }
  }
  return lost;
}

/** What the key of a way is reckoned with: the start of the board, its symmetries, and the pairs of moves already asked about. */
interface KeyContext {
  root: RunState;
  size: number;
  symmetries: number[];
  swaps: Map<string, boolean>;
}

const contextOf = (spec: LevelSpec): KeyContext => ({ root: startOf(spec), size: spec.size, symmetries: symmetriesOf(spec), swaps: new Map() });

/** A board and its name, with how the level stands. */
const fullName = (state: RunState): string => nameOf(state, scan(state).places) + (state.endReason ?? '');

const sameOutcome = (a: Outcome, b: Outcome): boolean => a.cleared === b.cleared && a.link === b.link && a.ones === b.ones && String(a.values) === String(b.values);

const canMake = (state: RunState, move: SolverMove): boolean =>
  scan(state).moves.some((m) => m.x === move.x && m.z === move.z && m.dir === move.dir && m.push === move.push);

/**
 * Two moves made one after the other can be made in the other order to the same end: they are made
 * with different dice, either order can be played from the board before them, both orders come to
 * one board, and neither move sets off anything in one order that it does not in the other.
 */
function swaps(ctx: KeyContext, before: RunState, name: string, a: SolverMove, b: SolverMove): boolean {
  const key = `${name}|${packMove(a)},${packMove(b)}`;
  const known = ctx.swaps.get(key);
  if (known !== undefined) return known;
  const answer = ((): boolean => {
    const dieA = cubeAt(before, a.x, a.z);
    if (!dieA || !canMake(before, a)) return false;
    const a1 = tellMove(before, a);
    if (a1.state.over) return false;
    const dieB = cubeAt(a1.state, b.x, b.z);
    if (!dieB || dieB.id === dieA.id || !canMake(a1.state, b)) return false;
    if (cubeAt(before, b.x, b.z)?.id !== dieB.id || !canMake(before, b)) return false;
    const b1 = tellMove(before, b);
    if (b1.state.over || cubeAt(b1.state, a.x, a.z)?.id !== dieA.id || !canMake(b1.state, a)) return false;
    const b2 = tellMove(a1.state, b);
    const a2 = tellMove(b1.state, a);
    return fullName(b2.state) === fullName(a2.state) && sameOutcome(a1.outcome, a2.outcome) && sameOutcome(b2.outcome, b1.outcome);
  })();
  ctx.swaps.set(key, answer);
  return answer;
}

/**
 * The way in steps, as moves made in another order are brought together: the first step is every
 * move that can be brought to the front by swapping it past the moves before it, and every next
 * step is the same from the board after the one before. Within a step the order does not matter.
 */
function stepsOf(ctx: KeyContext, way: readonly SolverMove[]): SolverMove[][] {
  const seq = way.slice();
  const boards: { state: RunState; name: string }[] = [];
  /** The boards before every move of the way from `from` on, played again. */
  const playFrom = (from: number) => {
    boards.length = from;
    let state = from === 0 ? ctx.root : tellMove(boards[from - 1].state, seq[from - 1]).state;
    for (let at = from; at < seq.length; at++) {
      boards.push({ state, name: nameOf(state, scan(state).places) });
      if (at + 1 < seq.length) state = tellMove(state, seq[at]).state;
    }
  };
  playFrom(0);
  const steps: SolverMove[][] = [];
  for (let start = 0; start < seq.length; ) {
    let end = start + 1;
    for (let i = start + 1; i < seq.length; i++) {
      const move = seq[i];
      let free = true;
      for (let j = i; j > start && free; j--) free = swaps(ctx, boards[j - 1].state, boards[j - 1].name, seq[j - 1], move);
      if (!free) continue;
      seq.splice(i, 1);
      seq.splice(end, 0, move);
      end++;
      playFrom(end - 1);
    }
    steps.push(seq.slice(start, end));
    start = end;
  }
  return steps;
}

/** A move as it is on the board turned by the transform given: its cell and its side turned. */
function turnMove(move: SolverMove, turn: (cell: readonly [number, number]) => readonly [number, number]): SolverMove {
  const [x, z] = turn([move.x, move.z]);
  const [tx, tz] = turn([move.x + DELTA[move.dir].dx, move.z + DELTA[move.dir].dz]);
  const dir = DIRS.find((side) => DELTA[side].dx === tx - x && DELTA[side].dz === tz - z) as Dir;
  return { x, z, dir, push: move.push };
}

function keyOf(ctx: KeyContext, way: readonly SolverMove[]): string {
  const steps = stepsOf(ctx, way);
  const all = turns(ctx.size);
  return ctx.symmetries
    .map((t) =>
      steps
        .map((step) =>
          step
            .map((move) => moveText(turnMove(move, all[t])))
            .sort()
            .join(' '),
        )
        .join('|'),
    )
    .sort()[0];
}

/**
 * The key of a way, the same for ways that differ only in the order of moves of different dice that
 * do not touch each other, and for a way and its image on the board turned or mirrored where the
 * board is the same so. The moves of a step are written in order of their writing, the steps with `|`.
 */
export function canonicalWay(spec: LevelSpec, way: readonly SolverMove[]): string {
  return keyOf(contextOf(spec), way);
}

/**
 * The turns and mirrors of the board that leave it as it is, by their places among the eight of
 * `turns`: every die goes to a cell with a die of the same face on top, fixed or not alike, the
 * start goes to itself and the cells cut out to cells cut out. The board itself is always one.
 */
export function symmetriesOf(spec: LevelSpec): number[] {
  const layout = spec.layout;
  if (!layout) return [0];
  const leaving = new Map((layout.leaving ?? []).map(({ die, moves }) => [die, moves]));
  const dieKey = (x: number, z: number, index: number) => `${x},${z},${layout.dice[index].top},${layout.dice[index].fixed ? 1 : 0},${leaving.get(index) ?? 0}`;
  const dice = new Set(layout.dice.map((die, index) => dieKey(die.x, die.z, index)));
  const holes = new Set((spec.holes ?? []).map(({ x, z }) => `${x},${z}`));
  return turns(spec.size).flatMap((turn, t) => {
    const [sx, sz] = turn([layout.start.x, layout.start.z]);
    if (sx !== layout.start.x || sz !== layout.start.z) return [];
    if (!layout.dice.every((die, index) => dice.has(dieKey(...turn([die.x, die.z]), index)))) return [];
    if (![...(spec.holes ?? [])].every(({ x, z }) => holes.has(turn([x, z]).join(',')))) return [];
    return [t];
  });
}

/** Recursions the walk over the long ways may take before it stops: the ways seen by then are counted. */
const LONG_STEPS = 2_000_000;

/**
 * The depth of a board: its graph walked to par and the slack, its shortest and long ways counted,
 * its forks found, and the boards up to par moves from the start told lost or not. `par` is the
 * board's own when left out, or the solver's where it has none. `lossSolves` and `lossStates` bound the boards solved to say whether they are lost (the generator measures many boards, and asks for fewer).
 */
export function depthOf(spec: LevelSpec, opts: { par?: number; maxStates?: number; lossSolves?: number; lossStates?: number } = {}): Depth {
  const par = opts.par ?? spec.par ?? solveLevel(spec).solution?.par;
  if (par === undefined) return { par: 0, forks: 0, ways: 0, waysLong: 0, slack: 0, lossAt: null, lostShare: 0, complete: false, waysCapped: false, longCapped: false, lossSampled: false };
  const g = graphOf(spec, par + DEPTH_SLACK, opts.maxStates ?? DEPTH_MAX_STATES);
  const n = g.far.length;
  const from = fromOf(g);
  const toClear = toClearOf(g, from);
  const shortest = toClear[0];
  const complete = g.complete && shortest === par;
  const ctx: KeyContext = { root: g.root, size: spec.size, symmetries: symmetriesOf(spec), swaps: new Map() };

  // The shortest ways: every move that brings the board a move nearer the cleared one.
  const ways: SolverMove[][] = [];
  let waysCapped = false;
  const path: SolverMove[] = [];
  const walkShort = (at: number): void => {
    for (let e = 0; e < g.to[at].length && !waysCapped; e++) {
      const to = g.to[at][e];
      if (to === -1 ? toClear[at] !== 1 : toClear[to] < 1 || toClear[to] !== toClear[at] - 1) continue;
      path.push(unpackMove(g.moves[at][e]));
      if (to >= 0) walkShort(to);
      else if (ways.length >= WAYS_CAP) waysCapped = true;
      else ways.push(path.slice());
      path.pop();
    }
  };
  if (shortest > 0) walkShort(0);
  const shortKeys = new Set(ways.map((way) => keyOf(ctx, way)));

  // The long ways: no board twice, and no longer than the shortest and the slack.
  const longest = shortest + DEPTH_SLACK;
  const longKeys = new Map<string, number>();
  let longPaths = 0;
  let steps = 0;
  const onPath = new Uint8Array(n);
  const walkLong = (at: number): void => {
    if (++steps > LONG_STEPS) return;
    onPath[at] = 1;
    for (let e = 0; e < g.to[at].length && longPaths < LONG_PATHS_CAP && steps <= LONG_STEPS; e++) {
      const to = g.to[at][e];
      if (to >= 0 && (onPath[to] || toClear[to] < 1 || path.length + 1 + toClear[to] > longest)) continue;
      path.push(unpackMove(g.moves[at][e]));
      if (to >= 0) walkLong(to);
      else if (path.length <= longest) {
        longPaths++;
        const key = keyOf(ctx, path);
        if (!longKeys.has(key)) longKeys.set(key, path.length);
      }
      path.pop();
    }
    onPath[at] = 0;
  };
  if (shortest > 0) walkLong(0);
  const lengths = [...longKeys.values()];
  let slack = 0;
  while (slack < DEPTH_SLACK && lengths.length > 0 && lengths.filter((length) => length <= shortest + slack).length * 2 <= lengths.length) slack++;

  // The boards lost: those the graph knows, and those it cannot settle, solved.
  const lost = lostOf(g, from);
  const near: number[] = [];
  for (let at = 1; at < n && g.far[at] <= par; at++) near.push(at);
  const open = near.filter((at) => toClear[at] < 0 && !lost[at]);
  // A graph cut short by its limit says of loss only what it saw: the boards past it are not solved one by one.
  const stride = Math.ceil(open.length / (opts.lossSolves ?? LOSS_SOLVES));
  const taken = g.complete ? open.filter((_, i) => i % stride === 0) : [];
  let lostTaken = 0;
  let lossAt: number | null = null;
  for (const at of near) if (lost[at]) lossAt = Math.min(lossAt ?? Infinity, g.far[at]);
  // A board with a move to one that can be cleared can be cleared: so the boards are solved the furthest
  // first, and a board solved settles every board of the graph that leads to it, and those its way goes through.
  const clearable = new Uint8Array(n);
  const settle = (from0: number): void => {
    const queue = [from0];
    clearable[from0] = 1;
    for (let head = 0; head < queue.length; head++) {
      for (const before of from[queue[head]]) {
        if (clearable[before]) continue;
        clearable[before] = 1;
        queue.push(before);
      }
    }
  };
  for (let i = taken.length - 1; i >= 0; i--) {
    const at = taken[i];
    if (clearable[at]) continue;
    let state = stateOf(g, at);
    const { solution, exhausted } = solveFrom(state, { maxStates: opts.lossStates ?? LOSS_SOLVE_STATES });
    if (solution) {
      settle(at);
      for (const move of solution.moves.slice(0, -1)) {
        state = playMove(state, move);
        const on = g.index.get(nameOf(state, scan(state).places));
        if (on !== undefined && !clearable[on]) settle(on);
      }
      continue;
    }
    if (!exhausted) continue;
    lostTaken++;
    lossAt = Math.min(lossAt ?? Infinity, g.far[at]);
  }
  const lostKnown = near.filter((at) => lost[at]).length;
  // Where only some of the boards the graph could not settle were solved, they stand for all of them.
  const lostOpen = taken.length > 0 ? (lostTaken * open.length) / taken.length : 0;
  const lostShare = near.length > 0 ? (lostKnown + lostOpen) / near.length : 0;

  // The forks: boards on the shortest ways with two good-looking moves or more and one that keeps the way short.
  // A move looks good when the board after it is not lost within two moves and the move is not simply
  // undone: no one move from the board it leads to comes back. Rolls can be taken back, so on a tight
  // board nearly every move is not lost in two; counted as choices, they made every board of a lone way
  // a fork, and the forks only said the par again (section 3 of the spec: forks are not to repeat par).
  // A move that clears always looks good. Where the board a move leads to was not walked, it is not known
  // to be undone.
  const lostWithin = (at: number, moves: number): boolean =>
    g.end[at] !== null || (moves > 0 && g.expanded[at] && !g.to[at].includes(-1) && g.to[at].every((to) => lostWithin(to, moves - 1)));
  const undone = (at: number, to: number): boolean => g.to[to].includes(at);
  let forks = 0;
  if (shortest > 0) {
    for (let at = 0; at < n; at++) {
      if (toClear[at] < 1 || g.far[at] + toClear[at] !== shortest) continue;
      let keep = 0;
      let good = 0;
      for (const to of g.to[at]) {
        if (to === -1 ? toClear[at] === 1 : toClear[to] >= 1 && toClear[to] === toClear[at] - 1) keep++;
        if (to === -1 || (!lostWithin(to, 2) && !undone(at, to))) good++;
      }
      if (good >= 2 && keep === 1) forks++;
    }
  }

  return {
    par,
    forks,
    ways: shortKeys.size,
    waysLong: Math.min(longKeys.size, WAYS_CAP),
    slack,
    lossAt,
    lostShare,
    complete,
    waysCapped,
    longCapped: longPaths >= LONG_PATHS_CAP || steps > LONG_STEPS || longKeys.size > WAYS_CAP,
    lossSampled: taken.length < open.length,
  };
}
