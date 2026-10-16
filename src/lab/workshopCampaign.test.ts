import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import type { Seconds } from './labFacts';
import { wayToKeep } from './workshopCampaign';

const head = { id: 'R01', seed: 0, size: 3, goal: { kind: 'clear' }, moves: 0, values: [2], norm: 0, arrival: 'none' } as LevelSpec;
const seconds = (over: Partial<Seconds['check']> = {}): Seconds => ({
  check: { par: 3, exact: true, states: 10, way: ['0,1,N', '0,0,E', '1,0,S'], score: null, kept: null, ...over },
  firsts: 1,
  moves: [],
  trap: null,
});
const board = (status: 'R' | 'D' | 'RC', more: Partial<LevelSpec> = {}, locked = false) => ({ extra: { status }, head: { ...head, ...more }, locked });

describe('the way a board of the row keeps by itself', () => {
  it('is the way the solver proved, for a board of the row that keeps none', () => {
    expect(wayToKeep(board('R'), seconds())).toEqual({ par: 3, exact: true, solution: ['0,1,N', '0,0,E', '1,0,S'] });
  });
  it('is taken by the same board once it is of the row or unlocked: the answer counted before is not lost', () => {
    const proved = seconds();
    expect(wayToKeep(board('D'), proved)).toBeNull();
    expect(wayToKeep(board('R', {}, true), proved)).toBeNull();
    expect(wayToKeep(board('R'), proved)).not.toBeNull();
  });
  it('is none while the solver counts, where it failed, gave up, found no way or did not prove the fewest', () => {
    expect(wayToKeep(board('R'), null)).toBeNull();
    expect(wayToKeep(board('R'), 'the worker fell')).toBeNull();
    expect(wayToKeep(board('R'), seconds({ par: null, way: null }))).toBeNull();
    expect(wayToKeep(board('R'), seconds({ exact: false }))).toBeNull();
    expect(wayToKeep(board('R'), seconds({ par: 0, way: [] }))).toBeNull();
  });
  it('is none once the board keeps its way: written, it is not written again', () => {
    expect(wayToKeep(board('R', { par: 3, exact: true, solution: ['0,1,N', '0,0,E', '1,0,S'] }), seconds())).toBeNull();
    expect(wayToKeep(board('R', { par: 3, exact: false, solution: ['0,1,N', '0,0,E', '1,0,S'] }), seconds())).not.toBeNull();
  });
});
