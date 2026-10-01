import * as THREE from 'three';
import { cubeHeight, type Cube, type CubeState, type RunState } from '../rules';
import { CANONICAL_FACE_VALUES, ROLL_AXIS, quatFor } from './orientationQuat';
import { makeFaceTexture } from './pips';
import type { Theme } from './theme';

type Look = 'idle' | 'rising' | 'sinking';

const LOOK: Record<CubeState, Look> = { idle: 'idle', moving: 'idle', rising: 'rising', sinking: 'sinking' };

const CUBE_SIZE = 0.94;

export class CubeMeshes {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  private readonly materials: Record<Look, THREE.Material[]>;
  private readonly meshes = new Map<number, THREE.Mesh>();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpVec = new THREE.Vector3();

  constructor(theme: Theme) {
    const set = (look: Look): THREE.Material[] =>
      CANONICAL_FACE_VALUES.map(
        (value) => new THREE.MeshLambertMaterial({ map: makeFaceTexture(value, theme[look], { border: theme[look].pip + '55' }) }),
      );
    this.materials = { idle: set('idle'), rising: set('rising'), sinking: set('sinking') };
  }

  sync(state: RunState, alpha: number): void {
    const alive = new Set<number>();
    for (const cube of state.cubes) {
      alive.add(cube.id);
      let mesh = this.meshes.get(cube.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.geometry, this.materials.idle);
        this.meshes.set(cube.id, mesh);
        this.group.add(mesh);
      }
      mesh.material = this.materials[LOOK[cube.state]];
      this.pose(mesh, cube, state, alpha);
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
    mesh.position.set(cube.x, cubeHeight(cube, state.config, alpha) - 0.5, cube.z);
    mesh.quaternion.copy(quatFor(cube.ori));
  }
}
