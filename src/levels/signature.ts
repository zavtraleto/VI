import { scoreOf, type Score } from '../rules/levelScore';
import { moveOf, moveText, solveLevel, type SolverMove } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { goalFaces } from './goalFaces';
import { hiddenOf } from './measures';
import { needsOf } from './needs';
import { sameBoard, turns } from './variety';

/**
 * The signature of a board and how alike two boards are (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md,
 * section 5). What the owner calls a repeat is nearly always "this was already": the same thought in another
 * layout, or the same layout with other faces. So a board is read twice: its core, the thought (the kind of
 * its way, the events of it, the moves it asks for and the faces it goes with), and its layout, the cells its
 * dice and its start stand in. Two boards are as alike as the more alike of the two.
 */

/** The thought of a board: what its way is like, whatever the board it is played on. */
export interface Core {
  kind: Score['kind'];
  /** The events and the changes of floor of the way, in order (`Score.route`), with no faces. */
  route: string;
  /** The moves the way asks for (`needsOf`), in order of their names. */
  needs: string[];
  /** The faces the board asks for but the 1s (`goalFaces`), smallest first. */
  faces: number[];
}

/** The way a board is read by: the one it keeps, or else the solver's, or else none. */
function wayOf(spec: LevelSpec): SolverMove[] {
  if (spec.solution) return spec.solution.map(moveOf);
  return solveLevel(spec).solution?.moves ?? [];
}

const coreFrom = (spec: LevelSpec, way: readonly SolverMove[]): Core => {
  const { kind, route } = scoreOf(spec, way);
  // The faces are read off the way the core is read by, kept or found.
  const faces = goalFaces({ ...spec, solution: way.map(moveText) }).filter((face) => face !== 1);
  return { kind, route, needs: [...needsOf(spec, way)].sort(), faces: [...faces].sort((a, b) => a - b) };
};

/**
 * The core of a board: its way is the one it keeps, or the solver's where it keeps none (a draft of the
 * workshop); a board with no way at all has the core of an empty way, `top` with no events.
 */
export function coreOf(spec: LevelSpec): Core {
  return coreFrom(spec, wayOf(spec));
}

/** The core written as six hexadecimal signs (FNV-1a of 32 bits), the column `sig` of the table. */
export function coreKey(core: Core): string {
  const text = JSON.stringify({ kind: core.kind, route: core.route, needs: core.needs, faces: core.faces });
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

export type ShapeClass = 'rect' | 'L' | 'corridor' | 'pocket' | 'cross' | 'other';

type Cell = readonly [number, number];

/** The cells of a board that are not cut out. */
function cellsOf(spec: LevelSpec): Cell[] {
  const cut = new Set((spec.holes ?? []).map((cell) => `${cell.x},${cell.z}`));
  const cells: Cell[] = [];
  for (let z = 0; z < spec.size; z++) for (let x = 0; x < spec.size; x++) if (!cut.has(`${x},${z}`)) cells.push([x, z]);
  return cells;
}

/**
 * The class of the shape of a board, read off the cells that are not cut out, inside the least rectangle
 * that holds them:
 * - the cells fill the rectangle: a `corridor` where it is one cell wide, or two wide and at least three
 *   times as long, else a `rect`;
 * - what is missing of the rectangle is one rectangle at one of its corners: an `L`;
 * - what is missing is four rectangles, one at each corner, and the cells hold no cell with one neighbour: a `cross`;
 * - a cell has exactly one neighbouring cell, a dead end the shape leads a die into: a `pocket`;
 * - anything else: `other`.
 */
export function shapeClassOf(spec: LevelSpec): ShapeClass {
  const cells = cellsOf(spec);
  if (cells.length === 0) return 'other';
  const xs = cells.map(([x]) => x);
  const zs = cells.map(([, z]) => z);
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const [w, h] = [right - left + 1, bottom - top + 1];
  const has = new Set(cells.map(([x, z]) => `${x},${z}`));
  if (cells.length === w * h) {
    const [short, long] = [Math.min(w, h), Math.max(w, h)];
    return short === 1 || (short === 2 && long >= 3 * short) ? 'corridor' : 'rect';
  }
  // The missing cells of the rectangle, in pieces that hold together by their sides.
  const missing: Cell[] = [];
  for (let z = top; z <= bottom; z++) for (let x = left; x <= right; x++) if (!has.has(`${x},${z}`)) missing.push([x, z]);
  const pieces = piecesOf(missing);
  const corners = [`${left},${top}`, `${right},${top}`, `${left},${bottom}`, `${right},${bottom}`];
  const filled = (piece: Cell[]): boolean => {
    const px = piece.map(([x]) => x);
    const pz = piece.map(([, z]) => z);
    return piece.length === (Math.max(...px) - Math.min(...px) + 1) * (Math.max(...pz) - Math.min(...pz) + 1);
  };
  const atCorner = (piece: Cell[]): string | undefined => corners.find((corner) => piece.some(([x, z]) => `${x},${z}` === corner));
  const deadEnd = cells.some(([x, z]) => [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]].filter(([nx, nz]) => has.has(`${nx},${nz}`)).length === 1);
  if (pieces.length === 1 && filled(pieces[0]) && atCorner(pieces[0])) return 'L';
  if (pieces.length === 4 && pieces.every(filled) && new Set(pieces.map(atCorner)).size === 4 && pieces.every(atCorner) && !deadEnd) return 'cross';
  return deadEnd ? 'pocket' : 'other';
}

/** Cells in pieces that hold together by their sides. */
function piecesOf(cells: readonly Cell[]): Cell[][] {
  const left = new Map(cells.map((cell) => [`${cell[0]},${cell[1]}`, cell]));
  const pieces: Cell[][] = [];
  for (const cell of cells) {
    if (!left.has(`${cell[0]},${cell[1]}`)) continue;
    const piece: Cell[] = [];
    const queue = [cell];
    left.delete(`${cell[0]},${cell[1]}`);
    while (queue.length > 0) {
      const [x, z] = queue.pop()!;
      piece.push([x, z]);
      for (const key of [`${x + 1},${z}`, `${x - 1},${z}`, `${x},${z + 1}`, `${x},${z - 1}`]) {
        const next = left.get(key);
        if (next) {
          left.delete(key);
          queue.push(next);
        }
      }
    }
    pieces.push(piece);
  }
  return pieces;
}

/** The core and the layout of a board: what the table of the hundred and the workshop show of it. */
export interface Signature extends Core {
  /** All the dice of the board, the fixed ones too. */
  dice: number;
  shape: ShapeClass;
  /** Cells cut out of the board. */
  holes: number;
  /** Dice whose face they go with is out of sight at the start (`hiddenOf`). */
  hidden: number;
  /** The forks of the board (`depthOf`), where they were counted; null where not. */
  forks: number | null;
  /** The cells of the dice and of the start, the same for a board turned, mirrored or moved (`patternOf`). */
  pattern: string;
}

/** What a cell of the pattern of a layout holds: a die, the die the player starts on, the floor they start on. */
type Mark = 'o' | '*' | 'f';

/** The cells of the dice of a board and of its start, each with what it holds; a fixed die is a die. */
function marksOf(spec: LevelSpec): [Cell, Mark][] {
  const layout = spec.layout;
  if (!layout) return [];
  const onDie = (x: number, z: number) => !layout.onFloor && x === layout.start.x && z === layout.start.z;
  const marks: [Cell, Mark][] = layout.dice.map((die) => [[die.x, die.z], onDie(die.x, die.z) ? '*' : 'o']);
  if (layout.onFloor) marks.push([[layout.start.x, layout.start.z], 'f']);
  return marks;
}

/**
 * The pattern of a layout: the least of the eight writings of the cells of the dice and the start, moved up
 * against the corner, the start marked, with no faces and no cut cells (as `shapeOf`, but for the dice alone).
 */
export function patternOf(spec: LevelSpec): string {
  const marks = marksOf(spec);
  if (marks.length === 0) return '';
  return turns(spec.size)
    .map((turn) => {
      const moved = marks.map(([cell, mark]) => [turn(cell), mark] as const);
      const left = Math.min(...moved.map(([[x]]) => x));
      const top = Math.min(...moved.map(([[, z]]) => z));
      return moved
        .map(([[x, z], mark]) => [x - left, z - top, mark] as const)
        .sort((a, b) => a[1] - b[1] || a[0] - b[0])
        .map(([x, z, mark]) => `${x}${z}${mark}`)
        .join(' ');
    })
    .sort()[0];
}

/** The signature of a board; the forks are given, as they are counted by the slow part (`depthOf`). */
export function signatureOf(spec: LevelSpec, forks: number | null = null): Signature {
  const way = wayOf(spec);
  return {
    ...coreFrom(spec, way),
    dice: spec.layout?.dice.length ?? 0,
    shape: shapeClassOf(spec),
    holes: spec.holes?.length ?? 0,
    hidden: hiddenOf(spec, way),
    forks,
    pattern: patternOf(spec),
  };
}

/**
 * The weights of the parts of a core in how alike two cores are (spec section 5): the route, the moves
 * asked for, the faces, the kind. Tuned against the calibration set (`src/levels/calibration.ts`, task 3
 * of the plan of the tools of progression, fix round 1): the pairs of section 5, fewer than three missed,
 * and the places 48-100 the owner called repeats (`OWNER_REPEATS`), as many flagged and as few others as
 * can be. The spec started from 0.4, 0.3, 0.2, 0.1: on it two boards of one combo on top are half alike
 * whatever their faces (`dd-15-no-way-down` and `dd-21-wood-fives`, 4s and 5s, came to 0.65, where the owner
 * called them different). Now the route weighs half and the faces four tenths: the events of a way and the
 * faces it goes with are the thought a player keeps. The kind weighs nothing: it is read off the same steps
 * down and up as the route, and weighed once more it only made boards of one kind alike. It stays in the
 * core, so that rule 16 still tells two ways of one route on other floors apart. Squeezing repeated signs of
 * the route, writing its quiet moves into it, reading it as a set, taking the 1s among the faces, leaving the
 * seven and the loop out of the moves, or weighing the number of dice or the length of the way, gave no
 * better agreement while the pairs held.
 */
export const CORE_WEIGHTS = { route: 0.5, needs: 0.1, faces: 0.4, kind: 0 } as const;

/**
 * The power the likeness of two layouts is raised to in `similarity`. Laid over each other the best way,
 * two small boards share half their dice or more by chance: the pairs the owner called different come to
 * 0.56-0.67 (`pair-and-fours-1` and `collapse-5`, `ones-over-leaving-1` and `act-k21`), however their cores
 * are weighed. Squared, a layout counts as alike (`SIMILAR_ROW`) from 0.87, as near (`SIMILAR_NEAR`) from
 * 0.81, and the same layout of rule 16 (`SAME_LAYOUT`, 0.9, read off `layoutSim` itself) is still alike.
 */
export const LAYOUT_POWER = 2;

/** Rule 16: a layout this alike to one before it is the same layout, whatever its faces. */
export const SAME_LAYOUT = 0.9;
/**
 * Rule 17: how alike a board may be to any place before it in the row, at most (less than this). The spec
 * started from 0.7; 0.75 is as high as the pairs the owner called alike allow (`far-faces-1` and
 * `floor-first-1` come to 0.77), and it flags fewer of the places he did not call repeats.
 */
export const SIMILAR_ROW = 0.75;
/**
 * Rule 17: how alike a board may be to any of the five places before it (less than this). The spec started
 * from 0.5; at it nearly every place is near one of its five, and the pairs he called different side by side
 * come to 0.57 at most (`bridge-5` and `hidden-face-1`, both of 3s).
 */
export const SIMILAR_NEAR = 0.65;

/** The fewest signs to change, put in or take out to make one row of signs the other. */
function levenshtein(a: readonly string[], b: readonly string[]): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next.push(Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    row = next;
  }
  return row[b.length];
}

const signsOf = (route: string): string[] => route.split(' ').filter((sign) => sign !== '');

/** How alike two sets are: what they share of what they hold between them; two empty sets are alike. */
function jaccard<T>(a: readonly T[], b: readonly T[]): number {
  const all = new Set([...a, ...b]);
  if (all.size === 0) return 1;
  const inB = new Set(b);
  return new Set(a.filter((one) => inB.has(one))).size / all.size;
}

/** How alike two routes are: one less the signs to change over the longer; two empty routes are alike. */
function routeSim(a: string, b: string): number {
  const [sa, sb] = [signsOf(a), signsOf(b)];
  const longer = Math.max(sa.length, sb.length);
  return longer === 0 ? 1 : 1 - levenshtein(sa, sb) / longer;
}

/** How alike two thoughts are, from 0 to 1: the parts of the cores, weighed by `CORE_WEIGHTS`. */
export function coreSim(a: Core, b: Core): number {
  return (
    CORE_WEIGHTS.route * routeSim(a.route, b.route) +
    CORE_WEIGHTS.needs * jaccard(a.needs, b.needs) +
    CORE_WEIGHTS.faces * jaccard(a.faces, b.faces) +
    CORE_WEIGHTS.kind * (a.kind === b.kind ? 1 : 0)
  );
}

/**
 * How alike two layouts are, from 0 to 1: `b` is laid over `a` turned or mirrored every way and moved every
 * way, and at the best of them, the dice that stand on dice of `a`, and one more where the starts meet, over
 * the dice of the board with more of them and one. A board that is the other turned or mirrored is 1.
 */
export function layoutSim(a: LevelSpec, b: LevelSpec): number {
  if (sameBoard(a, b)) return 1;
  const marksA = marksOf(a);
  const marksB = marksOf(b);
  const diceA = marksA.filter(([, mark]) => mark !== 'f');
  const diceB = marksB.filter(([, mark]) => mark !== 'f');
  const most = Math.max(diceA.length, diceB.length) + 1;
  const startOf = (marks: [Cell, Mark][]) => marks.find(([, mark]) => mark !== 'o');
  const startA = startOf(marksA);
  const atA = new Set(diceA.map(([[x, z]]) => `${x},${z}`));
  let best = 0;
  for (const turn of turns(b.size)) {
    const turned = marksB.map(([cell, mark]) => [turn(cell), mark] as [Cell, Mark]);
    const turnedDice = turned.filter(([, mark]) => mark !== 'f');
    const startB = startOf(turned);
    // Every move that lays one cell of `b` on one cell of `a`: no other move can lay more of them together.
    const moves = new Set<string>();
    for (const [[ax, az]] of marksA) for (const [[bx, bz]] of turned) moves.add(`${ax - bx},${az - bz}`);
    for (const move of moves) {
      const [dx, dz] = move.split(',').map(Number);
      let met = turnedDice.filter(([[x, z]]) => atA.has(`${x + dx},${z + dz}`)).length;
      if (startA && startB && startA[1] === startB[1] && startA[0][0] === startB[0][0] + dx && startA[0][1] === startB[0][1] + dz) met += 1;
      best = Math.max(best, met);
    }
  }
  return best / most;
}

/**
 * How alike two boards are, from 0 to 1: a repeat of the thought and a repeat of the layout are both repeats.
 * The layout is taken to `LAYOUT_POWER`, so that what two layouts share by chance does not make them alike.
 */
export function similarity(a: LevelSpec, b: LevelSpec): number {
  return Math.max(coreSim(coreOf(a), coreOf(b)), layoutSim(a, b) ** LAYOUT_POWER);
}

/** What rule 17 reads of a place: the earlier place most alike to it, and the most alike of the five before. */
export interface Flag {
  /** The number of the earlier place most alike to this one, and how alike. */
  at: number;
  sim: number;
  /** The number of the place among the five before most alike to this one, and how alike. */
  nearAt: number;
  near: number;
  /** Alike to an earlier place at `SIMILAR_ROW` or more, or to one of the five before at `SIMILAR_NEAR` or more. */
  flagged: boolean;
}

/**
 * Rule 17 over a row (spec section 5): for every place from `from` on, the earlier place most alike to it
 * and the most alike of the five before, and whether either crosses its threshold. The places before `from`
 * are judged against but not judged (the first thirty stay as they are, the owner's decision 1).
 */
export function flaggedBy(row: readonly { number: number; spec: LevelSpec }[], from = 31): Map<number, Flag> {
  const cores = row.map((place) => coreOf(place.spec));
  const out = new Map<number, Flag>();
  row.forEach((place, i) => {
    if (place.number < from || i === 0) return;
    let flag: Flag = { at: row[0].number, sim: -1, nearAt: row[0].number, near: -1, flagged: false };
    for (let j = 0; j < i; j++) {
      const sim = Math.max(coreSim(cores[i], cores[j]), layoutSim(place.spec, row[j].spec) ** LAYOUT_POWER);
      if (sim > flag.sim) flag = { ...flag, at: row[j].number, sim };
      if (j >= i - 5 && sim > flag.near) flag = { ...flag, nearAt: row[j].number, near: sim };
    }
    out.set(place.number, { ...flag, flagged: flag.sim >= SIMILAR_ROW || flag.near >= SIMILAR_NEAR });
  });
  return out;
}
