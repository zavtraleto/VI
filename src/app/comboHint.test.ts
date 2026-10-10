import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels/levels';
import { defaultConfig } from '../rules/config';
import { moveOf, movesAt, playMove, solveFrom } from '../rules/levelSolver';
import { createRun } from '../rules/sim';
import type { LevelSpec, RunState } from '../rules/types';
import { comboHints } from './comboHint';
import { boardKey, stillShort } from './comboHintWork';

const levelOf = (id: string): LevelSpec => LEVELS.find((spec) => spec.id === id)!;
const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
const along = (spec: LevelSpec, moves: readonly string[]): RunState => moves.reduce((state, move) => playMove(state, moveOf(move)), start(spec));

describe('the plaques of a level as a hint', () => {
  it('stands over the heap whose combo is two moves away with the board still to be cleared', () => {
    // P04: four 5s in a row, the fifth two rolls off, and the way of the level begins with those two rolls.
    const hint = comboHints(start(levelOf('P04')));
    expect(hint.settled).toBe(true);
    expect(hint.groups.map(({ value, have, need }) => ({ value, have, need }))).toEqual([{ value: 5, have: 4, need: 5 }]);
  });

  it('says nothing on a board that is over', () => {
    const spec = levelOf('P04');
    const dead = along(spec, ['0,0,E', '1,0,E', '2,1,S', '2,2,N']);
    expect(dead.over).toBe(true);
    expect(comboHints(dead).groups).toEqual([]);
  });

  it('names only heaps a combo is made of within two moves, on a board that can then be cleared', () => {
    for (const spec of LEVELS) {
      const state = start(spec);
      for (const group of comboHints(state).groups) {
        const made = (after: RunState): boolean => group.cells.every(({ x, z }) => after.cubes.some((cube) => cube.x === x && cube.z === z && cube.state === 'sinking' && cube.ori.top === group.value));
        const good = (after: RunState): boolean => made(after) && (after.endReason === 'passed' || (!after.over && solveFrom(after).solution !== null));
        const reached = movesAt(state).some((first) => {
          const one = playMove(state, first);
          return good(one) || (!one.over && movesAt(one).some((second) => good(playMove(one, second))));
        });
        expect(reached, `${spec.id}: the heap of ${group.value}s`).toBe(true);
      }
    }
  });

  it('leaves the board it is asked about as it was', () => {
    const state = start(levelOf('P04'));
    const before = boardKey(state);
    comboHints(state);
    expect(boardKey(state)).toBe(before);
  });
});

describe('a plaque kept while the next board is counted', () => {
  it('stays over a heap that has not changed, and goes from one that has', () => {
    const spec = levelOf('P04');
    const state = start(spec);
    const [heap] = comboHints(state).groups;
    expect(stillShort(state, heap)).toBe(true);
    // The first move of the way rolls another die: the heap stands as it stood.
    expect(stillShort(playMove(state, moveOf('0,0,E')), heap)).toBe(true);
    // The whole way of the level sends the heap off.
    expect(stillShort(along(spec, spec.solution!.slice(0, 3)), heap)).toBe(false);
  });
});
