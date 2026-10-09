import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../rules/config';
import { createRun } from '../rules/sim';
import type { LevelSpec, RunState } from '../rules/types';
import { ROAD } from '../levels/road';
import { roadCounters } from './roadCounters';

const pieceOf = (id: string): LevelSpec => ROAD.find((spec) => spec.id === id)!;
const start = (id: string): RunState => {
  const spec = pieceOf(id);
  return createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
};
const places = (state: RunState) => roadCounters(state).map(({ value, have, need, cells }) => ({ value, have, need, cells: cells.map(({ x, z }) => `${x},${z}`).sort() }));

describe('the plaques of the road', () => {
  it('stand over the fixed 2 at the far end of the strip, and not over the 2 the player starts on', () => {
    expect(places(start('R01'))).toEqual([{ value: 2, have: 1, need: 2, cells: ['2,0'] }]);
  });

  it('stand over the pair of threes on the second piece and on the fourth', () => {
    expect(places(start('R02'))).toEqual([{ value: 3, have: 2, need: 3, cells: ['1,0', '1,1'] }]);
    expect(places(start('R04'))).toEqual([{ value: 3, have: 2, need: 3, cells: ['0,1', '1,1'] }]);
  });

  it('stand over a lone two, and over the fours of the corner the player does not stand on', () => {
    expect(places(start('R03'))).toEqual([{ value: 2, have: 1, need: 2, cells: ['1,1'] }]);
    expect(places(start('R07'))).toEqual([{ value: 2, have: 1, need: 2, cells: ['1,1'] }]);
    // Three 4s stand as a corner and the player is on one of them: the plaque counts the two that are left as they are.
    expect(places(start('R05'))).toEqual([{ value: 4, have: 2, need: 4, cells: ['3,1', '3,2'] }]);
  });

  it('stand over each of the two asks of the mix of the first block: the pair of threes and the lone two', () => {
    expect(places(start('R06'))).toEqual([
      { value: 3, have: 2, need: 3, cells: ['2,0', '3,0'] },
      { value: 2, have: 1, need: 2, cells: ['3,2'] },
    ]);
  });

  it('leave out the die the player stands on, whichever it is', () => {
    // The player starts on the two at the south end: only the other two has a plaque; on the other, only the first has.
    const state = start('R01');
    expect(places(state).map((p) => p.cells)).toEqual([['2,0']]);
    state.player = { x: 2, z: 0, level: 'top' };
    expect(places(state).map((p) => p.cells)).toEqual([['2,5']]);
  });

  it('count a die the player stands beside, and not one that is going', () => {
    const state = start('R02');
    const cube = state.cubes.find((c) => c.x === 1 && c.z === 1)!;
    cube.state = 'sinking';
    expect(places(state)).toEqual([{ value: 3, have: 1, need: 3, cells: ['1,0'] }]);
  });

  it('give none for a heap as large as its combo', () => {
    const state = start('R04');
    // A third three put under the pair makes three side by side: a combo, which has no plaque.
    const third = state.cubes.find((c) => c.x === 1 && c.z === 3)!;
    third.x = 1;
    third.z = 2;
    third.ori = { ...third.ori, top: 3 };
    state.grid.fill(0);
    for (const cube of state.cubes) state.grid[cube.z * state.config.size + cube.x] = cube.id;
    state.player = { x: 1, z: 3, level: 'ground' };
    expect(roadCounters(state)).toEqual([]);
  });
});
