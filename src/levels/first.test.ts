import { describe, expect, it } from 'vitest';
import { cubeAt } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { levelDeadEnd, worldRuns } from '../rules/level';
import { moveOf, solveFrom, solveLevel, tryWay } from '../rules/levelSolver';
import { resolveMove } from '../rules/movement';
import { createRun, step } from '../rules/sim';
import { hasReadyGroup } from '../rules/spawn';
import type { Dir, LevelSpec, RunState } from '../rules/types';
import { FIRST_ID, FIRST_LEVEL, STAGE_IDLE, STAGE_SIGNS } from './first';
import { LEVELS } from './levels';

/**
 * The four boards of the first level: they are proved the way the list of the levels is, and,
 * since the player of this level is let to wander, from every board they can come to as well.
 */

const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];
const wayOf = (spec: LevelSpec) => (spec.solution ?? []).map(moveOf);
const stageOf = (id: string): LevelSpec => FIRST_LEVEL.find((spec) => spec.id === id)!;
const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });

/** Gives a command and runs the level until the world stands and the player is free, as a move is made. */
function go(state: RunState, dir: Dir): void {
  step(state, dir);
  for (let ticks = 0; (worldRuns(state) || state.player.action) && !state.over; ticks++) {
    if (ticks > 1000) throw new Error('a move that does not end');
    step(state, null);
  }
}

describe('the four boards of the first level', () => {
  it('are four stages, F1a to F1d, laid die by die: nothing comes, and the dice laid are the dice of the goal', () => {
    expect(FIRST_ID).toBe('F1');
    expect(FIRST_LEVEL.map((spec) => spec.id)).toEqual(['F1a', 'F1b', 'F1c', 'F1d']);
    for (const spec of FIRST_LEVEL) {
      expect(spec.norm, spec.id).toBe(spec.layout!.dice.length);
      expect(spec.goal, spec.id).toEqual({ kind: 'clear' });
      expect(spec.arrival, spec.id).toBe('none');
      expect(spec.moves, spec.id).toBe(0);
      expect(spec.undos, spec.id).toBe(3);
      expect(spec.sinkMoves, spec.id).toBe(2);
      expect(spec.liftMoves, spec.id).toBe(LEVELS[0].liftMoves);
      expect(spec.chapter, spec.id).toBe(0);
      expect(spec.exact, spec.id).toBe(true);
      for (const key of ['lesson', 'guide', 'story'] as const) expect(spec[key], `${spec.id} ${key}`).toBeUndefined();
      const state = start(spec);
      expect(state.cubes, spec.id).toHaveLength(spec.norm);
    }
  });

  it('are the boards of the pictures: the cells that are left, the faces that work, the floor shut or open', () => {
    const cellsOf = (spec: LevelSpec): string[] => {
      const cut = new Set((spec.holes ?? []).map((cell) => `${cell.x},${cell.z}`));
      const cells: string[] = [];
      for (let z = 0; z < spec.size; z++) for (let x = 0; x < spec.size; x++) if (!cut.has(`${x},${z}`)) cells.push(`${x},${z}`);
      return cells;
    };
    expect(cellsOf(stageOf('F1a'))).toEqual(['0,2', '1,2', '2,2', '3,2', '4,2', '5,2']);
    expect(cellsOf(stageOf('F1b'))).toEqual(['2,0', '3,0', '3,1', '0,2', '1,2', '2,2', '3,2', '0,3']);
    expect(cellsOf(stageOf('F1c'))).toEqual(['0,0', '1,0', '1,1', '2,1', '1,2']);
    expect(cellsOf(stageOf('F1d'))).toEqual(['0,0', '1,0', '0,1', '1,1', '2,1']);
    expect(FIRST_LEVEL.map((spec) => [spec.size, spec.faces, spec.floor])).toEqual([[6, [2], false], [5, [3], true], [3, [2], false], [3, [3], false]]);
    expect(stageOf('F1b').layout).toMatchObject({ start: { x: 0, z: 3 }, onFloor: true, leaving: [{ die: 0, moves: 1 }] });
  });

  it('start with no combo ready to go', () => {
    for (const spec of FIRST_LEVEL) {
      const state = start(spec);
      const tops = new Array<number>(spec.size * spec.size).fill(0);
      for (const cube of state.cubes) tops[cube.z * spec.size + cube.x] = cube.ori.top;
      expect(hasReadyGroup(tops, spec.size), spec.id).toBe(false);
    }
  });

  it('keep a way that clears each in as many moves as the stage says, and the solver finds no shorter one', () => {
    expect(FIRST_LEVEL.map((spec) => spec.par)).toEqual([4, 3, 1, 1]);
    for (const spec of FIRST_LEVEL) {
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

  it('clear F1b by the stair, played by its steps: up by the die that is leaving, over, and three rolls', () => {
    const spec = stageOf('F1b');
    const state = start(spec);
    expect(state.player).toEqual({ x: 0, z: 3, level: 'ground' });
    go(state, 'N');
    expect(state.player).toEqual({ x: 0, z: 2, level: 'top' });
    go(state, 'E');
    expect(state.player).toEqual({ x: 1, z: 2, level: 'top' });
    expect(state.levelRun!.moves).toBe(0);
    for (const dir of ['E', 'E', 'N'] as const) go(state, dir);
    expect(state.endReason).toBe('passed');
    expect(state.levelRun!.moves).toBe(spec.par);
  });

  it('show on top, along the way of each stage, the faces the pictures say', () => {
    const tops = (spec: LevelSpec): number[] => {
      const state = start(spec);
      const way = wayOf(spec);
      // The stair is climbed first: two steps, and no world moves.
      if (spec.id === 'F1b') {
        go(state, 'N');
        go(state, 'E');
      }
      const first = cubeAt(state, way[0].x, way[0].z)!;
      const seen = [first.ori.top];
      let cube = first;
      for (const move of way) {
        cube = cubeAt(state, move.x, move.z) ?? cube;
        state.player = { x: move.x, z: move.z, level: 'top' };
        go(state, move.dir);
        seen.push(cube.ori.top);
      }
      expect(state.endReason, spec.id).toBe('passed');
      return seen;
    };
    expect(tops(stageOf('F1a'))).toEqual([2, 6, 5, 1, 2]);
    expect(tops(stageOf('F1b'))).toEqual([1, 5, 6, 3]);
    expect(tops(stageOf('F1c'))).toEqual([6, 2]);
    expect(tops(stageOf('F1d'))).toEqual([1, 3]);
  });

  it('are cleared from every board they can come to, in five moves at the most, and are never lost', () => {
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
          if (queue.length > 2000) throw new Error(`${spec.id}: more boards than a first level has`);
        }
      }
      return found;
    };
    const worst: Record<string, number> = {};
    const boards: Record<string, number> = {};
    for (const spec of FIRST_LEVEL) {
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
      expect(most, spec.id).toBeLessThanOrEqual(5);
    }
    // The worst board of each stage, as the spec counts it: a roll wasted on the strip, a turn missed at the stair, a wrong way on the small boards.
    expect(worst).toEqual({ F1a: 4, F1b: 5, F1c: 2, F1d: 5 });
    expect(boards).toEqual({ F1a: 5, F1b: 9, F1c: 4, F1d: 32 });
  });
});

describe('what a stage does when the player waits', () => {
  it('opens the first stage with the sign of its swipe, and the rest with none', () => {
    expect(STAGE_SIGNS).toEqual({ F1a: 'E' });
  });

  it('blinks the plaque, shows the sign and counts the moves wasted, stage by stage', () => {
    expect(STAGE_IDLE).toEqual({
      F1a: { blinkMs: null, signMs: 6000, wasted: null },
      F1b: { blinkMs: 4000, signMs: 8000, wasted: 3 },
      F1c: { blinkMs: 4000, signMs: 8000, wasted: 3 },
      F1d: { blinkMs: 4000, signMs: 8000, wasted: 3 },
    });
  });
});
