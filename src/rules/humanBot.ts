import { defaultConfig } from './config';
import { floorLost } from './level';
import { beliefOf, endingOf, personaMove, type Persona } from './levelBot';
import { moveOf, playMove, type SolverMove } from './levelSolver';
import { orientationKey } from './orientation';
import { scan } from './reach';
import { nextRandom, randomInt } from './rng';
import { createRun } from './sim';
import type { LevelSpec, Orientation, RunState } from './types';

/**
 * Players who solve a board as people do (docs/superpowers/specs/2026-11-04-vi-level-craft-design.md, section 3;
 * docs/VI_Puzzle_Fun_Research.md, section 3). The personas of `levelBot.ts` differ mostly in how deep they search;
 * people differ in other things, and these players have them:
 *
 * - they reach for the move that looks like progress (`lure`), the one that makes something leave at once;
 * - they read the dice from three faces and may read one wrong until it is rolled (`misread`);
 * - a rule held in the head costs them: while a 1 stands on top of a die or they are down on the floor they
 *   think a move less and slip more (`load`);
 * - they see the figure the board is to make (`figure` of the persona);
 * - they do not take moves back, they begin again (the players of Playgama: 0.09 moves taken back to a passed try,
 *   and of 523 failures 265 were «begin again»), after a dead end or after so many moves with nothing leaving
 *   (`bored`), and the opening of a try that failed is one they do not make again (`learn`);
 * - they give up after so many tries (`tries`);
 * - until they are shown it, they do not know they may step from their die onto another and roll that one: they roll the die
 *   under them, and find the step only now and then, after a move with nothing leaving (`step`; the players of Playgama,
 *   29 October - 4 November 2026: 154 and 158 moves on `H06`, par 2, the first board of the row whose way needs the step).
 *
 * A human is a persona and these; the four of the spec are below. The players of the levels and the players of the
 * clock know nothing of each other (`families.test.ts`): this file names none of the second.
 */
export interface Human {
  /** The search, the slips, the count of the dice, the misreading and the figure: a persona of `levelBot.ts`. */
  persona: Persona;
  /** Share of the moves made for what goes at once, whatever the search saw. */
  lure: number;
  /** What a 1 on top or the floor underfoot costs: the slip added, and `loadDepth` moves less of thought (one unless said). */
  load: number;
  loadDepth?: number;
  /** Moves with nothing leaving after which a try is begun again. */
  bored: number;
  /** Tries before the board is given up. */
  tries: number;
  /** A try that failed is not opened again by its first move. */
  learn: boolean;
  /**
   * Share of the moves with nothing leaving after which a person who does not know the step finds it, and knows it from
   * then on (`humanPlay` with `stepKnown: false`); none, it never finds it by itself. Absent: the person knows the step
   * however it comes to the board, as the owner does.
   */
  step?: number;
}

/** How a person comes to a board: whether it knows it may step onto another die (it was shown, or a board before needed it). */
export interface Coming {
  stepKnown?: boolean;
}

/** What one person makes of a board: the try it is first cleared on (null where never), its moves, and the tries made. */
export interface HumanPlay {
  passedOn: number | null;
  moves: number | null;
  tries: number;
}

/** A move made for what goes at once: the player who sees one move and takes what leaves. */
const LURED: Persona = { depth: 1, budget: 40, slip: 0, counts: false };

/** A try is called off after so many moves, cleared or not. */
const TRY_MOVES = 60;

/** The run a person starts: the level with no limit of moves. */
function startOf(spec: LevelSpec): RunState {
  return createRun({ seed: spec.seed, config: defaultConfig(), level: { ...spec, moves: 0 } });
}

/** A rule held in the head: a 1 on top of a standing die, or the player down on the floor. */
function burdened(state: RunState): boolean {
  if (state.player.level === 'ground') return true;
  return state.cubes.some((cube) => cube.state !== 'sinking' && cube.ori.top === 1);
}

/**
 * A move a person who does not know the step can make: one of the die it stands on. Off a standing die nothing else
 * is open to it; on a leaving die or on the floor the rules of those (the windows of the 10th and 29th places) hold.
 */
function fromHere(state: RunState, move: SolverMove): boolean {
  const { player } = state;
  if (player.level !== 'top') return true;
  const under = state.cubes.find((cube) => cube.x === player.x && cube.z === player.z);
  if (!under || under.state === 'sinking') return true;
  return move.x === player.x && move.z === player.z;
}

/** Whether the way a board keeps needs the step: a move of it made off another die than the one the player stands on. */
export function wayNeedsStep(spec: LevelSpec): boolean {
  if (!spec.solution) return false;
  let state = startOf(spec);
  for (const text of spec.solution) {
    const move = moveOf(text);
    if (!fromHere(state, move)) return true;
    state = playMove(state, move);
  }
  return false;
}

const sameMove = (a: SolverMove, b: SolverMove): boolean => a.x === b.x && a.z === b.z && a.dir === b.dir && Boolean(a.push) === Boolean(b.push);

/**
 * One try of a person: it reads the board (with its misreading), thinks on the board as it believes it to be, and
 * makes the move on the board as it is. Ends cleared, at a dead end, bored, or out of moves. `banned` openings are
 * not made first.
 */
function tryOf(spec: LevelSpec, human: Human, seed: number, banned: readonly SolverMove[], knows: { step: boolean }): { state: RunState; way: SolverMove[] } {
  let state = startOf(spec);
  const rng = { rng: (seed ^ 0x3c6ef372) | 0 };
  const reading = { rng: (seed ^ 0x1b873593) | 0 };
  const misread = human.persona.misread ?? 0;
  const beliefs = new Map<number, Orientation>();
  const seen = new Map<number, string>();
  const read = (now: RunState) => {
    for (const cube of now.cubes) {
      const key = orientationKey(cube.ori);
      if (seen.get(cube.id) === key) continue;
      seen.set(cube.id, key);
      beliefs.set(cube.id, beliefOf(cube.ori, misread, reading));
    }
  };
  read(state);
  const way: SolverMove[] = [];
  let quiet = 0;
  for (let made = 0; made < TRY_MOVES && !state.over && !floorLost(state); made++) {
    const open = scan(state).moves;
    // One who does not know the step and has no roll of its own die to make looks round, and finds it.
    if (!knows.step && !open.some((move) => fromHere(state, move))) knows.step = true;
    const known = knows.step ? open : open.filter((move) => fromHere(state, move));
    const real = known.filter((move) => made > 0 || !banned.some((one) => sameMove(one, move)));
    const moves = real.length > 0 ? real : known;
    if (moves.length === 0) break;
    const believed = structuredClone(state);
    for (const cube of believed.cubes) cube.ori = beliefs.get(cube.id) ?? cube.ori;
    const heavy = burdened(state);
    const persona: Persona = heavy
      ? { ...human.persona, depth: Math.max(1, human.persona.depth - (human.loadDepth ?? 1)), slip: Math.min(1, human.persona.slip + human.load) }
      : human.persona;
    const lured = human.lure > 0 && nextRandom(rng) < human.lure;
    const thought = personaMove(believed, lured ? LURED : persona, rng, knows.step ? undefined : fromHere);
    const move = (thought && moves.find((one) => sameMove(one, thought))) || moves[randomInt(reading, moves.length)];
    const before = state.cubes.filter((cube) => cube.state !== 'sinking').length;
    way.push({ x: move.x, z: move.z, dir: move.dir, push: move.push });
    state = playMove(state, move);
    read(state);
    const after = state.cubes.filter((cube) => cube.state !== 'sinking').length;
    quiet = after < before ? 0 : quiet + 1;
    if (!knows.step && quiet > 0 && human.step !== undefined && nextRandom(rng) < human.step) knows.step = true;
    if (quiet >= human.bored && state.endReason !== 'passed') break;
  }
  return { state, way };
}

/** A person at a board: tries until it is cleared or given up, opening no try the way a failed one was opened. */
export function humanPlay(spec: LevelSpec, human: Human, seed: number, coming: Coming = {}): HumanPlay {
  const banned: SolverMove[] = [];
  // A step found on one try is known on the next.
  const knows = { step: (coming.stepKnown ?? true) || human.step === undefined };
  for (let attempt = 1; attempt <= human.tries; attempt++) {
    // The first try is played on the seed itself, as a persona's run of `levelBot.ts` is: a person who is that persona plays it move for move.
    const { state, way } = tryOf(spec, human, attempt === 1 ? seed : seed * 31 + attempt, banned, knows);
    if (state.endReason === 'passed') return { passedOn: attempt, moves: way.length, tries: attempt };
    if (human.learn && way.length > 0 && endingOf(state) !== 'limit') banned.push(way[0]);
  }
  return { passedOn: null, moves: null, tries: human.tries };
}

/**
 * The people of the spec, section 3, as the calibration of `scripts/humans.mjs` against the players of Playgama and the
 * owner's playtest left them (the spec, section 3, «Калибровка ботов-людей»). The player of the platform and the one who
 * polishes to three stars are not built: there are no people to set them against.
 */
export const HUMANS = {
  /**
   * A new player, as the calibration against the players of Playgama found one (`node scripts/humans.mjs calibrate
   * set=crowd`, 24 boards of the first places, Spearman of the share who failed a board at least once): two moves ahead,
   * a side misread now and then, nothing misread on a place with plaques over the dice, five tries. It goes with them at
   * 0.43, and every human trait tried made it worse (the lure 0.21-0.26, bored after ten quiet moves 0.26, one move
   * ahead 0.31); the risk of the scale (`riskOf`, 0.76) foretells them better than any player built here.
   *
   * It does not know the step onto another die until a board before has needed it, and finds it after one move in two
   * hundred with nothing leaving (`step`, 5 November 2026). On `H06`, met not knowing it, it gives up 30% of the time and
   * clears it on the first try 15%, where 37% of the players of Playgama who began it left it; the order of the boards by
   * those who leave goes with theirs at 0.15, against -0.12 for one who knows the step (`leftShare` of the calibration).
   */
  newcomer: {
    persona: { depth: 2, budget: 200, slip: 0.08, counts: false, misread: 0.15 },
    lure: 0,
    load: 0,
    loadDepth: 0,
    bored: 60,
    tries: 5,
    learn: false,
    step: 0.005,
  },
  /**
   * The owner, as the calibration against his playtest of 4 November found him (`node scripts/humans.mjs calibrate
   * set=owner`, 25 boards of places 31-60, Spearman of his moves over par with the share of first tries that fail):
   * a player who thinks two moves ahead and now and then reads a side wrong goes with him at 0.78. Every other trait
   * tried made it worse: three moves ahead 0.60, the figure seen 0.64, the lure 0.64, counting the dice 0.48, a move
   * less of thought under a rule held in the head 0.54. Bored after twenty quiet moves, eight tries, as on the 60th.
   */
  owner: {
    persona: { depth: 2, budget: 200, slip: 0.08, counts: false, misread: 0.15 },
    lure: 0,
    load: 0,
    loadDepth: 0,
    bored: 20,
    tries: 8,
    learn: true,
  },
} as const satisfies Record<string, Human>;

export type HumanName = keyof typeof HUMANS;

/** What the runs of a person come to on a board: the share who clear it on the first try, who fail it at least once, who give up; the tries and moves of those who clear it. */
export interface HumanFacts {
  first: number;
  failedOnce: number;
  gaveUp: number;
  /** Mean tries of those who clear it; the middle moves of their clearing try. Null where none does. */
  tries: number | null;
  moves: number | null;
}

/** The runs of a person on a board, one person a seed. */
export function humanFacts(spec: LevelSpec, human: Human, people = 20, coming: Coming = {}): HumanFacts {
  let first = 0;
  let gaveUp = 0;
  const tries: number[] = [];
  const moves: number[] = [];
  for (let seed = 1; seed <= people; seed++) {
    const play = humanPlay(spec, human, seed, coming);
    if (play.passedOn === null) {
      gaveUp++;
      continue;
    }
    if (play.passedOn === 1) first++;
    tries.push(play.passedOn);
    moves.push(play.moves ?? 0);
  }
  moves.sort((a, b) => a - b);
  return {
    first: first / people,
    failedOnce: 1 - first / people,
    gaveUp: gaveUp / people,
    tries: tries.length > 0 ? tries.reduce((sum, one) => sum + one, 0) / tries.length : null,
    moves: moves.length > 0 ? moves[Math.floor(moves.length / 2)] : null,
  };
}
