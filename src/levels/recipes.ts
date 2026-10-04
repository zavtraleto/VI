import type { Technique } from '../rules/types';

/**
 * What a place of the ladder asks of a board: what is laid on it, and what the board laid has
 * to come to when it is solved and played by the players made of the rules. A board is looked
 * for among the ones laid at random by these rules; nothing here is a board yet.
 */
export interface Recipe {
  slot: number;
  size: number;
  dice: number;
  /** Dice the board may hold over `dice`: a place that asks for "two or three" has one. */
  more?: number;
  /**
   * Faces the level is about: its groups are made of them. Half the dice that are not named
   * otherwise start with one of them on top, the other half with another face; 1 excluded:
   * ones are counted apart.
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
  /** The first move of the solution is made with a die the player has to step to. */
  walk?: boolean;
  /** The solution steps off a leaving die onto a standing one, and has more than one to choose from. */
  commit?: boolean;
  lesson?: string;
  arrow?: boolean;
  /** The fewest moves may be left unproved: the board is taken on the word of a strong player. */
  witness?: boolean;
}

const PLAIN: readonly Technique[] = ['floor', 'glass', 'link', 'ones'];

/**
 * The twenty places of the first ladder: four blocks of five, each ending on a peak. The
 * boards, the numbers of dice, the faces and the lessons are the ladder's
 * (docs/VI_Levels_First20.md, section 4); the bounds are the spec's and are where the search
 * starts from, not where it has to end.
 */
export const RECIPES: readonly Recipe[] = [
  // I. The first groups.
  // Two dice side by side cannot make a pair in one roll: the die that rolls ends two cells
  // from where it stood. So the dice of the first board touch by a corner, not by a side.
  { slot: 1, size: 3, dice: 2, faces: [2], compact: false, par: [1, 1], traps: [0, 0], random: [0.5, 1], avoid: PLAIN, lesson: 'lessonRoll', arrow: true },
  { slot: 2, size: 3, dice: 3, faces: [3], standing: [{ value: 3, count: 2 }], compact: true, par: [1, 1], traps: [0, 0], random: [0.5, 1], avoid: PLAIN, lesson: 'lessonCount' },
  { slot: 3, size: 3, dice: 2, more: 1, faces: [2], compact: true, par: [1, 2], random: [0.5, 1], avoid: PLAIN, walk: true, lesson: 'lessonStep' },
  { slot: 4, size: 3, dice: 5, faces: [2, 3], compact: true, par: [2, 3], depth: [1, 2], traps: [0, 0.1], avoid: PLAIN },
  { slot: 5, size: 3, dice: 2, more: 1, faces: [2, 3], compact: true, par: [3, 4], depth: [3, 4], avoid: PLAIN },
  // II. While it is going.
  { slot: 6, size: 3, dice: 3, faces: [2], compact: true, par: [2, 2], traps: [0, 0.1], needs: ['link'], avoid: ['floor', 'glass', 'ones'], lesson: 'lessonLink' },
  { slot: 7, size: 3, dice: 5, faces: [2], ones: 3, compact: true, par: [3, 4], needs: ['ones'], avoid: ['floor', 'glass'], lesson: 'lessonOnes' },
  { slot: 8, size: 3, dice: 3, more: 1, faces: [2, 3], compact: true, par: [4, 5], depth: [3, 4], needs: ['link'], avoid: ['floor', 'glass', 'ones'], lesson: 'lessonWindow' },
  { slot: 9, size: 4, dice: 4, faces: [2, 3], compact: true, par: [3, 4], needs: ['glass'], avoid: ['floor', 'ones'], lesson: 'lessonGlass' },
  { slot: 10, size: 4, dice: 7, faces: [2, 3], ones: 1, compact: true, par: [7, 9], depth: [3, 5], traps: [0.5, 0.8], random: [0, 0.1], avoid: ['floor'] },
  // III. More, and closer.
  { slot: 11, size: 4, dice: 4, more: 1, faces: [4], standing: [{ value: 4, count: 3 }], compact: true, par: [2, 2], traps: [0, 0.1], avoid: ['floor', 'ones'], lesson: 'lessonFour' },
  { slot: 12, size: 4, dice: 5, more: 1, faces: [2, 3], compact: true, par: [4, 5], avoid: ['floor', 'ones'], commit: true, lesson: 'lessonCommit' },
  { slot: 13, size: 3, dice: 7, faces: [2, 3], compact: true, par: [6, 8], depth: [2, 4], traps: [0.2, 0.4], avoid: ['floor'] },
  { slot: 14, size: 4, dice: 6, faces: [2, 3], ones: 1, compact: false, par: [5, 6], needs: ['floor'], lesson: 'lessonFloor' },
  { slot: 15, size: 4, dice: 10, faces: [2, 3, 4], ones: 2, compact: false, par: [10, 12], depth: [3, 5], traps: [0.5, 0.8], random: [0, 0.1], witness: true },
  // IV. All the faces.
  { slot: 16, size: 5, dice: 6, more: 1, faces: [5, 2], standing: [{ value: 5, count: 4 }], compact: false, par: [4, 6], traps: [0, 0.1], lesson: 'lessonFive' },
  { slot: 17, size: 5, dice: 8, faces: [2, 3, 4], compact: false, par: [6, 8], depth: [2, 4], traps: [0.2, 0.4] },
  { slot: 18, size: 5, dice: 10, faces: [2, 3, 4, 5], ones: 2, compact: false, par: [9, 11], depth: [2, 4], traps: [0.2, 0.4], witness: true },
  { slot: 19, size: 4, dice: 12, faces: [2, 3, 4], compact: false, par: [12, 14], depth: [2, 4], traps: [0.2, 0.4], witness: true },
  { slot: 20, size: 5, dice: 9, more: 1, faces: [6, 2, 3], standing: [{ value: 6, count: 4 }], compact: false, par: [12, 15], depth: [3, 5], traps: [0.5, 0.8], random: [0, 0.1], witness: true, lesson: 'lessonSix' },
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
