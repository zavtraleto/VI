import * as THREE from 'three';
import type { Layer, Rect } from '../display/layer';
import { DELTA, cubeAt, cubeHeight, type Dir, type GameEvent, type MoveKind, type RunState } from '../rules';
import { pictureSize } from '../shell/layout';
import { mixHex, type Palette } from '../shell/theme';
import { BoardBursts, type BoardBeat } from './burst';
import { CubeMeshes } from './cubes';
import { fitBoard, type FrameBounds } from './framing';
import { ChainMarks } from './marks';
import { FloorOverlays, type OverlayOptions } from './overlays';
import { boardPalette, type BoardLook } from './params';
import { PlayerFigure } from './player';
import { ChainSigns } from './signs';
import { CubeSprings } from './springs';
import { frameTexture, gridTexture, pipGlow, type GridLayout } from './textures';
import { SpawnWarnings } from './warnings';

/** Margin around the cells that the lines of the surface and the danger frame lie in, in cells. */
const RIM = 0.25;
/** How far past the cells the surface hides what is under it, in cells. */
const FLOOR_MARGIN = 4;
/** Tallest thing that must stay in frame: a cube with the figure on top. */
const TOP_Y = 1.9;
const FRAME_MARGIN = 0.25;
/** Room left beside the cells when the screen is narrower than the board. */
const SIDE_MARGIN = 0.08;
const CAMERA_DISTANCE = 40;
const RISE_IN_MS = 600;
/** How far the dark behind the board goes towards the channel sent most, and towards a group just sent. */
const BACK_TINT = 0.04;
const BACK_ANSWER = 0.06;
/** How far the dark goes towards red at the two steps of red. The mix is of light, not of paint: a little goes far. */
const RED_SEEP = [0.01, 0.03];
/**
 * By tier: how much the camera shakes, how far it leans in, how hard the dice around are thrown
 * up. It is the dice that shake; the camera does only from a chain of three.
 */
const BEAT_SHAKE = [0, 0, 0.35, 0.6, 0.9];
const BEAT_PUNCH = [0.006, 0.012, 0.02, 0.03, 0.045];
const BEAT_THROW = [1.1, 1.5, 2, 2.6, 3.2];
/** How long the answer of the dice takes to run out from a group, per cell. */
const WAVE_MS_PER_CELL = 45;
/** How far the colours part at the first step of the screen, in pixels of the program's picture. */
const CHROMA_TUBE_PX = 1.2;
const JOLT_TUBE_PX = 4;

export interface CameraAngles {
  /** Turn around the vertical axis: 45 is the diamond view, 0 looks straight at the board. */
  yaw: number;
  /** Elevation above the horizon: higher looks more from above. */
  pitch: number;
}

/**
 * How far the contact has gone, as the board shows it. A line is one thing that changes; its
 * number is how many of its steps have been reached, eased: 1.5 is the first step whole and
 * the second half-way in.
 */
export interface ContactLook {
  /** The surface: a group sent runs over the lines, the lines pulse, the run takes the colour of the group. */
  grid: number;
  /** The dice: the pips of all of them answer a clear, the dice breathe. */
  dice: number;
  /** What is behind the board: the dark leans to the channel sent most, and answers a group sent. */
  backdrop: number;
  /** The picture: its colours part when a group goes, then it jolts. */
  screen: number;
  /** The program around the board: its readings find a pattern, slip, take foreign signs, come apart. */
  program: number;
  /** Red seeps into the dark, then there is only black, white and red. */
  red: number;
  /** 1 at the moment the contact goes past its last step, fading to 0. */
  peak: number;
  /** The value sent most in this run; 0 before the first group. */
  channel: number;
}

export interface SceneParams {
  overlay: OverlayOptions;
  contact: ContactLook;
  /** The board is close to full. */
  warn: boolean;
  /** The board is full and the rescue countdown is running. */
  danger: boolean;
  reducedMotion: boolean;
  shake: boolean;
}

type FlatMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

function flat(size: number, y: number, material: THREE.MeshBasicMaterial): FlatMesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

/** How much of the `n`th step of a line is there. */
function step(level: number, n: number): number {
  return Math.min(1, Math.max(0, level - (n - 1)));
}

/**
 * Fixed orthographic view of the board. North points up-right to up, East right to down-right.
 * The board is drawn into a layer of the display, in the part of the window its container takes.
 *
 * The board has no plate under it: its surface is lines in the dark, and the layer is clear
 * around the dice, so what lies behind the board shows. The surface is the border between two
 * sides: what is under it is not seen.
 */
export class BoardView {
  /** The dark behind the board as this frame has it: for the layer that lies under this one. */
  readonly background = new THREE.Color();
  /** The picture is turned inside out for this frame. */
  inverted = false;
  /** Lines of the program's picture on this window: the tube the board is shown on. */
  lines = 240;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
  private readonly cameraHome = new THREE.Vector3();
  private readonly cameraRight = new THREE.Vector3();
  private readonly cameraUp = new THREE.Vector3();
  private readonly target: THREE.Vector3;
  private readonly cubes: CubeMeshes;
  private readonly player = new PlayerFigure();
  private readonly overlays: FloorOverlays;
  private readonly marks: ChainMarks;
  private readonly signs: ChainSigns;
  private readonly warnings: SpawnWarnings;
  private readonly springs = new CubeSprings();
  private readonly bursts = new BoardBursts();
  /** Dice that a beat throws up, and when: the answer runs out from the group. */
  private kicks: { id: number; at: number; v: number }[] = [];
  /** The contact as the last frame had it: a beat is answered as far as it has gone. */
  private contact: ContactLook | null = null;
  /** The step the player was making on the previous frame, to notice when it ends. */
  private lastStep: MoveKind | null = null;
  /** Height of every sinking cube on the previous frame, to notice a chain lifting it. */
  private sinking = new Map<number, number>();
  private sinkingBefore = new Map<number, number>();
  private readonly ambient: THREE.AmbientLight;
  private readonly reactionLight: THREE.PointLight;
  private readonly floor: THREE.Mesh;
  private readonly fill: FlatMesh;
  private readonly grid: FlatMesh;
  private readonly frame: FlatMesh;
  private readonly observer: ResizeObserver;
  private palette: Palette;
  /** The minute the colours were taken at: they follow the player's clock. */
  private minute = -1;
  private readonly dark = new THREE.Color();
  private readonly tone = new THREE.Color();
  private readonly channels: THREE.Color[] = [];
  private readonly lit: THREE.Color[] = [];
  /** The value of the group sent last. */
  private sent = 0;
  private readonly tmp = new THREE.Vector3();
  private readonly slabHalf: number;
  /** Extents of the scene on the camera's right and up axes, relative to the target. */
  private bounds: FrameBounds = { minR: -1, maxR: 1, minU: -1, maxU: 1, floorU: 0 };
  /** Where the container is in the window, in CSS pixels. */
  private rect: Rect = { x: 0, y: 0, width: 1, height: 1 };
  private width = 1;
  /** Height at the top of the stage, in CSS pixels, that the floor must stay out of. */
  private clear = 0;
  private height = 1;
  private lastTime = 0;
  /** Decaying effect amounts, 0..1. */
  private flash = 0;
  private burst = 0;
  private tremor = 0;
  /** The camera leaning in, the colours parting, the picture jolting: what a beat does to the screen. */
  private punch = 0;
  private chroma = 0;
  private jolt = 0;
  private readonly red = new THREE.Color();
  /** 1 when a board starts by coming up out of the floor, falling to 0. */
  private rise = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly worldLayer: Layer,
    private readonly look: BoardLook,
    size: number,
    angles: CameraAngles,
  ) {
    const values = look.board;
    const n = (name: string): number => Number(values[name] ?? 0);
    this.palette = boardPalette(look);

    const centre = (size - 1) / 2;
    this.target = new THREE.Vector3(centre, 0, centre);
    this.slabHalf = size / 2 + RIM;

    this.ambient = new THREE.AmbientLight(0xdfe3ff, n('lightAmbient'));
    const key = new THREE.DirectionalLight(0xfff1dd, n('lightKey'));
    // Mostly from above, so the top face - the one that matters - is the brightest.
    key.position.set(2, 10, 4.5);
    this.reactionLight = new THREE.PointLight(0xffffff, 0, 7, 1.6);
    this.scene.add(this.ambient, key, this.reactionLight);

    // Writes depth and no colour: what goes under the surface is gone, and what lies behind
    // the board still shows through it. Drawn first, whatever stands where.
    const floorSize = size + FLOOR_MARGIN * 2;
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(floorSize, floorSize), new THREE.MeshBasicMaterial({ colorWrite: false }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.renderOrder = -10;

    const layout: GridLayout = { cells: size, rim: RIM };
    const gridSize = size + RIM * 2;
    const lines = (map: THREE.Texture): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false });
    this.fill = flat(size, 0.002, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.grid = flat(gridSize, 0.004, lines(gridTexture(layout, n('gridLine'), n('gridEdge'))));
    this.frame = flat(gridSize, 0.01, lines(frameTexture(layout)));
    for (const mesh of [this.floor, this.fill, this.grid, this.frame]) {
      mesh.position.x = centre;
      mesh.position.z = centre;
      this.scene.add(mesh);
    }

    this.cubes = new CubeMeshes(this.palette, values);
    this.overlays = new FloorOverlays(values);
    this.marks = new ChainMarks(values);
    this.signs = new ChainSigns(values);
    this.warnings = new SpawnWarnings(values);
    this.scene.add(
      this.overlays.group,
      this.marks.group,
      this.signs.group,
      this.warnings.group,
      this.cubes.group,
      this.player.group,
      this.bursts.group,
    );
    this.applyPalette();

    this.setCamera(angles);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
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

    // What has to fit top to bottom: the surface and a cube with the figure on every cell.
    // Side to side only the cells have to: on a narrow screen the board is as large as it
    // can be, and the tips of the margin around them run off the edges.
    const b: FrameBounds = { minR: Infinity, maxR: -Infinity, minU: Infinity, maxU: -Infinity, floorU: -Infinity };
    const p = new THREE.Vector3();
    const cellsHalf = this.slabHalf - RIM;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const r = p.set(sx * cellsHalf, 0, sz * cellsHalf).dot(this.cameraRight);
        b.minR = Math.min(b.minR, r);
        b.maxR = Math.max(b.maxR, r);
        for (const y of [0, TOP_Y]) {
          const u = p.set(sx * this.slabHalf, y, sz * this.slabHalf).dot(this.cameraUp);
          b.minU = Math.min(b.minU, u);
          b.maxU = Math.max(b.maxU, u);
        }
        b.floorU = Math.max(b.floorU, p.set(sx * this.slabHalf, 0, sz * this.slabHalf).dot(this.cameraUp));
      }
    }
    this.bounds = b;
    this.resize();
  }

  /**
   * Keeps the top `pixels` of the stage free of the floor: the board moves down where the
   * screen has height to spare and is drawn smaller where it has none.
   */
  setClear(pixels: number): void {
    if (pixels === this.clear) return;
    this.clear = pixels;
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

  /** How the floor lies on screen: where a cell to the east and a cell to the south lead, y pointing down. */
  floorAxes(): { east: { x: number; y: number }; south: { x: number; y: number } } {
    return {
      east: { x: this.cameraRight.x, y: -this.cameraUp.x },
      south: { x: this.cameraRight.z, y: -this.cameraUp.z },
    };
  }

  resize(): void {
    const box = this.container.getBoundingClientRect();
    this.width = Math.max(1, box.width);
    this.height = Math.max(1, box.height);
    this.rect = { x: box.left, y: box.top, width: this.width, height: this.height };
    const aspect = this.width / this.height;
    const { halfHeight, centreR, centreU } = fitBoard(
      this.bounds,
      aspect,
      this.clear / this.height,
      SIDE_MARGIN,
      FRAME_MARGIN,
    );
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
        this.sent = event.value;
      } else if (event.type === 'chain') {
        this.flash = 1;
        this.burst = 1;
        this.sent = event.value;
      } else if (event.type === 'happyOne') {
        this.burst = 1;
        this.sent = 1;
      }
    }
  }

  /**
   * The board answers a beat: light thrown up from the group, a ring over the surface, the dice
   * around thrown up in a wave from it, the camera shaken. The larger the beat, the larger the
   * answer; past steps of the screen the picture itself answers too.
   */
  beat(beat: BoardBeat, state: RunState, reducedMotion: boolean): void {
    const tier = Math.max(0, Math.min(4, Math.round(beat.tier)));
    const screen = this.contact?.screen ?? 0;
    this.tremor = Math.max(this.tremor, BEAT_SHAKE[tier]);
    if (screen > 0 && tier >= 1) this.chroma = Math.max(this.chroma, Math.min(1, screen) * Math.min(1, 0.35 + tier * 0.17));
    if (screen > 1 && tier >= 2) this.jolt = Math.max(this.jolt, Math.min(1, screen - 1));
    if (reducedMotion) return;
    this.punch = Math.max(this.punch, BEAT_PUNCH[tier]);
    this.bursts.fire(beat);
    if (beat.cells.length === 0) return;
    const cx = beat.cells.reduce((sum, cell) => sum + cell.x, 0) / beat.cells.length;
    const cz = beat.cells.reduce((sum, cell) => sum + cell.z, 0) / beat.cells.length;
    const reach = 2.5 + tier * 1.2;
    for (const cube of state.cubes) {
      if (cube.state === 'sinking') continue;
      const distance = Math.hypot(cube.x - cx, cube.z - cz);
      const v = BEAT_THROW[tier] * (1 - distance / reach);
      if (v > 0.1) this.kicks.push({ id: cube.id, at: this.lastTime + distance * WAVE_MS_PER_CELL, v });
    }
  }

  /** `riseIn` brings the dice and the figure up out of the floor instead of showing them at once. */
  reset(riseIn = false): void {
    this.rise = riseIn ? 1 : 0;
    this.flash = 0;
    this.burst = 0;
    this.tremor = 0;
    this.punch = 0;
    this.chroma = 0;
    this.jolt = 0;
    this.kicks = [];
    this.bursts.reset();
    this.sent = 0;
    this.warnings.reset();
    this.springs.reset();
    this.sinking.clear();
    this.lastStep = null;
  }

  draw(state: RunState, alpha: number, timeMs: number, params: SceneParams): void {
    const dt = this.lastTime === 0 ? 0 : Math.min(100, Math.max(0, timeMs - this.lastTime));
    this.lastTime = timeMs;
    this.flash = Math.max(0, this.flash - dt / 450);
    this.burst = Math.max(0, this.burst - dt / 350);
    this.tremor = Math.max(0, this.tremor - dt / 260);
    this.punch *= Math.exp(-dt / 90);
    this.chroma = Math.max(0, this.chroma - dt / 240);
    this.jolt = Math.max(0, this.jolt - dt / 160);
    this.contact = params.contact;

    const minute = Math.floor(Date.now() / 60000);
    if (minute !== this.minute) {
      this.minute = minute;
      this.applyPalette();
    }

    const values = this.look.board;
    const n = (name: string): number => Number(values[name] ?? 0);
    const { contact, reducedMotion } = params;
    this.rise = reducedMotion ? 0 : Math.max(0, this.rise - dt / RISE_IN_MS);
    // Fast at first, settling at the end.
    const sunk = this.rise * this.rise;
    const wave = (periodMs: number) => (reducedMotion ? 0 : Math.sin((timeMs / periodMs) * Math.PI * 2));

    // The dice, first step: pips answer a clear together. Second: the dice breathe.
    const breathing = step(contact.dice, 2) * (0.1 + 0.07 * wave(3600));

    // The cube the player stands on sits lower than the rest for as long as they stand on it,
    // rolling it included: the one who plays weighs on the world. Landing on a cube pushes it
    // a little further for a moment.
    const { player } = state;
    const stepNow = player.action?.kind ?? null;
    const riding = player.level === 'top' && (stepNow === null || stepNow === 'roll');
    const under = riding ? cubeAt(state, player.x, player.z) : undefined;
    this.springs.hold(under?.id ?? null, n('pressDepth'));
    const steppedOn = this.lastStep === 'hop' || this.lastStep === 'mount' || this.lastStep === 'climb';
    if (stepNow === null && steppedOn && under && !reducedMotion) this.springs.kick(under.id, -1.2);
    this.lastStep = stepNow;

    // A chain that is added to brings its cubes back up: they rise instead of jumping.
    [this.sinking, this.sinkingBefore] = [this.sinkingBefore, this.sinking];
    this.sinking.clear();
    for (const cube of state.cubes) {
      if (cube.state !== 'sinking') continue;
      const height = cubeHeight(cube, state.config);
      const before = this.sinkingBefore.get(cube.id);
      if (before !== undefined && height > before + 0.02 && !reducedMotion) this.springs.shift(cube.id, before - height);
      this.sinking.set(cube.id, height);
    }
    if (this.kicks.length > 0) {
      this.kicks = this.kicks.filter((kick) => {
        if (kick.at > timeMs) return true;
        if (!reducedMotion) this.springs.kick(kick.id, kick.v);
        return false;
      });
    }
    this.springs.update(dt);
    this.bursts.update(dt, this.camera);
    const dip = (cubeId: number) => this.springs.offset(cubeId);

    this.cubes.sync(
      state,
      alpha,
      { idle: this.flash * step(contact.dice, 1) * 0.9 + breathing, sinking: 1 + 0.15 * wave(700), flash: this.burst },
      dip,
    );
    // The figure is a grey mannequin that grows into the red of the seventh.
    this.player.setColor(mixHex(String(values.mannequin), this.palette.signal, n('figureRed')), n('figureGhost'));
    this.player.sync(state, alpha, dip);
    this.cubes.group.position.y = -sunk;
    this.player.group.position.y -= sunk;
    this.overlays.sync(state, timeMs, params.overlay, reducedMotion);
    this.marks.sync(state, timeMs, reducedMotion);
    // The dice, fourth step: the light of a group going down stands taller.
    this.signs.sync(state, alpha, timeMs, reducedMotion, dip, 1 + 0.7 * step(contact.dice, 4));
    this.warnings.sync(state, dt, timeMs, reducedMotion);

    // A group going down lights what stands around it with the colour of its channel.
    const sent = this.sent > 0 ? this.lit[this.sent - 1] : this.tone;
    const reaction = this.cubes.sinkingCentre(state);
    this.reactionLight.color.copy(sent);
    this.reactionLight.intensity = reaction.count > 0 ? 5 + Math.min(reaction.count, 8) * 1.6 + this.burst * 10 : 0;
    this.reactionLight.position.set(reaction.x, 1.5, reaction.z);

    // The surface: a group sent runs over the lines, then the lines pulse by themselves, then
    // the run takes the colour of the group.
    const run = this.flash * step(contact.grid, 1);
    this.grid.material.opacity = Math.min(1, n('gridBright') * (1 + 0.3 * wave(5200) * step(contact.grid, 2)) + run * 0.5);
    this.grid.material.color.copy(this.tone).lerp(sent, run * step(contact.grid, 3)).lerp(this.red, 0.35 * step(contact.red, 2));
    this.fill.visible = n('gridFill') > 0;
    this.fill.material.opacity = n('gridFill');

    // Danger keeps its own rhythm so it never reads as decoration.
    let frameOpacity = 0;
    if (params.danger) frameOpacity = reducedMotion ? 1 : Math.floor(timeMs / 125) % 2 === 0 ? 1 : 0.15;
    else if (params.warn) frameOpacity = reducedMotion ? 0.55 : 0.35 + 0.3 * (0.5 + 0.5 * wave(900));
    this.frame.visible = frameOpacity > 0.002;
    this.frame.material.opacity = frameOpacity;

    // What is behind the board: the dark leans towards the channel sent most, and answers a group sent.
    this.background.copy(this.dark);
    if (contact.channel > 0) this.background.lerp(this.channels[contact.channel - 1], BACK_TINT * step(contact.backdrop, 1));
    this.background.lerp(sent, this.burst * BACK_ANSWER * step(contact.backdrop, 2));
    // Red seeps into the dark.
    this.background.lerp(this.red, RED_SEEP[0] * step(contact.red, 1) + RED_SEEP[1] * step(contact.red, 2));

    this.ambient.intensity = n('lightAmbient') + contact.peak * 1.6;
    // Past its last step the contact turns the picture inside out for a moment.
    this.inverted = !reducedMotion && contact.peak > 0.72;

    this.camera.position.copy(this.cameraHome);
    // A beat leans the camera in for a moment.
    const zoom = params.shake && !reducedMotion ? 1 + this.punch : 1;
    if (Math.abs(zoom - this.camera.zoom) > 1e-5) {
      this.camera.zoom = zoom;
      this.camera.updateProjectionMatrix();
    }
    if (params.shake && !reducedMotion && this.tremor > 0) {
      const amount = this.tremor * 0.09;
      this.camera.position
        .addScaledVector(this.cameraRight, Math.sin(timeMs / 13) * amount)
        .addScaledVector(this.cameraUp, Math.cos(timeMs / 17) * amount);
    }
    // The stage can move in the window without changing its size, and no resize observer
    // reports that: the board is no longer a child of the stage that would move along with it.
    const box = this.container.getBoundingClientRect();
    const { rect } = this;
    if (box.left !== rect.x || box.top !== rect.y || Math.max(1, box.width) !== rect.width || Math.max(1, box.height) !== rect.height) {
      this.resize();
    }

    // The board is sharp, and is shown on the same tube as the rest of the program: its lines
    // are counted as the program's picture has them, not in the pixels of the board.
    const layer = this.worldLayer;
    const { shell } = this.look;
    this.lines = pictureSize({ width: layer.width, height: layer.height }, Number(shell.pixelsTall), Number(shell.pixelsWide)).height;
    layer.look.invert = this.inverted;
    layer.look.scanlines = n('scanlines');
    layer.look.scanlinePitch = this.lines;
    layer.look.vignette = n('vignette');
    // The screen, first step: the colours part for a moment when a group goes. Second: the
    // picture jolts sideways on a large one.
    const tube = layer.height / Math.max(1, this.lines);
    layer.look.chroma = reducedMotion ? 0 : this.chroma * CHROMA_TUBE_PX * tube;
    const jolt = reducedMotion || this.jolt <= 0 ? 0 : Math.round(Math.sin(timeMs / 11) * this.jolt * JOLT_TUBE_PX) * (this.rect.height / Math.max(1, this.lines));
    // The layer stays clear around the board: what lies behind shows.
    layer.render(this.scene, this.camera, { rect: jolt === 0 ? this.rect : { ...this.rect, x: this.rect.x + jolt } });
  }

  /** World position to CSS pixels inside the container. */
  project(x: number, y: number, z: number): { x: number; y: number } {
    this.tmp.set(x, y, z).project(this.camera);
    return { x: ((this.tmp.x + 1) / 2) * this.width, y: ((1 - this.tmp.y) / 2) * this.height };
  }

  /** Frees what the view holds on the graphics card. A view that is replaced is never drawn again. */
  dispose(): void {
    this.observer.disconnect();
    this.cubes.dispose();
    this.player.dispose();
    this.overlays.dispose();
    this.marks.dispose();
    this.signs.dispose();
    this.warnings.dispose();
    this.bursts.dispose();
    for (const mesh of [this.fill, this.grid, this.frame]) {
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
    this.floor.geometry.dispose();
    (this.floor.material as THREE.Material).dispose();
  }

  /** Takes the colours of the program as they are at this hour. Only the faces of the solid dice keep theirs. */
  private applyPalette(): void {
    const palette = boardPalette(this.look);
    this.palette = palette;
    this.dark.set(palette.bg);
    this.tone.set(palette.ink);
    this.red.set(palette.signal);
    for (let value = 1; value <= 6; value++) {
      this.channels[value - 1] = new THREE.Color(palette.channels[value - 1]);
      this.lit[value - 1] = new THREE.Color(pipGlow(value, palette));
    }
    this.fill.material.color.copy(this.tone);
    this.frame.material.color.copy(this.tone);
    this.bursts.setColours(this.lit);
    this.cubes.setPalette(palette);
    this.marks.setPalette(palette);
    this.signs.setPalette(palette);
    this.warnings.setPalette(palette);
    this.overlays.setPalette(palette);
  }
}
