import { describe, expect, it } from 'vitest';
import { CURSOR_CORNER, CURSOR_MARK, cursorDot, cursorRows } from './cursor';

describe('the cursor of the mouse', () => {
  it('is a corner with a diagonal, the same on both sides of it', () => {
    for (let r = 0; r < CURSOR_CORNER.length; r++) {
      for (let c = 0; c < CURSOR_CORNER.length; c++) expect(CURSOR_CORNER[r][c]).toBe(CURSOR_CORNER[c][r]);
    }
  });

  it('has a glowing edge one dot wide all around it', () => {
    const rows = cursorRows();
    expect(rows.length).toBe(CURSOR_CORNER.length + 2);
    expect(rows[0].length).toBe(CURSOR_CORNER[0].length + 2);
    // The point of the corner is just inside the edge, where the hot spot is.
    expect(rows[1][1]).toBe('#');
    expect(rows[0][0]).toBe('o');
  });

  it('over what a press runs, has its red mark inside the corner, with the inside all around it', () => {
    const rows = cursorRows(CURSOR_CORNER, true);
    const marks = rows.join('').split('').filter((dot) => dot === 'x').length;
    expect(marks).toBe(CURSOR_MARK.side * CURSOR_MARK.side);
    // The ring of the inside around the mark: one dot on every side, inside the edge.
    const from = 1 + CURSOR_MARK.at;
    for (let i = from - 1; i <= from + CURSOR_MARK.side; i++) {
      expect(rows[from - 1][i]).toBe('#');
      expect(rows[i][from - 1]).toBe('#');
      expect(rows[from + CURSOR_MARK.side][i]).toBe('#');
      expect(rows[i][from + CURSOR_MARK.side]).toBe('#');
    }
  });

  it('takes a dot of the picture for its dot, and smaller dots where it would pass 32 CSS pixels', () => {
    expect(cursorDot(1)).toBe(1);
    expect(cursorDot(2)).toBe(2);
    expect(cursorDot(4)).toBe(2);
    expect(cursorDot(0.6)).toBe(1);
    for (const zoom of [1, 2, 3, 4, 6]) expect(cursorRows().length * cursorDot(zoom)).toBeLessThanOrEqual(32);
  });
});
