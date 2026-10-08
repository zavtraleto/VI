import { describe, expect, it } from 'vitest';
import { FIRST_LEVEL } from '../levels/first';
import { LEVELS } from '../levels/levels';
import { createRun, defaultConfig, step, type LevelSpec, type RunState } from '../rules';
import { land, levelRun, ori, put } from '../rules/testkit';
import { laidFace } from './laid';

const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });

/** Makes a move or a step and lets it come to its end. */
function act(state: RunState, dir: 'N' | 'E' | 'S' | 'W'): void {
  for (let i = 0; i <= state.config.actionTicks * 2; i++) step(state, i === 0 ? dir : null);
}

describe('the light of a die laid as leaving', () => {
  it('is that of the face of the die, by its own reaction: the stair of the second stage shows a six', () => {
    const state = start(FIRST_LEVEL[1]);
    expect(laidFace(state)).toBe(6);
    // The reaction of the die is asked, not the first there is.
    state.reactions.unshift({ id: 999, value: 2, chain: 1, total: 1 });
    expect(laidFace(state)).toBe(6);
  });

  it('is there while the die is: walked over it is still going, and gone with the first roll it is none', () => {
    const state = start(FIRST_LEVEL[1]);
    act(state, 'N');
    act(state, 'E');
    expect(laidFace(state)).toBe(6);
    act(state, 'E');
    expect(state.cubes.some((cube) => cube.x === 0 && cube.z === 2)).toBe(false);
    expect(laidFace(state)).toBe(0);
  });

  it('is none on a board whose layout lays no die as leaving', () => {
    for (const spec of [FIRST_LEVEL[0], FIRST_LEVEL[2], FIRST_LEVEL[3], LEVELS[0]]) expect(laidFace(start(spec))).toBe(0);
  });

  it('is none for dice that go by a group of their own, as after a move taken back on a level of the list', () => {
    const state = levelRun();
    put(state, 0, 0, 2);
    land(state, put(state, 1, 0, 2));
    expect(state.cubes.every((cube) => cube.state === 'sinking')).toBe(true);
    expect(laidFace(state)).toBe(0);
  });

  it('is none for another die that is going on the cell the laid one stood on', () => {
    const state = start(FIRST_LEVEL[1]);
    const stair = state.cubes.find((cube) => cube.state === 'sinking')!;
    stair.ori = ori({ top: 3, north: 1 });
    expect(laidFace(state)).toBe(0);
  });

  it('is none outside the levels', () => {
    expect(laidFace(createRun({ seed: 1, config: defaultConfig() }))).toBe(0);
  });
});
