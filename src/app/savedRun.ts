import { RULES_VERSION, type RunState } from '../rules';
import type { RunTally, TallyData } from './telemetry';

/** Where the run that was left unfinished is kept. */
export const RUN_KEY = 'vi.run.v1';

/** The kinds of run that are worth coming back to: the scored ones. */
export type KeptKind = 'endless' | 'timed';

/**
 * A run as it stood when the page went away. The state of a run is plain data and the rules
 * are deterministic, so what is put back goes on exactly as it would have.
 */
export interface KeptRun {
  version: 1;
  kind: KeptKind;
  /** The day the run was started on, as YYYY-MM-DD: the session of the day belongs to its day. */
  day: string;
  state: RunState;
  tally: TallyData;
}

/**
 * Packs the run in hand for keeping. Null when there is nothing to come back to: a run that
 * has not begun or is over, the exercise, a task.
 */
export function packRun(kind: KeptKind, day: string, state: RunState, tally: RunTally): KeptRun | null {
  if (state.over || state.tick === 0) return null;
  if (state.mode !== 'endless' && state.mode !== 'timed') return null;
  // The events are those of the last tick alone: they have been heard already.
  return { version: 1, kind, day, state: { ...state, events: [] }, tally: tally.keep() };
}

function isRun(state: unknown): state is RunState {
  if (typeof state !== 'object' || state === null) return false;
  const { config, cubes, grid, player, stats, wave, tick, mode } = state as Partial<RunState>;
  if (!config || !Array.isArray(cubes) || !Array.isArray(grid) || !player || !stats || !wave) return false;
  if (typeof tick !== 'number' || (mode !== 'endless' && mode !== 'timed')) return false;
  return grid.length === config.size * config.size;
}

/**
 * Reads what was kept. Null when it is not a run this build can go on with: made under other
 * rules, damaged, or a session of the day from a day that has passed.
 */
export function unpackRun(raw: unknown, today: string): KeptRun | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const kept = raw as Partial<KeptRun>;
  if (kept.version !== 1 || (kept.kind !== 'endless' && kept.kind !== 'timed')) return null;
  if (!isRun(kept.state) || kept.state.over || kept.state.config.rulesVersion !== RULES_VERSION) return null;
  if ((kept.state.mode === 'timed') !== (kept.kind === 'timed')) return null;
  if (kept.kind === 'timed' && kept.day !== today) return null;
  if (typeof kept.day !== 'string' || !kept.tally) return null;
  return kept as KeptRun;
}
