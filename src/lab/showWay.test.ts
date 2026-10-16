import { describe, expect, it } from 'vitest';
import { ROW } from '../levels/row.gen';
import { defaultConfig } from '../rules/config';
import { worldRuns } from '../rules/level';
import { moveOf, moveText, solveLevel, tryWay } from '../rules/levelSolver';
import { createRun, step } from '../rules/sim';
import type { LevelSpec, RunState } from '../rules/types';
import type { Check } from '../levels/labText';
import type { Seconds } from './labFacts';
import { nextPress, wayToShow } from './showWay';

/** Plays a way from the start of a board by the presses `nextPress` gives, each on the real rules, as the game takes a key. */
function pressOut(spec: LevelSpec, way: readonly string[]): { state: RunState; presses: number; end: string } {
  const moves = way.map(moveOf);
  const state = createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
  let presses = 0;
  for (let guard = 0; guard < 10_000; guard++) {
    // The world is let stand, as the page waits for it before it presses.
    while ((state.player.action !== undefined || worldRuns(state)) && !state.over) step(state, null);
    const press = nextPress(state, moves);
    if (press === 'done' || press === 'lost') return { state, presses, end: press };
    presses++;
    step(state, press.dir);
  }
  throw new Error('the way did not end');
}

/** A board of three cells a side to be cleared; the player starts where `start` says. */
const board = (spec: Partial<LevelSpec>): LevelSpec => ({ id: 'test', seed: 1, size: 3, values: [2, 3], norm: 2, arrival: 'none', goal: { kind: 'clear' }, moves: 0, ...spec });

describe('the presses that show a way', () => {
  it('play every board of the row by the way it keeps, walking to each move as a player does', () => {
    let walked = 0;
    for (const { spec } of ROW.places) {
      const way = spec.solution ?? [];
      expect(way.length, spec.id).toBeGreaterThan(0);
      const { state, presses, end } = pressOut(spec, way);
      expect([spec.id, end, state.endReason, state.levelRun?.moves]).toEqual([spec.id, 'done', 'passed', way.length]);
      if (presses > way.length) walked++;
    }
    // The row has boards whose moves are got to by steps, not only made where the player stands.
    expect(walked).toBeGreaterThan(0);
  });

  it('walks over the floor to a die from a start on the floor', () => {
    // The player starts on the floor in a corner, away from both dice: every move is got to by steps first.
    const spec = board({ layout: { dice: [{ x: 1, z: 1, top: 2, north: 1 }, { x: 0, z: 0, top: 2, north: 1 }], start: { x: 2, z: 2 }, onFloor: true } });
    const solved = solveLevel(spec).solution;
    expect(solved).not.toBeNull();
    const way = solved!.moves.map(moveText);
    expect(tryWay(spec, solved!.moves).state.endReason).toBe('passed');
    const { state, presses, end } = pressOut(spec, way);
    expect([end, state.endReason]).toEqual(['done', 'passed']);
    expect(presses).toBeGreaterThan(way.length);
  });

  it('show the way the file keeps where it holds the fewest moves, or else the way found', () => {
    const spec = { ...board({}), solution: ['0,0,E'] };
    const seconds = (kept: Check['kept'], way: string[] | null, exact = true): Seconds => ({ check: { par: way?.length ?? null, exact, states: 1, way, score: null, kept }, firsts: 0, moves: [], trap: null });
    expect(wayToShow(spec, seconds('same', ['1,1,N']))).toEqual([moveOf('0,0,E')]);
    expect(wayToShow(spec, seconds('shorter', ['1,1,N']))).toEqual([moveOf('1,1,N')]);
    expect(wayToShow(spec, seconds(null, null))).toBe('решения нет');
    expect(wayToShow(spec, seconds('missing', null, false))).toBe('решатель сдался, решения не нашёл');
    expect(wayToShow(spec, 'the worker failed')).toBe('решатель: the worker failed');
  });

  it('says a move it cannot get to', () => {
    const spec = board({ layout: { dice: [{ x: 0, z: 0, top: 2, north: 1 }, { x: 2, z: 0, top: 2, north: 1 }], start: { x: 0, z: 0 } } });
    const state = createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
    // A die that is not there is no place to make a move from.
    expect(nextPress(state, [moveOf('1,2,N')])).toBe('lost');
    expect(nextPress(state, [])).toBe('done');
  });
});
