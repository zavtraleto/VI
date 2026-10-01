import { describe, expect, it } from 'vitest';
import { previewMove } from './preview';
import { step } from './sim';
import { act, emptyRun, land, place, put, putOri, run } from './testkit';

function states(s: ReturnType<typeof emptyRun>): string[] {
  return s.cubes.map((c) => c.state);
}

describe('groups', () => {
  it('clears two 2s', () => {
    const s = emptyRun();
    put(s, 0, 0, 2);
    land(s, put(s, 1, 0, 2));
    expect(states(s)).toEqual(['sinking', 'sinking']);
    expect(s.score).toBe(4);
    expect(s.events).toContainEqual({ type: 'match', reactionId: 1, value: 2, count: 2, points: 4 });
  });

  it('does not clear two 3s', () => {
    const s = emptyRun();
    put(s, 0, 0, 3);
    land(s, put(s, 1, 0, 3));
    expect(states(s)).toEqual(['idle', 'idle']);
    expect(s.score).toBe(0);
  });

  it('clears three 3s in an L shape', () => {
    const s = emptyRun();
    put(s, 0, 0, 3);
    put(s, 1, 0, 3);
    land(s, put(s, 1, 1, 3));
    expect(states(s)).toEqual(['sinking', 'sinking', 'sinking']);
    expect(s.score).toBe(9);
  });

  it('does not connect diagonal neighbours', () => {
    const s = emptyRun();
    put(s, 0, 0, 2);
    land(s, put(s, 1, 1, 2));
    expect(states(s)).toEqual(['idle', 'idle']);
  });

  it('scores four 3s cleared at once as 12', () => {
    const s = emptyRun();
    for (let x = 0; x < 3; x++) put(s, x, 0, 3);
    land(s, put(s, 3, 0, 3));
    expect(s.score).toBe(12);
    expect(s.maxChain).toBe(1);
  });

  it('never clears on its own: a group waits until the player moves a cube into it', () => {
    const s = emptyRun();
    put(s, 0, 0, 2);
    put(s, 1, 0, 2, 'rising');
    run(s, s.config.risingTicks + 50);
    expect(states(s)).toEqual(['idle', 'idle']);
    expect(s.score).toBe(0);

    // Rolling a third 2 next to the waiting pair clears all three.
    const own = putOri(s, 2, 1, { top: 6, south: 2 });
    place(s, 2, 1, 'top');
    act(s, 'N');
    expect(own.ori.top).toBe(2);
    expect(states(s)).toEqual(['sinking', 'sinking', 'sinking']);
    expect(s.score).toBe(6);
  });

  it('ignores rising cubes when counting a group', () => {
    const s = emptyRun();
    put(s, 0, 0, 3);
    put(s, 2, 0, 3, 'rising');
    land(s, put(s, 1, 0, 3));
    expect(s.score).toBe(0);
  });
});

describe('chains', () => {
  function threeThrees() {
    const s = emptyRun();
    put(s, 0, 0, 3);
    put(s, 1, 0, 3);
    land(s, put(s, 1, 1, 3));
    return s;
  }

  it('lets a fourth 3 join sinking 3s: 9 + 24 = 33', () => {
    const s = threeThrees();
    run(s, 50);
    const fourth = put(s, 2, 0, 3);
    land(s, fourth);
    expect(fourth.state).toBe('sinking');
    expect(fourth.reactionId).toBe(s.cubes[0].reactionId);
    expect(s.score).toBe(33);
    expect(s.reactions).toEqual([{ id: 1, value: 3, chain: 2, total: 4 }]);
    expect(s.maxChain).toBe(2);
  });

  it('gives the joining cube its own timer without restarting the old ones', () => {
    const s = threeThrees();
    run(s, 50);
    const fourth = put(s, 2, 0, 3);
    land(s, fourth);
    expect(fourth.t).toBe(0);
    expect(s.cubes[0].t).toBe(50);
    run(s, s.config.sinkingTicks - 50);
    expect(s.cubes.map((c) => c.id)).toEqual([fourth.id]);
    expect(s.reactions.length).toBe(1);
    run(s, 50);
    expect(s.cubes.length).toBe(0);
    expect(s.reactions.length).toBe(0);
  });

  it('does not treat a lone 3 as a chain once the reaction is gone', () => {
    const s = threeThrees();
    run(s, s.config.sinkingTicks);
    expect(s.cubes.length).toBe(0);
    const lone = put(s, 2, 0, 3);
    land(s, lone);
    expect(lone.state).toBe('idle');
    expect(s.score).toBe(9);
  });

  it('raises the chain by one for a join of several cubes', () => {
    const s = threeThrees();
    put(s, 3, 0, 3);
    land(s, put(s, 2, 0, 3));
    expect(s.reactions[0]).toEqual({ id: 1, value: 3, chain: 2, total: 5 });
    expect(s.score).toBe(9 + 3 * 5 * 2);
  });

  it('does not join a reaction of a different value', () => {
    const s = threeThrees();
    const four = put(s, 2, 0, 4);
    land(s, four);
    expect(four.state).toBe('idle');
  });

  it('does not pull in a cube that merely rose next to the sinking ones', () => {
    const s = threeThrees();
    const risen = put(s, 2, 0, 3, 'rising');
    risen.t = s.config.risingTicks - 5;
    run(s, 30);
    expect(risen.state).toBe('idle');
    expect(s.score).toBe(9);
  });

  it('merges reactions bridged by one component', () => {
    const s = emptyRun();
    put(s, 0, 0, 3);
    put(s, 1, 0, 3);
    land(s, put(s, 0, 1, 3));
    put(s, 4, 0, 3);
    put(s, 5, 0, 3);
    land(s, put(s, 5, 1, 3));
    expect(s.reactions.map((r) => r.id)).toEqual([1, 2]);
    expect(s.score).toBe(18);

    land(s, put(s, 0, 2, 3)); // extends reaction 1: chain 2, total 4
    expect(s.score).toBe(18 + 24);

    put(s, 2, 0, 3);
    land(s, put(s, 3, 0, 3));
    expect(s.reactions).toEqual([{ id: 1, value: 3, chain: 3, total: 9 }]);
    expect(s.score).toBe(18 + 24 + 3 * 9 * 3);
    expect(new Set(s.cubes.map((c) => c.reactionId))).toEqual(new Set([1]));
    expect(s.maxChain).toBe(3);
  });
});

describe('Happy One', () => {
  /** Two sinking 2s at (0,0) and (1,0). */
  function sinkingPair() {
    const s = emptyRun();
    put(s, 0, 0, 2);
    land(s, put(s, 1, 0, 2));
    expect(s.score).toBe(4);
    return s;
  }

  it('is not triggered by a 1 that just happens to stand next to sinking dice', () => {
    const s = emptyRun();
    const bystander = put(s, 2, 0, 1);
    const far = put(s, 6, 6, 1);
    put(s, 0, 0, 2);
    land(s, put(s, 1, 0, 2));
    run(s, 100);
    expect(bystander.state).toBe('idle');
    expect(far.state).toBe('idle');
    expect(s.score).toBe(4);
  });

  it('is not triggered by a 1 that rises next to sinking dice', () => {
    const s = sinkingPair();
    const risen = put(s, 2, 0, 1, 'rising');
    risen.t = s.config.risingTicks - 5;
    const far = put(s, 6, 6, 1);
    run(s, 30);
    expect(risen.state).toBe('idle');
    expect(far.state).toBe('idle');
    expect(s.score).toBe(4);
  });

  it('sinks every resting 1 when the player rolls a 1 next to sinking dice, sparing the one they ride', () => {
    const s = sinkingPair();
    const own = putOri(s, 2, 1, { top: 2, south: 1 });
    const far = put(s, 6, 6, 1);
    const other = put(s, 4, 4, 1);
    const rising = put(s, 5, 2, 1, 'rising');
    const three = put(s, 0, 6, 3);
    place(s, 2, 1, 'top');
    expect(previewMove(s, 'N')).toEqual({ kind: 'roll', top: 1, clears: true });
    act(s, 'N');
    expect(own.ori.top).toBe(1);
    expect(own.state).toBe('idle');
    expect(far.state).toBe('sinking');
    expect(other.state).toBe('sinking');
    expect(rising.state).toBe('rising');
    expect(three.state).toBe('idle');
    expect(s.score).toBe(4 + 2);
    expect(s.reactions).toEqual([{ id: 1, value: 2, chain: 1, total: 2 }]);
  });

  it('leaves the ridden 1 standing after the player walks away', () => {
    const s = sinkingPair();
    const own = putOri(s, 2, 1, { top: 2, south: 1 });
    put(s, 6, 6, 1);
    put(s, 3, 0, 5);
    place(s, 2, 1, 'top');
    act(s, 'N');
    act(s, 'E'); // hop to the neighbouring 5
    run(s, 40);
    expect(s.player).toEqual({ x: 3, z: 0, level: 'top' });
    expect(own.state).toBe('idle');
    expect(s.score).toBe(5);
  });

  it('takes the pushed 1 as well when it is pushed from the ground', () => {
    const s = sinkingPair();
    const pushed = put(s, 2, 1, 1);
    const far = put(s, 6, 6, 1);
    place(s, 2, 2, 'ground');
    expect(previewMove(s, 'N')).toEqual({ kind: 'push', top: 1, clears: true });
    act(s, 'N');
    expect([pushed.x, pushed.z]).toEqual([2, 0]);
    expect(pushed.state).toBe('sinking');
    expect(far.state).toBe('sinking');
    expect(s.score).toBe(4 + 2);
  });

  it('does nothing when the rolled 1 is not next to sinking dice', () => {
    const s = sinkingPair();
    const own = putOri(s, 5, 5, { top: 2, south: 1 });
    const far = put(s, 6, 6, 1);
    place(s, 5, 5, 'top');
    expect(previewMove(s, 'N').clears).toBe(false);
    act(s, 'N');
    expect(own.state).toBe('idle');
    expect(far.state).toBe('idle');
    expect(s.score).toBe(4);
  });

  it('awards each 1 only once', () => {
    const s = sinkingPair();
    put(s, 2, 1, 1);
    put(s, 6, 6, 1);
    place(s, 2, 2, 'ground');
    act(s, 'N');
    const after = s.score;
    run(s, 60);
    expect(s.score).toBe(after);
  });

  it('counts sinking 1s as sinking dice for the next 1', () => {
    const s = sinkingPair();
    put(s, 2, 1, 1);
    place(s, 2, 2, 'ground');
    act(s, 'N'); // the 1 at (2,0) is now sinking
    const second = put(s, 3, 1, 1);
    place(s, 3, 2, 'ground');
    act(s, 'N'); // pushed to (3,0), next to the sinking 1
    expect(second.state).toBe('sinking');
  });
});

describe('preview', () => {
  it('predicts a roll that completes a pair of 2s', () => {
    const s = emptyRun();
    putOri(s, 3, 4, { top: 1, south: 2 });
    put(s, 2, 3, 2);
    place(s, 3, 4, 'top');
    expect(previewMove(s, 'N')).toEqual({ kind: 'roll', top: 2, clears: true });
    act(s, 'N');
    expect(s.score).toBe(4);
  });

  it('predicts no clear for a second 3', () => {
    const s = emptyRun();
    putOri(s, 3, 4, { top: 1, south: 3 });
    put(s, 2, 3, 3);
    place(s, 3, 4, 'top');
    expect(previewMove(s, 'N')).toEqual({ kind: 'roll', top: 3, clears: false });
  });

  it('predicts a chain join', () => {
    const s = emptyRun();
    put(s, 0, 3, 3);
    put(s, 1, 3, 3);
    land(s, put(s, 2, 3, 3));
    putOri(s, 3, 4, { top: 1, south: 3 });
    place(s, 3, 4, 'top');
    expect(previewMove(s, 'N')).toEqual({ kind: 'roll', top: 3, clears: true });
    act(s, 'N');
    expect(s.score).toBe(33);
  });

  it('predicts a join by rolling onto a low sinking cube', () => {
    const s = emptyRun();
    put(s, 0, 3, 3);
    put(s, 1, 3, 3);
    land(s, put(s, 2, 3, 3));
    run(s, s.config.sinkingTicks / 2);
    putOri(s, 2, 4, { top: 6, south: 3 });
    place(s, 2, 4, 'top');
    expect(previewMove(s, 'N')).toEqual({ kind: 'roll', top: 3, clears: true });
  });

  it('counts neighbours of the destination, not of the cell being left', () => {
    const s = emptyRun();
    putOri(s, 3, 4, { top: 6, west: 2 });
    put(s, 2, 4, 2); // beside the old cell only
    place(s, 3, 4, 'top');
    expect(previewMove(s, 'E')).toEqual({ kind: 'roll', top: 2, clears: false });
    act(s, 'E');
    expect(s.score).toBe(0);
  });

  it('reports hops, walks and blocked steps', () => {
    const s = emptyRun();
    put(s, 0, 0, 6);
    put(s, 1, 0, 5);
    place(s, 0, 0, 'top');
    expect(previewMove(s, 'E')).toEqual({ kind: 'hop', clears: false });
    expect(previewMove(s, 'N')).toEqual({ kind: 'blocked', clears: false });
    expect(previewMove(s, 'S')).toEqual({ kind: 'roll', top: s.cubes[0].ori.north, clears: false });
    place(s, 4, 4, 'ground');
    expect(previewMove(s, 'E')).toEqual({ kind: 'walk', clears: false });
    expect(step(s, 'E')).toBe(true);
  });
});
