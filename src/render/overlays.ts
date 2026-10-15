import * as THREE from 'three';
import { DELTA, DIRS, previewMove, type Dir, type RunState } from '../rules';
import type { ParamValues } from '../signal/scene';
import type { Palette } from '../shell/theme';
import { ghostFaceTexture } from './textures';

export interface OverlayOptions {
  boardPreview: boolean;
  matchHint: boolean;
}

function floorPlane(material: THREE.Material, size: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return mesh;
}

/**
 * Things drawn on the board for the player's benefit: ghost previews and clear hints. All of
 * them are the tone of the program.
 */
export class FloorOverlays {
  readonly group = new THREE.Group();
  private readonly ghostMaterials: THREE.MeshBasicMaterial[];
  private readonly hintMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.38, depthWrite: false });
  private readonly ghosts = new Map<Dir, THREE.Mesh>();
  private readonly hints = new Map<Dir, THREE.Mesh>();

  constructor(values: ParamValues) {
    this.ghostMaterials = [1, 2, 3, 4, 5, 6].map(
      (value) =>
        new THREE.MeshBasicMaterial({
          map: ghostFaceTexture(value, values),
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        }),
    );
    for (const dir of DIRS) {
      const ghost = floorPlane(this.ghostMaterials[0], 0.8);
      ghost.position.y = 0.02;
      this.ghosts.set(dir, ghost);
      const hint = floorPlane(this.hintMaterial, 0.94);
      hint.position.y = 0.012;
      this.hints.set(dir, hint);
      this.group.add(hint, ghost);
    }
  }

  setPalette(palette: Palette): void {
    for (const material of this.ghostMaterials) material.color.set(palette.ink);
    this.hintMaterial.color.set(palette.ink);
  }

  dispose(): void {
    const materials = [...this.ghostMaterials, this.hintMaterial];
    for (const material of materials) {
      material.map?.dispose();
      material.dispose();
    }
    for (const mesh of [...this.ghosts.values(), ...this.hints.values()]) mesh.geometry.dispose();
  }

  sync(state: RunState, options: OverlayOptions): void {
    const idle = !state.player.action && !state.over;
    for (const dir of DIRS) {
      const ghost = this.ghosts.get(dir)!;
      const hint = this.hints.get(dir)!;
      ghost.visible = false;
      hint.visible = false;
      if (!idle || (!options.boardPreview && !options.matchHint)) continue;
      const preview = previewMove(state, dir);
      if (preview.top === undefined) continue;
      // A pushed cube lands one cell beyond the one the player steps into.
      const reach = preview.kind === 'push' ? 2 : 1;
      const x = state.player.x + DELTA[dir].dx * reach;
      const z = state.player.z + DELTA[dir].dz * reach;
      if (options.boardPreview) {
        ghost.material = this.ghostMaterials[preview.top - 1];
        ghost.position.x = x;
        ghost.position.z = z;
        ghost.visible = true;
      }
      if (options.matchHint && preview.clears) {
        hint.position.x = x;
        hint.position.z = z;
        hint.visible = true;
      }
    }
  }
}
