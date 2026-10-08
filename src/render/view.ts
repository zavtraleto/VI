import * as THREE from 'three';
import type { Layer, Rect } from '../display/layer';
import { lensTo, type Lens, type LensSides } from '../display/lens';
import { DELTA, cubeAt, cubeHeight, type Dir, type GameEvent, type MoveKind, type RunState } from '../rules';
import { pictureSize } from '../shell/layout';
import type { Palette } from '../shell/theme';
import { BoardBursts, FX_LAYER, type BoardBeat } from './burst';
import { quality } from '../display/quality';
import { CubeMeshes, GLOW_LAYER, type CubeGlow } from './cubes';
import { cellPixels, fitBoard, follow, followFocus, followFrame, viewMode, type FrameBounds, type ViewChoice, type ViewMode } from './framing';
import { ChainMarks } from './marks';
import { FloorOverlays, type OverlayOptions } from './overlays';
import { boardPalette, type BoardLook } from './params';
import { PlayerFigure } from './player';
import { ChainSigns } from './signs';
import { CubeSprings } from './springs';
import { figureColour, frameTexture, gridTexture, pipGlow, redrawGrid, type GridBands, type GridLayout } from './textures';
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
/**
 * How long the dice of a level that is cleared take to go down under the floor, and how far
 * down they go: the way they came up, turned round, a little quicker.
 */
const LEAVE_MS = 520;
const LEAVE_DEPTH = 1.25;
/** How far gone the dice are when their marks are put out: the top of a whole die is at the floor by then. */
const MARKS_GONE_AT = 0.85;
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
/** How far the picture jolts at the second step of the screen, in pixels of the program's picture. */
const JOLT_TUBE_PX = 4;
/** How much of their parting the colours have on a chain of three links; a longer one has more, up to all of it. */
const PART_FROM = 0.5;
const PART_PER_TIER = 0.25;
/**
 * The height the followed view is taken at: the top of a die, where the figure is most of the
 * time. It is the cell that is followed, so a hop or a climb does not move the view.
 */
const FOLLOW_Y = 1;
/** The words of an exercise never take more of the stage than this from the followed board. */
const FOLLOW_CLEAR = 0.7;
/**
 * A followed board seen through the lens is drawn denser than the canvas, for its enlarged
 * middle to stay sharp: never more than this many times either way, nor larger than this on
 * a side, in pixels.
 */
const SHARP_MAX = 2;
const SHARP_SIDE_PX = 2048;
const VIEWS: readonly string[] = ['auto', 'full', 'follow'];

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
  /** The player keeps the whole board in view, however small it is on this screen. */
  whole?: boolean;
  /**
   * Cells a die that was going stood on until another die was rolled over it: its group is still
   * going, and the cell keeps the frame of the group.
   */
  ghosts?: readonly { x: number; z: number; value: number }[];
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
 *
 * Where the whole board would be small on the screen, the view follows the player instead:
 * the board is seen larger, and the screen shows the part of it the player is on, moving over
 * the board as they do. The board and the dice stay as they are, flat and whole; the camera
 * does not turn. A lens over the picture that brings the rest of the board in is there to be
 * tried, and is off.
 */
export class BoardView {
  /** The dark behind the board as this frame has it: for the layer that lies under this one. */
  readonly background = new THREE.Color();
  /** The picture is turned inside out for this frame. */
  inverted = false;
  /** Lines of the program's picture on this window: the tube the board is shown on. */
  lines = 240;
  /** How the board is seen: whole, or followed through a lens. Picked anew on every frame drawn. */
  mode: ViewMode = 'full';
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
  /** The light a group going down throws on the dice around it. */
  private readonly lamp: CubeGlow['lamp'] = { x: 0, y: 1.5, z: 0, colour: new THREE.Color(), power: 0 };
  private readonly floor: THREE.Mesh;
  private readonly fill: FlatMesh;
  private readonly grid: FlatMesh;
  private readonly frame: FlatMesh;
  /** The cells of the surface, and the picture of all its lines: what the surface is drawn with while it stands. */
  private readonly layout: GridLayout;
  private readonly whole: THREE.Texture;
  /** The picture of the rows of the surface that are drawn while it goes out or comes, and which rows it has; null while it stands. */
  private partial: { map: THREE.CanvasTexture; rows: string } | null = null;
  private readonly observer: ResizeObserver;
  /** Kept when what the board is drawn with has been made ready. */
  private readonly warmed: Promise<void>;
  private disposed = false;
  private palette: Palette;
  /** The minute the colours were taken at: they follow the player's clock. */
  private minute = -1;
  private readonly dark = new THREE.Color();
  private readonly tone = new THREE.Color();
  private readonly channels: THREE.Color[] = [];
  private readonly lit: THREE.Color[] = [];
  /** The value of the group sent last. */
  private sent = 0;
  /** The run on the board is a session without end: what is rare in it is answered by the picture itself. */
  private endless = false;
  /** The player keeps motion low: nothing is thrown about. */
  private still = false;
  /** A dot of the tube, in cells of the board: what a die that comes apart is made of. */
  private dotWorld = 0.04;
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
  /** How far the dice of a cleared level have gone under the floor, 0 to 1, and whether they are going. */
  private leave = 0;
  private leaving = false;
  /** Size of a cell with the whole board in view, in CSS pixels: what the view is picked by. */
  private wholeCell = 0;
  /** The point of the board the followed view is about, on the camera's right and up axes, and how fast it is moving. */
  private readonly at = { r: 0, u: 0 };
  private readonly speed = { r: 0, u: 0 };
  /** The followed view has been brought to the player: until then it does not glide, it is put there. */
  private settled = false;
  /** How many times the lens enlarges the middle of what is drawn, side to side and bottom to top. */
  private readonly enlarged = { x: 1, y: 1 };
  /** The part of the container the board is drawn to, in CSS pixels from its corner. */
  private region: Rect = { x: 0, y: 0, width: 1, height: 1 };
  /** The lens the board is put on screen through; null with the whole board in view. */
  private lens: Lens | null = null;
  /** The lens of the followed view, kept from frame to frame: only its numbers change. */
  private readonly followed: Lens & { k: LensSides } = {
    centre: { x: 0.5, y: 0.5 },
    from: { x: 0.5, y: 0.5 },
    k: { left: 0, right: 0, bottom: 0, top: 0 },
  };

  constructor(
    private readonly container: HTMLElement,
    private readonly worldLayer: Layer,
    private readonly look: BoardLook,
    size: number,
    angles: CameraAngles,
    /** Cells cut out of the board of a level: they are left out of its grid. */
    holes: readonly { x: number; z: number }[] = [],
  ) {
    const values = look.board;
    const n = (name: string): number => Number(values[name] ?? 0);
    this.palette = boardPalette(look);

    const centre = (size - 1) / 2;
    this.target = new THREE.Vector3(centre, 0, centre);
    this.slabHalf = size / 2 + RIM;

    // Writes depth and no colour: what goes under the surface is gone, and what lies behind
    // the board still shows through it. Drawn first, whatever stands where.
    const floorSize = size + FLOOR_MARGIN * 2;
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(floorSize, floorSize), new THREE.MeshBasicMaterial({ colorWrite: false }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.renderOrder = -10;
    // What is under the surface gives no light to the tube either.
    this.floor.layers.enable(GLOW_LAYER);

    const layout: GridLayout = { cells: size, rim: RIM, holes };
    this.layout = layout;
    const gridSize = size + RIM * 2;
    const lines = (map: THREE.Texture): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false });
    this.fill = flat(size, 0.002, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.whole = gridTexture(layout, n('gridLine'), n('gridEdge'));
    this.grid = flat(gridSize, 0.004, lines(this.whole));
    // The surface is drawn before whatever lies on it: the marks of a chain, the frames of the
    // cells beside it, the ring of a group. Left to their distance from the camera, its lines
    // came out over them.
    this.fill.renderOrder = -5;
    this.grid.renderOrder = -4;
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
    // What the board is drawn with is made ready now, while it is not on screen yet: the
    // programs for the glass, the sparks, the ring and the light of the tube would otherwise
    // be built at the first group sent, and hold up the very frame that answers it.
    this.warmed = worldLayer.warm(this.scene, this.camera).then(() => this.rehearse());
  }

  /**
   * Draws the board once with one of everything on it, seen or not, where nobody looks. A
   * graphics card may leave a part of the work on a program until something is first drawn
   * with it, and that part too would hold up a frame of a session.
   */
  private rehearse(): void {
    if (this.disposed) return;
    const unseen: THREE.Object3D[] = [];
    const empty: THREE.InstancedMesh[] = [];
    this.scene.traverse((object) => {
      if (!object.visible) {
        unseen.push(object);
        object.visible = true;
      }
      const instanced = object as THREE.InstancedMesh;
      if (instanced.isInstancedMesh && instanced.count === 0) {
        empty.push(instanced);
        instanced.count = 1;
      }
    });
    // The next frame of the board draws over this one before the layer is shown.
    this.worldLayer.render(this.scene, this.camera, { rect: this.rect });
    this.loose(this.rect);
    this.emit(this.rect);
    for (const object of unseen) object.visible = false;
    for (const mesh of empty) mesh.count = 0;
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
    // The view is picked by the cell of the whole board with nothing over it: words that come
    // and go over the board do not change the view.
    this.wholeCell = cellPixels(fitBoard(this.bounds, aspect, 0, SIDE_MARGIN, FRAME_MARGIN), this.height);
    // After a turn of the screen or a change of view the camera is put on the player at once.
    this.settled = false;
    if (this.mode === 'follow') {
      // The words of the exercise have the top of the stage, and the board is drawn under
      // them: the player, in the middle of it, is never covered. The frame itself goes with
      // the player and is set on every draw.
      const clear = Math.min(this.clear, this.height * FOLLOW_CLEAR);
      this.region = { x: 0, y: clear, width: this.width, height: Math.max(1, this.height - clear) };
      return;
    }
    this.region = { x: 0, y: 0, width: this.width, height: this.height };
    this.lens = null;
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
      } else if (event.type === 'risen') {
        this.cubes.risen(event.cubeId);
      } else if (event.type === 'removed') {
        // A die taken away while it was going - rolled over - is not switched off: what was
        // left of it comes apart into the dots it was drawn through.
        const left = this.still ? null : this.cubes.left(event.cubeId);
        if (left) this.bursts.crumble(left.x, left.z, left.top, left.share, this.dotWorld, left.colour);
      } else if (event.type === 'wiped' && this.endless) {
        // A board left clean: the colours of the picture part for a moment.
        this.chroma = 1;
      }
    }
  }

  /**
   * The board answers a beat: light thrown up from the group, a ring over the surface, the dice
   * around thrown up in a wave from it, the camera shaken. The larger the beat, the larger the
   * answer. On what is rare in a session without end, a chain of three links or more, the
   * colours of the picture part for a moment; past a step of the screen the picture jolts too.
   */
  beat(beat: BoardBeat, state: RunState, reducedMotion: boolean): void {
    const tier = Math.max(0, Math.min(4, Math.round(beat.tier)));
    const screen = this.contact?.screen ?? 0;
    this.tremor = Math.max(this.tremor, BEAT_SHAKE[tier]);
    if (beat.kind === 'chain' && tier >= 2 && state.mode === 'endless') {
      this.chroma = Math.max(this.chroma, Math.min(1, PART_FROM + (tier - 2) * PART_PER_TIER));
    }
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

  /**
   * A level is cleared: its dice go down under the floor, all of them, the way dice come up at
   * the start of a session. The figure goes down with the die it stands on and stays on the floor.
   */
  leaveBoard(): void {
    this.leaving = true;
  }

  /** The board answers the dice that have gone: light runs over its lines in the colour of the face sent last. */
  answer(value: number): void {
    this.flash = 1;
    this.burst = 1;
    if (value >= 1) this.sent = value;
  }

  /** The figure is drawn or left out, until the next board: a board that waits to be started has none on it. */
  showFigure(shown: boolean): void {
    this.player.group.visible = shown;
  }

  /**
   * The surface goes out or comes: only the rows of `bands` of its lines are drawn, and with
   * `dice` the dice of the board are as far here as that says, 0 to 1, gathering the dots of the
   * tube the way a die comes in a session; one that is leaving comes as far as it stands and no
   * further. Null: the board stands, whole. The picture of the rows is drawn anew only when the
   * rows change, a handful of times in a passage, and is let go when the board stands.
   */
  setReveal(bands: GridBands | null, dice: number | null = null): void {
    this.cubes.lay(bands ? dice : null);
    const { material } = this.grid;
    const { cells } = this.layout;
    // All the rows are the picture the surface stands with.
    if (!bands || [bands.edge, bands.lines].every(([from, to]) => from <= 0 && to >= cells)) {
      if (!this.partial) return;
      material.map = this.whole;
      this.partial.map.dispose();
      this.partial = null;
      return;
    }
    const rows = `${bands.edge}|${bands.lines}`;
    if (this.partial?.rows === rows) return;
    const values = this.look.board;
    const line = Number(values.gridLine ?? 0);
    const edge = Number(values.gridEdge ?? 0);
    if (this.partial) {
      redrawGrid(this.partial.map, this.layout, line, edge, bands);
      this.partial.rows = rows;
    } else {
      this.partial = { map: gridTexture(this.layout, line, edge, bands), rows };
      material.map = this.partial.map;
    }
  }

  /** `riseIn` brings the dice and the figure up out of the floor instead of showing them at once. */
  reset(riseIn = false): void {
    this.rise = riseIn ? 1 : 0;
    this.leave = 0;
    this.leaving = false;
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
    this.cubes.reset();
    this.marks.reset();
    this.signs.reset();
    this.springs.reset();
    this.player.reset();
    this.player.group.visible = true;
    this.sinking.clear();
    this.lastStep = null;
    // A new board: the followed view is put on the player where they start.
    this.settled = false;
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
    this.endless = state.mode === 'endless';
    this.still = params.reducedMotion;

    const minute = Math.floor(Date.now() / 60000);
    if (minute !== this.minute) {
      this.minute = minute;
      this.applyPalette();
    }

    const values = this.look.board;
    const n = (name: string): number => Number(values[name] ?? 0);
    const { contact, reducedMotion } = params;

    // The whole board, or the player followed: by the size of a cell, by what the player
    // keeps, by what the address names.
    const forced = VIEWS.includes(String(values.view)) ? (values.view as ViewChoice) : 'auto';
    const mode = viewMode(this.wholeCell, n('minCell'), { forced, whole: params.whole === true, reducedMotion });
    if (mode !== this.mode) {
      this.mode = mode;
      this.resize();
    }

    this.rise = reducedMotion ? 0 : Math.max(0, this.rise - dt / RISE_IN_MS);
    // Fast at first, settling at the end.
    const sunk = this.rise * this.rise;
    if (this.leaving) this.leave = reducedMotion ? 1 : Math.min(1, this.leave + dt / LEAVE_MS);
    // Slow at first, then falling away.
    const gone = this.leave * this.leave * LEAVE_DEPTH;
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

    // A group going down lights what stands around it with the colour of its channel.
    const reaction = this.cubes.sinkingCentre(state);
    // Dice of a level that were leaving when its board was put on have sent nothing here: their light is that of their face all the same.
    if (this.sent === 0 && reaction.count > 0 && state.levelRun) this.sent = state.reactions[0]?.value ?? 0;
    const sent = this.sent > 0 ? this.lit[this.sent - 1] : this.tone;
    const { lamp } = this;
    lamp.x = reaction.x;
    lamp.z = reaction.z;
    lamp.colour.copy(sent);
    lamp.power = (reaction.count > 0 ? 5 + Math.min(reaction.count, 8) * 1.6 + this.burst * 10 : 0) * (1 - this.leave);

    // Past the last step of the contact every die is lit harder for a moment.
    this.cubes.sync(
      state,
      alpha,
      {
        idle: this.flash * step(contact.dice, 1) * 0.9 + breathing + contact.peak * 0.85,
        sinking: 1 + 0.15 * wave(700),
        flash: this.burst,
        lamp,
        dot: this.worldLayer.height / Math.max(1, this.lines),
        dt,
      },
      dip,
    );
    this.player.setColor(figureColour(this.palette, values), n('figureGhost'));
    this.player.sync(state, alpha, dt, dip, (x, z) => this.signs.lift(state, x, z, alpha, dip));
    this.cubes.group.position.y = -sunk - gone;
    this.player.group.position.y -= sunk;
    // The dice of a cleared level go under; the figure comes down with its die and is left standing on the floor.
    if (gone > 0) this.player.group.position.y = Math.max(0, this.player.group.position.y - gone);
    this.marks.group.position.y = -gone;
    this.signs.group.position.y = -gone;
    // The marks of the dice are seen through the floor: they go out as the dice go under it.
    this.marks.group.visible = this.leave < MARKS_GONE_AT;
    this.overlays.sync(state, timeMs, params.overlay, reducedMotion);
    this.marks.sync(state, timeMs, reducedMotion);
    this.signs.sync(state, alpha, timeMs, reducedMotion, dip, this.worldLayer.height / Math.max(1, this.lines), params.ghosts);
    this.warnings.sync(state, dt, timeMs, reducedMotion);

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

    // Past its last step the contact turns the picture inside out for a moment.
    this.inverted = !reducedMotion && contact.peak > 0.72;

    this.camera.position.copy(this.cameraHome);
    // A beat leans the camera in for a moment.
    const zoom = params.shake && !reducedMotion ? 1 + this.punch : 1;
    if (this.mode === 'full' && Math.abs(zoom - this.camera.zoom) > 1e-5) {
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
    // Followed, the view goes after the player; the shake and the lean of a beat stay on top of that.
    const follows = this.mode === 'follow';
    if (follows) this.frameFollowed(dt, zoom);

    // The board is sharp, and is shown on the same tube as the rest of the program: its lines
    // are counted as the program's picture has them, not in the pixels of the board.
    const layer = this.worldLayer;
    const { shell } = this.look;
    // A board seen through the lens is drawn denser than the canvas, the way the lens
    // enlarges it; the lens lies over the part of the layer the board is drawn to.
    if (this.lens) {
      const dense = this.sharpness(layer);
      layer.setDensity(dense.x, dense.y);
    } else {
      layer.setDensity(1);
    }
    layer.look.lens = this.lens?.k ?? 0;
    layer.look.lensFrom = this.lens?.from ?? null;
    layer.look.lensCentre.x = this.lens?.centre.x ?? 0.5;
    layer.look.lensCentre.y = this.lens?.centre.y ?? 0.5;
    this.lines = pictureSize(layer.screen, Number(shell.pixelsTall), Number(shell.pixelsWide)).height;
    layer.look.invert = this.inverted;
    layer.look.scanlines = n('scanlines');
    layer.look.scanlinePitch = this.lines;
    layer.look.vignette = n('vignette');
    // What gives light off on the board has that light spread around it by the tube; its
    // reach is counted in the lines of the tube, like everything of the screen.
    const lit = quality().halo && n('glow') > 0;
    layer.look.halo = n('glow');
    layer.look.haloReach = (n('glowReach') * layer.height) / Math.max(1, this.lines);
    layer.look.haloOver = n('glowOver');
    layer.look.grain = reducedMotion ? 0 : n('grain');
    // The colours part for a moment on a long chain and on a board left clean. The screen,
    // second step: the picture jolts sideways on a large group.
    // The colours part along the lines: counted in the pixels the layer has from side to side.
    const tube = (layer.width / Math.max(1, layer.screen.width)) * (layer.screen.height / Math.max(1, this.lines));
    // At rest they stand a little apart too: the tube was never exact.
    layer.look.chroma = Math.max(reducedMotion ? 0 : this.chroma * n('fringeBeat'), n('fringe')) * tube;
    const jolt = reducedMotion || this.jolt <= 0 ? 0 : Math.round(Math.sin(timeMs / 11) * this.jolt * JOLT_TUBE_PX) * (this.rect.height / Math.max(1, this.lines));
    // The layer stays clear around the board: what lies behind shows.
    const { region } = this;
    const place = follows ? { x: this.rect.x + region.x, y: this.rect.y + region.y, width: region.width, height: region.height } : this.rect;
    const drawn = jolt === 0 ? place : { ...place, x: place.x + jolt };
    // A dot of the tube in cells of the board, for a die that comes apart into them.
    this.dotWorld = (((this.camera.top - this.camera.bottom) / this.camera.zoom / Math.max(1, place.height)) * layer.window.height) / Math.max(1, this.lines);
    layer.render(this.scene, this.camera, { rect: drawn });
    if (this.bursts.flying) this.loose(drawn);
    if (lit) this.emit(drawn);
  }

  /**
   * Draws what is thrown up from the board over the whole window: the board is kept inside its
   * part of it, under the readings of the program, and a spark that flew past the edge of that
   * part was cut off there as if the readings were a wall. The camera sees as much more as the
   * window is larger than the board's part, so every point stays where it was.
   */
  private loose(place: Rect): void {
    const { camera } = this;
    const layer = this.worldLayer;
    const { left, right, top, bottom, zoom } = camera;
    const middle = { x: (left + right) / 2, y: (top + bottom) / 2 };
    const half = { x: (right - left) / 2 / zoom, y: (top - bottom) / 2 / zoom };
    // Cells of the board to a CSS pixel, side to side and top to bottom.
    const per = { x: (half.x * 2) / Math.max(1, place.width), y: (half.y * 2) / Math.max(1, place.height) };
    const { width, height } = layer.window;
    camera.left = middle.x - half.x - place.x * per.x;
    camera.right = middle.x + half.x + (width - place.x - place.width) * per.x;
    camera.top = middle.y + half.y + place.y * per.y;
    camera.bottom = middle.y - half.y - (height - place.y - place.height) * per.y;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    camera.layers.set(FX_LAYER);
    layer.renderOver(this.scene, camera);
    camera.layers.set(0);
    camera.left = left;
    camera.right = right;
    camera.top = top;
    camera.bottom = bottom;
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }

  /**
   * Draws once more, small and alone, what gives light off on the board: the faces on top of
   * the solid dice, their edges, the edges of the glass ones. The surface is in that picture
   * as it is in the large one, hiding what is under it.
   */
  private emit(rect: Rect): void {
    const { camera } = this;
    this.cubes.emitting(true);
    camera.layers.set(GLOW_LAYER);
    this.worldLayer.emit(this.scene, camera, { rect });
    camera.layers.set(0);
    this.cubes.emitting(false);
  }

  /**
   * The followed view for this frame. The view goes after the player as a spring that never
   * swings, and the camera draws what the screen has room for around them. With the lens on,
   * it draws more than that, and the lens presses the picture together towards the edges of
   * the screen. `zoom` is the lean of a beat: everything is drawn that much larger around
   * the player.
   */
  private frameFollowed(dt: number, zoom: number): void {
    const values = this.look.board;
    const n = (name: string): number => Number(values[name] ?? 0);
    const figure = this.player.group.position;
    this.tmp.set(figure.x - this.target.x, FOLLOW_Y, figure.z - this.target.z);
    const goalR = this.tmp.dot(this.cameraRight);
    const goalU = this.tmp.dot(this.cameraUp);
    const { at, speed, camera, region } = this;
    if (this.settled) {
      const r = follow(at.r, speed.r, goalR, dt, n('followMs'));
      const u = follow(at.u, speed.u, goalU, dt, n('followMs'));
      at.r = r.at;
      speed.r = r.speed;
      at.u = u.at;
      speed.u = u.speed;
    } else {
      at.r = goalR;
      at.u = goalU;
      speed.r = 0;
      speed.u = 0;
      this.settled = true;
    }
    const aspect = region.width / region.height;
    // Enlarged as far as a cell under the player needs; a view named in the address is taken
    // with the share it names, to be looked at on any screen.
    const cell = cellPixels(fitBoard(this.bounds, aspect, 0, SIDE_MARGIN, FRAME_MARGIN), region.height);
    const focus = values.view === 'follow' ? n('focus') : followFocus(cell, n('minCell'), n('focus'));
    const frame = followFrame(this.bounds, aspect, focus, n('edge'), n('lens'), at, SIDE_MARGIN, FRAME_MARGIN);
    const point = frame.at;
    camera.left = point.r - frame.left / zoom;
    camera.right = point.r + frame.right / zoom;
    camera.bottom = point.u - frame.down / zoom;
    camera.top = point.u + frame.up / zoom;
    camera.zoom = 1;
    camera.updateProjectionMatrix();

    // The lens, where it is tried, stands over the player and lies over the whole picture:
    // the board and the dice are drawn as they are, and the picture of them is pressed together.
    const { left, right, bottom, top } = frame.lens;
    if (left > 0 || right > 0 || bottom > 0 || top > 0) {
      const lens = this.followed;
      lens.centre.x = frame.centre.x;
      lens.centre.y = frame.centre.y;
      lens.from.x = frame.left / (frame.left + frame.right);
      lens.from.y = frame.down / (frame.down + frame.up);
      Object.assign(lens.k, frame.lens);
      this.lens = lens;
    } else {
      this.lens = null;
    }
    this.enlarged.x = frame.dense.x;
    this.enlarged.y = frame.dense.y;
  }

  /**
   * How many times denser than the canvas a board under the lens is drawn, side to side and
   * top to bottom: as much as the lens enlarges its middle, or the share of that the look asks for.
   */
  private sharpness(layer: Layer): { x: number; y: number } {
    const share = THREE.MathUtils.clamp(Number(this.look.board.sharp ?? 1), 0, 1);
    const { width, height } = layer.screen;
    const one = (enlarged: number, side: number): number =>
      Math.max(1, Math.min(1 + (enlarged - 1) * share, SHARP_MAX, SHARP_SIDE_PX / Math.max(1, side)));
    return { x: one(this.enlarged.x, width), y: one(this.enlarged.y, height) };
  }

  /** World position to CSS pixels inside the container. */
  project(x: number, y: number, z: number): { x: number; y: number } {
    this.tmp.set(x, y, z).project(this.camera);
    let u = (this.tmp.x + 1) / 2;
    let v = (this.tmp.y + 1) / 2;
    // Through the lens a point of the board is not where the camera has it.
    if (this.lens) ({ x: u, y: v } = lensTo(this.lens, u, v));
    const { region } = this;
    return { x: region.x + u * region.width, y: region.y + (1 - v) * region.height };
  }

  /** Frees what the view holds on the graphics card. A view that is replaced is never drawn again. */
  dispose(): void {
    this.observer.disconnect();
    this.disposed = true;
    // Programs that are still being built are let go once they are there: the building looks for them.
    void this.warmed.then(() => this.free());
  }

  private free(): void {
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
    if (this.partial) this.whole.dispose();
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
