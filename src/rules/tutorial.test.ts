import { describe, expect, it } from 'vitest';
import { cubeAt, cubeHeight } from './board';
import { defaultConfig } from './config';
import { createRun, step } from './sim';
import { hasReadyGroup } from './spawn';
import { run, snapshot } from './testkit';
import { TUTORIAL_HOLD_HEIGHT, TUTORIAL_SCRIPT, tutorialDir } from './tutorial';
import type { Dir, GameEvent, RunState, Tuning } from './types';

function tutorial(tuning: Partial<Tuning> = {}): RunState {
  return createRun({ seed: 3, config: defaultConfig({}, tuning), tutorial: true });
}

function collect(s: RunState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

/** Issues a command, lets the action finish and returns everything that happened. */
function play(s: RunState, dir: Dir): GameEvent[] {
  step(s, dir);
  return [...s.events, ...collect(s, s.config.actionTicks)];
}

describe('tutorial layout', () => {
  it('sets up six dice with nothing ready to clear and no spawning', () => {
    const s = tutorial();
    expect(s.mode).toBe('practice');
    expect(s.spawnEnabled).toBe(false);
    expect(s.player).toMatchObject({ x: 5, z: 4, level: 'top' });
    for (const [x, z, top] of [[5, 4, 1], [3, 4, 2], [4, 3, 6], [3, 2, 5], [2, 3, 3], [1, 3, 3]]) {
      expect(cubeAt(s, x, z)?.ori.top).toBe(top);
    }
    expect(s.cubes.length).toBe(6);
    const tops = new Array<number>(49).fill(0);
    for (const c of s.cubes) tops[c.z * 7 + c.x] = c.ori.top;
    expect(hasReadyGroup(tops, 7)).toBe(false);
    run(s, 500);
    expect(s.cubes.length).toBe(6);
    expect(s.pending.length).toBe(0);
  });
});

describe('tutorial script', () => {
  it('teaches a pair, a triple and a chain in five moves', () => {
    const s = tutorial();
    expect(TUTORIAL_SCRIPT).toEqual(['W', 'N', 'W', 'N', 'W']);
    expect(play(s, 'W')).toContainEqual(expect.objectContaining({ type: 'match', value: 2, count: 2, points: 4 }));
    expect(play(s, 'N')).toContainEqual({ type: 'move', kind: 'hop', dir: 'N' });
    expect(play(s, 'W')).toContainEqual(expect.objectContaining({ type: 'match', value: 3, count: 3, points: 9 }));
    expect(play(s, 'N')).toContainEqual({ type: 'move', kind: 'hop', dir: 'N' });
    expect(play(s, 'W')).toContainEqual(
      expect.objectContaining({ type: 'chain', value: 3, chain: 2, count: 1, points: 24 }),
    );
    expect(s.score).toBe(37);
    expect(s.maxChain).toBe(2);
    expect(s.player).toMatchObject({ x: 2, z: 2, level: 'top' });
    expect(tutorialDir(s)).toBeNull();
  });

  it('reports each scripted move', () => {
    const s = tutorial();
    expect(tutorialDir(s)).toBe('W');
    expect(play(s, 'W')).toContainEqual({ type: 'tutorialStep', step: 1 });
    expect(tutorialDir(s)).toBe('N');
  });

  it('ignores a step off the script', () => {
    const s = tutorial();
    for (const dir of ['N', 'E', 'S'] as const) {
      const before = snapshot(s);
      step(s, dir);
      expect(s.events).toEqual([{ type: 'nudge', dir }]);
      expect(snapshot(s)).toBe(before);
    }
    expect(s.stats.blockedSteps).toBe(0);
    expect(s.stats.steps).toBe(0);
  });

  it('keeps sinking dice waiting for the player', () => {
    const s = tutorial();
    play(s, 'W');
    run(s, s.config.sinkingTicks * 3);
    expect(s.cubes.length).toBe(6);
    expect(s.player.level).toBe('top');
    expect(s.stats.falls).toBe(0);
    const own = cubeAt(s, 4, 4)!;
    expect(own.state).toBe('sinking');
    expect(cubeHeight(own, s.config)).toBeCloseTo(TUTORIAL_HOLD_HEIGHT);
    play(s, 'N');
    play(s, 'W');
    run(s, s.config.sinkingTicks * 3);
    play(s, 'N');
    expect(play(s, 'W')).toContainEqual(expect.objectContaining({ type: 'chain', chain: 2 }));
  });

  it('does not depend on the pace variables', () => {
    const s = tutorial({ sinkMs: 1000, stepMs: 400, lowHeight: 0.9 });
    for (const dir of TUTORIAL_SCRIPT) {
      play(s, dir);
      run(s, 200);
    }
    expect(s.score).toBe(37);
    expect(s.maxChain).toBe(2);
  });

  it('ends once, a moment after the last move, and takes no input meanwhile', () => {
    const s = tutorial();
    for (const dir of TUTORIAL_SCRIPT) play(s, dir);
    step(s, 'S');
    expect(s.events).toEqual([]);
    expect(s.player).toMatchObject({ x: 2, z: 2 });
    // The clock started with the fifth command: actionTicks + 2 ticks have passed.
    const quiet = collect(s, s.config.tutorialEndTicks - s.config.actionTicks - 3);
    expect(quiet.some((e) => e.type === 'tutorialDone')).toBe(false);
    const rest = collect(s, 50);
    expect(rest.filter((e) => e.type === 'tutorialDone').length).toBe(1);
    expect(s.tutorial?.done).toBe(true);
    // Released: every die was part of a clear, so the board empties under the player.
    run(s, s.config.sinkingTicks + 5);
    expect(s.cubes.length).toBe(0);
    expect(s.player.level).toBe('ground');
  });
});
