import { describe, expect, it } from 'vitest';
import { DOWN_AND_UP } from './boardSamples';
import { createRun, defaultConfig } from '../rules';
import { moveOf, tryWay } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { normalSpec, parseBoard, printBoard } from './boardFile';
import { CAMPAIGN } from './campaign';
import { specFromState } from './snapshot';

/** A level without the way it keeps. */
function bare(spec: LevelSpec): LevelSpec {
  const { par, exact, solution, ...rest } = spec;
  return rest;
}

describe('specFromState', () => {
  it.each(CAMPAIGN.filter((place) => place.chapter === 0).map(({ spec }) => [spec.id, spec] as const))('gives the start of %s back as the board it is, without its way', (_, spec) => {
    const state = createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
    expect(normalSpec(specFromState(state, spec))).toEqual(normalSpec(bare(spec)));
  });
  it('writes the dice that are going as leaving, with the moves they have left, and the board reads back from its file', () => {
    const P06 = DOWN_AND_UP;
    // Two moves of the way of P06 make its first pair: the two dice are going, and have their two moves.
    const state = tryWay(P06, P06.solution!.slice(0, 2).map(moveOf)).state;
    const spec = specFromState(state, P06);
    expect(spec.layout!.leaving).toHaveLength(2);
    expect(spec.layout!.leaving!.every((leaving) => leaving.moves === 2)).toBe(true);
    expect(spec.par).toBeUndefined();
    expect(normalSpec(parseBoard(printBoard(spec), 'snap'))).toEqual(normalSpec(spec));
  });
  it('starts the player on the floor where they stand on it', () => {
    const P06 = DOWN_AND_UP;
    // The third move of the way is a push: it is made from the floor.
    const state = tryWay(P06, P06.solution!.slice(0, 3).map(moveOf)).state;
    expect(specFromState(state, P06).layout!.onFloor).toBe(true);
  });
});
