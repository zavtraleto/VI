import { describe, expect, it } from 'vitest';
import { InputController } from './controller';
import { DIAMOND_DIRS, GestureTracker, nearestDir, type ScreenDirs } from './gesture';

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
    tracker.move(30, 30);
    expect(controller.take(0)).toBe('E');
    const at = (deg: number) => {
      const r = (deg * Math.PI) / 180;
      tracker.move(40 * Math.cos(r), 40 * Math.sin(r));
    };
    at(-8); // just past the boundary into N: ignored
    expect(tracker.direction).toBe('E');
    at(-14);
    expect(tracker.direction).toBe('N');
    expect(controller.take(200)).toBe('N');
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
