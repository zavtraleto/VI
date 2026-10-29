import { describe, expect, it } from 'vitest';
import { InputController } from './controller';
import { TAP_SLOP_PX, TapTracker } from './tap';

describe('TapTracker', () => {
  it('reads a press let go where it came down as a tap there', () => {
    const t = new TapTracker();
    t.down(100, 200);
    t.move(103, 198);
    expect(t.up()).toEqual({ x: 100, y: 200 });
  });

  it('reads a press drawn further than the slop as a drag, even if it comes back', () => {
    const t = new TapTracker();
    t.down(100, 200);
    t.move(100 + TAP_SLOP_PX + 1, 200);
    t.move(100, 200);
    expect(t.up()).toBeNull();
  });

  it('forgets a press that is cancelled', () => {
    const t = new TapTracker();
    t.down(10, 10);
    t.cancel();
    expect(t.up()).toBeNull();
  });
});

describe('InputController following a way', () => {
  it('gives the steps one at a time, each when the player can act', () => {
    const c = new InputController();
    c.follow(['E', 'E', 'S'], () => true);
    expect([c.take(0), c.take(10), c.take(20), c.take(30)]).toEqual(['E', 'E', 'S', null]);
    expect(c.following).toBe(false);
  });

  it('drops the rest of the way at the first step the check does not pass', () => {
    const c = new InputController();
    let passes = 2;
    c.follow(['N', 'N', 'N', 'N'], () => passes-- > 0);
    expect([c.take(0), c.take(10), c.take(20), c.take(30)]).toEqual(['N', 'N', null, null]);
  });

  it('is dropped by a press, which steps instead', () => {
    const c = new InputController();
    c.follow(['W', 'W', 'W'], () => true);
    expect(c.take(0)).toBe('W');
    c.press('N', 5);
    c.release();
    expect([c.take(10), c.take(20)]).toEqual(['N', null]);
  });

  it('is dropped by a cancel', () => {
    const c = new InputController();
    c.follow(['S', 'S'], () => true);
    c.cancel();
    expect(c.take(0)).toBeNull();
  });
});
