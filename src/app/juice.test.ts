import { describe, expect, it } from 'vitest';
import { emptyRun, levelRun, put } from '../rules/testkit';
import { HITSTOP_MS, HeldBeats, Hitstop, beatsOf, chainTier, matchTier, type Beat } from './juice';

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

  it('place a join of a level on the whole chain: it strikes as one body with the die that joined', () => {
    const state = levelRun();
    const old = put(state, 1, 1, 3, 'sinking');
    old.reactionId = 2;
    old.t = 30;
    const fresh = put(state, 2, 1, 3, 'sinking');
    fresh.reactionId = 2;
    fresh.t = 1;
    const second = beatsOf(state, [{ type: 'chain', reactionId: 2, value: 3, chain: 2, count: 1, points: 0 }])[0];
    expect(second.cells).toEqual([{ x: 1, z: 1 }, { x: 2, z: 1 }]);
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

describe('the beats of a level, held until its dice come down', () => {
  const beat = (kind: Beat['kind'], value = 2): Beat => ({ kind, value, tier: 0, cells: [{ x: 1, z: 1 }], points: 0, chain: 1 });

  it('keeps a group and a chain of a level, and lets everything else through at once', () => {
    const held = new HeldBeats();
    const step = beat('step');
    expect(held.take([beat('match'), step, beat('chain')], true)).toEqual([step]);
    expect(held.release().map((b) => b.kind)).toEqual(['match', 'chain']);
    // Let go of once: the next strike has nothing to give.
    expect(held.release()).toEqual([]);
  });

  it('gives every beat it holds on one strike: two groups made on one landing strike together', () => {
    const held = new HeldBeats();
    held.take([beat('match', 2), beat('match', 3)], true);
    expect(held.release().map((b) => b.value)).toEqual([2, 3]);
  });

  it('says whether a strike is waited for: what is said over a chain waits with it', () => {
    const held = new HeldBeats();
    expect(held.waiting).toBe(false);
    held.take([beat('step')], true);
    expect(held.waiting).toBe(false);
    held.take([beat('chain')], true);
    expect(held.waiting).toBe(true);
    held.release();
    expect(held.waiting).toBe(false);
    held.take([beat('chain')], false);
    expect(held.waiting).toBe(false);
  });

  it('holds nothing outside a level', () => {
    const held = new HeldBeats();
    const beats = [beat('match'), beat('chain')];
    expect(held.take(beats, false)).toEqual(beats);
    expect(held.release()).toEqual([]);
  });

  it('forgets what it held when the board is over or a new one is put on', () => {
    const held = new HeldBeats();
    held.take([beat('match')], true);
    held.reset();
    expect(held.release()).toEqual([]);
  });
});
