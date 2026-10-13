import { describe, expect, it } from 'vitest';
import { cubeAt, cubeHeight } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { worldRuns } from '../rules/level';
import { createRun, step } from '../rules/sim';
import { levelRun, put } from '../rules/testkit';
import type { Cube, Dir, LevelSpec, RunState } from '../rules/types';
import { ROAD } from '../levels/road';
import { boardDefaults } from './params';
import { finaleMs, isStair, LeavingShow, leavingHeight, leavingSteps, shownHeight, type LeavingEvent } from './leaving';

const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
const pieceOf = (id: string): LevelSpec => ROAD.find((spec) => spec.id === id)!;

function go(state: RunState, dir: Dir): void {
  step(state, dir);
  for (let ticks = 0; (worldRuns(state) || state.player.action) && !state.over; ticks++) {
    if (ticks > 1000) throw new Error('a move that does not end');
    step(state, null);
  }
}

describe('the height a die that leaves a level is shown at', () => {
  it('is by steps on a board whose dice go in two moves: 0.78 when it leaves, 0.12 with a move left, and nothing then', () => {
    expect(leavingHeight(1, 2)).toBeCloseTo(0.78);
    expect(leavingHeight(0.5, 2)).toBeCloseTo(0.12);
    expect(leavingHeight(0, 2)).toBe(0);
    // In between, the straight line from one step to the next.
    expect(leavingHeight(0.75, 2)).toBeCloseTo(0.45);
    expect(leavingHeight(0.25, 2)).toBeCloseTo(0.06);
    // Past either end it stays at that end.
    expect(leavingHeight(1.1, 2)).toBeCloseTo(0.78);
    expect(leavingHeight(-0.1, 2)).toBe(0);
  });

  it('is the middle step for a stair with two moves left, down to the last step through the move, and nothing then', () => {
    expect(leavingHeight(1, 2, leavingSteps(), true)).toBeCloseTo(0.5);
    expect(leavingHeight(0.75, 2, leavingSteps(), true)).toBeCloseTo(0.31);
    expect(leavingHeight(0.5, 2, leavingSteps(), true)).toBeCloseTo(0.12);
    expect(leavingHeight(0, 2, leavingSteps(), true)).toBe(0);
  });

  it('keeps its steps in the look, where the lab can turn them', () => {
    expect(leavingSteps()).toEqual({ first: 0.78, last: 0.12, middle: 0.5 });
    expect(leavingSteps(boardDefaults())).toEqual({ first: 0.78, last: 0.12, middle: 0.5 });
    expect(leavingHeight(1, 2, leavingSteps({ stairMiddle: 0.4 }), true)).toBeCloseTo(0.4);
    expect(leavingHeight(1, 2, leavingSteps({ leaveFirst: 0.8, leaveLast: 0.15 }))).toBeCloseTo(0.8);
    expect(leavingHeight(0.5, 2, leavingSteps({ leaveFirst: 0.8, leaveLast: 0.15 }))).toBeCloseTo(0.15);
  });

  it('goes over the window of a board whose dice go in more moves: the last step with the last move left', () => {
    expect(leavingHeight(1, 3)).toBeCloseTo(0.78);
    expect(leavingHeight(1 / 3, 3)).toBeCloseTo(0.12);
    expect(leavingHeight(2 / 3, 3)).toBeCloseTo(0.45);
    expect(leavingHeight(1, 1)).toBeCloseTo(0.78);
  });

  it('is so on a piece of the road: the pair made, a move after it, and the stair laid as leaving in two moves and in one', () => {
    // The lesson of the way up: its stair is laid as leaving in two moves, and stands half way up, not as a die that has just left.
    const climb = start(pieceOf('R10'));
    expect(isStair(cubeAt(climb, 2, 1)!, climb)).toBe(true);
    expect(shownHeight(cubeAt(climb, 2, 1)!, climb, 0)).toBeCloseTo(0.5);
    go(climb, 'N');
    // The pair has just left, and the stair has a move left to it. The pair is no stair, though it is as far from going.
    expect(isStair(cubeAt(climb, 0, 2)!, climb)).toBe(false);
    expect(shownHeight(cubeAt(climb, 0, 2)!, climb, 0)).toBeCloseTo(0.78);
    expect(shownHeight(cubeAt(climb, 0, 1)!, climb, 0)).toBeCloseTo(0.78);
    expect(shownHeight(cubeAt(climb, 2, 1)!, climb, 0)).toBeCloseTo(0.12);
    // The rules have them otherwise, and are not changed: nearly whole, and about half.
    expect(cubeHeight(cubeAt(climb, 0, 2)!, climb.config)).toBeGreaterThan(0.9);
    expect(cubeHeight(cubeAt(climb, 2, 1)!, climb.config)).toBeGreaterThan(0.45);
    // The stair of two of the second piece: the lower laid as leaving in one move, near the floor, the upper in two, half way up.
    const stair = start(pieceOf('R02'));
    expect(shownHeight(cubeAt(stair, 4, 5)!, stair, 0)).toBeCloseTo(0.12);
    expect(shownHeight(cubeAt(stair, 4, 4)!, stair, 0)).toBeCloseTo(0.5);
    // A die that stands is whole.
    expect(shownHeight(cubeAt(stair, 4, 3)!, stair, 0)).toBe(1);
    // Up the stair, over, and the first roll: the lower is gone, and the upper has come down to where the lower was.
    for (const dir of ['N', 'N', 'N', 'N'] as const) go(stair, dir);
    expect(cubeAt(stair, 4, 5)).toBeUndefined();
    expect(shownHeight(cubeAt(stair, 4, 4)!, stair, 0)).toBeCloseTo(0.12);
    // With the second roll it is gone too.
    go(stair, 'N');
    expect(cubeAt(stair, 4, 4)).toBeUndefined();
  });

  it('is what the rules have outside a level', () => {
    const session = createRun({ seed: 1, config: defaultConfig() });
    for (const cube of session.cubes) expect(shownHeight(cube, session, 0.5)).toBe(cubeHeight(cube, session.config, 0.5));
    const sinking = { ...session.cubes[0], state: 'sinking' as const, t: 3 };
    expect(shownHeight(sinking, session, 0)).toBe(cubeHeight(sinking, session.config));
  });
});

describe('the leaving of a group on a level, as one body', () => {
  // The way a group gets ready is a number of the look, up or down. These go through it with a lift, which shows every
  // part of the way; the look as it is set presses the dice down instead, and has its own tests at the end.
  const values = { ...boardDefaults(), liftHeight: 0.08, finaleLiftHeight: 0.12 };
  const noDip = (): number => 0;

  /** The rules send dice: they are going from this tick, with a tick of their window gone, in the group of the board. */
  function send(state: RunState, ...cubes: Cube[]): void {
    for (const cube of cubes) {
      cube.state = 'sinking';
      cube.t = 1;
      cube.reactionId = 1;
    }
    if (state.reactions.length === 0) state.reactions.push({ id: 1, value: 2, chain: 1, total: 0 });
    state.reactions[0].total += cubes.length;
  }

  /**
   * A level with a pair of 2s that has just been sent, six moves to go, and the show that saw the pair stand on the
   * frame before: a die is sent when the show has seen it whole, and not by how far its window has gone.
   */
  function sentPair(): { state: RunState; a: Cube; b: Cube; show: LeavingShow } {
    const state = levelRun();
    const a = put(state, 1, 1, 2);
    const b = put(state, 2, 1, 2);
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    send(state, a, b);
    return { state, a, b, show };
  }

  /** A landing: the world has run a move and stands again. */
  function land(state: RunState, ...cubes: Cube[]): void {
    for (const cube of cubes) cube.t += state.config.actionTicks;
  }

  it('lifts a sent pair as one body, hangs, drops onto the first step and settles, with the beat on the drop', () => {
    const { state, a, b, show } = sentPair();
    const first = show.frame(state, 0, values, false, noDip);
    expect(first.map((e) => e.kind)).toEqual(['sent']);
    expect(first[0].cubeIds).toEqual([a.id, b.id]);
    expect(show.height(a, state, 0)).toBeCloseTo(1);
    // 90 ms of lift: at the top.
    show.frame(state, 90, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(1.08);
    expect(show.height(b, state, 0)).toBeCloseTo(show.height(a, state, 0));
    // 60 ms of hang: still there.
    expect(show.frame(state, 60, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(1.08);
    // Half way into the drop it is still high: the curve is in.
    show.frame(state, 65, values, false, noDip);
    expect(show.height(a, state, 0)).toBeGreaterThan(1.0);
    // The drop ends 130 ms in: the beat, and the press below the step.
    const events = show.frame(state, 65, values, false, noDip);
    expect(events.map((e) => e.kind)).toEqual(['impact']);
    expect(events[0].value).toBe(2);
    expect(events[0].cells).toEqual([{ x: 1, z: 1 }, { x: 2, z: 1 }]);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78 - 0.015);
    // The settle brings it back to the step.
    show.frame(state, 120, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78);
    show.frame(state, 1000, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78);
  });

  it('stands on its step through the roll, and is driven a step down when the roll lands', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    // The world runs: the figure rolls, and the rules take the dice down through the move.
    state.player.action = { kind: 'roll', dir: 'N', t: 5, fromX: 0, fromZ: 0, fromLevel: 'top' } as RunState['player']['action'];
    a.t = b.t = 5;
    show.frame(state, 100, values, false, noDip);
    expect(show.height(a, state, 0.5)).toBeCloseTo(0.78);
    // It lands: the world stands with the move done. The step it goes to is the one the rules have it on.
    state.player.action = undefined;
    a.t = b.t = 1 + state.config.actionTicks;
    const step1 = shownHeight(a, state, 0);
    expect(step1).toBeLessThan(0.7);
    expect(step1).toBeGreaterThan(0.6);
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    show.frame(state, 60, values, false, noDip);
    expect(show.height(a, state, 0)).toBeLessThan(0.78);
    expect(show.height(a, state, 0)).toBeGreaterThan(step1);
    const events = show.frame(state, 60, values, false, noDip);
    expect(events.map((e) => e.kind)).toEqual(['step']);
    show.frame(state, 120, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
  });

  it('is what the rules have, with no events, outside a level', () => {
    const session = createRun({ seed: 1, config: defaultConfig() });
    const show = new LeavingShow();
    const sinking = { ...session.cubes[0], state: 'sinking' as const, t: 3 };
    session.cubes[0] = sinking;
    expect(show.frame(session, 16, values, false, noDip)).toEqual([]);
    expect(show.height(sinking, session, 0.5)).toBe(shownHeight(sinking, session, 0.5));
    expect(show.ghosts()).toEqual([]);
  });

  it('lifts the whole chain with the die that joins it, each from where it stands, and strikes with all of it at once', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    land(state, a, b);
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    const step1 = shownHeight(a, state, 0);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
    // A third 2 joins: held for two moves by the rules, the pair stays on its step.
    const c = put(state, 3, 1, 2);
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    send(state, c);
    a.hold = b.hold = 2 * state.config.actionTicks;
    state.reactions[0].chain = 2;
    const sent = show.frame(state, 0, values, false, noDip);
    expect(sent.map((e) => e.kind)).toEqual(['sent']);
    expect(sent[0].cubeIds).toEqual([c.id]);
    // One body: the pair is up from its step by as much as the new die is up from its full height.
    expect(show.frame(state, 90, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(step1 + 0.08);
    expect(show.height(b, state, 0)).toBeCloseTo(step1 + 0.08);
    expect(show.height(c, state, 0)).toBeCloseTo(1.08);
    // They hang together: nothing of the chain goes up and down by itself meanwhile.
    expect(show.frame(state, 60, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(step1 + 0.08);
    // And strike together, each on its own step: one beat, with every die of the chain.
    const events = show.frame(state, 130, values, false, noDip);
    expect(events.map((e) => e.kind)).toEqual(['impact']);
    expect(events[0].cubeIds).toEqual([a.id, b.id, c.id]);
    expect(events[0].cells).toEqual([{ x: 1, z: 1 }, { x: 2, z: 1 }, { x: 3, z: 1 }]);
    expect(show.height(a, state, 0)).toBeCloseTo(step1 - 0.015);
    expect(show.height(c, state, 0)).toBeCloseTo(0.78 - 0.015);
    expect(show.frame(state, 120, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
    expect(show.height(c, state, 0)).toBeCloseTo(0.78);
  });

  it('takes the last combo of a board away as its strongest strike: all the dice lift, hang while they sound, and go under at once', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    land(state, a, b);
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    const step1 = show.height(a, state, 0);
    // The combo that passes the board: two dice more are sent, and a die that stands is left on it.
    const c = put(state, 3, 1, 2);
    const d = put(state, 3, 2, 2);
    const idle = put(state, 0, 4, 4);
    show.frame(state, 0, values, false, noDip);
    send(state, c, d);
    state.over = true;
    state.endReason = 'passed';
    expect(finaleMs(2, values, false)).toEqual({ lift: 100, hang: 100, drop: 150, total: 350 });
    show.finale(state, 2, values, false, (id) => (id === c.id ? -0.1 : 0));
    // Nothing is sent and nothing strikes by the way of a group: it is the finale's.
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
    expect(show.height(c, state, 0)).toBeCloseTo(0.9);
    expect(show.height(d, state, 0)).toBeCloseTo(1);
    expect(show.height(idle, state, 0)).toBeCloseTo(1);
    // The lift, every die by as much from where it stood.
    expect(show.frame(state, 100, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(step1 + 0.12);
    expect(show.height(c, state, 0)).toBeCloseTo(0.9 + 0.12);
    expect(show.height(d, state, 0)).toBeCloseTo(1.12);
    expect(show.height(idle, state, 0)).toBeCloseTo(1.12);
    // The hang, while the dice sound one by one.
    expect(show.frame(state, 100, values, false, noDip)).toEqual([]);
    expect(show.height(d, state, 0)).toBeCloseTo(1.12);
    // The drop is late and sudden: half way through its time the dice are still nearly up.
    expect(show.frame(state, 75, values, false, noDip)).toEqual([]);
    expect(show.height(d, state, 0)).toBeGreaterThan(1);
    // Under the floor, all at once: one event with every cell of the board.
    const events = show.frame(state, 75, values, false, noDip);
    expect(events.map((e) => [e.kind, e.final])).toEqual([['gone', true]]);
    expect(events[0].cells).toHaveLength(5);
    expect(events[0].cubeIds).toEqual([a.id, b.id, c.id, d.id, idle.id]);
    for (const cube of [a, b, c, d, idle]) expect(show.height(cube, state, 0)).toBeLessThanOrEqual(-0.5);
    // And nothing after it; the dice stay under until the next board is put on.
    expect(show.frame(state, 500, values, false, noDip)).toEqual([]);
    expect(show.height(d, state, 0)).toBeLessThanOrEqual(-0.5);
    show.reset();
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
  });

  it('hangs a finale for as long as its dice take to sound, and with less motion takes them away with no lift', () => {
    expect(finaleMs(6, values, false)).toEqual({ lift: 100, hang: 180, drop: 150, total: 430 });
    expect(finaleMs(6, { ...values, finaleNoteMs: 50, finaleLiftMs: 80, finaleDropMs: 200 }, false).total).toBe(80 + 300 + 200);
    // With less motion nothing moves, and the dice are gone at the same moment as they would be: they sound for as long.
    expect(finaleMs(2, values, true)).toEqual({ lift: 0, hang: 350, drop: 0, total: 350 });
    const { state, a, b, show } = sentPair();
    state.over = true;
    state.endReason = 'passed';
    show.finale(state, 2, values, true, noDip);
    expect(show.frame(state, 0, values, true, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(1);
    expect(show.frame(state, 60, values, true, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(1);
    expect(show.frame(state, 240, values, true, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(1);
    const events = show.frame(state, 50, values, true, noDip);
    expect(events.map((e) => [e.kind, e.final])).toEqual([['gone', true]]);
    expect(events[0].cubeIds).toEqual([a.id, b.id]);
    expect(show.height(b, state, 0)).toBeLessThanOrEqual(-0.5);
  });

  it('keeps a ghost of a die the rules have taken at the end of its way, drives it under the floor and says so', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    // Five landings: the last step.
    for (let i = 0; i < 5; i++) {
      land(state, a, b);
      show.frame(state, 0, values, false, noDip);
      show.frame(state, 1000, values, false, noDip);
    }
    expect(show.height(a, state, 0)).toBeCloseTo(0.12);
    // The sixth: the roll runs their window out, and the rules take the pair away.
    a.t = b.t = 60;
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    state.cubes = state.cubes.filter((cube) => cube.id !== a.id && cube.id !== b.id);
    state.reactions = [];
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    expect(show.ghosts().map((ghost) => [ghost.x, ghost.z, ghost.value])).toEqual([[1, 1, 2], [2, 1, 2]]);
    expect(show.ghostHeight(1, 1)).toBeCloseTo(0.12);
    show.frame(state, 60, values, false, noDip);
    expect(show.ghosts()[0].height).toBeLessThan(0.12);
    const events = show.frame(state, 60, values, false, noDip);
    expect(events.map((e) => e.kind)).toEqual(['gone']);
    expect(events[0].cells).toEqual([{ x: 1, z: 1 }, { x: 2, z: 1 }]);
    expect(show.ghosts()).toEqual([]);
    expect(show.ghostHeight(1, 1)).toBe(0);
  });

  it('cuts a drop short on a landing that comes early, and drops on from where it is', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 90 + 60 + 65, values, false, noDip);
    const midway = show.height(a, state, 0);
    expect(midway).toBeGreaterThan(0.78);
    land(state, a, b);
    const step1 = shownHeight(a, state, 0);
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    // On the next frame it has gone down from where it was, not jumped.
    show.frame(state, 8, values, false, noDip);
    expect(show.height(a, state, 0)).toBeLessThanOrEqual(midway);
    expect(show.height(a, state, 0)).toBeGreaterThan(step1);
    const events = [...show.frame(state, 112, values, false, noDip), ...show.frame(state, 200, values, false, noDip)];
    // The first strike of the pair is its beat all the same, though it comes down a step lower and in a step's time.
    expect(events.map((e) => e.kind)).toEqual(['impact']);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
  });

  it('makes no ghost of a die taken away early, rolled over with moves still left to it', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    state.cubes = state.cubes.filter((cube) => cube.id !== a.id);
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    expect(show.ghosts()).toEqual([]);
    expect(show.height(b, state, 0)).toBeCloseTo(0.78);
  });

  it('puts a stair laid as leaving on its step at once, with no lift, and drives it down by landings like any die', () => {
    const stair = start(pieceOf('R02'));
    const show = new LeavingShow();
    const lower = cubeAt(stair, 4, 5)!;
    const upper = cubeAt(stair, 4, 4)!;
    expect(show.frame(stair, 0, values, false, noDip)).toEqual([]);
    expect(show.height(lower, stair, 0)).toBeCloseTo(0.12);
    expect(show.height(upper, stair, 0)).toBeCloseTo(0.5);
  });

  it('with less motion puts every die on its step at once, strikes the beat at once and keeps no ghost', () => {
    const { state, a, b, show } = sentPair();
    const events = show.frame(state, 0, values, true, noDip);
    expect(events.map((e) => e.kind)).toEqual(['sent', 'impact']);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78);
    land(state, a, b);
    expect(show.frame(state, 0, values, true, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(shownHeight(a, state, 0));
    // Down to the last step, and taken away: said at once, with no ghost.
    for (let i = 0; i < 4; i++) {
      land(state, a, b);
      show.frame(state, 0, values, true, noDip);
    }
    expect(show.height(a, state, 0)).toBeCloseTo(0.12);
    a.t = b.t = 60;
    show.frame(state, 0, values, true, noDip);
    state.cubes = [];
    state.reactions = [];
    expect(show.frame(state, 0, values, true, noDip).map((e) => e.kind)).toEqual(['gone']);
    expect(show.ghosts()).toEqual([]);
  });

  it('starts the lift from where the die was drawn: a die pressed under the figure does not jump up', () => {
    const state = levelRun();
    const a = put(state, 1, 1, 2);
    const pressed = new LeavingShow();
    pressed.frame(state, 0, values, false, noDip);
    send(state, a, put(state, 2, 1, 2));
    pressed.frame(state, 0, values, false, (id) => (id === a.id ? -0.1 : 0));
    expect(pressed.height(a, state, 0)).toBeCloseTo(0.9);
    pressed.frame(state, 90, values, false, noDip);
    expect(pressed.height(a, state, 0)).toBeCloseTo(1.08);
  });

  it('is so by the rules themselves: a pair made on a piece of the road is sent, and its stair is driven down on that landing', () => {
    const climb = start(pieceOf('R10'));
    const show = new LeavingShow();
    expect(show.frame(climb, 0, values, false, noDip)).toEqual([]);
    const stair = cubeAt(climb, 2, 1)!;
    expect(show.height(stair, climb, 0)).toBeCloseTo(0.5);
    go(climb, 'N');
    const events = show.frame(climb, 0, values, false, noDip);
    expect(events.map((e) => e.kind)).toEqual(['sent']);
    expect(events[0].cubeIds.length).toBe(2);
    const pair = cubeAt(climb, 0, 2)!;
    expect(show.height(pair, climb, 0)).toBeCloseTo(1);
    // The stair stands where it stood, and is driven to its last step.
    expect(show.height(stair, climb, 0)).toBeCloseTo(0.5);
    const later = [...show.frame(climb, 120, values, false, noDip), ...show.frame(climb, 1000, values, false, noDip)];
    expect(later.map((e) => e.kind).sort()).toEqual(['impact', 'step']);
    expect(show.height(stair, climb, 0)).toBeCloseTo(0.12);
    expect(show.height(pair, climb, 0)).toBeCloseTo(0.78);
  });

  /**
   * A board of the road made over for the show: the figure's die rolls north into a pair of 2s; the die east of the
   * pair, rolled north, joins it; the fourth die stands far from them, so that the world stands between moves. `count` is
   * how many of the four are laid.
   */
  function chainBoard(count: 2 | 3 | 4): RunState {
    const dice = [
      { x: 2, z: 3, top: 4, north: 5 },
      { x: 2, z: 1, top: 2, north: 1 },
      { x: 3, z: 2, top: 4, north: 5 },
      { x: 0, z: 4, top: 4, north: 5 },
    ].slice(0, count);
    return start({ ...pieceOf('R10'), id: 'T01', size: 5, values: [2], faces: [2], norm: dice.length, floor: true, holes: undefined, goal: { kind: 'send', count: 999 }, moves: 0, sinkMoves: 6, layout: { start: { x: 2, z: 3 }, dice } });
  }

  it('by the rules a chain that is added to stands on its step on that landing: it lifts and strikes with the die that joined', () => {
    const state = chainBoard(4);
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    go(state, 'N');
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    const pair = cubeAt(state, 2, 2)!;
    const other = cubeAt(state, 2, 1)!;
    expect(show.height(pair, state, 0)).toBeCloseTo(0.78);
    // Over to the die beside the pair, and north with it: it joins.
    go(state, 'E');
    show.frame(state, 100, values, false, noDip);
    go(state, 'N');
    const joined = cubeAt(state, 3, 1)!;
    expect(joined.reactionId).toBe(pair.reactionId);
    expect(show.frame(state, 0, values, false, noDip).map((e) => e.kind)).toEqual(['sent']);
    expect(show.frame(state, 90, values, false, noDip)).toEqual([]);
    expect(show.height(pair, state, 0)).toBeCloseTo(0.78 + 0.08);
    expect(show.height(joined, state, 0)).toBeCloseTo(1.08);
    expect(show.frame(state, 60, values, false, noDip)).toEqual([]);
    // 280 ms after it was sent the whole chain strikes: its beat, with its three dice.
    const struck = show.frame(state, 130, values, false, noDip);
    expect(struck.map((e) => e.kind)).toEqual(['impact']);
    expect([...struck[0].cubeIds].sort()).toEqual([pair.id, other.id, joined.id].sort());
    show.frame(state, 200, values, false, noDip);
    expect(show.height(joined, state, 0)).toBeCloseTo(0.78);
    expect(show.height(pair, state, 0)).toBeCloseTo(0.78);
  });

  /** Plays the moves pressed ahead: each is taken on the first tick the rules accept it, with `ticks` of the rules to a frame of 20 ms. */
  function playAhead(state: RunState, show: LeavingShow, moves: Dir[], ticks = 1): string[] {
    const kinds: string[] = [];
    const queue = [...moves];
    for (let i = 0; i < 4000 && (queue.length > 0 || state.player.action || worldRuns(state)) && !state.over; i++) {
      for (let k = 0; k < ticks; k++) if (step(state, queue[0] ?? null)) queue.shift();
      kinds.push(...show.frame(state, 20, values, false, noDip).map((e) => e.kind));
    }
    for (let i = 0; i < 30; i++) kinds.push(...show.frame(state, 20, values, false, noDip).map((e) => e.kind));
    return kinds;
  }

  it('sees every landing of a player who presses the next move ahead, where the world never stands between two rolls', () => {
    const state = chainBoard(4);
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    // The pair, over to the die beside it, and six rolls of that die to and fro: the window of the pair.
    const kinds = playAhead(state, show, ['N', 'E', 'E', 'W', 'E', 'W', 'E', 'W']);
    expect(state.cubes.filter((cube) => cube.state === 'sinking')).toEqual([]);
    expect(kinds.filter((kind) => kind === 'sent')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'impact')).toHaveLength(1);
    // The first landing may cut the first strike short; every one after it is a step, and the last takes the pair under.
    expect(kinds.filter((kind) => kind === 'step').length).toBeGreaterThanOrEqual(4);
    expect(kinds.filter((kind) => kind === 'gone')).toHaveLength(1);
    expect(show.ghosts()).toEqual([]);
  });

  it('sends a group whatever the frame: with two ticks of the rules to one, and where the match leaves no die standing', () => {
    for (const count of [4, 2] as const) {
      for (const ticks of [1, 2, 3]) {
        const state = chainBoard(count);
        const show = new LeavingShow();
        show.frame(state, 0, values, false, noDip);
        const queue: Dir[] = ['N'];
        const kinds: string[] = [];
        for (let i = 0; i < 30; i++) {
          for (let k = 0; k < ticks; k++) if (step(state, queue[0] ?? null)) queue.shift();
          kinds.push(...show.frame(state, 40, values, false, noDip).map((e) => e.kind));
        }
        expect(kinds.filter((kind) => kind === 'sent'), `${count} dice, ${ticks} ticks`).toHaveLength(1);
        expect(kinds.filter((kind) => kind === 'impact'), `${count} dice, ${ticks} ticks`).toHaveLength(1);
      }
    }
  });

  it('does not send again a group it finds going after a reset: a move taken back puts the board on anew', () => {
    const { state, a, show } = sentPair();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    show.reset();
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78);
    expect(show.frame(state, 500, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78);
  });

  it('makes no ghost of a die rolled over on its last step, with its last move still left to it', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    for (let i = 0; i < 5; i++) {
      land(state, a, b);
      show.frame(state, 0, values, false, noDip);
      show.frame(state, 1000, values, false, noDip);
    }
    expect(show.height(a, state, 0)).toBeCloseTo(0.12);
    // A die is rolled onto it: the rules take it at the start of that roll, with its window where the landing left it.
    state.cubes = state.cubes.filter((cube) => cube.id !== a.id);
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    expect(show.ghosts()).toEqual([]);
    expect(show.frame(state, 200, values, false, noDip)).toEqual([]);
  });

  it('drives the dice to their step on the landing that ends a board too, and says nothing of it', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    land(state, a, b);
    state.over = true;
    state.endReason = 'failed';
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    // No jump on the frame the board ends: it is driven from where it stood.
    expect(show.height(a, state, 0)).toBeCloseTo(0.78);
    expect(show.frame(state, 60, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeLessThan(0.78);
    expect(show.frame(state, 1000, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(shownHeight(a, state, 0));
    // A die sent by the move that lost the board goes as any die that is sent, and does not jump to its step: only
    // its springs are let go of (`sent`), and nothing is said of its strike.
    const c = put(state, 3, 1, 2);
    show.frame(state, 0, values, false, noDip);
    send(state, c);
    expect(show.frame(state, 0, values, false, noDip).map((e) => e.kind)).toEqual(['sent']);
    expect(show.height(c, state, 0)).toBeCloseTo(1);
    expect(show.frame(state, 90, values, false, noDip)).toEqual([]);
    expect(show.height(c, state, 0)).toBeCloseTo(1.08);
    expect(show.frame(state, 1000, values, false, noDip)).toEqual([]);
    expect(show.height(c, state, 0)).toBeCloseTo(0.78);
  });

  it('leaves the dice of the combo that passes a board to the finale: until it is called it sends none of them', () => {
    const { state, show } = sentPair();
    show.frame(state, 0, values, false, noDip);
    const c = put(state, 3, 1, 2);
    show.frame(state, 0, values, false, noDip);
    send(state, c);
    state.over = true;
    state.endReason = 'passed';
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    expect(show.height(c, state, 0)).toBe(shownHeight(c, state, 0));
  });

  it('presses both chains a die joins at once, though the rules have just made one of the two', () => {
    const state = levelRun();
    const a = put(state, 1, 1, 2);
    const f = put(state, 2, 1, 2);
    const b = put(state, 3, 1, 2);
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    send(state, a);
    b.state = 'sinking';
    b.t = 1;
    b.reactionId = 2;
    // Each stands for a group of its own, not for a stair, which is a group of one.
    state.reactions[0].total = 2;
    state.reactions.push({ id: 2, value: 2, chain: 1, total: 2 });
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    // The die between them joins both: the rules give the second chain the name of the first on that tick.
    send(state, f);
    b.reactionId = 1;
    state.reactions = state.reactions.filter((reaction) => reaction.id === 1);
    expect(show.frame(state, 0, values, false, noDip).map((e) => e.kind)).toEqual(['sent']);
    show.frame(state, 90, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78 + 0.08);
    expect(show.height(b, state, 0)).toBeCloseTo(0.78 + 0.08);
    show.frame(state, 60, values, false, noDip);
    const struck = show.frame(state, 130, values, false, noDip);
    expect(struck.map((e) => e.kind)).toEqual(['impact']);
    expect([...struck[0].cubeIds].sort()).toEqual([a.id, f.id, b.id].sort());
  });

  it('brings a die back up softly when a move is taken back, with no strike', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    land(state, a, b);
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    const low = show.height(a, state, 0);
    a.t = b.t = 1;
    expect(show.frame(state, 0, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(low);
    expect(show.frame(state, 60, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeGreaterThan(low);
    expect(show.height(a, state, 0)).toBeLessThanOrEqual(0.78);
    expect(show.frame(state, 1000, values, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0)).toBeCloseTo(0.78);
  });

  it('goes by steps too while the world plays by itself, no die standing: a step a beat, and under the floor at the end', () => {
    const state = chainBoard(3);
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    go(state, 'N');
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    go(state, 'E');
    step(state, 'N');
    // Every die of the board is going now: the world plays beat after beat with nobody moving.
    const kinds: string[] = [];
    const pair = cubeAt(state, 2, 2)!;
    let last = 1;
    let lowest = 1;
    for (let ticks = 0; ticks < 2000 && state.cubes.length > 0; ticks++) {
      step(state, null);
      kinds.push(...show.frame(state, 20, values, false, noDip).map((e) => e.kind));
      if (state.cubes.includes(pair)) {
        const height = show.height(pair, state, 0);
        // Down only, but for the lift of the chain when it is added to and the settling after a step.
        expect(height).toBeLessThan(last + 0.09);
        last = height;
        lowest = Math.min(lowest, height);
      }
    }
    expect(state.cubes).toEqual([]);
    // The first of its landings cuts the lift of the chain short and is its strike; the rest are steps.
    expect(kinds.filter((kind) => kind === 'step').length).toBeGreaterThanOrEqual(4);
    // The pair came to its last step before the rules took it, and went under from there.
    expect(lowest).toBeLessThan(0.13);
    expect(show.ghosts().length).toBe(3);
    for (let i = 0; i < 20; i++) kinds.push(...show.frame(state, 20, values, false, noDip).map((e) => e.kind));
    // The rules bring the die that joined in step with its chain: the three go under together, as one group.
    expect(kinds.filter((kind) => kind === 'gone').length).toBe(1);
    expect(show.ghosts()).toEqual([]);
  });

  it('says a strike on the frame the dice are drawn at its end, at sixty frames a second: no frame is lost to the sum of their times', () => {
    const { state, a, show } = sentPair();
    state.over = true;
    state.endReason = 'passed';
    show.finale(state, 2, values, false, noDip);
    // 350 ms is twenty-one frames; by the sum of the times a page gives its frames it can be a hair short of that.
    let events: LeavingEvent[] = [];
    let frames = 0;
    while (events.length === 0 && frames < 40) {
      events = show.frame(state, 350 / 21 - 1e-9, values, false, noDip);
      frames++;
    }
    expect(frames).toBe(21);
    expect(show.height(a, state, 0)).toBeLessThanOrEqual(-0.5 + 1e-6);
    expect(events.map((e) => e.kind)).toEqual(['gone']);
  });

  describe('as the look is set: the dice are pressed down, and none of them ever goes up', () => {
    const set = boardDefaults();

    it('presses a group that is sent a little under its full height, holds it there, and strikes its step', () => {
      const state = levelRun();
      const a = put(state, 1, 1, 2);
      const b = put(state, 2, 1, 2);
      const show = new LeavingShow();
      show.frame(state, 0, set, false, noDip);
      send(state, a, b);
      // The die under the figure is pressed already, deeper than the press of the group: it stays where it is.
      show.frame(state, 0, set, false, (id) => (id === a.id ? -0.1 : 0));
      expect(show.height(a, state, 0)).toBeCloseTo(0.9);
      expect(show.height(b, state, 0)).toBeCloseTo(1);
      let last = { a: show.height(a, state, 0), b: show.height(b, state, 0) };
      const kinds: string[] = [];
      for (let ms = 0; ms < 500; ms += 10) {
        kinds.push(...show.frame(state, 10, set, false, noDip).map((e) => e.kind));
        const now = { a: show.height(a, state, 0), b: show.height(b, state, 0) };
        // Down only, but for the settling back from under the step.
        if (!kinds.includes('impact')) {
          expect(now.a).toBeLessThanOrEqual(last.a + 1e-9);
          expect(now.b).toBeLessThanOrEqual(last.b + 1e-9);
        }
        expect(now.b).toBeLessThanOrEqual(1);
        if (ms === 80) expect(now.b).toBeCloseTo(0.94);
        if (ms === 80) expect(now.a).toBeCloseTo(0.9);
        last = now;
      }
      expect(kinds).toEqual(['impact']);
      expect(last.a).toBeCloseTo(0.78);
      expect(last.b).toBeCloseTo(0.78);
    });

    it('presses the whole chain with the die that joins it, each die from its own step', () => {
      const { state, a, b, show } = sentPair();
      show.frame(state, 0, set, false, noDip);
      show.frame(state, 1000, set, false, noDip);
      const c = put(state, 3, 1, 2);
      show.frame(state, 0, set, false, noDip);
      send(state, c);
      state.reactions[0].chain = 2;
      show.frame(state, 0, set, false, noDip);
      show.frame(state, 90, set, false, noDip);
      expect(show.height(a, state, 0)).toBeCloseTo(0.78 - 0.06);
      expect(show.height(b, state, 0)).toBeCloseTo(0.78 - 0.06);
      expect(show.height(c, state, 0)).toBeCloseTo(0.94);
      show.frame(state, 60, set, false, noDip);
      // While the new die drops the chain is held pressed: it is under its step already, and does not come up to be struck.
      show.frame(state, 65, set, false, noDip);
      expect(show.height(a, state, 0)).toBeCloseTo(0.78 - 0.06);
      const struck = show.frame(state, 65, set, false, noDip);
      expect(struck.map((e) => e.kind)).toEqual(['impact']);
      expect(struck[0].cubeIds).toEqual([a.id, b.id, c.id]);
      expect(show.height(a, state, 0)).toBeCloseTo(0.78 - 0.06);
      // It is let back to its step after the strike, as the die that struck comes back from under its own.
      show.frame(state, 60, set, false, noDip);
      expect(show.height(a, state, 0)).toBeGreaterThan(0.78 - 0.06);
      expect(show.height(a, state, 0)).toBeLessThan(0.78);
      show.frame(state, 300, set, false, noDip);
      expect(show.height(a, state, 0)).toBeCloseTo(0.78);
      expect(show.height(c, state, 0)).toBeCloseTo(0.78);
    });

    it('presses every die of a board on its last combo while they sound, and takes them under at once', () => {
      const { state, a, b, show } = sentPair();
      const idle = put(state, 0, 4, 4);
      state.over = true;
      state.endReason = 'passed';
      show.finale(state, 2, set, false, noDip);
      show.frame(state, 0, set, false, noDip);
      show.frame(state, 100, set, false, noDip);
      for (const cube of [a, b, idle]) expect(show.height(cube, state, 0)).toBeCloseTo(1 - 0.08);
      show.frame(state, 100, set, false, noDip);
      expect(show.height(idle, state, 0)).toBeCloseTo(1 - 0.08);
      const events = show.frame(state, 150, set, false, noDip);
      expect(events.map((e) => [e.kind, e.final])).toEqual([['gone', true]]);
      expect(events[0].cubeIds).toEqual([a.id, b.id, idle.id]);
    });
  });
});
