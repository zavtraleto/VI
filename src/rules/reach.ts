import { DIRS, cellIndex } from './board';
import { resolveMove } from './movement';
import type { RunState, Technique } from './types';

/**
 * Where free steps take the player on a board that stands, and the moves that can be made from
 * there. A step from die to die moves no die and takes no time, so between two moves the player
 * is not at a cell but at every cell those steps lead to. The steps are tried with the rules
 * themselves, on the board as it is: nothing is stepped, so nothing moves.
 *
 * The solver of levels searches by it, and the rules of a level ask it whether a move is left.
 */

/** A move the player can get to, and what making it leans on. */
export interface Reachable {
  /** Cell of the die before the move, and the side it goes to. */
  x: number;
  z: number;
  dir: (typeof DIRS)[number];
  /** Pushed from the floor, not rolled from on top. */
  push: boolean;
  /** It is made from the floor, or from a die the player gets to over the floor. */
  floor: boolean;
  /** The die goes over one that is on its way out. */
  glass: boolean;
}

/** Where free steps take the player, and the moves that can be made from there. */
export interface Scan {
  /** A bit for every place: a cell up on the dice, and the same cell on the floor `cells` further on. */
  places: Uint8Array;
  moves: Reachable[];
}

/**
 * Walks the free steps from where the player stands, trying every step with the rules on the
 * board as it is. The dice are gone over first, the floor after them, so that a move is known
 * to need the floor only when there is no way to it without. With `ban`, steps to the floor and
 * pushes, or rolls over a die that is going, are left out.
 */
export function scan(state: RunState, ban: readonly Technique[] = []): Scan {
  const { size } = state.config;
  const cells = size * size;
  const places = new Uint8Array(2 * cells);
  const moves: Reachable[] = [];
  const noFloor = ban.includes('floor');
  const noGlass = ban.includes('glass');
  const { x, z, level } = state.player;
  // The board is read and never written: only the player of this copy is moved about.
  const board: RunState = { ...state, player: { x, z, level } };
  const start = cellIndex(size, x, z) + (level === 'ground' ? cells : 0);
  if (noFloor && level === 'ground') return { places, moves };
  const queue: number[] = [];
  const later: number[] = [];
  (level === 'ground' ? later : queue).push(start);
  places[start] = 1;
  let overFloor = false;
  for (;;) {
    if (queue.length === 0) {
      if (later.length === 0) break;
      overFloor = true;
      queue.push(...later);
      later.length = 0;
    }
    const place = queue.pop()!;
    const up = place < cells;
    const cell = up ? place : place - cells;
    const px = cell % size;
    const pz = Math.floor(cell / size);
    board.player.x = px;
    board.player.z = pz;
    board.player.level = up ? 'top' : 'ground';
    for (const dir of DIRS) {
      const intent = resolveMove(board, dir);
      const { kind } = intent;
      if (kind === 'blocked') continue;
      if (kind === 'roll' || kind === 'push') {
        const push = kind === 'push';
        if (push && noFloor) continue;
        const glass = intent.over !== undefined;
        if (glass && noGlass) continue;
        const die = intent.cube!;
        moves.push({ x: die.x, z: die.z, dir, push, floor: push || overFloor, glass });
        continue;
      }
      const down = kind === 'descend' || kind === 'walk';
      if (down && noFloor) continue;
      const next = cellIndex(size, intent.tx, intent.tz) + (down ? cells : 0);
      if (places[next]) continue;
      places[next] = 1;
      // A step that touches the floor waits until the dice have been gone over.
      (down || !up ? later : queue).push(next);
    }
  }
  moves.sort(byPlainness);
  return { places, moves };
}

/** Plain moves first, then by the cell and the side: the order a search tries them in. */
function byPlainness(a: Reachable, b: Reachable): number {
  return (
    Number(a.floor) - Number(b.floor) ||
    Number(a.glass) - Number(b.glass) ||
    a.z - b.z ||
    a.x - b.x ||
    DIRS.indexOf(a.dir) - DIRS.indexOf(b.dir) ||
    Number(a.push) - Number(b.push)
  );
}

/** Whether the player has a move left: a roll or a push that free steps lead to. */
export function canMove(state: RunState): boolean {
  return scan(state).moves.length > 0;
}
