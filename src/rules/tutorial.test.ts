import { describe, expect, it } from 'vitest';
import { cubeAt, cubeHeight } from './board';
import { defaultConfig } from './config';
import { createRun, step } from './sim';
import { run, snapshot } from './testkit';
import {
  TUTORIAL_HOLD_HEIGHT,
  TUTORIAL_MOUNT_HEIGHT,
  TUTORIAL_MOVES,
  tutorialDir,
  tutorialView,
} from './tutorial';
import type { Dir, GameEvent, RunState, Tuning } from './types';

function tutorial(tuning: Partial<Tuning> = {}): RunState {
  return createRun({ seed: 3, config: defaultConfig({}, tuning), tutorial: true });
}

/** Runs until the tutorial asks for a move; returns what happened on the way. */
function untilMove(s: RunState, limit = 3000): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < limit && tutorialDir(s) === null && !s.tutorial?.done; i++) {
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

/** Waits for the tutorial to ask for a move, makes it and lets the action finish. */
function play(s: RunState, dir: Dir): GameEvent[] {
  const events = untilMove(s);
  expect(tutorialDir(s)).toBe(dir);
  step(s, dir);
  events.push(...s.events);
  for (let i = 0; i < s.config.actionTicks; i++) {
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

/** Plays the first `count` moves of the script. */
function playMoves(s: RunState, count: number): GameEvent[] {
  return TUTORIAL_MOVES.slice(0, count).flatMap((dir) => play(s, dir));
}

// Moves by lesson: twos 1, threes 1, fours 3, fives 1, sixes 5, ones 2.
const AFTER_TWOS = 1;
const AFTER_THREES = 2;
const AFTER_FOURS = 5;
const AFTER_FIVES = 6;
const AFTER_SIX_MATCH = 9;
const ALL = 13;

describe('tutorial start', () => {
  it('begins with the twos alone on the board', () => {
    const s = tutorial();
    expect(s.mode).toBe('practice');
    expect(s.spawnEnabled).toBe(false);
    expect(s.player).toMatchObject({ x: 4, z: 5, level: 'top' });
    expect(s.cubes.length).toBe(2);
    expect(cubeAt(s, 4, 5)?.ori).toMatchObject({ top: 1, east: 2 });
    expect(cubeAt(s, 2, 5)?.ori.top).toBe(2);
    run(s, 500);
    expect(s.cubes.length).toBe(2);
    expect(s.pending.length).toBe(0);
  });

  it('keeps its own pace whatever the variables say', () => {
    const a = tutorial();
    const b = tutorial({ sinkMs: 9000, riseMs: 5000, warnMs: 0, mountHeight: 0.2 });
    for (const key of ['sinkingTicks', 'risingTicks', 'warnTicks', 'mountHeight'] as const) {
      expect(b.config[key]).toBe(a.config[key]);
    }
  });
});

describe('tutorial script', () => {
  it('walks through every lesson', () => {
    const s = tutorial();
    expect(TUTORIAL_MOVES).toEqual(['W', 'N', 'E', 'E', 'N', 'W', 'E', 'W', 'W', 'S', 'W', 'S', 'W']);
    expect(TUTORIAL_MOVES.length).toBe(ALL);
    const events = playMoves(s, ALL);

    const matches = events.filter((e) => e.type === 'match');
    expect(matches.map((e) => [e.value, e.count])).toEqual([[2, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
    expect(events.filter((e) => e.type === 'chain')).toEqual([
      expect.objectContaining({ value: 6, chain: 2, count: 1, points: 84 }),
    ]);
    expect(events.filter((e) => e.type === 'happyOne')).toEqual([{ type: 'happyOne', count: 3, points: 3 }]);
    const kinds = events.flatMap((e) => (e.type === 'move' ? [e.kind] : []));
    expect(kinds).toEqual([
      'roll', 'roll', 'roll', 'roll', 'roll', 'push', 'mount', 'roll', 'roll', 'hop', 'roll', 'hop', 'roll',
    ]);
    expect(s.score).toBe(4 + 9 + 16 + 25 + 36 + 84 + 3);
    expect(s.maxChain).toBe(2);
    expect(s.stats.blockedSteps).toBe(0);

    // The player ends on the 1 that set the others off: it does not sink.
    expect(s.player).toMatchObject({ x: 1, z: 5, level: 'top' });
    expect(cubeAt(s, 1, 5)).toMatchObject({ state: 'idle', ori: expect.objectContaining({ top: 1 }) });
  });

  it('shows only the dice of the lesson in hand', () => {
    const s = tutorial();
    const counts: number[] = [];
    const tops: number[][] = [];
    for (const [i, dir] of TUTORIAL_MOVES.entries()) {
      untilMove(s);
      if ([0, AFTER_TWOS, AFTER_THREES, AFTER_FOURS, AFTER_FIVES].includes(i)) {
        counts.push(s.cubes.length);
        tops.push([...new Set(s.cubes.filter((c) => c.ori.top > 1).map((c) => c.ori.top))].sort());
      }
      play(s, dir);
    }
    expect(counts).toEqual([2, 3, 4, 5, 6]);
    // Apart from the die the player rides, every die shows the value of its lesson.
    expect(tops.map((t) => t.at(0))).toEqual([2, 3, 4, 5, 6]);
  });

  it('starts every lesson on the cell where the last one ended', () => {
    const s = tutorial();
    const starts: [number, number, string][] = [];
    for (const [i, dir] of TUTORIAL_MOVES.entries()) {
      untilMove(s);
      if ([AFTER_TWOS, AFTER_THREES, AFTER_FOURS, AFTER_FIVES].includes(i)) {
        starts.push([s.player.x, s.player.z, s.player.level]);
      }
      play(s, dir);
    }
    // A die lifts the player for threes and fours; fives and the start of sixes are on the floor.
    // The player rode three of the sinking groups down; the fives sank without them.
    expect(starts).toEqual([[3, 5, 'top'], [3, 4, 'top'], [5, 3, 'ground'], [4, 3, 'ground']]);
    expect(s.stats.falls).toBe(3);
  });

  it('ignores a step off the script and anything pressed while it waits', () => {
    const s = tutorial();
    for (const dir of ['N', 'E', 'S'] as const) {
      const before = snapshot(s);
      step(s, dir);
      expect(s.events).toEqual([{ type: 'nudge', dir }]);
      expect(snapshot(s)).toBe(before);
    }
    play(s, 'W');
    // The pair is sinking and the next lesson is not up yet: nothing to do, nothing happens.
    expect(tutorialDir(s)).toBeNull();
    const player = { ...s.player };
    step(s, 'W');
    expect(s.events.some((e) => e.type === 'nudge' || e.type === 'move')).toBe(false);
    expect(s.player).toEqual(player);
    expect(s.stats.blockedSteps).toBe(0);
  });

  it('clears a finished lesson at once but keeps a chain waiting for the player', () => {
    const s = tutorial();
    play(s, 'W');
    run(s, s.config.sinkingTicks + 5);
    expect(s.cubes.length).toBe(0);
    expect(s.player.level).toBe('ground');

    const t = tutorial();
    playMoves(t, AFTER_SIX_MATCH);
    run(t, 2000);
    untilMove(t);
    const own = cubeAt(t, 3, 3)!;
    expect(own.state).toBe('sinking');
    expect(cubeHeight(own, t.config)).toBeCloseTo(TUTORIAL_HOLD_HEIGHT);
    expect(t.player.level).toBe('top');
    expect(tutorialDir(t)).toBe('S');
  });

  it('holds the rising die until the player has stepped onto it', () => {
    const s = tutorial();
    playMoves(s, AFTER_FIVES);
    untilMove(s);
    run(s, 2000);
    const die = cubeAt(s, 5, 3)!;
    expect(die.state).toBe('rising');
    expect(cubeHeight(die, s.config)).toBeCloseTo(TUTORIAL_MOUNT_HEIGHT, 1);
    // The rest of the lesson's dice did not wait with it.
    expect(s.cubes.filter((c) => c.state === 'idle').length).toBe(5);
    expect(tutorialDir(s)).toBe('E');
    play(s, 'E');
    untilMove(s);
    expect(die.state).toBe('idle');
    expect(s.player).toMatchObject({ x: 5, z: 3, level: 'top' });
  });

  it('ends once, after the closing lines', () => {
    const s = tutorial();
    const events = playMoves(s, ALL);
    expect(events.some((e) => e.type === 'tutorialDone')).toBe(false);
    events.push(...untilMove(s, 1000));
    expect(events.filter((e) => e.type === 'tutorialDone').length).toBe(1);
    expect(s.tutorial?.done).toBe(true);
    expect(tutorialView(s)).toBeNull();
    // Released: the chain finishes sinking and the player may move freely.
    run(s, s.config.sinkingTicks + 5);
    expect(s.cubes.some((c) => c.state === 'sinking')).toBe(false);
    step(s, 'E');
    expect(s.events).toContainEqual({ type: 'move', kind: 'roll', dir: 'E' });
  });
});

describe('tutorial view', () => {
  it('points at the face to turn up and counts the group', () => {
    const s = tutorial();
    expect(tutorialView(s)).toEqual({
      value: 2,
      line: 'ii1',
      dir: 'W',
      path: ['W'],
      mark: { x: 4, z: 5, face: 'east' },
      group: [{ x: 2, z: 5, height: 1 }],
      counter: { have: 1, need: 2, x: 2, z: 5 },
    });
    play(s, 'W');
    const after = tutorialView(s)!;
    expect(after.line).toBe('ii2');
    expect(after.dir).toBeNull();
    expect(after.mark).toBeNull();
    expect(after.group.length).toBe(2);
    expect(after.counter).toMatchObject({ have: 2, need: 2 });
  });

  it('shows the whole path of a carry and the hidden face under a 1', () => {
    const s = tutorial();
    playMoves(s, AFTER_THREES);
    untilMove(s);
    expect(tutorialView(s)).toMatchObject({
      value: 4,
      line: 'iv1',
      path: ['E', 'E', 'N'],
      mark: { x: 3, z: 4, face: 'south' },
      counter: { have: 3, need: 4 },
    });
    play(s, 'E');
    play(s, 'E');
    expect(tutorialView(s)).toMatchObject({ line: 'iv2', path: ['N'], mark: { x: 5, z: 4, face: 'south' } });

    playMoves(s, 0);
    play(s, 'N');
    play(s, 'W');
    play(s, 'E');
    untilMove(s);
    expect(tutorialView(s)).toMatchObject({
      value: 6,
      line: 'vi2',
      path: ['W', 'W'],
      mark: { x: 5, z: 3, face: 'bottom' },
      counter: { have: 5, need: 6 },
    });
    play(s, 'W');
    expect(tutorialView(s)).toMatchObject({ mark: { x: 4, z: 3, face: 'east' } });
    play(s, 'W');
    untilMove(s);
    // The chain: the die to hop onto carries the 6 on its east face; the count is gone.
    expect(tutorialView(s)).toMatchObject({ line: 'vi3', path: ['S', 'W'], mark: { x: 3, z: 4, face: 'east' }, counter: null });
    play(s, 'S');
    play(s, 'W');
    untilMove(s);
    const ones = tutorialView(s)!;
    expect(ones).toMatchObject({ value: 1, line: 'i1', path: ['S', 'W'], counter: null });
    expect(ones.group.length).toBe(3);
  });
});
