import { describe, expect, it } from 'vitest';
import { COUNTER_CUBE, COUNTER_GAP, counterLeft, counterWidth, hudLayout, netBounds, netCellAt, signBeside, signClear, signKey, signPlace, undoButton, turned, type FloorAxes } from './hudLayout';
import { ICON_MUTE_CROSS, ICON_MUTE_SPEAKER, ICON_PAUSE, ICON_RESTART, ICON_SOUND, ICON_UNDO } from './icons';
import { CELL_W, MIN_ZONE, type Box } from './layout';
import { BUTTON_H } from './theme';

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
/** The floor as the default camera shows it. */
const AXES: FloorAxes = { east: { x: 0.87, y: 0.31 }, south: { x: -0.5, y: 0.53 } };

describe('the readings of a session', () => {
  it('keep the large number, the middle and the right side apart on every picture', () => {
    for (const [width, height, zoom] of [
      [240, 520, 1.33],
      [281, 609, 1.33],
      [320, 693, 1.33],
      [400, 400, 2],
    ]) {
      const layout = hudLayout({ width, height }, NO_INSETS, zoom);
      expect(layout.wide).toBe(false);
      expect(layout.mid).toBeGreaterThanOrEqual(layout.left + 6 * CELL_W * 2);
      expect(layout.end).toBeLessThan(layout.pause.x);
      expect(layout.pause.x + layout.pause.w).toBeLessThanOrEqual(width);
      // The score of six digits on the right never reaches the middle reading on its row.
      if (!layout.tight) expect(layout.end - 6 * CELL_W).toBeGreaterThanOrEqual(layout.mid + 5 * CELL_W);
      expect(layout.height).toBeGreaterThan(layout.rule);
    }
  });

  it('give the pause a zone a finger can hit around a button that is a button tall', () => {
    const layout = hudLayout({ width: 281, height: 609 }, NO_INSETS, 1.33);
    expect([layout.pause.w, layout.pause.h]).toEqual([BUTTON_H, BUTTON_H]);
    expect(layout.zones.pause.h * 1.33).toBeGreaterThanOrEqual(MIN_ZONE);
    expect(layout.zones.pause.w * 1.33).toBeGreaterThanOrEqual(MIN_ZONE);
  });

  it('stand clear of what the edges of the screen keep', () => {
    const plain = hudLayout({ width: 281, height: 609 }, NO_INSETS, 1.33);
    const notched = hudLayout({ width: 281, height: 609 }, { top: 30, right: 0, bottom: 0, left: 0 }, 1.33);
    expect(notched.rowA).toBeGreaterThanOrEqual(plain.rowA + 30);
    expect(notched.height).toBeGreaterThanOrEqual(plain.height + 30);
  });

  it('say when the picture is too narrow for two readings in the middle', () => {
    expect(hudLayout({ width: 240, height: 520 }, NO_INSETS, 1.33).tight).toBe(true);
    expect(hudLayout({ width: 320, height: 693 }, NO_INSETS, 1.33).tight).toBe(false);
  });

  it('stand in a column down the left of a wide picture and take none of its height', () => {
    for (const [width, height, zoom] of [
      [640, 360, 2],
      [640, 360, 3],
      [609, 281, 1.33],
    ]) {
      const layout = hudLayout({ width, height }, NO_INSETS, zoom);
      expect(layout.wide).toBe(true);
      expect(layout.height).toBe(0);
      expect(layout.column).toBeGreaterThanOrEqual(6 * CELL_W * 2 + 16);
      expect(layout.column).toBeLessThan(width / 3);
      const { lines } = layout;
      // One reading to a line, none over another, the pause under them, the net under the pause.
      expect([lines.label, lines.big, lines.tag, lines.best, lines.link, lines.cells]).toEqual(
        [lines.label, lines.big, lines.tag, lines.best, lines.link, lines.cells].sort((a, b) => a - b),
      );
      expect(lines.tag).toBeGreaterThanOrEqual(lines.big + 32);
      expect(layout.pause.y).toBeGreaterThan(layout.rule);
      expect(layout.zones.pause.h * zoom).toBeGreaterThanOrEqual(MIN_ZONE);
      expect(layout.net.y).toBeGreaterThanOrEqual(layout.pause.y + layout.pause.h);
      expect(layout.net.y + 70).toBeLessThan(height);
    }
  });
});

describe('the net of the die under the player', () => {
  const centre = { x: 100, y: 100 };
  const side = 20;
  const point = (a: number, b: number) => ({
    x: centre.x + (AXES.east.x * a + AXES.south.x * b) * side,
    y: centre.y + (AXES.east.y * a + AXES.south.y * b) * side,
  });
  const at = (a: number, b: number) => {
    const p = point(a, b);
    return netCellAt(p.x, p.y, centre, side, AXES);
  };

  it('has the top face in the middle and a side towards every direction of the board', () => {
    expect(at(0, 0)?.cell).toBe('top');
    expect(at(1, 0)?.cell).toBe('E');
    expect(at(-1, 0)?.cell).toBe('W');
    expect(at(0, 1)?.cell).toBe('S');
    expect(at(0, -1)?.cell).toBe('N');
    // The corners of the cross are not a part of it.
    expect(at(1, 1)).toBeNull();
    expect(at(2, 0)).toBeNull();
  });

  it('tells where in a cell a point is', () => {
    const hit = at(0.25, 0)!;
    expect(hit.cell).toBe('top');
    expect(hit.u).toBeCloseTo(0.75);
    expect(hit.v).toBeCloseTo(0.5);
  });

  it('fits in its bounds', () => {
    const box = netBounds(centre, side, AXES);
    const corners = [
      [1.5, 0.5],
      [1.5, -0.5],
      [-1.5, 0.5],
      [-1.5, -0.5],
      [0.5, 1.5],
      [-0.5, 1.5],
      [0.5, -1.5],
      [-0.5, -1.5],
    ];
    for (const [a, b] of corners) {
      const { x, y } = point(a, b);
      expect(x).toBeGreaterThanOrEqual(box.x);
      expect(x).toBeLessThanOrEqual(box.x + box.w);
      expect(y).toBeGreaterThanOrEqual(box.y);
      expect(y).toBeLessThanOrEqual(box.y + box.h);
    }
  });

  it('turns a point of a face by quarters, and four of them bring it back', () => {
    expect(turned(0.2, 0.3, 0)).toEqual({ u: 0.2, v: 0.3 });
    const once = turned(0.2, 0.3, 1);
    expect(once.u).toBeCloseTo(0.7);
    expect(once.v).toBeCloseTo(0.2);
    const back = turned(0.2, 0.3, 4);
    expect(back.u).toBeCloseTo(0.2);
    expect(back.v).toBeCloseTo(0.3);
    expect(turned(0.2, 0.3, -1)).toEqual(turned(0.2, 0.3, 3));
  });
});

describe('the place of the swipe sign', () => {
  const picture = { x: 0, y: 0, w: 280, h: 600 };

  it('has its key in the middle of the trail, beside the figure the trail starts from', () => {
    expect(signKey({ x: 100, y: 300 }, { x: 20, y: -6 })).toEqual({ x: 110, y: 297 });
    expect(signKey({ x: 100, y: 300 }, { x: -30, y: 0 })).toEqual({ x: 85, y: 300 });
    expect(signKey({ x: 100, y: 300 }, { x: 0, y: 0 })).toEqual({ x: 100, y: 300 });
  });

  it('is where it was asked for when the sign and its trail are on the picture', () => {
    expect(signPlace({ x: 100, y: 300 }, { x: 20, y: -6 }, picture, 4)).toEqual({ x: 100, y: 300 });
    expect(signPlace({ x: 100, y: 300 }, { x: 0, y: 0 }, picture, 10)).toEqual({ x: 100, y: 300 });
  });

  it('is brought to the edge of the picture on the side it left it by, trail and all', () => {
    // East of a board that fills the screen of a phone: the trail ends at the edge, less the room asked.
    expect(signPlace({ x: 300, y: 300 }, { x: 20, y: 0 }, picture, 4)).toEqual({ x: 256, y: 300 });
    expect(signPlace({ x: -30, y: 300 }, { x: -20, y: 0 }, picture, 4)).toEqual({ x: 24, y: 300 });
    expect(signPlace({ x: 100, y: -50 }, { x: 5, y: -20 }, picture, 4)).toEqual({ x: 100, y: 24 });
    expect(signPlace({ x: 100, y: 700 }, { x: -5, y: 20 }, picture, 4)).toEqual({ x: 100, y: 576 });
  });

  it('keeps out of what the edges of the screen keep to themselves', () => {
    const inner = { x: 30, y: 40, w: 220, h: 500 };
    expect(signPlace({ x: 0, y: 0 }, { x: 10, y: 10 }, inner, 4)).toEqual({ x: 34, y: 44 });
    expect(signPlace({ x: 400, y: 900 }, { x: 10, y: 10 }, inner, 4)).toEqual({ x: 236, y: 526 });
  });

  it('stands in the middle of a picture too small for it', () => {
    expect(signPlace({ x: 0, y: 5 }, { x: 40, y: 0 }, { x: 0, y: 0, w: 30, h: 10 }, 4)).toEqual({ x: -5, y: 5 });
  });
});

describe('the trail of the swipe sign beside the die', () => {
  // The die under the figure as it lies on a picture, and a cell of the board the way of each swipe.
  const die = { x: 150, y: 300, w: 40, h: 50 };
  const ends = (run: { from: { x: number; y: number }; trail: { x: number; y: number } }) => ({ x: run.from.x + run.trail.x, y: run.from.y + run.trail.y });

  it('runs to the north beside the die, on its right, the way the strip of the first piece runs on screen', () => {
    const run = signBeside(die, { x: 0, y: -40 }, 1.2, 6);
    // Parallel to the board: the way a cell to the north lies on screen, and as long as the look asks.
    expect(run.trail).toEqual({ x: 0, y: -48 });
    // Right of the die by the gap, and as far below its middle as it ends above it.
    expect(run.from).toEqual({ x: 196, y: 349 });
    expect(ends(run)).toEqual({ x: 196, y: 301 });
  });

  it('keeps the lean of the board: a north that goes up and to the right starts at the gap and leans away from the die', () => {
    const run = signBeside(die, { x: 20, y: -30 }, 1, 6);
    expect(run.trail).toEqual({ x: 20, y: -30 });
    expect(run.from).toEqual({ x: 196, y: 340 });
  });

  it('runs to the south beside the die, on its right, downwards', () => {
    const run = signBeside(die, { x: 0, y: 40 }, 1, 6);
    expect(run.from).toEqual({ x: 196, y: 305 });
    expect(ends(run)).toEqual({ x: 196, y: 345 });
  });

  it('runs to the east away from the die, from the gap on', () => {
    const run = signBeside(die, { x: 30, y: 16 }, 1, 6);
    expect(run.from).toEqual({ x: 196, y: 317 });
    expect(ends(run)).toEqual({ x: 226, y: 333 });
  });

  it('runs to the west towards the die and ends at the gap: it never lies on the die', () => {
    const run = signBeside(die, { x: -30, y: -16 }, 1, 6);
    expect(run.from).toEqual({ x: 226, y: 333 });
    expect(ends(run)).toEqual({ x: 196, y: 317 });
    for (const step of [{ x: 0, y: -40 }, { x: 0, y: 40 }, { x: 30, y: 16 }, { x: -30, y: -16 }, { x: 20, y: -30 }]) {
      const each = signBeside(die, step, 1.5, 6);
      expect(Math.min(each.from.x, ends(each).x)).toBe(196);
    }
  });

  it('is brought in from the right edge of a phone 360 wide, trail and all', () => {
    const phone = { x: 0, y: 40, w: 360, h: 600 };
    const run = signBeside({ x: 310, y: 300, w: 44, h: 50 }, { x: 0, y: -40 }, 1.2, 6);
    expect(run.from.x).toBe(360);
    const from = signPlace(run.from, run.trail, phone, 8);
    expect(from).toEqual({ x: 352, y: 349 });
    // And under the readings: a die in the top row has its sign below them.
    const high = signBeside({ x: 100, y: 44, w: 40, h: 50 }, { x: 0, y: -40 }, 1.2, 6);
    expect(signPlace(high.from, high.trail, phone, 8)).toEqual({ x: 146, y: 96 });
  });

  it('stands below the buttons of a level where it would lie on them, and is left alone where it would not', () => {
    const tools = { x: 280, y: 40, w: 76, h: 24 };
    // Its trail runs up into the buttons: it is moved down until its top is clear of them.
    expect(signClear({ x: 300, y: 100 }, { x: 0, y: -48 }, tools, 4)).toEqual({ x: 300, y: 116 });
    expect(signClear({ x: 300, y: 50 }, { x: 0, y: 30 }, tools, 4)).toEqual({ x: 300, y: 68 });
    // Left of them, or below them, it stays.
    expect(signClear({ x: 200, y: 100 }, { x: 0, y: -48 }, tools, 4)).toEqual({ x: 200, y: 100 });
    expect(signClear({ x: 300, y: 200 }, { x: 0, y: -48 }, tools, 4)).toEqual({ x: 300, y: 200 });
    expect(signClear({ x: 300, y: 100 }, { x: 0, y: -48 }, null, 4)).toEqual({ x: 300, y: 100 });
  });
});

describe('the plaque of a short combo', () => {
  it('is as wide as its cubes: one more cube makes it wider by a cube and its gap', () => {
    expect(counterWidth(3) - counterWidth(2)).toBe(COUNTER_CUBE + COUNTER_GAP);
    expect(counterWidth(6) - counterWidth(2)).toBe(4 * (COUNTER_CUBE + COUNTER_GAP));
    expect(counterWidth(2)).toBeGreaterThan(2 * COUNTER_CUBE);
  });

  /** The picture of a phone 360 wide, drawn pixel for pixel. */
  const phone = { x: 0, y: 0, w: 360, h: 640 };
  const six = counterWidth(6);

  it('stands with its middle over its heap when all of it is in the window', () => {
    expect(counterLeft(180, six, phone, 1)).toBe(180 - six / 2);
    expect(counterLeft(180, counterWidth(2), phone, 1)).toBe(180 - counterWidth(2) / 2);
    // To a whole pixel, as it was drawn before it was kept in the window.
    expect(counterLeft(100.4, counterWidth(3), phone, 1)).toBe(Math.round(100.4 - counterWidth(3) / 2));
    // The nearest it comes to either edge without being moved.
    expect(counterLeft(1 + six / 2, six, phone, 1)).toBe(1);
    expect(counterLeft(359 - six / 2, six, phone, 1)).toBe(359 - six);
  });

  it('of six over a heap at the left or the right edge of the window is brought in from the edge, whole', () => {
    for (const middle of [-40, 0, 10, six / 2]) {
      const left = counterLeft(middle, six, phone, 1);
      expect(left).toBe(1);
      expect(left + six).toBeLessThanOrEqual(360);
    }
    for (const middle of [360 - six / 2, 350, 360, 420]) {
      const left = counterLeft(middle, six, phone, 1);
      expect(left).toBe(359 - six);
      expect(left).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps out of what the edges of the screen keep to themselves, to a whole pixel', () => {
    const notched = { x: 30.5, y: 0, w: 300, h: 640 };
    expect(counterLeft(0, six, notched, 1)).toBe(32);
    expect(counterLeft(360, six, notched, 1)).toBe(329 - six);
    expect(counterLeft(180, six, notched, 1)).toBe(180 - six / 2);
  });

  it('stands in the middle of a window too narrow for it', () => {
    expect(counterLeft(10, six, { x: 0, y: 0, w: 60, h: 100 }, 1)).toBe(30 - six / 2);
  });
});

describe('the readings of a level', () => {
  const NEEDS = { restart: true, sound: true, level: true };

  it('stand in the top left corner as three lines, the same on a tall picture and a wide one, with no score', () => {
    for (const [width, height, zoom] of [
      [240, 520, 1.33],
      [270, 480, 1.33],
      [320, 693, 1.33],
      [640, 360, 2],
      [640, 360, 3],
      [609, 281, 1.33],
    ]) {
      for (const goal of [true, false]) {
        const layout = hudLayout({ width, height }, NO_INSETS, zoom, { ...NEEDS, goal });
        expect(layout.tag).toEqual({ x: layout.left, y: 4 });
        expect(layout.moves).toEqual([24, 44]);
        if (goal) expect(layout.goal).toBe(64);
        expect(layout.rule).toBe((goal ? 64 : 44) + 16);
        // The faces it asks for stand right under the lines.
        expect(layout.net).toEqual({ x: layout.left, y: layout.rule + 4 + 8 });
        expect(layout.height).toBe(layout.wide ? 0 : layout.rule + 4);
      }
    }
  });

  it('have their buttons in the top right corner, side by side a gap apart, clear of the lines', () => {
    for (const [width, height, zoom] of [
      [240, 520, 1.33],
      [270, 480, 1.33],
      [640, 360, 2],
      [640, 360, 3],
      [609, 281, 1.33],
    ]) {
      const layout = hudLayout({ width, height }, NO_INSETS, zoom, NEEDS);
      const sound = layout.sound!;
      const restart = layout.restart!;
      expect(layout.pause.x + layout.pause.w).toBe(layout.right);
      expect(layout.right).toBe(width - 8);
      expect([sound.y, restart.y, layout.pause.y]).toEqual([4, 4, 4]);
      expect(restart.x + restart.w + 8).toBe(layout.pause.x);
      expect(sound.x + sound.w + 8).toBe(restart.x);
      expect(sound.x).toBeGreaterThanOrEqual(layout.end);
    }
    // Without the button of the sound the other two stay in the corner.
    const plain = hudLayout({ width: 270, height: 480 }, NO_INSETS, 1.33, { restart: true, level: true });
    expect(plain.sound).toBeNull();
    expect(plain.restart!.x).toBe(206);
  });

  it('give a wide picture a column as wide as that of a session, and a tall one a band', () => {
    const wide = hudLayout({ width: 640, height: 360 }, NO_INSETS, 3, NEEDS);
    expect([wide.wide, wide.column, wide.height]).toEqual([true, 112, 0]);
    const tall = hudLayout({ width: 270, height: 480 }, NO_INSETS, 1.33, NEEDS);
    expect([tall.wide, tall.column, tall.height]).toEqual([false, 0, 64]);
  });
});

describe('the button of the sound', () => {
  const NEEDS = { restart: true, sound: true, level: true };

  it('is left out where it would lie on the large number', () => {
    expect(hudLayout({ width: 180, height: 295 }, NO_INSETS, 2, NEEDS).sound).toBeNull();
  });
});

describe('the button that takes a move back', () => {
  const stage = { x: 0, y: 60, w: 180, h: 235 };

  it('stands in the bottom left corner of the stage, as tall as a finger needs', () => {
    const { box, tall } = undoButton(stage, 2, 11, 32, 2);
    expect(box.x).toBe(2);
    expect(box.y + box.h).toBe(stage.y + stage.h - 6);
    expect(tall * 2).toBeGreaterThanOrEqual(MIN_ZONE);
    expect(box.w).toBeGreaterThanOrEqual(6 + 11 + 6 + 32 + 6);
    // On a wide picture it is under the column of the readings, not at the left of the board.
    const wide = undoButton({ x: 120, y: 0, w: 520, h: 360 }, 2, 11, 80, 2).box;
    expect(wide.x).toBe(2);
    expect(wide.y + wide.h).toBe(360 - 6);
  });
});

describe('the pictures of the buttons', () => {
  const ALL = { ICON_UNDO, ICON_RESTART, ICON_PAUSE, ICON_SOUND, ICON_MUTE_SPEAKER, ICON_MUTE_CROSS };

  it('are rows of one width, lit only with #', () => {
    for (const [name, icon] of Object.entries(ALL)) {
      for (const row of icon) {
        expect(row.length, name).toBe(icon[0].length);
        expect(row, name).toMatch(/^[.#]+$/);
      }
    }
  });

  it('stand on the grid of the letters: the arrow beside its word is as tall as a capital, those on the square buttons half a button', () => {
    expect(ICON_UNDO.length).toBe(10);
    for (const icon of [ICON_RESTART, ICON_PAUSE, ICON_SOUND, ICON_MUTE_SPEAKER, ICON_MUTE_CROSS]) expect(icon.length).toBe(BUTTON_H / 2);
    // The sound and the sound off take the same room, so the button does not change as it is pressed.
    expect(ICON_MUTE_SPEAKER[0].length).toBe(ICON_SOUND[0].length);
    expect(ICON_MUTE_CROSS[0].length).toBe(ICON_SOUND[0].length);
    for (const icon of Object.values(ALL)) expect(icon[0].length).toBeLessThanOrEqual(BUTTON_H - 4);
  });
});

describe('the readings on the grid of the interface', () => {
  const LEVEL = { restart: true, sound: true, level: true, goal: true };

  it('stand on a tall phone as the grid has them: three buttons 24 a side, 8 apart, the three lines of a level on the left', () => {
    const level = hudLayout({ width: 270, height: 480 }, NO_INSETS, 1.33, LEVEL);
    expect(level.pause).toEqual({ x: 238, y: 4, w: 24, h: 24 });
    expect(level.restart).toEqual({ x: 206, y: 4, w: 24, h: 24 });
    expect(level.sound).toEqual({ x: 174, y: 4, w: 24, h: 24 });
    expect(level.tag).toEqual({ x: 8, y: 4 });
    expect(level.moves).toEqual([24, 44]);
    expect(level.goal).toBe(64);
    expect(level.height).toBe(84);
    expect(level.net).toEqual({ x: 8, y: 92 });
    // A finger's zone around each: 36 a side, cut at the top of the picture.
    expect(level.zones.pause).toEqual({ x: 232, y: 0, w: 36, h: 34 });
    const session = hudLayout({ width: 270, height: 480 }, NO_INSETS, 1.33);
    expect(session.pause).toEqual({ x: 238, y: 4, w: 24, h: 24 });
    expect([session.rule, session.height, session.end]).toEqual([56, 60, 230]);
    expect(session.net.y).toBe(68);
  });

  it('stand on a desk as the grid has them: the lines of a level in the column, its buttons in the top right corner', () => {
    const level = hudLayout({ width: 640, height: 360 }, NO_INSETS, 3, LEVEL);
    expect([level.tag.y, level.moves[0], level.moves[1], level.goal]).toEqual([4, 24, 44, 64]);
    expect([level.sound!.x, level.restart!.x, level.pause.x]).toEqual([544, 576, 608]);
    expect([level.sound!.y, level.pause.w, level.pause.h]).toEqual([4, 24, 24]);
    expect(level.rule).toBe(80);
    expect(level.net.y).toBe(92);
    expect(level.column).toBe(112);
    // On a desk the mouse needs no field around a button: its zone is the button.
    expect(level.zones.pause).toEqual(level.pause);
    const plain = hudLayout({ width: 640, height: 360 }, NO_INSETS, 3, { ...LEVEL, goal: false });
    expect(plain.net.y).toBe(72);
    const session = hudLayout({ width: 640, height: 360 }, NO_INSETS, 3);
    const { lines } = session;
    expect([lines.best, lines.link, lines.cells, session.rule]).toEqual([76, 96, 116, 132]);
    expect(session.pause).toEqual({ x: 8, y: 140, w: 24, h: 24 });
    expect(session.net.y).toBe(session.rule + 40);
  });

  it('have zones that lie in the window and reach over each other by 4 at the most', () => {
    const across = (a: Box, b: Box): number => Math.max(0, Math.min(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)));
    for (const [width, height, zoom] of [
      [270, 480, 1.33],
      [240, 520, 1.33],
      [320, 693, 1.33],
      [640, 360, 3],
      [640, 360, 2],
      [609, 281, 1.33],
    ]) {
      for (const needs of [{}, { restart: true, level: true }, LEVEL, { ...LEVEL, goal: false }]) {
        const { zones } = hudLayout({ width, height }, NO_INSETS, zoom, needs);
        const all = [zones.pause, zones.restart, zones.sound].filter((zone): zone is Box => zone !== null);
        for (const zone of all) {
          expect(zone.x).toBeGreaterThanOrEqual(0);
          expect(zone.y).toBeGreaterThanOrEqual(0);
          expect(zone.x + zone.w).toBeLessThanOrEqual(width);
          expect(zone.y + zone.h).toBeLessThanOrEqual(height);
          expect(zone.w * zoom).toBeGreaterThanOrEqual(MIN_ZONE);
        }
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(across(all[i], all[j])).toBeLessThanOrEqual(4);
      }
    }
  });
});
