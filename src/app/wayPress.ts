import { DELTA, DIRS, cellIndex } from '../rules/board';
import { createRun } from '../rules/sim';
import { defaultConfig } from '../rules/config';
import { moveOf, solveFrom, type SolverMove } from '../rules/levelSolver';
import { resolveMove } from '../rules/movement';
import { worldRuns } from '../rules/level';
import type { Dir, LevelSpec, RunState } from '../rules/types';

/**
 * A way of a board played by presses, as a player makes them: what the lab plays when it shows a
 * solution, and what the swipe sign of the game points at while a way is shown for an
 * advertisement (docs/superpowers/specs/2026-10-23-vi-rewarded-ads-design.md). Nothing here draws,
 * and the board given is never changed.
 */

/**
 * The press that plays on a way from the run as it stands: the next free step towards where its
 * next move is made from, or that move itself. A move of the solver is made from its place, a
 * die to roll from on top or to push from the floor, and the player is put there for free; on
 * the board of the game he walks there, a key a step, and the steps are found here, on the rules
 * as they are, nothing stepped. The next move is the one after as many as the run has made.
 * `move` says the press is the move itself. `done` where the way is played out or the run is
 * over, `lost` where its next move cannot be got to: the run is not the one the way was found on.
 */
export function nextPress(state: RunState, way: readonly SolverMove[]): { dir: Dir; move: boolean } | 'done' | 'lost' {
  const run = state.levelRun;
  if (!run || state.over || run.moves >= way.length) return 'done';
  const move = way[run.moves];
  const { dx, dz } = DELTA[move.dir];
  const { size } = state.config;
  const cells = size * size;
  // A place is a cell up on the dice, or the same cell on the floor `cells` further on, as `scan` counts them.
  const goal = move.push ? cellIndex(size, move.x - dx, move.z - dz) + cells : cellIndex(size, move.x, move.z);
  const { x, z, level } = state.player;
  const start = cellIndex(size, x, z) + (level === 'ground' ? cells : 0);
  const board: RunState = { ...state, player: { x, z, level } };
  // The first step of the shortest walk to every place reached: the walk goes on from where the first step led.
  const first = new Map<number, Dir | null>([[start, null]]);
  const queue = [start];
  for (let at = 0; at < queue.length; at++) {
    const place = queue[at];
    const up = place < cells;
    const cell = up ? place : place - cells;
    board.player.x = cell % size;
    board.player.z = Math.floor(cell / size);
    board.player.level = up ? 'top' : 'ground';
    if (place === goal) {
      const made = resolveMove(board, move.dir).kind;
      if (made === (move.push ? 'push' : 'roll')) {
        const step = first.get(place);
        return step ? { dir: step, move: false } : { dir: move.dir, move: true };
      }
    }
    for (const dir of DIRS) {
      const intent = resolveMove(board, dir);
      // A roll or a push is a move of its own: the walk goes by free steps only.
      if (intent.kind === 'blocked' || intent.kind === 'roll' || intent.kind === 'push') continue;
      const down = intent.kind === 'descend' || intent.kind === 'walk';
      const next = cellIndex(size, intent.tx, intent.tz) + (down ? cells : 0);
      if (first.has(next)) continue;
      first.set(next, first.get(place) ?? dir);
      queue.push(next);
    }
  }
  return 'lost';
}

/**
 * The way a board is cleared in from its start: the one its file keeps, else the solver's, if it
 * finds one within `maxStates` boards. Null where there is none to show.
 */
export function wayOf(spec: LevelSpec, maxStates: number): readonly SolverMove[] | null {
  if (spec.solution && spec.solution.length > 0) {
    try {
      return spec.solution.map(moveOf);
    } catch {
      // A way the file keeps that cannot be read is no way: the solver is asked.
    }
  }
  try {
    const start = createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
    if (worldRuns(start) || start.player.action) return null;
    return solveFrom(start, { maxStates }).solution?.moves ?? null;
  } catch {
    return null;
  }
}

/**
 * A way shown on a try, from the start of its board: its moves, and the move the player left it
 * on, by its place in the way, if they did. Changed in place as the try goes.
 */
export interface ShownWay {
  readonly moves: readonly SolverMove[];
  off: number | null;
}

/**
 * The move made from a board, as the solver writes it: a roll is made from on top of its die, a
 * push from the floor behind it. `before` is the board the move was made from.
 */
export function madeMove(before: RunState, dir: Dir, push: boolean): SolverMove {
  const { x, z } = before.player;
  const { dx, dz } = DELTA[dir];
  return push ? { x: x + dx, z: z + dz, dir, push } : { x, z, dir, push };
}

/** A move made on the try: one that is not the move of the way at its place leaves the way, from there on. `index` counts from 0. */
export function wayMoved(way: ShownWay, index: number, move: SolverMove): void {
  if (way.off !== null) return;
  const due = way.moves[index];
  if (!due || due.x !== move.x || due.z !== move.z || due.dir !== move.dir || due.push !== move.push) way.off = index;
}

/** A move taken back: a board from before the move that left the way is on it again. `moves` is the moves the board has made. */
export function wayBack(way: ShownWay, moves: number): void {
  if (way.off !== null && moves <= way.off) way.off = null;
}

/** Where the swipe sign points on a way shown: null once the player has left it, it is played out, or its next move cannot be got to. */
export function wayDir(state: RunState, way: ShownWay): Dir | null {
  if (way.off !== null) return null;
  const press = nextPress(state, way.moves);
  return press === 'done' || press === 'lost' ? null : press.dir;
}
