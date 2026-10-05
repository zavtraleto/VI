import { describe, expect, it } from 'vitest';
import { InputController } from './controller';
import { CARDINAL_DIRS, DEAD_ZONE_PX, GestureTracker, RELEASE_DEAD_ZONE_PX, RELEASE_LEASH_PX, RELEASE_TRIGGER_PX, TRIGGER_PX } from './gesture';
import type { Dir } from '../rules';

/** Every step the controller gives over two seconds of game time. */
function steps(controller: InputController, from = 0): Dir[] {
  const taken: Dir[] = [];
  for (let t = from; t <= from + 2000; t += 20) {
    const dir = controller.take(t);
    if (dir) taken.push(dir);
  }
  return taken;
}

/** A tracker that steps when the finger is lifted, as on a level. */
function onRelease(): { controller: InputController; tracker: GestureTracker } {
  const controller = new InputController();
  controller.setRepeat(false);
  return { controller, tracker: new GestureTracker(controller, () => 0, () => CARDINAL_DIRS, () => true) };
}

describe('a held direction where every step counts', () => {
  it('is one step, however long it is held', () => {
    const controller = new InputController();
    controller.setRepeat(false);
    controller.press('E', 0);
    expect(steps(controller)).toEqual(['E']);
  });

  it('is one step for every press', () => {
    const controller = new InputController();
    controller.setRepeat(false);
    controller.press('E', 0);
    expect(controller.take(0)).toBe('E');
    controller.press('N', 500);
    expect(steps(controller, 500)).toEqual(['N']);
  });

  it('goes on stepping again once the repeat is back', () => {
    const controller = new InputController();
    controller.setRepeat(false);
    controller.setRepeat(true);
    controller.press('E', 0);
    expect(steps(controller).length).toBeGreaterThan(3);
  });
});

describe('a swipe that steps when the finger is lifted', () => {
  it('only reads the direction while the finger is down', () => {
    const { controller, tracker } = onRelease();
    tracker.down(100, 100);
    tracker.move(100 + RELEASE_TRIGGER_PX + 2, 100);
    expect(tracker.direction).toBe('E');
    expect(steps(controller)).toEqual([]);
  });

  it('gives one step when the finger is lifted, and no more', () => {
    const { controller, tracker } = onRelease();
    tracker.down(100, 100);
    tracker.move(100 + RELEASE_TRIGGER_PX + 2, 100);
    tracker.up();
    expect(tracker.direction).toBeNull();
    expect(steps(controller)).toEqual(['E']);
  });

  it('gives one step however long the finger stays down', () => {
    const { controller, tracker } = onRelease();
    tracker.down(100, 100);
    tracker.move(140, 100);
    expect(steps(controller)).toEqual([]);
    tracker.move(180, 100);
    tracker.up();
    expect(steps(controller, 3000)).toEqual(['E']);
  });

  it('steps nowhere when the finger comes back to where it started', () => {
    const { controller, tracker } = onRelease();
    tracker.down(100, 100);
    tracker.move(100 + RELEASE_TRIGGER_PX + 2, 100);
    tracker.move(100 + RELEASE_DEAD_ZONE_PX - 2, 100);
    expect(tracker.direction).toBeNull();
    tracker.up();
    expect(steps(controller)).toEqual([]);
  });

  it('steps the way the finger has turned to, with no step for the way it set out', () => {
    const { controller, tracker } = onRelease();
    tracker.down(100, 100);
    tracker.move(100 + RELEASE_TRIGGER_PX + 2, 100);
    expect(tracker.direction).toBe('E');
    tracker.move(100, 60);
    expect(tracker.direction).toBe('N');
    tracker.up();
    expect(steps(controller)).toEqual(['N']);
  });

  it('is read further out than a swipe that steps at once, and called off nearer', () => {
    expect(RELEASE_TRIGGER_PX).toBeGreaterThan(TRIGGER_PX);
    expect(RELEASE_DEAD_ZONE_PX).toBeGreaterThan(2 * DEAD_ZONE_PX);
    // What reads a swipe is further out than what calls it off: a finger at rest does neither.
    expect(RELEASE_TRIGGER_PX).toBeGreaterThan(RELEASE_DEAD_ZONE_PX);
    const { controller, tracker } = onRelease();
    tracker.down(100, 100);
    // A swipe that would step anywhere else is not read here yet.
    tracker.move(100 + TRIGGER_PX + 2, 100);
    expect(tracker.direction).toBeNull();
    tracker.up();
    expect(steps(controller)).toEqual([]);
  });

  it('is called off by a finger brought back a little, however far the swipe went', () => {
    const { controller, tracker } = onRelease();
    tracker.down(100, 100);
    tracker.move(300, 100);
    expect(tracker.direction).toBe('E');
    // The point the swipe is measured from has followed the finger: back by the leash less the dead zone is enough.
    tracker.move(300 - (RELEASE_LEASH_PX - RELEASE_DEAD_ZONE_PX) - 2, 100);
    expect(tracker.direction).toBeNull();
    tracker.up();
    expect(steps(controller)).toEqual([]);
  });

  it('steps nowhere for a touch that never became a swipe', () => {
    const { controller, tracker } = onRelease();
    tracker.down(100, 100);
    tracker.move(104, 103);
    tracker.up();
    expect(steps(controller)).toEqual([]);
  });

  it('steps nowhere when the swipe is called off', () => {
    const { controller, tracker } = onRelease();
    tracker.down(100, 100);
    tracker.move(100 + RELEASE_TRIGGER_PX + 2, 100);
    tracker.cancel();
    expect(steps(controller)).toEqual([]);
  });
});

describe('a swipe anywhere else', () => {
  it('steps as soon as it is read and goes on stepping, as before', () => {
    const controller = new InputController();
    const tracker = new GestureTracker(controller, () => 0, () => CARDINAL_DIRS);
    tracker.down(100, 100);
    tracker.move(100 + TRIGGER_PX + 2, 100);
    expect(steps(controller).length).toBeGreaterThan(3);
    tracker.up();
    expect(steps(controller, 3000)).toEqual([]);
  });

  it('can be told to step on release for a while, and back', () => {
    let held = true;
    const controller = new InputController();
    const tracker = new GestureTracker(controller, () => 0, () => CARDINAL_DIRS, () => held);
    tracker.down(100, 100);
    tracker.move(100 + RELEASE_TRIGGER_PX + 2, 100);
    expect(controller.take(0)).toBeNull();
    tracker.up();
    expect(controller.take(0)).toBe('E');
    held = false;
    tracker.down(100, 100);
    tracker.move(100, 100 + TRIGGER_PX + 2);
    expect(controller.take(100)).toBe('S');
  });
});
