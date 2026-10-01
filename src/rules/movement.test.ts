import { describe, expect, it } from 'vitest';
import { cubeAt } from './board';
import { step } from './sim';
import { act, emptyRun, place, put, putOri, run, snapshot } from './testkit';

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

  it('is blocked by the board edge and by a rising neighbour, changing nothing', () => {
    const s = emptyRun();
    put(s, 0, 0, 6);
    put(s, 1, 0, 5, 'rising');
    place(s, 0, 0, 'top');
    const before = snapshot(s);
    expect(step(s, 'W')).toBe(true);
    expect(s.events).toContainEqual({ type: 'blocked', dir: 'W' });
    expect(step(s, 'N')).toBe(true);
    expect(s.stats.blockedSteps).toBe(2);
    // The rising cube has aged two ticks; nothing else may differ.
    cubeAt(s, 1, 0)!.t = 0;
    expect(snapshot(s)).toBe(before);
    expect(step(s, 'E')).toBe(true);
    expect(s.player.action).toBeUndefined();
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

  it('mounts a low rising cube and is blocked by a tall one', () => {
    const s = emptyRun();
    const cube = put(s, 3, 3, 4, 'rising');
    cube.t = s.config.risingTicks / 2 - 1; // reaches height 0.5 on the command tick
    act(s, 'N');
    expect(s.player).toEqual({ x: 3, z: 3, level: 'top' });

    const t = emptyRun();
    const tall = put(t, 3, 3, 4, 'rising');
    tall.t = t.config.risingTicks / 2;
    step(t, 'N');
    expect(t.player).toEqual({ x: 3, z: 4, level: 'ground' });
  });

  it('mounts a low sinking cube and is blocked by a tall one', () => {
    const s = emptyRun();
    const cube = put(s, 3, 3, 4, 'sinking');
    cube.t = s.config.sinkingTicks / 2;
    act(s, 'N');
    expect(s.player.level).toBe('top');

    const t = emptyRun();
    put(t, 3, 3, 4, 'sinking');
    step(t, 'N');
    expect(t.player).toEqual({ x: 3, z: 4, level: 'ground' });
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

    cube.t = s.config.sinkingTicks / 2;
    act(s, 'N');
    expect(s.player).toEqual({ x: 3, z: 3, level: 'ground' });
    expect([cube.x, cube.z]).toEqual([3, 4]);
  });
});
