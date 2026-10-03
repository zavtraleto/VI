import { DIRS, cellIndex, cubeAt, inChain, neighbours } from './board';
import { resolveMove, type MoveIntent } from './movement';
import { previewMove } from './preview';
import { nextRandom } from './rng';
import type { Cube, Dir, MoveKind, RunState } from './types';

/**
 * A player made of the rules, to see what a pace does without a person at it. It plays the
 * way a person does: it looks at the board, finds a way to a clear some moves ahead, walks it
 * with the same commands a person gives, and looks again. It knows every rule, since it tries
 * its moves with the rules themselves; what makes it a novice or a pro is how far it sees,
 * how long it looks, how often it overlooks a way or presses the wrong key, and whether it
 * takes the nearest clear or the richest one.
 *
 * It is a person in its failings too. A die turned over in the head is easy to get wrong: a
 * way with several rolls in it, or one that turns up a face the camera does not show, is
 * overlooked more often than a roll that brings up a face in plain sight. A crowded board
 * takes longer to read. And now and then the player just drifts off for a moment.
 *
 * It looks at a board that stands still: what will have risen or gone by the time it gets
 * there it finds out on the way, as a person does, and then it looks again. It never reads
 * the run's generator, so it cannot know what comes next.
 */
export interface Skill {
  /**
   * Moves ahead the player sees a clear from, how many of them may be rolls or pushes, and the
   * positions they can go through looking for one. Walking over the dice to another one is
   * easy to see; every die turned over on the way is what takes a head for it.
   */
  depth: number;
  rolls: number;
  budget: number;
  /**
   * Ticks the player looks at the board before walking a way they have found: from, to; more
   * for every move of the way, and for every cube on the board over the number it is kept at.
   */
  think: readonly [number, number];
  thinkPerMove: number;
  thinkPerCube: number;
  /** Ticks between two moves of a way, on top of the time a move takes: from, to. */
  pause: readonly [number, number];
  /** Ticks before a move made with nothing to clear in sight: from, to. */
  idle: readonly [number, number];
  /**
   * Share of the ways to a clear the player overlooks, and the share lost again with every
   * roll that has to be worked out: one after the first, or one that turns up a hidden face.
   */
  miss: number;
  missPerRoll: number;
  /** How often a look at the board is lost to a drift of attention, and the ticks it takes: from, to. */
  lapse: number;
  lapseTicks: readonly [number, number];
  /** Share of moves that go astray: a wrong key. */
  slip: number;
  /** 0 takes the nearest clear whatever it gives; 1 weighs the points of a clear against its moves. */
  greed: number;
  /** With nothing to clear in sight, rolls a die to where it pairs up rather than anywhere. */
  tidy: boolean;
}

export const SKILLS = {
  /**
   * Has just been shown the rules and hardly sees them on the board: a clear one roll away, a
   * face in plain sight, and even that half the time. Looks long, moves once in 0.5 to 0.8 s,
   * rolls about at random in between and drifts off often.
   */
  newbie: {
    depth: 3, rolls: 1, budget: 80, think: [75, 175], thinkPerMove: 30, thinkPerCube: 3, pause: [14, 30], idle: [25, 70],
    miss: 0.45, missPerRoll: 0.8, lapse: 0.16, lapseTicks: [60, 180], slip: 0.12, greed: 0, tidy: false,
  },
  /**
   * Walks a few dice to a clear that is one roll away, and sees that roll best when the face
   * is in plain sight. Looks for a second or two, moves once in 0.4 to 0.65 s.
   */
  novice: {
    depth: 4, rolls: 2, budget: 160, think: [50, 120], thinkPerMove: 20, thinkPerCube: 2, pause: [10, 22], idle: [15, 45],
    miss: 0.3, missPerRoll: 0.6, lapse: 0.1, lapseTicks: [50, 150], slip: 0.07, greed: 0, tidy: true,
  },
  /** Sees a clear two rolls away and takes a chain when one is at hand: a move in 0.3 to 0.45 s. */
  average: {
    depth: 6, rolls: 2, budget: 320, think: [28, 65], thinkPerMove: 10, thinkPerCube: 1.5, pause: [4, 10], idle: [8, 25],
    miss: 0.2, missPerRoll: 0.4, lapse: 0.06, lapseTicks: [40, 100], slip: 0.04, greed: 0.5, tidy: true,
  },
  /** Reads three rolls deep, stops little, plays for chains: a move in 0.25 to 0.3 s. */
  pro: {
    depth: 7, rolls: 3, budget: 700, think: [15, 40], thinkPerMove: 6, thinkPerCube: 1, pause: [2, 5], idle: [4, 12],
    miss: 0.08, missPerRoll: 0.2, lapse: 0.02, lapseTicks: [25, 60], slip: 0.02, greed: 1, tidy: true,
  },
  /**
   * Plays for a living: reads four rolls deep, misses next to nothing, never stops, and moves
   * as fast as the game takes moves. The ceiling of what a person can do with these rules.
   */
  esports: {
    depth: 8, rolls: 4, budget: 1200, think: [6, 16], thinkPerMove: 3, thinkPerCube: 0.5, pause: [0, 2], idle: [2, 6],
    miss: 0.03, missPerRoll: 0.08, lapse: 0.005, lapseTicks: [15, 40], slip: 0.005, greed: 1, tidy: true,
  },
} as const satisfies Record<string, Skill>;

export type SkillName = keyof typeof SKILLS;

/** The players, the weakest first. */
export const SKILL_NAMES = Object.keys(SKILLS) as SkillName[];

/** A way to a clear: the moves, what each of them is, and what the clear at its end gives. */
export interface Plan {
  moves: Dir[];
  kinds: MoveKind[];
  points: number;
  /** The link of the chain the clear is: 1 for a group of its own. */
  chain: number;
}

/** Rolls that turn up a face the camera does not show: the north one going south, the west one going east. */
const HIDDEN_ROLLS: readonly Dir[] = ['S', 'E'];

/**
 * The chance that a player notices a way to a clear. A step onto another die or a push leaves
 * the top of the die in sight; a roll has to be seen ahead, and the first one is plain only
 * when it turns up a face the camera shows.
 */
export function sight(skill: Skill, plan: Plan): number {
  let rolls = 0;
  let workedOut = 0;
  plan.kinds.forEach((kind, i) => {
    if (kind !== 'roll') return;
    rolls++;
    if (rolls > 1 || HIDDEN_ROLLS.includes(plan.moves[i])) workedOut++;
  });
  return (1 - skill.miss) * Math.pow(1 - skill.missPerRoll, workedOut);
}

/**
 * Ticks a look at the board takes on top of the player's usual: more for a longer way, and
 * more for a board that holds more cubes than it is kept at.
 */
export function lookTicks(skill: Skill, cubes: number, target: number, moves: number): number {
  return skill.thinkPerMove * moves + skill.thinkPerCube * Math.max(0, cubes - target);
}

/** Steps that leave the player up on a cube; the others leave them on the floor. */
const UP: readonly MoveKind[] = ['roll', 'hop', 'mount', 'climb'];

/** A copy of the run to try moves on: the cubes, the grid and the player are its own. */
function sketch(state: RunState): RunState {
  const { x, z, level } = state.player;
  return { ...state, cubes: state.cubes.map((cube) => ({ ...cube })), grid: state.grid.slice(), player: { x, z, level } };
}

/** Makes a step on a sketch at once, as the board will stand when the step is over. Nothing clears on a sketch. */
function make(board: RunState, intent: MoveIntent): void {
  const size = board.config.size;
  const { cube, cubeX, cubeZ, newOri, over, displaced, displaceTo } = intent;
  if (cube && newOri && cubeX !== undefined && cubeZ !== undefined) {
    if (over) {
      board.grid[cellIndex(size, over.x, over.z)] = 0;
      board.cubes = board.cubes.filter((c) => c !== over);
    }
    if (displaced && displaceTo) {
      board.grid[cellIndex(size, displaced.x, displaced.z)] = 0;
      displaced.x = displaceTo.x;
      displaced.z = displaceTo.z;
      board.grid[cellIndex(size, displaced.x, displaced.z)] = displaced.id;
    }
    board.grid[cellIndex(size, cube.x, cube.z)] = 0;
    cube.x = cubeX;
    cube.z = cubeZ;
    cube.ori = newOri;
    board.grid[cellIndex(size, cubeX, cubeZ)] = cube.id;
  }
  board.player = { x: intent.tx, z: intent.tz, level: UP.includes(intent.kind as MoveKind) ? 'top' : 'ground' };
}

/** What the clear a cube has just made gives, by the rules of the score: its points and its link of the chain. */
function worth(board: RunState, cube: Cube, over: Cube | undefined): { points: number; chain: number } {
  const value = cube.ori.top;
  if (value === 1) {
    if (board.config.experiments.soloOne) return { points: 1, chain: 1 };
    const { player } = board;
    const own = player.level === 'top' ? cubeAt(board, player.x, player.z) : undefined;
    return { points: board.cubes.filter((c) => c.state === 'idle' && c.ori.top === 1 && c !== own).length, chain: 1 };
  }
  const group = [cube];
  const seen = new Set<number>([cube.id]);
  const touched = new Set<number>();
  if (over && over.reactionId !== 0 && over.ori.top === value) touched.add(over.reactionId);
  for (let i = 0; i < group.length; i++) {
    for (const n of neighbours(board, group[i].x, group[i].z)) {
      if (n.ori.top !== value) continue;
      if (inChain(n)) touched.add(n.reactionId);
      else if (n.state === 'idle' && !seen.has(n.id)) {
        seen.add(n.id);
        group.push(n);
      }
    }
  }
  const joined = board.reactions.filter((r) => touched.has(r.id));
  if (joined.length === 0) return { points: value * group.length, chain: 1 };
  const chain = Math.max(...joined.map((r) => r.chain)) + 1;
  const total = joined.reduce((sum, r) => sum + r.total, 0) + group.length;
  return { points: value * total * chain, chain };
}

/** A position reached while looking, and how it differs from the one the look began at. */
interface Reached {
  board: RunState;
  moves: Dir[];
  kinds: MoveKind[];
  /** Cubes that are not where they were: where and how each lies now. */
  changed: Record<number, string>;
  /** Rolls and pushes made on the way. */
  turned: number;
}

function signature(node: Reached): string {
  const { x, z, level } = node.board.player;
  const cubes = Object.keys(node.changed)
    .sort()
    .map((id) => `${id}:${node.changed[Number(id)]}`);
  return `${x},${z},${level}|${cubes.join(';')}`;
}

/**
 * Goes through the positions the player can get to, the nearest first, trying every step
 * with the rules themselves on a board that stands still. `visit` is told of every step that
 * can be made and says whether the look is over. A step that clears is not looked past: the
 * cubes go down with it and the board is no longer the one that was looked at. No way holds
 * more than `rolls` rolls and pushes.
 */
function look(
  state: RunState,
  depth: number,
  rolls: number,
  budget: number,
  visit: (after: Reached, clears: boolean, cube: Cube | undefined, over: Cube | undefined) => boolean,
): void {
  const root: Reached = { board: sketch(state), moves: [], kinds: [], changed: {}, turned: 0 };
  const seen = new Set<string>([signature(root)]);
  let front = [root];
  let tried = 0;
  for (let d = 0; d < depth && front.length > 0; d++) {
    const next: Reached[] = [];
    for (const node of front) {
      for (const dir of DIRS) {
        const preview = previewMove(node.board, dir);
        if (preview.kind === 'blocked') continue;
        const turned = node.turned + (preview.kind === 'roll' || preview.kind === 'push' ? 1 : 0);
        if (turned > rolls) continue;
        if (++tried > budget) return;
        const board = sketch(node.board);
        const intent = resolveMove(board, dir);
        const { cube, over, displaced } = intent;
        make(board, intent);
        const changed = { ...node.changed };
        if (cube) changed[cube.id] = `${cube.x},${cube.z},${cube.ori.top}${cube.ori.north}`;
        if (over) changed[over.id] = 'gone';
        if (displaced) changed[displaced.id] = `${displaced.x},${displaced.z}`;
        const after: Reached = { board, moves: [...node.moves, dir], kinds: [...node.kinds, intent.kind as MoveKind], changed, turned };
        if (visit(after, preview.clears, cube, over)) return;
        if (preview.clears) continue;
        const key = signature(after);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(after);
      }
    }
    front = next;
  }
}

/**
 * Ways to a clear from where the player is, the shortest first: no more than `depth` moves
 * long with no more than `rolls` rolls and pushes among them, found in no more than `budget`
 * steps tried, and no more than `want` of them.
 */
export function findPlans(state: RunState, depth: number, budget: number, want = 8, rolls = depth): Plan[] {
  const plans: Plan[] = [];
  look(state, depth, rolls, budget, (after, clears, cube, over) => {
    if (clears && cube) plans.push({ moves: after.moves, kinds: after.kinds, ...worth(after.board, cube, over) });
    return plans.length >= want;
  });
  return plans;
}

/** Steps tried on the way up: the floor of the board is small. */
const WAY_UP_BUDGET = 400;

/**
 * The shortest way from the floor, or from a cube that is going down, onto one that stands or
 * is coming up. Empty for a player who is on such a cube already; null when there is no way
 * within `depth` moves.
 */
export function findWayUp(state: RunState, depth: number): Dir[] | null {
  const standsUp = (board: RunState) => {
    const { player } = board;
    return player.level === 'top' && cubeAt(board, player.x, player.z)?.state !== 'sinking';
  };
  if (standsUp(state)) return [];
  let way: Dir[] | null = null;
  look(state, depth, depth, WAY_UP_BUDGET, (after) => {
    if (standsUp(after.board)) way = after.moves;
    return way !== null;
  });
  return way;
}

/** The player at the board: what it is like, and what it has in mind. */
export interface Bot {
  skill: Skill;
  /** Its own generator: the run's one is not touched, so the cubes come as they would to anybody. */
  rng: number;
  /** Moves it has made up its mind to make, the next one first, and what each should turn out to be. */
  moves: Dir[];
  kinds: (MoveKind | null)[];
  /** The last of those moves is meant to clear. */
  clears: boolean;
  /** Ticks it waits before its next move. */
  wait: number;
}

export function createBot(skill: Skill, seed: number): Bot {
  return { skill, rng: (seed ^ 0x5bd1e995) | 0, moves: [], kinds: [], clears: false, wait: 0 };
}

function between(bot: Bot, [from, to]: readonly [number, number]): number {
  return from + Math.floor(nextRandom(bot) * (to - from + 1));
}

function pick<T>(bot: Bot, items: readonly T[], weights?: readonly number[]): T {
  if (!weights) return items[Math.floor(nextRandom(bot) * items.length)];
  let roll = nextRandom(bot) * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Ways to a clear a player weighs against one another before taking one. */
const WANTED = 8;
/** Moves the way up may take: the floor is walked in a few steps. */
const WAY_UP_DEPTH = 12;
/** How much likelier a tidy player rolls a die to where it lies beside one that shows the same. */
const PAIRS_UP = 4;

/** A move with nothing to clear in sight: a roll or a step to somewhere else. */
function wander(bot: Bot, state: RunState): Dir | null {
  const { player } = state;
  const own = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
  const options: Dir[] = [];
  const weights: number[] = [];
  for (const dir of DIRS) {
    const intent = resolveMove(state, dir);
    if (intent.kind === 'blocked') continue;
    // The cube under the player is going down: any cube beside it that stands is the better place.
    if (own?.state === 'sinking' && intent.kind === 'hop' && cubeAt(state, intent.tx, intent.tz)?.state !== 'idle') continue;
    let weight = 1;
    if (bot.skill.tidy && intent.kind === 'roll' && intent.newOri && intent.cubeX !== undefined && intent.cubeZ !== undefined) {
      const top = intent.newOri.top;
      const pairs = neighbours(state, intent.cubeX, intent.cubeZ).some((n) => n !== own && n.state === 'idle' && n.ori.top === top);
      if (pairs && top >= 2) weight = PAIRS_UP;
    }
    options.push(dir);
    weights.push(weight);
  }
  return options.length > 0 ? pick(bot, options, weights) : null;
}

/** Looks at the board and makes up its mind: a way to a clear, or the way up, or a move to somewhere else. */
function decide(bot: Bot, state: RunState): void {
  const { skill } = bot;
  bot.moves = [];
  bot.kinds = [];
  bot.clears = false;
  if (nextRandom(bot) < skill.lapse) {
    bot.wait = between(bot, skill.lapseTicks);
    return;
  }
  const plans = findPlans(state, skill.depth, skill.budget, WANTED, skill.rolls).filter((plan) => nextRandom(bot) < sight(skill, plan));
  if (plans.length > 0) {
    // The nearest clear, or the one that gives the most for its moves.
    const value = (plan: Plan) => Math.pow(plan.points, skill.greed) / (plan.moves.length + 1);
    const best = plans.reduce((a, b) => (value(b) > value(a) ? b : a));
    bot.moves = [...best.moves];
    bot.kinds = [...best.kinds];
    bot.clears = true;
    bot.wait = between(bot, skill.think) + lookTicks(skill, state.cubes.length, state.config.targetCubes, best.moves.length);
    return;
  }
  const way = findWayUp(state, WAY_UP_DEPTH);
  if (way && way.length > 0) {
    bot.moves = way;
    bot.kinds = way.map(() => null);
  } else {
    const dir = wander(bot, state);
    if (dir) {
      bot.moves = [dir];
      bot.kinds = [null];
    }
  }
  bot.wait = between(bot, skill.idle);
}

/**
 * What the player presses on this tick, if anything. Asked on every tick of a run; the answer
 * goes to the game as the command of that tick, and nothing else of the run is touched.
 */
export function botCommand(bot: Bot, state: RunState): Dir | null {
  if (state.over || state.player.action) return null;
  if (bot.wait > 0) {
    bot.wait--;
    return null;
  }
  if (bot.moves.length === 0) {
    decide(bot, state);
    if (bot.wait > 0 || bot.moves.length === 0) return null;
  }
  // The board has moved on since it was looked at: is the next move still what it was?
  const dir = bot.moves[0];
  const seen = previewMove(state, dir);
  const expected = bot.kinds[0];
  const last = bot.moves.length === 1;
  if (seen.kind === 'blocked' || (expected !== null && seen.kind !== expected) || (last && bot.clears && !seen.clears)) {
    bot.moves = [];
    return null;
  }
  bot.moves.shift();
  bot.kinds.shift();
  bot.wait = between(bot, bot.skill.pause);
  if (nextRandom(bot) < bot.skill.slip) {
    // A wrong key: some other step the board allows, and the way is lost.
    const others = DIRS.filter((d) => d !== dir && resolveMove(state, d).kind !== 'blocked');
    if (others.length > 0) {
      bot.moves = [];
      return pick(bot, others);
    }
  }
  return dir;
}
