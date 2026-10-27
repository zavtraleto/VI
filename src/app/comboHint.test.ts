import { describe, expect, it } from 'vitest';
import { parkedBoards, rowBoards } from '../levels/boardSets';
import { CAMPAIGN } from '../levels/campaign';
import { defaultConfig } from '../rules/config';
import { moveOf, movesAt, playMove, solveFrom } from '../rules/levelSolver';
import { createRun } from '../rules/sim';
import type { LevelSpec, RunState } from '../rules/types';
import { comboHints } from './comboHint';
import { boardKey, stillShort } from './comboHintWork';

const levelOf = (id: string): LevelSpec => [...rowBoards(), ...parkedBoards()].find((spec) => spec.id === id)!;
const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
const along = (spec: LevelSpec, moves: readonly string[]): RunState => moves.reduce((state, move) => playMove(state, moveOf(move)), start(spec));

describe('the plaques of a level as a hint', () => {
  it('stand over a heap only when one roll of the die under the player makes its combo', () => {
    // hidden-face-3 (was P04): four 5s in a column, the fifth two rolls off; the way begins with those two rolls.
    const spec = levelOf('hidden-face-3');
    expect(comboHints(start(spec)).groups).toEqual([]);
    const hint = comboHints(along(spec, ['3,0,W']));
    expect(hint.settled).toBe(true);
    expect(hint.groups.map(({ value, have, need }) => ({ value, have, need }))).toEqual([{ value: 5, have: 4, need: 5 }]);
  });

  it('says nothing on a board that is over', () => {
    const spec = levelOf('hidden-face-3');
    const dead = along(spec, ['3,0,W', '2,0,W', '1,1,S', '1,2,N']);
    expect(dead.over).toBe(true);
    expect(comboHints(dead).groups).toEqual([]);
  });

  it('stand along the way of every place of the row only over a heap the next roll completes on a shortest way, and never under the player', { timeout: 120_000 }, () => {
    for (const { spec } of CAMPAIGN) {
      let state = start(spec);
      for (const text of spec.solution!) {
        const { player } = state;
        const plaques = comboHints(state).groups;
        const now = solveFrom(state).solution!.par;
        for (const group of plaques) {
          expect(group.cells.some(({ x, z }) => x === player.x && z === player.z), `${spec.id}: a plaque under the player`).toBe(false);
          const made = (after: RunState): boolean => group.cells.every(({ x, z }) => after.cubes.some((cube) => cube.x === x && cube.z === z && cube.state === 'sinking' && cube.ori.top === group.value));
          const keeps = (after: RunState): boolean => after.endReason === 'passed' || (!after.over && solveFrom(after).solution?.par === now - 1);
          const roll = movesAt(state).some((move) => !move.push && move.x === player.x && move.z === player.z && made(playMove(state, move)) && keeps(playMove(state, move)));
          expect(roll, `${spec.id}: the heap of ${group.value}s`).toBe(true);
        }
        state = playMove(state, moveOf(text));
      }
    }
  });

  it('leaves the board it is asked about as it was', () => {
    const state = start(levelOf('hidden-face-3'));
    const before = boardKey(state);
    comboHints(state);
    expect(boardKey(state)).toBe(before);
  });
});

describe('a plaque kept while the next board is counted', () => {
  it('stays over a heap that has not changed, and goes from one that has', () => {
    const spec = levelOf('hidden-face-3');
    const state = along(spec, ['3,0,W']);
    const [heap] = comboHints(state).groups;
    expect(stillShort(state, heap)).toBe(true);
    // A step to another die rolls nothing: the heap stands as it stood.
    expect(stillShort(start(spec), heap)).toBe(true);
    // The way of the level sends the heap off.
    expect(stillShort(along(spec, spec.solution!.slice(0, 2)), heap)).toBe(false);
  });
});
