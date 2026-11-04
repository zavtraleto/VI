import { describe, expect, it } from 'vitest';
import { boardOf } from '../levels/boardSets';
import { defaultConfig } from '../rules/config';
import { moveOf, playMove } from '../rules/levelSolver';
import { createRun } from '../rules/sim';
import type { LevelSpec, RunState } from '../rules/types';
import { FAR_OVER, askable, wayFrom, wayVerdict } from './levelWay';

const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
const along = (spec: LevelSpec, moves: readonly string[]): RunState => moves.reduce((state, move) => playMove(state, moveOf(move)), start(spec));

describe('how far a level is from being cleared (word of the owner, 4 November 2026: «А + Б»)', () => {
  it('finds the fewest moves left from the start, as the level keeps them', () => {
    const spec = boardOf('fours-then-twos-1');
    expect(wayFrom(start(spec))).toEqual({ fewest: spec.par, settled: true });
    expect(wayVerdict(wayFrom(start(spec)), 0, spec.par)).toBe('open');
  });

  it('calls a board lost where the solver saw every board from it and none is cleared, though dice still stand and move', () => {
    // lift-first-1, the 31st place: the 3 rolled down and then west no longer goes up by the 2s.
    const spec = boardOf('lift-first-1');
    const state = along(spec, ['3,0,S', '3,1,W']);
    expect(state.over).toBe(false);
    const found = wayFrom(state);
    expect(found).toEqual({ fewest: null, settled: true });
    expect(wayVerdict(found, 2, spec.par)).toBe('lost');
  });

  it('calls a board far where the moves made and the fewest left come to more than six over the fewest of the level', () => {
    // climb-twos-fours-1, the 32nd place, par 4: two moves off the way leave nine to go.
    const spec = boardOf('climb-twos-fours-1');
    const found = wayFrom(along(spec, ['2,2,W', '2,1,N']));
    expect(found.fewest).toBe(9);
    expect(2 + 9).toBeGreaterThan(spec.par! + FAR_OVER);
    expect(wayVerdict(found, 2, spec.par)).toBe('far');
    // At the edge: as many over as FAR_OVER is still open.
    expect(wayVerdict({ fewest: spec.par! + FAR_OVER, settled: true }, 0, spec.par)).toBe('open');
    expect(wayVerdict({ fewest: spec.par! + FAR_OVER + 1, settled: true }, 0, spec.par)).toBe('far');
  });

  it('says nothing where the solver gave up, where the level keeps no fewest, or where the board is over', () => {
    expect(wayVerdict(null, 0, 4)).toBe('unknown');
    expect(wayVerdict({ fewest: null, settled: false }, 3, 4)).toBe('unknown');
    expect(wayVerdict({ fewest: 20, settled: true }, 3, undefined)).toBe('open');
    const spec = boardOf('lift-first-1');
    const passed = along(spec, spec.solution!);
    expect(passed.over).toBe(true);
    expect(askable(passed)).toBe(false);
    expect(wayFrom(passed)).toEqual({ fewest: null, settled: false });
  });

  it('leaves the run it is given as it was', () => {
    const spec = boardOf('climb-twos-fours-1');
    const state = along(spec, ['2,2,W']);
    const before = JSON.stringify(state);
    wayFrom(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});
