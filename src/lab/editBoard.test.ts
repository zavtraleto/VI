import { describe, expect, it } from 'vitest';
import { DOWN_AND_UP, LESSON } from '../levels/boardSamples';
import { normalSpec } from '../levels/boardFile';
import { fileBoard } from '../levels/boardFiles';
import { rowBoards } from '../levels/boardSets';
import { ALL_ORIENTATIONS, roll } from '../rules/orientation';
import { cellAt, clearCell, cycleLeaving, displaySpecOf, editBoardOf, emptyBoard, moveDie, putDie, putFixed, removeAt, resize, rollAlong, rollDie, setStart, setTop, specOf, spinDie, textOf, toggleFixed, toggleHole } from './editBoard';

describe('editBoardOf', () => {
  it('holds a board cell for cell: a start on the floor, a fixed die, a die that is leaving', () => {
    const board = editBoardOf(LESSON);
    expect(cellAt(board, 2, 5)).toEqual({ kind: 'empty', floorStart: true });
    expect(cellAt(board, 4, 0)).toMatchObject({ kind: 'die', fixed: true });
    expect(cellAt(board, 2, 4)).toMatchObject({ kind: 'die', leaving: 1 });
    expect(cellAt(board, 5, 0)).toEqual({ kind: 'hole' });
  });
  it.each(rowBoards().map((spec) => [spec.id, spec] as const))('gives %s back as the level it was', (_, spec) => {
    expect(normalSpec(specOf(editBoardOf(spec), spec))).toEqual(normalSpec(spec));
  });
});

describe('the changes of a board', () => {
  const head = fileBoard('R03');
  it('puts a die on an empty cell, and turns a die to its next face', () => {
    const one = putDie(emptyBoard(3), 1, 1);
    expect(cellAt(one, 1, 1)).toMatchObject({ kind: 'die', top: 1 });
    const two = putDie(one, 1, 1);
    expect(cellAt(two, 1, 1)).toMatchObject({ kind: 'die', top: 2 });
    let six = two;
    for (let turn = 0; turn < 4; turn++) six = putDie(six, 1, 1);
    expect(cellAt(putDie(six, 1, 1), 1, 1)).toMatchObject({ top: 1 });
    // The board it was made from is left as it was.
    expect(cellAt(one, 1, 1)).toMatchObject({ top: 1 });
  });
  it('rolls a die where it stands as a roll would turn it', () => {
    const board = putDie(emptyBoard(3), 0, 0);
    const lies = ALL_ORIENTATIONS.find((o) => o.top === 1)!;
    const rolled = roll(lies, 'E');
    expect(cellAt(rollDie(board, 0, 0, 'E'), 0, 0)).toMatchObject({ top: rolled.top, north: rolled.north });
    expect(rollDie(board, 1, 1, 'E')).toBe(board);
  });
  it('keeps one start: on a die, or on the floor of an empty cell', () => {
    let board = setStart(putDie(emptyBoard(3), 0, 0), 0, 0);
    expect(cellAt(board, 0, 0)).toMatchObject({ start: true });
    board = setStart(board, 2, 2);
    expect(cellAt(board, 2, 2)).toEqual({ kind: 'empty', floorStart: true });
    expect(cellAt(board, 0, 0)).not.toHaveProperty('start');
    // A die put where the player stood on the floor is the die they stand on.
    expect(cellAt(putDie(board, 2, 2), 2, 2)).toMatchObject({ kind: 'die', start: true });
  });
  it('cuts a cell out and puts it back, fixes a die, counts the moves of one that is leaving, clears a cell', () => {
    const board = putDie(emptyBoard(3), 1, 1);
    expect(cellAt(toggleHole(board, 0, 0), 0, 0)).toEqual({ kind: 'hole' });
    expect(cellAt(toggleHole(toggleHole(board, 0, 0), 0, 0), 0, 0)).toEqual({ kind: 'empty' });
    expect(cellAt(toggleFixed(board, 1, 1), 1, 1)).toMatchObject({ fixed: true });
    expect(cellAt(toggleFixed(toggleFixed(board, 1, 1), 1, 1), 1, 1)).not.toHaveProperty('fixed');
    const once = cycleLeaving(board, 1, 1, 2);
    expect(cellAt(once, 1, 1)).toMatchObject({ leaving: 1 });
    expect(cellAt(cycleLeaving(once, 1, 1, 2), 1, 1)).toMatchObject({ leaving: 2 });
    expect(cellAt(cycleLeaving(cycleLeaving(once, 1, 1, 2), 1, 1, 2), 1, 1)).not.toHaveProperty('leaving');
    expect(cellAt(clearCell(board, 1, 1), 1, 1)).toEqual({ kind: 'empty' });
  });
  it('grows and shrinks between three and eight a side, keeping what both squares have', () => {
    const board = setStart(putDie(emptyBoard(3), 2, 2), 2, 2);
    expect(resize(board, 5).size).toBe(5);
    expect(cellAt(resize(board, 5), 2, 2)).toMatchObject({ kind: 'die', start: true });
    expect(resize(board, 12).size).toBe(8);
    expect(resize(board, 1).size).toBe(3);
  });
  it('says what the rules refuse of a board, as a file of it would', () => {
    expect(() => specOf(emptyBoard(3), head)).toThrow(/one start is needed, found 0/);
    const drawn = setStart(putDie(putDie(emptyBoard(3), 1, 1), 1, 2), 1, 2);
    expect(specOf(drawn, head).layout!.dice).toHaveLength(2);
    expect(textOf(drawn, head, { status: 'D' })).toContain('status: D');
  });
});

describe('the changes a drag makes', () => {
  it('carries a die to an empty cell with its marks, and to no cell that is taken or cut out', () => {
    const board = editBoardOf(LESSON);
    const moved = moveDie(board, { x: 2, z: 4 }, { x: 2, z: 2 });
    expect(cellAt(moved, 2, 2)).toMatchObject({ kind: 'die', leaving: 1 });
    expect(cellAt(moved, 2, 4)).toEqual({ kind: 'empty' });
    expect(moveDie(board, { x: 2, z: 4 }, { x: 2, z: 3 })).toBe(board);
    expect(moveDie(board, { x: 2, z: 4 }, { x: 5, z: 0 })).toBe(board);
    // Carried to the cell the player stands on the floor of, it is the die they stand on.
    expect(cellAt(moveDie(board, { x: 2, z: 3 }, { x: 2, z: 5 }), 2, 5)).toMatchObject({ kind: 'die', start: true });
    const start = editBoardOf(DOWN_AND_UP);
    expect(cellAt(moveDie(start, { x: 0, z: 0 }, { x: 3, z: 0 }), 3, 0)).toMatchObject({ start: true });
  });
  it('drops a face on a cell: a die on an empty one, another top on a die, and a fixed die', () => {
    const board = setTop(emptyBoard(3), 1, 1, 4);
    expect(cellAt(board, 1, 1)).toMatchObject({ kind: 'die', top: 4 });
    const fixed = toggleFixed(board, 1, 1);
    expect(cellAt(setTop(fixed, 1, 1, 2), 1, 1)).toMatchObject({ top: 2, fixed: true });
    expect(setTop(board, 1, 1, 4)).toBe(board);
    expect(cellAt(putFixed(emptyBoard(3), 0, 0, 3), 0, 0)).toMatchObject({ top: 3, fixed: true });
  });
  it('spins a die about its top: four quarters bring it back, and each is a way the die can lie', () => {
    const board = setTop(emptyBoard(3), 1, 1, 5);
    let spun = board;
    const norths = new Set<number>();
    for (let turn = 0; turn < 4; turn++) {
      spun = spinDie(spun, 1, 1, 1);
      const cell = cellAt(spun, 1, 1) as { top: number; north: number };
      expect(cell.top).toBe(5);
      expect(ALL_ORIENTATIONS.some((o) => o.top === cell.top && o.north === cell.north)).toBe(true);
      norths.add(cell.north);
    }
    expect(norths.size).toBe(4);
    expect(spun).toEqual(board);
    expect(spinDie(spinDie(board, 1, 1, 1), 1, 1, -1)).toEqual(board);
  });
  it('takes a die or a start on the floor off a cell', () => {
    const board = setStart(setTop(emptyBoard(3), 1, 1, 2), 0, 0);
    expect(cellAt(removeAt(board, 1, 1), 1, 1)).toEqual({ kind: 'empty' });
    expect(cellAt(removeAt(board, 0, 0), 0, 0)).toEqual({ kind: 'empty' });
    expect(removeAt(board, 2, 2)).toBe(board);
  });
});

describe('rollAlong', () => {
  const lies = (top: number) => ALL_ORIENTATIONS.find((o) => o.top === top)!;
  const start = putDie(emptyBoard(4), 0, 0); // a die with 1 on top at 0,0
  it('rolls a die cell by cell as the game rolls it, and leaves the cells behind it empty', () => {
    const { board, at } = rollAlong(start, { x: 0, z: 0 }, [{ x: 1, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }]);
    const turned = roll(roll(roll(lies(1), 'E'), 'E'), 'S');
    expect(at).toEqual({ x: 2, z: 1 });
    expect(cellAt(board, 2, 1)).toMatchObject({ kind: 'die', top: turned.top, north: turned.north });
    expect(cellAt(board, 0, 0)).toEqual({ kind: 'empty' });
  });
  it('stops at the last free cell: before a die, a cut cell, the player on the floor, or a step that is no step', () => {
    const blocked = putDie(toggleHole(start, 1, 1), 2, 0);
    expect(rollAlong(blocked, { x: 0, z: 0 }, [{ x: 1, z: 0 }, { x: 2, z: 0 }]).at).toEqual({ x: 1, z: 0 });
    expect(rollAlong(blocked, { x: 0, z: 0 }, [{ x: 0, z: 1 }, { x: 1, z: 1 }]).at).toEqual({ x: 0, z: 1 });
    expect(rollAlong(start, { x: 0, z: 0 }, [{ x: 2, z: 0 }]).at).toEqual({ x: 0, z: 0 });
    const floor = setStart(start, 1, 0);
    expect(rollAlong(floor, { x: 0, z: 0 }, [{ x: 1, z: 0 }]).at).toEqual({ x: 0, z: 0 });
  });
  it('takes the player on the die along with it, and does not roll a fixed die', () => {
    const riding = setStart(start, 0, 0);
    expect(cellAt(rollAlong(riding, { x: 0, z: 0 }, [{ x: 1, z: 0 }]).board, 1, 0)).toMatchObject({ kind: 'die', start: true });
    const fixed = toggleFixed(start, 0, 0);
    expect(rollAlong(fixed, { x: 0, z: 0 }, [{ x: 1, z: 0 }]).board).toBe(fixed);
  });
});

describe('displaySpecOf', () => {
  const head = DOWN_AND_UP;
  it('shows a board the rules take as it is drawn', () => {
    const shown = displaySpecOf(editBoardOf(DOWN_AND_UP), head);
    expect(shown).toMatchObject({ stand: 'own', error: null });
    expect(normalSpec(shown.spec!)).toEqual(normalSpec(DOWN_AND_UP));
  });
  it('lends a board with no start a place on the floor, and says what the board as drawn wants', () => {
    const empty = displaySpecOf(emptyBoard(4), head);
    expect(empty.stand).toBe('lent');
    expect(empty.spec!.layout).toMatchObject({ onFloor: true, start: { x: 0, z: 0 }, dice: [] });
    expect(empty.error).toMatch(/one start is needed, found 0/);
    const one = displaySpecOf(setTop(emptyBoard(3), 0, 0, 2), head);
    expect(one.spec!.layout).toMatchObject({ onFloor: true, start: { x: 1, z: 0 } });
  });
  it('lends the first die that rolls where no cell is free, and shows nothing of a board the rules will not lay with any start', () => {
    let full = emptyBoard(3);
    // Faces by turns, so that no two alike stand side by side.
    for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) full = setTop(full, x, z, ((x + z * 2) % 3) * 2 + 1);
    const lent = displaySpecOf(full, { ...head, faces: [2], values: [2] });
    expect(lent.stand).toBe('lent');
    expect(lent.spec!.layout!.onFloor).toBeUndefined();
    // A board in two parts is no board, with a start or without: nothing of it is shown.
    const apart = toggleHole(toggleHole(toggleHole(setTop(emptyBoard(3), 0, 0, 2), 0, 1), 1, 1), 2, 1);
    expect(displaySpecOf(apart, head)).toMatchObject({ spec: null, stand: 'none' });
  });
});
