import { fileBoard } from '../levels/boardFiles';
import { createRun, defaultConfig, step, type Dir, type GameEvent, type RunState } from '../rules';
import type { LevelSpec } from '../rules/types';

/**
 * The scenes of the leaving of a group that the board lab plays (`?lab=board`, folder «Уход»): a
 * small level laid for each, and the moves that bring it about, played by the rules themselves
 * a tick at a time. The lab draws them with the real view, so that what is tuned there is what
 * the game shows.
 */

/** A move of the figure, or a wait with the board standing, in milliseconds. */
type Beat = { move: Dir } | { wait: number };

const move = (dir: Dir): Beat => ({ move: dir });
const wait = (ms: number): Beat => ({ wait: ms });

/** The lab draws a board seven cells a side. */
const SIZE = 7;
/** The die of the figure: a roll north brings its 2 up. */
const OWN = { x: 3, z: 4, top: 4, north: 5 };
/** The 2 it rolls up to, and the die beside the pair that a roll north brings to it. */
const PARTNER = { x: 3, z: 2, top: 2, north: 1 };
const THIRD = { x: 4, z: 3, top: 4, north: 5 };
/** A die that stands far from them: with it the world of the level stands between moves. */
const SPARE = { x: 0, z: 6, top: 4, north: 5 };

const SCENES = {
  /** A group is made: the answer of the board, and the group coming down to its first step. */
  pair: { dice: [OWN, PARTNER, THIRD, SPARE], clear: false, beats: [wait(600), move('N'), wait(1400)] },
  /** A pair made, and six rolls of the die beside it: step by step into the floor, and the ring. */
  steps: {
    dice: [OWN, PARTNER, THIRD, SPARE],
    clear: false,
    beats: [wait(400), move('N'), wait(700), move('E'), wait(250), move('E'), wait(450), move('W'), wait(450), move('E'), wait(450), move('W'), wait(450), move('E'), wait(450), move('W'), wait(1200)],
  },
  /** A pair made, and a third die brought to it: the chain is added to. */
  join: { dice: [OWN, PARTNER, THIRD, SPARE], clear: false, beats: [wait(400), move('N'), wait(900), move('E'), wait(350), move('N'), wait(1500)] },
  /** A board cleared by one combo of four: the last combo of a board. */
  finale: {
    dice: [OWN, PARTNER, { x: 2, z: 3, top: 2, north: 1 }, { x: 4, z: 3, top: 2, north: 1 }],
    clear: true,
    beats: [wait(600), move('N'), wait(2200)],
  },
} satisfies Record<string, { dice: { x: number; z: number; top: number; north: number }[]; clear: boolean; beats: Beat[] }>;

export type LeavingScene = keyof typeof SCENES;

/** The scenes by name, with what the panel calls them. */
export const LEAVING_SCENES: Record<LeavingScene, string> = {
  pair: 'Сыграть: группа собрана',
  steps: 'Сыграть: ступени до пола',
  join: 'Сыграть: присоединение',
  finale: 'Сыграть: финал доски',
};

/** The level a scene is played on: only 2s work on it, its dice go in six moves, and but for the finale it is never passed. */
export function leavingSceneState(scene: LeavingScene): RunState {
  const { dice, clear } = SCENES[scene];
  // The lesson of the way down and up, a board in spare of the road since the prologue of 14 October 2026: its rules are those of the game.
  const base = fileBoard('R10');
  const spec: LevelSpec = {
    ...base,
    id: `LAB-${scene}`,
    seed: 1,
    size: SIZE,
    holes: undefined,
    values: [2],
    faces: [2],
    norm: dice.length,
    floor: true,
    goal: clear ? { kind: 'clear' } : { kind: 'send', count: 999 },
    moves: 0,
    sinkMoves: 6,
    par: undefined,
    solution: undefined,
    layout: { start: { x: OWN.x, z: OWN.z }, dice },
  };
  return createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
}

/** A scene being played: the rules are stepped a tick at a time, and the moves of the scene given to them as they are taken. */
export class SceneRun {
  private at = 0;
  /** Ticks left of the wait that is on. */
  private waiting: number;

  constructor(
    readonly scene: LeavingScene,
    readonly state: RunState,
  ) {
    this.waiting = this.ticksOf(0);
  }

  /** The scene has been played to its end. */
  get done(): boolean {
    return this.at >= SCENES[this.scene].beats.length;
  }

  /** One tick of the rules; returns what they said on it. */
  tick(): readonly GameEvent[] {
    const beat = SCENES[this.scene].beats[this.at];
    if (!beat) {
      step(this.state, null);
    } else if ('wait' in beat) {
      step(this.state, null);
      if (--this.waiting <= 0) this.next();
    } else if (step(this.state, beat.move)) {
      this.next();
    }
    return this.state.events;
  }

  private next(): void {
    this.at++;
    this.waiting = this.ticksOf(this.at);
  }

  private ticksOf(at: number): number {
    const beat = SCENES[this.scene].beats[at];
    return beat && 'wait' in beat ? Math.max(1, Math.round(beat.wait / this.state.config.tickMs)) : 0;
  }
}
