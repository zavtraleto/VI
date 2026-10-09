import { describe, expect, it } from 'vitest';
import { cubeAt } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { worldRuns } from '../rules/level';
import { randomMoves, randomPlay } from '../rules/levelBot';
import { explore, moveOf, solveLevel, tryWay } from '../rules/levelSolver';
import { resolveMove } from '../rules/movement';
import { roll } from '../rules/orientation';
import { createRun, step } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import type { Ban } from '../rules/reach';
import type { Dir, LevelSpec, MoveKind, Orientation, RunState } from '../rules/types';
import { LEVELS } from './levels';
import { walkBoards } from './walk';
import { FIRST_PASSED, ROAD, ROAD_BLOCKS, ROAD_HINTS, ROAD_IDLE, ROAD_SIGNS, blockOf, pieceAfter, pieceMiddle, placeAfter, roadPlace } from './road';

/**
 * The pieces of the road: they are proved the way the list of the levels is, and, since the
 * player of the first block is let to wander, from every board they can come to as well.
 */

const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];
const BLOCK_ONE = ROAD.slice(0, 7);
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

/** The steps that bring the player to their die on the piece with the stair; no other piece asks for any. */
const STEPS: Readonly<Record<string, readonly Dir[]>> = { R02: ['N', 'N'] };

/** What the die of each move of the way of a piece shows on top, before the move and after it. */
function topsAlong(spec: LevelSpec): number[][] {
  const state = start(spec);
  for (const dir of STEPS[spec.id] ?? []) go(state, dir);
  const seen: number[][] = [];
  for (const move of wayOf(spec)) {
    // The die of the move is the one under the player, or the one beside them they step onto.
    if (state.player.x !== move.x || state.player.z !== move.z) {
      const side = DIRS.find((dir) => {
        const to = resolveMove(state, dir);
        return to.kind === 'hop' && to.tx === move.x && to.tz === move.z;
      });
      expect(side, `${spec.id}: a step to ${move.x},${move.z}`).toBeDefined();
      go(state, side!);
    }
    const cube = cubeAt(state, move.x, move.z)!;
    const before = cube.ori.top;
    go(state, move.dir);
    const last = seen[seen.length - 1];
    if (last && last[last.length - 1] === before && cubeAt(state, move.x, move.z) === undefined) last.push(cube.ori.top);
    else seen.push([before, cube.ori.top]);
  }
  expect(state.endReason, spec.id).toBe('passed');
  expect(state.levelRun!.moves, spec.id).toBe(spec.par);
  return seen;
}

describe('the first block of the road', () => {
  it('is seven pieces, R01 to R07, laid die by die: nothing comes, no limit of moves, and the dice laid are the dice of the goal', () => {
    expect(BLOCK_ONE.map((spec) => spec.id)).toEqual(['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07']);
    expect(ROAD_BLOCKS[0]).toEqual({ from: 0, to: 6, oneScale: true });
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

  it('changes the face that works from piece to piece: 2, 3, 2, 3, 2, 4, and both on the last', () => {
    expect(BLOCK_ONE.map((spec) => spec.faces)).toEqual([[2], [3], [2], [3], [2], [4], [2, 3]]);
    for (const spec of BLOCK_ONE) expect(spec.values, spec.id).toEqual(spec.faces);
  });

  it('is the boards of the pictures: the cells that are left, and the floor shut on all but the piece with the stair', () => {
    expect(cellsOf(pieceOf('R01'))).toEqual(['2,0', '2,1', '2,2', '2,3', '2,4', '2,5']);
    expect(cellsOf(pieceOf('R02'))).toEqual(['1,0', '2,0', '3,0', '1,1', '3,1', '3,2', '3,3', '3,4', '3,5']);
    expect(cellsOf(pieceOf('R03'))).toEqual(['0,0', '1,0', '0,1', '1,1']);
    expect(cellsOf(pieceOf('R04'))).toEqual(['1,0', '2,0', '1,1', '0,2', '1,2', '2,2']);
    expect(cellsOf(pieceOf('R05'))).toEqual(['2,0', '2,1', '0,2', '1,2', '2,2', '3,2']);
    expect(cellsOf(pieceOf('R06'))).toEqual(['0,0', '1,0', '0,1', '1,1', '2,1', '3,1', '2,2']);
    expect(cellsOf(pieceOf('R07'))).toEqual(['0,0', '1,0', '0,1', '1,1', '1,2', '1,3', '2,3', '3,3', '2,4']);
    expect(BLOCK_ONE.map((spec) => [spec.size, spec.floor])).toEqual([[6, false], [6, true], [2, false], [3, false], [4, false], [4, false], [5, false]]);
  });

  it('is no wider than four cells anywhere, and no piece is larger than the strip it begins with', () => {
    for (const spec of BLOCK_ONE) {
      const xs = cellsOf(spec).map((cell) => Number(cell.split(',')[0]));
      expect(Math.max(...xs) - Math.min(...xs) + 1, spec.id).toBeLessThanOrEqual(4);
      expect(spec.size, spec.id).toBeLessThanOrEqual(ROAD[0].size);
    }
  });

  it('starts every piece in its southmost row, so that the road goes on up the screen', () => {
    for (const spec of BLOCK_ONE) {
      const south = Math.max(...cellsOf(spec).map((cell) => Number(cell.split(',')[1])));
      expect(spec.layout!.start.z, spec.id).toBe(south);
    }
  });

  it('has every die that waits for the player fixed, and never the die the player starts on', () => {
    // The dice of the player: the one under them, the one beside the stair, and the second die of the last piece.
    const own: Record<string, string[]> = { R01: ['2,5'], R02: ['3,3'], R03: ['1,1'], R04: ['2,2'], R05: ['0,2'], R06: ['2,2'], R07: ['2,4', '1,3'] };
    for (const spec of BLOCK_ONE) {
      const { dice, leaving, start: at } = spec.layout!;
      const stair = new Set((leaving ?? []).map(({ die }) => die));
      const free = dice.filter((die, i) => !die.fixed && !stair.has(i)).map((die) => `${die.x},${die.z}`);
      expect(free, spec.id).toEqual(own[spec.id]);
      for (const die of dice.filter((die) => die.fixed)) expect(spec.faces, `${spec.id} ${die.x},${die.z}`).toContain(die.top);
      expect(dice.some((die) => die.fixed && die.x === at.x && die.z === at.z), spec.id).toBe(false);
    }
    expect(BLOCK_ONE.map((spec) => spec.layout!.dice.filter((die) => die.fixed).map((die) => die.top))).toEqual([[2], [3, 3], [2], [3, 3], [2], [4, 4, 4], [3, 3, 2]]);
  });

  it('has its stair on the second piece only: a die laid as leaving in one move, the player on the floor to the south of it', () => {
    for (const spec of BLOCK_ONE) {
      if (spec.id === 'R02') continue;
      expect(spec.layout!.leaving, spec.id).toBeUndefined();
      expect(spec.layout!.onFloor, spec.id).toBeUndefined();
    }
    const { layout } = pieceOf('R02');
    expect(layout).toMatchObject({ start: { x: 3, z: 5 }, onFloor: true, leaving: [{ die: 0, moves: 1 }] });
    expect(layout!.dice[0]).toMatchObject({ x: 3, z: 4 });
    expect(layout!.dice[0].fixed).toBeUndefined();
  });

  it('starts with no combo ready to go', () => {
    for (const spec of ROAD) {
      const state = start(spec);
      const tops = new Array<number>(spec.size * spec.size).fill(0);
      for (const cube of state.cubes) if (cube.state === 'idle' && (spec.faces ?? []).includes(cube.ori.top)) tops[cube.z * spec.size + cube.x] = cube.ori.top;
      expect(hasReadyGroup(tops, spec.size), spec.id).toBe(false);
    }
  });

  it('keeps a way that clears each piece in as many moves as the piece says, and the solver finds no shorter one', () => {
    expect(BLOCK_ONE.map((spec) => spec.par)).toEqual([4, 4, 1, 2, 3, 2, 4]);
    for (const spec of ROAD) {
      expect(spec.solution, spec.id).toHaveLength(spec.par!);
      const { state } = tryWay(spec, wayOf(spec));
      expect(state.endReason, spec.id).toBe('passed');
      expect(state.levelRun!.moves, spec.id).toBe(spec.par);
      const solved = solveLevel(spec);
      expect(solved.exhausted, spec.id).toBe(true);
      expect(solved.solution!.par, spec.id).toBe(spec.par);
      expect(solved.solution!.moves.length, spec.id).toBe(spec.par);
    }
  });

  it('opens with a 2 on top and four rolls to the north that bring the 2 back up beside the fixed 2', () => {
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

  it('shows on top, along the way of each piece, the faces the pictures say', () => {
    expect(topsAlong(pieceOf('R01'))).toEqual([[2, 3, 5, 4, 2]]);
    expect(topsAlong(pieceOf('R02'))).toEqual([[1, 5, 6, 2, 3]]);
    expect(topsAlong(pieceOf('R03'))).toEqual([[6, 2]]);
    expect(topsAlong(pieceOf('R04'))).toEqual([[5, 1, 3]]);
    expect(topsAlong(pieceOf('R05'))).toEqual([[6, 4, 1, 2]]);
    expect(topsAlong(pieceOf('R06'))).toEqual([[6, 5, 4]]);
    // Two dice, one after the other.
    expect(topsAlong(pieceOf('R07'))).toEqual([[4, 2], [1, 5, 6, 3]]);
  });

  it('brings the face up from the side the player sees it on: the south side by a roll to the north, the east side by a roll to the west', () => {
    // The last roll of every die of the way, and the side of the die the face of the combo was on before it.
    const seen: Record<string, string[]> = {};
    for (const spec of BLOCK_ONE) {
      const state = start(spec);
      for (const dir of STEPS[spec.id] ?? []) go(state, dir);
      const way = wayOf(spec);
      seen[spec.id] = [];
      way.forEach((move, i) => {
        if (state.player.x !== move.x || state.player.z !== move.z) go(state, DIRS.find((dir) => resolveMove(state, dir).tx === move.x && resolveMove(state, dir).tz === move.z)!);
        const cube = cubeAt(state, move.x, move.z)!;
        const { ori } = cube;
        const next = way[i + 1];
        const { dx, dz } = { N: { dx: 0, dz: -1 }, E: { dx: 1, dz: 0 }, S: { dx: 0, dz: 1 }, W: { dx: -1, dz: 0 } }[move.dir];
        const lastOfDie = !next || next.x !== move.x + dx || next.z !== move.z + dz;
        go(state, move.dir);
        if (lastOfDie) seen[spec.id].push(`${move.dir}:${cube.ori.top === ori.south ? 'south' : cube.ori.top === ori.east ? 'east' : 'hidden'}`);
      });
    }
    expect(seen).toEqual({ R01: ['N:south'], R02: ['W:east'], R03: ['W:east'], R04: ['N:south'], R05: ['N:south'], R06: ['W:east'], R07: ['N:south', 'W:east'] });
  });

  it('rides the die of the second piece three cells to the north before the turn to the west', () => {
    expect(pieceOf('R02').solution).toEqual(['3,3,N', '3,2,N', '3,1,N', '3,0,W']);
  });

  it('clears the second piece by the stair, played by its steps: up by the die that is leaving, over, and four rolls', () => {
    const spec = pieceOf('R02');
    const state = start(spec);
    expect(state.player).toEqual({ x: 3, z: 5, level: 'ground' });
    go(state, 'N');
    expect(state.player).toEqual({ x: 3, z: 4, level: 'top' });
    go(state, 'N');
    expect(state.player).toEqual({ x: 3, z: 3, level: 'top' });
    expect(state.levelRun!.moves).toBe(0);
    for (const dir of ['N', 'N', 'N', 'W'] as const) go(state, dir);
    expect(state.endReason).toBe('passed');
    expect(state.levelRun!.moves).toBe(spec.par);
  });

  it('clears the last piece by two combos one after the other, with no chain: the 2s, a step over to the second die, the 3s', () => {
    const spec = pieceOf('R07');
    const state = start(spec);
    go(state, 'N');
    expect(state.cubes.filter((cube) => cube.state === 'sinking').map((cube) => cube.ori.top)).toEqual([2, 2]);
    expect(state.over).toBe(false);
    // The step is no move: the 2s have not gone a move further down.
    go(state, 'W');
    expect(state.player).toEqual({ x: 1, z: 3, level: 'top' });
    expect(state.levelRun!.moves).toBe(1);
    for (const dir of ['N', 'N', 'W'] as const) go(state, dir);
    expect(state.endReason).toBe('passed');
    expect(state.levelRun!.moves).toBe(4);
    expect(state.levelRun!.bestChain).toBeLessThanOrEqual(1);
  });

  it('is cleared from every board the player can come to, in a few moves, and is never lost', () => {
    // Every board the player can come to by moves and by steps is walked from the start (src/levels/walk.ts).
    const worst: Record<string, number> = {};
    const boards: Record<string, number> = {};
    for (const spec of BLOCK_ONE) {
      const walk = walkBoards(spec, 2000);
      expect(walk.capped, `${spec.id}: more boards than a piece of the first block has`).toBe(false);
      // The only end there is, is the board cleared, and from every other board it is cleared in a few moves.
      expect(walk.lost, `${spec.id} after ${walk.example}`).toBe(0);
      boards[spec.id] = walk.boards;
      worst[spec.id] = walk.worst;
    }
    // Five moves at the most, but for the piece with the stair: its die can be rolled back into the two cells
    // the figure came up by, and from the far one the four rolls of its way are six.
    expect(worst).toEqual({ R01: 4, R02: 6, R03: 2, R04: 2, R05: 3, R06: 2, R07: 5 });
    expect(boards).toEqual({ R01: 5, R02: 10, R03: 4, R04: 4, R05: 5, R06: 4, R07: 15 });
  });

  it('shows the same face on a cell whatever way the die of the player came to it', () => {
    // Walked as above, but by the die alone: a cell and the die on it name its top.
    for (const spec of BLOCK_ONE) {
      const tops = new Map<string, number>();
      const seen = new Set<string>();
      const queue: Dir[][] = [[]];
      for (let at = 0; at < queue.length && at < 2000; at++) {
        const state = start(spec);
        for (const dir of queue[at]) go(state, dir);
        const key = JSON.stringify([state.cubes.map((c) => [c.id, c.x, c.z, c.ori.top, c.ori.north, c.state, c.t]), state.player]);
        if (seen.has(key)) continue;
        seen.add(key);
        for (const cube of state.cubes) {
          if (cube.fixed) continue;
          const name = `${cube.id}@${cube.x},${cube.z}`;
          if (tops.has(name)) expect(cube.ori.top, `${spec.id} ${name} after ${queue[at].join('')}`).toBe(tops.get(name));
          tops.set(name, cube.ori.top);
        }
        if (state.over) continue;
        for (const dir of DIRS) if (resolveMove(state, dir).kind !== 'blocked') queue.push([...queue[at], dir]);
      }
    }
  });
});

/**
 * The second, the third and the fourth block: two combos and the chain, the walk over dice that
 * are leaving, the push from the floor. Each begins with the piece that teaches its move, which
 * cannot be cleared without it; two easy pieces follow, and a piece that mixes what has been
 * taught. A piece can be lost here, and a move can be taken back.
 */
const LATER = ROAD.slice(7);

/** The pieces that teach a move, the easy ones after them, and the mixes that end the blocks. */
const LESSONS = ['R09', 'R13', 'R17'];
const EASY = ['R10', 'R11', 'R14', 'R15', 'R18', 'R19'];
const MIXES = ['R12', 'R16', 'R20'];

/**
 * How each piece is cleared, by the keys pressed: a roll, a step from die to die (`hop`), a
 * step up onto a die that is leaving (`mount`), a step down from one to the floor (`descend`),
 * a step along the floor (`walk`), a push. Only a roll and a push are moves.
 */
const KEYS: Readonly<Record<string, string>> = {
  R08: 'W:roll N:roll N:hop E:hop N:roll W:roll',
  R09: 'N:roll N:roll N:hop W:roll',
  R10: 'E:roll N:roll N:roll',
  R11: 'N:roll N:roll W:hop N:roll',
  R12: 'N:roll W:hop N:roll N:hop W:roll',
  R13: 'N:roll E:hop E:hop N:hop N:roll W:roll',
  R14: 'N:mount N:hop N:roll W:roll',
  R15: 'N:roll W:hop W:hop N:roll',
  R16: 'N:roll E:hop E:hop E:hop N:roll N:hop W:roll',
  R17: 'N:roll W:descend W:push',
  R18: 'N:push S:walk E:walk N:push',
  R19: 'N:roll E:descend N:push',
  R20: 'W:roll N:roll E:hop E:hop E:descend N:push N:mount W:hop N:roll',
};

/** What was seen as a piece was played by its keys. */
interface Played {
  state: RunState;
  /** For every step from die to die: whether the die left and the die come to were leaving. */
  hops: { from: boolean; to: boolean }[];
  /** The events of the whole way, by their kind. */
  events: string[];
}

/** Plays a piece by its keys, each checked against what the rules make of it. */
function playKeys(spec: LevelSpec): Played {
  const state = start(spec);
  const hops: Played['hops'] = [];
  const events: string[] = [];
  for (const key of KEYS[spec.id].split(' ')) {
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

/** Runs of the random player, of two hundred, that clear a piece in the moves such a run gets. */
function randomShare(spec: LevelSpec): number {
  let cleared = 0;
  for (let seed = 1; seed <= 200; seed++) if (randomPlay(spec, seed, randomMoves(spec.par!)).endReason === 'passed') cleared++;
  return cleared / 200;
}

/**
 * The boards of a piece the player can come to from which it can no longer be cleared, and how
 * many of them are dead ends the level says at once: too few dice, or nothing left to do.
 */
function lostOf(spec: LevelSpec): { lost: number; said: number } {
  const { complete, next, end } = explore(start(spec));
  expect(complete, spec.id).toBe(true);
  // The boards a cleared board can be come to from, found from the cleared one backwards.
  const leads = end.map((how) => how === 'passed');
  for (let grew = true; grew; ) {
    grew = false;
    next.forEach((to, at) => {
      if (!leads[at] && to.some((board) => leads[board])) leads[at] = grew = true;
    });
  }
  return { lost: leads.filter((led) => !led).length, said: end.filter((how) => how === 'count' || how === 'floor').length };
}

/** Whether a piece can be lost at all. */
const canBeLost = (spec: LevelSpec): boolean => lostOf(spec).lost > 0;

describe('the second, the third and the fourth block of the road', () => {
  it('are thirteen pieces, R08 to R20: a piece of two combos, and three times a lesson, two easy pieces and a mix', () => {
    expect(LATER.map((spec) => spec.id)).toEqual(['R08', 'R09', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R20']);
    expect(ROAD).toHaveLength(20);
    // Every lesson is followed by two easy pieces and then by a mix, which ends its block.
    for (const id of LESSONS) {
      const at = ROAD.findIndex((spec) => spec.id === id);
      expect(ROAD.slice(at + 1, at + 4).map((spec) => spec.id), id).toEqual([...EASY.filter((easy) => easy > id).slice(0, 2), MIXES.find((mix) => mix > id)]);
      expect(blockOf(at + 3), id).toBe(blockOf(at));
    }
    expect(ROAD_BLOCKS.slice(1).map((block) => ROAD[block.to].id)).toEqual(MIXES);
  });

  it('are small: no more than four cells a side, the last five rows long, three to six dice', () => {
    for (const spec of LATER) {
      const cells = cellsOf(spec).map((cell) => cell.split(',').map(Number));
      const wide = Math.max(...cells.map(([x]) => x)) - Math.min(...cells.map(([x]) => x)) + 1;
      const long = Math.max(...cells.map(([, z]) => z)) - Math.min(...cells.map(([, z]) => z)) + 1;
      expect(wide, spec.id).toBeGreaterThanOrEqual(2);
      expect(wide, spec.id).toBeLessThanOrEqual(4);
      expect(long, spec.id).toBeGreaterThanOrEqual(3);
      expect(long, spec.id).toBeLessThanOrEqual(spec.id === 'R20' ? 5 : 4);
      expect(spec.size, spec.id).toBe(spec.id === 'R20' ? 5 : 4);
      expect(spec.layout!.dice.length, spec.id).toBeGreaterThanOrEqual(3);
      expect(spec.layout!.dice.length, spec.id).toBeLessThanOrEqual(6);
    }
  });

  it('start every piece in its southmost row, so that nothing of it lies behind the joint', () => {
    for (const spec of LATER) {
      const south = Math.max(...cellsOf(spec).map((cell) => Number(cell.split(',')[1])));
      expect(spec.layout!.start.z, spec.id).toBe(south);
    }
  });

  it('change the faces that work from piece to piece, named in the order a piece uses them: 2s, 3s and 4s, no 1s, 5s or 6s', () => {
    expect(LATER.map((spec) => spec.faces)).toEqual([[3, 2], [2], [4], [3], [2, 3], [3, 2], [3], [2, 4], [3, 2], [2, 3], [3], [2, 4], [3, 2]]);
    for (let i = 1; i < ROAD.length; i++) expect(ROAD[i].faces, ROAD[i].id).not.toEqual(ROAD[i - 1].faces);
    for (const spec of LATER) {
      expect(spec.values, spec.id).toEqual(spec.faces);
      // The faces of what goes on the way of the piece, in the order it goes.
      expect([...new Set(tryWay(spec, wayOf(spec)).values)], spec.id).toEqual(spec.faces);
    }
  });

  it('fix the dice that wait, and leave free only the dice the player rolls or pushes', () => {
    const free: Record<string, string[]> = {
      R08: ['2,3', '2,1'], R09: ['2,3', '2,0'], R10: ['2,2'], R11: ['2,3', '1,1'], R12: ['3,3', '2,2', '2,0'], R13: ['0,3', '2,1'], R14: ['2,1'],
      R15: ['2,3', '0,2'], R16: ['0,3', '3,2', '3,0'], R17: ['3,3', '1,2'], R18: ['1,2', '2,2'], R19: ['1,3', '2,1'], R20: ['1,4', '2,1', '3,2'],
    };
    for (const spec of LATER) {
      const { dice, leaving, start: at } = spec.layout!;
      const stair = new Set((leaving ?? []).map(({ die }) => die));
      expect(dice.filter((die, i) => !die.fixed && !stair.has(i)).map((die) => `${die.x},${die.z}`), spec.id).toEqual(free[spec.id]);
      for (const die of dice.filter((die) => die.fixed)) expect(spec.faces, `${spec.id} ${die.x},${die.z}`).toContain(die.top);
      expect(dice.some((die) => die.fixed && die.x === at.x && die.z === at.z), spec.id).toBe(false);
      // Every free die is one the way of the piece moves.
      const moved = new Set(wayOf(spec).map((move) => `${move.x},${move.z}`));
      for (const cell of free[spec.id]) expect(moved.has(cell), `${spec.id} ${cell}`).toBe(true);
    }
  });

  it('are cleared by the keys written for them, the steps among them, in as many moves as the piece says', () => {
    expect(LATER.map((spec) => spec.par)).toEqual([4, 3, 3, 3, 3, 3, 2, 2, 3, 2, 2, 2, 4]);
    for (const spec of LATER) {
      const { state } = playKeys(spec);
      expect(state.endReason, spec.id).toBe('passed');
      expect(state.levelRun!.moves, spec.id).toBe(spec.par);
      // The moves among the keys are the way the piece keeps.
      const moves = KEYS[spec.id].split(' ').filter((key) => key.endsWith(':roll') || key.endsWith(':push'));
      expect(moves.map((key) => key[0]), spec.id).toEqual(wayOf(spec).map((move) => move.dir));
      expect(moves.map((key) => key.endsWith(':push')), spec.id).toEqual(wayOf(spec).map((move) => move.push));
    }
  });

  it('bring a face up from a side the player sees: the last roll of every die of a way is to the north or to the west', () => {
    for (const spec of LATER) {
      const way = wayOf(spec).filter((move) => !move.push);
      way.forEach((move, i) => {
        const { dx, dz } = { N: { dx: 0, dz: -1 }, E: { dx: 1, dz: 0 }, S: { dx: 0, dz: 1 }, W: { dx: -1, dz: 0 } }[move.dir];
        const next = way[i + 1];
        const lastOfDie = !next || next.x !== move.x + dx || next.z !== move.z + dz;
        if (lastOfDie) expect(['N', 'W'], `${spec.id} ${move.x},${move.z}`).toContain(move.dir);
      });
    }
  });

  it('teach with the three pieces that carry a line, each by the move its line speaks of', () => {
    expect(Object.keys(ROAD_HINTS)).toEqual(LESSONS);
    expect(playKeys(pieceOf('R09')).events).toContain('chain');
    expect(playKeys(pieceOf('R13')).hops.some((hop) => hop.from && hop.to)).toBe(true);
    expect(KEYS.R17).toContain(':push');
  });

  it('R08: two combos one after the other with no chain, and the way to the second die is over a die that stands', () => {
    const spec = pieceOf('R08');
    const report = tryWay(spec, wayOf(spec));
    expect(report.cleared).toEqual([false, true, false, true]);
    expect(report.uses).toEqual([]);
    expect(parWithout(spec, 'link')).toBe(spec.par);
    expect(parWithout(spec, 'link', 'bridge', 'glass')).toBe(spec.par);
    // From the die that has made the 3s the player steps onto the fixed 2, which stands, and from it onto the second die.
    const state = start(spec);
    go(state, 'W');
    go(state, 'N');
    expect(state.cubes.filter((cube) => cube.state === 'sinking').map((cube) => cube.ori.top)).toEqual([3, 3, 3]);
    go(state, 'N');
    expect(cubeAt(state, state.player.x, state.player.z)).toMatchObject({ fixed: true, state: 'idle', ori: { top: 2 } });
    go(state, 'E');
    expect(cubeAt(state, state.player.x, state.player.z)).toMatchObject({ x: 2, z: 1, state: 'idle' });
    expect(cubeAt(state, state.player.x, state.player.z)!.fixed).toBeFalsy();
    expect(state.levelRun!.moves).toBe(2);
    expect(canBeLost(spec)).toBe(false);
  });

  it('R09: three 2s where a combo takes two, so the third leaves only by the chain, and it is one roll away when the combo is made', () => {
    const spec = pieceOf('R09');
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
  });

  it('R09: the chain is still made by one who rolls the third die the wrong way first', () => {
    // Over the die of the combo that is beside it, and then on over the next: the 2 comes up all the same, on the second move of the two.
    const state = start(pieceOf('R09'));
    for (const dir of ['N', 'N', 'N', 'S', 'W'] as const) go(state, dir);
    expect(state.endReason).toBe('passed');
    expect(state.levelRun!.moves).toBe(4);
  });

  it('the easy pieces: a combo or two in four moves at the most, by moves that have been taught, and a careless player gets through', () => {
    const share: Record<string, number> = {};
    for (const id of EASY) {
      const spec = pieceOf(id);
      expect(spec.par, id).toBeLessThanOrEqual(4);
      const combos = tryWay(spec, wayOf(spec)).cleared.filter(Boolean).length;
      expect(combos, id).toBeGreaterThanOrEqual(1);
      expect(combos, id).toBeLessThanOrEqual(2);
      share[id] = randomShare(spec);
      expect(share[id], id).toBeGreaterThanOrEqual(0.6);
    }
    expect(share).toEqual({ R10: 0.98, R11: 0.66, R14: 0.91, R15: 0.97, R18: 1, R19: 1 });
    // What has not been taught yet is not asked for, and no piece asks for a roll over a die that is leaving.
    for (const id of ['R10', 'R11']) expect(parWithout(pieceOf(id), 'bridge', 'glass', 'floor'), id).toBe(pieceOf(id).par);
    for (const id of ['R14', 'R15']) expect(parWithout(pieceOf(id), 'push', 'glass', 'link'), id).toBe(pieceOf(id).par);
    for (const id of ['R18', 'R19']) expect(parWithout(pieceOf(id), 'glass', 'link', 'bridge'), id).toBe(pieceOf(id).par);
    expect(parWithout(pieceOf('R10'), 'link')).toBe(3);
    expect(tryWay(pieceOf('R11'), wayOf(pieceOf('R11'))).uses).toEqual(['link']);
  });

  it('R12: two combos and the chain, in six moves at the most, by what the block has taught, and the chain comes last', () => {
    const spec = pieceOf('R12');
    const report = tryWay(spec, wayOf(spec));
    expect(spec.par).toBeLessThanOrEqual(6);
    expect(report.uses).toEqual(['link']);
    // The 2s, the 3s, and the 3 that joins them.
    expect(report.values).toEqual([2, 3, 3]);
    expect(report.cleared).toEqual([true, true, true]);
    expect(parWithout(spec, 'link')).toBeNull();
    expect(parWithout(spec, 'bridge', 'glass')).toBe(spec.par);
    const { hops, events } = playKeys(spec);
    // No step leads from one die that is leaving onto another: that is the walk, which comes after.
    expect(hops).toEqual([{ from: true, to: false }, { from: true, to: false }]);
    expect(events.filter((type) => type === 'match')).toHaveLength(2);
    expect(events.filter((type) => type === 'chain')).toHaveLength(1);
    expect(events.lastIndexOf('chain')).toBeGreaterThan(events.lastIndexOf('match'));
  });

  it('R13: the only way to the second die is over the dice of the combo that is leaving', () => {
    const spec = pieceOf('R13');
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
    expect(canBeLost(spec)).toBe(false);
  });

  it('R14 and R15: easy, the first with a stair, the second with the walk', () => {
    const stair = pieceOf('R14').layout!;
    expect(stair).toMatchObject({ start: { x: 2, z: 3 }, onFloor: true, leaving: [{ die: 0, moves: 1 }] });
    expect(stair.dice[0]).toMatchObject({ x: 2, z: 2 });
    expect(pieceOf('R14').floor).toBe(true);
    for (const spec of LATER) if (spec.id !== 'R14') expect(spec.layout!.leaving, spec.id).toBeUndefined();
    expect(parWithout(pieceOf('R15'), 'bridge')).toBeNull();
    expect(canBeLost(pieceOf('R14'))).toBe(false);
    expect(canBeLost(pieceOf('R15'))).toBe(false);
  });

  it('R16: the chain and the walk together, neither can be done without, and the chain comes last', () => {
    const spec = pieceOf('R16');
    expect(parWithout(spec, 'link')).toBeNull();
    expect(parWithout(spec, 'bridge')).toBeNull();
    expect(parWithout(spec, 'glass')).toBe(spec.par);
    expect(tryWay(spec, wayOf(spec)).values).toEqual([3, 2, 2]);
    const { hops, events } = playKeys(spec);
    // Over the two 3s that waited, off them onto the second die, and from that, when it has made the 2s, onto the third.
    expect(hops).toEqual([{ from: true, to: true }, { from: true, to: true }, { from: true, to: false }, { from: true, to: false }]);
    expect(events.filter((type) => type === 'match')).toHaveLength(2);
    expect(events.filter((type) => type === 'chain')).toHaveLength(1);
    expect(events.lastIndexOf('chain')).toBeGreaterThan(events.lastIndexOf('match'));
  });

  it('R17: the floor is open, the player comes down from the die that is leaving under them, and nothing clears the piece but a push', () => {
    const spec = pieceOf('R17');
    expect(spec.floor).toBe(true);
    expect(spec.layout!.onFloor).toBeUndefined();
    expect(parWithout(spec, 'push')).toBeNull();
    const state = start(spec);
    go(state, 'N');
    // The die under the player has made the 2s and is leaving: no roll is left, and the floor is a step away.
    expect(cubeAt(state, state.player.x, state.player.z)!.state).toBe('sinking');
    expect(resolveMove(state, 'W').kind).toBe('descend');
    go(state, 'W');
    expect(state.player.level).toBe('ground');
    expect(state.levelRun!.moves).toBe(1);
    expect(resolveMove(state, 'W').kind).toBe('push');
    go(state, 'W');
    expect(state.endReason).toBe('passed');
    // The die that is pushed shows the face of its combo from the start, and is not turned.
    expect(spec.layout!.dice[1]).toMatchObject({ x: 1, z: 2, top: 3 });
    // One who simply plays is never left with nothing to do.
    expect(canBeLost(spec)).toBe(false);
  });

  it('R18 and R19: easy, by the push: two dice pushed from the floor the player starts on, and a combo rolled and a die pushed', () => {
    const pushes = pieceOf('R18');
    expect(pushes.layout!.onFloor).toBe(true);
    expect(pushes.floor).toBe(true);
    expect(wayOf(pushes).map((move) => move.push)).toEqual([true, true]);
    expect(wayOf(pieceOf('R19')).map((move) => move.push)).toEqual([false, true]);
    expect(pieceOf('R19').floor).toBe(true);
    expect(parWithout(pieceOf('R19'), 'push')).toBeNull();
    expect(canBeLost(pushes)).toBe(false);
    expect(canBeLost(pieceOf('R19'))).toBe(false);
  });

  it('R20: everything at once, the longest way of the three blocks and seven moves at the most', () => {
    const spec = pieceOf('R20');
    expect(spec.par).toBeLessThanOrEqual(7);
    expect(spec.par).toBe(Math.max(...LATER.map((piece) => piece.par!)));
    expect(spec.floor).toBe(true);
    for (const ban of ['link', 'bridge', 'push', 'up'] as const) expect(parWithout(spec, ban), ban).toBeNull();
    expect(parWithout(spec, 'glass')).toBe(spec.par);
    expect(tryWay(spec, wayOf(spec)).values).toEqual([3, 2, 2]);
    const { hops, events, state } = playKeys(spec);
    // The walk over the two 3s that waited; later the step from the die that was pushed, which is leaving, onto the last die.
    expect(hops).toEqual([{ from: true, to: true }, { from: true, to: true }, { from: true, to: false }]);
    expect(events.filter((type) => type === 'match')).toHaveLength(2);
    expect(events.filter((type) => type === 'chain')).toHaveLength(1);
    expect(events.lastIndexOf('chain')).toBeGreaterThan(events.lastIndexOf('match'));
    // Down to the floor, a push, and up again by the die that was pushed as it leaves.
    for (const kind of ['descend', 'push', 'mount']) expect(KEYS.R20, kind).toContain(':' + kind);
    expect(state.endReason).toBe('passed');
  });

  it('can be lost only where a chain is asked for, and there a board that can no longer be cleared is a dead end said at once', () => {
    const lost = LATER.filter((spec) => canBeLost(spec)).map((spec) => spec.id);
    expect(lost).toEqual(['R09', 'R11', 'R12', 'R16', 'R20']);
    for (const id of lost) expect(parWithout(pieceOf(id), 'link'), id).toBeNull();
    // No board is left to be rolled about on with nothing to be done: the chain is the last thing a piece asks for.
    const seen = Object.fromEntries(lost.map((id) => [id, lostOf(pieceOf(id))]));
    for (const id of lost) expect(seen[id].said, id).toBe(seen[id].lost);
    expect(seen).toEqual({ R09: { lost: 2, said: 2 }, R11: { lost: 2, said: 2 }, R12: { lost: 4, said: 4 }, R16: { lost: 3, said: 3 }, R20: { lost: 2, said: 2 } });
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
    expect(roadPlace('R07', true)).toBe(6);
  });

  it('is the first piece of the second block for one who passed the first level of the build before and has no place kept', () => {
    expect(FIRST_PASSED).toBe('R08');
    expect(roadPlace(undefined, true)).toBe(7);
    // So it is for one who cleared the first block while the road ended with it: the code kept for them is the same.
    expect(roadPlace('R08', false)).toBe(7);
    expect(ROAD[7].id).toBe('R08');
  });

  it('is past the road for a code that names no piece of it', () => {
    expect(roadPlace('R21', false)).toBeNull();
    expect(roadPlace('R99', false)).toBeNull();
    expect(roadPlace('', false)).toBeNull();
  });

  it('goes on by the code of the piece after: the next of the road, and after its last a code that names none', () => {
    expect(pieceAfter(0)).toBe('R02');
    expect(pieceAfter(6)).toBe('R08');
    expect(pieceAfter(19)).toBe('R21');
    expect(roadPlace(pieceAfter(19), false)).toBeNull();
    for (let i = 0; i + 1 < ROAD.length; i++) expect(pieceAfter(i)).toBe(ROAD[i + 1].id);
  });
});

describe('the blocks of the road', () => {
  it('are four, and only the first is seen at one scale', () => {
    expect(ROAD_BLOCKS).toEqual([
      { from: 0, to: 6, oneScale: true },
      { from: 7, to: 11, oneScale: false },
      { from: 12, to: 15, oneScale: false },
      { from: 16, to: 19, oneScale: false },
    ]);
  });

  it('name the block a piece is in', () => {
    expect(blockOf(0)).toBe(ROAD_BLOCKS[0]);
    expect(blockOf(6)).toBe(ROAD_BLOCKS[0]);
    expect(blockOf(7)).toBe(ROAD_BLOCKS[1]);
    expect(blockOf(12)).toBe(ROAD_BLOCKS[2]);
    expect(blockOf(19)).toBe(ROAD_BLOCKS[3]);
    expect(blockOf(20)).toBeNull();
    expect(blockOf(-1)).toBeNull();
  });
});

describe('the middle of a piece', () => {
  it('is the middle of the cells that are left of its square, which is what the camera is put over', () => {
    expect(pieceMiddle(pieceOf('R01'))).toEqual({ x: 2, z: 2.5 });
    expect(pieceMiddle(pieceOf('R02'))).toEqual({ x: 2, z: 2.5 });
    expect(pieceMiddle(pieceOf('R03'))).toEqual({ x: 0.5, z: 0.5 });
    expect(pieceMiddle(pieceOf('R05'))).toEqual({ x: 1.5, z: 1 });
    expect(pieceMiddle(pieceOf('R07'))).toEqual({ x: 1.5, z: 2 });
  });

  it('is the middle of the square for a board with nothing cut out', () => {
    expect(pieceMiddle({ size: 5 })).toEqual({ x: 2, z: 2 });
    expect(pieceMiddle({ size: 4, holes: [] })).toEqual({ x: 1.5, z: 1.5 });
  });
});

describe('the place kept after a piece is passed', () => {
  it('moves on by one when the piece passed is the piece the player is on', () => {
    expect(placeAfter('R04', false, 3)).toBe('R05');
    expect(placeAfter('R07', false, 6)).toBe('R08');
    expect(placeAfter('R20', false, 19)).toBe('R21');
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
    for (let piece = 0; piece < ROAD.length; piece++) expect(placeAfter('R21', false, piece)).toBe('R21');
  });

  it('takes one who is new, with nothing kept, from the first piece to the second', () => {
    expect(placeAfter(undefined, false, 0)).toBe('R02');
    // One who passed the first level of the build before stands after the first block with nothing kept.
    expect(placeAfter(undefined, true, 7)).toBe('R09');
  });
});
