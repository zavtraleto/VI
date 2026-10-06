import * as THREE from 'three';
import { DELTA, DIRS, cubeAt, cubeHeight, inChain, isDock, isHeld, isStep, worldRuns, type Cube, type RunState } from '../rules';
import type { ParamValues } from '../signal/scene';
import type { Palette } from '../shell/theme';
import { CUBE_SIZE } from './cubes';
import { LIGHT } from './light';
import { socketTexture } from './textures';

/** Most signs there can be at one height: one on every cell of the largest board. */
const MAX_DOCKS = 9 * 9;
/**
 * Under this height the shelf at the top of a chain fades into the floor. The two are about to
 * meet there, and a shelf that all but lies on the floor says nothing the floor does not.
 */
const RAISED_FADE = 0.5;
/** How long the sign of a cell takes to come, and to go out: nothing on the board is switched off. */
const DOCK_IN_MS = 120;
const DOCK_OUT_MS = 280;
/**
 * A shelf is shown over every free cell of the zone when the cell comes into it, for this
 * long: that is where the zone is. After that only the shelves the player can use stay.
 */
const SHELF_SHOW_MS = 900;
const SHELF_IN_MS = 140;
const SHELF_OUT_MS = 420;
/** How wide the line around a shelf is, as a share of the cell, and what its dots keep of the light of that line. */
const SHELF_LINE = 0.03;
const SHELF_FILL = 0.6;

/** The sign of a cell beside a chain: what it is, and how much of it is here, 0 to 1. */
interface Dock {
  value: number;
  /** How high its shelf lies; 0 where it has none. */
  lift: number;
  /** When the cell came into the zone. */
  born: number;
  here: number;
  /** How much of its shelf is here. */
  shelf: number;
  wanted: boolean;
  /** The shelf is shown: the zone has just come to the cell, or the player can use it. */
  shelved: boolean;
}

/**
 * How much of a die is above the floor. A die held by the tutorial stays put between ticks,
 * and so does one on a level whose world stands.
 */
const heightOf = (state: RunState, cube: Cube, alpha: number): number =>
  cubeHeight(cube, state.config, isHeld(state, cube) || !worldRuns(state) ? 0 : alpha);

/** Where the top face of a die that high is, before the dip a step or a weight makes in it. */
const faceAt = (height: number): number => height - 0.5 + CUBE_SIZE / 2;

const SHELF_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;

void main() {
  vUv = uv;
  vTint = instanceColor;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

/**
 * A shelf: a thin line around the cell and, inside it, a few of the dots of the tube - the
 * mesh a die that is not all here is drawn through, far thinner. A thing to stand on that is
 * hardly there, and the board under it still reads.
 */
const SHELF_FRAGMENT = /* glsl */ `
uniform float uDot;
uniform float uCover;
uniform float uStrength;

varying vec2 vUv;
varying vec3 vTint;

const float MESH[16] = float[16](
  0.0, 8.0, 2.0, 10.0,
  12.0, 4.0, 14.0, 6.0,
  3.0, 11.0, 1.0, 9.0,
  15.0, 7.0, 13.0, 5.0
);

void main() {
  float border = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float px = length(fwidth(vUv)) * 0.7071;
  float line = 1.0 - smoothstep(${SHELF_LINE.toFixed(3)} - px, ${SHELF_LINE.toFixed(3)} + px, border);
  vec2 spot = floor(gl_FragCoord.xy / uDot);
  int at = int(mod(spot.x, 4.0)) + int(mod(spot.y, 4.0)) * 4;
  float dots = (MESH[at] + 0.5) / 16.0 > uCover ? 0.0 : ${SHELF_FILL.toFixed(2)};
  gl_FragColor = vec4(vTint * (max(line, dots) * uStrength), 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * The zone of a combo: what a chain that is still open looks like on the board, apart from the
 * marks on its own cells. Its two signs say two things, and are two shapes.
 *
 * Four corners on the floor of every free cell beside the chain: a socket, the place a die is
 * brought to. They do not pulse and are not a frame.
 *
 * A shelf at the height of the top of the chain's dice, level with their top face as it is
 * drawn and coming down with them: where the docks are steps, the cell is walked on from up
 * there. The corners under it are what holds its height for the eye. It is shown over every
 * free cell when the zone comes to it, and then stays only where the player's next step can
 * use it, or where they stand.
 *
 * Both come and go out over a moment: nothing here is switched on or off. How long there is,
 * is read off the dice themselves.
 */
export class ChainSigns {
  readonly group = new THREE.Group();
  /** The corners on the floor: one draw for all of them, each in the colour of its chain. */
  private readonly docks: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** The shelves at the height of the top of the chain's dice. */
  private readonly raised: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly shelf = { uDot: { value: 4 }, uCover: { value: 0.25 }, uStrength: { value: 1 } };
  /** How high the top of the chain is beside a cell: the highest of its dice there. */
  private readonly tops = new Map<number, number>();
  private readonly dockColours: THREE.Color[] = [];
  private readonly cells = new Map<number, number>();
  /** The signs now on the board, those going out among them, by cell. */
  private readonly held = new Map<number, Dock>();
  private lastTime = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly at = new THREE.Vector3();
  private readonly whole = new THREE.Vector3(1, 1, 1);
  private readonly upright = new THREE.Quaternion();
  private readonly colour = new THREE.Color();

  constructor(private readonly values: ParamValues) {
    const lying = new THREE.PlaneGeometry(1, 1);
    lying.rotateX(-Math.PI / 2);
    this.docks = new THREE.InstancedMesh(lying, new THREE.MeshBasicMaterial({ ...LIGHT, map: socketTexture() }), MAX_DOCKS);
    this.docks.count = 0;
    this.docks.frustumCulled = false;
    // Before the see-through dice, as the marks of the chain are.
    this.docks.renderOrder = -1;
    // The colours are there from the start: the program for them is built with the board.
    this.docks.setColorAt(0, this.colour.set(0, 0, 0));
    this.group.add(this.docks);
    // Up at the height of the dice the shelves are drawn after them: a die that stands behind a
    // shelf shows through its light, and one in front hides it.
    this.raised = new THREE.InstancedMesh(
      lying,
      new THREE.ShaderMaterial({ ...LIGHT, uniforms: this.shelf, vertexShader: SHELF_VERTEX, fragmentShader: SHELF_FRAGMENT }),
      MAX_DOCKS,
    );
    this.raised.count = 0;
    this.raised.frustumCulled = false;
    this.raised.renderOrder = 3;
    this.raised.setColorAt(0, this.colour.set(0, 0, 0));
    this.group.add(this.raised);
  }

  setPalette(palette: Palette): void {
    // The light of a chain is the colour of its channel; the one is not a channel, and its light is red.
    for (let i = 0; i < 6; i++) this.dockColours[i] = new THREE.Color(i === 0 ? palette.signal : palette.channels[i]);
  }

  /** A new board: no sign of the one before is left going out on it. */
  reset(): void {
    this.held.clear();
  }

  /** `dot` is the size of a dot of the tube, in pixels of the picture: what a shelf is made of. */
  sync(
    state: RunState,
    alpha: number,
    timeMs: number,
    reducedMotion: boolean,
    dip: (cubeId: number) => number,
    dot: number,
    ghosts: readonly { x: number; z: number; value: number }[] = [],
  ): void {
    const n = (name: string): number => Number(this.values[name] ?? 0);
    const { size } = state.config;
    const dt = this.lastTime === 0 ? 0 : Math.min(100, Math.max(0, timeMs - this.lastTime));
    this.lastTime = timeMs;
    this.cells.clear();
    this.tops.clear();

    // Nothing joins a finished group in a puzzle.
    if (!state.puzzle) {
      for (const cube of state.cubes) {
        if (!inChain(cube)) continue;
        const value = cube.ori.top;
        // The top face where it is drawn: a die the player weighs on stands lower.
        const face = faceAt(heightOf(state, cube, alpha)) + dip(cube.id);
        for (const dir of DIRS) {
          const x = cube.x + DELTA[dir].dx;
          const z = cube.z + DELTA[dir].dz;
          if (x < 0 || z < 0 || x >= size || z >= size) continue;
          const cell = x + z * size;
          if (!this.cells.has(cell)) this.cells.set(cell, value);
          this.tops.set(cell, Math.max(this.tops.get(cell) ?? 0, face));
        }
      }
      // A cell where a standing die is takes no die: it has no sign.
      for (const cell of [...this.cells.keys()]) if (!isDock(state, cell % size, Math.floor(cell / size))) this.cells.delete(cell);
      // A cell a die of the chain stood on until it was rolled over keeps the sign of the chain: the die is
      // gone at once, and its place in the group is not.
      for (const ghost of ghosts) this.cells.set(ghost.x + ghost.z * size, ghost.value);
    }

    // With the steps of the docks a free cell beside a chain is walked on from the top of its
    // dice as well as from the floor: it has a shelf up there, which comes down with them.
    const upper = state.config.experiments.dockSteps ? n('dockTop') : 0;
    const { player } = state;
    for (const dock of this.held.values()) dock.wanted = false;
    for (const [cell, value] of this.cells) {
      const x = cell % size;
      const z = Math.floor(cell / size);
      let dock = this.held.get(cell);
      if (!dock) {
        dock = { value, lift: 0, born: timeMs, here: 0, shelf: 0, wanted: true, shelved: false };
        this.held.set(cell, dock);
      }
      const free = isDock(state, x, z);
      dock.value = value;
      dock.wanted = true;
      dock.lift = upper > 0 && free ? (this.tops.get(cell) ?? 0) : 0;
      // The zone has just come to the cell; or the player's next step can use it; or they stand on it.
      const stood = player.level !== 'top' && player.x === x && player.z === z;
      dock.shelved = dock.lift > 0 && (timeMs - dock.born < SHELF_SHOW_MS || isStep(state, x, z) || stood);
    }
    for (const [cell, dock] of this.held) {
      // A sign that goes out stays where it lay, as it was, while it does.
      if (!dock.wanted) dock.shelved = false;
      if (reducedMotion) {
        dock.here = dock.wanted ? 1 : 0;
        dock.shelf = dock.shelved ? 1 : 0;
      } else {
        dock.here = Math.min(1, Math.max(0, dock.here + (dock.wanted ? dt / DOCK_IN_MS : -dt / DOCK_OUT_MS)));
        dock.shelf = Math.min(1, Math.max(0, dock.shelf + (dock.shelved ? dt / SHELF_IN_MS : -dt / SHELF_OUT_MS)));
      }
      if (!dock.wanted && dock.here <= 0) this.held.delete(cell);
    }

    // The corners do not pulse: they are a place, not a call. The shelves keep the pulse of the chain.
    this.docks.material.opacity = n('dockBright');
    this.shelf.uDot.value = Math.max(1, dot);
    this.shelf.uCover.value = n('shelfDots');
    this.shelf.uStrength.value = upper * (reducedMotion ? 1 : 0.8 + 0.2 * Math.sin((timeMs / 700) * Math.PI * 2));
    let docks = 0;
    let raised = 0;
    for (const [cell, dock] of this.held) {
      const x = cell % size;
      const z = Math.floor(cell / size);
      docks = this.lay(this.docks, docks, x, 0.012, z, dock.value, dock.here);
      const shelf = dock.here * dock.shelf * Math.min(1, dock.lift / RAISED_FADE);
      if (dock.lift > 0 && shelf > 0) raised = this.lay(this.raised, raised, x, dock.lift, z, dock.value, shelf);
    }
    this.show(this.docks, n('dockBright') > 0 ? docks : 0);
    this.show(this.raised, upper > 0 ? raised : 0);
  }

  /**
   * How high the shelf of a cell lies: at the top face of the highest die of the chain beside
   * it, where that face is drawn. Nought where there is none. The one who plays stands on it,
   * not on the floor under it: from the shelf the next die is one step away, as it is from a die.
   */
  lift(state: RunState, x: number, z: number, alpha: number, dip: (cubeId: number) => number): number {
    const n = (name: string): number => Number(this.values[name] ?? 0);
    if (!state.config.experiments.dockSteps || n('dockTop') <= 0) return 0;
    if (!isDock(state, x, z)) return 0;
    let lift = 0;
    for (const dir of DIRS) {
      const cube = cubeAt(state, x + DELTA[dir].dx, z + DELTA[dir].dz);
      if (cube && inChain(cube)) lift = Math.max(lift, faceAt(heightOf(state, cube, alpha)) + dip(cube.id));
    }
    return lift;
  }

  /** Lays the sign of a cell at a height, as much of it as is here. Returns how many signs the mesh holds after that. */
  private lay(mesh: THREE.InstancedMesh, count: number, x: number, y: number, z: number, value: number, strength: number): number {
    if (count >= MAX_DOCKS) return count;
    this.at.set(x, y, z);
    mesh.setMatrixAt(count, this.matrix.compose(this.at, this.upright, this.whole));
    mesh.setColorAt(count, this.colour.copy(this.dockColours[value - 1]).multiplyScalar(strength));
    return count + 1;
  }

  private show(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.visible = count > 0;
    if (count === 0) return;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.raised.material.dispose();
    this.raised.dispose();
    this.docks.geometry.dispose();
    this.docks.material.map?.dispose();
    this.docks.material.dispose();
    this.docks.dispose();
  }
}
