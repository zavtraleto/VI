import type { Technique } from '../rules/types';

/**
 * What a place of the ladder asks of a board: what is laid on it, and what the board laid has
 * to come to when it is solved and played by the players made of the rules. A board is looked
 * for among the ones laid at random by these rules; nothing here is a board yet.
 */
export interface Recipe {
  slot: number;
  /** The chapter the place is in, from 1: a chapter has its working faces. */
  chapter?: number;
  size: number;
  dice: number;
  /** Dice the board may hold over `dice`: a place that asks for "two or three" has one. */
  more?: number;
  /**
   * Faces the level is about: its groups are made of them, and on the ladder they are the only
   * faces that work. Half the dice that are not named otherwise start with one of them on top,
   * the other half with another face; 1 excluded: ones are counted apart.
   */
  faces: readonly number[];
  /** Dice that start showing a 1. */
  ones?: number;
  /** Dice that stand assembled at the start: so many of a value, side by side, fewer than its group. */
  standing?: readonly { value: number; count: number }[];
  /** All dice in one cluster, joined by their sides. */
  compact: boolean;
  par: readonly [number, number];
  depth?: readonly [number, number];
  /** Share of greedy runs that end in a dead end. */
  traps?: readonly [number, number];
  /** Share of random runs that clear the board; left out where it does not matter. */
  random?: readonly [number, number];
  /** Techniques the level cannot be cleared without, and those a solution must do without. */
  needs?: readonly Technique[];
  avoid?: readonly Technique[];
  /** Techniques the way kept shows, where a board cannot be made to need them: the shortest way leans on them, a longer one may not. */
  shows?: readonly Technique[];
  /** The first move of the solution is made with a die the player has to step to. */
  walk?: boolean;
  /** The solution steps off a leaving die onto a standing one, and has more than one to choose from. */
  commit?: boolean;
  lesson?: string;
  arrow?: boolean;
  /** The fewest moves may be left unproved: the board is taken on the word of a strong player. */
  witness?: boolean;
}

const NO_FLOOR: readonly Technique[] = ['floor', 'ones'];
const EASY: readonly Technique[] = ['floor', 'glass', 'ones'];

/** Moves a die that has joined a group takes to go on the ladder, and the moves a new link holds the others for. */
export const LADDER_SINK_MOVES = 2;
export const LADDER_LIFT_MOVES = 1;

/** The chapters of the ladder: the faces that work in each. */
export const CHAPTERS: readonly { faces: readonly number[] }[] = [{ faces: [3] }, { faces: [2, 3] }, { faces: [5] }];

/**
 * The places of the ladder, chapter by chapter. In a chapter only its faces work: a die showing
 * any other makes no group, so the dice left over cannot always be paired off, and a board has
 * to be counted. A die that has joined a group goes in two moves. Each chapter rises to a peak:
 * a crowded board, cleared whole.
 */
export const RECIPES: readonly Recipe[] = [
  // I. Threes.
  { slot: 1, chapter: 1, size: 3, dice: 3, faces: [3], standing: [{ value: 3, count: 2 }], compact: true, par: [1, 1], random: [0.4, 1], avoid: EASY, lesson: 'lessonThrees', arrow: true },
  { slot: 2, chapter: 1, size: 3, dice: 3, faces: [3], compact: true, par: [2, 3], avoid: EASY, walk: true, lesson: 'lessonStep' },
  { slot: 3, chapter: 1, size: 3, dice: 4, faces: [3], compact: true, par: [2, 3], needs: ['link'], avoid: EASY, lesson: 'lessonLink' },
  { slot: 4, chapter: 1, size: 3, dice: 4, faces: [3], compact: true, par: [4, 5], depth: [2, 4], random: [0, 0.3], avoid: EASY, lesson: 'lessonSeven' },
  { slot: 5, chapter: 1, size: 4, dice: 6, faces: [3], compact: true, par: [3, 5], random: [0, 0.25], avoid: NO_FLOOR },
  { slot: 6, chapter: 1, size: 4, dice: 6, faces: [3], compact: true, par: [5, 7], traps: [0.2, 1], random: [0, 0.15], avoid: NO_FLOOR },
  { slot: 7, chapter: 1, size: 3, dice: 7, faces: [3], compact: true, par: [5, 8], traps: [0.3, 1], random: [0, 0.1], avoid: NO_FLOOR },
  { slot: 8, chapter: 1, size: 4, dice: 9, faces: [3], compact: true, par: [6, 9], traps: [0.5, 1], random: [0, 0.05], avoid: NO_FLOOR, witness: true },
  // II. Twos and threes.
  { slot: 9, chapter: 2, size: 3, dice: 5, faces: [2, 3], compact: true, par: [2, 3], random: [0, 0.4], avoid: EASY, lesson: 'lessonTwos' },
  { slot: 10, chapter: 2, size: 3, dice: 5, faces: [2, 3], compact: true, par: [4, 5], random: [0, 0.2], avoid: EASY },
  { slot: 11, chapter: 2, size: 4, dice: 6, faces: [2, 3], compact: true, par: [3, 5], shows: ['glass'], avoid: NO_FLOOR, lesson: 'lessonGlass' },
  { slot: 12, chapter: 2, size: 4, dice: 7, faces: [2, 3], compact: true, par: [5, 7], traps: [0.2, 1], random: [0, 0.15], avoid: NO_FLOOR },
  { slot: 13, chapter: 2, size: 4, dice: 6, faces: [2, 3], compact: false, par: [4, 6], needs: ['floor'], lesson: 'lessonFloor' },
  { slot: 14, chapter: 2, size: 3, dice: 7, faces: [2, 3], compact: true, par: [6, 8], traps: [0.3, 1], random: [0, 0.1] },
  { slot: 15, chapter: 2, size: 5, dice: 9, faces: [2, 3], compact: false, par: [7, 10], traps: [0.3, 1], random: [0, 0.05], witness: true },
  { slot: 16, chapter: 2, size: 4, dice: 10, faces: [2, 3], compact: false, par: [8, 11], traps: [0.5, 1], random: [0, 0.05], witness: true },
  // III. Fives.
  { slot: 17, chapter: 3, size: 4, dice: 5, faces: [5], standing: [{ value: 5, count: 4 }], compact: true, par: [1, 2], avoid: EASY, lesson: 'lessonFives' },
  { slot: 18, chapter: 3, size: 4, dice: 5, faces: [5], standing: [{ value: 5, count: 3 }], compact: true, par: [3, 4], avoid: EASY },
  { slot: 19, chapter: 3, size: 4, dice: 6, faces: [5], compact: true, par: [3, 5], needs: ['link'], avoid: NO_FLOOR },
  { slot: 20, chapter: 3, size: 5, dice: 6, faces: [5], compact: false, par: [5, 7], random: [0, 0.1] },
  { slot: 21, chapter: 3, size: 4, dice: 8, faces: [5], compact: true, par: [5, 8], traps: [0.2, 1], random: [0, 0.1], witness: true },
  { slot: 22, chapter: 3, size: 5, dice: 10, faces: [5], compact: false, par: [7, 10], traps: [0.3, 1], random: [0, 0.05], witness: true },
  { slot: 23, chapter: 3, size: 4, dice: 11, faces: [5], compact: true, par: [8, 12], traps: [0.5, 1], random: [0, 0.05], witness: true },
];

/** The bounds of a place as a list: what is measured, and from what to what it may be. */
export function boundsOf(recipe: Recipe): { what: 'par' | 'depth' | 'traps' | 'random'; from: number; to: number }[] {
  const bounds: { what: 'par' | 'depth' | 'traps' | 'random'; from: number; to: number }[] = [];
  const add = (what: 'par' | 'depth' | 'traps' | 'random', range: readonly [number, number] | undefined) => {
    if (range) bounds.push({ what, from: range[0], to: range[1] });
  };
  add('par', recipe.par);
  add('depth', recipe.depth);
  add('traps', recipe.traps);
  add('random', recipe.random);
  return bounds;
}
