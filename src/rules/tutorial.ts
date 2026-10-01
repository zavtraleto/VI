import { applyMove } from './movement';
import { ALL_ORIENTATIONS } from './orientation';
import { addCube } from './spawn';
import type { Cube, Dir, Orientation, RunState } from './types';

/**
 * The five moves of the tutorial: a pair, a hop, a triple, a hop, a chain. Rolls go west,
 * where the camera shows the target cell from the side instead of hiding it behind the player.
 */
export const TUTORIAL_SCRIPT: readonly Dir[] = ['W', 'N', 'W', 'N', 'W'];

/** Sinking dice stop here while the tutorial runs, so the player sets the pace. */
export const TUTORIAL_HOLD_HEIGHT = 0.6;

function facing(faces: Partial<Orientation>): Orientation {
  const found = ALL_ORIENTATIONS.find((o) =>
    (Object.keys(faces) as (keyof Orientation)[]).every((k) => o[k] === faces[k]),
  );
  if (!found) throw new Error(`no orientation for ${JSON.stringify(faces)}`);
  return found;
}

/**
 * A staircase up and to the west. The face each rolled die turns up is its east one, which
 * the camera shows. The player starts on the first die.
 */
const LAYOUT: readonly { x: number; z: number; ori: Orientation }[] = [
  { x: 5, z: 4, ori: facing({ top: 1, east: 2 }) }, // A: west turns up its 2 beside B
  { x: 3, z: 4, ori: facing({ top: 2 }) }, // B
  { x: 4, z: 3, ori: facing({ top: 6, east: 3 }) }, // C: west turns up its 3 beside E1
  { x: 3, z: 2, ori: facing({ top: 5, east: 3 }) }, // D: west turns up its 3 beside the sinking E1
  { x: 2, z: 3, ori: facing({ top: 3 }) }, // E1
  { x: 1, z: 3, ori: facing({ top: 3 }) }, // E2
];

export function placeTutorialLayout(state: RunState): void {
  for (const { x, z, ori } of LAYOUT) addCube(state, x, z, ori);
  state.player.x = LAYOUT[0].x;
  state.player.z = LAYOUT[0].z;
}

/** The move the tutorial is waiting for; null once the script is finished or outside it. */
export function tutorialDir(state: RunState): Dir | null {
  const tutorial = state.tutorial;
  if (!tutorial || tutorial.step >= TUTORIAL_SCRIPT.length) return null;
  return TUTORIAL_SCRIPT[tutorial.step];
}

/** The tutorial runs on rails: only the scripted step is carried out. */
export function tutorialMove(state: RunState, dir: Dir): void {
  const tutorial = state.tutorial;
  const expected = tutorialDir(state);
  if (!tutorial || expected === null) return;
  if (dir !== expected) {
    state.events.push({ type: 'nudge', dir });
    return;
  }
  if (!applyMove(state, dir)) return;
  tutorial.step++;
  state.events.push({ type: 'tutorialStep', step: tutorial.step });
}

/** A sinking die that has reached the hold height and waits there. */
export function isHeld(state: RunState, cube: Cube): boolean {
  if (!state.tutorial || state.tutorial.done || cube.state !== 'sinking') return false;
  return cube.t >= Math.round(state.config.sinkingTicks * (1 - TUTORIAL_HOLD_HEIGHT));
}

/** Counts down from the last scripted move to the end of the tutorial. */
export function runTutorial(state: RunState): void {
  const tutorial = state.tutorial;
  if (!tutorial || tutorial.done || tutorial.step < TUTORIAL_SCRIPT.length) return;
  tutorial.timer++;
  if (tutorial.timer < state.config.tutorialEndTicks) return;
  tutorial.done = true;
  state.events.push({ type: 'tutorialDone' });
}
