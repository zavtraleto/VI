import { describe, expect, it } from 'vitest';
import { DELTA, DIRS, cubeAt, cubeHeight, isDock, isStep } from './board';
import { defaultConfig } from './config';
import { resolveMove } from './movement';
import { previewMove } from './preview';
import { createRun, step } from './sim';
import { spawnCube } from './spawn';
import { act, emptyRun, land, levelRun, ori, place, put, putOri, run, snapshot } from './testkit';
import type { ExperimentConfig, RunState, Tuning } from './types';

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

  it('is blocked by the board edge, changing nothing', () => {
    const s = emptyRun();
    put(s, 0, 0, 6);
    place(s, 0, 0, 'top');
    const before = snapshot(s);
    expect(step(s, 'W')).toBe(true);
    expect(s.events).toContainEqual({ type: 'blocked', dir: 'W' });
    expect(step(s, 'N')).toBe(true);
    expect(s.events).toContainEqual({ type: 'blocked', dir: 'N' });
    expect(s.stats.blockedSteps).toBe(2);
    expect(snapshot(s)).toBe(before);
  });

  it('rolls into a rising neighbour however tall it is: the one that comes moves away and goes on rising', () => {
    for (const progress of [0.6, 0.8, 0.95]) {
      const s = emptyRun();
      const own = put(s, 0, 0, 6);
      const rising = put(s, 1, 0, 5, 'rising');
      rising.t = Math.ceil(s.config.risingTicks * progress);
      const t = rising.t;
      place(s, 0, 0, 'top');
      expect(previewMove(s, 'E'), `${progress}`).toMatchObject({ kind: 'roll' });
      step(s, 'E');
      expect(s.events, `${progress}`).toContainEqual({ type: 'displaced', cubeId: rising.id });
      expect([rising.x, rising.z, rising.state], `${progress}`).toEqual([2, 0, 'rising']);
      expect(rising.t, `${progress}`).toBe(t + 1); // it keeps the progress it had
      run(s, s.config.actionTicks);
      expect([own.x, own.z], `${progress}`).toEqual([1, 0]);
      expect(s.player, `${progress}`).toEqual({ x: 1, z: 0, level: 'top' });
      expect(s.stats.blockedSteps, `${progress}`).toBe(0);
    }
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

  it('never pushes a row of cubes or a cube against the edge', () => {
    const s = emptyRun();
    const near = put(s, 3, 3, 4);
    const far = put(s, 3, 2, 5);
    act(s, 'N');
    expect([near.x, near.z, far.x, far.z]).toEqual([3, 3, 3, 2]);

    const t = emptyRun();
    const edge = put(t, 3, 0, 4);
    place(t, 3, 1, 'ground');
    act(t, 'N');
    expect([edge.x, edge.z]).toEqual([3, 0]);
  });

  it('with floorClimb off, is stopped by a cube that cannot be pushed, changing nothing', () => {
    const s = emptyRun({ floorClimb: false });
    put(s, 3, 3, 4);
    put(s, 3, 2, 5);
    const before = snapshot(s);
    step(s, 'N');
    expect(s.events).toContainEqual({ type: 'blocked', dir: 'N' });
    expect(snapshot(s)).toBe(before);

    const t = emptyRun({ floorClimb: false });
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

  it('climbs onto a cube at the edge: what cannot be pushed can be stood on', () => {
    const s = emptyRun();
    const cube = put(s, 3, 0, 4);
    place(s, 3, 1, 'ground');
    expect(previewMove(s, 'N')).toEqual({ kind: 'climb', clears: false });
    act(s, 'N');
    expect(s.player).toEqual({ x: 3, z: 0, level: 'top' });
    expect([cube.x, cube.z, cube.state]).toEqual([3, 0, 'idle']);
    expect(s.stats.floorClimbs).toBe(1);
    // From on top it is a cube like any other: it rolls.
    act(s, 'S');
    expect([cube.x, cube.z]).toEqual([3, 1]);
    expect(s.player).toEqual({ x: 3, z: 1, level: 'top' });
  });

  it('climbs onto a cube propped by another that stands', () => {
    const s = emptyRun();
    const cube = put(s, 3, 3, 4);
    put(s, 3, 2, 5);
    act(s, 'N');
    expect(s.player).toEqual({ x: 3, z: 3, level: 'top' });
    expect([cube.x, cube.z]).toEqual([3, 3]);
    expect(s.stats.floorClimbs).toBe(1);
  });

  it('pushes a cube through one that is coming up or going down, however tall: glass props nothing', () => {
    const s = emptyRun();
    const cube = put(s, 3, 3, 4);
    const rising = put(s, 3, 2, 5, 'rising');
    rising.t = Math.ceil(s.config.risingTicks * 0.8);
    expect(previewMove(s, 'N')).toMatchObject({ kind: 'push' });
    act(s, 'N');
    expect([cube.x, cube.z]).toEqual([3, 2]);
    expect(s.player).toEqual({ x: 3, z: 3, level: 'ground' });
    expect([rising.x, rising.z, rising.state]).toEqual([3, 1, 'rising']); // the nearest free cell
    expect(cubeAt(s, 3, 1)).toBe(rising);
    expect(s.stats.floorClimbs).toBe(0);

    const t = emptyRun();
    const pushed = put(t, 3, 3, 4);
    put(t, 3, 2, 5, 'sinking'); // at its full height: it has only just begun to go
    expect(previewMove(t, 'N')).toMatchObject({ kind: 'push' });
    act(t, 'N');
    expect([pushed.x, pushed.z]).toEqual([3, 2]);
    expect(t.cubes).toEqual([pushed]);
    expect(t.player).toEqual({ x: 3, z: 3, level: 'ground' });
    expect(t.stats.floorClimbs).toBe(0);
  });

  it('pushes a cube that has room behind it, and does not climb it', () => {
    const s = emptyRun();
    const cube = put(s, 3, 3, 4);
    expect(previewMove(s, 'N')).toMatchObject({ kind: 'push' });
    act(s, 'N');
    expect(cube.z).toBe(2);
    expect(s.player).toEqual({ x: 3, z: 3, level: 'ground' });
    expect(s.stats.floorClimbs).toBe(0);
  });

  it('is never stopped by a standing cube: on any board it is either pushed or climbed', () => {
    let pushes = 0;
    let climbs = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = createRun({ seed, config: defaultConfig() });
      // Let the board fill for a while, then try every step from every empty cell.
      run(s, 1500);
      for (let z = 0; z < s.config.size; z++) {
        for (let x = 0; x < s.config.size; x++) {
          if (cubeAt(s, x, z)) continue;
          place(s, x, z, 'ground');
          for (const dir of DIRS) {
            const target = cubeAt(s, x + DELTA[dir].dx, z + DELTA[dir].dz);
            if (target?.state !== 'idle') continue;
            const { kind } = resolveMove(s, dir);
            expect(['push', 'climb'], `seed ${seed}, ${x},${z} ${dir}`).toContain(kind);
            if (kind === 'push') pushes++;
            else climbs++;
          }
        }
      }
    }
    expect(pushes).toBeGreaterThan(100);
    expect(climbs).toBeGreaterThan(100);
  });

  it('pushes a cube to the wall and climbs it with the next step', () => {
    const s = emptyRun();
    const cube = put(s, 3, 1, 4);
    place(s, 3, 2, 'ground');
    act(s, 'N');
    expect([cube.z, s.player.level]).toEqual([0, 'ground']);
    act(s, 'N');
    expect(s.player).toEqual({ x: 3, z: 0, level: 'top' });
  });
});

describe('docks: the free cells beside an open chain are steps', () => {
  /** A cube above this is tall: a height to step down from that is tuned lower holds the player on it. */
  const TALL = 0.9;

  /**
   * Two 2s the player has just brought together, at (3,3) and (4,3), with nothing around them:
   * an island, the player up on its cube at (4,3), the cubes still at their full height.
   */
  function island(experiments: Partial<ExperimentConfig> = {}, tuning: Partial<Tuning> = {}): RunState {
    const s = emptyRun(experiments, 1, tuning);
    put(s, 3, 3, 2);
    putOri(s, 5, 3, { top: 1, east: 2 });
    place(s, 5, 3, 'top');
    act(s, 'W');
    expect(s.reactions).toMatchObject([{ value: 2, chain: 1, total: 2 }]);
    expect(s.player).toEqual({ x: 4, z: 3, level: 'top' });
    expect(cubeHeight(cubeAt(s, 4, 3)!, s.config)).toBeGreaterThan(TALL);
    return s;
  }

  it('are the free cells beside a cube of a chain, for as long as the chain is open', () => {
    const s = island();
    put(s, 2, 3, 6);
    for (const [x, z] of [[4, 4], [3, 4], [5, 3], [3, 2], [4, 2]]) expect(isDock(s, x, z), `${x},${z}`).toBe(true);
    expect(isDock(s, 4, 3)).toBe(false); // a cube of the chain
    expect(isDock(s, 2, 3)).toBe(false); // a cube beside the chain
    expect(isDock(s, 5, 4)).toBe(false); // corner to corner
    expect(isDock(s, 4, 7)).toBe(false); // off the board
    run(s, s.config.sinkingTicks);
    expect(s.reactions.length).toBe(0);
    expect(isDock(s, 4, 4)).toBe(false);
  });

  it('are not made by a cube that goes down outside a chain', () => {
    const s = emptyRun();
    put(s, 3, 3, 1, 'sinking');
    expect(isDock(s, 3, 4)).toBe(false);
  });

  it('take the player down from a cube of the chain at any height', () => {
    const s = island();
    expect(previewMove(s, 'S')).toEqual({ kind: 'descend', clears: false });
    act(s, 'S');
    expect(s.player).toEqual({ x: 4, z: 4, level: 'ground' });
    expect(s.stats.dockDescents).toBe(1);
    expect(s.stats.falls).toBe(0);
  });

  it('with dockSteps off, take the player down from a tall cube of the chain just the same: the cell is floor', () => {
    const s = island({ dockSteps: false });
    expect(previewMove(s, 'S')).toEqual({ kind: 'descend', clears: false });
    act(s, 'S');
    expect(s.player).toEqual({ x: 4, z: 4, level: 'ground' });
    expect(s.stats.dockDescents).toBe(0);
    expect(s.stats.blockedSteps).toBe(0);
  });

  it('are not the only cells a sinking cube is left for: any other empty cell takes the player down at once', () => {
    const s = island();
    // A cube going down outside the chain, far from it and at its full height: the cells around it are no docks.
    const lone = put(s, 0, 6, 4, 'sinking');
    place(s, 0, 6, 'top');
    expect(isDock(s, 0, 5)).toBe(false);
    expect(previewMove(s, 'N')).toEqual({ kind: 'descend', clears: false });
    act(s, 'N');
    expect(s.player).toEqual({ x: 0, z: 5, level: 'ground' });
    expect([lone.x, lone.z]).toEqual([0, 6]);
    expect(s.stats.dockDescents).toBe(0);
    expect(s.stats.blockedSteps).toBe(0);
  });

  it('with the height to step down from tuned lower, are the only cells a tall sinking cube is left for', () => {
    const s = island({}, { stepDownHeight: TALL });
    expect(previewMove(s, 'S')).toEqual({ kind: 'descend', clears: false });
    // Any other empty cell waits until the cube is low.
    const lone = put(s, 0, 6, 4, 'sinking');
    place(s, 0, 6, 'top');
    step(s, 'N');
    expect(s.events).toContainEqual({ type: 'blocked', dir: 'N' });
    expect(s.player).toEqual({ x: 0, z: 6, level: 'top' });
    lone.t = Math.ceil(s.config.sinkingTicks * 0.12);
    act(s, 'N');
    expect(s.player).toEqual({ x: 0, z: 5, level: 'ground' });
    expect(s.stats.dockDescents).toBe(0);
  });

  it('never let the player off a cube that is still: it rolls into them; one that is coming up is left as one that is going down is', () => {
    const s = island();
    const still = put(s, 5, 4, 6);
    place(s, 5, 4, 'top');
    act(s, 'W');
    expect([still.x, still.z]).toEqual([4, 4]);
    expect(s.player).toEqual({ x: 4, z: 4, level: 'top' });

    const t = island();
    const rising = put(t, 5, 2, 6, 'rising');
    rising.t = 5;
    place(t, 5, 2, 'top');
    expect(isDock(t, 4, 2)).toBe(true);
    expect(previewMove(t, 'W')).toEqual({ kind: 'descend', clears: false });
    act(t, 'W');
    expect(t.player).toEqual({ x: 4, z: 2, level: 'ground' });
    expect([rising.x, rising.z, rising.state]).toEqual([5, 2, 'rising']);
    expect(t.stats.dockDescents).toBe(1);
  });

  it('take the player up onto the standing cube beside them: it is stepped onto, never pushed', () => {
    const s = island();
    const cube = put(s, 4, 5, 6);
    act(s, 'S');
    // There is room behind the cube: from the plain floor it would be pushed.
    expect(previewMove(s, 'S')).toEqual({ kind: 'climb', clears: false });
    act(s, 'S');
    expect(s.player).toEqual({ x: 4, z: 5, level: 'top' });
    expect([cube.x, cube.z, cube.state]).toEqual([4, 5, 'idle']);
    expect(s.stats).toMatchObject({ dockDescents: 1, dockClimbs: 1, floorClimbs: 0 });
  });

  it('with dockSteps off, leave the cube beside them to be pushed away', () => {
    const s = island({ dockSteps: false });
    const cube = put(s, 4, 5, 6);
    place(s, 4, 4, 'ground');
    act(s, 'S');
    expect([cube.x, cube.z]).toEqual([4, 6]);
    expect(s.player).toEqual({ x: 4, z: 5, level: 'ground' });
    expect(s.stats.dockClimbs).toBe(0);
  });

  it('are left for the plain floor by a step: there a cube with room behind it is pushed again', () => {
    const s = island();
    const cube = put(s, 5, 5, 6);
    place(s, 4, 5, 'ground');
    expect(isDock(s, 4, 5)).toBe(false);
    act(s, 'E');
    expect([cube.x, cube.z]).toEqual([6, 5]);
    expect(s.player).toEqual({ x: 5, z: 5, level: 'ground' });
  });

  it('are walked over from one to the next', () => {
    const s = island();
    act(s, 'S');
    expect(previewMove(s, 'W')).toEqual({ kind: 'walk', clears: false });
    act(s, 'W');
    expect(s.player).toEqual({ x: 3, z: 4, level: 'ground' });
    expect(isDock(s, 3, 4)).toBe(true);
  });

  it('lead back up onto a sinking cube and onto a rising one, as the plain floor does', () => {
    const s = island();
    act(s, 'S');
    expect(previewMove(s, 'N')).toEqual({ kind: 'mount', clears: false });
    act(s, 'N');
    expect(s.player).toEqual({ x: 4, z: 3, level: 'top' });

    const t = island();
    act(t, 'S');
    put(t, 5, 4, 5, 'rising').t = Math.floor(t.config.risingTicks * 0.6);
    expect(previewMove(t, 'E')).toEqual({ kind: 'mount', clears: false });
    act(t, 'E');
    expect(t.player).toEqual({ x: 5, z: 4, level: 'top' });
    expect(t.stats.dockClimbs).toBe(0);
  });

  it('are marked as steps where the next step can use them: down from the player\'s cube, up from under their feet', () => {
    const s = island();
    put(s, 3, 5, 6);
    // Beside the sinking cube the player stands on: a step down.
    for (const [x, z] of [[4, 4], [5, 3], [4, 2]]) expect(isStep(s, x, z), `${x},${z}`).toBe(true);
    // Beside the other cube of the chain: docks, but out of the player's step.
    for (const [x, z] of [[3, 4], [3, 2], [2, 3]]) expect(isStep(s, x, z), `${x},${z}`).toBe(false);
    // Not a dock at all.
    expect(isStep(s, 3, 6)).toBe(false);
    // Down on a dock with nothing beside it to step up onto: no dock is a step.
    act(s, 'S');
    for (const [x, z] of [[4, 4], [5, 3], [3, 4]]) expect(isStep(s, x, z), `${x},${z}`).toBe(false);
    // On the dock beside the standing cube: a step up.
    act(s, 'W');
    expect(isStep(s, 3, 4)).toBe(true);
    expect(isStep(s, 4, 4)).toBe(false);

    const off = island({ dockSteps: false });
    expect(isStep(off, 4, 4)).toBe(false);
    off.config.experiments.dockSteps = true;
    expect(isStep(off, 4, 4)).toBe(true);
  });
});

describe('an island: a group made with nothing around it', () => {
  it('is left by a dock, and the chain goes on with the cube that came up a move away', () => {
    const s = emptyRun();
    put(s, 3, 3, 2);
    putOri(s, 5, 3, { top: 1, east: 2 });
    place(s, 5, 3, 'top');
    act(s, 'W');
    expect(s.score).toBe(4);
    // A cube comes up one move from the chain, with a 2 on the side a roll towards it turns up.
    const fed = spawnCube(s, 4, 5, ori({ top: 6, south: 2 }));
    run(s, s.config.risingTicks);
    expect(fed.state).toBe('idle');

    const kinds: string[] = [];
    for (const dir of ['S', 'S', 'N'] as const) {
      step(s, dir);
      kinds.push(...s.events.flatMap((e) => (e.type === 'move' ? [e.kind] : [])));
      run(s, s.config.actionTicks);
    }
    // Down to the dock, up onto the cube, and the cube rolled into the dock.
    expect(kinds).toEqual(['descend', 'climb', 'roll']);
    expect([fed.x, fed.z, fed.ori.top, fed.state]).toEqual([4, 4, 2, 'sinking']);
    expect(s.reactions).toEqual([{ id: 1, value: 2, chain: 2, total: 3 }]);
    expect(s.score).toBe(4 + 2 * 3 * 2);
    expect(s.player).toEqual({ x: 4, z: 4, level: 'top' });
    expect(s.stats).toMatchObject({ dockDescents: 1, dockClimbs: 1, falls: 0 });
  });

  it('is a dead end by the rules before: the cube beside the dock can only be pushed away', () => {
    const s = emptyRun({ floorClimb: false, dockSteps: false });
    put(s, 3, 3, 2);
    putOri(s, 5, 3, { top: 1, east: 2 });
    place(s, 5, 3, 'top');
    act(s, 'W');
    const fed = spawnCube(s, 4, 5, ori({ top: 6, south: 2 }));
    run(s, s.config.risingTicks);
    act(s, 'S');
    act(s, 'S');
    expect([fed.x, fed.z]).toEqual([4, 6]);
    expect(s.player).toEqual({ x: 4, z: 5, level: 'ground' });
    expect(s.reactions).toMatchObject([{ chain: 1 }]);
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

  it('steps onto a rising neighbour, where a resting cube rolls into its cell and sends it away', () => {
    const s = emptyRun();
    const sinking = put(s, 3, 4, 4, 'sinking');
    const rising = put(s, 4, 4, 5, 'rising');
    rising.t = Math.floor(s.config.risingTicks * 0.8);
    place(s, 3, 4, 'top');
    expect(previewMove(s, 'E')).toEqual({ kind: 'hop', clears: false });
    act(s, 'E');
    expect(s.player).toEqual({ x: 4, z: 4, level: 'top' });
    expect([sinking.x, sinking.z, rising.x, rising.z]).toEqual([3, 4, 4, 4]);

    const t = emptyRun();
    const resting = put(t, 3, 4, 4);
    const tall = put(t, 4, 4, 5, 'rising');
    tall.t = Math.floor(t.config.risingTicks * 0.8);
    place(t, 3, 4, 'top');
    expect(previewMove(t, 'E')).toMatchObject({ kind: 'roll' });
    act(t, 'E');
    expect([resting.x, resting.z]).toEqual([4, 4]);
    expect(t.player).toEqual({ x: 4, z: 4, level: 'top' });
    expect([tall.x, tall.z, tall.state]).toEqual([4, 3, 'rising']); // the nearest free cell
  });

  it('cannot roll, and steps down at once', () => {
    const s = emptyRun();
    const cube = put(s, 3, 4, 4, 'sinking'); // at its full height: it has only just begun to go
    place(s, 3, 4, 'top');
    expect(previewMove(s, 'N')).toEqual({ kind: 'descend', clears: false });
    act(s, 'N');
    expect(s.player).toEqual({ x: 3, z: 3, level: 'ground' });
    expect([cube.x, cube.z]).toEqual([3, 4]);
    expect(s.stats.blockedSteps).toBe(0);
  });

  it('is stepped off while it is rising, at any height, and does not roll: it goes on rising where it is', () => {
    for (const progress of [0.1, 0.9]) {
      const s = emptyRun();
      const cube = put(s, 3, 4, 4, 'rising');
      cube.t = Math.floor(s.config.risingTicks * progress);
      const t = cube.t;
      place(s, 3, 4, 'top');
      expect(previewMove(s, 'N'), `${progress}`).toEqual({ kind: 'descend', clears: false });
      act(s, 'N');
      expect(s.player, `${progress}`).toEqual({ x: 3, z: 3, level: 'ground' });
      expect([cube.x, cube.z, cube.state], `${progress}`).toEqual([3, 4, 'rising']);
      // The player on it did not hurry it.
      expect(cube.t, `${progress}`).toBe(t + 1 + s.config.actionTicks);
      expect(s.stats.blockedSteps, `${progress}`).toBe(0);
    }
  });

  it('can be mounted from the ground and rolled into at any point of a rise', () => {
    const s = emptyRun();
    const rising = put(s, 3, 3, 4, 'rising');
    rising.t = Math.floor(s.config.risingTicks * 0.7);
    act(s, 'N');
    expect(s.player).toEqual({ x: 3, z: 3, level: 'top' });

    const t = emptyRun();
    const own = put(t, 3, 4, 6);
    const mid = put(t, 3, 3, 4, 'rising');
    mid.t = Math.floor(t.config.risingTicks * 0.7);
    place(t, 3, 4, 'top');
    act(t, 'N');
    expect([own.x, own.z]).toEqual([3, 3]);
    expect([mid.x, mid.z]).toEqual([3, 2]);
    expect(t.stats.blockedSteps).toBe(0);
  });

  it('with the heights to roll over tuned lower, a tall neighbour that comes or goes is stepped onto', () => {
    const s = emptyRun({}, 1, { lowHeight: 0.5, sinkLowHeight: 0.8 });
    const own = put(s, 3, 4, 6);
    const rising = put(s, 4, 4, 5, 'rising');
    rising.t = Math.ceil(s.config.risingTicks * 0.6);
    place(s, 3, 4, 'top');
    expect(previewMove(s, 'E')).toEqual({ kind: 'hop', clears: false });
    act(s, 'E');
    expect(s.player).toEqual({ x: 4, z: 4, level: 'top' });
    expect([own.x, own.z, rising.x, rising.z]).toEqual([3, 4, 4, 4]);

    const t = emptyRun({}, 1, { lowHeight: 0.5, sinkLowHeight: 0.8 });
    const still = put(t, 3, 4, 6);
    const sinking = put(t, 4, 4, 5, 'sinking');
    place(t, 3, 4, 'top');
    expect(previewMove(t, 'E')).toEqual({ kind: 'hop', clears: false });
    act(t, 'E');
    expect(t.player).toEqual({ x: 4, z: 4, level: 'top' });
    expect([still.x, still.z, sinking.x, sinking.z]).toEqual([3, 4, 4, 4]);
  });
});

describe('rolling over cubes that are coming up or going down', () => {
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

  it('rolls over a sinking cube from the moment it starts to sink: a whole cube is never stepped from onto it', () => {
    for (const progress of [0, 0.25]) {
      const s = sinkingThrees();
      run(s, s.config.sinkingTicks * progress);
      const own = putOri(s, 2, 4, { top: 6, south: 5 });
      place(s, 2, 4, 'top');
      expect(previewMove(s, 'N'), `${progress}`).toMatchObject({ kind: 'roll' });
      act(s, 'N');
      expect([own.x, own.z], `${progress}`).toEqual([2, 3]);
      expect(s.player, `${progress}`).toEqual({ x: 2, z: 3, level: 'top' });
      expect(s.cubes.length, `${progress}`).toBe(3); // the cube underneath is gone
    }
  });

  it('joins the chain when rolled onto a sinking cube of the same value that has only just begun to go', () => {
    const s = sinkingThrees();
    const own = putOri(s, 2, 4, { top: 6, south: 3 });
    place(s, 2, 4, 'top');
    act(s, 'N');
    expect([own.x, own.z, own.state, own.reactionId]).toEqual([2, 3, 'sinking', 1]);
    expect(s.reactions[0]).toEqual({ id: 1, value: 3, chain: 2, total: 4 });
    expect(s.score).toBe(9 + 24);
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

  it('steps onto a rising cube when the board has no free cell to send it to', () => {
    for (const progress of [0.1, 0.8]) {
      const s = emptyRun();
      for (let i = 0; i < 49; i++) {
        const x = i % 7;
        const z = Math.floor(i / 7);
        put(s, x, z, (x + z) % 2 === 0 ? 6 : 5, x === 3 && z === 3 ? 'rising' : 'idle');
      }
      const rising = cubeAt(s, 3, 3)!;
      rising.t = Math.floor(s.config.risingTicks * progress);
      const own = cubeAt(s, 3, 4)!;
      place(s, 3, 4, 'top');
      expect(previewMove(s, 'N'), `${progress}`).toEqual({ kind: 'hop', clears: false });
      act(s, 'N');
      expect(s.player, `${progress}`).toEqual({ x: 3, z: 3, level: 'top' });
      expect([own.x, own.z, rising.x, rising.z], `${progress}`).toEqual([3, 4, 3, 3]);
      expect(s.stats.blockedSteps, `${progress}`).toBe(0);
    }
  });

  it('on a level, is still stopped by a rising cube with no free cell to go to: a level is played as it was', () => {
    const s = levelRun();
    for (let i = 0; i < 25; i++) {
      const x = i % 5;
      const z = Math.floor(i / 5);
      put(s, x, z, (x + z) % 2 === 0 ? 6 : 5, x === 2 && z === 1 ? 'rising' : 'idle');
    }
    place(s, 2, 2, 'top');
    expect(previewMove(s, 'N')).toEqual({ kind: 'blocked', clears: false });
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

  it('pushes a cube over a sinking cube that has only just begun to go', () => {
    const s = sinkingThrees();
    const pushed = put(s, 2, 4, 3);
    place(s, 2, 5, 'ground');
    expect(previewMove(s, 'N')).toMatchObject({ kind: 'push' });
    act(s, 'N');
    expect([pushed.x, pushed.z]).toEqual([2, 3]);
    expect(pushed.state).toBe('sinking');
    expect(s.score).toBe(9 + 24);
    expect(s.player).toEqual({ x: 2, z: 4, level: 'ground' });
    expect(s.stats.floorClimbs).toBe(0);
  });
});
