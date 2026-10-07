import { DELTA, DIRS, cellIndex, cubeAt } from './board';
import { defaultConfig } from './config';
import { chainWindows } from './level';
import { moveText, tellMove, type SolverMove } from './levelSolver';
import { scan } from './reach';
import { createRun } from './sim';
import type { LevelSpec, RulesConfig, RunState } from './types';

/**
 * A way through a level written out move by move, as a piece of music is: what each move set
 * off, what it was made with, and where the player stood. The fewest moves say how fast a board
 * is cleared; the score says what clearing it is like: how long nothing happens, how much goes
 * at once, whether the end is one move or a tail of them, and the route the player takes over
 * the two floors of a level, the tops of the dice and the floor under them.
 *
 * It is read off the real rules: the way is played, and every move is looked at before and
 * after. A way that cannot be played is a mistake in the way, and says so.
 */

/** One move of a way. */
export interface Beat {
  move: SolverMove;
  /** A roll, a push from the floor, or a roll over a die that is leaving. */
  how: 'roll' | 'push' | 'glass';
  /** Where the player stood once the move before had landed, before any free step. */
  from: 'standing' | 'leaving' | 'floor';
  /**
   * How the player came to the floor since the move before: stepped off, or the die went from
   * under them. A way found by a search always steps: a fall is what a person does.
   */
  down: 'stepped' | 'fell' | null;
  /** The player came up from the floor since the move before. */
  up: boolean;
  /** Made with a die the player came to over another die that is leaving. */
  bridged: boolean;
  event: 'none' | 'combo' | 'link' | 'ones';
  /** The face of what went, 0 with no event; the dice that began to leave. */
  face: number;
  took: number;
  /** Dice standing and dice leaving once the move has landed. */
  standing: number;
  leaving: number;
  /** Moves the leaving dice still had when the link joined: 0 is the last move it could be made on. Null where the move is no link. */
  spare: number | null;
}

export interface Score {
  beats: Beat[];
  /** Moves before the first event, and from it on. */
  quiet: number;
  counted: number;
  /** Dice the biggest event took, and the last one. */
  biggest: number;
  last: number;
  /** Longest run of moves from one event to the next, the move that makes it counted; moves between the last two events. */
  pause: number;
  tail: number;
  /** Links of the longest chain. */
  chain: number;
  /**
   * The events and the changes of floor in order, quiet moves left out. `K` a combo, `L` a
   * link, `O` the 1s; made by a push they are `P`, `Q` and `U`. `v` stepped down, `!` fell, `^`
   * came up, `~` went on over another die that is leaving.
   */
  route: string;
  /**
   * `top` never touches the floor; `bridge` neither, and goes on over a leaving die; `downLast`
   * does from the floor what ends the level; `downAndUp` comes up again after a push.
   */
  kind: 'top' | 'bridge' | 'downLast' | 'downAndUp' | 'other';
}

const standingOf = (state: RunState): number => state.cubes.filter((cube) => cube.state !== 'sinking').length;

/** Whether steps over standing dice alone lead from where the player is to the die at (x, z). */
function overStanding(state: RunState, x: number, z: number): boolean {
  const { size } = state.config;
  const seen = new Set<number>([cellIndex(size, state.player.x, state.player.z)]);
  const queue = [{ x: state.player.x, z: state.player.z }];
  for (let at = 0; at < queue.length; at++) {
    for (const dir of DIRS) {
      const nx = queue[at].x + DELTA[dir].dx;
      const nz = queue[at].z + DELTA[dir].dz;
      if (cubeAt(state, nx, nz)?.state !== 'idle') continue;
      if (nx === x && nz === z) return true;
      const cell = cellIndex(size, nx, nz);
      if (seen.has(cell)) continue;
      seen.add(cell);
      queue.push({ x: nx, z: nz });
    }
  }
  return false;
}

const LETTERS: Record<Exclude<Beat['event'], 'none'>, readonly [string, string]> = { combo: ['K', 'P'], link: ['L', 'Q'], ones: ['O', 'U'] };

function routeOf(beats: readonly Beat[]): string {
  const signs: string[] = [];
  for (const beat of beats) {
    if (beat.down) signs.push(beat.down === 'fell' ? '!' : 'v');
    if (beat.up) signs.push('^');
    if (beat.bridged) signs.push('~');
    if (beat.event !== 'none') signs.push(LETTERS[beat.event][beat.how === 'push' ? 1 : 0]);
  }
  return signs.join(' ');
}

function kindOf(beats: readonly Beat[]): Score['kind'] {
  const below = (beat: Beat) => beat.down !== null || beat.how === 'push';
  if (!beats.some((beat) => below(beat) || beat.up)) return beats.some((beat) => beat.bridged) ? 'bridge' : 'top';
  if (beats.some((beat, index) => beat.up && beats.slice(0, index).some((before) => before.how === 'push'))) return 'downAndUp';
  const first = beats.findIndex(below);
  return first >= 0 && beats.slice(first).every((beat) => beat.how === 'push') ? 'downLast' : 'other';
}

/** The score of a way through a level, played from its start on the real rules. */
export function scoreOf(spec: LevelSpec, way: readonly SolverMove[], config: RulesConfig = defaultConfig()): Score {
  let state = createRun({ seed: spec.seed, config, level: { ...spec, moves: 0 } });
  const beats: Beat[] = [];
  let pushedLast = false;
  way.forEach((move, index) => {
    const found = state.over ? undefined : scan(state).moves.find((m) => m.x === move.x && m.z === move.z && m.dir === move.dir && m.push === move.push);
    if (!found) throw new Error(`level ${spec.id}: move ${index + 1} (${moveText(move)}) cannot be made`);
    const { player } = state;
    const under = player.level === 'top' ? cubeAt(state, player.x, player.z) : undefined;
    const from: Beat['from'] = player.level === 'ground' ? 'floor' : under?.state === 'sinking' ? 'leaving' : 'standing';
    // After a push the player is on the floor because they went there; after a roll, because the die went.
    const down: Beat['down'] = from === 'floor' ? (pushedLast || index === 0 ? null : 'fell') : found.floor ? 'stepped' : null;
    const up = !move.push && (from === 'floor' || found.floor);
    const bridged = !move.push && !found.floor && from === 'leaving' && !overStanding(state, move.x, move.z);
    const windows = chainWindows(state);
    const stood = standingOf(state);
    const told = tellMove(state, move);
    const { outcome } = told;
    const event: Beat['event'] = outcome.ones ? 'ones' : outcome.link ? 'link' : outcome.cleared ? 'combo' : 'none';
    const face = outcome.values[0] ?? 0;
    const standing = standingOf(told.state);
    const open = windows.filter((window) => window.value === face).map((window) => window.moves);
    beats.push({
      move: { x: move.x, z: move.z, dir: move.dir, push: move.push },
      how: move.push ? 'push' : found.glass ? 'glass' : 'roll',
      from,
      down,
      up,
      bridged,
      event,
      face,
      took: event === 'none' ? 0 : stood - standing,
      standing,
      leaving: told.state.cubes.length - standing,
      spare: event === 'link' && open.length > 0 ? Math.max(...open) - 1 : null,
    });
    pushedLast = move.push;
    state = told.state;
  });

  const events = beats.flatMap((beat, index) => (beat.event === 'none' ? [] : [index]));
  let pause = 0;
  let since = 0;
  for (const beat of beats) {
    since++;
    if (beat.event === 'none') continue;
    pause = Math.max(pause, since);
    since = 0;
  }
  const quiet = events.length > 0 ? events[0] : beats.length;
  return {
    beats,
    quiet,
    counted: beats.length - quiet,
    biggest: Math.max(0, ...beats.map((beat) => beat.took)),
    last: events.length > 0 ? beats[events[events.length - 1]].took : 0,
    pause: Math.max(pause, since),
    tail: events.length < 2 ? 0 : events[events.length - 1] - events[events.length - 2],
    chain: Math.max(0, state.maxChain - 1),
    route: routeOf(beats),
    kind: kindOf(beats),
  };
}
