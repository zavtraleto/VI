import * as THREE from 'three';

/** A light inside a scene: a point with a reach, or with `direction` the light of a whole sky. */
export interface Lamp {
  position: THREE.Vector3;
  color: THREE.Color;
  /** Distance at which nothing of the light is left. */
  reach: number;
  amount: number;
  /** Unit vector towards a light that is everywhere the same, like the sun. */
  direction?: THREE.Vector3;
}

/** A box somewhere in the world: where it is and how it is turned, and its size. */
export interface Block {
  matrix: THREE.Matrix4;
  size: THREE.Vector3;
}

const u = new THREE.Vector3();
const v = new THREE.Vector3();
const normal = new THREE.Vector3();
const origin = new THREE.Vector3();
const point = new THREE.Vector3();
const facing = new THREE.Vector3();

/**
 * The lit surfaces of an interior, put together in world space out of flat sheets and boxes.
 * There are no lights in the material: light is worked out here, at the vertices, and written
 * into their colours, so a lamp can move or fail from frame to frame.
 */
export class Surface {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly uvs: number[] = [];
  private readonly base: number[] = [];
  private readonly index: number[] = [];
  private colors: THREE.BufferAttribute | null = null;

  /**
   * A flat sheet from `from` along `along` and `up`, cut into cells no larger than `cell`:
   * light is only known at the vertices. It faces the way `along × up` points. The texture
   * repeats every `tile` metres.
   */
  sheet(from: THREE.Vector3, along: THREE.Vector3, up: THREE.Vector3, tone: THREE.Color, cell = 1, tile = 2): this {
    const columns = Math.max(1, Math.ceil(along.length() / cell));
    const rows = Math.max(1, Math.ceil(up.length() / cell));
    const first = this.positions.length / 3;
    normal.crossVectors(along, up).normalize();
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= columns; i++) {
        origin.copy(from).addScaledVector(along, i / columns).addScaledVector(up, j / rows);
        this.positions.push(origin.x, origin.y, origin.z);
        this.normals.push(normal.x, normal.y, normal.z);
        this.uvs.push(((i / columns) * along.length()) / tile, ((j / rows) * up.length()) / tile);
        this.base.push(tone.r, tone.g, tone.b);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        const a = first + j * (columns + 1) + i;
        const b = a + columns + 1;
        this.index.push(a, a + 1, b + 1, a, b + 1, b);
      }
    }
    return this;
  }

  /** The six faces of a box, seen from outside. */
  box(block: Block, tone: THREE.Color, cell = 1, tile = 2): this {
    const { x: w, y: h, z: d } = block.size;
    const faces: [number, number, number, number, number, number, number, number, number][] = [
      [w / 2, -h / 2, d / 2, 0, 0, -d, 0, h, 0],
      [-w / 2, -h / 2, -d / 2, 0, 0, d, 0, h, 0],
      [-w / 2, h / 2, d / 2, w, 0, 0, 0, 0, -d],
      [-w / 2, -h / 2, -d / 2, w, 0, 0, 0, 0, d],
      [-w / 2, -h / 2, d / 2, w, 0, 0, 0, h, 0],
      [w / 2, -h / 2, -d / 2, -w, 0, 0, 0, h, 0],
    ];
    const from = new THREE.Vector3();
    for (const [ox, oy, oz, ux, uy, uz, vx, vy, vz] of faces) {
      from.set(ox, oy, oz).applyMatrix4(block.matrix);
      u.set(ux, uy, uz).transformDirection(block.matrix).multiplyScalar(Math.hypot(ux, uy, uz));
      v.set(vx, vy, vz).transformDirection(block.matrix).multiplyScalar(Math.hypot(vx, vy, vz));
      this.sheet(from, u.clone(), v.clone(), tone, cell, tile);
    }
    return this;
  }

  /** Call once, after the last sheet. The geometry is unlit until `light()`. */
  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    this.colors = new THREE.BufferAttribute(new Float32Array(this.base), 3);
    geometry.setAttribute('color', this.colors);
    geometry.setIndex(this.index);
    return geometry;
  }

  /**
   * Works the light out anew: `ambient` everywhere, and each lamp where it reaches. `matrix`
   * is where the surface has been put, if it was built somewhere else than it stands.
   */
  light(lamps: readonly Lamp[], ambient: THREE.Color, matrix?: THREE.Matrix4): void {
    const colors = this.colors;
    if (!colors) return;
    const { positions, normals, base } = this;
    const out = colors.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      point.set(positions[i], positions[i + 1], positions[i + 2]);
      facing.set(normals[i], normals[i + 1], normals[i + 2]);
      if (matrix) {
        point.applyMatrix4(matrix);
        facing.transformDirection(matrix);
      }
      let r = ambient.r;
      let g = ambient.g;
      let b = ambient.b;
      for (const lamp of lamps) {
        const lit = lampLight(lamp, point.x, point.y, point.z, facing.x, facing.y, facing.z);
        r += lamp.color.r * lit;
        g += lamp.color.g * lit;
        b += lamp.color.b * lit;
      }
      out[i] = base[i] * r;
      out[i + 1] = base[i + 1] * g;
      out[i + 2] = base[i + 2] * b;
    }
    colors.needsUpdate = true;
  }
}

/** How much of a lamp arrives at a point of a surface with the normal `n`. */
export function lampLight(lamp: Lamp, x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
  if (lamp.amount <= 0) return 0;
  // The light of a sky falls the same everywhere and does not wrap: a side turned away is unlit.
  if (lamp.direction) return lamp.amount * Math.max(0, nx * lamp.direction.x + ny * lamp.direction.y + nz * lamp.direction.z);
  const dx = lamp.position.x - x;
  const dy = lamp.position.y - y;
  const dz = lamp.position.z - z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance >= lamp.reach || lamp.amount <= 0) return 0;
  const fall = (1 - distance / lamp.reach) ** 2;
  // Light wraps a little round the edge of a surface: an interior has it bounced from all sides.
  const facing = distance > 0 ? (nx * dx + ny * dy + nz * dz) / distance : 1;
  return lamp.amount * fall * Math.max(0, (facing + 0.3) / 1.3);
}

/** The corners of a block, in world space. */
export function corners(block: Block): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const sx of [-0.5, 0.5]) {
    for (const sy of [-0.5, 0.5]) {
      for (const sz of [-0.5, 0.5]) {
        out.push(new THREE.Vector3(sx * block.size.x, sy * block.size.y, sz * block.size.z).applyMatrix4(block.matrix));
      }
    }
  }
  return out;
}

/** The outline of a set of points on a plane, counter-clockwise, as `[x, z]` pairs. */
export function hull(points: readonly (readonly [number, number])[]): [number, number][] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted.map(([x, z]) => [x, z]);
  const cross = (o: readonly number[], a: readonly number[], b: readonly number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: readonly (readonly [number, number])[]): [number, number][] => {
    const out: [number, number][] = [];
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop();
      out.push([point[0], point[1]]);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}
