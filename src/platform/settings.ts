import { defaultExperiments, type ExperimentConfig, type Tuning } from '../rules';
import { loadJson, saveJson } from './storage';

export type ControlMode = 'gesture' | 'dpad';

/** One finished Endless run, kept for the local records register. */
export interface RunRecord {
  score: number;
  chain: number;
  ticks: number;
  /** Day the run ended, as YYYY-MM-DD. */
  date: string;
}

/** What a player did on one puzzle, for the playtest report. */
export interface PuzzleStat {
  /** Starts of the level that got at least one move, the first one included. */
  tries: number;
  undos: number;
  /** Groups that turned out to be dead ends. */
  dead: number;
  /** Time spent on the level until it was first cleared, in milliseconds. */
  playMs: number;
  /** Moves and seconds of the first clear; null until then. */
  firstMoves: number | null;
  firstSec: number | null;
  /** Fewest moves the level has been cleared in. */
  best: number | null;
}

export interface PuzzleProgress {
  /** Stars earned per level code. */
  stars: Record<string, number>;
  stats: Record<string, PuzzleStat>;
  /** The rules have been shown once. */
  rulesSeen: boolean;
}

export interface Settings {
  experiments: ExperimentConfig;
  controlMode: ControlMode;
  tutorialDone: boolean;
  hintsSeen: string[];
  /** The long boot of the first start has been shown: later starts get the short one. */
  bootSeen: boolean;
  muted: boolean;
  /** null follows the system preference. */
  reducedMotion: boolean | null;
  shake: boolean;
  /** Overrides of gameplay variables set in the debug panel. */
  tuning: Partial<Tuning>;
  /**
   * Camera angles in degrees, and how far swipes lean from plain up, right, down and left
   * towards the directions of the board on screen (0 to 1). Set in the debug panel.
   */
  camera: { yaw: number; pitch: number; swipeTilt: number };
  /** Shows the button that opens the debug panel. */
  debugPanel: boolean;
  /** Finished runs per rule key, newest last. */
  runs: Record<string, RunRecord[]>;
  puzzle: PuzzleProgress;
}

const KEY = 'vi.settings.v3';

/** Board turned towards the player a little from the classic diamond. */
export const DEFAULT_CAMERA = { yaw: 30, pitch: 38, swipeTilt: 0.5 } as const;
/** Earlier default, replaced on load unless the player had tuned the camera themselves. */
const OLD_CAMERA = { yaw: 25, pitch: 48 } as const;
const MAX_RUNS = 60;

export function loadSettings(): Settings {
  const fallback: Settings = {
    experiments: defaultExperiments(),
    controlMode: 'gesture',
    tutorialDone: false,
    hintsSeen: [],
    bootSeen: false,
    muted: false,
    reducedMotion: null,
    shake: true,
    tuning: {},
    camera: { ...DEFAULT_CAMERA },
    debugPanel: false,
    runs: {},
    puzzle: { stars: {}, stats: {}, rulesSeen: false },
  };
  const loaded = loadJson(KEY, fallback);
  loaded.experiments = { ...defaultExperiments(), ...loaded.experiments };
  loaded.camera = { ...DEFAULT_CAMERA, ...loaded.camera };
  loaded.puzzle = { ...fallback.puzzle, ...loaded.puzzle };
  if (loaded.camera.yaw === OLD_CAMERA.yaw && loaded.camera.pitch === OLD_CAMERA.pitch) {
    loaded.camera = { ...DEFAULT_CAMERA };
  }
  return loaded;
}

export function saveSettings(settings: Settings): boolean {
  return saveJson(KEY, settings);
}

export function addRun(settings: Settings, key: string, run: RunRecord): void {
  const list = settings.runs[key] ?? [];
  list.push(run);
  // Keep the newest runs plus anything that still holds a top place.
  if (list.length > MAX_RUNS) {
    const keep = new Set<RunRecord>(list.slice(-MAX_RUNS / 2));
    for (const metric of ['score', 'chain', 'ticks'] as const) {
      for (const r of topRuns(list, metric, 10)) keep.add(r);
    }
    settings.runs[key] = list.filter((r) => keep.has(r));
  } else {
    settings.runs[key] = list;
  }
}

export function puzzleStat(settings: Settings, id: string): PuzzleStat {
  const stats = settings.puzzle.stats;
  stats[id] ??= { tries: 0, undos: 0, dead: 0, playMs: 0, firstMoves: null, firstSec: null, best: null };
  return stats[id];
}

export type RecordMetric = 'score' | 'chain' | 'ticks';

export function topRuns(runs: readonly RunRecord[], metric: RecordMetric, count: number): RunRecord[] {
  return [...runs].sort((a, b) => b[metric] - a[metric] || b.score - a.score).slice(0, count);
}

export function bestOf(settings: Settings, key: string, metric: RecordMetric): number {
  return (settings.runs[key] ?? []).reduce((best, r) => Math.max(best, r[metric]), 0);
}

export function prefersReducedMotion(settings: Settings): boolean {
  if (settings.reducedMotion !== null) return settings.reducedMotion;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
