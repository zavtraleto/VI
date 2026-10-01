import * as THREE from 'three';
import { DELTA, cubeAt, type Dir, type GameEvent, type MoveKind, type RunState } from '../rules';
import { CubeMeshes } from './cubes';
import { FloorOverlays, type OverlayOptions } from './overlays';
import { PlayerFigure } from './player';
import { CubeSprings } from './springs';
import {
  cellLinesTexture,
  frameTexture,
  perimeterTexture,
  ringTexture,
  sealTexture,
  slabTexture,
  type SlabLayout,
} from './textures';
import type { Theme } from './theme';
import { SpawnWarnings } from './warnings';

const MAX_DPR = 1.5;
const RIM = 0.25;
const SLAB_DEPTH = 1.4;
const RING_SIZE = 11.6;
/** Tallest thing that must stay in frame: a cube with the figure on top. */
const TOP_Y = 1.7;
const FRAME_MARGIN = 0.25;
const CAMERA_DISTANCE = 40;
const RISE_IN_MS = 600;

export interface CameraAngles {
  /** Turn around the vertical axis: 45 is the diamond view, 0 looks straight at the board. */
  yaw: number;
  /** Elevation above the horizon: higher looks more from above. */
  pitch: number;
}

export interface SceneParams {
  overlay: OverlayOptions;
  /** Eased presence of ritual stages 1..5. */
  levels: readonly number[];
  /** 1 at the moment the last stage is reached, fading to 0. */
  phaseShift: number;
  /** The board is close to full. */
  warn: boolean;
  /** The board is full and the rescue countdown is running. */
  danger: boolean;
  reducedMotion: boolean;
  shake: boolean;
}

function layer(texture: THREE.Texture, size: number, y: number): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.visible = false;
  return mesh;
}

/** Fixed orthographic view of the board. North points up-right to up, East right to down-right. */
export class BoardView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
  private readonly cameraHome = new THREE.Vector3();
  private readonly cameraRight = new THREE.Vector3();
  private readonly cameraUp = new THREE.Vector3();
  private readonly target: THREE.Vector3;
  private readonly cubes: CubeMeshes;
  private readonly player: PlayerFigure;
  private readonly overlays: FloorOverlays;
  private readonly warnings: SpawnWarnings;
  private readonly springs = new CubeSprings();
  /** The step the player was making on the previous frame, to notice when it ends. */
  private lastStep: MoveKind | null = null;
  private readonly ambient: THREE.AmbientLight;
  private readonly reactionLight: THREE.PointLight;
  private readonly perimeter;
  private readonly cellLines;
  private readonly seal;
  private readonly frame;
  private readonly ring;
  private readonly voidColor: THREE.Color;
  private readonly voidFinal: THREE.Color;
  private readonly background = new THREE.Color();
  private readonly tmp = new THREE.Vector3();
  private readonly slabHalf: number;
  /** Extents of the scene on the camera's right and up axes, relative to the target. */
  private bounds = { minR: -1, maxR: 1, minU: -1, maxU: 1 };
  private width = 1;
  private height = 1;
  private lastTime = 0;
  private backgroundCss = '';
  /** Decaying effect amounts, 0..1. */
  private flash = 0;
  private burst = 0;
  private tremor = 0;
  /** 1 when a board starts by coming up out of the floor, falling to 0. */
  private rise = 0;

  constructor(private readonly container: HTMLElement, theme: Theme, size: number, angles: CameraAngles) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.domElement.className = 'board-canvas';
    container.prepend(this.renderer.domElement);
    this.voidColor = new THREE.Color(theme.void);
    this.voidFinal = new THREE.Color(theme.voidFinal);

    const centre = (size - 1) / 2;
    this.target = new THREE.Vector3(centre, 0, centre);
    this.slabHalf = size / 2 + RIM;

    this.ambient = new THREE.AmbientLight(0xdfe3ff, 0.95);
    const key = new THREE.DirectionalLight(0xfff1dd, 2.6);
    // Mostly from above, so the top face - the one that matters - is the brightest.
    key.position.set(2, 10, 4.5);
    this.reactionLight = new THREE.PointLight(theme.carmine, 0, 7, 1.6);
    this.scene.add(this.ambient, key, this.reactionLight);

    const layout: SlabLayout = { cells: size, rim: RIM };
    const slabSize = size + RIM * 2;
    const side = new THREE.MeshLambertMaterial({ color: theme.slabSide });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slabSize, SLAB_DEPTH, slabSize), [
      side,
      side,
      new THREE.MeshLambertMaterial({ map: slabTexture(theme, layout) }),
      side,
      side,
      side,
    ]);
    slab.position.set(centre, -SLAB_DEPTH / 2, centre);
    this.scene.add(slab);

    this.perimeter = layer(perimeterTexture(theme, layout), slabSize, 0.004);
    this.cellLines = layer(cellLinesTexture(theme, layout), slabSize, 0.006);
    this.seal = layer(sealTexture(theme), slabSize, 0.008);
    this.frame = layer(frameTexture(theme, layout), slabSize, 0.01);
    this.ring = layer(ringTexture(theme), RING_SIZE, -0.04);
    for (const mesh of [this.perimeter, this.cellLines, this.seal, this.frame, this.ring]) {
      mesh.position.x = centre;
      mesh.position.z = centre;
      this.scene.add(mesh);
    }

    this.cubes = new CubeMeshes(theme);
    this.player = new PlayerFigure(theme);
    this.overlays = new FloorOverlays(theme);
    this.warnings = new SpawnWarnings(theme);
    this.scene.add(this.overlays.group, this.warnings.group, this.cubes.group, this.player.group);

    this.setCamera(angles);
    new ResizeObserver(() => this.resize()).observe(container);
  }

  /** Points the camera and reframes the board. The rules never depend on this. */
  setCamera(angles: CameraAngles): void {
    const yaw = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(angles.yaw, 0, 45));
    const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(angles.pitch, 20, 85));
    const offset = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    ).multiplyScalar(CAMERA_DISTANCE);
    this.cameraHome.copy(this.target).add(offset);
    this.camera.position.copy(this.cameraHome);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    this.cameraRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.cameraUp.setFromMatrixColumn(this.camera.matrixWorld, 1);

    // What has to fit: the slab and a cube with the figure on every cell. The ring of the
    // late stages is decoration and may run off the sides on a narrow screen.
    const points: THREE.Vector3[] = [];
    const h = this.slabHalf;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        points.push(new THREE.Vector3(sx * h, -SLAB_DEPTH, sz * h), new THREE.Vector3(sx * h, TOP_Y, sz * h));
      }
    }
    const b = { minR: Infinity, maxR: -Infinity, minU: Infinity, maxU: -Infinity };
    for (const p of points) {
      const r = p.dot(this.cameraRight);
      const u = p.dot(this.cameraUp);
      b.minR = Math.min(b.minR, r);
      b.maxR = Math.max(b.maxR, r);
      b.minU = Math.min(b.minU, u);
      b.maxU = Math.max(b.maxU, u);
    }
    this.bounds = b;
    this.resize();
  }

  /** Direction of a board step on screen, as a unit vector with y pointing down. */
  screenDir(dir: Dir): { x: number; y: number } {
    this.tmp.set(DELTA[dir].dx, 0, DELTA[dir].dz);
    const x = this.tmp.dot(this.cameraRight);
    const y = -this.tmp.dot(this.cameraUp);
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  resize(): void {
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    const { minR, maxR, minU, maxU } = this.bounds;
    const needHalfWidth = (maxR - minR) / 2 + FRAME_MARGIN;
    const needHalfHeight = (maxU - minU) / 2 + FRAME_MARGIN;
    const halfHeight = Math.max(needHalfHeight, needHalfWidth / aspect);
    const centreR = (minR + maxR) / 2;
    const centreU = (minU + maxU) / 2;
    this.camera.top = centreU + halfHeight;
    this.camera.bottom = centreU - halfHeight;
    this.camera.left = centreR - halfHeight * aspect;
    this.camera.right = centreR + halfHeight * aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Lets the scene react to what happened in a tick. */
  notify(events: readonly GameEvent[]): void {
    this.warnings.notify(events);
    for (const event of events) {
      if (event.type === 'match') {
        this.flash = Math.max(this.flash, 0.7);
        this.burst = 1;
      } else if (event.type === 'chain') {
        this.flash = 1;
        this.burst = 1;
        this.tremor = Math.min(1, 0.35 + event.chain * 0.15);
      } else if (event.type === 'happyOne') {
        this.burst = 1;
      }
    }
  }

  /** `riseIn` brings the dice and the figure up out of the floor instead of showing them at once. */
  reset(riseIn = false): void {
    this.rise = riseIn ? 1 : 0;
    this.flash = 0;
    this.burst = 0;
    this.tremor = 0;
    this.warnings.reset();
    this.springs.reset();
    this.lastStep = null;
  }

  draw(state: RunState, alpha: number, timeMs: number, params: SceneParams): void {
    const dt = this.lastTime === 0 ? 0 : Math.min(100, Math.max(0, timeMs - this.lastTime));
    this.lastTime = timeMs;
    this.flash = Math.max(0, this.flash - dt / 450);
    this.burst = Math.max(0, this.burst - dt / 350);
    this.tremor = Math.max(0, this.tremor - dt / 260);

    const { levels, reducedMotion } = params;
    this.rise = reducedMotion ? 0 : Math.max(0, this.rise - dt / RISE_IN_MS);
    // Fast at first, settling at the end.
    const sunk = this.rise * this.rise;
    const wave = (periodMs: number) => (reducedMotion ? 0 : Math.sin((timeMs / periodMs) * Math.PI * 2));

    // Stage 2: pips answer a clear together. Stage 3: the dice breathe.
    const breathing = levels[2] * (0.1 + 0.07 * wave(3600));

    // A cube dips once when the player steps onto it. Rolling a cube does not trigger it.
    const { player } = state;
    const stepNow = player.action?.kind ?? null;
    const steppedOn = this.lastStep === 'hop' || this.lastStep === 'mount' || this.lastStep === 'climb';
    if (stepNow === null && steppedOn && player.level === 'top' && !reducedMotion) {
      const cube = cubeAt(state, player.x, player.z);
      if (cube) this.springs.kick(cube.id, -2.2);
    }
    this.lastStep = stepNow;
    this.springs.update(dt);
    const dip = (cubeId: number) => this.springs.offset(cubeId);

    this.cubes.sync(
      state,
      alpha,
      { idle: this.flash * levels[1] * 0.9 + breathing, sinking: 1.15 + 0.3 * wave(700) + this.burst * 1.4 },
      dip,
    );
    this.player.sync(state, alpha, dip);
    this.cubes.group.position.y = -sunk;
    this.player.group.position.y -= sunk;
    this.overlays.sync(state, timeMs, params.overlay, reducedMotion);
    this.warnings.sync(state, dt, timeMs, reducedMotion);

    const reaction = this.cubes.sinkingCentre(state);
    this.reactionLight.intensity = reaction.count > 0 ? 5 + Math.min(reaction.count, 8) * 1.6 + this.burst * 10 : 0;
    this.reactionLight.position.set(reaction.x, 1.5, reaction.z);

    const show = (mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>, opacity: number) => {
      mesh.visible = opacity > 0.002;
      mesh.material.opacity = opacity;
    };
    show(this.perimeter, levels[0] * 0.9);
    show(this.cellLines, levels[1] * (0.42 + 0.14 * wave(5200) * levels[2] + this.flash * 0.3));
    show(this.seal, levels[4] * (0.8 + 0.12 * wave(4300)));
    show(this.ring, levels[3] * 0.85);
    if (!reducedMotion) this.ring.rotation.z = timeMs / 24000 + levels[4] * (timeMs / 9000);

    // Danger keeps its own rhythm so it never reads as decoration.
    let frameOpacity = 0;
    if (params.danger) frameOpacity = reducedMotion ? 1 : Math.floor(timeMs / 125) % 2 === 0 ? 1 : 0.15;
    else if (params.warn) frameOpacity = reducedMotion ? 0.55 : 0.35 + 0.3 * (0.5 + 0.5 * wave(900));
    show(this.frame, frameOpacity);

    this.background.copy(this.voidColor).lerp(this.voidFinal, Math.min(1, levels[3] * 0.35 + levels[4] * 0.65));
    this.renderer.setClearColor(this.background);
    const css = `#${this.background.getHexString()}`;
    if (css !== this.backgroundCss) {
      // The page around the canvas follows the void so the board never sits in a visible box.
      this.backgroundCss = css;
      document.documentElement.style.setProperty('--void', css);
    }
    this.ambient.intensity = 0.95 - levels[3] * 0.12 + params.phaseShift * 1.6;
    this.renderer.domElement.style.filter = !reducedMotion && params.phaseShift > 0.72 ? 'invert(1)' : '';

    this.camera.position.copy(this.cameraHome);
    if (params.shake && !reducedMotion && this.tremor > 0) {
      const amount = this.tremor * 0.09;
      this.camera.position
        .addScaledVector(this.cameraRight, Math.sin(timeMs / 13) * amount)
        .addScaledVector(this.cameraUp, Math.cos(timeMs / 17) * amount);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** World position to CSS pixels inside the container. */
  project(x: number, y: number, z: number): { x: number; y: number } {
    this.tmp.set(x, y, z).project(this.camera);
    return { x: ((this.tmp.x + 1) / 2) * this.width, y: ((1 - this.tmp.y) / 2) * this.height };
  }
}
