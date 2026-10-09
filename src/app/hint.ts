import { DEAD_ENDS_FOR_SIGN, type HintUntil, type RoadHint, type RoadHintKey } from '../levels/road';
import { DELTA, cubeAt, inBounds, isFree } from '../rules/board';
import type { CubeState, GameEvent, RunState } from '../rules/types';

/**
 * The line above the board of a piece that teaches a move, and the mistake that is repeated.
 * Nothing here draws, reads a clock or changes a board.
 */

/**
 * Whether the move a line speaks of has been done, from the events of a tick. `under` is the
 * state of the die the player stands on after the tick, null on the floor.
 *
 * A combo is the first `match`; a chain is the rules' own `chain` (a die joined to a combo that
 * is leaving); a push is a `move` of that kind; a walk is a step onto a die that is leaving, a
 * `hop` from a die or a `mount` from the floor that ends on a sinking die.
 */
export function hintOver(until: HintUntil, events: readonly GameEvent[], under: CubeState | null): boolean {
  return events.some((event) => {
    switch (until) {
      case 'combo':
        // A combo formed against a die laid as leaving joins it: the rules say `chain`, not `match`.
        return event.type === 'match' || event.type === 'chain';
      case 'chain':
        return event.type === 'chain';
      case 'push':
        return event.type === 'move' && event.kind === 'push';
      case 'walk':
        return event.type === 'move' && (event.kind === 'hop' || event.kind === 'mount') && under === 'sinking';
    }
  });
}

/** The line about a dim die stands this long at the most. */
export const FIXED_LINE_MS = 6000;

/**
 * Whether the tick that has just been played stopped a step because the die under the player is
 * fixed: the player stands on a whole fixed die and has swiped towards an empty cell of the
 * board, where any other die would have rolled. A step stopped by the edge of the board, by a
 * hole in it or by a die that is coming up is stopped by those, and is not this.
 */
export function fixedStopped(state: RunState): boolean {
  const { player } = state;
  if (player.level !== 'top') return false;
  const own = cubeAt(state, player.x, player.z);
  if (!own || !own.fixed || own.state !== 'idle') return false;
  return state.events.some((event) => {
    if (event.type !== 'blocked') return false;
    const tx = player.x + DELTA[event.dir].dx;
    const tz = player.z + DELTA[event.dir].dz;
    return inBounds(state.config.size, tx, tz) && !cubeAt(state, tx, tz) && isFree(state, tx, tz);
  });
}

/**
 * Whether the line about a dim die is put up after this tick: once for a player (`said` is what
 * is kept of it), on the first step a fixed die stops, and not while the line of a lesson stands
 * (`lesson`) - that one is of the piece and wins; the line about the die waits for a later step.
 */
export function saysFixed(state: RunState, said: boolean, lesson: boolean): boolean {
  return !said && !lesson && state.levelRun !== null && fixedStopped(state);
}

/** Whether the line about a dim die goes out: the player has stepped to another die, or it has stood `FIXED_LINE_MS`. */
export function fixedLineOver(events: readonly GameEvent[], shownMs: number): boolean {
  return shownMs >= FIXED_LINE_MS || events.some((event) => event.type === 'move' && event.kind === 'hop');
}

/**
 * The lines the board in hand keeps room for above itself: the line of its lesson, from its
 * start, and the line about a dim die from the moment it has been put up on this board
 * (`fixedShown`) and not before. No room waits for a line that may never come: a board with a
 * fixed die and no lesson has the whole stage.
 */
export function roomLines(lesson: RoadHintKey | null, fixedShown: boolean): (RoadHintKey | 'roadHintFixed')[] {
  return [...(lesson ? [lesson] : []), ...(fixedShown ? (['roadHintFixed'] as const) : [])];
}

/** The lines the address may ask for, by the short name of what they teach. */
const PROBE: Readonly<Record<string, RoadHint>> = {
  chain: { key: 'roadHintChain', until: 'chain' },
  walk: { key: 'roadHintWalk', until: 'walk' },
  push: { key: 'roadHintPush', until: 'push' },
};

/**
 * The line asked for in the address of a development build (`?hint=hintChain`), to see it on
 * whatever piece runs. The name may be `chain`, `hintChain` or `roadHintChain`; null for any other.
 */
export function probeHint(name: string | null): RoadHint | null {
  if (!name) return null;
  const short = name.replace(/^(road)?hint/i, '').toLowerCase();
  return PROBE[short] ?? null;
}

/**
 * The dead ends of the piece in hand. A try started over, or a move taken back, does not
 * forget them; another piece or level that begins does.
 */
export class DeadEnds {
  private id = '';
  private reached = 0;

  /** A board begins: the count is kept for the same piece and is none for any other. */
  begin(id: string): void {
    if (id === this.id) return;
    this.id = id;
    this.reached = 0;
  }

  /** The piece is passed: its dead ends are forgotten, and are none if it is played again. */
  forget(): void {
    this.id = '';
    this.reached = 0;
  }

  /** The piece has come to a dead end once more; the count so far. */
  reach(): number {
    return ++this.reached;
  }

  get count(): number {
    return this.reached;
  }

  /** The sign of the way is shown at once. */
  get hurries(): boolean {
    return this.reached >= DEAD_ENDS_FOR_SIGN;
  }
}
