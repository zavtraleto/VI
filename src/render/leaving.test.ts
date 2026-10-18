import { describe, expect, it } from 'vitest';
import { cubeAt, cubeHeight } from '../rules/board';
import { defaultConfig } from '../rules/config';
import { worldRuns } from '../rules/level';
import { createRun, step } from '../rules/sim';
import { levelRun, put } from '../rules/testkit';
import type { Cube, Dir, LevelSpec, RunState } from '../rules/types';
import { fileBoard } from '../levels/boardFiles';
import { boardDefaults } from './params';
import { finaleMs, isStair, LeavingShow, leavingHeight, leavingSteps, restHeight, shownHeight, type LeavingEvent } from './leaving';

const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
const pieceOf = (id: string): LevelSpec => fileBoard(id);

function go(state: RunState, dir: Dir): void {
  step(state, dir);
  for (let ticks = 0; (worldRuns(state) || state.player.action) && !state.over; ticks++) {
    if (ticks > 1000) throw new Error('a move that does not end');
    step(state, null);
  }
}

describe('the height a die that leaves a level is shown at', () => {
  it('is by steps on a board whose dice go in two moves: 0.75 when it leaves, 0.3 with a move left, and nothing then', () => {
    expect(leavingHeight(1, 2)).toBeCloseTo(0.75);
    expect(leavingHeight(0.5, 2)).toBeCloseTo(0.3);
    expect(leavingHeight(0, 2)).toBe(0);
    // In between, the straight line from one step to the next.
    expect(leavingHeight(0.75, 2)).toBeCloseTo(0.525);
    expect(leavingHeight(0.25, 2)).toBeCloseTo(0.15);
    // Past either end it stays at that end.
    expect(leavingHeight(1.1, 2)).toBeCloseTo(0.75);
    expect(leavingHeight(-0.1, 2)).toBe(0);
  });

  it('is the middle step for a stair with two moves left, down to the last step through the move, and nothing then', () => {
    expect(leavingHeight(1, 2, leavingSteps(), true)).toBeCloseTo(0.53);
    expect(leavingHeight(0.75, 2, leavingSteps(), true)).toBeCloseTo(0.415);
    expect(leavingHeight(0.5, 2, leavingSteps(), true)).toBeCloseTo(0.3);
    expect(leavingHeight(0, 2, leavingSteps(), true)).toBe(0);
  });

  it('keeps its steps in the look, where the lab can turn them', () => {
    expect(leavingSteps()).toEqual({ first: 0.75, last: 0.3, middle: 0.53 });
    expect(leavingSteps(boardDefaults())).toEqual({ first: 0.75, last: 0.3, middle: 0.53 });
    expect(leavingHeight(1, 2, leavingSteps({ stairMiddle: 0.4 }), true)).toBeCloseTo(0.4);
    expect(leavingHeight(1, 2, leavingSteps({ leaveFirst: 0.8, leaveLast: 0.15 }))).toBeCloseTo(0.8);
    expect(leavingHeight(0.5, 2, leavingSteps({ leaveFirst: 0.8, leaveLast: 0.15 }))).toBeCloseTo(0.15);
  });

  it('goes over the window of a board whose dice go in more moves: the last step with the last move left', () => {
    expect(leavingHeight(1, 3)).toBeCloseTo(0.75);
    expect(leavingHeight(1 / 3, 3)).toBeCloseTo(0.3);
    expect(leavingHeight(2 / 3, 3)).toBeCloseTo(0.525);
    expect(leavingHeight(1, 1)).toBeCloseTo(0.75);
  });

  it('is so on a piece of the road: the pair made, a move after it, and the stair laid as leaving in two moves and in one', () => {
    // The lesson of the way up: its stair is laid as leaving in two moves, and stands half way up, not as a die that has just left.
    const climb = start(pieceOf('R10'));
    expect(isStair(cubeAt(climb, 2, 1)!, climb)).toBe(true);
    expect(shownHeight(cubeAt(climb, 2, 1)!, climb, 0)).toBeCloseTo(0.53);
    go(climb, 'N');
    // The pair has just left, and the stair has a move left to it. The pair is no stair, though it is as far from going.
    expect(isStair(cubeAt(climb, 0, 2)!, climb)).toBe(false);
    expect(shownHeight(cubeAt(climb, 0, 2)!, climb, 0)).toBeCloseTo(0.75);
    expect(shownHeight(cubeAt(climb, 0, 1)!, climb, 0)).toBeCloseTo(0.75);
    expect(shownHeight(cubeAt(climb, 2, 1)!, climb, 0)).toBeCloseTo(0.3);
    // The rules have them otherwise, and are not changed: nearly whole, and about half.
    expect(cubeHeight(cubeAt(climb, 0, 2)!, climb.config)).toBeGreaterThan(0.9);
    expect(cubeHeight(cubeAt(climb, 2, 1)!, climb.config)).toBeGreaterThan(0.45);
    // The stair of two of the second piece: the lower laid as leaving in one move, near the floor, the upper in two, half way up.
    const stair = start(pieceOf('R02'));
    expect(shownHeight(cubeAt(stair, 4, 5)!, stair, 0)).toBeCloseTo(0.3);
    expect(shownHeight(cubeAt(stair, 4, 4)!, stair, 0)).toBeCloseTo(0.53);
    // A die that stands is whole.
    expect(shownHeight(cubeAt(stair, 4, 3)!, stair, 0)).toBe(1);
    // Up the stair, over, and the first roll: the lower is gone, and the upper has come down to where the lower was.
    for (const dir of ['N', 'N', 'N', 'N'] as const) go(stair, dir);
    expect(cubeAt(stair, 4, 5)).toBeUndefined();
    expect(shownHeight(cubeAt(stair, 4, 4)!, stair, 0)).toBeCloseTo(0.3);
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

describe('the leaving of a group on a level: gentle, and only ever down', () => {
  const values = boardDefaults();
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
    show.frame(state, 0, false, noDip);
    send(state, a, b);
    return { state, a, b, show };
  }

  /** A landing: the world has run a move and stands again. */
  function land(state: RunState, ...cubes: Cube[]): void {
    for (const cube of cubes) cube.t += state.config.actionTicks;
  }

  /** Runs the show on by `ms` in frames of ten, and says how high `cube` was drawn on each. */
  function run(show: LeavingShow, state: RunState, cube: Cube, ms: number, kinds: string[] = []): number[] {
    const heights: number[] = [];
    for (let at = 0; at < ms; at += 10) {
      kinds.push(...show.frame(state, 10, false, noDip).map((e) => e.kind));
      heights.push(show.height(cube, state, 0, values));
    }
    return heights;
  }

  const neverUp = (heights: readonly number[]): void => {
    for (let i = 1; i < heights.length; i++) expect(heights[i], `frame ${i}`).toBeLessThanOrEqual(heights[i - 1] + 1e-9);
  };

  it('rests a die on the step of its moves, and takes it to the next through a move gently: slow off the step, slow onto the next', () => {
    const { state, a } = sentPair();
    const at = (t: number): number => {
      a.t = t;
      return restHeight(a, state, 0, values);
    };
    const first = at(1);
    const second = at(11);
    expect(first).toBeCloseTo(0.75);
    expect(second).toBeCloseTo(0.66);
    // On a step it is what the look has always had there.
    for (const t of [1, 11, 21, 31, 41, 51]) expect(at(t), `t ${t}`).toBeCloseTo(shownHeight({ ...a, t }, state, 0, values));
    // Half way through the move, half way down; a fifth of the way through, hardly begun; four fifths, nearly there.
    expect(at(6)).toBeCloseTo((first + second) / 2);
    expect(first - at(3)).toBeLessThan((first - second) * 0.12);
    expect(at(9) - second).toBeLessThan((first - second) * 0.12);
    // With its last move it goes down into the floor, and is there as the move ends.
    expect(at(51)).toBeCloseTo(0.3);
    expect(at(56)).toBeCloseTo(0.15);
    expect(at(61)).toBe(0);
    // Down only, tick by tick, over the whole of its window.
    neverUp(Array.from({ length: 61 }, (_, i) => at(i + 1)));
  });

  it('is what the rules have, with no events, outside a level', () => {
    const session = createRun({ seed: 1, config: defaultConfig() });
    const show = new LeavingShow();
    const sinking = { ...session.cubes[0], state: 'sinking' as const, t: 3 };
    session.cubes[0] = sinking;
    expect(show.frame(session, 16, false, noDip)).toEqual([]);
    expect(show.height(sinking, session, 0.5)).toBe(shownHeight(sinking, session, 0.5));
    expect(restHeight(sinking, session, 0.5)).toBe(shownHeight(sinking, session, 0.5));
  });

  it('sinks a group that is sent to its first step in one soft movement, all its dice together', () => {
    const { state, a, b, show } = sentPair();
    const first = show.frame(state, 0, false, noDip);
    expect(first.map((e) => e.kind)).toEqual(['sent']);
    expect(first[0].cubeIds).toEqual([a.id, b.id]);
    expect(first[0].cells).toEqual([{ x: 1, z: 1 }, { x: 2, z: 1 }]);
    expect(show.height(a, state, 0, values)).toBeCloseTo(1);
    const kinds: string[] = [];
    const heights = run(show, state, a, 150, kinds);
    // Quick off the mark and soft at the end: half its time gone, most of the way done.
    expect(heights[heights.length - 1]).toBeLessThan(1 - 0.22 * 0.8);
    expect(heights[heights.length - 1]).toBeGreaterThan(0.75);
    expect(show.height(b, state, 0, values)).toBeCloseTo(show.height(a, state, 0, values));
    heights.push(...run(show, state, a, 400, kinds));
    neverUp(heights);
    // It comes to its step and stays: nothing under it, nothing back.
    expect(Math.min(...heights)).toBeCloseTo(0.75);
    expect(heights[heights.length - 1]).toBeCloseTo(0.75);
    expect(heights[14 + 15]).toBeCloseTo(0.75);
    expect(kinds).toEqual([]);
  });

  it('sinks a die pressed under the figure from where it is drawn, and does not bring it up first', () => {
    const state = levelRun();
    const a = put(state, 1, 1, 2);
    const show = new LeavingShow();
    show.frame(state, 0, false, noDip);
    send(state, a, put(state, 2, 1, 2));
    show.frame(state, 0, false, (id) => (id === a.id ? -0.1 : 0));
    expect(show.height(a, state, 0, values)).toBeCloseTo(0.9);
    const heights = run(show, state, a, 400);
    neverUp([0.9, ...heights]);
    expect(heights[heights.length - 1]).toBeCloseTo(0.75);
  });

  it('with less motion puts a die that is sent on its step at once, and still says it was sent', () => {
    const { state, a, show } = sentPair();
    expect(show.frame(state, 0, true, noDip).map((e) => e.kind)).toEqual(['sent']);
    expect(show.height(a, state, 0, values)).toBeCloseTo(0.75);
  });

  it('leaves a chain that is added to where it is: only the die that joins it comes down', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, false, noDip);
    run(show, state, a, 400);
    const c = put(state, 3, 1, 2);
    expect(show.frame(state, 0, false, noDip)).toEqual([]);
    send(state, c);
    a.hold = b.hold = 2 * state.config.actionTicks;
    state.reactions[0].chain = 2;
    const sent = show.frame(state, 0, false, noDip);
    expect(sent.map((e) => e.kind)).toEqual(['sent']);
    expect(sent[0].cubeIds).toEqual([c.id]);
    const kinds: string[] = [];
    const pair = run(show, state, a, 400, kinds);
    for (const height of pair) expect(height).toBeCloseTo(0.75);
    expect(show.height(c, state, 0, values)).toBeCloseTo(0.75);
    expect(kinds).toEqual([]);
  });

  it('goes on down without a jump when the next roll lands before it has come to its step', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, false, noDip);
    const heights = run(show, state, a, 100);
    expect(heights[heights.length - 1]).toBeGreaterThan(0.75);
    // The roll of the figure, tick by tick, while the die is still on its way to its first step.
    for (let t = 2; t <= 11; t++) {
      a.t = b.t = t;
      heights.push(...run(show, state, a, 20));
    }
    heights.push(...run(show, state, a, 300));
    neverUp(heights);
    for (let i = 1; i < heights.length; i++) expect(heights[i - 1] - heights[i], `frame ${i}`).toBeLessThan(0.04);
    expect(heights[heights.length - 1]).toBeCloseTo(shownHeight(a, state, 0));
  });

  it('says a group has gone when the rules take it with its window run out, once for the group, and nothing of a die rolled over', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, false, noDip);
    // A die rolled over with every move still before it: taken, and nothing said.
    const c = put(state, 3, 3, 2);
    show.frame(state, 0, false, noDip);
    c.state = 'sinking';
    c.t = 1;
    c.reactionId = 2;
    state.reactions.push({ id: 2, value: 2, chain: 1, total: 2 });
    show.frame(state, 0, false, noDip);
    state.cubes = state.cubes.filter((cube) => cube !== c);
    expect(show.frame(state, 0, false, noDip)).toEqual([]);
    // The pair, down to its last step, and rolled over there with its last move still left: nothing said either.
    for (let i = 0; i < 5; i++) land(state, a, b);
    show.frame(state, 0, false, noDip);
    const kept = state.cubes;
    state.cubes = kept.filter((cube) => cube !== a);
    expect(show.frame(state, 0, false, noDip)).toEqual([]);
    // The other runs its window out: it has gone into the floor.
    b.t = 60;
    show.frame(state, 0, false, noDip);
    state.cubes = [];
    const events = show.frame(state, 0, false, noDip);
    expect(events.map((e) => e.kind)).toEqual(['gone']);
    expect(events[0].cells).toEqual([{ x: 2, z: 1 }]);
    expect(events[0].final).toBeUndefined();
    expect(show.frame(state, 100, false, noDip)).toEqual([]);
  });

  it('does not send again a group it finds going after a reset: a move taken back puts the board on anew', () => {
    const { state, a, show } = sentPair();
    show.frame(state, 0, false, noDip);
    run(show, state, a, 400);
    show.reset();
    expect(show.frame(state, 0, false, noDip)).toEqual([]);
    expect(show.height(a, state, 0, values)).toBeCloseTo(0.75);
  });

  it('sinks the dice of the move that lost a board as any dice that are sent, and says nothing of dice that go when the board is over', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, false, noDip);
    run(show, state, a, 400);
    const c = put(state, 3, 1, 2);
    show.frame(state, 0, false, noDip);
    send(state, c);
    state.over = true;
    state.endReason = 'failed';
    expect(show.frame(state, 0, false, noDip).map((e) => e.kind)).toEqual(['sent']);
    expect(show.height(c, state, 0, values)).toBeCloseTo(1);
    const heights = run(show, state, c, 400);
    neverUp(heights);
    expect(heights[heights.length - 1]).toBeCloseTo(0.75);
    a.t = b.t = 60;
    show.frame(state, 0, false, noDip);
    state.cubes = [c];
    expect(show.frame(state, 0, false, noDip)).toEqual([]);
  });

  it('leaves the dice of the combo that passes a board to the finale: until it is called it sends none of them', () => {
    const { state, show } = sentPair();
    show.frame(state, 0, false, noDip);
    const c = put(state, 3, 1, 2);
    show.frame(state, 0, false, noDip);
    send(state, c);
    state.over = true;
    state.endReason = 'passed';
    expect(show.frame(state, 0, false, noDip)).toEqual([]);
    expect(show.height(c, state, 0, values)).toBe(restHeight(c, state, 0, values));
  });

  it('takes every die of a board away together on its last combo: they stand lit, and go under the floor as one', () => {
    const { state, a, b, show } = sentPair();
    show.frame(state, 0, false, noDip);
    run(show, state, a, 400);
    land(state, a, b);
    show.frame(state, 0, false, noDip);
    const step = show.height(a, state, 0, values);
    expect(step).toBeCloseTo(0.66);
    // The combo that passes the board: two dice more are sent, one of them under the figure, and a die that stands is left.
    const c = put(state, 3, 1, 2);
    const d = put(state, 3, 2, 2);
    const idle = put(state, 0, 4, 4);
    show.frame(state, 0, false, noDip);
    send(state, c, d);
    state.over = true;
    state.endReason = 'passed';
    expect(finaleMs(values, false)).toEqual({ hang: 250, drop: 450, total: 700 });
    show.finale(state, values, false, (id) => (id === c.id ? -0.1 : 0));
    const all = [a, b, c, d, idle];
    const heights = (): number[] => all.map((cube) => show.height(cube, state, 0, values));
    // They stand where they stood while they are lit.
    expect(show.frame(state, 0, false, noDip)).toEqual([]);
    expect(heights()).toEqual([step, step, 0.9, 1, 1].map((height) => expect.closeTo(height, 5)));
    expect(show.frame(state, 250, false, noDip)).toEqual([]);
    expect(heights()).toEqual([step, step, 0.9, 1, 1].map((height) => expect.closeTo(height, 5)));
    // Then down, all of them, slowly at first: a fifth of the way through its time a die has hardly moved.
    expect(show.frame(state, 90, false, noDip)).toEqual([]);
    expect(show.height(d, state, 0, values)).toBeGreaterThan(0.85);
    expect(show.height(d, state, 0, values)).toBeLessThan(1);
    const before = heights();
    expect(show.frame(state, 180, false, noDip)).toEqual([]);
    heights().forEach((height, i) => expect(height).toBeLessThan(before[i]));
    // Under the floor together: one event with every die of the board.
    const events = show.frame(state, 180, false, noDip);
    expect(events.map((e) => [e.kind, e.final])).toEqual([['gone', true]]);
    expect(events[0].cubeIds).toEqual(all.map((cube) => cube.id));
    expect(events[0].cells).toHaveLength(5);
    for (const height of heights()) expect(height).toBeLessThanOrEqual(-0.5);
    // And nothing after it; the dice stay under until the next board is put on.
    expect(show.frame(state, 500, false, noDip)).toEqual([]);
    expect(show.height(d, state, 0, values)).toBeLessThanOrEqual(-0.5);
    show.reset();
    expect(show.frame(state, 0, false, noDip)).toEqual([]);
  });

  it('says the dice of a finale are under on the frame they are drawn so, at sixty frames a second, and with less motion takes them away with no movement', () => {
    const { state, a, b, show } = sentPair();
    state.over = true;
    state.endReason = 'passed';
    show.finale(state, values, false, noDip);
    // 700 ms is forty-two frames; by the sum of the times a page gives its frames it can be a hair short of that.
    let events: LeavingEvent[] = [];
    let frames = 0;
    while (events.length === 0 && frames < 80) {
      events = show.frame(state, 700 / 42 - 1e-9, false, noDip);
      frames++;
    }
    expect(frames).toBe(42);
    expect(show.height(a, state, 0, values)).toBeLessThanOrEqual(-0.5 + 1e-6);

    expect(finaleMs(values, true)).toEqual({ hang: 700, drop: 0, total: 700 });
    const still = sentPair();
    still.state.over = true;
    still.state.endReason = 'passed';
    still.show.finale(still.state, values, true, noDip);
    expect(still.show.frame(still.state, 690, true, noDip)).toEqual([]);
    expect(still.show.height(still.a, still.state, 0, values)).toBeCloseTo(1);
    const gone = still.show.frame(still.state, 10, true, noDip);
    expect(gone.map((e) => [e.kind, e.final])).toEqual([['gone', true]]);
    expect(gone[0].cubeIds).toEqual([still.a.id, still.b.id]);
    expect(still.show.height(still.b, still.state, 0, values)).toBeLessThanOrEqual(-0.5);
    void b;
  });

  it('stands a stair laid as leaving on its step from the first frame, and sends nothing', () => {
    const stair = start(pieceOf('R02'));
    const show = new LeavingShow();
    expect(show.frame(stair, 0, false, noDip)).toEqual([]);
    expect(show.height(cubeAt(stair, 4, 5)!, stair, 0, values)).toBeCloseTo(0.3);
    expect(show.height(cubeAt(stair, 4, 4)!, stair, 0, values)).toBeCloseTo(0.53);
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

  /** Plays the moves pressed ahead: each is taken on the first tick the rules accept it, with `ticks` of the rules to a frame of 20 ms. Says what the show said, and how high the die of the pair that is not under the figure was drawn, frame by frame, while the rules had it. */
  function playAhead(state: RunState, show: LeavingShow, moves: Dir[], ticks = 1): { kinds: string[]; heights: number[] } {
    const kinds: string[] = [];
    const heights: number[] = [];
    const queue = [...moves];
    for (let i = 0; i < 4000 && (queue.length > 0 || state.player.action || worldRuns(state)) && !state.over; i++) {
      for (let k = 0; k < ticks; k++) if (step(state, queue[0] ?? null)) queue.shift();
      kinds.push(...show.frame(state, 20, false, noDip).map((e) => e.kind));
      const far = cubeAt(state, 2, 1);
      if (far?.state === 'sinking') heights.push(show.height(far, state, 0, values));
    }
    for (let i = 0; i < 30; i++) kinds.push(...show.frame(state, 20, false, noDip).map((e) => e.kind));
    return { kinds, heights };
  }

  it('by the rules themselves: a pair made, six rolls pressed ahead, and it has come down step by step into the floor, never up', () => {
    const state = chainBoard(4);
    const show = new LeavingShow();
    show.frame(state, 0, false, noDip);
    // The pair, over to the die beside it, and six rolls of that die to and fro: the window of the pair.
    const { kinds, heights } = playAhead(state, show, ['N', 'E', 'E', 'W', 'E', 'W', 'E', 'W']);
    expect(state.cubes.filter((cube) => cube.state === 'sinking')).toEqual([]);
    expect(kinds).toEqual(['sent', 'gone']);
    neverUp(heights);
    expect(heights[0]).toBeGreaterThan(0.9);
    expect(heights[heights.length - 1]).toBeLessThan(0.03);
    // No frame takes it further than a soft movement would.
    for (let i = 1; i < heights.length; i++) expect(heights[i - 1] - heights[i], `frame ${i}`).toBeLessThan(0.05);
  });

  it('sends a group once whatever the frame: with two or three ticks of the rules to one, and where the match leaves no die standing', () => {
    for (const count of [4, 2] as const) {
      for (const ticks of [1, 2, 3]) {
        const state = chainBoard(count);
        const show = new LeavingShow();
        show.frame(state, 0, false, noDip);
        const queue: Dir[] = ['N'];
        const kinds: string[] = [];
        for (let i = 0; i < 14; i++) {
          for (let k = 0; k < ticks; k++) if (step(state, queue[0] ?? null)) queue.shift();
          kinds.push(...show.frame(state, 40, false, noDip).map((e) => e.kind));
        }
        expect(kinds.filter((kind) => kind === 'sent'), `${count} dice, ${ticks} ticks`).toHaveLength(1);
      }
    }
  });

  it('by the rules a chain that is added to is held on that landing: it stays where it is, and one die is sent', () => {
    const state = chainBoard(4);
    const show = new LeavingShow();
    show.frame(state, 0, false, noDip);
    go(state, 'N');
    show.frame(state, 0, false, noDip);
    const pair = cubeAt(state, 2, 2)!;
    run(show, state, pair, 400);
    go(state, 'E');
    show.frame(state, 100, false, noDip);
    go(state, 'N');
    const joined = cubeAt(state, 3, 1)!;
    expect(joined.reactionId).toBe(pair.reactionId);
    const before = show.height(pair, state, 0, values);
    const sent = show.frame(state, 0, false, noDip);
    expect(sent.map((e) => e.kind)).toEqual(['sent']);
    expect(sent[0].cubeIds).toEqual([joined.id]);
    const kinds: string[] = [];
    for (const height of run(show, state, pair, 400, kinds)) expect(height).toBeCloseTo(before);
    expect(show.height(joined, state, 0, values)).toBeCloseTo(0.75);
    expect(kinds).toEqual([]);
  });
});
