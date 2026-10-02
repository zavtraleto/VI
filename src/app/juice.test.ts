import { describe, expect, it } from 'vitest';
import { emptyRun, put } from '../rules/testkit';
import { HITSTOP_MS, Hitstop, beatsOf, chainTier, matchTier } from './juice';

describe('tiers', () => {
  it('keep a plain group small and make a large one a beat', () => {
    expect(matchTier(2)).toBe(0);
    expect(matchTier(4)).toBe(0);
    expect(matchTier(5)).toBe(1);
  });

  it('grow with every join of a chain and stop at the largest', () => {
    const tiers = [1, 2, 3, 4, 5, 6, 9].map(chainTier);
    expect(tiers).toEqual([0, 1, 2, 3, 3, 4, 4]);
    expect(Math.max(...tiers)).toBe(HITSTOP_MS.length - 1);
  });
});

describe('beats of a tick', () => {
  it('place a group sent on the cells of its dice', () => {
    const state = emptyRun();
    for (const [x, z] of [[1, 1], [2, 1]]) {
      const cube = put(state, x, z, 2, 'sinking');
      cube.reactionId = 7;
    }
    put(state, 4, 4, 2);
    const beats = beatsOf(state, [{ type: 'match', reactionId: 7, value: 2, count: 2, points: 4 }]);
    expect(beats).toHaveLength(1);
    expect(beats[0]).toMatchObject({ kind: 'match', value: 2, tier: 0, points: 4, chain: 1 });
    expect(beats[0].cells).toEqual([{ x: 1, z: 1 }, { x: 2, z: 1 }]);
  });

  it('place a join on the dice that joined, and a long chain on all of it', () => {
    const state = emptyRun();
    const old = put(state, 1, 1, 3, 'sinking');
    old.reactionId = 2;
    old.t = 30;
    const fresh = put(state, 2, 1, 3, 'sinking');
    fresh.reactionId = 2;
    fresh.t = 0;
    const second = beatsOf(state, [{ type: 'chain', reactionId: 2, value: 3, chain: 2, count: 1, points: 24 }])[0];
    expect(second.tier).toBe(1);
    expect(second.cells).toEqual([{ x: 2, z: 1 }]);
    const third = beatsOf(state, [{ type: 'chain', reactionId: 2, value: 3, chain: 3, count: 1, points: 36 }])[0];
    expect(third.tier).toBe(2);
    expect(third.cells).toHaveLength(2);
  });

  it('say nothing of a level passed in the exercise', () => {
    const state = emptyRun();
    expect(beatsOf(state, [{ type: 'levelUp', level: 2 }])).toHaveLength(1);
    state.tutorial = { step: 0, timer: 0, done: false };
    expect(beatsOf(state, [{ type: 'levelUp', level: 2 }])).toHaveLength(0);
  });
});

describe('hitstop', () => {
  it('holds the simulation for the time of its tier and no longer', () => {
    const hold = new Hitstop();
    expect(hold.take(16)).toBe(16);
    hold.hold(2);
    expect(hold.take(16)).toBe(0);
    expect(hold.take(16)).toBe(0);
    expect(hold.take(16)).toBe(48 - HITSTOP_MS[2]);
    expect(hold.take(16)).toBe(16);
  });

  it('does not pile up over beats', () => {
    const hold = new Hitstop();
    for (let i = 0; i < 10; i++) hold.hold(4);
    let held = 0;
    for (let i = 0; i < 20; i++) held += 16 - hold.take(16);
    expect(held).toBe(HITSTOP_MS[4]);
  });
});
