import { RULES_VERSION, defaultExperiments, type ExperimentConfig, type Tuning } from '../rules';
import { loadJson, saveJson } from './storage';

export type ControlMode = 'gesture' | 'dpad';
/**
 * How the board is seen: `auto` follows the player where the whole board would be small on
 * the screen, `full` keeps the whole board in view everywhere.
 */
export type ViewSetting = 'auto' | 'full';

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

/** What a player did on one level, for the playtest report. */
export interface LevelStat {
  /** Starts of the level that got at least one move. */
  tries: number;
  passes: number;
  fails: number;
  /** The try the level was first passed on; null until then. */
  firstPassTry: number | null;
  /** Most moves the level has been passed with to spare. */
  bestLeft: number | null;
  /** Fewest moves the level has been passed in. */
  bestMoves: number | null;
  /** Moves taken back. */
  undos: number;
  /** Times the level came to a dead end. */
  stuck: number;
  /** How far short of the goal each failed try ended, the last 20 of them. */
  short: number[];
  /** Time spent playing the level, in milliseconds. */
  playMs: number;
}

export interface LevelProgress {
  /** Levels passed, by their code. */
  passed: Record<string, boolean>;
  stats: Record<string, LevelStat>;
  /**
   * The player's place on the road that leads to the levels: the code of the piece they are on,
   * which is the piece after the last they cleared. Absent for one who has cleared none; a code
   * that names no piece of the road is past its end (`roadPlace` in `src/levels/road.ts`).
   */
  road?: string;
}

export interface Settings {
  experiments: ExperimentConfig;
  /** The version of the rules the experiments were saved under; absent in what was saved before 0.8. */
  rulesVersion?: string;
  controlMode: ControlMode;
  tutorialDone: boolean;
  hintsSeen: string[];
  /** The long boot of the first start has been shown: later starts get the short one. */
  bootSeen: boolean;
  muted: boolean;
  /** null follows the system preference. */
  reducedMotion: boolean | null;
  shake: boolean;
  view: ViewSetting;
  /** The language the player has picked, as `src/ui/i18n.ts` names it; null follows the platform, then the browser. */
  language: string | null;
  /** Overrides of gameplay variables set in the debug panel. */
  tuning: Partial<Tuning>;
  /**
   * Camera angles in degrees, and how far swipes lean from plain up, right, down and left
   * towards the directions of the board on screen (0 to 1). Set in the debug panel.
   */
  camera: { yaw: number; pitch: number; swipeTilt: number };
  /** Shows the button that opens the debug panel. */
  debugPanel: boolean;
  /**
   * Finished runs, newest last: under `endless` and `timed` those played by the rules everyone
   * has, whatever their version; under a key of its own what was played by changed rules.
   */
  runs: Record<string, RunRecord[]>;
  puzzle: PuzzleProgress;
  levels: LevelProgress;
}

/** The one key everything the game keeps is under. */
export const SETTINGS_KEY = 'vi.settings.v3';
const KEY = SETTINGS_KEY;

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
    view: 'auto',
    language: null,
    tuning: {},
    camera: { ...DEFAULT_CAMERA },
    debugPanel: false,
    runs: {},
    puzzle: { stars: {}, stats: {}, rulesSeen: false },
    levels: { passed: {}, stats: {} },
  };
  const loaded = loadJson(KEY, fallback);
  loaded.experiments = { ...defaultExperiments(), ...loaded.experiments };
  // Climbing from the floor was an experiment before the rules of 0.8, and every save of that
  // time has it switched off. It is a rule now: such a save takes the default.
  if (loaded.rulesVersion === undefined) loaded.experiments.floorClimb = defaultExperiments().floorClimb;
  loaded.rulesVersion = RULES_VERSION;
  loaded.runs = joinRuns(loaded.runs);
  loaded.camera = { ...DEFAULT_CAMERA, ...loaded.camera };
  loaded.puzzle = { ...fallback.puzzle, ...loaded.puzzle };
  loaded.levels = { ...fallback.levels, ...loaded.levels };
  loaded.language ??= null;
  if (loaded.camera.yaw === OLD_CAMERA.yaw && loaded.camera.pitch === OLD_CAMERA.pitch) {
    loaded.camera = { ...DEFAULT_CAMERA };
  }
  return loaded;
}

/**
 * Runs used to be kept under the version of the rules they were played by (`endless:0.8-…`),
 * so the log and the best score started from nothing with every new version. They are kept by
 * kind of session now, and what was saved the old way is taken into the two logs.
 */
export function joinRuns(runs: Record<string, RunRecord[]>): Record<string, RunRecord[]> {
  const joined: Record<string, RunRecord[]> = {};
  let moved = false;
  for (const [key, list] of Object.entries(runs ?? {})) {
    if (!Array.isArray(list)) continue;
    const cut = key.indexOf(':');
    const mode = cut < 0 ? key : key.slice(0, cut);
    moved ||= cut >= 0;
    joined[mode] = [...(joined[mode] ?? []), ...list];
  }
  // Newest last, as a log is kept: the dates are written so that they sort as text.
  if (moved) for (const list of Object.values(joined)) list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return joined;
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

/** Failed tries of a level whose shortfall is kept. */
const MAX_SHORT = 20;

export function levelStat(settings: Settings, id: string): LevelStat {
  const stats = settings.levels.stats;
  stats[id] ??= { tries: 0, passes: 0, fails: 0, firstPassTry: null, bestLeft: null, bestMoves: null, undos: 0, stuck: 0, short: [], playMs: 0 };
  const stat = stats[id];
  // What was saved before these were counted has none of them.
  stat.undos ??= 0;
  stat.bestMoves ??= null;
  stat.stuck ??= 0;
  return stat;
}

/** Notes a failed try: how far short of the goal it ended. */
export function noteShort(stat: LevelStat, short: number): void {
  stat.short = [...stat.short, short].slice(-MAX_SHORT);
}

export type RecordMetric = 'score' | 'chain' | 'ticks';

export function topRuns(runs: readonly RunRecord[], metric: RecordMetric, count: number): RunRecord[] {
  return [...runs].sort((a, b) => b[metric] - a[metric] || b.score - a.score).slice(0, count);
}

export function bestOf(settings: Settings, key: string, metric: RecordMetric): number {
  return (settings.runs[key] ?? []).reduce((best, r) => Math.max(best, r[metric]), 0);
}

/** The best score among the sessions of one day, given as YYYY-MM-DD. */
export function bestOn(settings: Settings, key: string, date: string): number {
  return (settings.runs[key] ?? []).reduce((best, r) => (r.date === date ? Math.max(best, r.score) : best), 0);
}

export function prefersReducedMotion(settings: Settings): boolean {
  if (settings.reducedMotion !== null) return settings.reducedMotion;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
