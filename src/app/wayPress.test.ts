import { describe, expect, it } from 'vitest';
import { ROW } from '../levels/row.gen';
import { DIRS } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { worldRuns } from '../rules/level';
import { moveOf } from '../rules/levelSolver';
import { resolveMove } from '../rules/movement';
import { createRun, step } from '../rules/sim';
import type { Dir, LevelSpec, RunState } from '../rules/types';
import { SIGN_MAX_STATES } from './signWay';
import { madeMove, nextPress, wayBack, wayDir, wayMoved, wayOf, type ShownWay } from './wayPress';

/** The board of a place at its start. */
const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });

/** Lets the world of a board stand, as the game waits for it before it reads the sign. */
function settle(state: RunState): void {
  while ((state.player.action !== undefined || worldRuns(state)) && !state.over) step(state, null);
}

/** Presses on a board as the sign says until the next press is the move of the way at `index`. */
function walkTo(state: RunState, way: ShownWay, index: number): void {
  for (let guard = 0; guard < 1000; guard++) {
    settle(state);
    const press = nextPress(state, way.moves);
    if (press === 'done' || press === 'lost') throw new Error(`the way ended on ${press}`);
    if (press.move && state.levelRun!.moves === index) return;
    step(state, press.dir);
  }
  throw new Error('the way did not come to its move');
}

describe('the way shown for an advertisement', () => {
  it('is the way the file keeps on every place of the row', () => {
    for (const { spec } of ROW.places) expect(wayOf(spec, SIGN_MAX_STATES), spec.id).toEqual(spec.solution!.map(moveOf));
  });

  it('is found by the solver on a board that keeps none', () => {
    const spec: LevelSpec = {
      id: 'test',
      seed: 1,
      size: 3,
      values: [2, 3],
      norm: 2,
      arrival: 'none',
      goal: { kind: 'clear' },
      moves: 0,
      layout: { dice: [{ x: 1, z: 1, top: 2, north: 1 }, { x: 0, z: 0, top: 2, north: 1 }], start: { x: 2, z: 2 }, onFloor: true },
    };
    const way = wayOf(spec, SIGN_MAX_STATES);
    expect(way).not.toBeNull();
    expect(way!.length).toBeGreaterThan(0);
  });

  it('points the sign the way the next press goes, and the board followed by it is cleared', () => {
    for (const { spec } of ROW.places) {
      const way: ShownWay = { moves: spec.solution!.map(moveOf), off: null };
      const state = start(spec);
      for (let guard = 0; guard < 1000 && !state.over; guard++) {
        settle(state);
        if (state.over) break;
        const dir = wayDir(state, way);
        expect(dir, spec.id).not.toBeNull();
        const made = state.levelRun!.moves;
        const before = structuredClone(state);
        step(state, dir);
        if (state.levelRun!.moves > made) wayMoved(way, made, madeMove(before, dir!, resolveMove(before, dir!).kind === 'push'));
      }
      settle(state);
      expect([spec.id, state.endReason, way.off]).toEqual([spec.id, 'passed', null]);
      expect(wayDir(state, way)).toBeNull();
    }
  });

  it('goes out once the player leaves the way, and comes back with the move taken back', () => {
    let lost = 0;
    let left = 0;
    for (const { spec } of ROW.places) {
      const moves = spec.solution!.map(moveOf);
      const due = moves[0];
      const way: ShownWay = { moves, off: null };
      const state = start(spec);
      walkTo(state, way, 0);
      // Another move than the one the way makes here: a die rolled or pushed some other way.
      const other = DIRS.find((dir: Dir) => {
        const kind = resolveMove(state, dir).kind;
        return (kind === 'roll' || kind === 'push') && dir !== due.dir;
      });
      if (!other) continue;
      const before = structuredClone(state);
      step(state, other);
      settle(state);
      wayMoved(way, 0, madeMove(before, other, resolveMove(before, other).kind === 'push'));
      left++;
      expect([spec.id, way.off]).toEqual([spec.id, 0]);
      expect(wayDir(state, way), spec.id).toBeNull();
      if (nextPress(state, moves) === 'lost') lost++;
      // The move taken back puts the board from before it on the way again.
      wayBack(way, before.levelRun!.moves);
      expect(way.off).toBeNull();
      expect(wayDir(before, way), spec.id).toBe(due.dir);
    }
    expect(left).toBeGreaterThan(0);
    // On some boards the way itself cannot go on from where the player left it.
    expect(lost).toBeGreaterThan(0);
  });
});
