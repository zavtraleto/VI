import * as THREE from 'three';
import { roll, type Dir, type Orientation } from '../rules';

/** Axis a cube turns around when rolling in a direction: up x direction. */
export const ROLL_AXIS: Record<Dir, THREE.Vector3> = {
  N: new THREE.Vector3(-1, 0, 0),
  S: new THREE.Vector3(1, 0, 0),
  E: new THREE.Vector3(0, 0, -1),
  W: new THREE.Vector3(0, 0, 1),
};

const CANONICAL: Orientation = { top: 1, bottom: 6, north: 2, south: 5, east: 3, west: 4 };

/** Face values of the unrotated mesh in BoxGeometry order: +x, -x, +y, -y, +z, -z. */
export const CANONICAL_FACE_VALUES = [
  CANONICAL.east,
  CANONICAL.west,
  CANONICAL.top,
  CANONICAL.bottom,
  CANONICAL.south,
  CANONICAL.north,
];

function key(o: Orientation): string {
  return `${o.top}${o.north}${o.east}`;
}

function build(): Map<string, THREE.Quaternion> {
  const map = new Map<string, THREE.Quaternion>();
  map.set(key(CANONICAL), new THREE.Quaternion());
  const queue: Orientation[] = [CANONICAL];
  while (queue.length > 0) {
    const o = queue.shift()!;
    const q = map.get(key(o))!;
    for (const dir of ['N', 'S', 'E', 'W'] as const) {
      const next = roll(o, dir);
      if (map.has(key(next))) continue;
      const turn = new THREE.Quaternion().setFromAxisAngle(ROLL_AXIS[dir], Math.PI / 2);
      map.set(key(next), turn.multiply(q));
      queue.push(next);
    }
  }
  return map;
}

const QUATS = build();

/** The rotation that shows `o` on the canonical mesh. The picture follows the discrete state. */
export function quatFor(o: Orientation): THREE.Quaternion {
  return QUATS.get(key(o))!;
}
