import { DELTA, cubeAt } from './board';
import { msToTicks } from './config';
import { applyMove, resolveMove } from './movement';
import { ALL_ORIENTATIONS } from './orientation';
import { addCube, spawnCube } from './spawn';
import type { Cube, Dir, Orientation, RulesConfig, RunState } from './types';

/** Sinking dice stop here while a lesson still has moves to make, so the player sets the pace. */
export const TUTORIAL_HOLD_HEIGHT = 0.6;
/** A die the player has to step onto from the floor waits at this height. */
export const TUTORIAL_MOUNT_HEIGHT = 0.5;

/** Text shown for a step. The wording lives in the UI. */
export type TutorialLine =
  | 'ii1' | 'ii2'
  | 'iii1' | 'iii2'
  | 'iv1' | 'iv2' | 'iv3'
  | 'v1' | 'v2'
  | 'vi1' | 'vi2' | 'vi3' | 'vi4'
  | 'i1' | 'i2'
  | 'end';

/** A face of a die the player is asked to bring on top. `bottom` cannot be seen. */
export type MarkFace = 'east' | 'south' | 'bottom';

interface Die {
  x: number;
  z: number;
  ori: Orientation;
}

interface Mark {
  /** The die under the player, or the one the step leads onto. */
  at: 'own' | 'ahead';
  face: MarkFace;
}

type Step =
  /** New dice: `dice` rise at once, `announced` come with a lightning warning first. */
  | { do: 'spawn'; dice?: Die[]; announced?: Die[]; line?: TutorialLine }
  /** The one move the player may make. `mount` is a step from the floor onto a rising die. */
  | { do: 'move'; dir: Dir; mount?: boolean; mark?: Mark; line?: TutorialLine }
  /** A pause to read; `clear` also waits until the board is empty. */
  | { do: 'wait'; ms: number; clear?: boolean; line?: TutorialLine };

type Scripted = Step & {
  /** Face value the lesson is about. */
  value: number;
  /** Where the counter of the lesson's group is shown; null for a lesson without one. */
  anchor: { x: number; z: number } | null;
};

function facing(faces: Partial<Orientation>): Orientation {
  const found = ALL_ORIENTATIONS.find((o) =>
    (Object.keys(faces) as (keyof Orientation)[]).every((k) => o[k] === faces[k]),
  );
  if (!found) throw new Error(`no orientation for ${JSON.stringify(faces)}`);
  return found;
}

function die(x: number, z: number, faces: Partial<Orientation>): Die {
  return { x, z, ori: facing(faces) };
}

function lesson(value: number, anchor: Scripted['anchor'], steps: Step[]): Scripted[] {
  return steps.map((step) => ({ ...step, value, anchor }));
}

const OWN_EAST: Mark = { at: 'own', face: 'east' };
const OWN_SOUTH: Mark = { at: 'own', face: 'south' };

/**
 * One lesson per face value, each on a board of its own. A roll that completes a group goes
 * west or north, so the face it turns up is one the camera shows: the east or the south one.
 * Every lesson ends on the cell where the next one starts.
 */
const SCRIPT: readonly Scripted[] = [
  // Twos: a roll turns a side face up, and two 2s clear.
  ...lesson(2, { x: 2, z: 5 }, [
    { do: 'spawn', dice: [die(4, 5, { top: 1, east: 2 }), die(2, 5, { top: 2 })] },
    { do: 'move', dir: 'W', mark: OWN_EAST, line: 'ii1' },
    { do: 'wait', ms: 2200, clear: true, line: 'ii2' },
  ]),
  // Threes: it takes three, and the player's die goes in the middle. The two that wait stand
  // left and right of the gap, so the gap shows even with the player's die in front of it.
  ...lesson(3, { x: 3, z: 4 }, [
    { do: 'spawn', dice: [die(3, 5, { top: 5, south: 3 }), die(2, 4, { top: 3 }), die(4, 4, { top: 3 })] },
    { do: 'move', dir: 'N', mark: OWN_SOUTH, line: 'iii1' },
    { do: 'wait', ms: 3400, clear: true, line: 'iii2' },
  ]),
  // Fours: a square. The face rides on the side along a line, then is tipped up.
  ...lesson(4, { x: 4.5, z: 2.5 }, [
    {
      do: 'spawn',
      dice: [die(3, 4, { top: 6, south: 4 }), die(4, 2, { top: 4 }), die(5, 2, { top: 4 }), die(4, 3, { top: 4 })],
    },
    { do: 'move', dir: 'E', mark: OWN_SOUTH, line: 'iv1' },
    { do: 'move', dir: 'E', mark: OWN_SOUTH },
    { do: 'move', dir: 'N', mark: OWN_SOUTH, line: 'iv2' },
    { do: 'wait', ms: 3400, clear: true, line: 'iv3' },
  ]),
  // Fives: a cross. The player is on the floor and pushes the last arm in.
  ...lesson(5, { x: 2, z: 3 }, [
    {
      do: 'spawn',
      dice: [
        die(4, 3, { top: 5 }),
        die(2, 3, { top: 5 }),
        die(1, 3, { top: 5 }),
        die(2, 2, { top: 5 }),
        die(2, 4, { top: 5 }),
      ],
    },
    { do: 'move', dir: 'W', line: 'v1' },
    { do: 'wait', ms: 2600, clear: true, line: 'v2' },
  ]),
  // Sixes: stairs. Back up on a rising die, the 6 under the 1, then a chain.
  ...lesson(6, { x: 1, z: 3.5 }, [
    {
      do: 'spawn',
      dice: [
        die(1, 3, { top: 6 }),
        die(2, 3, { top: 6 }),
        die(0, 4, { top: 6 }),
        die(1, 4, { top: 6 }),
        die(0, 5, { top: 6 }),
      ],
      announced: [die(5, 3, { top: 1 })],
      line: 'vi1',
    },
    { do: 'move', dir: 'E', mount: true },
    { do: 'move', dir: 'W', mark: { at: 'own', face: 'bottom' }, line: 'vi2' },
    { do: 'move', dir: 'W', mark: OWN_EAST },
    { do: 'wait', ms: 900 },
    { do: 'spawn', announced: [die(3, 4, { top: 3, east: 6 })], line: 'vi3' },
    { do: 'move', dir: 'S', mark: { at: 'ahead', face: 'east' } },
    { do: 'move', dir: 'W', mark: OWN_EAST, line: 'vi4' },
    { do: 'wait', ms: 1400 },
  ]),
  // Ones: a 1 brought to the sinking dice takes every other 1 with it.
  ...lesson(1, null, [
    {
      do: 'spawn',
      announced: [die(2, 5, { top: 4, east: 1 }), die(4, 2, { top: 1 }), die(5, 3, { top: 1 }), die(4, 5, { top: 1 })],
      line: 'i1',
    },
    { do: 'move', dir: 'S', mark: { at: 'ahead', face: 'east' } },
    { do: 'move', dir: 'W', mark: OWN_EAST },
    { do: 'wait', ms: 2600, line: 'i2' },
    { do: 'wait', ms: 3600, line: 'end' },
  ]),
];

/** Every line the tutorial shows, in order of appearance. */
export const TUTORIAL_LINES: readonly TutorialLine[] = [
  ...new Set(SCRIPT.flatMap((step) => (step.line ? [step.line] : []))),
];

/** Moves of the whole tutorial, in order. */
export const TUTORIAL_MOVES: readonly Dir[] = SCRIPT.flatMap((step) => (step.do === 'move' ? [step.dir] : []));

/** The tutorial keeps its own pace: quick to clear a finished lesson, quick to bring the next. */
export function tutorialConfig(config: RulesConfig): RulesConfig {
  return {
    ...config,
    warnTicks: msToTicks(800),
    risingTicks: msToTicks(700),
    sinkingTicks: msToTicks(1400),
    mountHeight: 1,
  };
}

function current(state: RunState): Scripted | undefined {
  const tutorial = state.tutorial;
  return tutorial && !tutorial.done ? SCRIPT[tutorial.step] : undefined;
}

function advance(state: RunState): void {
  const tutorial = state.tutorial!;
  tutorial.step++;
  tutorial.timer = 0;
  if (tutorial.step < SCRIPT.length) {
    state.events.push({ type: 'tutorialStep', step: tutorial.step });
    return;
  }
  tutorial.done = true;
  state.events.push({ type: 'tutorialDone' });
}

/** The first lesson stands ready when the run begins. */
export function placeTutorialLayout(state: RunState): void {
  const first = SCRIPT[0];
  if (first.do !== 'spawn' || !first.dice) return;
  for (const { x, z, ori } of first.dice) addCube(state, x, z, ori);
  state.player.x = first.dice[0].x;
  state.player.z = first.dice[0].z;
  state.tutorial!.step = 1;
}

function settled(state: RunState): boolean {
  return state.pending.length === 0 && !state.cubes.some((c) => c.state === 'rising');
}

/** The move the tutorial is waiting for, once the board is ready for it; otherwise null. */
export function tutorialDir(state: RunState): Dir | null {
  const step = current(state);
  if (!step || step.do !== 'move') return null;
  const kind = resolveMove(state, step.dir).kind;
  if (step.mount) return kind === 'mount' ? step.dir : null;
  return settled(state) && kind !== 'blocked' ? step.dir : null;
}

/** The tutorial runs on rails: only the scripted step is carried out. */
export function tutorialMove(state: RunState, dir: Dir): void {
  const expected = tutorialDir(state);
  if (expected === null) return;
  if (dir !== expected) {
    state.events.push({ type: 'nudge', dir });
    return;
  }
  if (applyMove(state, dir)) advance(state);
}

/** A die the tutorial keeps waiting: a sinking one mid-lesson, or a rising one to step onto. */
export function isHeld(state: RunState, cube: Cube): boolean {
  const step = current(state);
  if (!step) return false;
  const { config } = state;
  if (cube.state === 'sinking') {
    if (step.do === 'wait' && step.clear) return false;
    return cube.t >= Math.round(config.sinkingTicks * (1 - TUTORIAL_HOLD_HEIGHT));
  }
  if (cube.state === 'rising' && step.do === 'move' && step.mount) {
    // Only the die the step leads onto waits; the rest of the lesson's dice come up as usual.
    const { player } = state;
    const ahead = cube.x === player.x + DELTA[step.dir].dx && cube.z === player.z + DELTA[step.dir].dz;
    return ahead && cube.t >= Math.round(config.risingTicks * TUTORIAL_MOUNT_HEIGHT);
  }
  return false;
}

/** Brings in dice and counts out pauses. Moves are advanced by `tutorialMove`. */
export function runTutorial(state: RunState): void {
  const tutorial = state.tutorial;
  const step = current(state);
  if (!tutorial || !step) return;
  if (step.do === 'spawn') {
    for (const { x, z, ori } of step.dice ?? []) spawnCube(state, x, z, ori);
    for (const { x, z, ori } of step.announced ?? []) {
      state.pending.push({ x, z, ori, t: 0 });
      state.events.push({ type: 'warned', x, z });
    }
    advance(state);
  } else if (step.do === 'wait') {
    tutorial.timer++;
    if (tutorial.timer < msToTicks(step.ms)) return;
    if (step.clear && state.cubes.length > 0) return;
    advance(state);
  }
}

/** What the tutorial wants shown at this moment. */
export interface TutorialView {
  /** Face value the lesson is about: 2 to 6, then 1. */
  value: number;
  line: TutorialLine;
  /** The move to make now, as `tutorialDir`. */
  dir: Dir | null;
  /** That move and the scripted moves that follow it directly. */
  path: Dir[];
  /** The face to bring on top, on the die it is on. */
  mark: { x: number; z: number; face: MarkFace } | null;
  /** Dice showing the lesson's value on top. */
  group: { x: number; z: number; height: number }[];
  /** How many dice of the group are in place, and where to show it. */
  counter: { have: number; need: number; x: number; z: number } | null;
}

function lineAt(index: number): TutorialLine {
  for (let i = index; i >= 0; i--) {
    const line = SCRIPT[i].line;
    if (line) return line;
  }
  return 'ii1';
}

export function tutorialView(state: RunState): TutorialView | null {
  const tutorial = state.tutorial;
  const step = current(state);
  if (!tutorial || !step) return null;
  const { player, config } = state;
  const { value, anchor } = step;

  const dir = tutorialDir(state);
  const path: Dir[] = [];
  if (dir !== null) {
    for (let i = tutorial.step; i < SCRIPT.length; i++) {
      const next = SCRIPT[i];
      if (next.do !== 'move') break;
      path.push(next.dir);
      // Stepping up changes the level: what follows is a path of its own.
      if (next.mount) break;
    }
  }

  let mark: TutorialView['mark'] = null;
  if (step.do === 'move' && step.mark && !player.action) {
    const ahead = step.mark.at === 'ahead';
    const x = player.x + (ahead ? DELTA[step.dir].dx : 0);
    const z = player.z + (ahead ? DELTA[step.dir].dz : 0);
    if (cubeAt(state, x, z)?.state === 'idle') mark = { x, z, face: step.mark.face };
  }

  const shown = state.cubes.filter((c) => c.ori.top === value && (c.state === 'idle' || c.state === 'sinking'));
  const group = shown.map((c) => ({
    x: c.x,
    z: c.z,
    height: c.state === 'sinking' ? Math.max(0, 1 - c.t / config.sinkingTicks) : 1,
  }));

  // Every lesson is one die short of its group until the player's move completes it. The
  // full count stays up for the pause after that, but not once a chain has added to the group.
  let counter: TutorialView['counter'] = null;
  if (anchor) {
    const sinking = shown.filter((c) => c.state === 'sinking').length;
    if (step.do === 'wait') {
      if (sinking === value) counter = { have: value, need: value, ...anchor };
    } else if (sinking === 0) {
      counter = { have: value - 1, need: value, ...anchor };
    }
  }

  return { value, line: lineAt(tutorial.step), dir, path, mark, group, counter };
}
