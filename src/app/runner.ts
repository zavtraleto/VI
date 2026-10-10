import { canAcceptCommand, step, type Dir, type RunState } from '../rules';

export interface LoggedCommand {
  tick: number;
  dir: Dir;
}

const MAX_FRAME_MS = 250;
/**
 * The most of a frame's time a board without a clock is given: two ticks, which is two frames of
 * a screen of 60 a second with room to spare, and one frame of a screen held to 30. A roll is ten
 * ticks, so it is never drawn in fewer than five pictures, however late a frame comes.
 */
const TURN_FRAME_MS = 40;

/**
 * The most time one frame may give the simulation. A session with a clock, the exercise and a
 * task take a late frame nearly whole, so that their time stays the time of the wall. A level,
 * and a piece of the road, has no clock and loses nothing when time stands still: a frame that
 * comes late there gives a small step, and what was moving goes on from where it was instead of
 * being played out between two pictures.
 */
export function frameBound(turnBased: boolean): number {
  return turnBased ? TURN_FRAME_MS : MAX_FRAME_MS;
}

/** Drives the simulation at its fixed tick from variable frame times. */
export class Runner {
  readonly log: LoggedCommand[] = [];
  private acc = 0;

  constructor(readonly state: RunState) {}

  /**
   * Advances by `dtMs` of real time. `take` is asked for a command only on ticks where
   * the player is free. Returns the fraction of the next tick, for interpolation.
   */
  advance(dtMs: number, take: () => Dir | null, onTick?: (state: RunState) => void): number {
    const { state } = this;
    const tickMs = state.config.tickMs;
    this.acc += Math.min(Math.max(dtMs, 0), MAX_FRAME_MS);
    while (this.acc >= tickMs && !state.over) {
      const cmd = canAcceptCommand(state) ? take() : null;
      const tick = state.tick;
      if (step(state, cmd) && cmd) this.log.push({ tick, dir: cmd });
      onTick?.(state);
      this.acc -= tickMs;
    }
    if (state.over) this.acc = 0;
    return this.acc / tickMs;
  }
}
