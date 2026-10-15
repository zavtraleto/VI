import type { RunState } from '../rules';

/** Seconds left on the countdown of a full board, or null when it is not running. */
export function secondsLeft(state: RunState): number | null {
  if (state.fullTicks <= 0 || state.over) return null;
  const { config } = state;
  return Math.ceil(((config.rescueTicks - state.fullTicks) * config.tickMs) / 1000);
}
