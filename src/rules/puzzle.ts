import { cubeAt } from './board';
import { msToTicks } from './config';
import { ALL_ORIENTATIONS } from './orientation';
import { addCube } from './spawn';
import type { Cube, PuzzleLayout, RulesConfig, RunState } from './types';

/** A finished group stops here and waits for the player to leave it. */
export const PUZZLE_HOLD_HEIGHT = 0.6;

/**
 * A puzzle has a board of its own size and no pace to keep: a group left behind goes quickly.
 * Nothing is rolled over, so the group that waits under the player stays solid.
 */
export function puzzleConfig(config: RulesConfig, layout: PuzzleLayout): RulesConfig {
  return {
    ...config,
    size: layout.size,
    startX: layout.start.x,
    startZ: layout.start.z,
    sinkingTicks: msToTicks(700),
    sinkLowHeight: Math.min(config.sinkLowHeight, PUZZLE_HOLD_HEIGHT - 0.1),
  };
}

export function placePuzzleLayout(state: RunState, layout: PuzzleLayout): void {
  for (const { x, z, top, north } of layout.dice) {
    const ori = ALL_ORIENTATIONS.find((o) => o.top === top && o.north === north);
    if (!ori) throw new Error(`no die shows ${top} on top and ${north} to the north`);
    addCube(state, x, z, ori);
  }
  state.player.x = layout.start.x;
  state.player.z = layout.start.z;
}

/** A die of the group under the player, once it has sunk to where it waits. */
export function isPuzzleHeld(state: RunState, cube: Cube): boolean {
  const puzzle = state.puzzle;
  if (!puzzle || puzzle.held === 0 || cube.state !== 'sinking' || cube.reactionId !== puzzle.held) return false;
  return cube.t >= Math.round(state.config.sinkingTicks * (1 - PUZZLE_HOLD_HEIGHT));
}

/** Dice are on their way out: the board is not what the next move would be made on yet. */
export function puzzleBusy(state: RunState): boolean {
  const puzzle = state.puzzle;
  if (!puzzle) return false;
  return state.cubes.some((c) => c.state === 'sinking' && c.reactionId !== puzzle.held);
}

/** Lets go of the group the player has left, and ends the run when the board is empty. */
export function runPuzzle(state: RunState): void {
  const puzzle = state.puzzle;
  if (!puzzle || state.over) return;
  if (puzzle.held !== 0) {
    const { player } = state;
    const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
    if (own?.reactionId !== puzzle.held) puzzle.held = 0;
  }
  if (state.cubes.length === 0) {
    state.over = true;
    state.endReason = 'cleared';
    state.events.push({ type: 'cleared' });
  }
}
