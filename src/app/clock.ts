import type { RunState } from '../rules';

/** Whole seconds left in a live session, or null in other modes. */
export function clockLeft(state: RunState): number | null {
  if (state.mode !== 'live') return null;
  const { config } = state;
  return Math.max(0, Math.ceil(((config.liveTicks - state.tick) * config.tickMs) / 1000));
}

/** Whole seconds a session has run: what the clock of an Endless session reads, going forward. */
export function clockGone(state: RunState): number {
  return Math.floor((state.tick * state.config.tickMs) / 1000);
}

/** Seconds left on the countdown of a full board, or null when it is not running. */
export function secondsLeft(state: RunState): number | null {
  if (state.fullTicks <= 0 || state.over) return null;
  const { config } = state;
  return Math.ceil(((config.rescueTicks - state.fullTicks) * config.tickMs) / 1000);
}
