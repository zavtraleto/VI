import { describe, expect, it } from 'vitest';
import { RIBBON_MS, nextBoard, revealBands, ribbonPhase } from './ribbon';

describe('the order of the boards of the ribbon', () => {
  it('goes from a stage of the first level to the stage after it', () => {
    expect(nextBoard({ stage: 0 }, 4, 30)).toEqual({ stage: 1 });
    expect(nextBoard({ stage: 2 }, 4, 30)).toEqual({ stage: 3 });
  });

  it('goes from the last stage to the first level of the list', () => {
    expect(nextBoard({ stage: 3 }, 4, 30)).toEqual({ level: 0 });
  });

  it('goes down the list in its order, from whichever level was passed, skipping none', () => {
    expect(nextBoard({ level: 0 }, 4, 30)).toEqual({ level: 1 });
    expect(nextBoard({ level: 17 }, 4, 30)).toEqual({ level: 18 });
  });

  it('ends after the last level of the list', () => {
    expect(nextBoard({ level: 29 }, 4, 30)).toBeNull();
  });

  it('ends after the last stage where the list has no level', () => {
    expect(nextBoard({ stage: 3 }, 4, 0)).toBeNull();
  });

  it('walks the whole ribbon: the four stages, then every level, then nothing', () => {
    const seen: string[] = [];
    let at: { stage?: number; level?: number } | null = { stage: 0 };
    while (at) {
      seen.push(at.stage !== undefined ? `F${at.stage}` : `L${at.level}`);
      at = nextBoard(at, 4, 3);
    }
    expect(seen).toEqual(['F0', 'F1', 'F2', 'F3', 'L0', 'L1', 'L2']);
  });
});

describe('the phases of the passage between two boards', () => {
  it('has the lengths the plan gives', () => {
    expect(RIBBON_MS).toEqual({ fade: 500, reveal: 800, figure: 300 });
  });

  it('starts by putting the old board out, from all of its rows to none', () => {
    expect(ribbonPhase(0, false)).toEqual({ phase: 'fade', rows: 1, figure: 0 });
    expect(ribbonPhase(250, false)).toEqual({ phase: 'fade', rows: 0.5, figure: 0 });
    expect(ribbonPhase(499, false).phase).toBe('fade');
  });

  it('then draws the new one, from none of its rows to all, with no figure on it yet', () => {
    expect(ribbonPhase(500, false)).toEqual({ phase: 'reveal', rows: 0, figure: 0 });
    expect(ribbonPhase(900, false)).toEqual({ phase: 'reveal', rows: 0.5, figure: 0 });
    expect(ribbonPhase(1299, false)).toMatchObject({ phase: 'reveal', figure: 0 });
  });

  it('then brings the figure onto a board that is whole, from none of it to all, and then is done', () => {
    expect(ribbonPhase(1300, false)).toEqual({ phase: 'figure', rows: 1, figure: 0 });
    expect(ribbonPhase(1450, false)).toEqual({ phase: 'figure', rows: 1, figure: 0.5 });
    expect(ribbonPhase(1599, false).phase).toBe('figure');
    expect(ribbonPhase(1599, false).figure).toBeLessThan(1);
    expect(ribbonPhase(1600, false)).toEqual({ phase: 'done', rows: 1, figure: 1 });
    expect(ribbonPhase(60_000, false)).toEqual({ phase: 'done', rows: 1, figure: 1 });
  });

  it('has not begun before its time: the dice are still leaving', () => {
    expect(ribbonPhase(-1, false)).toEqual({ phase: 'leave', rows: 1, figure: 0 });
  });

  it('with motion kept low has no rows and no coming: the board is changed at once, and the figure stands on it', () => {
    expect(ribbonPhase(0, true)).toEqual({ phase: 'figure', rows: 1, figure: 1 });
    expect(ribbonPhase(299, true)).toEqual({ phase: 'figure', rows: 1, figure: 1 });
    expect(ribbonPhase(300, true)).toEqual({ phase: 'done', rows: 1, figure: 1 });
  });
});

describe('the rows of the surface that are drawn', () => {
  it('a board going out loses its rows from the top, whole rows at a time', () => {
    expect(revealBands(1, 4, false)).toEqual({ edge: [0, 4], lines: [0, 4] });
    expect(revealBands(0.9, 4, false)).toEqual({ edge: [0, 4], lines: [0, 4] });
    expect(revealBands(0.5, 4, false)).toEqual({ edge: [2, 4], lines: [2, 4] });
    expect(revealBands(0.1, 4, false)).toEqual({ edge: [3, 4], lines: [3, 4] });
    expect(revealBands(0, 4, false)).toEqual({ edge: [4, 4], lines: [4, 4] });
  });

  it('a board coming gets its heavy line first, row by row from the top, and the lines inside a row behind', () => {
    expect(revealBands(0, 4, true)).toEqual({ edge: [0, 0], lines: [0, 0] });
    expect(revealBands(0.1, 4, true)).toEqual({ edge: [0, 1], lines: [0, 0] });
    expect(revealBands(0.5, 4, true)).toEqual({ edge: [0, 3], lines: [0, 2] });
    expect(revealBands(0.9, 4, true)).toEqual({ edge: [0, 4], lines: [0, 3] });
    expect(revealBands(1, 4, true)).toEqual({ edge: [0, 4], lines: [0, 4] });
  });

  it('changes no more often than a board has rows, and one time more for a board that comes', () => {
    for (const cells of [3, 5, 6]) {
      for (const coming of [false, true]) {
        const seen = new Set<string>();
        for (let i = 0; i <= 1000; i++) seen.add(JSON.stringify(revealBands(i / 1000, cells, coming)));
        expect(seen.size).toBe(coming ? cells + 2 : cells + 1);
      }
    }
  });
});
