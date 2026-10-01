import * as THREE from 'three';
import { DELTA, DIRS, previewMove, type Dir, type RunState } from '../rules';
import { ghostFaceTexture } from './textures';
import type { Theme } from './theme';

export interface OverlayOptions {
  boardPreview: boolean;
  matchHint: boolean;
  /** Cell to point the player at during the tutorial. */
  marker: { x: number; z: number } | null;
}

function floorPlane(material: THREE.Material, size: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return mesh;
}

/** Things drawn on the floor: ghost previews, clear hints and the tutorial marker. */
export class FloorOverlays {
  readonly group = new THREE.Group();
  private readonly ghostMaterials: THREE.Material[];
  private readonly ghosts = new Map<Dir, THREE.Mesh>();
  private readonly hints = new Map<Dir, THREE.Mesh>();
  private readonly marker: THREE.Mesh;

  constructor(theme: Theme) {
    this.ghostMaterials = [1, 2, 3, 4, 5, 6].map(
      (value) =>
        new THREE.MeshBasicMaterial({
          map: ghostFaceTexture(value, theme.ink),
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        }),
    );
    const hintMaterial = new THREE.MeshBasicMaterial({ color: theme.carmine, transparent: true, opacity: 0.38, depthWrite: false });
    for (const dir of DIRS) {
      const ghost = floorPlane(this.ghostMaterials[0], 0.8);
      ghost.position.y = 0.02;
      this.ghosts.set(dir, ghost);
      const hint = floorPlane(hintMaterial, 0.94);
      hint.position.y = 0.012;
      this.hints.set(dir, hint);
      this.group.add(hint, ghost);
    }
    this.marker = floorPlane(
      new THREE.MeshBasicMaterial({ color: theme.carmine, transparent: true, opacity: 0.5, depthWrite: false }),
      0.9,
    );
    this.marker.position.y = 0.015;
    this.group.add(this.marker);
  }

  sync(state: RunState, timeMs: number, options: OverlayOptions, reducedMotion: boolean): void {
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

    this.marker.visible = options.marker !== null;
    if (options.marker) {
      this.marker.position.x = options.marker.x;
      this.marker.position.z = options.marker.z;
      (this.marker.material as THREE.MeshBasicMaterial).opacity = reducedMotion ? 0.45 : 0.3 + 0.25 * Math.sin(timeMs / 220);
    }
  }
}
