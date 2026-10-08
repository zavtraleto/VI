import type { Score } from '../rules/levelScore';
import type { Ban } from '../rules/reach';
import type { LevelLayout, LevelSpec, Technique } from '../rules/types';

/**
 * One event of the route a board is built for: what goes, what the die that sets it off is moved
 * by, and how far that die and the others of the scene start from their places. A board is laid
 * from its route backwards (`route.ts`): every scene is put down as it stands at the moment of
 * its event, and its dice are then taken away from there, rolled or slid.
 */
export interface Scene {
  /** A combo; a die that joins the combo of the scene before it; or the 1s, swept by a 1 brought to that combo. */
  event: 'combo' | 'link' | 'ones';
  /** The face of a combo or of a link. */
  face?: number;
  /** Dice of a combo, as many as its face has pips unless said. For the 1s: those that stand, besides the one brought. */
  dice?: number;
  /** The die that sets the event off is rolled there from on top, or pushed there from the floor. */
  by: 'roll' | 'push';
  /** Moves that die makes to get there, from so many to so many: one unless said. Pushes go along one line. */
  moves?: readonly [number, number];
  /** Other dice of the scene that are rolled away from their places as well, and the rolls each makes: one or two unless said. */
  loose?: number;
  looseMoves?: readonly [number, number];
  /** The die that sets the event off is rolled away along one line where it can be: two such rolls leave its face at the bottom. */
  straight?: boolean;
  /** Laid where it touches no die laid before it: no step leads to it from them. */
  apart?: boolean;
}

/**
 * What a place among the levels asks of a board: what is laid on it, and what the board laid has
 * to come to when it is solved and played by the players made of the rules. A board is looked
 * for among the ones laid by these rules; nothing here is a board yet.
 *
 * A place is a form: what the player is to feel there, told by the route of the way and by its
 * score. The bounds on the score are what the form is known by, and none of them is widened
 * when a place gets no board: it says which one turned its candidates away.
 */
export interface Recipe {
  slot: number;
  /** The chapter the place is in, from 0: the number its level names its chapter with. */
  chapter?: number;
  size: number;
  /** Cells cut out of the square of the board, each as its x and z: the shape of the board is the place's own. */
  holes?: readonly (readonly [number, number])[];
  dice: number;
  /** Dice the board may hold over `dice`: a place that asks for "two or three" has one. */
  more?: number;
  /**
   * Faces the level is about: its groups are made of them, and they are the only faces that
   * work. Half the dice that are not named otherwise start with one of them on top, the other
   * half with another face; 1 excluded: ones are counted apart.
   */
  faces: readonly number[];
  /** Dice that start showing a 1; on a board built from its route, a mark that the 1s work. */
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

  /** The route the board is built for, its first event first: seeds above `FROM_ROUTE` lay it scene by scene. */
  scenes?: readonly Scene[];
  /** The kinds of route the way kept may be of. */
  kinds?: readonly Score['kind'][];
  /** Moves of the way before its first event, and from it on. */
  quiet?: readonly [number, number];
  counted?: readonly [number, number];
  /** Dice the last event takes, and links of the longest chain. */
  last?: readonly [number, number];
  links?: readonly [number, number];
  /** Moves with no event between two events, at the most: the quiet before the first is not counted. */
  silence?: number;
  /** How the way ends: the event of its last move, what the move is made with, and the moves a link had to spare. */
  ends?: { event: 'combo' | 'link' | 'ones'; how?: 'roll' | 'push'; spare?: number };
  /** What the route of the way kept has to read as, in its signs: a pattern. */
  route?: string;
  /** Parts of the route the board makes its player use: none has a way round within a move over the fewest. */
  parts?: readonly Ban[];
  /** Free cells the board starts with. */
  room?: readonly [number, number];
  /** No die starts showing a face that works. */
  blind?: boolean;
  /** Share of the dice that start with a working face at the bottom, at the least. */
  underShare?: number;
  /**
   * A combo that can be made within the first two moves leaves a board that cannot be cleared.
   * `floor`: it does so by leaving the player on it with no die to step to.
   */
  trap?: 'any' | 'floor';
  /** No one face of the level clears the board alone within two moves over the fewest. */
  bothFaces?: boolean;
  /** At the start a combo of one face lacks a single die, and on the way kept a die of it goes showing another face. */
  decoy?: boolean;
  /** Clusters the dice start in, joined by their sides, at the least. */
  islands?: number;
}

/** Moves a die that has joined a group takes to go on a level, and the moves a new link holds the others for. */
export const LADDER_SINK_MOVES = 2;
export const LADDER_LIFT_MOVES = 1;

/**
 * A chapter of the levels: how generous the limit of moves of its levels is, whether stars open
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
 * The chapters of the levels, by the number a level names its chapter with. There is one: the
 * probe, a batch of levels made to find what a level of this game is. It is played by one who
 * knows the rules, so it teaches nothing, is open from its first level to its last, and gives a
 * generous limit of moves. The course and the chapters that taught, and the ladder as it was,
 * are in the history: commit 534b3ea.
 */
export const CHAPTERS: readonly ChapterRule[] = [{ key: 'probe', times: 5, gate: false, floor: true, guard: 'none' }];

/** What every place of the probe asks for besides its form: a way with an end that is not drawn out, no long silence under the count, and a board that is not cleared by fiddling. */
const PROBE: Pick<Recipe, 'chapter' | 'compact' | 'tail' | 'silence' | 'random'> = { chapter: 0, compact: false, tail: [0, 2], silence: 3, random: [0, 0.1] };
/** A way that stays up on the dice: the fewest moves do not lean on the floor, nor on the 1s. */
const ON_TOP: Pick<Recipe, 'avoid'> = { avoid: ['floor', 'ones'] };

/**
 * The places of the probe: ten forms, two boards of each that differ in the face or in the
 * board. A form is what the player is to feel; its route is where the player is on the way: up
 * on the dice, down on the floor, on a combo that is leaving. The forms and what tells each
 * apart are in docs/VI_Levels_Routes_Brief.md, section 5; which place is which form is in the
 * key, docs/VI_Levels_Probe_Key.md, and nowhere the levels themselves say it. The order was
 * shuffled once and is kept: two boards of a form do not stand side by side, and the quiet ones
 * take turns with those played under the count.
 *
 * `brief` names the form in a word and what the board is to make of it. These twenty are on
 * square boards; the ten after them are on boards of other shapes (`UNUSUAL`).
 */
const SQUARE: readonly Recipe[] = [
  {
    slot: 1, id: 'P01', ...PROBE, ...ON_TOP, compact: true, size: 3, dice: 4, faces: [3], par: [5, 7],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2], loose: 1 }, { event: 'link', face: 3, by: 'roll', moves: [1, 2] }],
    kinds: ['top'], quiet: [3, 6], counted: [1, 2], movers: 2,
    brief: 'collapse: three quiet moves and more, then everything goes in the last two',
  },
  {
    slot: 2, id: 'P02', ...PROBE, ...ON_TOP, size: 4, dice: 4, faces: [2], par: [2, 5],
    scenes: [{ event: 'combo', face: 2, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 2, by: 'roll', moves: [1, 2] }],
    kinds: ['bridge'], parts: ['bridge'], islands: 2,
    brief: 'bridge: the second pair is come to over the first while it is leaving',
  },
  {
    slot: 3, id: 'P03', ...PROBE, ...ON_TOP, compact: true, size: 3, dice: 3, faces: [3], par: [4, 8],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [2, 2], loose: 2, looseMoves: [1, 1], straight: true }],
    kinds: ['top'], blind: true, underShare: 0.3, firsts: [1, 2],
    brief: 'seven, blind: no 3 is to be seen, and one of them lies under',
  },
  {
    slot: 4, id: 'P04', ...PROBE, ...ON_TOP, size: 4, dice: 6, faces: [5], par: [3, 6],
    scenes: [{ event: 'combo', face: 5, by: 'roll', moves: [1, 2] }, { event: 'link', face: 5, by: 'roll', moves: [2, 2] }],
    kinds: ['top'], needs: ['link'], ends: { event: 'link', how: 'roll', spare: 0 },
    brief: 'rescue: one die too many, brought to the combo on the last move it can be',
  },
  {
    slot: 5, id: 'P05', ...PROBE, ...ON_TOP, compact: true, size: 3, dice: 6, faces: [3], par: [4, 8],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2], loose: 1 }, { event: 'combo', face: 3, by: 'roll', moves: [1, 2], loose: 1 }],
    kinds: ['top', 'bridge'], room: [2, 3], quiet: [2, 7],
    brief: 'a tight room: three free cells, and no combo before the third move',
  },
  {
    slot: 6, id: 'P06', ...PROBE, size: 4, dice: 5, faces: [2], par: [3, 6],
    scenes: [{ event: 'combo', face: 2, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 2, by: 'push', apart: true }, { event: 'link', face: 2, by: 'roll', moves: [1, 2] }],
    kinds: ['downAndUp'], route: 'P.*\\^', parts: ['push', 'up'],
    brief: 'down and back: a push makes a pair, and the player comes up by it',
  },
  {
    slot: 7, id: 'P07', ...PROBE, ...ON_TOP, compact: true, size: 3, dice: 5, faces: [2, 3], par: [3, 6],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2], loose: 1 }, { event: 'combo', face: 2, by: 'roll', moves: [1, 2] }],
    kinds: ['top', 'bridge'], bothFaces: true, decoy: true,
    brief: 'the count of channels: five dice are a pair and a three, and the combo nearly made is the wrong one',
  },
  {
    slot: 8, id: 'P08', ...PROBE, ...ON_TOP, size: 4, dice: 5, faces: [2], par: [4, 7],
    scenes: [{ event: 'combo', face: 2, by: 'roll', moves: [1, 2] }, { event: 'link', face: 2, by: 'roll' }, { event: 'link', face: 2, by: 'roll', moves: [1, 2] }, { event: 'link', face: 2, by: 'roll', moves: [1, 2] }],
    kinds: ['top', 'bridge'], links: [3, 4], silence: 1,
    brief: 'a long chain: three links one after another, a move between them at the most',
  },
  {
    slot: 9, id: 'P09', ...PROBE, ...ON_TOP, size: 4, dice: 6, faces: [3], par: [3, 6],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2], loose: 1 }, { event: 'combo', face: 3, by: 'roll', moves: [1, 2] }],
    kinds: ['top', 'bridge'], trap: 'any', traps: [0.3, 1],
    brief: 'a trap of order: the combo at hand is made first, and the board is lost by it',
  },
  {
    slot: 10, id: 'P10', ...PROBE, size: 4, dice: 6, faces: [3], ones: 3, par: [3, 6],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2] }, { event: 'ones', by: 'push', dice: 2, loose: 1 }],
    kinds: ['downLast'], ends: { event: 'ones', how: 'push' }, parts: ['ones'],
    brief: 'the broom: the dice left over are 1s, and one push to the leaving combo sweeps them',
  },
  {
    slot: 11, id: 'P11', ...PROBE, ...ON_TOP, size: 4, dice: 2, faces: [2], par: [4, 6],
    scenes: [{ event: 'combo', face: 2, by: 'roll', moves: [2, 2], loose: 1, looseMoves: [2, 2], straight: true }],
    kinds: ['top'], blind: true, underShare: 0.5, firsts: [1, 2],
    brief: 'seven, blind: two dice, no 2 to be seen, one of them lies under',
  },
  {
    slot: 12, id: 'P12', ...PROBE, size: 4, dice: 6, faces: [2, 3], par: [3, 6],
    scenes: [{ event: 'combo', face: 2, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 3, by: 'push', apart: true }, { event: 'link', face: 3, by: 'roll', moves: [1, 2] }],
    kinds: ['downAndUp'], route: 'P.*\\^', parts: ['push', 'up'],
    brief: 'down and back with two faces: a pair lets the player down, a push makes the three',
  },
  {
    slot: 13, id: 'P13', ...PROBE, ...ON_TOP, compact: true, size: 4, dice: 6, faces: [6], par: [4, 7],
    scenes: [{ event: 'combo', face: 6, by: 'roll', moves: [2, 3], loose: 1, looseMoves: [1, 2] }],
    kinds: ['top'], quiet: [3, 6], counted: [1, 1], last: [6, 6], movers: 2,
    brief: 'collapse on a big board: six dice go with one move',
  },
  {
    slot: 14, id: 'P14', ...PROBE, size: 4, dice: 5, faces: [4], par: [3, 6],
    scenes: [{ event: 'combo', face: 4, by: 'roll', moves: [1, 2] }, { event: 'link', face: 4, by: 'push', moves: [2, 2] }],
    kinds: ['downLast'], needs: ['link'], ends: { event: 'link', how: 'push', spare: 0 }, parts: ['push'],
    brief: 'rescue from below: the fifth die shows its 4 already and is pushed home on the last move',
  },
  {
    slot: 15, id: 'P15', ...PROBE, ...ON_TOP, compact: true, size: 3, dice: 7, faces: [2, 3], par: [4, 8],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2], loose: 1 }, { event: 'combo', face: 2, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 2, by: 'roll', moves: [1, 2] }],
    kinds: ['top', 'bridge'], room: [2, 2], quiet: [2, 7],
    brief: 'a tight room of two faces: two free cells',
  },
  {
    slot: 16, id: 'P16', ...PROBE, ...ON_TOP, size: 4, dice: 6, faces: [3], par: [2, 6],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 3, by: 'roll', moves: [1, 2] }],
    kinds: ['bridge'], parts: ['bridge'], islands: 2,
    brief: 'bridge of 3s: the second three is come to over the first',
  },
  {
    slot: 17, id: 'P17', ...PROBE, ...ON_TOP, compact: true, size: 4, dice: 7, faces: [3, 4], par: [3, 7],
    scenes: [{ event: 'combo', face: 4, by: 'roll', moves: [1, 2], loose: 1 }, { event: 'combo', face: 3, by: 'roll', moves: [1, 2] }],
    kinds: ['top', 'bridge'], bothFaces: true, decoy: true,
    brief: 'the count of channels: seven dice are a four and a three',
  },
  {
    slot: 18, id: 'P18', ...PROBE, size: 4, dice: 6, faces: [4], ones: 2, par: [3, 7],
    scenes: [{ event: 'combo', face: 4, by: 'roll', moves: [1, 2], loose: 1 }, { event: 'ones', by: 'push', dice: 1, loose: 1 }],
    kinds: ['downLast'], ends: { event: 'ones', how: 'push' }, parts: ['ones'],
    brief: 'the broom with 4s: a die has to be turned to a 1 before it can be swept',
  },
  {
    slot: 19, id: 'P19', ...PROBE, size: 4, dice: 6, faces: [3], par: [3, 6],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 3, by: 'push', apart: true }],
    kinds: ['downLast', 'downAndUp', 'other'], trap: 'floor', traps: [0.3, 1],
    brief: 'a trap of order by the floor: the three at hand leaves the player with nowhere to step',
  },
  {
    slot: 20, id: 'P20', ...PROBE, ...ON_TOP, size: 4, dice: 7, faces: [3], par: [5, 8],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2] }, { event: 'link', face: 3, by: 'roll' }, { event: 'link', face: 3, by: 'roll', moves: [1, 2] }, { event: 'link', face: 3, by: 'roll', moves: [1, 2] }, { event: 'link', face: 3, by: 'roll', moves: [1, 2] }],
    kinds: ['top', 'bridge'], links: [4, 4], silence: 1,
    brief: 'a long chain of 3s: four links',
  },
];

/**
 * The cells cut out of a board, read off its picture: a row of the picture is a row of the
 * board from the north, `#` is a cell and `.` a cell that is not there.
 */
export function cutFrom(picture: readonly string[]): [number, number][] {
  return picture.flatMap((row, z) => [...row].flatMap((sign, x): [number, number][] => (sign === '#' ? [] : [[x, z]])));
}

/*
 * A board that is longer than it is wide lies across the middle of its square: the picture of the
 * game is centred on the square, and a board up against one side of it would stand off to that side.
 */
/** A corner: a board bent like the letter L. */
const ELL = cutFrom(['####', '####', '##..', '##..']);
/** Two rooms and one cell between them. */
const ISTHMUS = cutFrom(['.....', '##.##', '#####', '##.##', '.....']);
/** A room with a corridor a cell wide: a die rolled along it shows four of its six faces and no other. */
const CORRIDOR = cutFrom(['.....', '###..', '#####', '###..', '.....']);
/** A board two cells wide and five long. */
const NARROW = cutFrom(['.....', '#####', '#####', '.....', '.....']);
/** A room with a pocket of one cell, and a smaller room with the same. */
const POCKET = cutFrom(['.#..', '###.', '###.', '###.']);
const NOOK = cutFrom(['.#..', '###.', '###.', '....']);

/**
 * The places of the second batch: ten boards that are not squares, every one a form that has a
 * place on a square board already, each form once. The board is a square with cells cut out of
 * it, and a cell that is not there is an edge. The shape and the form are not changed in one
 * level: nothing here is a new rule, and what the shape adds is where the edge is.
 */
const UNUSUAL: readonly Recipe[] = [
  {
    slot: 21, id: 'P21', ...PROBE, ...ON_TOP, compact: true, size: 4, holes: ELL, dice: 4, faces: [4], par: [4, 7],
    scenes: [{ event: 'combo', face: 4, by: 'roll', moves: [2, 3], loose: 1, looseMoves: [1, 2] }],
    kinds: ['top'], quiet: [3, 6], counted: [1, 1], last: [4, 4], movers: 2,
    brief: 'collapse on a corner: four dice go with one move',
  },
  {
    slot: 22, id: 'P22', ...PROBE, ...ON_TOP, size: 5, holes: ISTHMUS, dice: 6, faces: [3], par: [2, 6],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 3, by: 'roll', moves: [1, 2] }],
    kinds: ['bridge'], parts: ['bridge'], islands: 2,
    brief: 'bridge over an isthmus: two rooms, and the second three is come to over the first',
  },
  {
    slot: 23, id: 'P23', ...PROBE, ...ON_TOP, compact: true, size: 5, holes: CORRIDOR, dice: 3, faces: [3], par: [4, 8],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [2, 2], loose: 2, looseMoves: [1, 1], straight: true }],
    kinds: ['top'], blind: true, underShare: 0.3, firsts: [1, 2],
    brief: 'seven, blind, by a corridor: no 3 is to be seen',
  },
  {
    slot: 24, id: 'P24', ...PROBE, ...ON_TOP, size: 5, holes: NARROW, dice: 5, faces: [2], par: [4, 7],
    scenes: [{ event: 'combo', face: 2, by: 'roll', moves: [1, 2] }, { event: 'link', face: 2, by: 'roll' }, { event: 'link', face: 2, by: 'roll', moves: [1, 2] }, { event: 'link', face: 2, by: 'roll', moves: [1, 2] }],
    kinds: ['top', 'bridge'], links: [3, 4], silence: 1,
    brief: 'a long chain on a narrow board: three links with nowhere to turn',
  },
  {
    slot: 25, id: 'P25', ...PROBE, ...ON_TOP, size: 4, holes: POCKET, dice: 4, faces: [3], par: [3, 6],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2] }, { event: 'link', face: 3, by: 'roll', moves: [2, 2] }],
    kinds: ['top'], needs: ['link'], ends: { event: 'link', how: 'roll', spare: 0 },
    brief: 'rescue by a pocket: the fourth die comes to the combo on the last move it can',
  },
  {
    slot: 26, id: 'P26', ...PROBE, size: 5, holes: ISTHMUS, dice: 5, faces: [2], par: [3, 6],
    scenes: [{ event: 'combo', face: 2, by: 'roll', moves: [1, 2] }, { event: 'combo', face: 2, by: 'push', apart: true }, { event: 'link', face: 2, by: 'roll', moves: [1, 2] }],
    kinds: ['downAndUp'], route: 'P.*\\^', parts: ['push', 'up'],
    brief: 'down and back over an isthmus: a push makes a pair in the other room',
  },
  {
    slot: 27, id: 'P27', ...PROBE, ...ON_TOP, compact: true, size: 4, holes: ELL, dice: 5, faces: [2, 3], par: [3, 6],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2], loose: 1 }, { event: 'combo', face: 2, by: 'roll', moves: [1, 2] }],
    kinds: ['top', 'bridge'], bothFaces: true, decoy: true,
    brief: 'the count of channels on a corner: a pair and a three',
  },
  {
    slot: 28, id: 'P28', ...PROBE, ...ON_TOP, size: 5, holes: NARROW, dice: 6, faces: [3], par: [3, 6],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2], loose: 1 }, { event: 'combo', face: 3, by: 'roll', moves: [1, 2] }],
    kinds: ['top', 'bridge'], trap: 'any', traps: [0.3, 1],
    brief: 'a trap of order on a narrow board',
  },
  {
    slot: 29, id: 'P29', ...PROBE, ...ON_TOP, compact: true, size: 4, holes: NOOK, dice: 5, faces: [2, 3], par: [4, 8],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2], loose: 1 }, { event: 'combo', face: 2, by: 'roll', moves: [1, 2] }],
    kinds: ['top', 'bridge'], room: [2, 2], quiet: [2, 7],
    brief: 'a tight room with a nook: seven cells, five dice',
  },
  {
    slot: 30, id: 'P30', ...PROBE, size: 5, holes: CORRIDOR, dice: 6, faces: [3], ones: 3, par: [3, 6],
    scenes: [{ event: 'combo', face: 3, by: 'roll', moves: [1, 2] }, { event: 'ones', by: 'push', dice: 2, loose: 1 }],
    kinds: ['downLast'], ends: { event: 'ones', how: 'push' }, parts: ['ones'],
    brief: 'the broom by a corridor: a 1 is pushed to the leaving combo',
  },
];

/** The places of the levels, in the order of the list: the batch on square boards, then the one on boards of other shapes. */
export const PLACES: readonly Recipe[] = [...SQUARE, ...UNUSUAL];

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
