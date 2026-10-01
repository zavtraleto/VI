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

export interface Settings {
  experiments: ExperimentConfig;
  controlMode: ControlMode;
  tutorialDone: boolean;
  hintsSeen: string[];
  muted: boolean;
  /** null follows the system preference. */
  reducedMotion: boolean | null;
  shake: boolean;
  /** Overrides of gameplay variables set in the debug panel. */
  tuning: Partial<Tuning>;
  /** Camera angles in degrees, set in the debug panel. */
  camera: { yaw: number; pitch: number };
  /** Shows the button that opens the debug panel. */
  debugPanel: boolean;
  /** Finished runs per rule key, newest last. */
  runs: Record<string, RunRecord[]>;
}

const KEY = 'vi.settings.v3';

/** Board turned towards the player a little from the classic diamond. */
export const DEFAULT_CAMERA = { yaw: 30, pitch: 38 } as const;
/** Earlier default, replaced on load unless the player had tuned the camera themselves. */
const OLD_CAMERA = { yaw: 25, pitch: 48 } as const;
const MAX_RUNS = 60;

export function loadSettings(): Settings {
  const fallback: Settings = {
    experiments: defaultExperiments(),
    controlMode: 'gesture',
    tutorialDone: false,
    hintsSeen: [],
    muted: false,
    reducedMotion: null,
    shake: true,
    tuning: {},
    camera: { ...DEFAULT_CAMERA },
    debugPanel: false,
    runs: {},
  };
  const loaded = loadJson(KEY, fallback);
  loaded.experiments = { ...defaultExperiments(), ...loaded.experiments };
  loaded.camera = { ...DEFAULT_CAMERA, ...loaded.camera };
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
