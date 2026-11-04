import type { PlatformData } from '../platform/platform';

/**
 * What the analytics are told of a player who leaves: the page hidden (`page_hidden`), and a run
 * left for the menu or started anew (`progression_failed` with `left` or `restart`). Pure: the game
 * hands in how it stands.
 */

/** How the game stands as the page is hidden. */
export interface HiddenAt {
  /** `menu`, or what is played: `endless`, `live`, `level`. */
  where: string;
  visitSec: number;
  /** In the menu, the number in the row of the place in hand; null where there is none. */
  place: number | null;
  /** What is played, as the analytics name it (`step_id`, `step_index`). */
  step: PlatformData;
  runSec: number;
  over: boolean;
  paused: boolean;
  /** A level: its moves and the moves taken back; null for a session. */
  level: { moves: number; undos: number } | null;
  score: number;
  adOpen: boolean;
  ads: number;
}

/** The fields of `page_hidden`. */
export function hiddenData(at: HiddenAt): PlatformData {
  const ad = { ad_open: at.adOpen, ads: at.ads };
  if (at.where === 'menu') return { where: at.where, visit_sec: at.visitSec, ...(at.place === null ? {} : { step_index: at.place }), ...ad };
  return {
    where: at.where,
    visit_sec: at.visitSec,
    ...at.step,
    run_sec: at.runSec,
    over: at.over,
    paused: at.paused,
    ...(at.level ? { moves: at.level.moves, undos: at.level.undos } : { score: at.score }),
    ...ad,
  };
}

/** How the run stands as it is left. */
export interface LeftRun {
  opened: boolean;
  inMenu: boolean;
  over: boolean;
  tick: number;
  level: boolean;
  /** The level was laid under the command the program opens on and its start was never told. */
  unsaid: boolean;
}

/**
 * A run left before its end is told, once its start was. A session that has not ticked is the one
 * set up behind what the program opens on, or one left as it began; a level whose start was told is
 * told with no move made too: the player who goes to the menu from a board they never touched.
 */
export function tellsLeaving(run: LeftRun): boolean {
  if (!run.opened || run.inMenu || run.over) return false;
  if (run.tick > 0) return true;
  return run.level && !run.unsaid;
}
