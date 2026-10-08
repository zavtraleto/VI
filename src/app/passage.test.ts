import { describe, expect, it } from 'vitest';
import { boardAfter, orderOf, passageAt, passageEnd, startBoard, type PassageTimes } from './passage';

/** The numbers the look has for the passage as it is first laid out. */
const TIMES: PassageTimes = { comboStepMs: 140, comboHoldMs: 350, sinkMs: 1300, eraseMs: 700, cameraMs: 900, drawMs: 1100, riseMs: 600, riseStepMs: 90 };
const COUNTS = { combo: 3, dice: 4, stair: false };
const at = (ms: number, reduced = false, counts = COUNTS) => passageAt(ms, TIMES, counts, reduced);

describe('the board the program opens on', () => {
  it('is the first piece of the road for one who has not passed it, whatever they have passed of the list', () => {
    expect(startBoard(false, 0)).toEqual({ road: 0 });
    expect(startBoard(false, 7)).toEqual({ road: 0 });
  });

  it('is the level of the list the player goes on with for one who has passed it', () => {
    expect(startBoard(true, 0)).toEqual({ level: 0 });
    expect(startBoard(true, 7)).toEqual({ level: 7 });
  });
});

describe('the board that comes after a board', () => {
  it('is the next piece of the road, wherever the player stands in the list', () => {
    expect(boardAfter({ road: 3 }, 20, 30, 0)).toEqual({ road: 4 });
    expect(boardAfter({ road: 0 }, 4, 30, 0)).toEqual({ road: 1 });
    expect(boardAfter({ road: 2 }, 4, 30, 7)).toEqual({ road: 3 });
  });

  it('after the last piece is the level of the list the player goes on with', () => {
    expect(boardAfter({ road: 19 }, 20, 30, 0)).toEqual({ level: 0 });
    // One who has passed levels of the list is not walked through them again.
    expect(boardAfter({ road: 3 }, 4, 30, 7)).toEqual({ level: 7 });
    expect(boardAfter({ road: 3 }, 4, 30, 29)).toEqual({ level: 29 });
  });

  it('goes down the list in its order, from whichever level was passed, skipping none', () => {
    expect(boardAfter({ level: 0 }, 20, 30, 0)).toEqual({ level: 1 });
    expect(boardAfter({ level: 17 }, 20, 30, 3)).toEqual({ level: 18 });
  });

  it('is none after the last level of the list, and after the road where the list has no level', () => {
    expect(boardAfter({ level: 29 }, 20, 30, 0)).toBeNull();
    expect(boardAfter({ level: 29 }, 20, 30, 5)).toBeNull();
    expect(boardAfter({ road: 3 }, 4, 0, 0)).toBeNull();
  });

  it('walks one who is new through the whole of it: the road, then every level, then nothing', () => {
    const seen: string[] = [];
    let board: { road?: number; level?: number } | null = startBoard(false, 0);
    while (board) {
      seen.push(board.road !== undefined ? `R${board.road}` : `L${board.level}`);
      board = boardAfter(board, 4, 3, 0);
    }
    expect(seen).toEqual(['R0', 'R1', 'R2', 'R3', 'L0', 'L1', 'L2']);
  });
});

describe('the passage between two boards', () => {
  it('begins with the dice of the combo lighting up one after another', () => {
    expect(at(0)).toMatchObject({ phase: 'combo', lit: 1, swapped: false, camera: 0, lines: 1, risen: 0 });
    expect(at(139).lit).toBe(1);
    expect(at(140).lit).toBe(2);
    expect(at(280).lit).toBe(3);
    expect(at(769)).toMatchObject({ phase: 'combo', lit: 3 });
  });

  it('then sends them under the floor, a step apart, the lines whole', () => {
    expect(at(770)).toMatchObject({ phase: 'sink', at: 0, lit: 3, lines: 1, swapped: false });
    expect(at(2349).phase).toBe('sink');
    expect(at(2349).at).toBeLessThan(1);
  });

  it('then erases the lines of the board, from all of them to none', () => {
    expect(at(2350)).toMatchObject({ phase: 'erase', at: 0, lines: 1, swapped: false });
    expect(at(2700).lines).toBeCloseTo(0.5);
    expect(at(3049)).toMatchObject({ phase: 'erase', swapped: false });
    expect(at(3049).lines).toBeLessThan(0.01);
  });

  it('then the board is the next one: its lines are drawn while the camera travels', () => {
    expect(at(3050)).toMatchObject({ phase: 'draw', at: 0, swapped: true, lines: 0, camera: 0, risen: 0 });
    expect(at(3600).lines).toBeCloseTo(0.5);
    expect(at(3500).camera).toBeCloseTo(0.5);
    expect(at(3950).camera).toBe(1);
    expect(at(4149)).toMatchObject({ phase: 'draw', risen: 0 });
  });

  it('then its dice come up, a step apart, and then it is done', () => {
    expect(at(4150)).toMatchObject({ phase: 'rise', at: 0, lines: 1, risen: 0, swapped: true });
    expect(at(4150 + 600).risen).toBe(1);
    expect(at(4150 + 600 + 180).risen).toBe(3);
    expect(at(5019)).toMatchObject({ phase: 'rise', risen: 3 });
    expect(at(5020)).toMatchObject({ phase: 'done', at: 1, risen: 4, lines: 1, camera: 1, swapped: true, lit: 3 });
    expect(at(60_000)).toMatchObject({ phase: 'done', risen: 4 });
    expect(passageEnd(TIMES, COUNTS, false)).toBe(5020);
  });

  it('brings a stair after the other dice stand', () => {
    const stair = { combo: 3, dice: 4, stair: true };
    // The three others stand a step apart; the stair has not begun.
    expect(at(4150 + 600 + 180, false, stair).risen).toBe(3);
    expect(at(5020, false, stair)).toMatchObject({ phase: 'rise', risen: 3 });
    expect(at(4150 + 180 + 600 + 599, false, stair).risen).toBe(3);
    expect(at(4150 + 180 + 600 + 600, false, stair)).toMatchObject({ phase: 'done', risen: 4 });
  });

  it('with motion kept low changes the board at once when the dice are gone', () => {
    expect(at(0, true)).toMatchObject({ phase: 'combo', lit: 1 });
    expect(at(770, true).phase).toBe('sink');
    expect(at(2349, true)).toMatchObject({ phase: 'sink', swapped: false });
    expect(at(2350, true)).toMatchObject({ phase: 'done', swapped: true, lines: 1, camera: 1, risen: 4 });
    expect(passageEnd(TIMES, COUNTS, true)).toBe(2350);
  });

  it('where no die lights up, waits the pause and sends what there is under together', () => {
    const none = { combo: 0, dice: 2, stair: false };
    expect(at(0, false, none)).toMatchObject({ phase: 'combo', lit: 0 });
    expect(at(350, false, none).phase).toBe('sink');
    expect(at(350 + 1300, false, none).phase).toBe('erase');
  });

  it('lights every die at once where there is no step between them', () => {
    expect(passageAt(0, { ...TIMES, comboStepMs: 0 }, COUNTS, false)).toMatchObject({ phase: 'combo', lit: 3 });
  });
});

describe('the order of the dice in a passage', () => {
  const dice = [
    { x: 3, z: 0 },
    { x: 1, z: 1 },
    { x: 0, z: 0 },
    { x: 1, z: 0 },
  ];

  it('is the nearest to the player first, by steps along the board', () => {
    expect(orderOf(dice, { x: 0, z: 0 })).toEqual([2, 3, 1, 0]);
  });

  it('is the same every time: of two as near, the one in the lower row, then the lower column', () => {
    expect(orderOf([{ x: 1, z: 2 }, { x: 2, z: 1 }, { x: 0, z: 1 }, { x: 1, z: 0 }], { x: 1, z: 1 })).toEqual([3, 2, 1, 0]);
  });

  it('puts the dice named as late after all the others, in the same order among themselves', () => {
    expect(orderOf([{ x: 0, z: 0, late: true }, { x: 3, z: 0 }, { x: 1, z: 0, late: true }, { x: 2, z: 0 }], { x: 0, z: 0 })).toEqual([3, 1, 0, 2]);
  });
});
