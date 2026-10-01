import { describe, expect, it } from 'vitest';
import { cubeAt } from './board';
import { step } from './sim';
import { act, emptyRun, land, place, put, putOri, run, snapshot } from './testkit';

describe('moving on top of cubes', () => {
  it('rolls into an empty cell, changes the top face and carries the player', () => {
    const s = emptyRun();
    const cube = putOri(s, 3, 4, { top: 1, south: 2 });
    place(s, 3, 4, 'top');
    act(s, 'N');
    expect(cube.x).toBe(3);
    expect(cube.z).toBe(3);
    expect(cube.ori.top).toBe(2);
    expect(cube.state).toBe('idle');
    expect(s.player).toEqual({ x: 3, z: 3, level: 'top' });
    expect(cubeAt(s, 3, 4)).toBeUndefined();
  });

  it('hops to a neighbouring cube without rotating anything', () => {
    const s = emptyRun();
    const a = put(s, 3, 4, 6);
    const b = put(s, 4, 4, 5);
    const before = JSON.stringify([a.ori, b.ori]);
    place(s, 3, 4, 'top');
    act(s, 'E');
    expect(s.player).toEqual({ x: 4, z: 4, level: 'top' });
    expect(JSON.stringify([a.ori, b.ori])).toBe(before);
    expect([a.x, a.z, b.x, b.z]).toEqual([3, 4, 4, 4]);
  });

  it('is blocked by the board edge and by a tall rising neighbour, changing nothing', () => {
    const s = emptyRun();
    put(s, 0, 0, 6);
    const rising = put(s, 1, 0, 5, 'rising');
    rising.t = Math.ceil(s.config.risingTicks * 0.6);
    place(s, 0, 0, 'top');
    const before = snapshot(s);
    expect(step(s, 'W')).toBe(true);
    expect(s.events).toContainEqual({ type: 'blocked', dir: 'W' });
    expect(step(s, 'N')).toBe(true);
    expect(step(s, 'E')).toBe(true);
    expect(s.stats.blockedSteps).toBe(3);
    rising.t -= 3; // the rising cube aged three ticks; nothing else may differ
    expect(snapshot(s)).toBe(before);
  });

  it('does not accept a command while an action is in progress', () => {
    const s = emptyRun();
    put(s, 3, 4, 6);
    place(s, 3, 4, 'top');
    expect(step(s, 'N')).toBe(true);
    expect(step(s, 'N')).toBe(false);
    run(s, s.config.actionTicks - 2);
    expect(step(s, 'N')).toBe(true);
    run(s, s.config.actionTicks);
    expect(s.player.z).toBe(2);
  });
});

describe('moving on the ground', () => {
  it('walks into an empty cell', () => {
    const s = emptyRun();
    act(s, 'W');
    expect(s.player).toEqual({ x: 2, z: 4, level: 'ground' });
  });

  it('pushes a cube without rotating it', () => {
    const s = emptyRun();
    const cube = put(s, 3, 3, 4);
    const before = JSON.stringify(cube.ori);
    act(s, 'N');
    expect([cube.x, cube.z]).toEqual([3, 2]);
    expect(JSON.stringify(cube.ori)).toBe(before);
    expect(s.player).toEqual({ x: 3, z: 3, level: 'ground' });
  });

  it('cannot push a row of cubes or push against the edge', () => {
    const s = emptyRun();
    put(s, 3, 3, 4);
    put(s, 3, 2, 5);
    const before = snapshot(s);
    step(s, 'N');
    expect(snapshot(s)).toBe(before);

    const t = emptyRun();
    put(t, 3, 0, 4);
    place(t, 3, 1, 'ground');
    const beforeT = snapshot(t);
    step(t, 'N');
    expect(snapshot(t)).toBe(beforeT);
  });

  it('mounts a rising cube at any height', () => {
    for (const progress of [0.1, 0.5, 0.95]) {
      const s = emptyRun();
      const cube = put(s, 3, 3, 4, 'rising');
      cube.t = Math.floor(s.config.risingTicks * progress);
      act(s, 'N');
      expect(s.player).toEqual({ x: 3, z: 3, level: 'top' });
    }
  });

  it('mounts a sinking cube at any height', () => {
    for (const progress of [0, 0.5, 0.9]) {
      const s = emptyRun();
      const cube = put(s, 3, 3, 4, 'sinking');
      cube.t = Math.floor(s.config.sinkingTicks * progress);
      act(s, 'N');
      expect(s.player).toEqual({ x: 3, z: 3, level: 'top' });
    }
  });

  it('respects a lower mount height when it is tuned down', () => {
    const s = emptyRun({}, 1, { mountHeight: 0.5 });
    const tall = put(s, 3, 3, 4, 'rising');
    tall.t = Math.ceil(s.config.risingTicks * 0.6);
    step(s, 'N');
    expect(s.player).toEqual({ x: 3, z: 4, level: 'ground' });
  });

  it('climbs an unpushable cube only with floorClimb on', () => {
    const off = emptyRun();
    put(off, 3, 3, 4);
    put(off, 3, 2, 5);
    step(off, 'N');
    expect(off.player.level).toBe('ground');

    const on = emptyRun({ floorClimb: true });
    put(on, 3, 3, 4);
    put(on, 3, 2, 5);
    act(on, 'N');
    expect(on.player).toEqual({ x: 3, z: 3, level: 'top' });
  });

  it('still pushes with floorClimb on when the push is possible', () => {
    const s = emptyRun({ floorClimb: true });
    const cube = put(s, 3, 3, 4);
    act(s, 'N');
    expect(cube.z).toBe(2);
    expect(s.player.level).toBe('ground');
  });
});

describe('moving from a sinking cube', () => {
  it('hops to a neighbour at any height', () => {
    const s = emptyRun();
    put(s, 3, 4, 4, 'sinking');
    put(s, 4, 4, 5);
    place(s, 3, 4, 'top');
    act(s, 'E');
    expect(s.player).toEqual({ x: 4, z: 4, level: 'top' });
  });

  it('cannot roll, and steps down only when low enough', () => {
    const s = emptyRun();
    const cube = put(s, 3, 4, 4, 'sinking');
    place(s, 3, 4, 'top');
    step(s, 'N');
    expect(s.player).toEqual({ x: 3, z: 4, level: 'top' });
    expect([cube.x, cube.z]).toEqual([3, 4]);

    cube.t = Math.ceil(s.config.sinkingTicks * 0.3); // three quarters high is low enough to step off
    act(s, 'N');
    expect(s.player).toEqual({ x: 3, z: 3, level: 'ground' });
    expect([cube.x, cube.z]).toEqual([3, 4]);
  });

  it('cannot be stepped off while it is rising, however low it is', () => {
    const s = emptyRun();
    const cube = put(s, 3, 4, 4, 'rising');
    cube.t = 5;
    place(s, 3, 4, 'top');
    step(s, 'N');
    expect(s.events).toContainEqual({ type: 'blocked', dir: 'N' });
    expect(s.player).toEqual({ x: 3, z: 4, level: 'top' });
  });

  it('can be mounted from the ground for most of a rise, but rolled over only when low', () => {
    const s = emptyRun();
    const rising = put(s, 3, 3, 4, 'rising');
    rising.t = Math.floor(s.config.risingTicks * 0.7);
    act(s, 'N');
    expect(s.player).toEqual({ x: 3, z: 3, level: 'top' });

    const t = emptyRun();
    put(t, 3, 4, 6);
    const mid = put(t, 3, 3, 4, 'rising');
    mid.t = Math.floor(t.config.risingTicks * 0.7);
    place(t, 3, 4, 'top');
    step(t, 'N');
    expect(t.events).toContainEqual({ type: 'blocked', dir: 'N' });
  });
});

describe('rolling over low cubes', () => {
  /** Three sinking 3s in a row at z = 3, already resolved as a reaction. */
  function sinkingThrees() {
    const s = emptyRun();
    put(s, 0, 3, 3);
    put(s, 1, 3, 3);
    const last = put(s, 2, 3, 3);
    land(s, last);
    expect(s.score).toBe(9);
    return s;
  }

  it('hops onto a sinking cube while it is still tall', () => {
    const s = sinkingThrees();
    const own = putOri(s, 2, 4, { top: 6, south: 3 });
    place(s, 2, 4, 'top');
    act(s, 'N');
    expect(s.player).toEqual({ x: 2, z: 3, level: 'top' });
    expect([own.x, own.z]).toEqual([2, 4]);
  });

  it('rolls over a sinking cube soon after it starts to sink', () => {
    const s = sinkingThrees();
    run(s, s.config.sinkingTicks / 4);
    const own = putOri(s, 2, 4, { top: 6, south: 5 });
    place(s, 2, 4, 'top');
    act(s, 'N');
    expect([own.x, own.z]).toEqual([2, 3]);
    expect(s.cubes.length).toBe(3);
  });

  it('joins the chain when rolled onto a low sinking cube of the same value', () => {
    const s = sinkingThrees();
    run(s, s.config.sinkingTicks / 2);
    const own = putOri(s, 2, 4, { top: 6, south: 3 });
    place(s, 2, 4, 'top');
    act(s, 'N');
    expect([own.x, own.z]).toEqual([2, 3]);
    expect(own.state).toBe('sinking');
    expect(own.reactionId).toBe(1);
    expect(s.reactions[0]).toEqual({ id: 1, value: 3, chain: 2, total: 4 });
    expect(s.score).toBe(9 + 24);
    expect(s.cubes.length).toBe(3); // the cube underneath is gone
    expect(s.removed).toBe(1);
  });

  it('keeps the chain alive when the cube rolled over was the last one sinking', () => {
    const s = emptyRun();
    put(s, 2, 3, 2);
    const b = put(s, 2, 2, 2);
    land(s, b);
    run(s, s.config.sinkingTicks / 2);
    const first = cubeAt(s, 2, 3)!;
    b.t = s.config.sinkingTicks - 3; // the other cube disappears mid-roll
    const own = putOri(s, 2, 4, { top: 6, south: 2 });
    place(s, 2, 4, 'top');
    expect(first.state).toBe('sinking');
    act(s, 'N');
    expect(own.state).toBe('sinking');
    expect(s.reactions).toEqual([{ id: 1, value: 2, chain: 2, total: 3 }]);
  });

  it('just replaces a low sinking cube of another value', () => {
    const s = sinkingThrees();
    run(s, s.config.sinkingTicks / 2);
    const own = putOri(s, 2, 4, { top: 6, south: 5 });
    place(s, 2, 4, 'top');
    act(s, 'N');
    expect([own.x, own.z]).toEqual([2, 3]);
    expect(own.state).toBe('idle');
    expect(own.ori.top).toBe(5);
    expect(s.score).toBe(9);
    expect(s.cubes.length).toBe(3);
  });

  it('sends a low rising cube to the nearest free cell', () => {
    const s = emptyRun();
    const own = put(s, 3, 4, 6);
    const rising = put(s, 3, 3, 5, 'rising');
    rising.t = 20;
    place(s, 3, 4, 'top');
    step(s, 'N');
    expect(s.events).toContainEqual({ type: 'displaced', cubeId: rising.id });
    expect([rising.x, rising.z]).toEqual([3, 2]); // nearest free, lowest index first
    expect(rising.state).toBe('rising');
    expect(rising.t).toBe(21); // it keeps the progress it had
    run(s, s.config.actionTicks);
    expect([own.x, own.z]).toEqual([3, 3]);
    expect(cubeAt(s, 3, 3)).toBe(own);
    expect(cubeAt(s, 3, 2)).toBe(rising);
  });

  it('cannot roll over a low rising cube when the board has no free cell', () => {
    const s = emptyRun();
    for (let i = 0; i < 49; i++) {
      const x = i % 7;
      const z = Math.floor(i / 7);
      put(s, x, z, (x + z) % 2 === 0 ? 6 : 5, x === 3 && z === 3 ? 'rising' : 'idle');
    }
    place(s, 3, 4, 'top');
    step(s, 'N');
    expect(s.events).toContainEqual({ type: 'blocked', dir: 'N' });
  });

  it('pushes a cube over a low sinking cube', () => {
    const s = sinkingThrees();
    run(s, s.config.sinkingTicks / 2);
    const pushed = put(s, 2, 4, 3);
    place(s, 2, 5, 'ground');
    act(s, 'N');
    expect([pushed.x, pushed.z]).toEqual([2, 3]);
    expect(pushed.state).toBe('sinking');
    expect(s.score).toBe(9 + 24);
  });
});
