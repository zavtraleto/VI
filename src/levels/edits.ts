import { report, type LevelReport } from '../rules/levelReport';
import { ALL_ORIENTATIONS } from '../rules/orientation';
import type { LevelSpec, PuzzleDie } from '../rules/types';

/**
 * The boards one change away from a level. A board built for a route seldom comes out right at
 * once: a way round is left open, or the end drags. Most such faults are mended by a single
 * die: turned to another face, moved a cell, or the player started elsewhere. So every such
 * board is made and reported on, and whoever builds the level says which report is the better.
 * The idea is that of the level design tool of Sturtevant and others for Snakebird, which
 * tries every change of one cell and says which makes the way longest.
 */
export interface Edit {
  /** What was changed, in words a table can print: `die 2,1 turned to 3`, `die 0,0 moved east`, `start at 1,2`. */
  what: string;
  spec: LevelSpec;
}

const SIDES = [
  { name: 'north', dx: 0, dz: -1 },
  { name: 'east', dx: 1, dz: 0 },
  { name: 'south', dx: 0, dz: 1 },
  { name: 'west', dx: -1, dz: 0 },
] as const;

/** The level with other dice or another start: what it kept of its way is left out, since it is another board. */
function changed(spec: LevelSpec, dice: readonly PuzzleDie[], start: { x: number; z: number }): LevelSpec {
  const { solution: _solution, par: _par, exact: _exact, ...rest } = spec;
  return { ...rest, layout: { dice: dice.map((die) => ({ ...die })), start: { ...start } } };
}

/**
 * Every board one change away: a die turned to show another face, lying the first way there is
 * with that face on top; a die moved to a free cell beside it, the player with it if they stood
 * on it; the player started on another die. Empty for a level with no board of its own.
 */
export function editsOf(spec: LevelSpec): Edit[] {
  const { layout, size } = spec;
  if (!layout) return [];
  const { dice, start } = layout;
  // A die is moved to a cell that stands free: one that is cut out of the board is as good as taken.
  const taken = new Set([...dice, ...(spec.holes ?? [])].map((cell) => `${cell.x},${cell.z}`));
  const edits: Edit[] = [];
  dice.forEach((die, index) => {
    const others = (now: PuzzleDie) => dice.map((other, at) => (at === index ? now : other));
    const stoodOn = die.x === start.x && die.z === start.z;
    for (let top = 1; top <= 6; top++) {
      if (top === die.top) continue;
      const lie = ALL_ORIENTATIONS.find((o) => o.top === top)!;
      edits.push({ what: `die ${die.x},${die.z} turned to ${top}`, spec: changed(spec, others({ ...die, top, north: lie.north }), start) });
    }
    for (const side of SIDES) {
      const x = die.x + side.dx;
      const z = die.z + side.dz;
      if (x < 0 || z < 0 || x >= size || z >= size || taken.has(`${x},${z}`)) continue;
      edits.push({ what: `die ${die.x},${die.z} moved ${side.name}`, spec: changed(spec, others({ ...die, x, z }), stoodOn ? { x, z } : start) });
    }
    if (!stoodOn) edits.push({ what: `start at ${die.x},${die.z}`, spec: changed(spec, dice, { x: die.x, z: die.z }) });
  });
  return edits;
}

/**
 * The edits a rating takes, the best first. `rate` is given the report of an edited board and
 * says how good it is, or null to turn it away. An edit whose board cannot be reported on, a
 * board that starts with a combo ready or the like, is turned away.
 */
export function probeEdits(
  spec: LevelSpec,
  rate: (told: LevelReport, edit: Edit) => number | null,
  opts: { maxStates?: number; runs?: number } = {},
): { edit: Edit; report: LevelReport; rating: number }[] {
  const kept: { edit: Edit; report: LevelReport; rating: number }[] = [];
  for (const edit of editsOf(spec)) {
    let told: LevelReport;
    try {
      told = report(edit.spec, opts);
    } catch {
      continue;
    }
    const rating = rate(told, edit);
    if (rating !== null) kept.push({ edit, report: told, rating });
  }
  return kept.sort((a, b) => b.rating - a.rating);
}
