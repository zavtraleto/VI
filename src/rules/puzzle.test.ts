import { describe, expect, it } from 'vitest';
import { cubeAt, cubeHeight } from './board';
import { defaultConfig } from './config';
import { canAcceptCommand } from './movement';
import { PUZZLE_HOLD_HEIGHT } from './puzzle';
import { createRun, step } from './sim';
import { act, run, snapshot } from './testkit';
import type { GameEvent, PuzzleDie, PuzzleLayout, RunState } from './types';

function puzzle(size: number, dice: PuzzleDie[], start: { x: number; z: number }): RunState {
  const layout: PuzzleLayout = { size, dice, start };
  return createRun({ seed: 1, config: defaultConfig(), puzzle: layout });
}

/** Runs until the last move has landed and the player can be given a command again. */
function settle(s: RunState, limit = 400): GameEvent[] {
  const events: GameEvent[] = [];
  const busy = () => s.player.action !== undefined || s.cubes.some((c) => c.state === 'moving') || !canAcceptCommand(s);
  for (let i = 0; i < limit && !s.over && busy(); i++) {
    step(s, null);
    events.push(...s.events);
  }
  return events;
}

// A die with 1 on top and 2 on its east face: rolled west it shows the 2.
const ONE_EAST_TWO: Omit<PuzzleDie, 'x' | 'z'> = { top: 1, north: 4 };
const TWO: Omit<PuzzleDie, 'x' | 'z'> = { top: 2, north: 1 };
const THREE: Omit<PuzzleDie, 'x' | 'z'> = { top: 3, north: 1 };
const FIVE: Omit<PuzzleDie, 'x' | 'z'> = { top: 5, north: 1 };

describe('puzzle layout', () => {
  it('places the dice of the layout with the player on the start die and nothing coming', () => {
    const s = puzzle(4, [{ x: 2, z: 1, ...ONE_EAST_TWO }, { x: 0, z: 1, ...TWO }], { x: 2, z: 1 });
    expect(s.mode).toBe('puzzle');
    expect(s.config.size).toBe(4);
    expect(s.grid).toHaveLength(16);
    expect(s.cubes).toHaveLength(2);
    expect(cubeAt(s, 2, 1)?.ori).toMatchObject({ top: 1, north: 4, east: 2 });
    expect(s.player).toMatchObject({ x: 2, z: 1, level: 'top' });
    expect(s.puzzle).toEqual({ moves: 0, held: 0, dead: null });
    run(s, 2000);
    expect(s.cubes).toHaveLength(2);
    expect(s.pending).toHaveLength(0);
    expect(s.over).toBe(false);
  });

  it('leaves other runs without puzzle state', () => {
    expect(createRun({ seed: 1, config: defaultConfig() }).puzzle).toBeNull();
  });
});

describe('puzzle moves', () => {
  it('counts a roll as a move and a step onto another die as free', () => {
    const s = puzzle(4, [{ x: 1, z: 1, ...FIVE }, { x: 2, z: 1, ...THREE }, { x: 0, z: 3, ...TWO }], { x: 1, z: 1 });
    act(s, 'E');
    expect(s.player).toMatchObject({ x: 2, z: 1 });
    expect(s.puzzle!.moves).toBe(0);
    act(s, 'E');
    expect(s.player).toMatchObject({ x: 3, z: 1 });
    expect(s.puzzle!.moves).toBe(1);
  });

  it('does not let the player step down to the floor', () => {
    const s = puzzle(4, [{ x: 2, z: 1, ...ONE_EAST_TWO }, { x: 0, z: 1, ...TWO }, { x: 1, z: 2, ...FIVE }, { x: 3, z: 3, ...FIVE }], { x: 2, z: 1 });
    act(s, 'W');
    run(s, 100);
    const before = snapshot(s);
    act(s, 'N');
    expect(s.player.level).toBe('top');
    expect(snapshot(s)).toBe(before);
  });
});

describe('puzzle groups', () => {
  it('holds a finished group while the player stands on it', () => {
    const s = puzzle(4, [{ x: 2, z: 1, ...ONE_EAST_TWO }, { x: 0, z: 1, ...TWO }, { x: 1, z: 2, ...FIVE }, { x: 3, z: 3, ...FIVE }], { x: 2, z: 1 });
    act(s, 'W');
    run(s, 600);
    const own = cubeAt(s, 1, 1)!;
    expect(own.state).toBe('sinking');
    expect(cubeAt(s, 0, 1)!.state).toBe('sinking');
    expect(cubeHeight(own, s.config)).toBeCloseTo(PUZZLE_HOLD_HEIGHT, 1);
    expect(s.puzzle!.held).toBe(own.reactionId);
    expect(s.puzzle!.dead).toBeNull();
  });

  it('lets the player walk over the held group without releasing it', () => {
    const s = puzzle(4, [{ x: 2, z: 1, ...ONE_EAST_TWO }, { x: 0, z: 1, ...TWO }, { x: 1, z: 2, ...FIVE }, { x: 3, z: 3, ...FIVE }], { x: 2, z: 1 });
    act(s, 'W');
    settle(s);
    act(s, 'W');
    run(s, 300);
    expect(s.player).toMatchObject({ x: 0, z: 1, level: 'top' });
    expect(s.cubes).toHaveLength(4);
    expect(s.puzzle!.moves).toBe(1);
  });

  it('removes the group once the player has stepped off it, and takes no command until then', () => {
    const s = puzzle(4, [{ x: 2, z: 1, ...ONE_EAST_TWO }, { x: 0, z: 1, ...TWO }, { x: 1, z: 2, ...FIVE }, { x: 3, z: 3, ...FIVE }], { x: 2, z: 1 });
    act(s, 'W');
    settle(s);
    act(s, 'S');
    expect(s.player).toMatchObject({ x: 1, z: 2, level: 'top' });
    expect(s.puzzle!.held).toBe(0);
    expect(canAcceptCommand(s)).toBe(false);
    settle(s);
    expect(s.cubes.map((c) => c.ori.top)).toEqual([5, 5]);
    expect(cubeAt(s, 1, 1)).toBeUndefined();
    expect(s.puzzle!.moves).toBe(1);
    expect(s.over).toBe(false);
  });

  it('clears the board when the last group goes down with the player', () => {
    const s = puzzle(4, [{ x: 2, z: 1, ...ONE_EAST_TWO }, { x: 0, z: 1, ...TWO }], { x: 2, z: 1 });
    act(s, 'W');
    const events = settle(s);
    expect(s.cubes).toHaveLength(0);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('cleared');
    expect(events.filter((e) => e.type === 'cleared')).toHaveLength(1);
    expect(s.puzzle).toMatchObject({ moves: 1, dead: null });
  });

  it('does nothing with a ready group until a die is rolled into it', () => {
    const s = puzzle(4, [{ x: 0, z: 0, ...TWO }, { x: 1, z: 0, ...TWO }, { x: 3, z: 3, top: 6, north: 2 }], { x: 3, z: 3 });
    run(s, 300);
    expect(s.cubes.every((c) => c.state === 'idle')).toBe(true);
    act(s, 'W');
    run(s, 300);
    expect(s.cubes.every((c) => c.state === 'idle')).toBe(true);
  });

  it('never clears ones', () => {
    const s = puzzle(4, [{ x: 2, z: 1, top: 2, north: 3 }, { x: 0, z: 1, top: 1, north: 2 }, { x: 3, z: 3, ...FIVE }], { x: 2, z: 1 });
    // Rolled west this die shows its east face, the 1, next to another 1.
    expect(cubeAt(s, 2, 1)!.ori.east).toBe(1);
    act(s, 'W');
    run(s, 300);
    expect(cubeAt(s, 1, 1)!.ori.top).toBe(1);
    expect(s.cubes.every((c) => c.state === 'idle')).toBe(true);
  });
});

describe('puzzle dead ends', () => {
  it('reports a group the player cannot leave while dice remain', () => {
    const s = puzzle(5, [{ x: 2, z: 0, ...ONE_EAST_TWO }, { x: 0, z: 0, ...TWO }, { x: 3, z: 3, ...THREE }, { x: 4, z: 3, ...THREE }], { x: 2, z: 0 });
    const accepted = step(s, 'W');
    expect(accepted).toBe(true);
    const events = settle(s);
    expect(s.puzzle!.dead).toBe('noExit');
    expect(events).toContainEqual({ type: 'deadEnd', reason: 'noExit' });
    run(s, 600);
    // The group waits under the player: nothing is lost, the move can be taken back.
    expect(s.cubes).toHaveLength(4);
    expect(s.over).toBe(false);
  });

  it('reports a group that would leave a single die behind', () => {
    const s = puzzle(4, [{ x: 2, z: 1, ...ONE_EAST_TWO }, { x: 0, z: 1, ...TWO }, { x: 1, z: 2, ...FIVE }], { x: 2, z: 1 });
    act(s, 'W');
    settle(s);
    expect(s.puzzle!.dead).toBe('single');
    act(s, 'S');
    settle(s);
    expect(s.cubes).toHaveLength(1);
    expect(s.puzzle!.dead).toBe('single');
    expect(s.over).toBe(false);
  });
});
