import { parseBoard, printBoard, type BoardHead } from '../levels/boardFile';
import { ALL_ORIENTATIONS, roll } from '../rules/orientation';
import type { Dir, LevelSpec, PuzzleDie } from '../rules/types';

/**
 * A board as the editor of the lab holds it: a square of cells, each a cell cut out, an empty
 * cell or a die with its marks. It is the grid of a file of a board (`src/levels/boardFile.ts`)
 * cell for cell, and may be a board the rules refuse: two starts cannot be drawn, but none can,
 * and so can a fixed die under the player. What the rules say of it is asked by `specOf`, which
 * writes the board as a file and reads the file: there is one check, the one a file gets.
 *
 * Every change gives a new board and leaves the one it was given as it was: a board before a
 * change is what the editor keeps to take the change back.
 */
export type Cell =
  | { kind: 'hole' }
  | { kind: 'empty'; floorStart?: boolean }
  | { kind: 'die'; top: number; north: number; start?: boolean; fixed?: boolean; leaving?: number };

export interface EditBoard {
  size: number;
  /** Row by row from the north: `cells[z][x]`. */
  cells: Cell[][];
}

/** The sides a board may have: a move of the solver is written with three bits to a coordinate. */
export const SIZE_MIN = 3;
export const SIZE_MAX = 8;

export function emptyBoard(size: number): EditBoard {
  return { size, cells: Array.from({ length: size }, () => Array.from({ length: size }, (): Cell => ({ kind: 'empty' }))) };
}

/** The board of a level, cell for cell. */
export function editBoardOf(spec: LevelSpec): EditBoard {
  const board = emptyBoard(spec.size);
  for (const { x, z } of spec.holes ?? []) board.cells[z][x] = { kind: 'hole' };
  const { layout } = spec;
  if (!layout) return board;
  layout.dice.forEach((die, index) => {
    const leaves = (layout.leaving ?? []).find((leaving) => leaving.die === index);
    board.cells[die.z][die.x] = {
      kind: 'die',
      top: die.top,
      north: die.north,
      ...(die.fixed ? { fixed: true } : {}),
      ...(leaves ? { leaving: leaves.moves } : {}),
      ...(!layout.onFloor && layout.start.x === die.x && layout.start.z === die.z ? { start: true } : {}),
    };
  });
  if (layout.onFloor && board.cells[layout.start.z]?.[layout.start.x]?.kind === 'empty') board.cells[layout.start.z][layout.start.x] = { kind: 'empty', floorStart: true };
  return board;
}

/**
 * The level a board is with the head of `head`: its id, its faces, its floor and the rest. It is
 * not held against the rules, and may be no level at all; a board with no start is given one off
 * the board, which a file writes as no start.
 */
export function rawSpecOf(board: EditBoard, head: LevelSpec): LevelSpec {
  const dice: PuzzleDie[] = [];
  const holes: { x: number; z: number }[] = [];
  const leaving: { die: number; moves: number }[] = [];
  let start: { x: number; z: number } | null = null;
  let onFloor = false;
  board.cells.forEach((row, z) =>
    row.forEach((cell, x) => {
      if (cell.kind === 'hole') holes.push({ x, z });
      else if (cell.kind === 'empty') {
        if (cell.floorStart && !start) {
          start = { x, z };
          onFloor = true;
        }
      } else {
        if (cell.start && !start) start = { x, z };
        if (cell.leaving) leaving.push({ die: dice.length, moves: cell.leaving });
        dice.push({ x, z, top: cell.top, north: cell.north, ...(cell.fixed ? { fixed: true } : {}) });
      }
    }),
  );
  const { holes: _holes, layout: _layout, ...rest } = head;
  return {
    ...rest,
    size: board.size,
    ...(holes.length > 0 ? { holes } : {}),
    norm: dice.length,
    layout: { start: start ?? { x: -1, z: -1 }, dice, ...(leaving.length > 0 ? { leaving } : {}), ...(onFloor ? { onFloor: true } : {}) },
  };
}

/** The board as the text of its file. */
export function textOf(board: EditBoard, head: LevelSpec, extra: BoardHead = {}): string {
  return printBoard(rawSpecOf(board, head), extra);
}

/** The level a board is, held against the rules as a file of it is: what is wrong with it is thrown, as `parseBoard` says it. */
export function specOf(board: EditBoard, head: LevelSpec): LevelSpec {
  return parseBoard(textOf(board, head), head.id);
}

/** A board with one cell changed. */
function withCell(board: EditBoard, x: number, z: number, cell: Cell): EditBoard {
  return { size: board.size, cells: board.cells.map((row, rz) => (rz === z ? row.map((old, rx) => (rx === x ? cell : old)) : row)) };
}

export function cellAt(board: EditBoard, x: number, z: number): Cell | null {
  return board.cells[z]?.[x] ?? null;
}

/** The first way a die lies with a face on top. */
function lying(top: number): { top: number; north: number } {
  const { north } = ALL_ORIENTATIONS.find((o) => o.top === top)!;
  return { top, north };
}

/**
 * A click on a cell: an empty one gets a die with 1 on top, the player's if they stood there on
 * the floor; a die shows its next face, 1 after 6, lying the first way there is with that face
 * on top, and keeps its marks. A cell cut out is left as it is.
 */
export function putDie(board: EditBoard, x: number, z: number): EditBoard {
  const cell = cellAt(board, x, z);
  if (!cell || cell.kind === 'hole') return board;
  if (cell.kind === 'empty') return withCell(board, x, z, { kind: 'die', ...lying(1), ...(cell.floorStart ? { start: true } : {}) });
  return withCell(board, x, z, { ...cell, ...lying((cell.top % 6) + 1) });
}

/** A die rolled where it stands: it lies as it would after a roll to that side, and stays on its cell. */
export function rollDie(board: EditBoard, x: number, z: number, dir: Dir): EditBoard {
  const cell = cellAt(board, x, z);
  if (!cell || cell.kind !== 'die') return board;
  const lies = ALL_ORIENTATIONS.find((o) => o.top === cell.top && o.north === cell.north);
  if (!lies) return board;
  const { top, north } = roll(lies, dir);
  return withCell(board, x, z, { ...cell, top, north });
}

/** A cell emptied: its die is taken off, or its start on the floor; a cell cut out is left. */
export function clearCell(board: EditBoard, x: number, z: number): EditBoard {
  const cell = cellAt(board, x, z);
  if (!cell || cell.kind === 'hole') return board;
  return withCell(board, x, z, { kind: 'empty' });
}

/** A cell cut out, or put back empty: whatever stood on it is gone. */
export function toggleHole(board: EditBoard, x: number, z: number): EditBoard {
  const cell = cellAt(board, x, z);
  if (!cell) return board;
  return withCell(board, x, z, cell.kind === 'hole' ? { kind: 'empty' } : { kind: 'hole' });
}

export function toggleFixed(board: EditBoard, x: number, z: number): EditBoard {
  const cell = cellAt(board, x, z);
  if (!cell || cell.kind !== 'die') return board;
  const { fixed, ...rest } = cell;
  return withCell(board, x, z, fixed ? rest : { ...rest, fixed: true });
}

/** The start put on a cell: on its die, or on the floor where it is empty. The start there was before is taken away: a board has one. */
export function setStart(board: EditBoard, x: number, z: number): EditBoard {
  const cell = cellAt(board, x, z);
  if (!cell || cell.kind === 'hole') return board;
  const cells = board.cells.map((row) =>
    row.map((old): Cell => {
      if (old.kind === 'empty') return { kind: 'empty' };
      if (old.kind === 'die') {
        const { start: _start, ...rest } = old;
        return rest;
      }
      return old;
    }),
  );
  cells[z][x] = cell.kind === 'die' ? { ...(cells[z][x] as Extract<Cell, { kind: 'die' }>), start: true } : { kind: 'empty', floorStart: true };
  return { size: board.size, cells };
}

/** A die that is leaving a move later: not leaving, in 1 move, in 2, up to `sink`, and not leaving again. */
export function cycleLeaving(board: EditBoard, x: number, z: number, sink: number): EditBoard {
  const cell = cellAt(board, x, z);
  if (!cell || cell.kind !== 'die') return board;
  const { leaving = 0, ...rest } = cell;
  return withCell(board, x, z, leaving >= sink ? rest : { ...rest, leaving: leaving + 1 });
}

/** The board on a square of another side: what stood on the cells both have is kept, the new cells are empty. */
export function resize(board: EditBoard, size: number): EditBoard {
  const side = Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(size)));
  if (side === board.size) return board;
  const next = emptyBoard(side);
  for (let z = 0; z < Math.min(side, board.size); z++) for (let x = 0; x < Math.min(side, board.size); x++) next.cells[z][x] = board.cells[z][x];
  return next;
}

/** A die carried to an empty cell with everything it has: its marks, and the player if they stand on it. A cell that is taken or cut out takes none. */
export function moveDie(board: EditBoard, from: { x: number; z: number }, to: { x: number; z: number }): EditBoard {
  const die = cellAt(board, from.x, from.z);
  const target = cellAt(board, to.x, to.z);
  if (!die || die.kind !== 'die' || !target || target.kind !== 'empty' || (from.x === to.x && from.z === to.z)) return board;
  // A die put where the player stood on the floor is the die they stand on, as with a die put there anew.
  const carried: Cell = target.floorStart ? { ...die, start: true } : die;
  return withCell(withCell(board, from.x, from.z, { kind: 'empty' }), to.x, to.z, carried);
}

/** A die with a face on top dropped on a cell: an empty cell gets one, a die is turned to that face and keeps its marks. */
export function setTop(board: EditBoard, x: number, z: number, top: number): EditBoard {
  const cell = cellAt(board, x, z);
  if (!cell || cell.kind === 'hole') return board;
  if (cell.kind === 'empty') return withCell(board, x, z, { kind: 'die', ...lying(top), ...(cell.floorStart ? { start: true } : {}) });
  return cell.top === top ? board : withCell(board, x, z, { ...cell, ...lying(top) });
}

/** A fixed die with a face on top dropped on a cell: as `setTop`, and the die is fixed. */
export function putFixed(board: EditBoard, x: number, z: number, top: number): EditBoard {
  const put = setTop(board, x, z, top);
  const cell = cellAt(put, x, z);
  return cell && cell.kind === 'die' && !cell.fixed ? withCell(put, x, z, { ...cell, fixed: true }) : put;
}

/**
 * A die turned where it stands about the line through its top: the top stays, and the faces of
 * its sides go round a quarter, the west one to the north with `turns` 1 and the east one with
 * -1. Four turns one way bring it back.
 */
export function spinDie(board: EditBoard, x: number, z: number, turns: 1 | -1): EditBoard {
  const cell = cellAt(board, x, z);
  if (!cell || cell.kind !== 'die') return board;
  const lies = ALL_ORIENTATIONS.find((o) => o.top === cell.top && o.north === cell.north);
  if (!lies) return board;
  const north = turns === 1 ? lies.west : lies.east;
  return withCell(board, x, z, { ...cell, north });
}

/** Whatever stands on a cell taken off: its die, or the start on its floor. A cell cut out stays cut out. */
export function removeAt(board: EditBoard, x: number, z: number): EditBoard {
  const cell = cellAt(board, x, z);
  if (!cell || cell.kind === 'hole' || (cell.kind === 'empty' && !cell.floorStart)) return board;
  return withCell(board, x, z, { kind: 'empty' });
}

/**
 * The board as the scene of the game can show it. The scene shows only what the rules lay, and
 * a board being drawn is often none: it has no start yet. So where the board drawn is refused
 * for want of a start, it is shown with the player lent a place: on the floor of its first free
 * cell, or, with no cell free, on its first die that rolls. `stand` says which: `own` where the
 * board is shown as drawn, `lent` where the start is lent, `none` where the rules will lay
 * nothing of it (a combo standing ready, a board in two parts) and `spec` is null. `error` is
 * what the rules say of the board as drawn. Nothing of this is written to a file: the file
 * keeps the board as it is drawn.
 */
export function displaySpecOf(board: EditBoard, head: LevelSpec): { spec: LevelSpec | null; stand: 'own' | 'lent' | 'none'; error: string | null } {
  let error: string;
  try {
    return { spec: specOf(board, head), stand: 'own', error: null };
  } catch (refused) {
    error = (refused as Error).message;
  }
  const started = board.cells.some((row) => row.some((cell) => (cell.kind === 'die' && cell.start) || (cell.kind === 'empty' && cell.floorStart)));
  if (!started) {
    const free: { x: number; z: number }[] = [];
    const rolling: { x: number; z: number }[] = [];
    board.cells.forEach((row, z) =>
      row.forEach((cell, x) => {
        if (cell.kind === 'empty') free.push({ x, z });
        else if (cell.kind === 'die' && !cell.fixed) rolling.push({ x, z });
      }),
    );
    for (const at of [...free.slice(0, 1), ...rolling.slice(0, 1)]) {
      try {
        return { spec: specOf(setStart(board, at.x, at.z), head), stand: 'lent', error };
      } catch {
        // Not this place: the next is tried.
      }
    }
  }
  return { spec: null, stand: 'none', error };
}
