import { ROAD_IDLE, ROAD_SIGNS } from '../levels/road';
import type { ControlMode } from '../platform/settings';
import { DELTA, DIRS, cubeAt, cubeHeight } from '../rules/board';
import { worldRuns } from '../rules/level';
import { solveFrom } from '../rules/levelSolver';
import { resolveMove } from '../rules/movement';
import type { Dir, Level, MoveKind, RunState } from '../rules/types';
import { Idle, type IdleRule } from './idle';

/**
 * Where the swipe sign of a level points and where it stands, from the board as it is. The way
 * is the solver's: the sign shows the next thing to do on the shortest way that clears the board
 * from here, be it a roll or a step towards the die to roll. Nothing here draws, and the board
 * given is never changed.
 */

/** A place the player can be: a cell, on the die there or on the floor. */
export interface Place {
  x: number;
  z: number;
  level: Level;
}

export interface SignWay {
  /** The way to swipe now; null where there is no way, or the board is not one to ask. */
  dir: Dir | null;
  /** Moves the board is cleared in from here; null where that is not known. */
  left: number | null;
}

const NO_WAY: SignWay = { dir: null, left: null };

/**
 * Boards the search may see for a sign. The pieces of the road have a few dozen; a board
 * that takes more than this gets no sign rather than a frame that hangs.
 */
export const SIGN_MAX_STATES = 5000;

/** Where a step of each kind leaves the player; a roll and a push are moves, not steps. */
const STEP_TO: Partial<Record<MoveKind, Level>> = { hop: 'top', mount: 'top', climb: 'top', descend: 'ground', walk: 'ground' };

/**
 * The steps that lead from where the player is to a place, the fewest there are: over the dice,
 * up onto a die that is low and down from one that is going, along the floor. Steps move no die,
 * so the board stands as it is all the way. Empty where the player is there already, null where
 * no steps lead there.
 */
export function stepsTo(state: RunState, to: Place): Dir[] | null {
  const name = (place: Place): string => `${place.x},${place.z},${place.level}`;
  const { x, z, level } = state.player;
  const goal = name(to);
  const from: Place = { x, z, level };
  if (name(from) === goal) return [];
  const seen = new Set([name(from)]);
  const queue: { place: Place; steps: Dir[] }[] = [{ place: from, steps: [] }];
  for (let at = 0; at < queue.length; at++) {
    const { place, steps } = queue[at];
    // The same board with the player put there: a step is decided by reading, and changes nothing.
    const there: RunState = { ...state, player: place };
    for (const dir of DIRS) {
      const intent = resolveMove(there, dir);
      const after = intent.kind === 'blocked' ? undefined : STEP_TO[intent.kind];
      if (!after) continue;
      const next: Place = { x: intent.tx, z: intent.tz, level: after };
      const key = name(next);
      if (seen.has(key)) continue;
      if (key === goal) return [...steps, dir];
      seen.add(key);
      queue.push({ place: next, steps: [...steps, dir] });
    }
  }
  return null;
}

/**
 * The way the sign points from the board of a level as it stands: the first move of the
 * shortest way that clears it, when the player is where that move is made from, and the first
 * step towards there when not. None while the world moves or the level is over, and none where
 * the solver finds no way.
 */
export function signAt(state: RunState, maxStates = SIGN_MAX_STATES): SignWay {
  if (!state.levelRun || state.over || worldRuns(state) || state.player.action) return NO_WAY;
  const { solution } = solveFrom(state, { maxStates });
  const move = solution?.moves[0];
  if (!solution || !move) return NO_WAY;
  const left = solution.moves.length;
  // A die is rolled from on top of it, and pushed from the floor behind it.
  const { dx, dz } = DELTA[move.dir];
  const from: Place = move.push ? { x: move.x - dx, z: move.z - dz, level: 'ground' } : { x: move.x, z: move.z, level: 'top' };
  const steps = stepsTo(state, from);
  if (!steps) return { dir: null, left };
  return { dir: steps[0] ?? move.dir, left };
}

/**
 * Moves made that brought the board no nearer to cleared: the moves made, less how much shorter
 * the way is now than it was at the start. None where either length is not known.
 */
export function wastedMoves(par: number | undefined, made: number, left: number | null): number {
  if (par === undefined || left === null) return 0;
  return Math.max(0, made - (par - left));
}

/**
 * What the sign stands beside, in the coordinates of the board: the eight corners of the die
 * under the figure, from the floor to as high as the die stands, or of the cell of a figure on
 * the floor, as high as a die. Whoever draws the sign finds where these lie on screen and puts
 * the sign to the right of them: it is by the figure wherever on the board the figure is, and
 * never on its die.
 */
export function signBody(state: RunState): { x: number; y: number; z: number }[] {
  const { x, z, level } = state.player;
  const top = level === 'top' ? signHeight(state) : 1;
  const corners: { x: number; y: number; z: number }[] = [];
  for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) for (const y of [0, top]) corners.push({ x: x + dx, y, z: z + dz });
  return corners;
}

/**
 * How high over the floor the figure stands, in dice: the top of the die under it as that die
 * stands, which is lower than a die for one that is leaving (the stair of a piece is half a die
 * high), and the floor for a player on the floor. The sign stands beside a die as high as this.
 */
export function signHeight(state: RunState): number {
  const { x, z, level } = state.player;
  if (level !== 'top') return 0;
  const under = cubeAt(state, x, z);
  return under ? cubeHeight(under, state.config) : 0;
}

/**
 * Which of its two forms the sign takes: the star that runs for those who swipe, the arrow key
 * for those who press. A phone has no keys; elsewhere a key pressed last says more than what is set.
 */
export function signMode(control: ControlMode, coarse: boolean, last: 'keys' | 'pointer' | null): 'dot' | 'key' {
  if (coarse) return 'dot';
  if (last === 'keys') return 'key';
  return control === 'gesture' ? 'dot' : 'key';
}

/** What a piece of the road shows of the player's wait on a frame. */
export interface Waiting {
  /** The way the swipe sign points; null while there is no sign. */
  dir: Dir | null;
  /** The plaque over the target blinks. */
  blink: boolean;
}

const NOTHING: Waiting = { dir: null, blink: false };

/**
 * The wait of one start of a piece, followed frame by frame: the sign the piece opens with until
 * the first move or step, then the plaque that blinks and the sign of the way as the player
 * waits. The solver is asked once for a board, when the board has come to stand, and that is
 * also the moment the wait is counted from.
 */
export class RoadWait {
  private readonly idle: Idle;
  /** The way from the board last asked about, and what names that board. */
  private kept: { key: string; way: SignWay } | null = null;

  /**
   * The piece has come to a dead end often enough for the sign to be shown at once, on every board
   * of it from here. Set by whoever counts the dead ends, which outlive a try started over.
   */
  hurry: boolean;

  constructor(
    private readonly opening: Dir | undefined,
    rule: IdleRule,
    hurry = false,
  ) {
    this.idle = new Idle(rule);
    this.hurry = hurry;
  }

  /** `live` is false while a panel is open or the board takes no input: nothing is shown, and the time is not waited. */
  frame(state: RunState, timeMs: number, live: boolean): Waiting {
    const run = state.levelRun;
    if (!run || !live) {
      this.idle.pause(timeMs);
      return NOTHING;
    }
    this.idle.resume(timeMs);
    const { player } = state;
    if (state.over || worldRuns(state) || player.action) return NOTHING;
    // Every move and every step is counted, and a move taken back takes its count back: no two boards in a row have one name.
    const key = `${run.moves}|${state.stats.steps}|${player.x},${player.z},${player.level}`;
    if (this.kept?.key !== key) {
      const way = signAt(state);
      this.kept = { key, way };
      this.idle.acted(timeMs, wastedMoves(run.spec.par, run.moves, way.left));
    }
    const { blink, sign } = this.idle.at(timeMs, this.hurry);
    if (this.opening && run.moves === 0 && state.stats.steps === 0) return { dir: this.opening, blink };
    return { dir: sign ? this.kept.way.dir : null, blink };
  }
}

/**
 * The wait of the level with this id, new for every start of it: for a piece of the road, by
 * what the piece opens with and by its thresholds. The thresholds are a first guess of the one
 * who built them and the owner has not named them. `hurry` is a piece that has come to a dead end
 * twice: its sign is shown at once. Null for every other level: the levels of
 * the list show no sign for waiting.
 */
export function roadWait(id: string, hurry = false): RoadWait | null {
  const rule = ROAD_IDLE[id];
  return rule ? new RoadWait(ROAD_SIGNS[id], rule, hurry) : null;
}
