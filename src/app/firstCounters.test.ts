import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../rules/config';
import { createRun } from '../rules/sim';
import type { LevelSpec, RunState } from '../rules/types';
import { FIRST_LEVEL } from '../levels/first';
import { firstCounters } from './firstCounters';

const stageOf = (id: string): LevelSpec => FIRST_LEVEL.find((spec) => spec.id === id)!;
const start = (id: string): RunState => {
  const spec = stageOf(id);
  return createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
};
const places = (state: RunState) => firstCounters(state).map(({ value, have, need, cells }) => ({ value, have, need, cells: cells.map(({ x, z }) => `${x},${z}`).sort() }));

describe('the plaques of the first level', () => {
  it('stand over a lone die of the working face on the first stage', () => {
    expect(places(start('F1a'))).toEqual([{ value: 2, have: 1, need: 2, cells: ['5,2'] }]);
  });

  it('stand over the pair of threes on the second stage, and over the pair on the last', () => {
    expect(places(start('F1b'))).toEqual([{ value: 3, have: 2, need: 3, cells: ['2,0', '3,0'] }]);
    expect(places(start('F1d'))).toEqual([{ value: 3, have: 2, need: 3, cells: ['0,0', '1,0'] }]);
  });

  it('stand over the lone two of the third stage', () => {
    expect(places(start('F1c'))).toEqual([{ value: 2, have: 1, need: 2, cells: ['0,0'] }]);
  });

  it('leave out the die the player stands on, whichever it is', () => {
    // The player starts on the two at (0,2): only the other two has a plaque; on the other, only the first has.
    const state = start('F1a');
    expect(places(state).map((p) => p.cells)).toEqual([['5,2']]);
    state.player = { x: 5, z: 2, level: 'top' };
    expect(places(state).map((p) => p.cells)).toEqual([['0,2']]);
  });

  it('count a die the player stands beside, and not one that is going', () => {
    const state = start('F1b');
    const cube = state.cubes.find((c) => c.x === 3 && c.z === 0)!;
    cube.state = 'sinking';
    expect(places(state)).toEqual([{ value: 3, have: 1, need: 3, cells: ['2,0'] }]);
  });

  it('give none for a heap as large as its combo', () => {
    const state = start('F1d');
    // The one under the player turned to a three makes three in a row of an L: a combo, which has no plaque.
    const third = state.cubes.find((c) => c.x === 1 && c.z === 1)!;
    third.ori = { ...third.ori, top: 3 };
    state.player = { x: 2, z: 1, level: 'ground' };
    expect(firstCounters(state)).toEqual([]);
  });
});
