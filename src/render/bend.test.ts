import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Bend } from './bend';
import { curlAt, type Curl } from './curl';

const DEG = Math.PI / 180;
const ACROSS = new THREE.Vector3(1, 0, 0);
const WALL = 85 * DEG;
/** Flat as far as 2 from the player, a sharp curl, and a wall. */
const EDGE: Curl = { flat: 2, radius: 0.3, wall: WALL };
const NONE: Curl = { flat: 9, radius: 1, wall: 0 };

function bent(relief = 1): Bend {
  const bend = new Bend();
  bend.set(ACROSS, 1, EDGE, EDGE, WALL, relief);
  return bend;
}

describe('Bend.point', () => {
  it('leaves a board that lies flat as it is', () => {
    const bend = new Bend();
    expect(bend.on).toBe(false);
    expect(bend.point(new THREE.Vector3(5, 1, 2)).toArray()).toEqual([5, 1, 2]);
    bend.set(ACROSS, 0, NONE, NONE, WALL, 1);
    expect(bend.on).toBe(false);
    bend.set(ACROSS, 0, EDGE, NONE, WALL, 1);
    expect(bend.on).toBe(true);
    bend.flatten();
    expect(bend.on).toBe(false);
  });

  it('moves nothing on the flat part around the player, at any height', () => {
    const bend = bent(0.3);
    for (const [x, y] of [[1, 0], [2.5, 1], [-0.9, 1.9], [3, 0.5]]) {
      const p = bend.point(new THREE.Vector3(x, y, 4));
      expect(p.x).toBeCloseTo(x);
      expect(p.y).toBeCloseTo(y);
      expect(p.z).toBe(4);
    }
  });

  it('puts a point of the floor where the curl has it, to either side', () => {
    const bend = bent();
    const there = curlAt(EDGE, 3.5);
    const right = bend.point(new THREE.Vector3(1 + 3.5, 0, 0));
    expect(right.x).toBeCloseTo(1 + there.along);
    expect(right.y).toBeCloseTo(there.up);
    const left = bend.point(new THREE.Vector3(1 - 3.5, 0, 0));
    expect(left.x).toBeCloseTo(1 - there.along);
    expect(left.y).toBeCloseTo(there.up);
    // The wall is in sight of the player: nearer than the flat floor would be, and above it.
    expect(there.along).toBeLessThan(3.5);
    expect(there.up).toBeGreaterThan(1);
  });

  it('stands what is on the wall off the wall, towards the player', () => {
    const bend = bent();
    const floor = bend.point(new THREE.Vector3(4.5, 0, 0));
    const top = bend.point(new THREE.Vector3(4.5, 1, 0));
    // A die's height off a wall of 85 degrees: almost level, back towards the player.
    expect(top.x - floor.x).toBeCloseTo(-Math.sin(WALL));
    expect(top.y - floor.y).toBeCloseTo(Math.cos(WALL));
  });

  it('makes what stands on the wall low, and what is very tall no taller than a die and a little', () => {
    const floor = bent(0.3).point(new THREE.Vector3(4.5, 0, 0));
    const top = bent(0.3).point(new THREE.Vector3(4.5, 1, 0));
    expect(floor.distanceTo(top)).toBeCloseTo(0.3);
    const beam = bent(0.3).point(new THREE.Vector3(4.5, 6, 0));
    expect(floor.distanceTo(beam)).toBeCloseTo(1.25 * 0.3);
  });
});
