import * as THREE from 'three';
import { inChain, type RunState } from '../rules';
import type { ParamValues } from '../signal/scene';
import type { Palette } from '../shell/theme';
import { CUBE_SIZE } from './cubes';
import { topTurn } from './orientationQuat';
import { chainMarkTexture } from './textures';

/** Most marks of one value there can be: a die on every cell of the largest board. */
const MAX_MARKS = 9 * 9;
/** Most marks that can be going out at once, and how long one takes to. */
const MAX_FADING = 16;
const MARK_OUT_MS = 280;

/** A mark as it lay on the last frame: where, of what value, turned how. */
interface Lain {
  x: number;
  z: number;
  value: number;
  turn: number;
}

/**
 * Shows where a chain can still be added to. The cell of every die sinking in a chain carries
 * that die's top face, lit in the colour of its channel, until the die is gone: a die that has
 * all but sunk out of sight still counts, and the mark is what says so.
 *
 * All the marks of one value are one draw: a chain with twenty dice in it would otherwise be
 * twenty, each a round of talk with the graphics card. A mark whose die is gone is not switched
 * off: it goes out over a moment, as a draw of its own for as long as that takes.
 */
export class ChainMarks {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly materials: THREE.MeshBasicMaterial[];
  /** The marks of each value, index 0 = the 1. */
  private readonly marks: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
  private readonly counts = [0, 0, 0, 0, 0, 0];
  private readonly matrix = new THREE.Matrix4();
  private readonly at = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly lying = new THREE.Euler();
  private readonly whole = new THREE.Vector3(1, 1, 1);
  /** The marks that lay on the last frame, by cube, and those of this one. */
  private lain = new Map<number, Lain>();
  private lying2 = new Map<number, Lain>();
  /** The marks going out: each a plane of its own, with how much of it is left. */
  private readonly fading: { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; left: number }[] = [];
  private lastTime = 0;

  constructor(values: ParamValues) {
    this.materials = [1, 2, 3, 4, 5, 6].map(
      (value) =>
        new THREE.MeshBasicMaterial({
          map: chainMarkTexture(value, CUBE_SIZE, values),
          transparent: true,
          depthWrite: false,
        }),
    );
    this.marks = this.materials.map((material) => {
      const mesh = new THREE.InstancedMesh(this.geometry, material, MAX_MARKS);
      mesh.count = 0;
      mesh.frustumCulled = false;
      // Before the see-through dice, so a mark shows through the die that stands on it.
      mesh.renderOrder = -1;
      this.group.add(mesh);
      return mesh;
    });
    for (let i = 0; i < MAX_FADING; i++) {
      const mesh = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ map: this.materials[0].map, transparent: true, depthWrite: false, opacity: 0 }));
      mesh.visible = false;
      mesh.renderOrder = -1;
      this.fading.push({ mesh, left: 0 });
      this.group.add(mesh);
    }
  }

  /** A new board: no mark of the one before is left going out on it. */
  reset(): void {
    this.lain.clear();
    for (const fade of this.fading) {
      fade.left = 0;
      fade.mesh.visible = false;
    }
  }

  setPalette(palette: Palette): void {
    // The one is not a channel: where it goes down, the mark is the red of its pip.
    this.materials.forEach((material, i) => material.color.set(i === 0 ? palette.signal : palette.channels[i]));
  }

  sync(state: RunState, timeMs: number, reducedMotion: boolean): void {
    const opacity = reducedMotion ? 1 : 0.82 + 0.18 * Math.sin((timeMs / 700) * Math.PI * 2);
    for (const material of this.materials) material.opacity = opacity;
    const dt = this.lastTime === 0 ? 0 : Math.min(100, Math.max(0, timeMs - this.lastTime));
    this.lastTime = timeMs;

    const { counts } = this;
    const now = this.lying2;
    now.clear();
    counts.fill(0);
    // Nothing joins a finished group in a puzzle.
    if (!state.puzzle) {
      for (const cube of state.cubes) {
        if (!inChain(cube)) continue;
        const value = cube.ori.top - 1;
        if (counts[value] >= MAX_MARKS) continue;
        const turn = topTurn(cube.ori);
        this.at.set(cube.x, 0.014, cube.z);
        this.turn.setFromEuler(this.lying.set(-Math.PI / 2, 0, turn));
        this.marks[value].setMatrixAt(counts[value]++, this.matrix.compose(this.at, this.turn, this.whole));
        now.set(cube.id, { x: cube.x, z: cube.z, value, turn });
      }
    }
    // A mark that lay a frame ago and does not now goes out where it lay.
    if (!reducedMotion) {
      for (const [id, mark] of this.lain) {
        if (now.has(id)) continue;
        const fade = this.fading.find((one) => one.left <= 0);
        if (!fade) break;
        fade.left = 1;
        fade.mesh.material.map = this.materials[mark.value].map;
        fade.mesh.material.color.copy(this.materials[mark.value].color);
        fade.mesh.position.set(mark.x, 0.014, mark.z);
        fade.mesh.rotation.set(-Math.PI / 2, 0, mark.turn);
      }
    }
    this.lying2 = this.lain;
    this.lain = now;
    for (const fade of this.fading) {
      if (fade.left <= 0) continue;
      fade.left -= dt / MARK_OUT_MS;
      fade.mesh.visible = fade.left > 0;
      fade.mesh.material.opacity = opacity * Math.max(0, fade.left);
    }
    this.marks.forEach((mesh, value) => {
      mesh.count = counts[value];
      mesh.visible = counts[value] > 0;
      if (counts[value] > 0) mesh.instanceMatrix.needsUpdate = true;
    });
  }

  dispose(): void {
    this.geometry.dispose();
    for (const mesh of this.marks) mesh.dispose();
    for (const fade of this.fading) fade.mesh.material.dispose();
    for (const material of this.materials) {
      material.map?.dispose();
      material.dispose();
    }
  }
}
