import { describe, expect, it } from 'vitest';
import { LESSON } from '../levels/boardSamples';
import { normalSpec } from '../levels/boardFile';
import { LEVELS } from '../levels/levels';
import { ROAD } from '../levels/road';
import { ALL_ORIENTATIONS, roll } from '../rules/orientation';
import { cellAt, clearCell, cycleLeaving, editBoardOf, emptyBoard, putDie, resize, rollDie, setStart, specOf, textOf, toggleFixed, toggleHole } from './editBoard';

describe('editBoardOf', () => {
  it('holds a board cell for cell: a start on the floor, a fixed die, a die that is leaving', () => {
    const board = editBoardOf(LESSON);
    expect(cellAt(board, 3, 5)).toEqual({ kind: 'empty', floorStart: true });
    expect(cellAt(board, 1, 0)).toMatchObject({ kind: 'die', fixed: true });
    expect(cellAt(board, 3, 4)).toMatchObject({ kind: 'die', leaving: 1 });
    expect(cellAt(board, 0, 0)).toEqual({ kind: 'hole' });
  });
  it.each([...ROAD, ...LEVELS].map((spec) => [spec.id, spec] as const))('gives %s back as the level it was', (_, spec) => {
    expect(normalSpec(specOf(editBoardOf(spec), spec))).toEqual(normalSpec(spec));
  });
});

describe('the changes of a board', () => {
  const head = ROAD[2];
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
    expect(textOf(drawn, head, { status: 'idea' })).toContain('status: idea');
  });
});
