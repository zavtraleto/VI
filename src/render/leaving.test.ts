import { describe, expect, it } from 'vitest';
import { cubeAt, cubeHeight } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { worldRuns } from '../rules/level';
import { createRun, step } from '../rules/sim';
import { levelRun, put } from '../rules/testkit';
import type { Cube, Dir, LevelSpec, RunState } from '../rules/types';
import { ROAD } from '../levels/road';
import { boardDefaults } from './params';
import { isStair, LeavingShow, leavingHeight, leavingSteps, shownHeight } from './leaving';

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
  const values = boardDefaults();
  const noDip = (): number => 0;

  /**
   * A level whose world stands, with a pair of 2s that has just been sent: t 1, as the rules have it
   * on the frame after the tick of the match (a tick of the window gone), six moves to go.
   */
  function sentPair(): { state: RunState; a: Cube; b: Cube } {
    const state = levelRun();
    const a = put(state, 1, 1, 2, 'sinking');
    const b = put(state, 2, 1, 2, 'sinking');
    a.t = b.t = 1;
    a.reactionId = b.reactionId = 1;
    state.reactions.push({ id: 1, value: 2, chain: 1, total: 2 });
    return { state, a, b };
  }

  /** A landing: the world has run a move and stands again. */
  function land(state: RunState, ...cubes: Cube[]): void {
    for (const cube of cubes) cube.t += state.config.actionTicks;
  }

  it('lifts a sent pair as one body, hangs, drops onto the first step and settles, with the beat on the drop', () => {
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
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
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
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

  it('lets a chain that is added to sigh, and sends the new die by the whole lift and drop', () => {
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    land(state, a, b);
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    const step1 = shownHeight(a, state, 0);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
    // A third 2 joins: held for two moves by the rules, the pair stays where it is.
    const c = put(state, 3, 1, 2, 'sinking');
    c.t = 1;
    c.reactionId = 1;
    a.hold = b.hold = 2 * state.config.actionTicks;
    state.reactions[0].chain = 2;
    state.reactions[0].total = 3;
    const sent = show.frame(state, 0, values, false, noDip);
    expect(sent.map((e) => e.kind)).toEqual(['sent']);
    expect(sent[0].cubeIds).toEqual([c.id]);
    // Half way through the sigh the pair is up by the sigh; the new die is on its way up.
    show.frame(state, 80, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(step1 + 0.04);
    expect(show.height(c, state, 0)).toBeGreaterThan(1);
    show.frame(state, 80, values, false, noDip);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
    // The new die drops to its own first step, and that is the beat of the chain.
    const events = [...show.frame(state, 120, values, false, noDip), ...show.frame(state, 70, values, false, noDip)];
    expect(events.map((e) => e.kind)).toEqual(['impact']);
    expect(events[0].cubeIds).toEqual([c.id]);
    show.frame(state, 200, values, false, noDip);
    expect(show.height(c, state, 0)).toBeCloseTo(0.78);
  });

  it('keeps a ghost of a die the rules have taken at the end of its way, drives it under the floor and says so', () => {
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    // Five landings: the last step.
    for (let i = 0; i < 5; i++) {
      land(state, a, b);
      show.frame(state, 0, values, false, noDip);
      show.frame(state, 1000, values, false, noDip);
    }
    expect(show.height(a, state, 0)).toBeCloseTo(0.12);
    // The sixth: the rules take the pair away.
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
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
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
    // The first beat was never struck: the landing's step is what sounds, and the game lets its held beats go on it.
    expect(events.map((e) => e.kind)).toEqual(['step']);
    expect(show.height(a, state, 0)).toBeCloseTo(step1);
  });

  it('makes no ghost of a die taken away early, rolled over with moves still left to it', () => {
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
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
    const { state, a, b } = sentPair();
    const show = new LeavingShow();
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
    state.cubes = [];
    state.reactions = [];
    expect(show.frame(state, 0, values, true, noDip).map((e) => e.kind)).toEqual(['gone']);
    expect(show.ghosts()).toEqual([]);
  });

  it('starts the lift from where the die was drawn: a die pressed under the figure does not jump up', () => {
    const { state, a } = sentPair();
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    const pressed = new LeavingShow();
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
   * pair, rolled north, joins it. `spare` leaves a die standing far from them, so that the world stands between moves.
   */
  function chainBoard(spare: boolean): RunState {
    const dice = [
      { x: 2, z: 3, top: 4, north: 5 },
      { x: 2, z: 1, top: 2, north: 1 },
      { x: 3, z: 2, top: 4, north: 5 },
    ];
    if (spare) dice.push({ x: 0, z: 4, top: 4, north: 5 });
    return start({ ...pieceOf('R10'), id: 'T01', size: 5, values: [2], faces: [2], norm: dice.length, floor: true, holes: undefined, goal: { kind: 'send', count: 999 }, moves: 0, sinkMoves: 6, layout: { start: { x: 2, z: 3 }, dice } });
  }

  it('by the rules a chain that is added to has just made a move: it is driven its step down, and sighs after it', () => {
    const state = chainBoard(true);
    const show = new LeavingShow();
    show.frame(state, 0, values, false, noDip);
    go(state, 'N');
    show.frame(state, 0, values, false, noDip);
    show.frame(state, 1000, values, false, noDip);
    const pair = cubeAt(state, 2, 2)!;
    expect(show.height(pair, state, 0)).toBeCloseTo(0.78);
    // Over to the die beside the pair, and north with it: it joins.
    go(state, 'E');
    show.frame(state, 100, values, false, noDip);
    go(state, 'N');
    const joined = cubeAt(state, 3, 1)!;
    expect(joined.reactionId).toBe(pair.reactionId);
    const step = shownHeight(pair, state, 0);
    expect(step).toBeLessThan(0.7);
    expect(show.frame(state, 0, values, false, noDip).map((e) => e.kind)).toEqual(['sent']);
    // The step of the landing first: 120 ms down, 120 ms of settling.
    expect(show.frame(state, 120, values, false, noDip).map((e) => e.kind)).toEqual(['step']);
    show.frame(state, 120, values, false, noDip);
    expect(show.height(pair, state, 0)).toBeCloseTo(step);
    // Then the sigh: up by it half way through, and back.
    show.frame(state, 80, values, false, noDip);
    expect(show.height(pair, state, 0)).toBeCloseTo(step + 0.04);
    show.frame(state, 80, values, false, noDip);
    expect(show.height(pair, state, 0)).toBeCloseTo(step);
    expect(show.height(joined, state, 0)).toBeCloseTo(0.78);
  });

  it('goes by steps too while the world plays by itself, no die standing: a step a beat, and under the floor at the end', () => {
    const state = chainBoard(false);
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
        // Down only, but for the sigh and the settling after a step.
        expect(height).toBeLessThan(last + 0.045);
        last = height;
        lowest = Math.min(lowest, height);
      }
    }
    expect(state.cubes).toEqual([]);
    expect(kinds.filter((kind) => kind === 'step').length).toBeGreaterThanOrEqual(5);
    // The pair came to its last step before the rules took it, and went under from there.
    expect(lowest).toBeLessThan(0.13);
    expect(show.ghosts().length).toBe(3);
    for (let i = 0; i < 20; i++) kinds.push(...show.frame(state, 20, values, false, noDip).map((e) => e.kind));
    // The rules bring the die that joined in step with its chain: the three go under together, as one group.
    expect(kinds.filter((kind) => kind === 'gone').length).toBe(1);
    expect(show.ghosts()).toEqual([]);
  });
});
