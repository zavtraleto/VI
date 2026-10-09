import { describe, expect, it } from 'vitest';
import { cubeAt } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { levelDeadEnd, worldRuns } from '../rules/level';
import { explore, moveOf, movesAt, playMove, solveFrom, solveLevel, tryWay } from '../rules/levelSolver';
import { resolveMove } from '../rules/movement';
import { roll } from '../rules/orientation';
import { createRun, step } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import type { Ban } from '../rules/reach';
import type { Dir, LevelSpec, MoveKind, Orientation, RunState } from '../rules/types';
import { SKETCH, candidate } from './generate';
import { LEVELS } from './levels';
import { ROAD_PLACES, ROAD_SEEDS } from './roadRecipes';
import { judge } from './select';
import { walkBoards } from './walk';
import {
  FIRST_PASSED,
  ROAD,
  ROAD_BLOCKS,
  ROAD_EDITION,
  ROAD_END,
  ROAD_HINTS,
  ROAD_IDLE,
  ROAD_SIGNS,
  blockOf,
  pieceAfter,
  pieceMiddle,
  placeAfter,
  roadPlace,
  toRoadEdition,
  type RoadKept,
} from './road';

/**
 * The pieces of the road in its second edition: five lessons, proved as the first edition was,
 * by the one way each has; and thirteen free pieces and mixes, of which is asked what their
 * places ask (`roadRecipes.ts`) and what each is there for.
 */

const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];
const LESSONS = ['R01', 'R02', 'R07', 'R11', 'R15'];
const FREE = ['R03', 'R04', 'R05', 'R08', 'R09', 'R12', 'R13', 'R16', 'R17'];
const MIXES = ['R06', 'R10', 'R14', 'R18'];
const wayOf = (spec: LevelSpec) => (spec.solution ?? []).map(moveOf);
const pieceOf = (id: string): LevelSpec => ROAD.find((spec) => spec.id === id)!;
const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });

/** Gives a command and runs the level until the world stands and the player is free, as a move is made. */
function go(state: RunState, dir: Dir): void {
  step(state, dir);
  for (let ticks = 0; (worldRuns(state) || state.player.action) && !state.over; ticks++) {
    if (ticks > 1000) throw new Error('a move that does not end');
    step(state, null);
  }
}

/** The cells of a piece, row by row from the north, as `x,z`. */
function cellsOf(spec: LevelSpec): string[] {
  const cut = new Set((spec.holes ?? []).map((cell) => `${cell.x},${cell.z}`));
  const cells: string[] = [];
  for (let z = 0; z < spec.size; z++) for (let x = 0; x < spec.size; x++) if (!cut.has(`${x},${z}`)) cells.push(`${x},${z}`);
  return cells;
}

/** How many cells wide and how many long the cells of a piece lie. */
function extentOf(spec: LevelSpec): [number, number] {
  const cells = cellsOf(spec).map((cell) => cell.split(',').map(Number));
  const side = (at: number[]): number => Math.max(...at) - Math.min(...at) + 1;
  return [side(cells.map(([x]) => x)), side(cells.map(([, z]) => z))];
}

/**
 * How each piece is cleared, by the keys pressed: a roll, a step from die to die (`hop`), a
 * step up onto a die that is leaving (`mount`), a step down from one to the floor (`descend`),
 * a step along the floor (`walk`), a push. Only a roll and a push are moves.
 */
const KEYS: Readonly<Record<string, string>> = {
  R01: 'N:roll N:roll N:roll N:roll',
  R02: 'N:mount N:hop N:roll N:roll N:roll W:roll',
  R03: 'E:roll N:roll',
  R04: 'N:roll W:roll',
  R05: 'W:hop N:roll E:roll',
  R06: 'W:roll S:hop S:roll E:roll',
  R07: 'N:roll N:roll N:hop W:roll',
  R08: 'N:roll E:roll S:hop E:roll',
  R09: 'N:roll E:hop N:roll',
  R10: 'S:roll E:hop N:roll W:roll N:hop E:roll',
  R11: 'N:roll E:hop E:hop N:hop N:roll W:roll',
  R12: 'W:roll W:roll S:hop S:hop W:hop N:roll',
  R13: 'N:mount N:hop E:roll S:roll E:roll',
  R14: 'W:roll S:hop E:hop N:roll W:hop S:hop W:roll',
  R15: 'N:roll S:descend W:walk W:push',
  R16: 'N:walk E:walk N:walk E:walk N:walk W:push S:walk S:walk S:walk W:walk W:walk N:push',
  R17: 'W:roll S:descend W:walk S:push S:mount E:hop N:hop W:roll',
  R18: 'N:roll N:hop E:hop N:descend W:push S:mount S:hop S:descend W:walk W:walk N:push E:walk N:walk N:mount W:hop S:hop E:roll',
};

/** What was seen as a piece was played by its keys. */
interface Played {
  state: RunState;
  /** For every step from die to die: whether the die left and the die come to were leaving. */
  hops: { from: boolean; to: boolean }[];
  /** The events of the whole way, by their kind. */
  events: string[];
}

/** Plays a piece by keys, each checked against what the rules make of it. */
function playKeys(spec: LevelSpec, keys = KEYS[spec.id]): Played {
  const state = start(spec);
  const hops: Played['hops'] = [];
  const events: string[] = [];
  for (const key of keys.split(' ')) {
    const [dir, kind] = key.split(':') as [Dir, MoveKind];
    const intent = resolveMove(state, dir);
    expect(intent.kind, `${spec.id} ${key}`).toBe(kind);
    if (kind === 'hop') hops.push({ from: cubeAt(state, state.player.x, state.player.z)!.state === 'sinking', to: cubeAt(state, intent.tx, intent.tz)!.state === 'sinking' });
    step(state, dir);
    events.push(...state.events.map((event) => event.type));
    for (let ticks = 0; (worldRuns(state) || state.player.action) && !state.over; ticks++) {
      if (ticks > 1000) throw new Error('a move that does not end');
      step(state, null);
      events.push(...state.events.map((event) => event.type));
    }
  }
  return { state, hops, events };
}

/** The fewest moves a piece is cleared in by a way that does without what is named; null where there is none. */
function parWithout(spec: LevelSpec, ...ban: Ban[]): number | null {
  const solved = solveLevel(spec, { ban });
  expect(solved.exhausted, `${spec.id} without ${ban.join(', ')}`).toBe(true);
  return solved.solution?.par ?? null;
}

/** Whether a piece is cleared within so many moves over its fewest by a way that does without what is named. */
function clearedWithout(spec: LevelSpec, over: number, ...ban: Ban[]): boolean {
  const solved = solveLevel(spec, { ban, maxMoves: spec.par! + over });
  expect(solved.exhausted || solved.solution !== null, `${spec.id} without ${ban.join(', ')}`).toBe(true);
  return solved.solution !== null;
}

/**
 * The boards of a piece that can be come to by its moves, all of them; those among them from
 * which it can no longer be cleared; and how many of those are dead ends the level says at
 * once: too few dice, or nothing left to do. Only for a piece whose boards are few.
 */
function lostOf(spec: LevelSpec): { boards: number; lost: number; said: number; worst: number } {
  const { complete, boards, next, end } = explore(start(spec));
  expect(complete, spec.id).toBe(true);
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

/**
 * The boards of a piece within two moves of its start, every one of them, each solved: how many
 * they are, how many are dead ends the level says at once, how many are lost and not said, and
 * the most moves it takes to clear any of the rest. What a careless move or two cost.
 */
function nearOf(spec: LevelSpec): [boards: number, said: number, silent: number, worst: number] {
  const nameOf = (state: RunState): string =>
    JSON.stringify([state.cubes.map((cube) => [cube.x, cube.z, cube.ori.top, cube.ori.north, cube.state, cube.t, cube.hold ?? 0, cube.reactionId]).sort(), state.player.x, state.player.z, state.player.level, state.endReason]);
  const root = start(spec);
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
        expect(solved.exhausted, `${spec.id}: a board the solver gave up on`).toBe(true);
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

describe('the road', () => {
  it('is eighteen pieces, R01 to R18, in four blocks: a lesson, free pieces and a mix', () => {
    expect(ROAD.map((spec) => spec.id)).toEqual(Array.from({ length: 18 }, (_, i) => `R${String(i + 1).padStart(2, '0')}`));
    expect([...LESSONS, ...FREE, ...MIXES].sort()).toEqual(ROAD.map((spec) => spec.id));
    expect(ROAD_BLOCKS.map((block) => [ROAD[block.from].id, ROAD[block.to].id])).toEqual([['R01', 'R06'], ['R07', 'R10'], ['R11', 'R14'], ['R15', 'R18']]);
    // A block ends with its mix, and after the first begins with the lesson of its move; the first has two that lead in.
    expect(ROAD_BLOCKS.map((block) => ROAD[block.to].id)).toEqual(MIXES);
    expect(ROAD_BLOCKS.map((block) => ROAD[block.from].id)).toEqual(['R01', 'R07', 'R11', 'R15']);
    expect(LESSONS).toContain('R02');
    // Every piece that is not a lesson has a place it was picked for, and the place says which of the two it is.
    expect(ROAD_PLACES.map((place) => place.id)).toEqual(ROAD.map((spec) => spec.id).filter((id) => !LESSONS.includes(id)));
    expect(ROAD_PLACES.filter((place) => place.role === 'mix').map((place) => place.id)).toEqual(MIXES);
    expect(ROAD_PLACES.filter((place) => place.role === 'free').map((place) => place.id)).toEqual(FREE);
  });

  it('is laid die by die: nothing comes, no limit of moves, and the dice laid are the dice of the goal', () => {
    for (const spec of ROAD) {
      expect(spec.norm, spec.id).toBe(spec.layout!.dice.length);
      expect(spec.goal, spec.id).toEqual({ kind: 'clear' });
      expect(spec.arrival, spec.id).toBe('none');
      expect(spec.moves, spec.id).toBe(0);
      expect(spec.undos, spec.id).toBe(3);
      expect(spec.sinkMoves, spec.id).toBe(2);
      expect(spec.liftMoves, spec.id).toBe(LEVELS[0].liftMoves);
      expect(spec.exact, spec.id).toBe(true);
      for (const key of ['lesson', 'guide', 'story'] as const) expect(spec[key], `${spec.id} ${key}`).toBeUndefined();
      expect(start(spec).cubes, spec.id).toHaveLength(spec.norm);
    }
    // No piece has the code of a level of the list.
    for (const spec of ROAD) expect(LEVELS.some((level) => level.id === spec.id), spec.id).toBe(false);
  });

  it('names the faces that work in the order a piece uses them: 2s, 3s and 4s, no 1s, 5s or 6s', { timeout: 60_000 }, () => {
    expect(ROAD.map((spec) => spec.faces)).toEqual([[2], [3], [2], [3], [4], [3, 2], [2], [2], [3], [3, 2], [3, 2], [3, 2], [3], [3, 2], [2, 3], [3], [2, 3], [3, 2]]);
    for (const spec of ROAD) {
      expect(spec.values, spec.id).toEqual(spec.faces);
      // The faces of what goes on the way of the piece, in the order it goes.
      expect([...new Set(tryWay(spec, wayOf(spec)).values)], spec.id).toEqual(spec.faces);
    }
    // The faces change from piece to piece, but where the table of the edition itself puts two alike side by side:
    // the lesson of the chain and the free piece after it are both of 2s, and from R10 to R12 a mix, a lesson
    // and a free piece are all of 3s and then 2s.
    const alike: string[][] = [];
    for (let i = 1; i < ROAD.length; i++) if (JSON.stringify(ROAD[i].faces) === JSON.stringify(ROAD[i - 1].faces)) alike.push([ROAD[i - 1].id, ROAD[i].id]);
    expect(alike).toEqual([['R07', 'R08'], ['R10', 'R11'], ['R11', 'R12']]);
  });

  it('is the boards of the pictures: a lesson is cells cut to one way, a free piece a whole rectangle', () => {
    expect(cellsOf(pieceOf('R01'))).toEqual(['2,0', '2,1', '2,2', '2,3', '2,4', '2,5']);
    expect(cellsOf(pieceOf('R02'))).toEqual(['1,0', '2,0', '3,0', '1,1', '3,1', '3,2', '3,3', '3,4', '3,5']);
    expect(cellsOf(pieceOf('R07'))).toEqual(['1,0', '2,0', '1,1', '2,1', '2,2', '2,3']);
    expect(cellsOf(pieceOf('R11'))).toEqual(['0,0', '1,0', '2,0', '2,1', '0,2', '1,2', '2,2', '0,3']);
    expect(cellsOf(pieceOf('R15'))).toEqual(['0,0', '3,0', '0,1', '3,1', '0,2', '1,2', '2,2', '3,2']);
    // Three by three, three by four, and then four by four: wide, then long.
    expect(Object.fromEntries([...FREE, ...MIXES].sort().map((id) => [id, extentOf(pieceOf(id))]))).toEqual({
      R03: [3, 3], R04: [3, 4], R05: [4, 4], R06: [4, 4], R08: [4, 4], R09: [4, 4], R10: [4, 4], R12: [4, 4], R13: [4, 4], R14: [4, 4], R16: [4, 4], R17: [4, 4], R18: [4, 4],
    });
    for (const id of [...FREE, ...MIXES]) {
      const spec = pieceOf(id);
      const [wide, long] = extentOf(spec);
      // Nothing is cut out of the rectangle: a board that is not a square is a square with a column cut off its side.
      expect(cellsOf(spec), id).toHaveLength(wide * long);
      expect(spec.holes === undefined, id).toBe(id !== 'R04');
    }
    expect(pieceOf('R04').holes).toEqual([{ x: 3, z: 0 }, { x: 3, z: 1 }, { x: 3, z: 2 }, { x: 3, z: 3 }]);
    expect(ROAD.map((spec) => spec.size)).toEqual([6, 6, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
    // The floor is open where a piece starts on it or sends the player down to it.
    expect(ROAD.filter((spec) => spec.floor).map((spec) => spec.id)).toEqual(['R02', 'R13', 'R15', 'R16', 'R17', 'R18']);
  });

  it('has a fixed die on its lessons and on R16 only, and never under the player', () => {
    const fixed = Object.fromEntries(ROAD.map((spec) => [spec.id, spec.layout!.dice.filter((die) => die.fixed).map((die) => die.top)]).filter(([, tops]) => tops.length > 0));
    expect(fixed).toEqual({ R01: [2], R02: [3, 3], R07: [2], R11: [3, 3, 2], R15: [2, 3, 3], R16: [3] });
    for (const spec of ROAD) {
      const { dice, start: at } = spec.layout!;
      for (const die of dice.filter((die) => die.fixed)) expect(spec.faces, `${spec.id} ${die.x},${die.z}`).toContain(die.top);
      expect(dice.some((die) => die.fixed && die.x === at.x && die.z === at.z), spec.id).toBe(false);
    }
    // On a lesson every die that waits is fixed: what is free is what its way rolls or pushes.
    for (const id of LESSONS) {
      const spec = pieceOf(id);
      const stair = new Set((spec.layout!.leaving ?? []).map(({ die }) => die));
      const moved = new Set(wayOf(spec).map((move) => `${move.x},${move.z}`));
      for (const [i, die] of spec.layout!.dice.entries()) if (!die.fixed && !stair.has(i)) expect(moved.has(`${die.x},${die.z}`), `${id} ${die.x},${die.z}`).toBe(true);
    }
  });

  it('has a stair on two pieces, a die laid as leaving in one move, and starts the player on the floor on three', () => {
    expect(ROAD.filter((spec) => spec.layout!.leaving).map((spec) => spec.id)).toEqual(['R02', 'R13']);
    expect(ROAD.filter((spec) => spec.layout!.onFloor).map((spec) => spec.id)).toEqual(['R02', 'R13', 'R16']);
    for (const id of ['R02', 'R13']) {
      const { layout } = pieceOf(id);
      expect(layout!.leaving, id).toEqual([{ die: 0, moves: 1 }]);
      // The stair is the cell to the north of the player, and is no die of the combo.
      expect(layout!.dice[0], id).toMatchObject({ x: layout!.start.x, z: layout!.start.z - 1 });
      expect(layout!.dice[0].fixed, id).toBeUndefined();
      expect(pieceOf(id).faces, id).not.toContain(layout!.dice[0].top);
    }
  });

  it('starts with no combo ready to go, and no die showing a 1 but the one that rides to its 3 on the second piece', () => {
    for (const spec of ROAD) {
      const state = start(spec);
      const tops = new Array<number>(spec.size * spec.size).fill(0);
      for (const cube of state.cubes) if (cube.state === 'idle' && (spec.faces ?? []).includes(cube.ori.top)) tops[cube.z * spec.size + cube.x] = cube.ori.top;
      expect(hasReadyGroup(tops, spec.size), spec.id).toBe(false);
      if (spec.id !== 'R02') expect(spec.layout!.dice.some((die) => die.top === 1), spec.id).toBe(false);
    }
  });

  it('keeps a way that clears each piece in as many moves as the piece says, and the solver finds no shorter one', { timeout: 60_000 }, () => {
    expect(ROAD.map((spec) => spec.par)).toEqual([4, 4, 2, 2, 2, 3, 3, 3, 2, 4, 3, 3, 3, 3, 2, 2, 3, 4]);
    for (const spec of ROAD) {
      expect(spec.solution, spec.id).toHaveLength(spec.par!);
      const { state } = tryWay(spec, wayOf(spec));
      expect(state.endReason, spec.id).toBe('passed');
      expect(state.levelRun!.moves, spec.id).toBe(spec.par);
      const solved = solveLevel(spec);
      expect(solved.exhausted, spec.id).toBe(true);
      expect(solved.solution!.par, spec.id).toBe(spec.par);
    }
  });

  it('is cleared by the keys written for each piece, the steps among them, in as many moves as the piece says', () => {
    for (const spec of ROAD) {
      const { state } = playKeys(spec);
      expect(state.endReason, spec.id).toBe('passed');
      expect(state.levelRun!.moves, spec.id).toBe(spec.par);
      // The moves among the keys are the way the piece keeps.
      const moves = KEYS[spec.id].split(' ').filter((key) => key.endsWith(':roll') || key.endsWith(':push'));
      expect(moves.map((key) => key[0]), spec.id).toEqual(wayOf(spec).map((move) => move.dir));
      expect(moves.map((key) => key.endsWith(':push')), spec.id).toEqual(wayOf(spec).map((move) => move.push));
    }
  });
});

describe('the lessons of the road', () => {
  it('carry the three lines, each on the piece that teaches the move its line speaks of', () => {
    expect(ROAD_HINTS).toEqual({ R07: { key: 'roadHintChain', until: 'chain' }, R11: { key: 'roadHintWalk', until: 'walk' }, R15: { key: 'roadHintPush', until: 'push' } });
    for (const id of Object.keys(ROAD_HINTS)) expect(LESSONS, id).toContain(id);
    expect(playKeys(pieceOf('R07')).events).toContain('chain');
    expect(playKeys(pieceOf('R11')).hops.some((hop) => hop.from && hop.to)).toBe(true);
    expect(KEYS.R15).toContain(':descend');
    expect(KEYS.R15).toContain(':push');
  });

  it('start in their southmost row, so that the road goes on up the screen and nothing of them lies behind the joint', () => {
    for (const id of LESSONS) {
      const spec = pieceOf(id);
      const south = Math.max(...cellsOf(spec).map((cell) => Number(cell.split(',')[1])));
      expect(spec.layout!.start.z, id).toBe(south);
    }
  });

  it('bring a face up from a side the player sees: the last roll of every die of a way is to the north or to the west', () => {
    for (const id of LESSONS) {
      const way = wayOf(pieceOf(id)).filter((move) => !move.push);
      way.forEach((move, i) => {
        const { dx, dz } = { N: { dx: 0, dz: -1 }, E: { dx: 1, dz: 0 }, S: { dx: 0, dz: 1 }, W: { dx: -1, dz: 0 } }[move.dir];
        const next = way[i + 1];
        const lastOfDie = !next || next.x !== move.x + dx || next.z !== move.z + dz;
        if (lastOfDie) expect(['N', 'W'], `${id} ${move.x},${move.z}`).toContain(move.dir);
      });
    }
  });

  it('are few boards, walked whole: none can be lost but the lesson of the chain, by a chain that is missed', { timeout: 60_000 }, () => {
    // Every board the player can come to by moves and by steps is walked from the start (src/levels/walk.ts).
    const seen: Record<string, [number, number, number]> = {};
    for (const id of LESSONS) {
      const walk = walkBoards(pieceOf(id), 2000);
      expect(walk.capped, `${id}: more boards than a lesson has`).toBe(false);
      seen[id] = [walk.boards, walk.worst, walk.lost];
    }
    // Boards, the most moves from any of them, and the boards that are lost.
    expect(seen).toEqual({ R01: [5, 4, 0], R02: [10, 6, 0], R07: [10, 3, 2], R11: [14, 6, 0], R15: [11, 4, 0] });
    // The chain that is missed is a dead end the level says at once: nothing is left to be rolled about on.
    expect(lostOf(pieceOf('R07'))).toEqual({ boards: 6, lost: 2, said: 2, worst: 3 });
  });

  it('R01: a 2 on top and four rolls to the north that bring the 2 back up beside the fixed 2', () => {
    const spec = pieceOf('R01');
    expect(spec.solution).toEqual(['2,5,N', '2,4,N', '2,3,N', '2,2,N']);
    expect(spec.layout!.dice).toEqual([{ x: 2, z: 5, top: 2, north: 4 }, { x: 2, z: 0, top: 2, north: 1, fixed: true }]);
    // By the roll of the rules itself, with nothing of the level around it.
    let ori: Orientation = { ...start(spec).cubes.find((cube) => cube.z === 5)!.ori };
    const tops = [ori.top];
    for (let i = 0; i < 4; i++) {
      ori = roll(ori, 'N');
      tops.push(ori.top);
    }
    expect(tops).toEqual([2, 3, 5, 4, 2]);
  });

  it('R02: up by the die that is leaving, over, three rolls north with the 3 on the east side and the turn west', () => {
    const spec = pieceOf('R02');
    expect(spec.solution).toEqual(['3,3,N', '3,2,N', '3,1,N', '3,0,W']);
    const state = start(spec);
    expect(state.player).toEqual({ x: 3, z: 5, level: 'ground' });
    go(state, 'N');
    expect(state.player).toEqual({ x: 3, z: 4, level: 'top' });
    go(state, 'N');
    expect(state.player).toEqual({ x: 3, z: 3, level: 'top' });
    expect(state.levelRun!.moves).toBe(0);
    for (const dir of ['N', 'N', 'N'] as const) {
      go(state, dir);
      expect(cubeAt(state, state.player.x, state.player.z)!.ori.east).toBe(3);
    }
    go(state, 'W');
    expect(state.endReason).toBe('passed');
    expect(state.levelRun!.moves).toBe(spec.par);
  });

  it('R07: three 2s where a combo takes two, so the third leaves only by the chain, and it is one roll away when the combo is made', () => {
    const spec = pieceOf('R07');
    expect(spec.faces).toEqual([2]);
    expect(spec.layout!.dice).toHaveLength(3);
    expect(tryWay(spec, wayOf(spec)).uses).toEqual(['link']);
    expect(parWithout(spec, 'link')).toBeNull();
    const state = start(spec);
    go(state, 'N');
    go(state, 'N');
    expect(state.cubes.filter((cube) => cube.state === 'sinking')).toHaveLength(2);
    // A step, which is no move, and one roll.
    go(state, 'N');
    expect(state.levelRun!.moves).toBe(2);
    go(state, 'W');
    expect(state.endReason).toBe('passed');
    expect(state.levelRun!.bestChain).toBeGreaterThanOrEqual(1);
    // The chain is still made by one who rolls the third die the wrong way first: over the die of the combo beside it.
    const wrong = start(spec);
    for (const dir of ['N', 'N', 'N', 'S', 'W'] as const) go(wrong, dir);
    expect(wrong.endReason).toBe('passed');
    expect(wrong.levelRun!.moves).toBe(4);
  });

  it('R11: the only way to the second die is over the dice of the combo that is leaving', () => {
    const spec = pieceOf('R11');
    expect(parWithout(spec, 'bridge')).toBeNull();
    expect(tryWay(spec, wayOf(spec)).uses).toEqual([]);
    const { hops, state } = playKeys(spec);
    // From the die that made the 3s over the two that waited, and off them onto the die that stands.
    expect(hops).toEqual([{ from: true, to: true }, { from: true, to: true }, { from: true, to: false }]);
    expect(state.endReason).toBe('passed');
    // The steps are no moves, so the dice go no further down while the player walks: there is no hurry.
    const walk = start(spec);
    go(walk, 'N');
    for (const dir of ['E', 'E', 'W', 'W', 'E', 'E', 'N'] as const) go(walk, dir);
    expect(walk.levelRun!.moves).toBe(1);
    expect(walk.cubes.filter((cube) => cube.state === 'sinking')).toHaveLength(3);
    expect(walk.player).toMatchObject({ x: 2, z: 1, level: 'top' });
  });

  it('R15: one empty cell beside the dice that are leaving, the way down; on the floor one push, and nothing clears the piece but it', () => {
    const spec = pieceOf('R15');
    expect(spec.floor).toBe(true);
    expect(spec.layout!.onFloor).toBeUndefined();
    expect(parWithout(spec, 'push')).toBeNull();
    const state = start(spec);
    go(state, 'N');
    // The die under the player has made the 2s and is leaving, and so is the 2 that waited.
    const leaving = state.cubes.filter((cube) => cube.state === 'sinking');
    expect(leaving.map((cube) => [cube.x, cube.z])).toEqual([[3, 1], [3, 0]]);
    // Of the cells beside the two, one is empty: the cell the die came from. A step back is the step down.
    const beside = new Set<string>();
    for (const cube of leaving) {
      for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const cell = `${cube.x + dx},${cube.z + dz}`;
        if (cellsOf(spec).includes(cell) && !cubeAt(state, cube.x + dx, cube.z + dz)) beside.add(cell);
      }
    }
    expect([...beside]).toEqual(['3,2']);
    expect(DIRS.map((dir) => resolveMove(state, dir).kind)).toEqual(['hop', 'blocked', 'descend', 'blocked']);
    go(state, 'S');
    expect(state.player).toEqual({ x: 3, z: 2, level: 'ground' });
    expect(state.levelRun!.moves).toBe(1);
    // Along the floor: a step west, and there the push; no other cell of the floor has one.
    expect(DIRS.map((dir) => resolveMove(state, dir).kind)).toEqual(['mount', 'blocked', 'blocked', 'walk']);
    go(state, 'W');
    expect(DIRS.map((dir) => resolveMove(state, dir).kind)).toEqual(['blocked', 'walk', 'blocked', 'push']);
    go(state, 'W');
    expect(state.endReason).toBe('passed');
    // The die that is pushed shows the face of its combo from the start, and is not turned.
    expect(spec.layout!.dice[1]).toMatchObject({ x: 1, z: 2, top: 3 });
  });
});

/** What the place of a piece misses of what the edition asks, by the words of the judge: nothing, for a piece not named. */
const MISSES: Readonly<Record<string, string[]>> = {
  // The hasty persona makes its first move blind on a board whose combo is two moves off, and wanders: the piece cannot be lost.
  R05: ['hasty 0.57 is under 0.70'],
  R08: ['hasty 0.57 is under 0.70'],
  // One first move keeps the board in hand: the roll that makes the 3s.
  R09: ['first moves 1, not 2-99'],
};

describe('the free pieces and the mixes', () => {
  it('are what their places ask, judged as a board laid for the place is, but for three that miss a number', { timeout: 240_000 }, () => {
    const firsts: Record<string, number | null> = {};
    const runs: Record<string, [number, number]> = {};
    for (const place of ROAD_PLACES) {
      const spec = pieceOf(place.id);
      // The board of the piece is judged as the one board laid by hand for its place.
      const { fit, why } = judge({ ...place, sketch: [spec.layout!] }, SKETCH + 1, { near: true });
      expect(fit, `${place.id}: ${why}`).not.toBeNull();
      expect(fit!.misses, place.id).toEqual(MISSES[place.id] ?? []);
      expect(fit!.par, place.id).toBe(spec.par);
      expect(fit!.spec.solution, place.id).toHaveLength(spec.par!);
      firsts[place.id] = fit!.firsts;
      // The runs of thirty that clear the board, of the hasty persona and of the casual one.
      runs[place.id] = [Math.round(fit!.shares!.hasty! * 30), Math.round(fit!.shares!.casual! * 30)];
    }
    expect(firsts).toEqual({ R03: 2, R04: 2, R05: 2, R06: 3, R08: 2, R09: 1, R10: 3, R12: 2, R13: 2, R14: 2, R16: 2, R17: 2, R18: 2 });
    expect(runs).toEqual({
      R03: [24, 29], R04: [26, 30], R05: [17, 30], R06: [24, 29], R08: [17, 30], R09: [29, 30], R10: [29, 30],
      R12: [28, 29], R13: [25, 30], R14: [28, 27], R16: [30, 30], R17: [27, 29], R18: [24, 25],
    });
  });

  it('are boards their places lay: eight from a seed, and five laid by hand rules that are the sketch of their place', () => {
    const laid = (layout: LevelSpec['layout']) => ({ start: layout!.start, floor: layout!.onFloor === true, dice: layout!.dice.map((die) => JSON.stringify(die)).sort() });
    for (const [id, seed] of Object.entries(ROAD_SEEDS)) {
      const place = ROAD_PLACES.find((one) => one.id === id)!;
      expect(laid(candidate(place, seed)!.layout), id).toEqual(laid(pieceOf(id).layout));
    }
    const sketched = ROAD_PLACES.filter((place) => place.sketch);
    expect(sketched.map((place) => place.id)).toEqual(['R05', 'R08', 'R09', 'R13', 'R16']);
    for (const place of sketched) expect(place.sketch, place.id).toEqual([pieceOf(place.id).layout]);
    expect([...Object.keys(ROAD_SEEDS), ...sketched.map((place) => place.id)].sort()).toEqual(ROAD_PLACES.map((place) => place.id));
  });

  it('R03, R04 and R05 cannot be lost, by what they are made of; R03 is counted whole, and is twelve moves from its farthest board', { timeout: 60_000 }, () => {
    // As many dice as the one combo of the one face takes, and the floor shut: no die leaves before all do, and the player is never off them.
    for (const id of ['R03', 'R04', 'R05']) {
      const spec = pieceOf(id);
      expect(spec.faces, id).toHaveLength(1);
      expect(spec.norm, id).toBe(spec.faces![0]);
      expect(spec.floor, id).toBe(false);
    }
    // The smallest is counted whole, by its moves: 8592 boards, the cleared one come to from every one of them, from the
    // farthest in twelve moves. So no open board holds «six moves from any board»: two dice on nine cells do not.
    expect(lostOf(pieceOf('R03'))).toEqual({ boards: 8592, lost: 0, said: 0, worst: 12 });
    // R04 was counted whole by the same count let run (2 539 344 boards, none lost, fifteen moves from the farthest):
    // a minute and a half, too long for a test. R05 is not counted: four dice on sixteen cells are some six hundred
    // million boards. Of both, the forty boards nearest the start are walked here, steps among them, and that is all
    // this says of them: the walk is cut, and says so.
    for (const id of ['R04', 'R05']) {
      const walk = walkBoards(pieceOf(id), 40);
      expect(walk, `${id} after ${walk.example}`).toMatchObject({ boards: 40, lost: 0, unsettled: 0, capped: true });
    }
  });

  it('are known near their start and no further: every board within two moves is solved, and a slip or two costs what is written here', { timeout: 120_000 }, () => {
    // The boards within two moves of the start, all of them; of those the dead ends the level says at once, the boards
    // lost that it does not say yet, and the most moves from any of the rest. Beyond this an open board is not counted:
    // the walk over the boards of any piece but R16 is cut wherever its limit is put (`node scripts/ladder.mjs road`).
    const near = Object.fromEntries([...FREE, ...MIXES].sort().map((id) => [id, nearOf(pieceOf(id))]));
    expect(near).toEqual({
      R03: [14, 0, 0, 4], R04: [11, 0, 0, 4], R05: [35, 0, 0, 4], R06: [32, 2, 0, 5], R08: [17, 1, 0, 5], R09: [12, 1, 2, 4], R10: [44, 5, 0, 6],
      R12: [6, 0, 0, 4], R13: [11, 1, 0, 4], R14: [22, 2, 0, 7], R16: [6, 0, 0, 1], R17: [6, 0, 0, 4], R18: [13, 0, 1, 10],
    });
    // Two moves astray cost two moves more than the fewest at the most, but on two mixes: R14 and R18 each have a board
    // two moves in that is far from cleared.
    const dear = Object.keys(near).filter((id) => near[id][3] > pieceOf(id).par! + 2);
    expect(dear).toEqual(['R14', 'R18']);
    // No piece of the first block is lost within two moves but its mix, and that by dead ends the level says at once.
    for (const id of ['R03', 'R04', 'R05']) expect(near[id].slice(1, 3), id).toEqual([0, 0]);
    expect(near.R06.slice(1, 3)).toEqual([2, 0]);
  });

  it('R03: the 2 of the die under the player is on its south side, and a roll to either side and one north bring it up', () => {
    const spec = pieceOf('R03');
    const state = start(spec);
    expect(cubeAt(state, 1, 2)!.ori.south).toBe(2);
    expect(cubeAt(state, 1, 1)!.ori.top).toBe(2);
    for (const side of ['E', 'W'] as const) {
      const run = start(spec);
      go(run, side);
      expect(cubeAt(run, run.player.x, run.player.z)!.ori.south, side).toBe(2);
      go(run, 'N');
      expect(run.endReason, side).toBe('passed');
    }
  });

  it('R04: two 3s stand side by side, the die of the player is off to the south with its 3 on the east side, and the pair rolled away comes back', () => {
    const spec = pieceOf('R04');
    const state = start(spec);
    expect(spec.layout!.dice.slice(1)).toMatchObject([{ x: 0, z: 1, top: 3 }, { x: 1, z: 1, top: 3 }]);
    expect(cubeAt(state, 1, 3)!.ori.east).toBe(3);
    // A 3 of the pair is rolled off to the north and back: it shows its 3 again, and the way of the piece still clears it.
    for (const dir of ['N', 'N', 'N', 'S', 'S', 'S'] as const) go(state, dir);
    expect(state.player).toMatchObject({ x: 1, z: 3 });
    expect(cubeAt(state, 1, 1)!.ori.top).toBe(3);
    expect(state.levelRun!.moves).toBe(4);
    go(state, 'N');
    go(state, 'W');
    expect(state.endReason).toBe('passed');
  });

  it('R05: three 4s as a corner with the player on one of them, and the first key is a step onto the fourth die', () => {
    const spec = pieceOf('R05');
    const fours = spec.layout!.dice.filter((die) => die.top === 4).map((die) => `${die.x},${die.z}`);
    expect(fours).toEqual(['2,2', '3,2', '3,1']);
    expect(spec.layout!.start).toEqual({ x: 2, z: 2 });
    expect(KEYS.R05.split(' ')[0]).toBe('W:hop');
    // The die of the start is not moved: no way as short begins with it.
    expect(wayOf(spec).every((move) => move.x !== 2 || move.z !== 2)).toBe(true);
    expect(solveLevel(spec, { first: 'own', maxMoves: spec.par }).solution).toBeNull();
    // North and east, or south and east: the fourth die goes round either end of the 4 the player stood on.
    expect(playKeys(spec, 'W:hop S:roll E:roll').state.endReason).toBe('passed');
  });

  it('R06: two combos in either order and no chain, by nothing that has not been taught', { timeout: 60_000 }, () => {
    const spec = pieceOf('R06');
    const report = tryWay(spec, wayOf(spec));
    expect(report.uses).toEqual([]);
    expect(report.cleared).toEqual([true, false, true]);
    expect(parWithout(spec, 'link', 'bridge', 'glass')).toBe(spec.par);
    // The 2s first, and then the 3s: as many moves. The way back to the die of the start is then over a 2 that is
    // leaving, which the road has not taught yet; the 3s first ask for nothing of the kind.
    const { state, events, hops } = playKeys(spec, 'S:hop W:hop S:roll E:roll N:hop N:hop W:roll');
    expect(state.endReason).toBe('passed');
    expect(state.levelRun!.moves).toBe(spec.par);
    expect(events.filter((type) => type === 'chain')).toHaveLength(0);
    expect(hops.slice(-2)).toEqual([{ from: true, to: true }, { from: true, to: false }]);
    expect(playKeys(spec).hops).toEqual([{ from: true, to: false }]);
  });

  it('R08: the chain is a gain and not a must: three moves with it, five without, and no walk over dice that are leaving', { timeout: 60_000 }, () => {
    const spec = pieceOf('R08');
    expect(tryWay(spec, wayOf(spec)).uses).toEqual(['link']);
    expect(parWithout(spec, 'link')).toBe(5);
    expect(parWithout(spec, 'bridge', 'glass')).toBe(spec.par);
    const { hops, events, state } = playKeys(spec);
    // The step back to the second die is from a die that is leaving onto one that stands.
    expect(hops).toEqual([{ from: true, to: false }]);
    expect(events.filter((type) => type === 'match')).toHaveLength(1);
    // One roll joins two dice to the pair: the die rolled, and the 2 that stood beside the cell it came to.
    expect(events.filter((type) => type === 'chain')).toHaveLength(1);
    expect(state.levelRun!.bestChain).toBeGreaterThanOrEqual(1);
  });

  it('R09: three 3s and one more, and within six moves nothing clears the board but the chain', { timeout: 60_000 }, () => {
    const spec = pieceOf('R09');
    expect(spec.layout!.dice).toHaveLength(4);
    expect(tryWay(spec, wayOf(spec)).uses).toEqual(['link']);
    // Without it the four have to come up as 3s side by side at once: nine moves, by the solver let run.
    expect(clearedWithout(spec, 4, 'link')).toBe(false);
    expect(parWithout(spec, 'bridge', 'glass')).toBe(spec.par);
    expect(playKeys(spec).hops).toEqual([{ from: true, to: false }]);
    // Both dice of the way show their 3 on the south side before the roll north that brings it up.
    const state = start(spec);
    expect([cubeAt(state, 1, 3)!.ori.south, cubeAt(state, 2, 2)!.ori.south]).toEqual([3, 3]);
  });

  it('R10: two faces, and the chain is the shorter of two whole ways: four moves with it, five without', { timeout: 60_000 }, () => {
    const spec = pieceOf('R10');
    const report = tryWay(spec, wayOf(spec));
    expect(report.uses).toEqual(['link']);
    expect(report.values).toEqual([3, 3, 2]);
    expect(parWithout(spec, 'link')).toBe(spec.par! + 1);
    expect(parWithout(spec, 'bridge', 'glass')).toBe(spec.par);
    // No step leads from one die that is leaving onto another: that is the walk, which comes after.
    expect(playKeys(spec).hops).toEqual([{ from: true, to: false }, { from: true, to: false }]);
  });

  it('R12: the walk over the 3s as they leave is a short cut, and the way round them is a move longer', { timeout: 60_000 }, () => {
    const spec = pieceOf('R12');
    expect(tryWay(spec, wayOf(spec)).uses).toEqual([]);
    expect(parWithout(spec, 'bridge')).toBe(spec.par! + 1);
    const { hops } = playKeys(spec);
    expect(hops).toEqual([{ from: true, to: true }, { from: true, to: true }, { from: true, to: false }]);
  });

  it('R13: up from the floor by the stair onto an open board, every die of it one that rolls', () => {
    const spec = pieceOf('R13');
    expect(spec.layout).toMatchObject({ start: { x: 0, z: 3 }, onFloor: true, leaving: [{ die: 0, moves: 1 }] });
    expect(spec.floor).toBe(true);
    expect(parWithout(spec, 'up')).toBeNull();
    const state = start(spec);
    go(state, 'N');
    expect(state.player).toEqual({ x: 0, z: 2, level: 'top' });
    go(state, 'N');
    expect(state.player).toEqual({ x: 0, z: 1, level: 'top' });
    expect(state.levelRun!.moves).toBe(0);
    // No die of the piece is fixed and no cell cut out: the die of the player and the two 3s all roll.
    expect(spec.holes).toBeUndefined();
    expect(spec.layout!.dice.some((die) => die.fixed)).toBe(false);
    for (const dir of ['E', 'S', 'E'] as const) go(state, dir);
    expect(state.endReason).toBe('passed');
  });

  it('R14: two faces, the walk and the chain, and the chain comes last', { timeout: 60_000 }, () => {
    const spec = pieceOf('R14');
    const report = tryWay(spec, wayOf(spec));
    expect(report.uses).toEqual(['link']);
    expect(report.values).toEqual([3, 2, 3]);
    expect(parWithout(spec, 'link')).toBe(spec.par! + 1);
    expect(parWithout(spec, 'bridge')).toBe(7);
    const { hops, events } = playKeys(spec);
    // Back to the last die over the dice that are leaving: from a 2 onto a 3, and off it onto the die that stands.
    expect(hops.slice(-2)).toEqual([{ from: true, to: true }, { from: true, to: false }]);
    expect(events.filter((type) => type === 'match')).toHaveLength(2);
    expect(events.filter((type) => type === 'chain')).toHaveLength(1);
    expect(events.lastIndexOf('chain')).toBeGreaterThan(events.lastIndexOf('match'));
  });

  it('R16: two dice that show their 3s are pushed to the 3 that waits, in either order, and no push is a wrong one', { timeout: 60_000 }, () => {
    const spec = pieceOf('R16');
    expect(spec.layout!.dice.map((die) => [die.top, die.fixed === true])).toEqual([[3, false], [3, false], [3, true]]);
    expect(wayOf(spec).map((move) => move.push)).toEqual([true, true]);
    expect(parWithout(spec, 'push')).toBeNull();
    const other = tryWay(spec, [...wayOf(spec)].reverse());
    expect(other.state.endReason).toBe('passed');
    expect(other.state.levelRun!.moves).toBe(2);
    // A push does not turn a die: the two show their 3s when the combo is made.
    const walk = walkBoards(spec, 2000);
    expect(walk).toEqual({ boards: 60, worst: 2, lost: 0, capped: false, unsettled: 0, example: null });
    expect(lostOf(spec)).toEqual({ boards: 5, lost: 0, said: 0, worst: 2 });
  });

  it('R17: down from the 2s as they leave, a push that makes the 3s, and up by them to the last die', { timeout: 60_000 }, () => {
    const spec = pieceOf('R17');
    const report = tryWay(spec, wayOf(spec));
    expect(report.values).toEqual([2, 3, 3]);
    expect(report.uses).toEqual(['link', 'floor']);
    // Without the floor, the push or the chain the board is not cleared in two moves more: ten moves, by the solver let run.
    for (const ban of ['floor', 'push', 'link'] as const) expect(clearedWithout(spec, 2, ban), ban).toBe(false);
    for (const kind of ['descend', 'push', 'mount']) expect(KEYS.R17, kind).toContain(':' + kind);
    const { events } = playKeys(spec);
    expect(events.lastIndexOf('chain')).toBeGreaterThan(events.lastIndexOf('match'));
    // There is a way as short that stays down: the 3s made by another push, and the last die pushed to the 2s.
    expect(parWithout(spec, 'up')).toBe(spec.par);
  });

  it('R18: everything at once, the longest way of the free pieces, and the chain comes last', { timeout: 60_000 }, () => {
    const spec = pieceOf('R18');
    expect(spec.par).toBe(Math.max(...[...FREE, ...MIXES].map((id) => pieceOf(id).par!)));
    const report = tryWay(spec, wayOf(spec));
    expect(report.values).toEqual([3, 2, 2]);
    expect(report.uses).toEqual(['link', 'floor']);
    // Without the chain, the push or the way up the board is not cleared in two moves more (eight, ten and eight
    // moves, by the solver let run), and without the walk over dice that are leaving it takes a move more.
    for (const ban of ['link', 'push', 'up'] as const) expect(clearedWithout(spec, 2, ban), ban).toBe(false);
    expect(parWithout(spec, 'bridge')).toBe(spec.par! + 1);
    const { hops, events, state } = playKeys(spec);
    expect(hops.filter((hop) => hop.from && hop.to).length).toBeGreaterThanOrEqual(3);
    for (const kind of ['descend', 'push', 'mount']) expect(KEYS.R18, kind).toContain(':' + kind);
    expect(events.filter((type) => type === 'match')).toHaveLength(2);
    expect(events.filter((type) => type === 'chain')).toHaveLength(1);
    expect(events.lastIndexOf('chain')).toBeGreaterThan(events.lastIndexOf('match'));
    expect(state.endReason).toBe('passed');
  });
});

describe('what a piece does when the player waits', () => {
  it('opens the first piece with the sign of its swipe, to the north, and the rest with none', () => {
    expect(ROAD_SIGNS).toEqual({ R01: 'N' });
    expect(moveOf(ROAD[0].solution![0]).dir).toBe('N');
  });

  it('blinks the plaque, shows the sign and counts the moves wasted, on every piece of the road', () => {
    const rest = { blinkMs: 4000, signMs: 8000, wasted: 3 };
    expect(ROAD_IDLE.R01).toEqual({ blinkMs: null, signMs: 6000, wasted: null });
    for (const spec of ROAD.slice(1)) expect(ROAD_IDLE[spec.id], spec.id).toEqual(rest);
    expect(Object.keys(ROAD_IDLE)).toEqual(ROAD.map((spec) => spec.id));
  });
});

describe('the place of the player on the road', () => {
  it('is its first piece for one who is new', () => {
    expect(roadPlace(undefined, false)).toBe(0);
  });

  it('is the piece whose code is kept', () => {
    expect(roadPlace('R01', false)).toBe(0);
    expect(roadPlace('R05', false)).toBe(4);
    expect(roadPlace('R18', true)).toBe(17);
  });

  it('is the lesson of the chain for one who passed the first level of the build before the road and has no place kept', () => {
    expect(FIRST_PASSED).toBe('R07');
    expect(roadPlace(undefined, true)).toBe(6);
    expect(ROAD[6].id).toBe('R07');
    expect(ROAD_BLOCKS[0].to).toBe(5);
  });

  it('is past the road for the code of the piece after its last, and the first piece for any other code that names none', () => {
    expect(ROAD_END).toBe('R19');
    expect(roadPlace('R19', false)).toBeNull();
    expect(roadPlace('R19', true)).toBeNull();
    expect(roadPlace('R20', false)).toBe(0);
    expect(roadPlace('R21', false)).toBe(0);
    expect(roadPlace('R99', true)).toBe(0);
    expect(roadPlace('', false)).toBe(0);
  });

  it('goes on by the code of the piece after: the next of the road, and after its last the code of its end', () => {
    expect(pieceAfter(0)).toBe('R02');
    expect(pieceAfter(5)).toBe('R07');
    expect(pieceAfter(17)).toBe(ROAD_END);
    expect(roadPlace(pieceAfter(17), false)).toBeNull();
    for (let i = 0; i + 1 < ROAD.length; i++) expect(pieceAfter(i)).toBe(ROAD[i + 1].id);
  });
});

describe('what was kept of a player of the first edition', () => {
  const stat = { tries: 1, passes: 1 };

  it('is of this edition for one who is new, with nothing changed', () => {
    expect(ROAD_EDITION).toBe(2);
    expect(toRoadEdition({ passed: {}, stats: {} })).toEqual({ passed: {}, stats: {}, roadEdition: 2 });
  });

  it('loses what was passed and counted under the codes of the road, keeps the levels of the list, and starts the road again', () => {
    const kept = { passed: { R01: true, R02: true, R07: true, P03: true, F1: true }, stats: { R01: stat, R07: stat, P03: stat }, road: 'R08' };
    expect(toRoadEdition(kept)).toEqual({ passed: { P03: true, F1: true }, stats: { P03: stat }, road: 'R01', roadEdition: 2 });
    // What was given is not changed.
    expect(kept.passed.R01).toBe(true);
    expect(kept.road).toBe('R08');
    for (const road of ['R01', 'R12', 'R20', 'R19', '', 'X']) expect(toRoadEdition({ passed: {}, stats: {}, road }).road, road).toBe('R01');
  });

  it('keeps past the road one who had cleared it: the code after the last of its twenty pieces becomes the end of this one', () => {
    const moved = toRoadEdition({ passed: { R20: true, P01: true }, stats: { R20: stat }, road: 'R21' });
    expect(moved).toEqual({ passed: { P01: true }, stats: {}, road: ROAD_END, roadEdition: 2 });
    expect(roadPlace(moved.road, false)).toBeNull();
  });

  it('leaves one with no place kept with none: new, or from the build before the road', () => {
    const before: RoadKept = { passed: { F1: true }, stats: {} };
    expect(toRoadEdition(before).road).toBeUndefined();
    expect(toRoadEdition(before).passed).toEqual({ F1: true });
    expect(roadPlace(toRoadEdition(before).road, true)).toBe(6);
  });

  it('gives back as it is what is of this edition already, the stars of its pieces among it', () => {
    const kept = { passed: { R01: true, R03: true, P03: true }, stats: { R03: stat }, road: 'R04', roadEdition: 2 };
    expect(toRoadEdition(kept)).toBe(kept);
    const done = { passed: { R18: true }, stats: { R18: stat }, road: ROAD_END, roadEdition: 2 };
    expect(toRoadEdition(done)).toBe(done);
  });
});

describe('the blocks of the road', () => {
  it('are four, and only the first is seen at one scale', () => {
    expect(ROAD_BLOCKS).toEqual([
      { from: 0, to: 5, oneScale: true },
      { from: 6, to: 9, oneScale: false },
      { from: 10, to: 13, oneScale: false },
      { from: 14, to: 17, oneScale: false },
    ]);
  });

  it('name the block a piece is in', () => {
    expect(blockOf(0)).toBe(ROAD_BLOCKS[0]);
    expect(blockOf(5)).toBe(ROAD_BLOCKS[0]);
    expect(blockOf(6)).toBe(ROAD_BLOCKS[1]);
    expect(blockOf(10)).toBe(ROAD_BLOCKS[2]);
    expect(blockOf(17)).toBe(ROAD_BLOCKS[3]);
    expect(blockOf(18)).toBeNull();
    expect(blockOf(-1)).toBeNull();
  });
});

describe('the middle of a piece', () => {
  it('is the middle of the cells that are left of its square, which is what the camera is put over', () => {
    expect(pieceMiddle(pieceOf('R01'))).toEqual({ x: 2, z: 2.5 });
    expect(pieceMiddle(pieceOf('R02'))).toEqual({ x: 2, z: 2.5 });
    expect(pieceMiddle(pieceOf('R03'))).toEqual({ x: 1, z: 1 });
    expect(pieceMiddle(pieceOf('R04'))).toEqual({ x: 1, z: 1.5 });
    expect(pieceMiddle(pieceOf('R07'))).toEqual({ x: 1.5, z: 1.5 });
  });

  it('is the middle of the square for a board with nothing cut out', () => {
    expect(pieceMiddle({ size: 5 })).toEqual({ x: 2, z: 2 });
    expect(pieceMiddle({ size: 4, holes: [] })).toEqual({ x: 1.5, z: 1.5 });
    expect(pieceMiddle(pieceOf('R05'))).toEqual({ x: 1.5, z: 1.5 });
  });
});

describe('the place kept after a piece is passed', () => {
  it('moves on by one when the piece passed is the piece the player is on', () => {
    expect(placeAfter('R04', false, 3)).toBe('R05');
    expect(placeAfter('R06', false, 5)).toBe('R07');
    expect(placeAfter('R18', false, 17)).toBe(ROAD_END);
  });

  it('stays where it is when a piece further on is played by its address', () => {
    expect(placeAfter('R04', false, 16)).toBe('R04');
    expect(placeAfter(undefined, false, 16)).toBeUndefined();
  });

  it('stays where it is when a piece behind is played again', () => {
    expect(placeAfter('R09', false, 2)).toBe('R09');
    expect(placeAfter(undefined, true, 0)).toBeUndefined();
  });

  it('stays past the road whatever is passed', () => {
    for (let piece = 0; piece < ROAD.length; piece++) expect(placeAfter(ROAD_END, false, piece)).toBe(ROAD_END);
  });

  it('takes one who is new, with nothing kept, from the first piece to the second', () => {
    expect(placeAfter(undefined, false, 0)).toBe('R02');
    // One who passed the first level of the build before the road stands after the first block with nothing kept.
    expect(placeAfter(undefined, true, 6)).toBe('R08');
  });
});
