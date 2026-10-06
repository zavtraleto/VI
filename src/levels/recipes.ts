import type { LevelLayout, LevelSpec, Technique } from '../rules/types';

/**
 * What a place of the ladder asks of a board: what is laid on it, and what the board laid has
 * to come to when it is solved and played by the players made of the rules. A board is looked
 * for among the ones laid at random by these rules; nothing here is a board yet.
 */
export interface Recipe {
  slot: number;
  /** The chapter the place is in, from 0: the number its level names its chapter with. */
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
  /** The name of the level of the place; `B` and the number of the place when left out. */
  id?: string;
  /** What the player is to notice on the level, in a line: the place is laid for this, and not for its numbers. */
  brief?: string;
  /** Boards laid by hand for the place, judged as any other: seed `SKETCH + n` lays the n-th of them, from 1. */
  sketch?: readonly LevelLayout[];
  /** As many dice as one combo of the one face that works, the floor shut: a board with no dead end, cleared from wherever it stands. */
  safe?: boolean;
  /** The way kept rolls only the die the player stands on: no step is made. */
  ownOnly?: boolean;
  /** Combos the way kept makes, with no die joining one that is leaving. */
  combos?: number;
  /** Dice of a group that are left where the group is laid from its solution; as many as may, or fewer, when left out. */
  stay?: number;
  /** The way begins by riding a face on the side: rolled along, then turned (see `rides`). */
  ride?: boolean;
  /** The face that rides is the one that looks at the player, to the south: it is seen on the board all the way. */
  front?: boolean;
  /** The die the way begins with starts with a working face at the bottom: the rule of seven is what finds it. */
  seven?: boolean;
  /** Dice that start with a working face at the bottom: at least one (`true`), or none (`false`). */
  under?: boolean;
  /** Steps from the die of the start to the die of the first move, at the least. */
  far?: number;
  /** Dice the way moves, at the least. */
  movers?: number;
  /** Moves of the way after the clearing move before its last. */
  tail?: readonly [number, number];
  /** First moves that leave the board cleared in no more than a move over the fewest. */
  firsts?: readonly [number, number];
  /** Share of the runs of a persona that clear the board. */
  hasty?: readonly [number, number];
  casual?: readonly [number, number];
  /** Share of the planner over the share of the hasty one. */
  gap?: readonly [number, number];
  /** What the level of the place is played with: its floor shut, a net under the player, the first move shown, what its line waits for, the window before it. */
  floor?: boolean;
  guard?: boolean;
  guide?: boolean;
  until?: LevelSpec['until'];
  story?: string;
}

const NO_FLOOR: readonly Technique[] = ['floor', 'ones'];
const EASY: readonly Technique[] = ['floor', 'glass', 'ones'];

/** Moves a die that has joined a group takes to go on the ladder, and the moves a new link holds the others for. */
export const LADDER_SINK_MOVES = 2;
export const LADDER_LIFT_MOVES = 1;

/**
 * A chapter of the ladder: how generous the limit of moves of its levels is, whether stars open
 * it, whether its floor is open, and which of its levels are played with a net.
 */
export interface ChapterRule {
  key: string;
  /** Times the fewest moves of a level its limit gives, before the moves to spare. */
  times: number;
  /** A share of the stars of the levels before it opens the chapter; without a gate it is open. */
  gate: boolean;
  floor: boolean;
  guard: 'all' | 'lessons' | 'none';
}

/**
 * The chapters of the ladder, by the number a level names its chapter with. The course teaches
 * what the game cannot be played without; every chapter after it brings a rule or two of its own
 * among easy levels; the last three are the ladder as it was, chapters of one set of faces.
 */
export const CHAPTERS: readonly ChapterRule[] = [
  { key: 'course', times: 5, gate: false, floor: false, guard: 'all' },
  { key: 'faces', times: 5, gate: false, floor: false, guard: 'all' },
  { key: 'chain', times: 5, gate: true, floor: false, guard: 'lessons' },
  { key: 'floor', times: 5, gate: true, floor: true, guard: 'lessons' },
  { key: 'twoFaces', times: 5, gate: true, floor: true, guard: 'lessons' },
  { key: 'threes', times: 5, gate: true, floor: true, guard: 'none' },
  { key: 'twosThrees', times: 4, gate: true, floor: true, guard: 'none' },
  { key: 'fives', times: 3, gate: true, floor: true, guard: 'none' },
];

/**
 * The places of the ladder, chapter by chapter. In a chapter only its faces work: a die showing
 * any other makes no group, so the dice left over cannot always be paired off, and a board has
 * to be counted. A die that has joined a group goes in two moves. Each chapter rises to a peak:
 * a crowded board, cleared whole.
 */
export const RECIPES: readonly Recipe[] = [
  // I. Threes.
  { slot: 1, chapter: 5, size: 3, dice: 3, faces: [3], standing: [{ value: 3, count: 2 }], compact: true, par: [1, 1], random: [0.4, 1], avoid: EASY, lesson: 'lessonThrees', arrow: true },
  { slot: 2, chapter: 5, size: 3, dice: 3, faces: [3], compact: true, par: [2, 3], avoid: EASY, walk: true, lesson: 'lessonStep' },
  { slot: 3, chapter: 5, size: 3, dice: 4, faces: [3], compact: true, par: [2, 3], needs: ['link'], avoid: EASY, lesson: 'lessonLink' },
  { slot: 4, chapter: 5, size: 3, dice: 4, faces: [3], compact: true, par: [4, 5], depth: [2, 4], random: [0, 0.3], avoid: EASY, lesson: 'lessonSeven' },
  { slot: 5, chapter: 5, size: 4, dice: 6, faces: [3], compact: true, par: [3, 5], random: [0, 0.25], avoid: NO_FLOOR },
  { slot: 6, chapter: 5, size: 4, dice: 6, faces: [3], compact: true, par: [5, 7], traps: [0.2, 1], random: [0, 0.15], avoid: NO_FLOOR },
  { slot: 7, chapter: 5, size: 3, dice: 7, faces: [3], compact: true, par: [5, 8], traps: [0.3, 1], random: [0, 0.1], avoid: NO_FLOOR },
  { slot: 8, chapter: 5, size: 4, dice: 9, faces: [3], compact: true, par: [6, 9], traps: [0.5, 1], random: [0, 0.05], avoid: NO_FLOOR, witness: true },
  // II. Twos and threes.
  { slot: 9, chapter: 6, size: 3, dice: 5, faces: [2, 3], compact: true, par: [2, 3], random: [0, 0.4], avoid: EASY, lesson: 'lessonTwos' },
  { slot: 10, chapter: 6, size: 3, dice: 5, faces: [2, 3], compact: true, par: [4, 5], random: [0, 0.2], avoid: EASY },
  { slot: 11, chapter: 6, size: 4, dice: 6, faces: [2, 3], compact: true, par: [3, 5], shows: ['glass'], avoid: NO_FLOOR, lesson: 'lessonGlass' },
  { slot: 12, chapter: 6, size: 4, dice: 7, faces: [2, 3], compact: true, par: [5, 7], traps: [0.2, 1], random: [0, 0.15], avoid: NO_FLOOR },
  { slot: 13, chapter: 6, size: 4, dice: 6, faces: [2, 3], compact: false, par: [4, 6], needs: ['floor'], lesson: 'lessonFloor' },
  { slot: 14, chapter: 6, size: 3, dice: 7, faces: [2, 3], compact: true, par: [6, 8], traps: [0.3, 1], random: [0, 0.1] },
  { slot: 15, chapter: 6, size: 5, dice: 9, faces: [2, 3], compact: false, par: [7, 10], traps: [0.3, 1], random: [0, 0.05], witness: true },
  { slot: 16, chapter: 6, size: 4, dice: 10, faces: [2, 3], compact: false, par: [8, 11], traps: [0.5, 1], random: [0, 0.05], witness: true },
  // III. Fives.
  { slot: 17, chapter: 7, size: 4, dice: 5, faces: [5], standing: [{ value: 5, count: 4 }], compact: true, par: [1, 2], avoid: EASY, lesson: 'lessonFives' },
  { slot: 18, chapter: 7, size: 4, dice: 5, faces: [5], standing: [{ value: 5, count: 3 }], compact: true, par: [3, 4], avoid: EASY },
  { slot: 19, chapter: 7, size: 4, dice: 6, faces: [5], compact: true, par: [3, 5], needs: ['link'], avoid: NO_FLOOR },
  { slot: 20, chapter: 7, size: 5, dice: 6, faces: [5], compact: false, par: [5, 7], random: [0, 0.1] },
  { slot: 21, chapter: 7, size: 4, dice: 8, faces: [5], compact: true, par: [5, 8], traps: [0.2, 1], random: [0, 0.1], witness: true },
  { slot: 22, chapter: 7, size: 5, dice: 10, faces: [5], compact: false, par: [7, 10], traps: [0.3, 1], random: [0, 0.05], witness: true },
  { slot: 23, chapter: 7, size: 4, dice: 11, faces: [5], compact: true, par: [8, 12], traps: [0.5, 1], random: [0, 0.05], witness: true },
];

/**
 * What every place of the course and of the first chapter asks for: its dice in one cluster, the
 * floor shut and a net under the player, a way that leans on nothing that has not been taught,
 * and no die with a working face at the bottom, which only the rule of seven finds.
 *
 * A place whose way is one die rolled from where it stands asks for no cluster: the die may
 * stand apart, and the player never leaves it. The lessons of the first chapter ask nothing of
 * the players made of the rules: a way of three rolls with nothing going until the last is
 * found by the arrow and the line of the lesson, which those players do not read.
 */
const TAUGHT: Pick<Recipe, 'compact' | 'floor' | 'guard' | 'avoid' | 'under'> = { compact: true, floor: false, guard: true, avoid: ['floor', 'glass', 'ones', 'link'], under: false };
/** Shares of the runs of the hasty and the casual persona that clear a level with a lesson, and a level that follows one. */
const LESSON: Pick<Recipe, 'hasty' | 'casual'> = { hasty: [0.8, 1], casual: [0.95, 1] };
const PLAIN: Pick<Recipe, 'hasty' | 'casual'> = { hasty: [0.6, 1], casual: [0.85, 1] };
const PLAIN_ONE: Pick<Recipe, 'hasty' | 'casual'> = { hasty: [0.5, 1], casual: [0.8, 1] };

/**
 * The course: nine levels in three blocks, a combo, a step, two combos in a row. The first level
 * of a block says its rule in a line and shows its first move; the two after it are played with
 * no words. The face that works changes from level to level: a combo is as many dice as its
 * face has pips, whatever the face. `brief` is what the player is to notice.
 */
export const COURSE: readonly Recipe[] = [
  { slot: 101, id: 'T01', chapter: 0, size: 3, dice: 3, faces: [3], standing: [{ value: 3, count: 2 }], par: [1, 1], depth: [1, 3], ...TAUGHT, compact: false, ...LESSON, safe: true, ownOnly: true, arrow: true, lesson: 'lineCombo', guide: true, brief: 'a roll lays another face on top; three 3s side by side go' },
  { slot: 102, id: 'T02', chapter: 0, size: 3, dice: 2, faces: [2], par: [1, 2], depth: [1, 3], ...TAUGHT, compact: false, ...PLAIN, safe: true, ownOnly: true, brief: 'two 2s are enough: done alone, with no arrow' },
  { slot: 103, id: 'T03', chapter: 0, size: 3, dice: 4, faces: [4], standing: [{ value: 4, count: 3 }], par: [1, 2], depth: [1, 3], ...TAUGHT, compact: false, ...PLAIN, safe: true, ownOnly: true, brief: 'a 4 takes four: the count goes from 3/4 to 4/4' },
  { slot: 104, id: 'T04', chapter: 0, size: 3, dice: 3, faces: [3], standing: [{ value: 3, count: 2 }], par: [1, 2], depth: [1, 3], ...TAUGHT, ...LESSON, safe: true, walk: true, lesson: 'lineStep', guide: true, brief: 'my die is where it should be; I walk to the one that has to roll' },
  { slot: 105, id: 'T05', chapter: 0, size: 3, dice: 4, faces: [4], standing: [{ value: 4, count: 3 }], par: [1, 2], depth: [1, 3], ...TAUGHT, ...PLAIN, safe: true, walk: true, far: 2, brief: 'steps cost nothing: the die to roll is two steps away' },
  { slot: 106, id: 'T06', chapter: 0, size: 3, dice: 3, faces: [3], par: [2, 3], depth: [1, 3], ...TAUGHT, ...PLAIN, safe: true, stay: 1, movers: 2, firsts: [1, 12], brief: 'two dice have to roll, each in its turn' },
  { slot: 107, id: 'T07', chapter: 0, size: 3, dice: 4, faces: [2], par: [2, 2], depth: [1, 3], ...TAUGHT, ...LESSON, combos: 2, traps: [0, 0], lesson: 'lineWalk', guide: true, until: 'end', brief: 'a pair is leaving under my feet, and I walk over it to the rest' },
  { slot: 108, id: 'T08', chapter: 0, size: 4, dice: 6, faces: [3], par: [2, 3], depth: [1, 3], ...TAUGHT, ...PLAIN, combos: 2, tail: [0, 2], brief: 'the same with 3s: the board empties in two goes' },
  { slot: 109, id: 'T09', chapter: 0, size: 4, dice: 6, faces: [2], par: [3, 5], depth: [1, 3], ...TAUGHT, casual: [0.85, 1], combos: 3, tail: [0, 1], brief: 'three pairs in a row and the board is clean: the end of the course' },
];

/**
 * The first chapter: nine levels that bring two ways to read a die. A face on the side rides
 * there while the die is rolled along, and a turn lays it on top; the face at the bottom is seven
 * less the one on top. A lesson, two easy levels, a small peak; a lesson, two easy levels, the
 * two together, and the peak of the chapter. Every board has as many dice as its combos take:
 * the chain has not been taught.
 */
export const CHAPTER_ONE: readonly Recipe[] = [
  { slot: 201, id: 'C101', chapter: 1, size: 3, dice: 3, faces: [3], standing: [{ value: 3, count: 2 }], par: [2, 3], depth: [1, 4], ...TAUGHT, compact: false, safe: true, ownOnly: true, ride: true, front: true, lesson: 'lineSide', guide: true, until: 'combo', brief: 'the face on the side rides with me; the turn lays it on top' },
  { slot: 202, id: 'C102', chapter: 1, size: 3, dice: 2, faces: [2], par: [2, 3], depth: [1, 4], ...TAUGHT, compact: false, ...PLAIN_ONE, safe: true, ownOnly: true, ride: true, brief: 'the same with a 2, and no arrow' },
  { slot: 203, id: 'C103', chapter: 1, size: 4, dice: 4, faces: [4], standing: [{ value: 4, count: 3 }], par: [3, 4], depth: [1, 4], ...TAUGHT, compact: false, ...PLAIN_ONE, safe: true, ownOnly: true, ride: true, brief: 'a 4 carried on the side across the board' },
  { slot: 204, id: 'C104', chapter: 1, size: 4, dice: 6, faces: [3], par: [3, 5], depth: [1, 4], ...TAUGHT, casual: [0.7, 0.9], combos: 2, firsts: [2, 20], tail: [0, 2], brief: 'a small peak: two combos, and a die to turn for each' },
  { slot: 205, id: 'C105', chapter: 1, size: 3, dice: 3, faces: [3], standing: [{ value: 3, count: 2 }], par: [2, 2], depth: [1, 4], ...TAUGHT, compact: false, under: true, safe: true, ownOnly: true, seven: true, lesson: 'lineSeven', guide: true, until: 'combo', brief: 'the 3 is under the 4; two rolls one way bring it up' },
  { slot: 206, id: 'C106', chapter: 1, size: 3, dice: 2, faces: [2], par: [2, 2], depth: [1, 4], ...TAUGHT, compact: false, ...PLAIN_ONE, under: true, safe: true, ownOnly: true, seven: true, brief: 'the 2 is under the 5' },
  { slot: 207, id: 'C107', chapter: 1, size: 4, dice: 5, faces: [5], standing: [{ value: 5, count: 4 }], par: [1, 2], depth: [1, 4], ...TAUGHT, under: undefined, casual: [0.8, 1], safe: true, brief: 'a gift: five 5s go at once' },
  { slot: 208, id: 'C108', chapter: 1, size: 4, dice: 4, faces: [2], par: [3, 6], depth: [1, 4], ...TAUGHT, under: true, casual: [0.7, 0.9], combos: 2, tail: [0, 2], brief: 'the two together: one die is read by seven, another rides' },
  { slot: 209, id: 'C109', chapter: 1, size: 4, dice: 6, faces: [3], par: [4, 7], depth: [1, 5], ...TAUGHT, under: undefined, casual: [0.5, 0.85], combos: 2, firsts: [1, 20], tail: [0, 3], traps: [0.2, 1], brief: 'the peak of the chapter: two combos clear the board, and the greedy move ends in a dead end' },
];

/** The places of the course and of the chapters that follow it, in the order of the ladder. */
export const PLACES: readonly Recipe[] = [...COURSE, ...CHAPTER_ONE];

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
