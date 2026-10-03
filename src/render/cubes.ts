import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { cubeHeight, isHeld, type Cube, type RunState } from '../rules';
import type { ParamValues } from '../signal/scene';
import { mixHex, type Palette } from '../shell/theme';
import { CANONICAL_FACE_VALUES, ROLL_AXIS, quatFor } from './orientationQuat';
import { ATLAS_COLUMNS, ATLAS_INSET, ATLAS_ROWS, dieTextures } from './textures';

/**
 * How a cube is drawn. A die at rest or on the move is solid. One that is coming up or going
 * down is frosted glass: the same die with all its faces, nearly all here, milky with the
 * colour of the channel on top and with its edges lit in it. The "low" looks are much fainter:
 * a rising cube that can still be stepped onto from the ground, or a sinking cube that can be
 * rolled over. The step from one to the other is plain to see: it is what says a die can be
 * climbed.
 */
type Look = 'idle' | 'rising' | 'risingLow' | 'sinking' | 'sinkingLow';

export const CUBE_SIZE = 0.94;
/** How much of the rounding of a die its lit edges are drawn inside of: they run along the middle of it. */
const EDGE_INSET = 0.586;
/** How far the lit edges of the glass are from the colour of the channel towards white. */
const EDGE_PALE = 0.3;
/** Most dice there can be: one on every cell of the largest board. */
const MAX_DICE = 9 * 9;

export interface CubeGlow {
  /** Glow of the pips of dice at rest: the answer to a clear, and breathing. */
  idle: number;
  /** How bright the edges of a die going down are against those of one coming up. */
  sinking: number;
  /** 1 at the moment a group is sent, falling to 0: its dice flash with their channel. */
  flash: number;
}

type GlassDie = THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;

/** A die with its six faces taken from the one picture of them: a single draw. */
function dieGeometry(round: number): THREE.BufferGeometry {
  const geometry =
    round > 0
      ? new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 3, round)
      : new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  const uv = geometry.getAttribute('uv');
  const index = geometry.getIndex();
  const span = 1 - 2 * ATLAS_INSET;
  const moved = new Uint8Array(uv.count);
  for (const group of geometry.groups) {
    const value = CANONICAL_FACE_VALUES[group.materialIndex ?? 0];
    const column = (value - 1) % ATLAS_COLUMNS;
    const row = Math.floor((value - 1) / ATLAS_COLUMNS);
    for (let i = group.start; i < group.start + group.count; i++) {
      const vertex = index ? index.getX(i) : i;
      if (moved[vertex]) continue;
      moved[vertex] = 1;
      uv.setXY(
        vertex,
        (column + ATLAS_INSET + uv.getX(vertex) * span) / ATLAS_COLUMNS,
        1 - (row + 1 - ATLAS_INSET - uv.getY(vertex) * span) / ATLAS_ROWS,
      );
    }
  }
  geometry.clearGroups();
  return geometry;
}

function smoothstep(from: number, to: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / Math.max(1e-6, to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * The dice of the board. Those at rest and on the move are all one draw: they are the same
 * matter and differ only in where they stand and how they are turned. The lit edges of the
 * glass ones are one draw too. A glass die itself is a draw of its own: every such die is here
 * to a degree of its own, and they are seen through one another in the order they stand in.
 *
 * A draw is a round of talk with the graphics card, and on a phone thirty of them where two
 * would do take a good part of the time a frame has.
 */
export class CubeMeshes {
  readonly group = new THREE.Group();
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshLambertMaterial;
  /** Every solid die, each at its own place. */
  private readonly solids: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  /** The twelve edges of a die, as the ends of their lines around its middle. */
  private readonly outline: Float32Array;
  /** The lit edges of every glass die, in the colour each of them has. */
  private readonly edges: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly edgePlaces: THREE.BufferAttribute;
  private readonly edgeColours: THREE.BufferAttribute;
  /** The middle of the die each point of an edge belongs to: on a board that is bent, a die is turned around it as one piece. */
  private readonly edgeMiddles: THREE.BufferAttribute;
  private readonly channels: THREE.Color[] = [];
  /** The glass dice now on the board, by the cube they show. */
  private readonly worn = new Map<number, GlassDie>();
  /**
   * Glass dice nothing wears at the moment, unseen. They are kept and handed to the next cube
   * that needs one: the program glass is drawn with lives as long as one material of it does,
   * and building it again in the middle of a session holds a frame up.
   */
  private readonly spare: GlassDie[] = [];
  private readonly alive = new Set<number>();
  private readonly matrix = new THREE.Matrix4();
  private readonly at = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly whole = new THREE.Vector3(1, 1, 1);
  private readonly colour = new THREE.Color();
  private readonly tmpVec = new THREE.Vector3();

  constructor(
    palette: Palette,
    private readonly values: ParamValues,
  ) {
    const round = Number(values.dieRound);
    this.geometry = dieGeometry(round);
    const { map, glow } = dieTextures(palette, values);
    this.material = new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0 });
    this.solids = new THREE.InstancedMesh(this.geometry, this.material, MAX_DICE);
    this.solids.count = 0;
    this.solids.frustumCulled = false;

    const frame = CUBE_SIZE - round * EDGE_INSET;
    const box = new THREE.BoxGeometry(frame, frame, frame);
    const outline = new THREE.EdgesGeometry(box);
    this.outline = Float32Array.from(outline.getAttribute('position').array);
    box.dispose();
    outline.dispose();
    this.edgePlaces = new THREE.BufferAttribute(new Float32Array(MAX_DICE * this.outline.length), 3);
    this.edgeColours = new THREE.BufferAttribute(new Float32Array(MAX_DICE * this.outline.length), 3);
    this.edgeMiddles = new THREE.BufferAttribute(new Float32Array(MAX_DICE * this.outline.length), 3);
    this.edgePlaces.setUsage(THREE.DynamicDrawUsage);
    this.edgeColours.setUsage(THREE.DynamicDrawUsage);
    this.edgeMiddles.setUsage(THREE.DynamicDrawUsage);
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', this.edgePlaces);
    edgeGeometry.setAttribute('color', this.edgeColours);
    edgeGeometry.setAttribute('pivot', this.edgeMiddles);
    // The edges of one die, of no size, until the first frame: something to be made ready with.
    edgeGeometry.setDrawRange(0, this.outline.length / 3);
    // Drawn with the glass, after it: the edges of the far side show through the die.
    this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ transparent: true, vertexColors: true }));
    this.edges.frustumCulled = false;
    // Over the glass they belong to, whichever of the two is nearer.
    this.edges.renderOrder = 2;
    this.group.add(this.solids, this.edges);
    this.setPalette(palette);

    // One glass die is there from the start, unseen: the board has none when it is made
    // ready, and what glass is drawn with has to be there to be made ready with it.
    this.spare.push(this.glassDie());
  }

  /** The colours have changed with the hour. The faces of the dice keep theirs. */
  setPalette(palette: Palette): void {
    // Light is paler than the channel it belongs to, so that the darkest of them still shows
    // in the dark. The one is not a channel: its light is the red of its pip.
    for (let value = 1; value <= 6; value++) {
      this.channels[value - 1] = new THREE.Color(value === 1 ? palette.signal : mixHex(palette.channels[value - 1], '#ffffff', EDGE_PALE));
    }
  }

  /** The sinking cubes of running reactions, for the reaction light. */
  sinkingCentre(state: RunState): { x: number; z: number; count: number } {
    let x = 0;
    let z = 0;
    let count = 0;
    for (const cube of state.cubes) {
      if (cube.state !== 'sinking') continue;
      x += cube.x;
      z += cube.z;
      count++;
    }
    return count > 0 ? { x: x / count, z: z / count, count } : { x: 0, z: 0, count: 0 };
  }

  private look(cube: Cube, state: RunState): Look {
    if (cube.state === 'idle' || cube.state === 'moving') return 'idle';
    const height = cubeHeight(cube, state.config);
    if (cube.state === 'rising') return height <= state.config.mountHeight ? 'risingLow' : 'rising';
    return height <= state.config.sinkLowHeight ? 'sinkingLow' : 'sinking';
  }

  sync(state: RunState, alpha: number, glow: CubeGlow, dip: (cubeId: number) => number): void {
    const n = (name: string): number => Number(this.values[name] ?? 0);
    this.material.emissiveIntensity = glow.idle;
    const body = n('glassBody');
    const low = n('glassLow');
    const solid = n('glassSolid');
    const frost = n('glassFrost');
    const edge = n('glassEdge');
    const { alive, outline } = this;
    const places = this.edgePlaces.array as Float32Array;
    const colours = this.edgeColours.array as Float32Array;
    const middles = this.edgeMiddles.array as Float32Array;

    alive.clear();
    let solids = 0;
    let glasses = 0;
    for (const cube of state.cubes) {
      const look = this.look(cube, state);
      if (look === 'idle') {
        if (solids >= MAX_DICE) continue;
        this.pose(cube, state, alpha);
        this.at.y += dip(cube.id);
        this.solids.setMatrixAt(solids++, this.matrix.compose(this.at, this.turn, this.whole));
        continue;
      }
      alive.add(cube.id);
      let die = this.worn.get(cube.id);
      if (!die) {
        die = this.spare.pop() ?? this.glassDie();
        die.visible = true;
        this.worn.set(cube.id, die);
      }
      const glass = die.material;
      const faint = look === 'risingLow' || look === 'sinkingLow';
      // A die held by the tutorial stays put between ticks.
      const height = cubeHeight(cube, state.config, isHeld(state, cube) ? 0 : alpha);
      // The nearer its full height, the more of the die is here: it comes up into being solid,
      // and stops being solid as it starts to go down.
      const here = body + (1 - body) * smoothstep(solid, 1, height);
      glass.opacity = here * (faint ? low : 1);
      // The frost is the light of the channel spread evenly over the die: its faces and pips
      // show through it, and none of them shines by itself.
      const channel = this.channels[cube.ori.top - 1];
      glass.emissive.copy(channel);
      glass.emissiveIntensity = frost * (1 - smoothstep(solid, 1, height)) + (cube.state === 'sinking' ? glow.flash * 0.6 : 0);
      const y = height - 0.5 + dip(cube.id);
      die.position.set(cube.x, y, cube.z);
      die.quaternion.copy(quatFor(cube.ori));

      // Its edges, around where it stands: brighter on the way down, fainter while it is low.
      if (glasses >= MAX_DICE) continue;
      const sinking = look === 'sinking' || look === 'sinkingLow';
      const share = (sinking ? Math.max(1, glow.sinking) : 1) * (faint ? low : 1);
      this.colour.copy(channel).multiplyScalar(Math.min(1, edge * share));
      const from = glasses++ * outline.length;
      for (let i = 0; i < outline.length; i += 3) {
        places[from + i] = outline[i] + cube.x;
        places[from + i + 1] = outline[i + 1] + y;
        places[from + i + 2] = outline[i + 2] + cube.z;
        middles[from + i] = cube.x;
        middles[from + i + 1] = y;
        middles[from + i + 2] = cube.z;
        colours[from + i] = this.colour.r;
        colours[from + i + 1] = this.colour.g;
        colours[from + i + 2] = this.colour.b;
      }
    }

    this.solids.count = solids;
    this.solids.visible = solids > 0;
    if (solids > 0) this.solids.instanceMatrix.needsUpdate = true;
    this.edges.geometry.setDrawRange(0, (glasses * outline.length) / 3);
    this.edges.visible = glasses > 0;
    if (glasses > 0) {
      this.edgePlaces.needsUpdate = true;
      this.edgeColours.needsUpdate = true;
      this.edgeMiddles.needsUpdate = true;
    }
    for (const [id, die] of this.worn) {
      if (alive.has(id)) continue;
      die.visible = false;
      this.spare.push(die);
      this.worn.delete(id);
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.map?.dispose();
    this.material.emissiveMap?.dispose();
    this.material.dispose();
    this.solids.dispose();
    this.edges.geometry.dispose();
    this.edges.material.dispose();
    for (const die of this.worn.values()) die.material.dispose();
    for (const die of this.spare) die.material.dispose();
  }

  /** A die that is not all here, unseen until a cube wears it. What lies behind it shows through; the die hides nothing. */
  private glassDie(): GlassDie {
    const glass = this.material.clone();
    glass.transparent = true;
    glass.depthWrite = false;
    glass.emissiveMap = null;
    const die: GlassDie = new THREE.Mesh(this.geometry, glass);
    die.visible = false;
    this.group.add(die);
    return die;
  }

  /** Where a solid die stands and how it is turned, into `at` and `turn`. */
  private pose(cube: Cube, state: RunState, alpha: number): void {
    const move = cube.move;
    if (cube.state === 'moving' && move) {
      const p = Math.min(1, (cube.t + alpha) / state.config.actionTicks);
      if (move.kind === 'roll') {
        // Turn around the bottom edge shared by the two cells.
        const pivotX = (move.fromX + cube.x) / 2;
        const pivotZ = (move.fromZ + cube.z) / 2;
        this.turn.setFromAxisAngle(ROLL_AXIS[move.dir], (p * Math.PI) / 2);
        this.tmpVec.set(move.fromX - pivotX, 0.5, move.fromZ - pivotZ).applyQuaternion(this.turn);
        this.at.set(pivotX + this.tmpVec.x, this.tmpVec.y, pivotZ + this.tmpVec.z);
        this.turn.multiply(quatFor(move.prevOri));
      } else {
        this.at.set(move.fromX + (cube.x - move.fromX) * p, 0.5, move.fromZ + (cube.z - move.fromZ) * p);
        this.turn.copy(quatFor(cube.ori));
      }
      return;
    }
    this.at.set(cube.x, 0.5, cube.z);
    this.turn.copy(quatFor(cube.ori));
  }
}
