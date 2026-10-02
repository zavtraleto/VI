import * as THREE from 'three';
import { seededRandom, type ParamSpec } from './scene';

export const DEG = Math.PI / 180;

export const num = (value: number, min: number, max: number, step: number): ParamSpec => ({ kind: 'number', value, min, max, step });
export const color = (value: string): ParamSpec => ({ kind: 'color', value });
export const bool = (value: boolean): ParamSpec => ({ kind: 'boolean', value });

/** A stream of chance for each part of a scene, so that tuning one part leaves the others alone. */
export function streams(seed: number): (part: number) => () => number {
  return (part) => seededRandom(Math.imul(seed | 0, 31) + part);
}

/** Everything a scene has to free when it is thrown away. */
export interface Keeper {
  keep<T extends { dispose(): void }>(item: T): T;
  dispose(): void;
}

export function keeper(): Keeper {
  const items: { dispose(): void }[] = [];
  return {
    keep(item) {
      items.push(item);
      return item;
    },
    dispose() {
      for (const item of items) item.dispose();
    },
  };
}

/** How far a held camera is from where it was put: metres aside and up, radians of turn. */
export interface Sway {
  x: number;
  y: number;
  pitch: number;
  yaw: number;
  roll: number;
}

/**
 * A camera that floats as if held by hand: a slow wander with a quicker, smaller one on top.
 * `drift` 1 is half a metre aside and a degree or so of turn.
 */
export function handheld(random: () => number, drift: number, speed: number): (seconds: number) => Sway {
  const phases = Array.from({ length: 10 }, () => random() * Math.PI * 2);
  const out: Sway = { x: 0, y: 0, pitch: 0, yaw: 0, roll: 0 };
  return (seconds) => {
    const t = seconds * speed;
    const sway = (rate: number, axis: number) =>
      drift * (0.7 * Math.sin(t * rate + phases[axis * 2]) + 0.3 * Math.sin(t * rate * 2.7 + phases[axis * 2 + 1]));
    out.x = sway(0.37, 0) * 0.5;
    out.y = sway(0.53, 1) * 0.2;
    out.pitch = sway(0.31, 2) * 0.8 * DEG;
    out.yaw = sway(0.23, 3) * 1.5 * DEG;
    out.roll = sway(0.29, 4) * 0.6 * DEG;
    return out;
  };
}

/** A number in 0..1 that depends only on the tick and the salt: chance that can be replayed. */
export function tickNoise(tick: number, salt: number): number {
  const value = Math.sin(tick * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * How bright a failing lamp is at a moment: it drops out for a twelfth of a second now and
 * then, more often and deeper as `flicker` goes to 1.
 */
export function flickering(seconds: number, flicker: number, salt: number): number {
  if (flicker <= 0) return 1;
  const out = tickNoise(Math.floor(seconds * 12), salt) < 0.15 + 0.3 * flicker;
  return out ? 1 - flicker : 1;
}

/**
 * A square of grey blotches that repeats without a seam, to multiply a surface by: 1 where it
 * is clean, down to `1 - contrast` where it is stained.
 */
export function grainTexture(random: () => number, contrast: number, size = 64): THREE.DataTexture {
  const coarse = 8;
  const blotches = Array.from({ length: coarse * coarse }, () => random());
  const blotch = (x: number, y: number): number => blotches[(y % coarse) * coarse + (x % coarse)];
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * coarse;
      const fy = (y / size) * coarse;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const soft =
        (blotch(ix, iy) * (1 - tx) + blotch(ix + 1, iy) * tx) * (1 - ty) +
        (blotch(ix, iy + 1) * (1 - tx) + blotch(ix + 1, iy + 1) * tx) * ty;
      const value = 1 - contrast * (0.65 * soft + 0.35 * random());
      const at = (y * size + x) * 4;
      data[at] = data[at + 1] = data[at + 2] = Math.round(255 * Math.min(1, Math.max(0, value)));
      data[at + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** Where a camera is put and how it is turned: metres and degrees. */
export interface CameraSet {
  x: number;
  height: number;
  /** How far it stands back from what it looks at, along z. */
  distance: number;
  pitch: number;
  yaw: number;
  roll: number;
}

/**
 * The camera of a place: put somewhere, held by hand, looking down -z. It can be brought
 * nearer or farther for a thing of another size, or turned into a portrait of one thing.
 */
export class CameraRig {
  /** Where what it looks at stands. */
  readonly target = new THREE.Vector3();
  private set: CameraSet;
  /** Metres walked towards the target on top of everything else. */
  walked = 0;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    set: CameraSet,
    private readonly hand: (seconds: number) => Sway,
  ) {
    this.set = { ...set };
    camera.rotation.order = 'YXZ';
  }

  /** Brings the camera nearer or farther, and lower or higher, by `scale`: the same framing of another size. */
  scale(scale: number): void {
    this.set.distance *= scale;
    this.set.height *= scale;
    this.set.x *= scale;
  }

  /** A plain look at a thing `height` tall standing at `at`: it fills most of the frame. */
  portrait(at: THREE.Vector3, height: number): void {
    const tall = Math.max(0.3, height);
    const half = Math.tan((this.camera.fov * DEG) / 2);
    this.target.copy(at);
    this.set = { x: 0, height: tall * 0.52, distance: tall / (2 * half * 0.62), pitch: 0, yaw: 0, roll: this.set.roll };
  }

  get distance(): number {
    return this.set.distance;
  }

  /** Where on the ground the camera stands. */
  stand(): THREE.Vector3 {
    return new THREE.Vector3(this.target.x + this.set.x, 0, this.target.z + this.set.distance);
  }

  update(seconds: number, aspect: number): void {
    const { camera, set, target } = this;
    if (camera.aspect !== aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    const sway = this.hand(seconds);
    // A tall window is too narrow for a camera that stands or looks aside: bring it back in.
    const narrow = Math.min(1, aspect);
    camera.position.set(target.x + set.x * narrow + sway.x, target.y + set.height + sway.y, target.z + set.distance - this.walked);
    camera.rotation.set(set.pitch * DEG + sway.pitch, set.yaw * DEG * narrow + sway.yaw, set.roll * DEG + sway.roll);
  }
}

/** A colour made darker, towards black; `amount` 1 is black. */
export function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0;
  const keep = 1 - Math.min(1, Math.max(0, amount));
  const part = (shift: number): string => Math.round(((value >> shift) & 255) * keep).toString(16).padStart(2, '0');
  return `#${part(16)}${part(8)}${part(0)}`;
}
