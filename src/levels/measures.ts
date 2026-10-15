import { DELTA, DIRS, cubeAt } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { levelDeadEnd, shortGroups } from '../rules/level';
import { explore, movesAt, playMove, solveFrom, solveLevel, tellMove, type SolverMove } from '../rules/levelSolver';
import { scan } from '../rules/reach';
import { ALL_ORIENTATIONS } from '../rules/orientation';
import { createRun } from '../rules/sim';
import type { Dir, LevelSpec, Orientation, RunState } from '../rules/types';

/**
 * What a board and its way are measured by, past the fewest moves: how a level ends, how many
 * ways into it there are, and whether its way is the one its place is there to teach. The fewest
 * moves say how fast a board can be cleared, and nothing of how it is to clear it.
 */

/**
 * Moves a way makes after the clearing move before its last one: the end of a level that is
 * only finished off. 0 for a way that clears once, where the whole way leads up to its end.
 */
export function tailOf(cleared: readonly boolean[]): number {
  const at = cleared.flatMap((did, index) => (did ? [index] : []));
  return at.length < 2 ? 0 : at[at.length - 1] - at[at.length - 2];
}

/** Boards a search for the rest of a way may see after one first move. */
const FIRSTS_MAX_STATES = 50_000;

/**
 * First moves after which the board is still cleared in `par` moves more: a way a move longer
 * than the fewest, at most. One is a level with a single way in; more are a choice.
 */
export function firstsOf(spec: LevelSpec, par: number, maxStates = FIRSTS_MAX_STATES): number {
  const start = createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });
  let good = 0;
  for (const move of movesAt(start)) {
    const after = playMove(start, move);
    if (after.endReason === 'passed' || (!after.over && solveFrom(after, { maxMoves: par, maxStates }).solution)) good++;
  }
  return good;
}

/** Dice that start with a face that works at the bottom: the rule of seven is of use on them. */
export function underOf(spec: LevelSpec): number {
  const faces = spec.faces ?? [];
  return (spec.layout?.dice ?? []).filter((die) => faces.includes(7 - die.top)).length;
}

/**
 * The die the way begins with starts with a face that works at the bottom: the face cannot be
 * seen, and is known by the one on top, since opposite faces add up to seven.
 */
export function startsUnder(spec: LevelSpec, way: readonly SolverMove[]): boolean {
  const first = way[0];
  const die = first && spec.layout?.dice.find((other) => other.x === first.x && other.z === first.z);
  return die !== undefined && (spec.faces ?? []).includes(7 - die.top);
}

const SIDE: Record<Dir, 'north' | 'east' | 'south' | 'west'> = { N: 'north', E: 'east', S: 'south', W: 'west' };
const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const across = (a: Dir, b: Dir): boolean => a !== b && a !== OPPOSITE[b];

/** How a die of a board lies, by the two faces a board keeps of it. */
function lieOf(top: number, north: number): Orientation | undefined {
  return ALL_ORIENTATIONS.find((o) => o.top === top && o.north === north);
}

/**
 * The way begins by riding a face on the side: the die the player starts on is rolled one way,
 * once or more, and then turned across, and the turn lays on top a face that works and that
 * lay, all the while, on the side the turn rolls away from. A roll keeps the two faces across
 * its way where they are, so a face on the side rides there for as long as the die goes along.
 */
export function rides(spec: LevelSpec, way: readonly SolverMove[]): boolean {
  return rideTurn(spec, way) !== null;
}

/**
 * The side the turn of a ride rolls to, or null where the way is no ride. The face that rode is
 * the one on the side across from it: a turn north lays on top the face that looked south, at
 * the player, all the way.
 */
export function rideTurn(spec: LevelSpec, way: readonly SolverMove[]): Dir | null {
  const { layout } = spec;
  const first = way[0];
  if (!layout || !first || first.push || first.x !== layout.start.x || first.z !== layout.start.z) return null;
  const turn = way.findIndex((move) => move.dir !== first.dir);
  if (turn < 1 || !across(way[turn].dir, first.dir)) return null;
  // The moves up to the turn are all of the one die: each is made from where the one before it came to.
  let { x, z } = layout.start;
  for (let index = 0; index <= turn; index++) {
    const move = way[index];
    if (move.push || move.x !== x || move.z !== z) return null;
    x += DELTA[move.dir].dx;
    z += DELTA[move.dir].dz;
  }
  const own = layout.dice.find((die) => die.x === layout.start.x && die.z === layout.start.z);
  const lie = own && lieOf(own.top, own.north);
  if (!lie) return null;
  // Rolled one way, a die lays on top the face of the side it rolls away from.
  return (spec.faces ?? []).includes(lie[SIDE[OPPOSITE[way[turn].dir]]]) ? way[turn].dir : null;
}

/**
 * Steps over the dice from the die the player starts on to the die of the first move: 0 when
 * it is the same die, -1 when no steps lead there.
 */
export function farOf(spec: LevelSpec, way: readonly SolverMove[]): number {
  const { layout } = spec;
  const first = way[0];
  if (!layout || !first) return -1;
  const key = (x: number, z: number) => `${x},${z}`;
  const dice = new Set(layout.dice.map((die) => key(die.x, die.z)));
  const steps = new Map<string, number>([[key(layout.start.x, layout.start.z), 0]]);
  const queue = [{ ...layout.start }];
  for (let at = 0; at < queue.length; at++) {
    const { x, z } = queue[at];
    if (x === first.x && z === first.z) return steps.get(key(x, z))!;
    for (const dir of DIRS) {
      const nx = x + DELTA[dir].dx;
      const nz = z + DELTA[dir].dz;
      if (!dice.has(key(nx, nz)) || steps.has(key(nx, nz))) continue;
      steps.set(key(nx, nz), steps.get(key(x, z))! + 1);
      queue.push({ x: nx, z: nz });
    }
  }
  return -1;
}

/**
 * Longest run of moves with no event between two events of a way: the silence under the count.
 * The quiet moves before the first event are not counted: nothing is going yet, and the player
 * thinks for as long as they like.
 */
export function silenceOf(cleared: readonly boolean[]): number {
  const at = cleared.flatMap((did, index) => (did ? [index] : []));
  let longest = 0;
  for (let i = 1; i < at.length; i++) longest = Math.max(longest, at[i] - at[i - 1] - 1);
  return longest;
}

/** Clusters the dice of a board start in: dice joined by their sides are one. */
export function islandsOf(spec: LevelSpec): number {
  const dice = spec.layout?.dice ?? [];
  const key = (x: number, z: number) => `${x},${z}`;
  const left = new Set(dice.map((die) => key(die.x, die.z)));
  let islands = 0;
  for (const die of dice) {
    if (!left.delete(key(die.x, die.z))) continue;
    islands++;
    const queue = [{ x: die.x, z: die.z }];
    for (let at = 0; at < queue.length; at++) {
      for (const dir of DIRS) {
        const x = queue[at].x + DELTA[dir].dx;
        const z = queue[at].z + DELTA[dir].dz;
        if (left.delete(key(x, z))) queue.push({ x, z });
      }
    }
  }
  return islands;
}

const startOf = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });

/**
 * Dice that have to be turned before anything goes: those that start with a face on top that
 * does not work and show one that does at the first event of the way, the move it is made by
 * played. A 1 is not counted as a face that works: the 1s are swept, not brought. Where the way
 * sets nothing off, the dice are counted at its end.
 */
export function turnsOf(spec: LevelSpec, way: readonly SolverMove[]): number {
  let state = startOf(spec);
  const works = (top: number): boolean => top !== 1 && (spec.faces ?? []).includes(top);
  const hidden = new Set(state.cubes.filter((cube) => !works(cube.ori.top)).map((cube) => cube.id));
  for (const move of way) {
    const told = tellMove(state, move);
    state = told.state;
    if (told.outcome.cleared) break;
  }
  return state.cubes.filter((cube) => hidden.has(cube.id) && works(cube.ori.top)).length;
}

/** Boards a search may see to say that a board with a combo made cannot be cleared. */
const TRAP_MAX_STATES = 150_000;

/**
 * A trap of order: a combo that can be made with the first move or the second, after which the
 * board cannot be cleared. `floor` where one such combo leaves the player on it with no die to
 * step to, so that the floor is all there is; `any` for a trap of another kind; null with none.
 * A board the search could not settle is not called a trap.
 */
export function trapOf(spec: LevelSpec, maxStates = TRAP_MAX_STATES): 'floor' | 'any' | null {
  const start = startOf(spec);
  let found: 'floor' | 'any' | null = null;
  /** The board a combo has just been made on: is it lost, and is the player left with the floor alone? */
  const look = (state: RunState): void => {
    if (state.endReason === 'passed') return;
    if (!state.over) {
      const { solution, exhausted } = solveFrom(state, { maxStates });
      if (solution || !exhausted) return;
    }
    // Up on the dice, with the floor left out, there is no move: no die that stands is a step away.
    if (scan(state, ['floor']).moves.length === 0) found = 'floor';
    else found ??= 'any';
  };
  for (const first of movesAt(start)) {
    const one = tellMove(start, first);
    if (one.outcome.cleared) {
      look(one.state);
      continue;
    }
    if (one.state.over) continue;
    for (const second of movesAt(one.state)) {
      const two = tellMove(one.state, second);
      if (two.outcome.cleared) look(two.state);
    }
  }
  return found;
}

/** Boards a search may see to say that a board cannot be cleared after a first move. */
const SAFE_FIRST_MAX_STATES = 150_000;

/**
 * No first move loses the board: after any move the rules offer at the start, the board can
 * still be cleared, in however many moves. A trap may wait further on, and not at the first
 * step. A board the search could not settle is taken to be cleared: only a search that saw every
 * board says a first move loses.
 */
export function safeFirstOf(spec: LevelSpec, maxStates = SAFE_FIRST_MAX_STATES): boolean {
  const start = startOf(spec);
  for (const move of movesAt(start)) {
    const after = playMove(start, move);
    if (after.endReason === 'passed') continue;
    if (after.over) return false;
    const { solution, exhausted } = solveFrom(after, { maxStates });
    if (!solution && exhausted) return false;
  }
  return true;
}

/**
 * Whether the board is cleared within so many moves with one face alone at work. A board the
 * search could not settle is said to be: only a search that saw every board says it is not.
 */
export function oneFaceClears(spec: LevelSpec, face: number, maxMoves: number, maxStates?: number): boolean {
  const alone: LevelSpec = { ...spec, faces: [face], solution: undefined, par: undefined, exact: undefined };
  const { solution, exhausted } = solveLevel(alone, { maxMoves, maxStates });
  return solution !== null || !exhausted;
}

/**
 * A combo that is nearly made at the start and is not what it looks: dice of one face that
 * works stand side by side, one short of their combo (for a 2, that is a 2 standing alone), and
 * on the way given at least one of them goes showing another face. The count of the faces, and
 * not the dice at hand, says what goes with what.
 */
export function decoyOf(spec: LevelSpec, way: readonly SolverMove[]): boolean {
  let state = startOf(spec);
  const faces = spec.faces ?? [];
  const alone = state.cubes
    .filter((cube) => cube.ori.top === 2 && faces.includes(2) && !DIRS.some((dir) => cubeAt(state, cube.x + DELTA[dir].dx, cube.z + DELTA[dir].dz)?.ori.top === 2))
    .map((cube) => ({ value: 2, ids: [cube.id] }));
  const nearly = shortGroups(state).filter((group) => group.have === group.need - 1);
  const dice = [...alone, ...nearly.map((group) => ({ value: group.value, ids: group.cells.map((cell) => cubeAt(state, cell.x, cell.z)!.id) }))];
  if (dice.length === 0) return false;
  /** The face every die showed when it began to go. */
  const wentAs = new Map<number, number>();
  for (const move of way) {
    state = tellMove(state, move).state;
    for (const cube of state.cubes) if (cube.state === 'sinking' && !wentAs.has(cube.id)) wentAs.set(cube.id, cube.ori.top);
  }
  return dice.some((group) => group.ids.some((id) => wentAs.has(id) && wentAs.get(id) !== group.value));
}

/**
 * The boards of a level within two moves of its start, every one of them, each solved: how many
 * they are, how many are dead ends the level says at once, how many are lost and not said, and the
 * most moves it takes to clear any of the rest. What a careless move or two cost; `node scripts/row.mjs
 * report` shows it for every place of the row.
 */
export function nearOf(spec: LevelSpec): [boards: number, said: number, silent: number, worst: number] {
  const nameOf = (state: RunState): string =>
    JSON.stringify([state.cubes.map((cube) => [cube.x, cube.z, cube.ori.top, cube.ori.north, cube.state, cube.t, cube.hold ?? 0, cube.reactionId]).sort(), state.player.x, state.player.z, state.player.level, state.endReason]);
  const root = startOf(spec);
  const seen = new Set([nameOf(root)]);
  let front = [root];
  let [boards, said, silent, worst] = [0, 0, 0, 0];
  for (let moves = 1; moves <= 2; moves++) {
    const next: RunState[] = [];
    for (const state of front) {
      for (const move of movesAt(state)) {
        const after = playMove(state, move);
        const name = nameOf(after);
        if (seen.has(name)) continue;
        seen.add(name);
        boards++;
        if (after.endReason === 'passed') continue;
        if (after.over || levelDeadEnd(after) !== null) {
          said++;
          continue;
        }
        const solved = solveFrom(after);
        if (!solved.exhausted) throw new Error(`${spec.id}: a board near the start the solver gave up on`);
        if (!solved.solution) silent++;
        else {
          worst = Math.max(worst, solved.solution.moves.length);
          next.push(after);
        }
      }
    }
    front = next;
  }
  return [boards, said, silent, worst];
}

/**
 * The boards of a level that can be come to by its moves, all of them; those among them from which it
 * can no longer be cleared; how many of those are dead ends the level says at once; and the most moves
 * from any board to the cleared one. Only for a board whose boards are few: throws where the walk does
 * not end.
 */
export function lostOf(spec: LevelSpec): { boards: number; lost: number; said: number; worst: number } {
  const { complete, boards, next, end } = explore(startOf(spec));
  if (!complete) throw new Error(`${spec.id}: more boards than can be walked whole`);
  // The moves from every board to the cleared one, found from the cleared one backwards, a move at a time.
  const far: number[] = end.map((how) => (how === 'passed' ? 0 : -1));
  let worst = 0;
  for (let moves = 1, grew = true; grew; moves++) {
    grew = false;
    const nearer = next.map((to, at) => far[at] < 0 && to.some((board) => far[board] >= 0 && far[board] < moves));
    nearer.forEach((is, at) => {
      if (!is) return;
      far[at] = worst = moves;
      grew = true;
    });
  }
  return { boards, lost: far.filter((moves) => moves < 0).length, said: end.filter((how) => how === 'count' || how === 'floor').length, worst };
}
