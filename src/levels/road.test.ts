import { describe, expect, it } from 'vitest';
import { cubeAt } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { levelDeadEnd, worldRuns } from '../rules/level';
import { moveOf, solveFrom, solveLevel, tryWay } from '../rules/levelSolver';
import { resolveMove } from '../rules/movement';
import { roll } from '../rules/orientation';
import { createRun, step } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import type { Dir, LevelSpec, Orientation, RunState } from '../rules/types';
import { LEVELS } from './levels';
import { FIRST_PASSED, ROAD, ROAD_BLOCKS, ROAD_IDLE, ROAD_SIGNS, blockOf, pieceAfter, pieceMiddle, roadPlace } from './road';

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
    expect(ROAD.map((spec) => spec.id)).toEqual(['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07']);
    expect(ROAD_BLOCKS).toEqual([{ from: 0, to: 6, oneScale: true }]);
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
    // Every board the player can come to by moves and by steps, walked from the start by the commands that lead there.
    const reached = (spec: LevelSpec): { cmds: Dir[]; state: RunState }[] => {
      const replay = (cmds: readonly Dir[]): RunState => {
        const state = start(spec);
        for (const dir of cmds) go(state, dir);
        return state;
      };
      const keyOf = (state: RunState): string =>
        JSON.stringify([
          state.cubes.map((c) => [c.x, c.z, c.ori.top, c.ori.north, c.state, c.t]).sort(),
          state.player.x, state.player.z, state.player.level, state.endReason,
        ]);
      const seen = new Map<string, Dir[]>();
      const found: { cmds: Dir[]; state: RunState }[] = [];
      const queue: Dir[][] = [[]];
      seen.set(keyOf(replay([])), []);
      for (let at = 0; at < queue.length; at++) {
        const cmds = queue[at];
        const state = replay(cmds);
        found.push({ cmds, state });
        if (state.over) continue;
        for (const dir of DIRS) {
          if (resolveMove(state, dir).kind === 'blocked') continue;
          const next = [...cmds, dir];
          const key = keyOf(replay(next));
          if (seen.has(key)) continue;
          seen.set(key, next);
          queue.push(next);
          if (queue.length > 2000) throw new Error(`${spec.id}: more boards than a piece of the first block has`);
        }
      }
      return found;
    };
    const worst: Record<string, number> = {};
    const boards: Record<string, number> = {};
    for (const spec of BLOCK_ONE) {
      let most = 0;
      const all = reached(spec);
      boards[spec.id] = all.length;
      for (const { cmds, state } of all) {
        if (state.over) {
          // The only end there is, is the board cleared.
          expect(state.endReason, `${spec.id} after ${cmds.join('')}`).toBe('passed');
          continue;
        }
        expect(levelDeadEnd(state), `${spec.id} after ${cmds.join('')}`).toBeNull();
        const solved = solveFrom(state);
        expect(solved.solution, `${spec.id} after ${cmds.join('')}`).not.toBeNull();
        most = Math.max(most, solved.solution!.moves.length);
      }
      worst[spec.id] = most;
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

  it('is past the first block for one who passed the first level of the build before and has no place kept', () => {
    expect(FIRST_PASSED).toBe('R08');
    expect(roadPlace(undefined, true)).toBe(roadPlace('R08', false));
    // While the road ends with its first block, that is past the road.
    expect(ROAD).toHaveLength(7);
    expect(roadPlace(undefined, true)).toBeNull();
  });

  it('is past the road for a code that names no piece of it', () => {
    expect(roadPlace('R08', false)).toBeNull();
    expect(roadPlace('R99', false)).toBeNull();
    expect(roadPlace('', false)).toBeNull();
  });

  it('goes on by the code of the piece after: the next of the road, and after its last a code that names none yet', () => {
    expect(pieceAfter(0)).toBe('R02');
    expect(pieceAfter(5)).toBe('R07');
    expect(pieceAfter(6)).toBe('R08');
    expect(roadPlace(pieceAfter(6), false)).toBeNull();
    for (let i = 0; i + 1 < ROAD.length; i++) expect(pieceAfter(i)).toBe(ROAD[i + 1].id);
  });
});

describe('the blocks of the road', () => {
  it('name the block a piece is in', () => {
    expect(blockOf(0)).toBe(ROAD_BLOCKS[0]);
    expect(blockOf(6)).toBe(ROAD_BLOCKS[0]);
    expect(blockOf(7)).toBeNull();
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
