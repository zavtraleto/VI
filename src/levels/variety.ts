import type { LevelSpec } from '../rules/types';
import type { Fit } from './select';

/**
 * What keeps a ladder from being one level played over. A level need not bring a new rule to be
 * new: the face that works, the board, the number of dice, the shape they stand in, the die the
 * way begins with and the number of combos are each a way for two levels to differ. A place of
 * the ladder keeps several boards that fit it, and the ladder is put together from them so that
 * neighbours are unlike: a package is picked, and not a board at a time.
 */

/** What makes a level unlike its neighbour, where no new rule does. */
export interface Traits {
  faces: string;
  size: number;
  dice: number;
  /** The cells the dice stand in, the same for a board turned or mirrored. */
  shape: string;
  /** The way begins with the die the player starts on. */
  ownFirst: boolean;
  /** Clearing moves of the way: its combos and links. */
  combos: number;
}

type Cell = readonly [number, number];

/** The eight ways a square board is turned and mirrored, as what each does to a cell of a board `size` a side. */
function turns(size: number): ((cell: Cell) => Cell)[] {
  const last = size - 1;
  return [
    ([x, z]) => [x, z],
    ([x, z]) => [last - z, x],
    ([x, z]) => [last - x, last - z],
    ([x, z]) => [z, last - x],
    ([x, z]) => [last - x, z],
    ([x, z]) => [x, last - z],
    ([x, z]) => [z, x],
    ([x, z]) => [last - z, last - x],
  ];
}

/** The cells of a set of dice moved up against the corner, in order, written out. */
function written(cells: readonly (readonly [number, number, number])[]): string {
  const left = Math.min(...cells.map(([x]) => x));
  const top = Math.min(...cells.map(([, z]) => z));
  return cells
    .map(([x, z, face]) => [x - left, z - top, face] as const)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .map(([x, z, face]) => `${x}${z}${face}`)
    .join(' ');
}

/** The least of the eight writings of the dice of a board: `face` gives what is written of a die besides its cell. */
function least(spec: LevelSpec, face: (top: number) => number): string {
  const dice = spec.layout?.dice ?? [];
  if (dice.length === 0) return '';
  return turns(spec.size)
    .map((turn) => written(dice.map((die) => [...turn([die.x, die.z]), face(die.top)] as const)))
    .sort()[0];
}

/** The shape the dice of a board stand in, whatever they show: the same for a board turned or mirrored. */
export function shapeOf(spec: LevelSpec): string {
  return least(spec, () => 0);
}

/**
 * Whether one board is the other turned or mirrored: the cells of its dice, the faces on top
 * and the die the player starts on. How the dice lie besides is not asked: two boards that look
 * alike from above are the same level to a player.
 */
export function sameBoard(a: LevelSpec, b: LevelSpec): boolean {
  if (a.size !== b.size || String(a.faces) !== String(b.faces) || !a.layout || !b.layout) return false;
  const marked = (spec: LevelSpec): string => {
    const { start } = spec.layout!;
    // The die of the start is written as its face and ten more, so that it is told from the others.
    return turns(spec.size)
      .map((turn) => written(spec.layout!.dice.map((die) => [...turn([die.x, die.z]), die.top + (die.x === start.x && die.z === start.z ? 10 : 0)] as const)))
      .sort()[0];
  };
  return marked(a) === marked(b);
}

/** The traits of a board that fits a place. */
export function traitsOf(fit: Pick<Fit, 'spec'> & { clears?: number }): Traits {
  const { spec } = fit;
  const first = spec.solution?.[0]?.split(',') ?? [];
  const start = spec.layout?.start;
  return {
    faces: String(spec.faces ?? ''),
    size: spec.size,
    dice: spec.norm,
    shape: shapeOf(spec),
    ownFirst: start !== undefined && Number(first[0]) === start.x && Number(first[1]) === start.z && first[3] !== 'p',
    combos: fit.clears ?? 0,
  };
}

/** Traits two levels do not share. */
export function unlike(a: Traits, b: Traits): number {
  return (Object.keys(a) as (keyof Traits)[]).filter((trait) => a[trait] !== b[trait]).length;
}

/** Boards of a place that are looked at when the ladder is put together: the ones that fit it best. */
export const ARRANGE_AMONG = 5;
/** Traits a level is to differ from the one before it in. */
export const UNLIKE_BY = 2;

/**
 * One board for every place, in the order of the places: of the boards that fit a place best,
 * the first that is no board already taken and is unlike the one before it in two traits; where
 * none is, the one most unlike it. A place with no board gets none (null), and the place after
 * it is held against the last board there is.
 */
export function arrange<T extends Pick<Fit, 'spec'> & { clears?: number }>(places: readonly (readonly T[])[]): (T | null)[] {
  const taken: T[] = [];
  let before: Traits | null = null;
  return places.map((fits) => {
    const fresh = fits.slice(0, ARRANGE_AMONG).filter((fit) => !taken.some((other) => sameBoard(other.spec, fit.spec)));
    if (fresh.length === 0) return null;
    const far = fresh.map((fit) => (before ? unlike(traitsOf(fit), before) : UNLIKE_BY));
    const most = Math.max(...far);
    const pick = fresh[far.findIndex((count) => count >= Math.min(UNLIKE_BY, most))];
    taken.push(pick);
    before = traitsOf(pick);
    return pick;
  });
}
