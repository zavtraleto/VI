import { describe, expect, it } from 'vitest';
import { CURSOR_ARROW, cursorDot, cursorRows } from './cursor';

describe('the cursor of the mouse', () => {
  it('is an arrow with a ring one dot wide all around it', () => {
    const rows = cursorRows();
    expect(rows.length).toBe(CURSOR_ARROW.length + 2);
    expect(rows[0].length).toBe(CURSOR_ARROW[0].length + 2);
    // The point of the arrow is just inside the ring, where the hot spot is.
    expect(rows[1][1]).toBe('#');
    expect(rows[0][0]).toBe('o');
  });

  it('takes a dot of the picture for its dot, and smaller dots where it would pass 32 CSS pixels', () => {
    expect(cursorDot(2)).toBe(2);
    expect(cursorDot(3)).toBe(3);
    expect(cursorDot(4)).toBe(3);
    expect(cursorDot(0.6)).toBe(1);
    for (const zoom of [1, 2, 3, 4, 6]) expect(cursorRows().length * cursorDot(zoom)).toBeLessThanOrEqual(32);
  });
});
