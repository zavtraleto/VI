import { RULES_VERSION, createRun, defaultConfig, type RunState } from '../rules';
import { tellBroken } from '../platform/storage';
import type { RunTally, TallyData } from './telemetry';

/** Where the run that was left unfinished is kept. */
export const RUN_KEY = 'vi.run.v1';

/**
 * The version of the form a run is kept in. It is raised whenever the form of `RunState` or of its
 * rules changes (the test of the form in savedRun.test.ts says when), so that a run kept by an
 * earlier build is let go and not read wrongly. 2: the run of a level and the live session took the
 * place of the tasks, the exercise and the session of the day (October 2026).
 */
export const KEPT_VERSION = 2;

/** The kind of run that is worth coming back to: the scored one. */
export type KeptKind = 'endless';

/**
 * A run as it stood when the page went away. The state of a run is plain data and the rules
 * are deterministic, so what is put back goes on exactly as it would have.
 */
export interface KeptRun {
  version: typeof KEPT_VERSION;
  kind: KeptKind;
  state: RunState;
  tally: TallyData;
}

/**
 * Packs the run in hand for keeping. Null when there is nothing to come back to: a run that
 * has not begun or is over, a level.
 */
export function packRun(kind: KeptKind, state: RunState, tally: RunTally): KeptRun | null {
  if (state.over || state.tick === 0) return null;
  if (state.mode !== 'endless') return null;
  // The events are those of the last tick alone: they have been heard already.
  return { version: KEPT_VERSION, kind, state: { ...state, events: [] }, tally: tally.keep() };
}

/** What a value is, as far as the form of a run goes. */
function kindOf(value: unknown): string {
  return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
}

const isObject = (value: unknown): value is Record<string, unknown> => kindOf(value) === 'object';

/** Every field the template has is there, and of the same kind. */
function sameForm(value: unknown, template: object): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  return Object.entries(template).every(([key, field]) => kindOf(value[key]) === kindOf(field));
}

/** The form of a run of Endless as this build makes one: what a kept run is held against. */
let template: RunState | null = null;

function isRun(state: unknown): state is RunState {
  template ??= createRun({ seed: 1, config: defaultConfig() });
  if (!sameForm(state, template)) return false;
  const { config, player, stats, wave } = template;
  const kept = state as unknown as RunState;
  if (!sameForm(kept.config, config) || !sameForm(kept.config.experiments, config.experiments)) return false;
  if (!sameForm(kept.player, player) || !sameForm(kept.stats, stats) || !sameForm(kept.wave, wave)) return false;
  if (kept.mode !== 'endless' || !kept.grid.every((cell) => typeof cell === 'number')) return false;
  if (!kept.cubes.every(isCube) || !kept.reactions.every(isObject) || !kept.pending.every(isObject)) return false;
  return kept.grid.length === kept.config.size * kept.config.size;
}

function isCube(cube: unknown): boolean {
  if (!isObject(cube) || !isObject(cube.ori) || typeof cube.state !== 'string') return false;
  return (['id', 'x', 'z', 't', 'reactionId'] as const).every((key) => typeof cube[key] === 'number');
}

/**
 * Reads what was kept. Null when it is not a run this build can go on with: made under other
 * rules, damaged, or of a kind of session the game has no more. A run kept with the day it was
 * started on, as runs were kept before, is read as it is.
 */
export function unpackRun(raw: unknown): KeptRun | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const kept = raw as Partial<KeptRun>;
  if (kept.version !== KEPT_VERSION || kept.kind !== 'endless') return null;
  // A run of other rules is let go as it is; one of these rules that is not a run is a broken save.
  const rules = (kept.state as { config?: { rulesVersion?: unknown } } | undefined)?.config?.rulesVersion;
  if (rules !== RULES_VERSION) return null;
  let whole = false;
  try {
    whole = isRun(kept.state) && isObject(kept.tally);
  } catch {
    whole = false;
  }
  if (!whole) {
    tellBroken();
    return null;
  }
  if (kept.state!.over) return null;
  return kept as KeptRun;
}
