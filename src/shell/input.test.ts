import { describe, expect, it } from 'vitest';
import { nextFocus, zoneAt } from './input';

/** Three rows, the middle one split in two: enough to walk in every direction. */
const zones = [
  { id: 'top', rect: { x: 0, y: 0, width: 200, height: 50 } },
  { id: 'left', rect: { x: 0, y: 50, width: 100, height: 50 } },
  { id: 'right', rect: { x: 100, y: 50, width: 100, height: 50 } },
  { id: 'bottom', rect: { x: 0, y: 100, width: 200, height: 50 } },
  { id: 'aside', rect: { x: 300, y: 5, width: 60, height: 40 } },
];

describe('nextFocus', () => {
  it('starts at the first zone when nothing is in focus', () => {
    expect(nextFocus(zones, null, 'down')).toBe('top');
    expect(nextFocus(zones, 'gone', 'up')).toBe('top');
    expect(nextFocus([], null, 'down')).toBeNull();
  });

  it('goes to the nearest zone in line that way', () => {
    expect(nextFocus(zones, 'top', 'down')).toBe('left');
    expect(nextFocus(zones, 'left', 'right')).toBe('right');
    expect(nextFocus(zones, 'right', 'left')).toBe('left');
    expect(nextFocus(zones, 'left', 'down')).toBe('bottom');
    expect(nextFocus(zones, 'bottom', 'up')).toBe('left');
    expect(nextFocus(zones, 'top', 'right')).toBe('aside');
  });

  it('stays where it is at the edge', () => {
    expect(nextFocus(zones, 'top', 'up')).toBe('top');
    expect(nextFocus(zones, 'bottom', 'down')).toBe('bottom');
    expect(nextFocus(zones, 'left', 'left')).toBe('left');
    expect(nextFocus(zones, 'aside', 'right')).toBe('aside');
  });

  it('takes the nearest zone that way where none is in line', () => {
    expect(nextFocus(zones, 'aside', 'down')).toBe('right');
    expect(nextFocus(zones, 'bottom', 'right')).toBe('right');
  });
});

describe('zoneAt', () => {
  it('finds the zone under a point', () => {
    expect(zoneAt(zones, 10, 10)?.id).toBe('top');
    expect(zoneAt(zones, 10, 50)?.id).toBe('left');
    expect(zoneAt(zones, 250, 10)).toBeNull();
  });

  it('takes the zone whose middle is nearest where two overlap', () => {
    const pair = [
      { id: 'a', rect: { x: 0, y: 0, width: 60, height: 60 } },
      { id: 'b', rect: { x: 40, y: 40, width: 60, height: 60 } },
    ];
    expect(zoneAt(pair, 45, 45)?.id).toBe('a');
    expect(zoneAt(pair, 55, 55)?.id).toBe('b');
  });
});
