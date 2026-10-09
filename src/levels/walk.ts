import { defaultConfig } from '../rules/config';
import { levelDeadEnd, worldRuns } from '../rules/level';
import { solveFrom } from '../rules/levelSolver';
import { resolveMove } from '../rules/movement';
import { createRun, step } from '../rules/sim';
import type { Dir, LevelSpec, RunState } from '../rules/types';

/**
 * The walk over every board the player can come to on a level, by moves and by steps alike: a
 * board is a place to be solved from, so the walk says how lost a player can get. It is how a
 * place that must not be lost (a piece of the road a player is let to wander on) is proved.
 */

export interface Walk {
  /** Boards seen: the states of the level the player can come to, the start among them. */
  boards: number;
  /** The most moves it takes to clear the board from any board seen that is not lost. */
  worst: number;
  /**
   * Boards seen from which the board cannot be cleared: a dead end, or a search that went through
   * every way and found none. A board the search gave up on is not among them: it is not shown
   * to be lost, and the walk says it is not whole (`capped`).
   */
  lost: number;
  /** The walk is not whole: it was cut at its limit, so boards it did not see may be left, or the solver gave up on a board it saw. */
  capped: boolean;
  /** Boards seen that the solver gave up on (`unsettled`): neither shown cleared nor shown lost, and counted in neither `worst` nor `lost`. */
  unsettled: number;
  /** The commands, from the start, that lead to the first board found lost; null where none is. */
  example: string | null;
}

const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];
/** Boards the solver may see on one board of the walk before it gives up on it, unless told otherwise. */
export const SOLVE_MAX_STATES = 300_000;

/** Gives a command and runs the level until the world stands and the player is free, as a move is made. */
function go(state: RunState, dir: Dir): void {
  step(state, dir);
  for (let ticks = 0; (worldRuns(state) || state.player.action) && !state.over; ticks++) {
    if (ticks > 1000) throw new Error('a move that does not end');
    step(state, null);
  }
}

/**
 * The name of a state of the walk: everything the rules read of it and nothing they do not. The
 * dice go cell by cell with how each lies, whether it stands, how far it has sunk and how long
 * it is held, and with the group it goes with (groups are numbered as they are met, since the
 * numbers the run gave them depend on the way that led here, and each is named by its face,
 * its chain and the dice it has had); then the player, the cell and the level, and how the run
 * ended. What a run counts, moves and score and the tick, is not a part of the name.
 */
function nameOf(state: RunState): string {
  const dice = state.cubes.slice().sort((a, b) => a.z - b.z || a.x - b.x);
  const labels = new Map<number, number>();
  const groups: (readonly number[])[] = [];
  const named = dice.map((die) => {
    let group = 0;
    if (die.reactionId !== 0) {
      group = labels.get(die.reactionId) ?? labels.size + 1;
      if (!labels.has(die.reactionId)) {
        labels.set(die.reactionId, group);
        const reaction = state.reactions.find((r) => r.id === die.reactionId);
        groups.push(reaction ? [reaction.value, reaction.chain, reaction.total] : []);
      }
    }
    return [die.x, die.z, die.ori.top, die.ori.north, die.state, die.t, die.hold ?? 0, die.fixed ? 1 : 0, group];
  });
  return JSON.stringify([named, groups, state.player.x, state.player.z, state.player.level, state.endReason]);
}

/** Reasons to leave a walk before the boards run out: the answer to what is asked is in already, and what is counted after it is not. */
export interface WalkUntil {
  /** At the first board found lost. */
  lost?: boolean;
  /** At the first board that takes more moves than this to clear. */
  worst?: number;
  /** As soon as the walk is not whole: at its limit, or at a board the solver gave up on. For one who turns such a board away whatever is counted after. */
  capped?: boolean;
  /** Boards the solver may see on one board of the walk before it gives up on it (`SOLVE_MAX_STATES` unless said). */
  solveStates?: number;
}

/**
 * Walks the boards a player can come to from the start of a level, breadth first, and solves
 * the board from each one that is not over. `limit` bounds the boards seen; where it is hit the
 * walk says so (`capped`) and what it has seen is all it counts. A walk left early by `until` is
 * not whole: it has seen what it needed, and its counts are of that much.
 *
 * Only for a level that is cleared, with nothing coming and no limit of moves (`goal: clear`,
 * `arrival: 'none'`, `moves: 0`), as the pieces of the road and the levels of the list are: the
 * name of a board leaves out what such a level does not read, the moves made, the dice to come
 * and the count of the goal, and on any other level two boards of one name would not be one.
 */
export function walkBoards(spec: LevelSpec, limit = 5000, until: WalkUntil = {}): Walk {
  if (spec.goal.kind !== 'clear' || spec.arrival !== 'none' || spec.moves !== 0) throw new Error('walkBoards: only a level that is cleared, with nothing coming and no limit of moves');
  const { solveStates = SOLVE_MAX_STATES } = until;
  const root = createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
  const seen = new Set<string>([nameOf(root)]);
  // A board walked from is dropped from the queue: only those still to be walked are held.
  const queue: ({ state: RunState; cmds: string } | null)[] = [{ state: root, cmds: '' }];
  let capped = false;
  let unsettled = 0;
  let worst = 0;
  let lost = 0;
  let example: string | null = null;
  const lose = (cmds: string): void => {
    lost++;
    example ??= cmds;
  };
  for (let at = 0; at < queue.length; at++) {
    if ((until.lost && lost > 0) || (until.worst !== undefined && worst > until.worst) || (until.capped && capped)) break;
    const { state, cmds } = queue[at]!;
    queue[at] = null;
    if (state.over) {
      // The only end there is, is the board cleared.
      if (state.endReason !== 'passed') lose(cmds);
      continue;
    }
    if (levelDeadEnd(state) !== null) lose(cmds);
    else {
      const solved = solveFrom(state, { maxStates: solveStates });
      if (solved.solution) worst = Math.max(worst, solved.solution.moves.length);
      else if (solved.exhausted) lose(cmds);
      else {
        // A search that gave up proves nothing: the board is shown neither cleared nor lost, and the walk is not whole.
        capped = true;
        unsettled++;
      }
    }
    for (const dir of DIRS) {
      if (resolveMove(state, dir).kind === 'blocked') continue;
      const next = structuredClone(state);
      go(next, dir);
      const name = nameOf(next);
      if (seen.has(name)) continue;
      if (queue.length >= limit) {
        capped = true;
        continue;
      }
      seen.add(name);
      queue.push({ state: next, cmds: cmds + dir });
    }
  }
  return { boards: queue.length, worst, lost, capped, unsettled, example };
}
