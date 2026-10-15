import type { Hint } from '../levels/campaign';
import { DEAD_ENDS_FOR_SIGN } from '../levels/road';

/**
 * The hint a board shows before it starts, the end of the row, and the mistake that is repeated.
 * Nothing here draws, reads a clock or changes a board.
 */

/** Whether a board shows its hint: once for a player, `told` being the boards whose window has been closed. */
export function tellsHint(id: string, told: readonly string[]): boolean {
  return !told.includes(id);
}

/** What is kept of the window at the end of a row this long: a longer row says it again. */
export function endKey(length: number): string {
  return `end:${length}`;
}

/**
 * Whether the window at the end of the row is due: every board of the row (`ids`) is passed, and
 * the window has not been closed for a row of this length.
 */
export function endDue(passed: Readonly<Record<string, boolean | undefined>>, ids: readonly string[], told: readonly string[]): boolean {
  return ids.length > 0 && ids.every((id) => passed[id] === true) && !told.includes(endKey(ids.length));
}

/** The hints the address may ask for, by the short name of what they teach. */
const PROBE: Readonly<Record<string, Hint>> = {
  chain: { key: 'roadHintChain' },
  walk: { key: 'roadHintWalk' },
  push: { key: 'roadHintPush' },
  climb: { key: 'roadHintClimb' },
  seven: { key: 'hintSeven' },
  linkmove: { key: 'hintLinkMove' },
};

/**
 * The hint asked for in the address of a development build (`?hint=hintChain`), to see it on
 * whatever piece runs, whether it has been told or not. The name may be `chain`, `hintChain` or
 * `roadHintChain`; null for any other.
 */
export function probeHint(name: string | null): Hint | null {
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
