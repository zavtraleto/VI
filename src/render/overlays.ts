import * as THREE from 'three';
import { DELTA, DIRS, previewMove, type Dir, type RunState } from '../rules';
import { chevronTexture, faceFrameTexture, ghostFaceTexture } from './textures';
import type { Theme } from './theme';

export interface OverlayOptions {
  boardPreview: boolean;
  matchHint: boolean;
  /** What the tutorial points at; null outside it. */
  guide: BoardGuide | null;
}

/** One step of the path the tutorial asks for, drawn as chevrons from a cell towards the next. */
export interface GuideArrow {
  x: number;
  z: number;
  dir: Dir;
  /** Height the chevrons lie at: the top of the dice, or the floor. */
  y: number;
  /** How far from the middle of the cell the first chevron lies, in cells. */
  lead: number;
  /** A later step of the path, shown faintly behind the current one. */
  dim: boolean;
}

/** An outline around one face of a die. */
export interface GuideFrame {
  x: number;
  z: number;
  face: 'top' | 'east' | 'south';
  /** Height of the die, 0..1. */
  height: number;
  /** The face the player has to bring on top: it pulses. */
  strong: boolean;
}

export interface BoardGuide {
  arrows: readonly GuideArrow[];
  frames: readonly GuideFrame[];
}

/** Edge of a die as it is drawn. Its top face is this far below its logical height. */
const DIE = 0.94;
const TOP_INSET = 0.03;
const CHEVRONS = 3;
const MAX_ARROWS = 4;
const MAX_FRAMES = 16;

function floorPlane(material: THREE.Material, size: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return mesh;
}

/** Things drawn on the board for the player's benefit: ghost previews, clear hints, the tutorial's arrows and frames. */
export class FloorOverlays {
  readonly group = new THREE.Group();
  private readonly ghostMaterials: THREE.Material[];
  private readonly ghosts = new Map<Dir, THREE.Mesh>();
  private readonly hints = new Map<Dir, THREE.Mesh>();
  private readonly chevrons: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly frames: THREE.Mesh[] = [];
  private readonly frameSteady: THREE.MeshBasicMaterial;
  private readonly frameStrong: THREE.MeshBasicMaterial;

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
    // Arrows are drawn over everything: a die in front must not hide where to go.
    const chevron = chevronTexture(theme.guide);
    for (let i = 0; i < MAX_ARROWS * CHEVRONS; i++) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.52, 0.52),
        new THREE.MeshBasicMaterial({ map: chevron, transparent: true, depthTest: false, depthWrite: false }),
      );
      mesh.renderOrder = 30;
      mesh.visible = false;
      this.chevrons.push(mesh);
      this.group.add(mesh);
    }
    const frame = faceFrameTexture(theme.guide);
    this.frameSteady = new THREE.MeshBasicMaterial({ map: frame, transparent: true, opacity: 0.85, depthWrite: false });
    this.frameStrong = new THREE.MeshBasicMaterial({ map: frame, transparent: true, depthWrite: false });
    const frameGeometry = new THREE.PlaneGeometry(DIE, DIE);
    for (let i = 0; i < MAX_FRAMES; i++) {
      const mesh = new THREE.Mesh(frameGeometry, this.frameSteady);
      mesh.visible = false;
      this.frames.push(mesh);
      this.group.add(mesh);
    }
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

    this.syncGuide(options.guide, timeMs, reducedMotion);
  }

  private syncGuide(guide: BoardGuide | null, timeMs: number, reducedMotion: boolean): void {
    const arrows = guide?.arrows ?? [];
    this.chevrons.forEach((mesh, i) => {
      const arrow = arrows[Math.floor(i / CHEVRONS)];
      mesh.visible = arrow !== undefined;
      if (!arrow) return;
      const k = i % CHEVRONS;
      const { dx, dz } = DELTA[arrow.dir];
      const t = arrow.lead + k * 0.24;
      mesh.position.set(arrow.x + dx * t, arrow.y, arrow.z + dz * t);
      mesh.rotation.set(-Math.PI / 2, 0, Math.atan2(-dz, dx));
      // A wave running along the chevrons, in the direction of the move.
      const wave = reducedMotion ? 1 : 0.5 + 0.5 * Math.max(0, Math.sin(timeMs / 150 - k * 1.1));
      mesh.material.opacity = arrow.dim ? 0.35 : wave;
    });

    const frames = guide?.frames ?? [];
    const pulse = reducedMotion ? 1 : 0.5 + 0.5 * Math.sin(timeMs / 190);
    this.frameStrong.opacity = 0.55 + 0.45 * pulse;
    this.frames.forEach((mesh, i) => {
      const frame = frames[i];
      mesh.visible = frame !== undefined;
      if (!frame) return;
      mesh.material = frame.strong ? this.frameStrong : this.frameSteady;
      const centre = frame.height - 0.5;
      const out = DIE / 2 + 0.012;
      if (frame.face === 'top') {
        mesh.position.set(frame.x, frame.height - TOP_INSET + 0.012, frame.z);
        mesh.rotation.set(-Math.PI / 2, 0, 0);
      } else if (frame.face === 'south') {
        mesh.position.set(frame.x, centre, frame.z + out);
        mesh.rotation.set(0, 0, 0);
      } else {
        mesh.position.set(frame.x + out, centre, frame.z);
        mesh.rotation.set(0, Math.PI / 2, 0);
      }
    });
  }
}
