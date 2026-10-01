import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { cubeHeight, isHeld, type Cube, type RunState } from '../rules';
import { CANONICAL_FACE_VALUES, ROLL_AXIS, quatFor } from './orientationQuat';
import { cubeFaceTexture, pipMaskTexture } from './textures';
import type { Theme } from './theme';

/**
 * How a cube is drawn. The "low" looks are see-through: a rising cube that can still be
 * stepped onto from the ground, or a sinking cube that can be rolled over.
 */
type Look = 'idle' | 'rising' | 'risingLow' | 'sinking' | 'sinkingLow';

const CUBE_SIZE = 0.94;
const LOW_OPACITY = 0.5;

export interface CubeGlow {
  /** Glow of resting pips: stage flashes and breathing. */
  idle: number;
  /** Glow of sinking pips. */
  sinking: number;
}

export class CubeMeshes {
  readonly group = new THREE.Group();
  private readonly geometry = new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 3, 0.07);
  private readonly materials: Record<Look, THREE.MeshLambertMaterial[]>;
  private readonly meshes = new Map<number, THREE.Mesh>();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpVec = new THREE.Vector3();

  constructor(theme: Theme) {
    const faces = CANONICAL_FACE_VALUES.map((value) => ({ map: cubeFaceTexture(value, theme), mask: pipMaskTexture(value) }));
    const set = (color: number, opacity = 1): THREE.MeshLambertMaterial[] =>
      faces.map(
        ({ map, mask }) =>
          new THREE.MeshLambertMaterial({
            map,
            color,
            emissive: theme.carmine,
            emissiveMap: mask,
            emissiveIntensity: 0,
            transparent: opacity < 1,
            opacity,
          }),
      );
    this.materials = {
      idle: set(0xffffff),
      rising: set(0x9a958f),
      risingLow: set(0xb8b3ac, LOW_OPACITY),
      sinking: set(0xb08a8a),
      sinkingLow: set(0xb08a8a, LOW_OPACITY),
    };
  }

  /** The sinking cubes of running reactions, for the reaction light. */
  sinkingCentre(state: RunState): { x: number; z: number; count: number } {
    let x = 0;
    let z = 0;
    let count = 0;
    for (const cube of state.cubes) {
      if (cube.state !== 'sinking') continue;
      x += cube.x;
      z += cube.z;
      count++;
    }
    return count > 0 ? { x: x / count, z: z / count, count } : { x: 0, z: 0, count: 0 };
  }

  private look(cube: Cube, state: RunState): Look {
    if (cube.state === 'idle' || cube.state === 'moving') return 'idle';
    const height = cubeHeight(cube, state.config);
    if (cube.state === 'rising') return height <= state.config.mountHeight ? 'risingLow' : 'rising';
    return height <= state.config.lowHeight ? 'sinkingLow' : 'sinking';
  }

  sync(state: RunState, alpha: number, glow: CubeGlow, dip: (cubeId: number) => number): void {
    for (const m of this.materials.idle) m.emissiveIntensity = glow.idle;
    for (const look of ['rising', 'risingLow'] as const) {
      for (const m of this.materials[look]) m.emissiveIntensity = glow.idle * 0.5;
    }
    for (const look of ['sinking', 'sinkingLow'] as const) {
      for (const m of this.materials[look]) m.emissiveIntensity = glow.sinking;
    }

    const alive = new Set<number>();
    for (const cube of state.cubes) {
      alive.add(cube.id);
      let mesh = this.meshes.get(cube.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.geometry, this.materials.idle);
        this.meshes.set(cube.id, mesh);
        this.group.add(mesh);
      }
      mesh.material = this.materials[this.look(cube, state)];
      this.pose(mesh, cube, state, alpha);
      mesh.position.y += dip(cube.id);
    }
    for (const [id, mesh] of this.meshes) {
      if (alive.has(id)) continue;
      this.group.remove(mesh);
      this.meshes.delete(id);
    }
  }

  private pose(mesh: THREE.Mesh, cube: Cube, state: RunState, alpha: number): void {
    const move = cube.move;
    if (cube.state === 'moving' && move) {
      const p = Math.min(1, (cube.t + alpha) / state.config.actionTicks);
      if (move.kind === 'roll') {
        // Turn around the bottom edge shared by the two cells.
        const pivotX = (move.fromX + cube.x) / 2;
        const pivotZ = (move.fromZ + cube.z) / 2;
        this.tmpQuat.setFromAxisAngle(ROLL_AXIS[move.dir], (p * Math.PI) / 2);
        this.tmpVec.set(move.fromX - pivotX, 0.5, move.fromZ - pivotZ).applyQuaternion(this.tmpQuat);
        mesh.position.set(pivotX + this.tmpVec.x, this.tmpVec.y, pivotZ + this.tmpVec.z);
        mesh.quaternion.copy(this.tmpQuat).multiply(quatFor(move.prevOri));
      } else {
        mesh.position.set(move.fromX + (cube.x - move.fromX) * p, 0.5, move.fromZ + (cube.z - move.fromZ) * p);
        mesh.quaternion.copy(quatFor(cube.ori));
      }
      return;
    }
    // A die held by the tutorial stays put between ticks.
    mesh.position.set(cube.x, cubeHeight(cube, state.config, isHeld(state, cube) ? 0 : alpha) - 0.5, cube.z);
    mesh.quaternion.copy(quatFor(cube.ori));
  }
}
