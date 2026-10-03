import { DELTA, cubeAt } from './board';
import { msToTicks } from './config';
import { applyMove } from './movement';
import { ALL_ORIENTATIONS } from './orientation';
import { addCube, spawnCube } from './spawn';
import type { Cube, Dir, Orientation, RulesConfig, RunState } from './types';

/** Sinking dice stop here while a lesson still has moves to make, so the player sets the pace. */
export const TUTORIAL_HOLD_HEIGHT = 0.6;
/** A die the player has to step onto from the floor waits at this height. */
export const TUTORIAL_MOUNT_HEIGHT = 0.5;

/** Text shown for a step. The wording lives in the UI. */
export type TutorialLine =
  | 'roll' | 'pair' | 'count'
  | 'three'
  | 'carry'
  | 'floor'
  | 'mount' | 'seven' | 'chain'
  | 'ones' | 'alone'
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

/** What a part of a lesson is over with. */
type Goal =
  /** A group of the lesson's value is made. */
  | { kind: 'match' }
  /** A die is added to a group on its way down. */
  | { kind: 'chain' }
  /** A 1 is brought to a group on its way down. */
  | { kind: 'ones' }
  /** The player stands on the die that rises on this cell. */
  | { kind: 'mount'; x: number; z: number };

type Step =
  /** New dice: `dice` rise at once, `announced` come with a lightning warning first. */
  | { do: 'spawn'; dice?: Die[]; announced?: Die[]; line?: TutorialLine }
  /**
   * The player moves freely until the goal is reached. `path` is the shortest way to it from
   * where the part begins, and `marks` the face each of its moves turns up: they are shown
   * for as long as the player keeps to that way.
   */
  | { do: 'goal'; goal: Goal; path: Dir[]; marks?: (Mark | null)[]; line?: TutorialLine }
  /** Words to read: the lesson goes on when the player says so. `clear` lets the dice go down meanwhile. */
  | { do: 'read'; line: TutorialLine; clear?: boolean }
  /** A pause without words; `clear` also waits until the board is empty. */
  | { do: 'wait'; ms: number; clear?: boolean };

type Scripted = Step & {
  /** Face value the lesson is about. */
  value: number;
  /** Where the counter of the lesson's group is shown; null for a lesson without one. */
  anchor: { x: number; z: number } | null;
  /** The cell the lesson finds the player on. */
  start: { x: number; z: number };
  /** The cell this part of the lesson finds the player on, when they have kept to the short way. */
  from: { x: number; z: number };
  /** The first part of its lesson. */
  opens: boolean;
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

function lesson(value: number, anchor: Scripted['anchor'], start: Scripted['start'], steps: Step[]): Scripted[] {
  let at = start;
  return steps.map((step, i) => {
    const from = at;
    if (step.do === 'goal') {
      for (const dir of step.path) at = { x: at.x + DELTA[dir].dx, z: at.z + DELTA[dir].dz };
    }
    return { ...step, value, anchor, start, from, opens: i === 0 };
  });
}

const OWN_EAST: Mark = { at: 'own', face: 'east' };
const OWN_SOUTH: Mark = { at: 'own', face: 'south' };
const MATCH: Goal = { kind: 'match' };

/**
 * One lesson per face value, each on a board of its own. Nothing is on rails: the player moves
 * as in a session, and a part of a lesson is over when what it is about has happened. Each
 * board is laid so that the short way to that is plain to see: a roll that completes a group
 * goes west or north, so the face it turns up is one the camera shows, the east or the south
 * one. No board has a shorter way to its group than the one the lesson is about: a group that
 * a single other roll would make teaches nothing and leaves the player on the wrong cell.
 * Every lesson ends on the cell where the next one starts; a player found elsewhere on the
 * floor when a lesson opens is put there, since its board is laid around that cell.
 */
const SCRIPT: readonly Scripted[] = [
  // Twos: a roll turns a side face up, and two 2s clear.
  ...lesson(2, { x: 2, z: 5 }, { x: 4, z: 5 }, [
    { do: 'spawn', dice: [die(4, 5, { top: 1, east: 2 }), die(2, 5, { top: 2 })] },
    { do: 'read', line: 'roll' },
    { do: 'goal', goal: MATCH, path: ['W'], marks: [OWN_EAST], line: 'pair' },
    { do: 'read', line: 'count', clear: true },
    { do: 'wait', ms: 0, clear: true },
  ]),
  // Threes: it takes three, and the player's die goes in the middle. The two that wait stand
  // left and right of the gap, so the gap shows even with the player's die in front of it.
  ...lesson(3, { x: 3, z: 4 }, { x: 3, z: 5 }, [
    { do: 'spawn', dice: [die(3, 5, { top: 5, south: 3 }), die(2, 4, { top: 3 }), die(4, 4, { top: 3 })] },
    { do: 'goal', goal: MATCH, path: ['N'], marks: [OWN_SOUTH], line: 'three' },
    { do: 'wait', ms: 600, clear: true },
  ]),
  // Fours: a square. The face rides on the side along a line, then is tipped up. The three
  // that wait stand clear of the row north of the start: tipping the die up at once, or one
  // cell too soon, lands it beside none of them.
  ...lesson(4, { x: 5.5, z: 2.5 }, { x: 3, z: 4 }, [
    {
      do: 'spawn',
      dice: [die(3, 4, { top: 6, south: 4 }), die(5, 2, { top: 4 }), die(6, 2, { top: 4 }), die(6, 3, { top: 4 })],
    },
    { do: 'goal', goal: MATCH, path: ['E', 'E', 'N'], marks: [OWN_SOUTH, OWN_SOUTH, OWN_SOUTH], line: 'carry' },
    { do: 'wait', ms: 600, clear: true },
  ]),
  // Fives: a cross. The player is on the floor and pushes the last arm in.
  ...lesson(5, { x: 2, z: 3 }, { x: 5, z: 3 }, [
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
    { do: 'goal', goal: MATCH, path: ['W'], line: 'floor' },
    { do: 'wait', ms: 600, clear: true },
  ]),
  // Sixes: stairs. Back up on a rising die, the 6 under the 1, then a chain.
  ...lesson(6, { x: 1, z: 3.5 }, { x: 4, z: 3 }, [
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
      line: 'mount',
    },
    { do: 'goal', goal: { kind: 'mount', x: 5, z: 3 }, path: ['E'] },
    { do: 'goal', goal: MATCH, path: ['W', 'W'], marks: [{ at: 'own', face: 'bottom' }, OWN_EAST], line: 'seven' },
    { do: 'wait', ms: 900 },
    { do: 'spawn', announced: [die(3, 4, { top: 3, east: 6 })], line: 'chain' },
    { do: 'goal', goal: { kind: 'chain' }, path: ['S', 'W'], marks: [{ at: 'ahead', face: 'east' }, OWN_EAST] },
    { do: 'wait', ms: 1400 },
  ]),
  // Ones: a 1 brought to the sinking dice takes every other 1 with it.
  ...lesson(1, null, { x: 2, z: 4 }, [
    {
      do: 'spawn',
      announced: [die(2, 5, { top: 4, east: 1 }), die(4, 2, { top: 1 }), die(5, 3, { top: 1 }), die(4, 5, { top: 1 })],
      line: 'ones',
    },
    { do: 'goal', goal: { kind: 'ones' }, path: ['S', 'W'], marks: [{ at: 'ahead', face: 'east' }, OWN_EAST] },
    { do: 'read', line: 'alone', clear: true },
    { do: 'read', line: 'end', clear: true },
  ]),
];

/** Every line the tutorial shows, in order of appearance. */
export const TUTORIAL_LINES: readonly TutorialLine[] = [
  ...new Set(SCRIPT.flatMap((step) => ('line' in step && step.line ? [step.line] : []))),
];

/** The short way through the whole tutorial: the moves of every part, in order. */
export const TUTORIAL_MOVES: readonly Dir[] = SCRIPT.flatMap((step) => (step.do === 'goal' ? step.path : []));

/** How many lessons there are. */
export const TUTORIAL_LESSONS = new Set(SCRIPT.map((step) => step.value)).size;

/**
 * The tutorial keeps its own pace: quick to clear a finished lesson, quick to bring the next.
 * It keeps the rules its boards were laid for as well: the ways a session has between the
 * floor and the dice, climbing what cannot be pushed and the steps of the docks, would be
 * short cuts through the lessons.
 */
export function tutorialConfig(config: RulesConfig): RulesConfig {
  return {
    ...config,
    warnTicks: msToTicks(800),
    risingTicks: msToTicks(700),
    sinkingTicks: msToTicks(1400),
    mountHeight: 1,
    experiments: { ...config.experiments, floorClimb: false, dockSteps: false },
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
  tutorial.along = 0;
  tutorial.off = false;
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
  state.player.x = first.start.x;
  state.player.z = first.start.z;
  state.tutorial!.step = 1;
}

function settled(state: RunState): boolean {
  return state.pending.length === 0 && !state.cubes.some((c) => c.state === 'rising');
}

/** The board is ready for the moves of the part in hand. A die to step onto is waited for half-risen. */
function ready(state: RunState, step: Scripted): boolean {
  if (step.do !== 'goal') return false;
  if (step.goal.kind === 'mount') return cubeAt(state, step.goal.x, step.goal.z)?.state === 'rising' || state.player.level === 'top';
  return settled(state);
}

/** The player stands where the short way has brought them so far, or is on the move along it. */
function onWay(state: RunState, step: Scripted): boolean {
  const tutorial = state.tutorial!;
  if (step.do !== 'goal' || tutorial.off) return false;
  const { player } = state;
  if (player.action) return true;
  let { x, z } = step.from;
  for (const dir of step.path.slice(0, tutorial.along ?? 0)) {
    x += DELTA[dir].dx;
    z += DELTA[dir].dz;
  }
  return player.x === x && player.z === z;
}

/** The scripted moves still ahead of a player who has kept to the short way; none once they have left it. */
function ahead(state: RunState, step: Scripted): Dir[] {
  const tutorial = state.tutorial!;
  if (step.do !== 'goal' || !onWay(state, step) || !ready(state, step)) return [];
  return step.path.slice(tutorial.along ?? 0);
}

/** The next move of the short way, once the board is ready for it; null when there is none to show. */
export function tutorialDir(state: RunState): Dir | null {
  const step = current(state);
  return step ? (ahead(state, step)[0] ?? null) : null;
}

/** The tutorial is waiting for the player to say they have read its words. */
export function tutorialWaits(state: RunState): boolean {
  return current(state)?.do === 'read';
}

/** The player has read the words on screen: the lesson goes on. */
export function tutorialAck(state: RunState): void {
  if (current(state)?.do === 'read') advance(state);
}

/**
 * A move of the player. While a part of a lesson is being played any move is made, as in a
 * session; the tutorial only notes whether it kept to the short way. While there are words to
 * read, or dice still coming up, nothing moves.
 */
export function tutorialMove(state: RunState, dir: Dir): void {
  const step = current(state);
  const tutorial = state.tutorial;
  if (!tutorial || !step || step.do !== 'goal' || !ready(state, step)) return;
  if (!applyMove(state, dir)) return;
  const along = tutorial.along ?? 0;
  if (!tutorial.off && step.path[along] === dir) tutorial.along = along + 1;
  else tutorial.off = true;
}

/** A die the tutorial keeps waiting: a sinking one mid-lesson, or a rising one to step onto. */
export function isHeld(state: RunState, cube: Cube): boolean {
  const step = current(state);
  if (!step) return false;
  const { config } = state;
  if (cube.state === 'sinking') {
    if ((step.do === 'wait' || step.do === 'read') && step.clear) return false;
    return cube.t >= Math.round(config.sinkingTicks * (1 - TUTORIAL_HOLD_HEIGHT));
  }
  if (cube.state === 'rising' && step.do === 'goal' && step.goal.kind === 'mount') {
    // Only the die to step onto waits; the rest of the lesson's dice come up as usual.
    const there = cube.x === step.goal.x && cube.z === step.goal.z;
    return there && cube.t >= Math.round(config.risingTicks * TUTORIAL_MOUNT_HEIGHT);
  }
  return false;
}

/** What a part of a lesson is about has happened on this tick. */
function reached(state: RunState, step: Scripted, goal: Goal): boolean {
  switch (goal.kind) {
    case 'match':
      return state.events.some((e) => e.type === 'match' && e.value === step.value);
    case 'chain':
      return state.events.some((e) => e.type === 'chain');
    case 'ones':
      return state.events.some((e) => e.type === 'happyOne');
    case 'mount': {
      const { player } = state;
      return player.level === 'top' && !player.action && player.x === goal.x && player.z === goal.z;
    }
  }
}

/** Brings in dice, counts out pauses and sees when a part of a lesson is done. */
export function runTutorial(state: RunState): void {
  const tutorial = state.tutorial;
  const step = current(state);
  if (!tutorial || !step) return;
  if (step.do === 'spawn') {
    // The board of a lesson is laid around the cell it starts on. A player who ended the last
    // lesson elsewhere, and is on the floor, is put there.
    const { player } = state;
    if (step.opens && player.level === 'ground' && !player.action && !cubeAt(state, step.start.x, step.start.z)) {
      player.x = step.start.x;
      player.z = step.start.z;
    }
    for (const { x, z, ori } of step.dice ?? []) spawnCube(state, x, z, ori);
    for (const { x, z, ori } of step.announced ?? []) {
      state.pending.push({ x, z, ori, t: 0 });
      state.events.push({ type: 'warned', x, z });
    }
    advance(state);
  } else if (step.do === 'goal') {
    if (reached(state, step, step.goal)) advance(state);
  } else if (step.do === 'wait') {
    tutorial.timer++;
    if (tutorial.timer < msToTicks(step.ms)) return;
    if (step.clear && state.cubes.length > 0) return;
    advance(state);
  }
}

/**
 * Lays the lesson in hand out again from its start: for a player who has moved its dice to
 * where the lesson cannot be finished. The ones lean on the group of sixes still going down,
 * so they start over from the sixes.
 */
export function tutorialRestart(state: RunState): void {
  const tutorial = state.tutorial;
  const step = current(state);
  if (!tutorial || !step) return;
  const value = step.value === 1 ? 6 : step.value;
  const first = SCRIPT.findIndex((candidate) => candidate.value === value);
  const { start } = SCRIPT[first];
  state.cubes = [];
  state.grid.fill(0);
  state.pending = [];
  state.reactions = [];
  state.player = { x: start.x, z: start.z, level: 'ground' };
  tutorial.step = first;
  tutorial.timer = 0;
  tutorial.along = 0;
  tutorial.off = false;
  state.events.push({ type: 'tutorialStep', step: first });
}

/** What the tutorial wants shown at this moment. */
export interface TutorialView {
  /** Face value the lesson is about: 2 to 6, then 1. */
  value: number;
  line: TutorialLine;
  /** The move to make now, as `tutorialDir`. */
  dir: Dir | null;
  /** That move and the moves of the short way that follow it. Empty once the player has left that way. */
  path: Dir[];
  /** The face to bring on top, on the die it is on. */
  mark: { x: number; z: number; face: MarkFace } | null;
  /** Dice showing the lesson's value on top. */
  group: { x: number; z: number; height: number }[];
  /** How many dice of the group are in place, and where to show it. */
  counter: { have: number; need: number; x: number; z: number } | null;
  /** The words wait to be read: the lesson goes on when the player says so. */
  waits: boolean;
  /**
   * A part is being played and the player has left its short way: whoever shows the way has
   * to find one from here (`tutorialHint`).
   */
  astray: boolean;
}

function lineAt(index: number): TutorialLine {
  for (let i = index; i >= 0; i--) {
    const step = SCRIPT[i];
    if ('line' in step && step.line) return step.line;
  }
  return 'roll';
}

export function tutorialView(state: RunState): TutorialView | null {
  const tutorial = state.tutorial;
  const step = current(state);
  if (!tutorial || !step) return null;
  const { player, config } = state;
  const { value, anchor } = step;

  const path = ahead(state, step);
  const dir = path[0] ?? null;

  let mark: TutorialView['mark'] = null;
  const wanted = step.do === 'goal' && dir !== null ? step.marks?.[tutorial.along ?? 0] : null;
  if (wanted && dir !== null && !player.action) {
    const onward = wanted.at === 'ahead';
    const x = player.x + (onward ? DELTA[dir].dx : 0);
    const z = player.z + (onward ? DELTA[dir].dz : 0);
    if (cubeAt(state, x, z)?.state === 'idle') mark = { x, z, face: wanted.face };
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
    if (step.do === 'wait' || step.do === 'read') {
      if (sinking === value) counter = { have: value, need: value, ...anchor };
    } else if (sinking === 0) {
      counter = { have: Math.min(value - 1, shown.length), need: value, ...anchor };
    }
  }

  return {
    value,
    line: lineAt(tutorial.step),
    dir,
    path,
    mark,
    group,
    counter,
    waits: step.do === 'read',
    astray: step.do === 'goal' && !onWay(state, step) && ready(state, step),
  };
}
