import { RULES_VERSION, type RunState } from '../rules';
import type { RunTally, TallyData } from './telemetry';

/** Where the run that was left unfinished is kept. */
export const RUN_KEY = 'vi.run.v1';

/** The kind of run that is worth coming back to: the scored one. */
export type KeptKind = 'endless';

/**
 * A run as it stood when the page went away. The state of a run is plain data and the rules
 * are deterministic, so what is put back goes on exactly as it would have.
 */
export interface KeptRun {
  version: 1;
  kind: KeptKind;
  state: RunState;
  tally: TallyData;
}

/**
 * Packs the run in hand for keeping. Null when there is nothing to come back to: a run that
 * has not begun or is over, a task.
 */
export function packRun(kind: KeptKind, state: RunState, tally: RunTally): KeptRun | null {
  if (state.over || state.tick === 0) return null;
  if (state.mode !== 'endless') return null;
  // The events are those of the last tick alone: they have been heard already.
  return { version: 1, kind, state: { ...state, events: [] }, tally: tally.keep() };
}

function isRun(state: unknown): state is RunState {
  if (typeof state !== 'object' || state === null) return false;
  const { config, cubes, grid, player, stats, wave, tick, mode } = state as Partial<RunState>;
  if (!config || !Array.isArray(cubes) || !Array.isArray(grid) || !player || !stats || !wave) return false;
  if (typeof tick !== 'number' || mode !== 'endless') return false;
  return grid.length === config.size * config.size;
}

/**
 * Reads what was kept. Null when it is not a run this build can go on with: made under other
 * rules, damaged, or of a kind of session the game has no more. A run kept with the day it was
 * started on, as runs were kept before, is read as it is.
 */
export function unpackRun(raw: unknown): KeptRun | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const kept = raw as Partial<KeptRun>;
  if (kept.version !== 1 || kept.kind !== 'endless') return null;
  if (!isRun(kept.state) || kept.state.over || kept.state.config.rulesVersion !== RULES_VERSION) return null;
  if (!kept.tally) return null;
  return kept as KeptRun;
}
