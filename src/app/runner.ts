import { canAcceptCommand, step, type Dir, type RunState } from '../rules';

export interface LoggedCommand {
  tick: number;
  dir: Dir;
}

const MAX_FRAME_MS = 250;

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
