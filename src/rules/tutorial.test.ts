import { describe, expect, it } from 'vitest';
import { cubeAt, cubeHeight } from './board';
import { defaultConfig } from './config';
import { createRun, step } from './sim';
import { run } from './testkit';
import {
  TUTORIAL_HOLD_HEIGHT,
  TUTORIAL_LESSONS,
  TUTORIAL_LINES,
  TUTORIAL_MOUNT_HEIGHT,
  TUTORIAL_MOVES,
  tutorialAck,
  tutorialDir,
  tutorialRestart,
  tutorialView,
  tutorialWaits,
} from './tutorial';
import { tutorialHint } from './tutorialHint';
import type { Dir, GameEvent, RunState, Tuning } from './types';

function tutorial(tuning: Partial<Tuning> = {}): RunState {
  return createRun({ seed: 3, config: defaultConfig({}, tuning), tutorial: true });
}

/** Runs until the tutorial shows a move to make, reading whatever it says on the way. */
function untilMove(s: RunState, limit = 3000): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < limit && tutorialDir(s) === null && !s.tutorial?.done; i++) {
    if (tutorialWaits(s)) tutorialAck(s);
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

/** Makes a move and lets the action finish. */
function act(s: RunState, dir: Dir): GameEvent[] {
  step(s, dir);
  const events = [...s.events];
  for (let i = 0; i < s.config.actionTicks; i++) {
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

/** Waits for the tutorial to show a move, checks it is the one expected and makes it. */
function play(s: RunState, dir: Dir): GameEvent[] {
  const events = untilMove(s);
  expect(tutorialDir(s)).toBe(dir);
  events.push(...act(s, dir));
  return events;
}

/** Plays the first `count` moves of the short way. */
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
  it('begins with the twos alone on the board and words to read', () => {
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
    expect(tutorialWaits(s)).toBe(true);
    expect(tutorialView(s)).toMatchObject({ line: 'roll', waits: true, dir: null, path: [] });
  });

  it('keeps its own pace whatever the variables say', () => {
    const a = tutorial();
    const b = tutorial({ sinkStartMs: 9000, riseMs: 5000, warnMs: 0, mountHeight: 0.2 });
    for (const key of ['sinkingTicks', 'risingTicks', 'warnTicks', 'mountHeight'] as const) {
      expect(b.config[key]).toBe(a.config[key]);
    }
  });

  it('keeps the rules its boards were laid for: no climbing from the floor, no steps on docks', () => {
    const s = tutorial();
    expect(defaultConfig().experiments).toMatchObject({ floorClimb: true, dockSteps: true });
    expect(s.config.experiments).toMatchObject({ floorClimb: false, dockSteps: false });
    // The session it leads to is given the config as it was: the lessons change a copy.
    const config = defaultConfig();
    createRun({ seed: 3, config, tutorial: true });
    expect(config.experiments).toMatchObject({ floorClimb: true, dockSteps: true });
  });

  it('has six lessons and says every line once', () => {
    expect(TUTORIAL_LESSONS).toBe(6);
    expect(new Set(TUTORIAL_LINES).size).toBe(TUTORIAL_LINES.length);
    expect(TUTORIAL_LINES[0]).toBe('roll');
    expect(TUTORIAL_LINES.at(-1)).toBe('end');
  });
});

describe('tutorial script', () => {
  it('walks through every lesson along the short way', () => {
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
    expect(s.tutorial?.off).toBeFalsy();

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

  it('ends once, after the closing lines have been read', () => {
    const s = tutorial();
    const events = playMoves(s, ALL);
    expect(events.some((e) => e.type === 'tutorialDone')).toBe(false);
    // The two closing lines wait for the player, however long that takes.
    run(s, 1000);
    expect(tutorialView(s)).toMatchObject({ line: 'alone', waits: true });
    tutorialAck(s);
    run(s, 1000);
    expect(tutorialView(s)).toMatchObject({ line: 'end', waits: true });
    expect(s.tutorial?.done).toBe(false);
    tutorialAck(s);
    expect(s.events.filter((e) => e.type === 'tutorialDone').length).toBe(1);
    expect(s.tutorial?.done).toBe(true);
    expect(tutorialView(s)).toBeNull();
    // Released: what was going down is gone and the player may move freely.
    run(s, s.config.sinkingTicks + 5);
    expect(s.cubes.some((c) => c.state === 'sinking')).toBe(false);
    step(s, 'E');
    expect(s.events).toContainEqual({ type: 'move', kind: 'roll', dir: 'E' });
  });
});

describe('tutorial without rails', () => {
  it('moves nothing while there are words to read, and goes on when they are read', () => {
    const s = tutorial();
    const player = { ...s.player };
    for (const dir of ['N', 'E', 'S', 'W'] as const) {
      step(s, dir);
      expect(s.events.some((e) => e.type === 'move' || e.type === 'blocked')).toBe(false);
    }
    expect(s.player).toEqual(player);
    tutorialAck(s);
    expect(tutorialWaits(s)).toBe(false);
    expect(tutorialView(s)).toMatchObject({ line: 'pair', waits: false, dir: 'W', path: ['W'] });
    // Reading is asked for once: a second "read" does nothing.
    const at = s.tutorial!.step;
    tutorialAck(s);
    expect(s.tutorial!.step).toBe(at);
  });

  it('lets the player step off the short way and finds the way from wherever they are', () => {
    const s = tutorial();
    untilMove(s);
    // Away from the other two: a move of the player's own, made as in a session.
    const events = act(s, 'N');
    expect(events).toContainEqual({ type: 'move', kind: 'roll', dir: 'N' });
    expect(s.player).toMatchObject({ x: 4, z: 4, level: 'top' });
    const view = tutorialView(s)!;
    expect(view).toMatchObject({ astray: true, dir: null, path: [], mark: null });

    const hint = tutorialHint(s)!;
    expect(hint.length).toBeGreaterThan(0);
    expect(hint.length).toBeLessThanOrEqual(4);
    const made: GameEvent[] = [];
    for (const dir of hint) made.push(...act(s, dir));
    expect(made.filter((e) => e.type === 'match').map((e) => (e.type === 'match' ? e.value : 0))).toEqual([2]);
    // The lesson goes on as if the short way had been kept.
    expect(tutorialView(s)).toMatchObject({ line: 'count', waits: true, astray: false });
  });

  it('finds a way for a player who went to another die', () => {
    const s = tutorial();
    playMoves(s, AFTER_TWOS);
    untilMove(s);
    // Threes: off the own die onto the one on the left, then back down the board with it.
    act(s, 'W');
    act(s, 'N');
    expect(tutorialView(s)!.astray).toBe(true);
    const hint = tutorialHint(s);
    expect(hint).not.toBeNull();
    const made: GameEvent[] = [];
    for (const dir of hint!) made.push(...act(s, dir));
    expect(made.some((e) => e.type === 'match' && e.value === 3)).toBe(true);
  });

  it('lays a lesson out again when asked to', () => {
    const s = tutorial();
    playMoves(s, AFTER_TWOS);
    untilMove(s);
    act(s, 'S');
    act(s, 'E');
    tutorialRestart(s);
    expect(s.cubes.length).toBe(0);
    expect(s.player).toMatchObject({ x: 3, z: 5, level: 'ground' });
    untilMove(s);
    expect(s.cubes.length).toBe(3);
    expect(s.player).toMatchObject({ x: 3, z: 5, level: 'top' });
    expect(tutorialView(s)).toMatchObject({ value: 3, line: 'three', dir: 'N', astray: false });
    // And it plays to its end from there.
    const events = TUTORIAL_MOVES.slice(AFTER_TWOS).flatMap((dir) => play(s, dir));
    expect(events.filter((e) => e.type === 'happyOne').length).toBe(1);
  });

  it('starts the ones over from the sixes: they lean on the group that is going down', () => {
    const s = tutorial();
    playMoves(s, ALL - 2);
    untilMove(s);
    expect(tutorialView(s)!.value).toBe(1);
    tutorialRestart(s);
    untilMove(s);
    expect(tutorialView(s)).toMatchObject({ value: 6, line: 'mount', dir: 'E' });
    expect(s.player).toMatchObject({ x: 4, z: 3, level: 'ground' });
  });
});

describe('tutorial view', () => {
  it('points at the face to turn up and counts the group', () => {
    const s = tutorial();
    tutorialAck(s);
    expect(tutorialView(s)).toEqual({
      value: 2,
      line: 'pair',
      dir: 'W',
      path: ['W'],
      mark: { x: 4, z: 5, face: 'east' },
      group: [{ x: 2, z: 5, height: 1 }],
      counter: { have: 1, need: 2, x: 2, z: 5 },
      waits: false,
      astray: false,
    });
    act(s, 'W');
    const after = tutorialView(s)!;
    expect(after.line).toBe('count');
    expect(after.waits).toBe(true);
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
      line: 'carry',
      path: ['E', 'E', 'N'],
      mark: { x: 3, z: 4, face: 'south' },
      counter: { have: 3, need: 4 },
    });
    play(s, 'E');
    play(s, 'E');
    expect(tutorialView(s)).toMatchObject({ line: 'carry', path: ['N'], mark: { x: 5, z: 4, face: 'south' } });

    play(s, 'N');
    play(s, 'W');
    play(s, 'E');
    untilMove(s);
    expect(tutorialView(s)).toMatchObject({
      value: 6,
      line: 'seven',
      path: ['W', 'W'],
      mark: { x: 5, z: 3, face: 'bottom' },
      counter: { have: 5, need: 6 },
    });
    play(s, 'W');
    expect(tutorialView(s)).toMatchObject({ mark: { x: 4, z: 3, face: 'east' } });
    play(s, 'W');
    untilMove(s);
    // The chain: the die to hop onto carries the 6 on its east face; the count is gone.
    expect(tutorialView(s)).toMatchObject({ line: 'chain', path: ['S', 'W'], mark: { x: 3, z: 4, face: 'east' }, counter: null });
    play(s, 'S');
    play(s, 'W');
    untilMove(s);
    const ones = tutorialView(s)!;
    expect(ones).toMatchObject({ value: 1, line: 'ones', path: ['S', 'W'], counter: null });
    expect(ones.group.length).toBe(3);
  });
});

describe('tutorial boards', () => {
  const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

  /** Every way of at most `moves` moves that ends the part of the lesson in hand, with the cell it leaves the player on. */
  function waysOut(s: RunState, moves: number): { way: Dir[]; x: number; z: number }[] {
    const from = s.tutorial!.step;
    const found: { way: Dir[]; x: number; z: number }[] = [];
    const walk = (state: RunState, way: Dir[]): void => {
      if (way.length === moves) return;
      for (const dir of DIRS) {
        const copy = structuredClone(state);
        step(copy, dir);
        if (!copy.player.action) continue;
        let done = copy.tutorial!.done || copy.tutorial!.step !== from;
        for (let i = 0; i <= copy.config.actionTicks + 1 && !done; i++) {
          step(copy, null);
          done = copy.tutorial!.done || copy.tutorial!.step !== from;
        }
        if (done) found.push({ way: [...way, dir], x: copy.player.x, z: copy.player.z });
        else walk(copy, [...way, dir]);
      }
    };
    walk(s, []);
    return found;
  }

  it('have no way to a group that is shorter than the one shown, or as short and ending elsewhere', () => {
    const s = tutorial();
    for (const dir of TUTORIAL_MOVES) {
      untilMove(s);
      const shown = tutorialView(s)!.path;
      expect(shown[0]).toBe(dir);
      const ways = waysOut(s, shown.length);
      expect(ways.map((found) => found.way.join(''))).toContain(shown.join(''));
      const end = ways.find((found) => found.way.join('') === shown.join(''))!;
      for (const found of ways) {
        expect(found.way.length, `${found.way.join('')} against ${shown.join('')}`).toBe(shown.length);
        expect({ x: found.x, z: found.z }, found.way.join('')).toEqual({ x: end.x, z: end.z });
      }
      act(s, dir);
    }
  });

  it('do not make the fours with the die tipped up at once', () => {
    const s = tutorial();
    playMoves(s, AFTER_THREES);
    untilMove(s);
    const events = act(s, 'N');
    expect(events.some((e) => e.type === 'match')).toBe(false);
    expect(tutorialView(s)).toMatchObject({ value: 4, astray: true });
    expect(tutorialHint(s)).not.toBeNull();
  });

  it('put a player found elsewhere on the floor onto the cell the lesson starts on', () => {
    const s = tutorial();
    playMoves(s, AFTER_FOURS);
    // The fours go down; the fives have not come yet.
    for (let i = 0; i < 3000 && s.cubes.length > 0; i++) step(s, null);
    expect(s.cubes.length).toBe(0);
    s.player = { x: 3, z: 3, level: 'ground' };
    untilMove(s);
    expect(s.player).toMatchObject({ x: 5, z: 3, level: 'ground' });
    // The five to push is right beside the player.
    expect(tutorialView(s)).toMatchObject({ value: 5, line: 'floor', dir: 'W', astray: false });
    expect(act(s, 'W').some((e) => e.type === 'match' && e.value === 5)).toBe(true);
  });

  it('show the way from where the player is when a part finds them off its start', () => {
    const s = tutorial();
    playMoves(s, AFTER_FIVES);
    untilMove(s);
    // Sixes: the die to step onto rises to the east; the player walks off the other way first.
    act(s, 'S');
    const view = tutorialView(s)!;
    expect(view).toMatchObject({ value: 6, astray: true, path: [] });
    expect(tutorialHint(s)).not.toBeNull();
  });
});
