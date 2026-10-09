import * as THREE from 'three';
import type { Layer, Rect } from '../display/layer';
import { lensTo, type Lens, type LensSides } from '../display/lens';
import { DELTA, cubeAt, cubeHeight, type Dir, type GameEvent, type MoveKind, type RunState } from '../rules';
import { pictureSize } from '../shell/layout';
import type { Palette } from '../shell/theme';
import { BoardBursts, FX_LAYER, type BoardBeat } from './burst';
import { quality } from '../display/quality';
import { CubeMeshes, GLOW_LAYER, type CubeGlow } from './cubes';
import { FRAME_MARGIN, RIM, SIDE_MARGIN, boardBounds, frameOf, frameOfPiece, shapeKey, sightOf, type BoardShape, type Frame, type Sight } from './board';
import { cellPixels, fitBoard, follow, followFocus, followFrame, viewMode, type FrameBounds, type ViewChoice, type ViewMode } from './framing';
import { gridSegments, waveFrom, type GridSegment } from './gridLines';
import { laidFace } from './laid';
import { LineGrid } from './lineGrid';
import { ChainMarks } from './marks';
import { FloorOverlays, type OverlayOptions } from './overlays';
import { boardPalette, type BoardLook } from './params';
import { passingHeight, type DicePassing } from './passing';
import { PlayerFigure } from './player';
import { ChainSigns } from './signs';
import { CubeSprings } from './springs';
import { figureColour, frameTexture, pipGlow } from './textures';
import { SpawnWarnings } from './warnings';

export type { BoardShape, Frame } from './board';

/** How far past the cells the surface hides what is under it, in cells. */
const FLOOR_MARGIN = 4;
const CAMERA_DISTANCE = 40;
/** How many times its own time a trail is drawn for after the last thing has moved: by then nothing of it is left to see. */
const TRAIL_LASTS = 5;
/** A camera that is this near the frame it travels to, in cells and in cells a millisecond, has come. */
const CAME = 1e-4;
const CAME_SPEED = 1e-6;
const RISE_IN_MS = 600;
/**
 * A camera on its way to a frame is there, to the last of it, when twice the time it was given
 * has gone: over the second half of that what it still carries is taken away smoothly.
 */
const TRAVEL_ENDS = 2;
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
/** What of the camera's sight is carried from one frame to another. */
const GLIDES = ['r', 'u', 'half'] as const;

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

/** A square of the floor, one cell on a side: it is made as large as the board asks by its scale. */
function flat(y: number, material: THREE.MeshBasicMaterial): FlatMesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
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
 *
 * There is one view for the whole game. The board it shows is given to it from outside
 * (`setBoard`): its size, the cells cut out of it, and where it lies in the world. Everything
 * that is drawn by the coordinates of the rules is in one group that is moved there, and the
 * rules know nothing of it; what is asked of the view by those coordinates (`project`) is
 * answered for the board that is on. The frame is given from outside too (`setFrame`), and the
 * camera travels to it: so a board can be laid where the last one ended, and the picture goes
 * from the one to the other without a jump.
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
  /** The camera's axes, for what is counted of a board without the view. */
  private readonly axes = { right: this.cameraRight, up: this.cameraUp };
  /** From what the camera looks at to the camera: the way it is pointed. */
  private readonly offset = new THREE.Vector3();
  /** The middle of the board in the world: what the camera stands over. */
  private readonly target = new THREE.Vector3();
  /** The same on the camera's right and up axes: what the frames of the board are counted from. */
  private readonly base = { r: 0, u: 0 };
  /** The board that is on, and its middle in its own cells. */
  private board: BoardShape;
  private centre = 0;
  /** What is drawn of the board that is on: the surface is made anew only when this changes. */
  private laid = '';
  /** Everything that is drawn by the coordinates of the rules: moved to where the board lies in the world. */
  private readonly world = new THREE.Group();
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
  /** The lines of the surface: the sides of the cells of the board that is on, drawn as far as a wave has come. */
  private readonly grid: LineGrid;
  private readonly frame: FlatMesh;
  /** The sides of the cells of the board that is on, as they are before a wave is sent through them. */
  private sides: GridSegment[] = [];
  /**
   * How much of the lines is drawn, 0 to 1; whether they are being drawn or erased; and the
   * cell the wave starts from, in the cells of the board that is on, null until one is named.
   */
  private readonly wave: { share: number; drawing: boolean; from: { x: number; z: number } | null } = { share: 1, drawing: true, from: null };
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
  /** How long the trail of what has moved is still drawn, in milliseconds. */
  private trailLeft = 0;
  /** How the dice stand in a passage between two boards; null outside one: they stand as the rules have them. */
  private passing: DicePassing | null = null;
  /** Counts the changes of the window the board is fitted to: its size, and the room kept at its top. */
  private fits = 0;
  /** Size of a cell with the whole board in view, in CSS pixels: what the view is picked by. */
  private wholeCell = 0;
  /** The frame asked for from outside; null: the frame the board that is on is in whole, kept through every change of the window. */
  private asked: Frame | null = null;
  /** With the whole board in view: what the camera is to show, counted from the target. */
  private readonly goal: Sight = { r: 0, u: 0, half: 1 };
  /** What the camera showed on the last frame drawn, on its axes from the middle of the world; `seen` once a frame has been drawn. */
  private readonly sight: Sight = { r: 0, u: 0, half: 1 };
  private seen = false;
  /**
   * How far the camera still is from what it is to show, and how fast that changes: a frame
   * given with a time is not jumped to. What was on screen is carried over as this difference,
   * and the difference goes to nothing as a spring that never swings, whichever way the view
   * frames the board and wherever the player goes meanwhile.
   */
  private readonly carry: Sight = { r: 0, u: 0, half: 0 };
  /** The same as the spring alone has it, and how fast it changes: `carry` is this, brought to nothing in the end. */
  private readonly sprung: Sight = { r: 0, u: 0, half: 0 };
  private readonly pace: Sight = { r: 0, u: 0, half: 0 };
  private carried = false;
  /** The time the camera is given to come to a frame, how long it has been on its way, and whether what is on screen is still to be taken as the carry. */
  private travelMs = 0;
  private travelled = 0;
  private taking = false;
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
    this.palette = boardPalette(look);

    // Writes depth and no colour: what goes under the surface is gone, and what lies behind
    // the board still shows through it. Drawn first, whatever stands where.
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ colorWrite: false }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.renderOrder = -10;
    // What is under the surface gives no light to the tube either.
    this.floor.layers.enable(GLOW_LAYER);

    // The lines and the picture of the frame are made when the board is laid, below.
    const sheet = (): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.fill = flat(0.002, sheet());
    this.grid = new LineGrid(look);
    this.grid.object.position.y = 0.004;
    // The surface is drawn before whatever lies on it: the marks of a chain, the frames of the
    // cells beside it, the ring of a group. Left to their distance from the camera, its lines
    // came out over them. The lines come first of all, onto nothing: where two of them meet
    // they are put together by the stronger, which is right only with nothing under them; the
    // floor of the cells is one colour with them and lies over them as well as under.
    this.grid.object.renderOrder = -5;
    this.fill.renderOrder = -4;
    this.frame = flat(0.01, sheet());
    this.world.add(this.floor, this.fill, this.grid.object, this.frame);
    this.board = { size, holes, origin: { x: 0, z: 0 } };
    this.lay(this.board);

    this.cubes = new CubeMeshes(this.palette, values);
    this.overlays = new FloorOverlays(values);
    this.marks = new ChainMarks(values);
    this.signs = new ChainSigns(values);
    this.warnings = new SpawnWarnings(values);
    this.world.add(
      this.overlays.group,
      this.marks.group,
      this.signs.group,
      this.warnings.group,
      this.cubes.group,
      this.player.group,
      this.bursts.group,
    );
    this.scene.add(this.world);
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
    this.offset.copy(offset);
    this.stand();
  }

  /** The board that is on. */
  get shape(): BoardShape {
    return this.board;
  }

  /**
   * Puts another board on: its size, the cells cut out of it, and where its cell (0, 0) lies in
   * the world. The view stays the one it is; only the surface is made anew, and only when the
   * board is of another size or cut: its lines are then whole, whatever was drawn of the lines
   * of the board before, until `drawGrid` says otherwise. The camera stands over the new board
   * and shows what it showed until a frame is given (`setFrame`); the frame that was asked for
   * stays asked for.
   */
  setBoard(shape: BoardShape): void {
    this.lay(shape);
    this.stand();
  }

  /**
   * The frame a board is in whole on this window as it is now: what the view shows of a board
   * by itself. It is counted from where the board lies, so the frames of boards laid one after
   * another are frames of one world.
   */
  frameOf(shape: BoardShape): Frame {
    return frameOf(shape, this.axes, this.width, this.height, this.clear);
  }

  /**
   * The frame a piece of the road is in on this window as it is now: fitted by the cells that
   * are left of its square, with the cell of whichever of the boards it is seen at one scale
   * with (`together`) fits smallest (`frameOfPiece`).
   */
  frameOfPiece(shape: BoardShape, together: readonly { size: number; holes?: BoardShape['holes'] }[]): Frame {
    return frameOfPiece(shape, together, this.axes, this.width, this.height, this.clear);
  }

  /**
   * What the camera is to show, and how long it is given to come to it: after `ms` it has
   * covered nine tenths of the way, as the followed view does after the player; with 0, or with
   * motion kept low, it is put there at once. Null is the frame the board that is on is in whole,
   * and it is kept so through every change of the window; a frame given is kept as it is given,
   * and is to be given again by whoever counted it when the window changes.
   *
   * With the whole board in view the camera shows the frame as it is given. Whether the player
   * is followed instead is picked by the cell of the frame, so boards that are given one scale
   * are seen one way; followed, the player is where the view goes and the frame only names the
   * scale: every board is then seen with a cell of the size the followed view asks for, a small
   * one too. Either way the camera travels from what was on screen to what it is to show, so a
   * board put on with a frame and a time is never jumped to. The way is a spring that never
   * swings, and it has an end: when twice the time given has gone, the camera shows the frame
   * and nothing else.
   *
   * With the whole board in view what was on screen is taken over here, at once: a place asked
   * of the view (`project`) before the next frame is drawn is where it is on screen. Followed,
   * the view is counted from the figure as the next frame draws it, and what was on screen is
   * taken over then.
   */
  setFrame(frame: Frame | null, ms: number): void {
    this.asked = frame ? { x: frame.x, z: frame.z, cell: frame.cell } : null;
    this.travelMs = ms;
    this.taking = ms > 0 && this.seen;
    if (!this.taking) this.arrive();
    this.resize();
    if (this.taking && this.mode === 'full') {
      this.take(this.goal.r, this.goal.u, this.goal.half);
      this.aim();
      // The next frame drawn takes it over again, the same, or anew if the board is followed by then.
      this.taking = true;
    }
  }

  /**
   * The frame that was asked for, counted anew by whoever counted it, after the window has
   * changed (`fitted`): the camera goes on from where it is on its way.
   */
  refit(frame: Frame): void {
    this.asked = { x: frame.x, z: frame.z, cell: frame.cell };
    this.resize();
  }

  /** A number that changes whenever the window the board is fitted to does: a frame counted for the window before is to be counted again. */
  get fitted(): number {
    return this.fits;
  }

  /**
   * How the dice stand in a passage between two boards, die by die; null: as the rules have
   * them. The object is read on every frame drawn and is its owner's to change. While one is
   * given the marks and signs of the dice that are going are not drawn: nothing can be added
   * to a combo of a board that is passed, and a board that comes has no die on it yet.
   */
  setPassing(passing: DicePassing | null): void {
    this.passing = passing;
  }

  /** A die of a board that comes stands: it settles as a die that has just come up does. */
  stood(cubeId: number): void {
    this.cubes.risen(cubeId);
  }

  /** Lays the board in the world: the surface is given its size and its lines, and the group of the rules is moved to it. */
  private lay(shape: BoardShape): void {
    const { size, origin } = shape;
    const centre = (size - 1) / 2;
    this.board = { size, holes: shape.holes, origin: { x: origin.x, z: origin.z } };
    this.centre = centre;
    this.world.position.set(origin.x, 0, origin.z);
    this.target.set(origin.x + centre, 0, origin.z + centre);
    const key = shapeKey(shape);
    if (key === this.laid) return;
    this.laid = key;

    const floorSize = size + FLOOR_MARGIN * 2;
    const gridSize = size + RIM * 2;
    this.floor.scale.set(floorSize, floorSize, 1);
    this.fill.scale.set(size, size, 1);
    this.frame.scale.set(gridSize, gridSize, 1);
    for (const mesh of [this.floor, this.fill, this.frame]) {
      mesh.position.x = centre;
      mesh.position.z = centre;
    }

    // The lines of the board that was on are let go, and whatever was drawn of them: these are whole.
    this.sides = gridSegments(size, shape.holes);
    this.grid.set(this.sides);
    this.wave.share = 1;
    this.wave.drawing = true;
    this.wave.from = null;
    this.frame.material.map?.dispose();
    this.frame.material.map = frameTexture({ cells: size, rim: RIM, holes: shape.holes });
  }

  /**
   * How much of the lines of the board is there, 0 to 1, and which way it is going: with
   * `drawing` they are being drawn, as a wave from the cell `from` - the sides of that cell
   * first, then on from its corners along the lines of the board, each by a bright point that
   * runs along it and parts at every corner, the farthest whole at 1; without it
   * they are being erased, the same run backwards: the farthest first, the point running
   * towards the cell, the sides of the cell last, nothing at 0. `from` is a cell of the board
   * that is on, in the coordinates of its rules: the player's; it is kept until another is
   * named or another board is put on, and a wave that starts from another cell is counted once,
   * here, not while it runs. Until this is called a board has all its lines: `drawGrid(1, true)`.
   *
   * The share is the wave's, not a time: whoever calls this gives it elapsed / `drawMs` (or 1 -
   * elapsed / `eraseMs`) on every frame. The wave has one part for every side on its longest
   * way and one for the cell (`gridParts`), and a side is drawn in one part; at
   * 1 / `gridParts` the cell the wave starts from stands whole and alone.
   */
  drawGrid(share: number, drawing: boolean, from?: { x: number; z: number }): void {
    const { wave } = this;
    if (from && (!wave.from || wave.from.x !== from.x || wave.from.z !== from.z)) {
      wave.from = { x: from.x, z: from.z };
      this.grid.set(waveFrom(this.sides, wave.from));
    }
    wave.share = Math.min(1, Math.max(0, share));
    wave.drawing = drawing;
  }

  /** How many equal parts the wave of the lines has from the cell it starts from: a side is drawn in one of them. */
  get gridParts(): number {
    return this.grid.reach + 1;
  }

  /** Stands the camera over the board, pointed as it is, and counts what of the board has to fit. */
  private stand(): void {
    this.cameraHome.copy(this.target).add(this.offset);
    this.camera.position.copy(this.cameraHome);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    this.cameraRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.cameraUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.base.r = this.target.dot(this.cameraRight);
    this.base.u = this.target.dot(this.cameraUp);
    this.bounds = boardBounds(this.board.size, this.axes);
    this.resize();
  }

  /**
   * Keeps the top `pixels` of the stage free of the floor: the board moves down where the
   * screen has height to spare and is drawn smaller where it has none.
   */
  setClear(pixels: number): void {
    if (pixels === this.clear) return;
    this.clear = pixels;
    this.fits++;
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
    const width = Math.max(1, box.width);
    const height = Math.max(1, box.height);
    if (width !== this.width || height !== this.height) this.fits++;
    this.width = width;
    this.height = height;
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
    const { goal } = this;
    if (this.asked) {
      const sight = sightOf(this.asked, this.axes, this.height);
      goal.r = sight.r - this.base.r;
      goal.u = sight.u - this.base.u;
      goal.half = sight.half;
    } else {
      const { halfHeight, centreR, centreU } = fitBoard(
        this.bounds,
        aspect,
        this.clear / this.height,
        SIDE_MARGIN,
        FRAME_MARGIN,
      );
      goal.r = centreR;
      goal.u = centreU;
      goal.half = halfHeight;
    }
    this.aim();
  }

  /** With the whole board in view: the camera shows what it is to show, with what it still carries from before. */
  private aim(): void {
    const { camera, goal, carry } = this;
    const r = goal.r + carry.r;
    const u = goal.u + carry.u;
    const half = goal.half + carry.half;
    const aspect = this.width / this.height;
    camera.top = u + half;
    camera.bottom = u - half;
    camera.left = r - half * aspect;
    camera.right = r + half * aspect;
    camera.updateProjectionMatrix();
  }

  /** The camera is where it is to be: it carries nothing over. */
  private arrive(): void {
    const { carry, sprung, pace } = this;
    carry.r = carry.u = carry.half = 0;
    sprung.r = sprung.u = sprung.half = 0;
    pace.r = pace.u = pace.half = 0;
    this.carried = false;
    this.taking = false;
  }

  /** What was on screen is taken over as what the camera carries on its way to what it is to show: `r`, `u` and `half`, counted from the target. */
  private take(r: number, u: number, half: number): void {
    const { carry, sprung, pace, sight, base } = this;
    this.taking = false;
    sprung.r = carry.r = sight.r - (base.r + r);
    sprung.u = carry.u = sight.u - (base.u + u);
    sprung.half = carry.half = sight.half - half;
    pace.r = pace.u = pace.half = 0;
    this.travelled = 0;
    this.carried = true;
  }

  /**
   * One frame of the camera's way to what it is to show: the middle of the picture and half its
   * height, on the camera's axes from the target. A frame just given with a time takes what was
   * on screen as the carry; after that the carry goes to nothing. Says whether the carry has
   * changed, and notes what the camera shows now.
   */
  private glide(dt: number, r: number, u: number, half: number, still: boolean): boolean {
    const { carry, sprung, pace, sight, base } = this;
    let moved = false;
    if (still) {
      moved = this.carried;
      this.arrive();
    } else if (this.taking) {
      this.take(r, u, half);
      moved = true;
    } else if (this.carried) {
      this.travelled += dt;
      // Past the time given, what the spring still has is taken away, all of it by twice that time.
      const over = Math.min(1, Math.max(0, this.travelled / Math.max(1, this.travelMs) - 1) / (TRAVEL_ENDS - 1));
      const kept = 1 - over * over * (3 - 2 * over);
      let far = false;
      for (const key of GLIDES) {
        const next = follow(sprung[key], pace[key], 0, dt, this.travelMs);
        sprung[key] = next.at;
        pace[key] = next.speed;
        carry[key] = next.at * kept;
        far ||= Math.abs(carry[key]) > CAME || (kept >= 1 && Math.abs(next.speed) > CAME_SPEED);
      }
      if (!far || kept <= 0) this.arrive();
      moved = true;
    }
    sight.r = base.r + r + carry.r;
    sight.u = base.u + u + carry.u;
    sight.half = half + carry.half;
    this.seen = true;
    return moved;
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
    // Boards that are given one frame are seen one way: by the cell of that frame.
    const mode = viewMode(this.asked?.cell ?? this.wholeCell, n('minCell'), { forced, whole: params.whole === true, reducedMotion });
    if (mode !== this.mode) {
      this.mode = mode;
      this.resize();
    }

    this.rise = reducedMotion ? 0 : Math.max(0, this.rise - dt / RISE_IN_MS);
    // Fast at first, settling at the end.
    const sunk = this.rise * this.rise;
    const { passing } = this;
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
    // A die the board of a level was laid with as leaving has sent nothing here: its light is that of its face all the same.
    const face = this.sent > 0 || reaction.count === 0 ? this.sent : laidFace(state);
    const sent = face > 0 ? this.lit[face - 1] : this.tone;
    const { lamp } = this;
    // The lamp is a place in the world, where the dice are drawn.
    lamp.x = reaction.x + this.board.origin.x;
    lamp.z = reaction.z + this.board.origin.z;
    lamp.colour.copy(sent);
    // The light of a combo that has cleared its board goes out as the first of its dice goes under; a board that comes throws none.
    const left = !passing ? 1 : passing.mode === 'come' ? 0 : 1 - Math.min(1, Math.max(0, passing.moveMs / Math.max(1, passing.moveForMs)));
    lamp.power = (reaction.count > 0 ? 5 + Math.min(reaction.count, 8) * 1.6 + this.burst * 10 : 0) * left;

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
        combo: n('comboGlow'),
        comboBody: n('glowThreshold') > 0,
        comboMs: n('comboBlinkMs'),
      },
      dip,
      passing,
    );
    this.player.setColor(figureColour(this.palette, values), n('figureGhost'), { body: n('figureBody'), rim: n('figureRim'), shine: n('figureShine') });
    this.player.sync(state, alpha, dt, dip, (x, z) => this.signs.lift(state, x, z, alpha, dip));
    // In a passage the figure stands on its die as the passage has it: it comes down to the
    // floor with a die that goes under, and a die that comes up under it lifts it.
    if (passing && player.level === 'top' && !player.action) {
      const own = cubeAt(state, player.x, player.z);
      const rank = own ? passing.ranks.get(own.id) : undefined;
      if (own && rank !== undefined) this.player.standAt(Math.max(0, passingHeight(passing, rank, cubeHeight(own, state.config)) + dip(own.id)));
    } else if (passing && player.level === 'ground') {
      // Off the dice it is on the floor of a board that comes, and comes down to the floor of one whose dice go, from a shelf if it stood on one.
      const gone = passing.mode === 'come' ? 1 : Math.min(1, Math.max(0, passing.moveMs / Math.max(1, passing.moveForMs)));
      this.player.standAt(this.player.group.position.y * (1 - gone * gone));
    }
    this.cubes.group.position.y = -sunk;
    this.player.group.position.y -= sunk;
    // Nothing is added to a combo that has cleared its board, and a board that comes has no die on it yet: neither is marked.
    this.marks.group.visible = !passing;
    this.signs.group.visible = !passing;
    this.overlays.sync(state, timeMs, params.overlay, reducedMotion);
    this.marks.sync(state, timeMs, reducedMotion);
    this.signs.sync(state, alpha, timeMs, reducedMotion, dip, this.worldLayer.height / Math.max(1, this.lines), params.ghosts);
    this.warnings.sync(state, dt, timeMs, reducedMotion);

    // The surface: a group sent runs over the lines, then the lines pulse by themselves, then
    // the run takes the colour of the group.
    const run = this.flash * step(contact.grid, 1);
    this.grid.opacity = Math.min(1, n('gridBright') * (1 + 0.3 * wave(5200) * step(contact.grid, 2)) + run * 0.5);
    this.grid.colour.copy(this.tone).lerp(sent, run * step(contact.grid, 3)).lerp(this.red, 0.35 * step(contact.red, 2));
    this.grid.show(this.wave.share, this.wave.drawing, timeMs);
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
    if (follows) this.frameFollowed(dt, zoom, reducedMotion);
    else if (this.glide(dt, this.goal.r, this.goal.u, this.goal.half, reducedMotion)) this.aim();

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
    // The light is taken from what is bright in the picture, or drawn alone for it: see `glowThreshold`.
    const bright = n('glowThreshold') > 0;
    layer.look.haloThreshold = n('glowThreshold');
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
    if (this.bursts.thrown || this.grid.heads.visible) this.loose(drawn);
    // The frame before stays under this one for a moment, as the consoles of the last years of
    // the tube drew a frame over the one before: what moves leaves a trail. It is short while
    // the board is played, and long where the board comes and where a combo is taken. Not
    // where motion is asked to be less.
    const event = this.rise > 0 || passing ? 1 : Math.min(1, this.burst);
    const trailMs = reducedMotion ? 0 : n('trailMs') + Math.max(0, n('trailPeakMs') - n('trailMs')) * event;
    // A picture in which nothing moves fast has no trail to draw, and is not drawn a second time
    // for one: only while the figure steps or a die rolls, and until the last of what they left
    // has gone. A die that comes up or goes down is too slow to leave one: in a session without
    // end some die always does, and the trail would be drawn on every frame for nothing.
    const moving = event > 0 || Boolean(state.player.action) || this.bursts.thrown || state.cubes.some((cube) => cube.state === 'moving');
    if (moving && trailMs > 0) this.trailLeft = trailMs * TRAIL_LASTS;
    else this.trailLeft = Math.max(0, this.trailLeft - dt);
    if (trailMs > 0 && this.trailLeft > 0) layer.trail(Math.exp(-Math.max(1, dt) / trailMs));
    else layer.dropTrail();
    if (lit && !bright) this.emit(drawn);
  }

  /**
   * Draws what is thrown from the board, the sparks of a group and its ring, and the points of
   * light that draw its lines, over the whole window: the board is kept inside its part of it, under the readings of the program or beside
   * them, and light that went past the edge of that part was cut off there as if the readings
   * were a wall. The camera sees as much more as the window is larger than the board's part, so
   * every point stays where it was. What the board has drawn is still there, depth and all: a
   * die that stands in front of a ring hides it, as it did.
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
   * the player. A frame given with a time is come to from what was on screen, like any other:
   * what is carried over moves and scales the window, and goes to nothing.
   */
  private frameFollowed(dt: number, zoom: number, still: boolean): void {
    const values = this.look.board;
    const n = (name: string): number => Number(values[name] ?? 0);
    const figure = this.player.group.position;
    this.tmp.set(figure.x - this.centre, FOLLOW_Y, figure.z - this.centre);
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
    // Boards that are given one frame are seen at one scale: a small one is not enlarged past it.
    const most = this.asked ? Infinity : 1;
    const focus = values.view === 'follow' ? n('focus') : followFocus(cell, n('minCell'), n('focus'), most);
    const frame = followFrame(this.bounds, aspect, focus, n('edge'), n('lens'), at, SIDE_MARGIN, FRAME_MARGIN);
    const point = frame.at;
    // The middle of the window from the player, and half its height: what is come to.
    const midR = (frame.right - frame.left) / 2;
    const midU = (frame.up - frame.down) / 2;
    const half = (frame.up + frame.down) / 2;
    this.glide(dt, point.r + midR, point.u + midU, half, still);
    // With nothing carried over the window is larger by 1 and moved by 0: it is the window of the player.
    const { carry } = this;
    const larger = (half + carry.half) / half;
    const movedR = carry.r + midR * (1 - larger);
    const movedU = carry.u + midU * (1 - larger);
    camera.left = point.r + movedR - (frame.left * larger) / zoom;
    camera.right = point.r + movedR + (frame.right * larger) / zoom;
    camera.bottom = point.u + movedU - (frame.down * larger) / zoom;
    camera.top = point.u + movedU + (frame.up * larger) / zoom;
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

  /** A place on the board that is on, in the coordinates of its rules, to CSS pixels inside the container. */
  project(x: number, y: number, z: number): { x: number; y: number } {
    const { origin } = this.board;
    this.tmp.set(x + origin.x, y, z + origin.z).project(this.camera);
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
    for (const mesh of [this.fill, this.frame]) {
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
    this.grid.dispose();
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
