import { DELTA, DIRS, cellIndex, cubeAt } from './board';
import { defaultConfig } from './config';
import { floorLost, levelStuck, worldRuns } from './level';
import { ALL_ORIENTATIONS } from './orientation';
import { scan, type Ban } from './reach';
import { createRun, step } from './sim';
import type { Cube, Dir, LevelSpec, Orientation, Reaction, RulesConfig, RunState, Technique } from './types';

/**
 * A solver of levels: it finds the fewest moves a board is cleared in, and one way to do it.
 *
 * It has no model of a move of its own. A move is made with the rules themselves: the player is
 * put where the move is made from, the command is given, and the run is stepped until the world
 * stands again. What the solver adds is the search: which boards have been seen, and in what
 * order the moves are tried.
 *
 * A node of the search is a run between two beats: the world stands and the player is free.
 * Steps from die to die move no die and take no time, so the player of a node is not at a cell
 * but at every cell those steps lead to, and a move is any roll or push that can be made from
 * one of them.
 */
export interface SolverMove {
  /** Cell of the die before the move, and the side it goes to. */
  x: number;
  z: number;
  dir: Dir;
  /** Pushed from the floor, not rolled from on top. */
  push: boolean;
}

export interface Solution {
  par: number;
  moves: SolverMove[];
  /** Longest run of moves from one group made to the next, the move that makes it counted. */
  depth: number;
  uses: Technique[];
}

export interface SolveOptions {
  /** Boards the search may see before it gives up. */
  maxStates?: number;
  /** Moves a way may take. */
  maxMoves?: number;
  /** What a way must do without. */
  ban?: readonly Ban[];
  /** The first move is made with the die the player starts on (`own`), or with any other (`other`). */
  first?: 'own' | 'other';
  /** The config the board is played on; the game's own when left out. */
  config?: RulesConfig;
}

export interface Solved {
  solution: Solution | null;
  /** The search saw every state within its bounds. */
  exhausted: boolean;
  states: number;
}

/** Boards a search sees before it gives up, unless told otherwise. */
export const SOLVER_MAX_STATES = 3_000_000;

const TECHNIQUES: readonly Technique[] = ['link', 'glass', 'floor', 'ones'];

/** Every roll and push the player can get to by free steps, from where the run stands. */
export function movesAt(state: RunState, ban?: readonly Ban[]): SolverMove[] {
  return scan(state, ban).moves.map(({ x, z, dir, push }) => ({ x, z, dir, push }));
}

/** A copy of a run that shares nothing a step writes to. */
function copyRun(state: RunState): RunState {
  const { player, levelRun, stats } = state;
  return {
    ...state,
    cubes: state.cubes.map((cube) => ({ ...cube, move: cube.move ? { ...cube.move } : undefined })),
    grid: state.grid.slice(),
    reactions: state.reactions.map((reaction) => ({ ...reaction })),
    pending: state.pending.map((spawn) => ({ ...spawn })),
    player: { ...player, action: player.action ? { ...player.action } : undefined },
    levelRun: levelRun ? { ...levelRun, sent: levelRun.sent.slice() } : null,
    feedDeck: state.feedDeck.slice(),
    helpDeck: state.helpDeck.slice(),
    wave: { ...state.wave },
    stats: { ...stats, clearTicks: stats.clearTicks.slice(), levels: stats.levels.map((entry) => ({ ...entry })) },
    events: [],
  };
}

/** What a move set off, read from the events of its beat. */
export interface Outcome {
  /** A group was made, a die joined one, or the 1s went. */
  cleared: boolean;
  link: boolean;
  ones: boolean;
  /** Faces of what went: of a group and of a die that joined one, and 1 for the 1s. */
  values: number[];
}

/** Ticks a move may take before the solver calls the run stuck: a beat is a handful. */
const BEAT_GUARD = 10_000;

/** Makes a move on the run itself, and says what it set off. */
function make(state: RunState, move: SolverMove): Outcome {
  const { dx, dz } = DELTA[move.dir];
  state.player = move.push ? { x: move.x - dx, z: move.z - dz, level: 'ground' } : { x: move.x, z: move.z, level: 'top' };
  const outcome: Outcome = { cleared: false, link: false, ones: false, values: [] };
  const read = () => {
    for (const event of state.events) {
      if (event.type === 'match') outcome.cleared = true;
      else if (event.type === 'chain') outcome.cleared = outcome.link = true;
      else if (event.type === 'happyOne') outcome.cleared = outcome.ones = true;
      else continue;
      outcome.values.push(event.type === 'happyOne' ? 1 : event.value);
    }
  };
  step(state, move.dir);
  read();
  for (let ticks = 0; (worldRuns(state) || state.player.action) && !state.over; ticks++) {
    if (ticks > BEAT_GUARD) throw new Error('a move that does not end');
    step(state, null);
    read();
  }
  return outcome;
}

/**
 * Plays one move on the real rules: the player is put where the move is made from, and the
 * world runs until it stands. The run given is left as it was.
 */
export function playMove(state: RunState, move: SolverMove): RunState {
  const next = copyRun(state);
  make(next, move);
  return next;
}

/** Plays a move as `playMove` does, and says what it set off. */
export function tellMove(state: RunState, move: SolverMove): { state: RunState; outcome: Outcome } {
  const next = copyRun(state);
  const outcome = make(next, move);
  return { state: next, outcome };
}

/** Index of an orientation among the twenty-four, by the two faces that fix it. */
const ORIENTATION_INDEX: number[] = [];
ALL_ORIENTATIONS.forEach((o, index) => (ORIENTATION_INDEX[o.top * 8 + o.north] = index));

const indexOfOrientation = (o: Orientation): number => ORIENTATION_INDEX[o.top * 8 + o.north];

/** A die's ticks of sinking and the ticks it is held for go into one sign of a name: so many to a tick held. */
const HOLD_STEP = 128;
/** Characters a die takes in the name of a board. */
const DIE_CHARS = 4;

/**
 * The name of a board: its dice cell by cell, each with how it lies, how far it has sunk and
 * which group it goes with, and then every place the player can get to. Groups are numbered as
 * they are met, since the numbers the run gave them depend on the way that led here; the cell
 * the player is at is left out, since steps are free. Two runs with one name go on alike.
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
    codes.push(cellIndex(size, die.x, die.z), indexOfOrientation(die.ori), sinking ? 1 + die.t + HOLD_STEP * (die.hold ?? 0) : 0, label);
  }
  for (let i = 0; i < places.length; i += 8) {
    let bits = 0;
    for (let bit = 0; bit < 8 && i + bit < places.length; bit++) bits |= places[i + bit] << bit;
    codes.push(bits);
  }
  return String.fromCharCode(...codes);
}

/**
 * The run a name stands for, with the player at `place`. The dice, their groups and the player
 * are all the rules read of a board that stands; what a run counts besides, its score and its
 * tallies, starts over.
 */
function runOf(base: RunState, name: string, dice: number, place: number): RunState {
  const { size } = base.config;
  const cells = size * size;
  const cubes: Cube[] = [];
  const grid = new Array<number>(cells).fill(0);
  const reactions: Reaction[] = [];
  for (let i = 0; i < dice; i++) {
    const at = i * DIE_CHARS;
    const cell = name.charCodeAt(at);
    const sunk = name.charCodeAt(at + 2);
    const label = name.charCodeAt(at + 3);
    const ori = ALL_ORIENTATIONS[name.charCodeAt(at + 1)];
    const die: Cube = { id: i + 1, x: cell % size, z: Math.floor(cell / size), ori, state: sunk > 0 ? 'sinking' : 'idle', t: sunk > 0 ? ((sunk - 1) % HOLD_STEP) : 0, reactionId: label };
    if (sunk > HOLD_STEP) die.hold = Math.floor((sunk - 1) / HOLD_STEP);
    cubes.push(die);
    grid[cell] = i + 1;
    if (label === 0) continue;
    const reaction = reactions.find((r) => r.id === label);
    if (reaction) reaction.total++;
    else reactions.push({ id: label, value: ori.top, chain: 1, total: 1 });
  }
  const up = place < cells;
  const cell = up ? place : place - cells;
  const run = base.levelRun!;
  return {
    ...base,
    cubes,
    grid,
    reactions,
    pending: [],
    player: { x: cell % size, z: Math.floor(cell / size), level: up ? 'top' : 'ground' },
    levelRun: { spec: run.spec, moves: 0, sent: [0, 0, 0, 0, 0, 0], bestChain: 0, beat: 0 },
    stats: { ...base.stats, clearTicks: [], levels: [] },
    events: [],
    over: false,
    endReason: null,
    nextCubeId: dice + 1,
    nextReactionId: reactions.length + 1,
  };
}

function placeOf(state: RunState): number {
  const { size } = state.config;
  const { x, z, level } = state.player;
  return cellIndex(size, x, z) + (level === 'ground' ? size * size : 0);
}

/** The run a level starts as, with no limit of moves: the solver counts them itself. */
function startOf(spec: LevelSpec, config: RulesConfig = defaultConfig()): RunState {
  return createRun({ seed: spec.seed, config, level: { ...spec, moves: 0 } });
}

/** What a way through a level comes to, played from its start on the real rules. */
export interface WayReport {
  /** The run after the last move. */
  state: RunState;
  /** Longest run of moves from one group made to the next, the move that makes it counted. */
  depth: number;
  uses: Technique[];
  /** Faces of what went on the way, in the order it went: of groups and links, and 1 for the 1s. */
  values: number[];
  /** Times the player stood on a leaving die with standing dice to step to that no step joins: a choice with no way back. */
  commits: number;
  /** The first move is made with the die the player starts on. */
  ownFirst: boolean;
  /** For every move, whether it set something off: a combo, a link, the 1s. */
  cleared: boolean[];
  /** For every move, whether it was made with the die the player stood on: no step led to it. */
  inPlace: boolean[];
  /** For every move, the die it was made with, as the run numbers its dice. */
  dice: number[];
}

/**
 * Standing dice the player on a leaving die can step to, counted by the clusters they make. More
 * than one is a choice: from a die that stands there is no step back onto the group, so the dice
 * of the other cluster are out of reach but for a roll.
 */
function standingChoices(state: RunState): number {
  const { size } = state.config;
  const { player } = state;
  const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
  if (own?.state !== 'sinking') return 0;
  const { places } = scan(state, ['floor']);
  const cluster = new Map<number, number>();
  let clusters = 0;
  const seenClusters = new Set<number>();
  for (const die of state.cubes) {
    const cell = cellIndex(size, die.x, die.z);
    if (die.state !== 'idle' || cluster.has(cell)) continue;
    clusters++;
    const stack = [die];
    cluster.set(cell, clusters);
    while (stack.length > 0) {
      const at = stack.pop()!;
      for (const dir of DIRS) {
        const next = cubeAt(state, at.x + DELTA[dir].dx, at.z + DELTA[dir].dz);
        if (!next || next.state !== 'idle') continue;
        const nextCell = cellIndex(size, next.x, next.z);
        if (cluster.has(nextCell)) continue;
        cluster.set(nextCell, clusters);
        stack.push(next);
      }
    }
  }
  for (const [cell, of] of cluster) if (places[cell]) seenClusters.add(of);
  return seenClusters.size;
}

/**
 * Plays moves from the start of a level on the real rules, each one checked first: a move that
 * cannot be got to, or cannot be made, is a mistake in the way given, and it says so.
 */
export function replay(spec: LevelSpec, moves: readonly SolverMove[], config?: RulesConfig): RunState {
  return tryWay(spec, moves, config).state;
}

/** Plays a way as `replay` does, and says what it leans on and what it comes to. */
export function tryWay(spec: LevelSpec, moves: readonly SolverMove[], config?: RulesConfig): WayReport {
  return follow(startOf(spec, config), spec.id, moves);
}

/** Plays a way from the run given, which is played on and not kept as it was; `id` names the level in what goes wrong. */
function follow(state: RunState, id: string, moves: readonly SolverMove[]): WayReport {
  const spec = { id };
  const used = new Set<Technique>();
  const values: number[] = [];
  const start = { x: state.player.x, z: state.player.z };
  let depth = 0;
  let since = 0;
  let commits = 0;
  const cleared: boolean[] = [];
  const inPlace: boolean[] = [];
  const dice: number[] = [];
  moves.forEach((move, index) => {
    if (state.over) throw new Error(`level ${spec.id}: move ${index + 1} is made after the level has ended`);
    const found = scan(state).moves.find((m) => m.x === move.x && m.z === move.z && m.dir === move.dir && m.push === move.push);
    if (!found) throw new Error(`level ${spec.id}: move ${index + 1} (${moveText(move)}) cannot be made`);
    if (standingChoices(state) > 1) commits++;
    const { player } = state;
    inPlace.push(!move.push && player.level === 'top' && player.x === move.x && player.z === move.z);
    dice.push(cubeAt(state, move.x, move.z)!.id);
    const outcome = make(state, move);
    cleared.push(outcome.cleared);
    if (found.floor) used.add('floor');
    if (found.glass) used.add('glass');
    if (outcome.link) used.add('link');
    if (outcome.ones) used.add('ones');
    values.push(...outcome.values);
    since++;
    if (outcome.cleared) {
      depth = Math.max(depth, since);
      since = 0;
    }
  });
  const first = moves[0];
  const ownFirst = first !== undefined && !first.push && first.x === start.x && first.z === start.z;
  return { state, depth: Math.max(depth, since), uses: TECHNIQUES.filter((technique) => used.has(technique)), values, commits, ownFirst, cleared, inPlace, dice };
}

/** A move as a level keeps it: the cell of the die, the side, and `p` for a push. */
export function moveText(move: SolverMove): string {
  return `${move.x},${move.z},${move.dir}${move.push ? ',p' : ''}`;
}

export function moveOf(text: string): SolverMove {
  const [x, z, dir, push] = text.split(',');
  if (!DIRS.includes(dir as Dir) || !/^\d+$/.test(x) || !/^\d+$/.test(z) || (push !== undefined && push !== 'p')) throw new Error(`cannot read the move "${text}"`);
  return { x: Number(x), z: Number(z), dir: dir as Dir, push: push === 'p' };
}

const packMove = (move: SolverMove): number => move.x + move.z * 8 + DIRS.indexOf(move.dir) * 64 + (move.push ? 256 : 0);
const unpackMove = (code: number): SolverMove => ({ x: code % 8, z: (code >> 3) % 8, dir: DIRS[(code >> 6) % 4], push: code >= 256 });

/**
 * The fewest moves the board of a level is cleared in, found by going through its boards in the
 * order of the moves that lead to them: every board one move away, then every board two moves
 * away, and so on, each board once. The first board that is cleared ends the search, and the
 * way to it is the shortest there is. A board at a dead end leads nowhere and is dropped.
 *
 * With `ban` the ways that lean on a technique are left out: steps to the floor and pushes,
 * rolls over a die that is going, a die joining a group, the 1s going together. With `first` the
 * way has to begin with the die the player starts on, or with any other.
 */
export function solveLevel(spec: LevelSpec, opts: SolveOptions = {}): Solved {
  return search(startOf(spec, opts.config), spec.id, opts, (moves) => tryWay(spec, moves, opts.config));
}

/**
 * The fewest moves the board of a run is cleared in from where it stands, and a way to do it:
 * the search of `solveLevel`, begun at a board that is not the start of its level. The world
 * has to stand. The run is left as it was. What the level limits its moves to is not counted:
 * only the board is asked.
 */
export function solveFrom(state: RunState, opts: Pick<SolveOptions, 'maxStates' | 'maxMoves' | 'ban'> = {}): Solved {
  const run = state.levelRun;
  if (!run) throw new Error('solveFrom: not a level');
  if (worldRuns(state) || state.player.action) throw new Error('solveFrom: the world has to stand');
  const root = copyRun(state);
  root.levelRun = { ...root.levelRun!, spec: { ...run.spec, moves: 0 }, moves: 0 };
  return search(root, run.spec.id, opts, (moves) => follow(copyRun(root), run.spec.id, moves));
}

/** The search itself, from the run given: `check` plays the way found again and says what it comes to. */
function search(root: RunState, id: string, opts: SolveOptions, check: (moves: SolverMove[]) => WayReport): Solved {
  const { maxStates = SOLVER_MAX_STATES, maxMoves = Infinity, ban = [], first } = opts;
  const noLink = ban.includes('link');
  const noOnes = ban.includes('ones');
  const start = { x: root.player.x, z: root.player.z };
  const own = (move: SolverMove) => !move.push && move.x === start.x && move.z === start.z;

  // Every board seen, and for each how it was come to: the board before it and the move.
  const seen = new Set<string>();
  const cameFrom: number[] = [-1];
  const cameBy: number[] = [0];
  // The boards the last move led to: their names, where the player is, and their place in the lists above.
  let front: { name: string; place: number; index: number }[] = [];
  const rootName = nameOf(root, scan(root, ban).places);
  seen.add(rootName);
  front.push({ name: rootName, place: placeOf(root), index: 0 });

  const wayTo = (index: number, last: SolverMove): SolverMove[] => {
    const way: SolverMove[] = [{ x: last.x, z: last.z, dir: last.dir, push: last.push }];
    for (let at = index; cameFrom[at] >= 0; at = cameFrom[at]) way.unshift(unpackMove(cameBy[at]));
    return way;
  };

  for (let made = 0; made < maxMoves && front.length > 0; made++) {
    const next: typeof front = [];
    for (const node of front) {
      const board = runOf(root, node.name, diceIn(node.name, root), node.place);
      for (const move of scan(board, ban).moves) {
        if (made === 0 && first !== undefined && own(move) !== (first === 'own')) continue;
        const after = copyRun(board);
        const outcome = make(after, move);
        if ((noLink && outcome.link) || (noOnes && outcome.ones)) continue;
        if (after.endReason === 'passed') {
          const moves = wayTo(node.index, move);
          const { state, depth, uses } = check(moves);
          if (state.endReason !== 'passed') throw new Error(`level ${id}: the way found does not clear the board when played again`);
          return { solution: { par: moves.length, moves, depth, uses }, exhausted: true, states: seen.size };
        }
        if (after.over) continue;
        const name = nameOf(after, scan(after, ban).places);
        if (seen.has(name)) continue;
        if (seen.size >= maxStates) return { solution: null, exhausted: false, states: seen.size };
        seen.add(name);
        cameFrom.push(node.index);
        cameBy.push(packMove(move));
        next.push({ name, place: placeOf(after), index: cameFrom.length - 1 });
      }
    }
    front = next;
  }
  return { solution: null, exhausted: true, states: seen.size };
}

/** How a board ends for those who play it to measure it: cleared, a dead end by the count of dice, or a dead end of the floor. */
export type BoardEnd = 'passed' | 'count' | 'floor';

/** The boards a level can come to within so many moves, and the moves between them. */
export interface Explored {
  /** False where the search gave up before it had seen every board within its moves. */
  complete: boolean;
  /** Boards seen: the start is the first, and the cleared board, where one is come to, is one more entry after them. */
  boards: number;
  /** For every entry, the entries its moves lead to, each named once however many moves lead there. A board on the rim leads nowhere. */
  next: number[][];
  /** How an entry ends, where it does: nothing leads on from it. */
  end: (BoardEnd | null)[];
  /** Fewest moves from the start to every board. */
  far: number[];
}

/** Boards a walk over a level sees before it gives up, unless told otherwise. */
export const EXPLORE_MAX_STATES = 200_000;

/**
 * Walks the boards that can be come to from the run given in no more than `maxMoves` moves, by
 * the search of the solver, and keeps what leads where. All the boards of a level are far too
 * many to walk: a die rolled about with nothing going is a new board at every roll. A board is
 * a dead end of the floor when the player is down on it with no way to clear it (`floorLost`)
 * or has no move left on it at all; the rules of a level may not end it there yet, and those who
 * measure a board do. All cleared boards are one entry.
 */
export function explore(state: RunState, opts: { maxMoves?: number; maxStates?: number; ban?: readonly Ban[] } = {}): Explored {
  const run = state.levelRun;
  if (!run) throw new Error('explore: not a level');
  const { maxMoves = Infinity, maxStates = EXPLORE_MAX_STATES, ban = [] } = opts;
  const noLink = ban.includes('link');
  const noOnes = ban.includes('ones');
  const root = copyRun(state);
  root.levelRun = { ...root.levelRun!, spec: { ...run.spec, moves: 0 }, moves: 0 };

  const index = new Map<string, number>();
  const names: string[] = [];
  const places: number[] = [];
  const next: number[][] = [];
  const end: (BoardEnd | null)[] = [];
  const far: number[] = [];
  let complete = true;
  /** The entry of a board, new or seen before; -1 for a new one over the limit. */
  const entryOf = (board: RunState, over: BoardEnd | null, moves: number): number => {
    const name = nameOf(board, scan(board, ban).places);
    const seen = index.get(name);
    if (seen !== undefined) return seen;
    if (index.size >= maxStates) return -1;
    index.set(name, names.length);
    names.push(name);
    places.push(placeOf(board));
    next.push([]);
    end.push(over ?? (floorLost(board) ? 'floor' : null));
    far.push(moves);
    return names.length - 1;
  };
  entryOf(root, null, 0);
  /** Boards a move clears. */
  const clearing: number[] = [];
  // Boards are named in the order they are come to, so this goes through them the nearest first.
  for (let at = 0; at < names.length; at++) {
    if (end[at] !== null || far[at] >= maxMoves) continue;
    const board = runOf(root, names[at], diceIn(names[at], root), places[at]);
    const moves = scan(board, ban).moves;
    const leads = new Set<number>();
    let cleared = false;
    for (const move of moves) {
      const after = copyRun(board);
      const outcome = make(after, move);
      if ((noLink && outcome.link) || (noOnes && outcome.ones)) continue;
      if (after.endReason === 'passed') {
        cleared = true;
        continue;
      }
      const to = entryOf(after, after.over ? (levelStuck(after) ? 'count' : 'floor') : null, far[at] + 1);
      if (to < 0) complete = false;
      else leads.add(to);
    }
    next[at] = [...leads];
    if (cleared) clearing.push(at);
    // No move to make with dice still standing: nothing to roll, nothing to push, nothing to go up by.
    else if (moves.length === 0) end[at] = 'floor';
  }
  const boards = names.length;
  if (clearing.length > 0) {
    next.push([]);
    end.push('passed');
    for (const at of clearing) next[at].push(boards);
  }
  return { complete, boards, next, end, far };
}

/** Dice in a name: what is left of it when the places of the player are taken off. */
function diceIn(name: string, base: RunState): number {
  const { size } = base.config;
  return (name.length - Math.ceil((2 * size * size) / 8)) / DIE_CHARS;
}
