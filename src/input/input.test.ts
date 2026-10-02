import { describe, expect, it } from 'vitest';
import { InputController } from './controller';
import { CARDINAL_DIRS, DIAMOND_DIRS, GestureTracker, leanDirs, nearestDir, type ScreenDirs } from './gesture';

describe('InputController', () => {
  it('gives exactly one step for a quick press and release', () => {
    const c = new InputController();
    c.press('N', 0);
    c.release();
    expect(c.take(100)).toBe('N'); // buffered until the player is free
    for (let t = 120; t < 2000; t += 20) expect(c.take(t)).toBeNull();
  });

  it('repeats a hold after 320 ms and then every 200 ms', () => {
    const c = new InputController();
    c.press('E', 0);
    const emitted: number[] = [];
    for (let t = 0; t <= 1000; t += 20) {
      if (c.take(t) === 'E') emitted.push(t);
    }
    expect(emitted).toEqual([0, 320, 520, 720, 920]);
  });

  it('stops repeating on release', () => {
    const c = new InputController();
    c.press('E', 0);
    expect(c.take(0)).toBe('E');
    c.release();
    expect(c.take(400)).toBeNull();
  });

  it('keeps only the latest buffered command', () => {
    const c = new InputController();
    c.press('N', 0);
    c.press('W', 10);
    expect(c.take(20)).toBe('W');
    c.release();
    expect(c.take(40)).toBeNull();
  });

  it('drops the hold and the buffer on cancel', () => {
    const c = new InputController();
    c.press('N', 0);
    c.cancel();
    expect(c.take(0)).toBeNull();
    expect(c.take(500)).toBeNull();
  });

  it('turns during a hold without waiting for a second touch', () => {
    const c = new InputController();
    c.press('N', 0);
    expect(c.take(0)).toBe('N');
    expect(c.take(320)).toBe('N');
    c.redirect('E');
    expect(c.take(520)).toBe('E');
    expect(c.take(720)).toBe('E');
  });
});

describe('gesture', () => {
  it('maps screen quadrants to board directions in the diamond view', () => {
    expect(nearestDir(10, -10, DIAMOND_DIRS)).toBe('N'); // up-right
    expect(nearestDir(10, 10, DIAMOND_DIRS)).toBe('E'); // down-right
    expect(nearestDir(-10, 10, DIAMOND_DIRS)).toBe('S'); // down-left
    expect(nearestDir(-10, -10, DIAMOND_DIRS)).toBe('W'); // up-left
    expect(nearestDir(10, -1, DIAMOND_DIRS)).toBe('N');
    expect(nearestDir(10, 1, DIAMOND_DIRS)).toBe('E');
  });

  it('follows the camera: with the board turned to face the player, up means north', () => {
    const turned: ScreenDirs = {
      N: { x: 0.26, y: -0.97 },
      E: { x: 0.97, y: 0.26 },
      S: { x: -0.26, y: 0.97 },
      W: { x: -0.97, y: -0.26 },
    };
    expect(nearestDir(0, -10, turned)).toBe('N');
    expect(nearestDir(10, 0, turned)).toBe('E');
    expect(nearestDir(0, 10, turned)).toBe('S');
    expect(nearestDir(-10, 0, turned)).toBe('W');
    expect(nearestDir(10, -10, turned)).toBe('N'); // 45 degrees up-right is closer to north here
  });

  it('reads plain swipes: up, right, down and left', () => {
    expect(nearestDir(0, -20, CARDINAL_DIRS)).toBe('N');
    expect(nearestDir(20, 0, CARDINAL_DIRS)).toBe('E');
    expect(nearestDir(0, 20, CARDINAL_DIRS)).toBe('S');
    expect(nearestDir(-20, 0, CARDINAL_DIRS)).toBe('W');
    // A swipe that leans stays with the nearer axis.
    expect(nearestDir(8, -20, CARDINAL_DIRS)).toBe('N');
    expect(nearestDir(-20, 8, CARDINAL_DIRS)).toBe('W');

    const controller = new InputController();
    const tracker = new GestureTracker(controller, () => 0, () => CARDINAL_DIRS);
    tracker.down(100, 100);
    tracker.move(100, 70);
    expect(controller.take(0)).toBe('N');
    tracker.up();
  });

  function setup() {
    const controller = new InputController();
    let now = 0;
    const tracker = new GestureTracker(controller, () => now);
    return { controller, tracker, setNow: (t: number) => (now = t) };
  }

  it('fires after 18 px and not before', () => {
    const { controller, tracker } = setup();
    tracker.down(100, 100);
    tracker.move(110, 90); // ~14 px
    expect(controller.take(0)).toBeNull();
    tracker.move(114, 86); // ~19.8 px
    expect(controller.take(0)).toBe('N');
  });

  it('gives one step for a quick swipe and release', () => {
    const { controller, tracker } = setup();
    tracker.down(0, 0);
    tracker.move(30, 30);
    tracker.up();
    expect(controller.take(0)).toBe('E');
    expect(controller.take(600)).toBeNull();
  });

  it('stops repeating when the finger returns to the dead zone', () => {
    const { controller, tracker } = setup();
    tracker.down(0, 0);
    tracker.move(30, 30);
    expect(controller.take(0)).toBe('E');
    tracker.move(5, 5);
    expect(tracker.direction).toBeNull();
    expect(controller.take(600)).toBeNull();
    tracker.move(-30, 30);
    expect(controller.take(620)).toBe('S');
  });

  it('needs 12 degrees past the boundary to change direction', () => {
    const { controller, tracker } = setup();
    tracker.down(0, 0);
    tracker.move(20, 20);
    expect(controller.take(0)).toBe('E');
    // Within the leash the origin stays where the finger first touched.
    const at = (deg: number) => {
      const r = (deg * Math.PI) / 180;
      tracker.move(28 * Math.cos(r), 28 * Math.sin(r));
    };
    at(-8); // just past the boundary into N: ignored
    expect(tracker.direction).toBe('E');
    at(-14);
    expect(tracker.direction).toBe('N');
    expect(controller.take(200)).toBe('N');
  });

  /** Unit vector at an angle in degrees, counter-clockwise from the right, y pointing down. */
  function towards(deg: number): { x: number; y: number } {
    const r = (deg * Math.PI) / 180;
    return { x: Math.cos(r), y: -Math.sin(r) };
  }

  /** The board as the default camera shows it: north up and to the right, east a little below right. */
  const BOARD: ScreenDirs = { N: towards(46.8), E: towards(-19.6), S: towards(226.8), W: towards(160.4) };

  it('leans half-way to the board: a swipe straight up and one along the board both read as north', () => {
    const dirs = leanDirs(BOARD, 0.5);
    const read = (deg: number) => {
      const { x, y } = towards(deg);
      return nearestDir(x * 30, y * 30, dirs);
    };
    expect([read(90), read(0), read(270), read(180)]).toEqual(['N', 'E', 'S', 'W']);
    expect([read(46.8), read(-19.6), read(226.8), read(160.4)]).toEqual(['N', 'E', 'S', 'W']);
    // Both have room to spare: fifteen degrees to either side changes nothing.
    for (const off of [-15, 15]) {
      expect([read(90 + off), read(46.8 + off)]).toEqual(['N', 'N']);
      expect([read(270 + off), read(226.8 + off)]).toEqual(['S', 'S']);
      expect([read(off), read(-19.6 + off)]).toEqual(['E', 'E']);
      expect([read(180 + off), read(160.4 + off)]).toEqual(['W', 'W']);
    }
  });

  it('keeps plain swipes at no tilt and follows the board at full tilt', () => {
    const plain = leanDirs(BOARD, 0);
    const board = leanDirs(BOARD, 1);
    for (const dir of ['N', 'E', 'S', 'W'] as const) {
      expect(plain[dir].x).toBeCloseTo(CARDINAL_DIRS[dir].x);
      expect(plain[dir].y).toBeCloseTo(CARDINAL_DIRS[dir].y);
      expect(board[dir].x).toBeCloseTo(BOARD[dir].x);
      expect(board[dir].y).toBeCloseTo(BOARD[dir].y);
    }
    // Along the board's north, plain swipes sit on the line between north and east.
    const { x, y } = towards(44);
    expect(nearestDir(x, y, plain)).toBe('E');
  });

  function plainSetup() {
    const controller = new InputController();
    const tracker = new GestureTracker(controller, () => 0, () => CARDINAL_DIRS);
    return { controller, tracker };
  }

  it('turns back after a short move from where the finger is, however long the swipe was', () => {
    const { controller, tracker } = plainSetup();
    tracker.down(0, 0);
    tracker.move(100, 0);
    expect(controller.take(0)).toBe('E');
    tracker.move(62, 0); // 8 px from the trailing origin: inside the dead zone
    expect(tracker.direction).toBeNull();
    tracker.move(48, 0);
    expect(tracker.direction).toBe('W');
    expect(controller.take(20)).toBe('W');
  });

  it('turns a corner within a short move as well', () => {
    const { tracker } = plainSetup();
    tracker.down(0, 0);
    tracker.move(60, 0);
    expect(tracker.direction).toBe('E');
    tracker.move(60, -40); // 53 degrees from the trailing origin: not yet clearly north
    expect(tracker.direction).toBe('E');
    tracker.move(60, -60);
    expect(tracker.direction).toBe('N');
  });

  it('clears everything on cancel', () => {
    const { controller, tracker } = setup();
    tracker.down(0, 0);
    tracker.move(30, 30);
    tracker.cancel();
    expect(controller.take(0)).toBeNull();
    expect(controller.take(600)).toBeNull();
  });
});
