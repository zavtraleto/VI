import * as THREE from 'three';
import { DELTA, DIRS, previewMove, type Dir, type RunState } from '../rules';
import { cubeFaceTexture, ghostFaceTexture } from './textures';
import type { Theme } from './theme';

export interface OverlayOptions {
  boardPreview: boolean;
  matchHint: boolean;
  /** Where the tutorial points the player. */
  marker: TutorialMarker | null;
}

export interface TutorialMarker {
  x: number;
  z: number;
  /** The target is a die to step onto: the mark lies on its top face. */
  raised: boolean;
  /** Value a die rolled here will show: a phantom die with that face stands on the cell. */
  top?: number;
}

/** Edge of a die as it is drawn, and the height of its top face. */
const DIE = 0.94;
const DIE_TOP = 0.97;

function floorPlane(material: THREE.Material, size: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return mesh;
}

/** Things drawn on the board for the player's benefit: ghost previews, clear hints, the tutorial marker. */
export class FloorOverlays {
  readonly group = new THREE.Group();
  private readonly ghostMaterials: THREE.Material[];
  private readonly ghosts = new Map<Dir, THREE.Mesh>();
  private readonly hints = new Map<Dir, THREE.Mesh>();
  private readonly marker: THREE.Mesh;
  /** Outline of a die with the face it will show, standing where the tutorial wants one rolled. */
  private readonly phantom = new THREE.Group();
  private readonly phantomTop: THREE.Mesh;
  private readonly phantomFaces: THREE.MeshBasicMaterial[];

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
    this.phantomFaces = [1, 2, 3, 4, 5, 6].map(
      (value) => new THREE.MeshBasicMaterial({ map: cubeFaceTexture(value, theme), transparent: true, depthWrite: false }),
    );
    this.phantomTop = floorPlane(this.phantomFaces[0], DIE * 0.94);
    this.phantomTop.position.y = DIE_TOP + 0.005;
    this.phantomTop.visible = true;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(DIE, DIE, DIE)),
      new THREE.LineBasicMaterial({ color: theme.ivory, transparent: true, opacity: 0.6 }),
    );
    edges.position.y = 0.5;
    this.phantom.add(edges, this.phantomTop);
    this.phantom.visible = false;
    this.group.add(this.marker, this.phantom);
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

    const { marker } = options;
    this.marker.visible = marker !== null;
    this.phantom.visible = marker?.top !== undefined;
    if (marker) {
      const pulse = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(timeMs / 220);
      this.marker.position.set(marker.x, marker.raised ? DIE_TOP + 0.015 : 0.015, marker.z);
      (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.25 * pulse;
      if (marker.top !== undefined) {
        const face = this.phantomFaces[marker.top - 1];
        face.opacity = 0.55 + 0.3 * pulse;
        this.phantomTop.material = face;
        this.phantom.position.set(marker.x, 0, marker.z);
      }
    }
  }
}
