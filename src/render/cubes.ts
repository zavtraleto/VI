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
type GlassLook = Exclude<Look, 'idle'>;
const GLASS_LOOKS: readonly GlassLook[] = ['rising', 'risingLow', 'sinking', 'sinkingLow'];

export const CUBE_SIZE = 0.94;
/** How much of the rounding of a die its lit edges are drawn inside of: they run along the middle of it. */
const EDGE_INSET = 0.586;
/** How far the lit edges of the glass are from the colour of the channel towards white. */
const EDGE_PALE = 0.3;

export interface CubeGlow {
  /** Glow of the pips of dice at rest: the answer to a clear, and breathing. */
  idle: number;
  /** How bright the edges of a die going down are against those of one coming up. */
  sinking: number;
  /** 1 at the moment a group is sent, falling to 0: its dice flash with their channel. */
  flash: number;
}

interface Die {
  mesh: THREE.Mesh;
  /** The lit edges of a die that is glass. */
  edges: THREE.LineSegments;
  /** Its own material while it is glass: every such die is here to a degree of its own. */
  glass: THREE.MeshLambertMaterial | null;
}

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

export class CubeMeshes {
  readonly group = new THREE.Group();
  private readonly geometry: THREE.BufferGeometry;
  private readonly edgeGeometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshLambertMaterial;
  /** Edges of the glass by its look and by the value on top, index 0 = the 1. */
  private readonly edges: Record<GlassLook, THREE.LineBasicMaterial[]>;
  private readonly channels: THREE.Color[] = [];
  private readonly dice = new Map<number, Die>();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpVec = new THREE.Vector3();

  constructor(
    palette: Palette,
    private readonly values: ParamValues,
  ) {
    const round = Number(values.dieRound);
    this.geometry = dieGeometry(round);
    const frame = CUBE_SIZE - round * EDGE_INSET;
    const box = new THREE.BoxGeometry(frame, frame, frame);
    this.edgeGeometry = new THREE.EdgesGeometry(box);
    box.dispose();
    const { map, glow } = dieTextures(palette, values);
    this.material = new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0 });
    this.edges = Object.fromEntries(
      // Drawn with the glass, after it: the edges of the far side show through the die.
      GLASS_LOOKS.map((look) => [look, [1, 2, 3, 4, 5, 6].map(() => new THREE.LineBasicMaterial({ transparent: true }))]),
    ) as Record<GlassLook, THREE.LineBasicMaterial[]>;
    this.setPalette(palette);
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
    for (const look of GLASS_LOOKS) {
      const sinking = look === 'sinking' || look === 'sinkingLow';
      const share = (sinking ? Math.max(1, glow.sinking) : 1) * (look === 'risingLow' || look === 'sinkingLow' ? low : 1);
      this.edges[look].forEach((material, i) => material.color.copy(this.channels[i]).multiplyScalar(Math.min(1, n('glassEdge') * share)));
    }

    const alive = new Set<number>();
    for (const cube of state.cubes) {
      alive.add(cube.id);
      const die = this.dice.get(cube.id) ?? this.add(cube.id);
      const look = this.look(cube, state);
      if (look === 'idle') {
        die.mesh.material = this.material;
        die.edges.visible = false;
        this.pose(die.mesh, cube, state, alpha);
        die.mesh.position.y += dip(cube.id);
        continue;
      }
      const glass = (die.glass ??= this.glass());
      // A die held by the tutorial stays put between ticks.
      const height = cubeHeight(cube, state.config, isHeld(state, cube) ? 0 : alpha);
      // The nearer its full height, the more of the die is here: it comes up into being solid,
      // and stops being solid as it starts to go down.
      const here = body + (1 - body) * smoothstep(solid, 1, height);
      glass.opacity = here * (look === 'risingLow' || look === 'sinkingLow' ? low : 1);
      // The frost is the light of the channel spread evenly over the die: its faces and pips
      // show through it, and none of them shines by itself.
      glass.emissive.copy(this.channels[cube.ori.top - 1]);
      glass.emissiveIntensity = frost * (1 - smoothstep(solid, 1, height)) + (cube.state === 'sinking' ? glow.flash * 0.6 : 0);
      die.mesh.material = glass;
      die.mesh.position.set(cube.x, height - 0.5 + dip(cube.id), cube.z);
      die.mesh.quaternion.copy(quatFor(cube.ori));
      die.edges.visible = true;
      die.edges.material = this.edges[look][cube.ori.top - 1];
      die.edges.position.copy(die.mesh.position);
    }
    for (const [id, die] of this.dice) {
      if (alive.has(id)) continue;
      this.group.remove(die.mesh, die.edges);
      die.glass?.dispose();
      this.dice.delete(id);
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.edgeGeometry.dispose();
    this.material.map?.dispose();
    this.material.emissiveMap?.dispose();
    this.material.dispose();
    for (const die of this.dice.values()) die.glass?.dispose();
    for (const look of GLASS_LOOKS) for (const material of this.edges[look]) material.dispose();
  }

  /** The material of a die that is not all here. What lies behind it shows through; the die hides nothing. */
  private glass(): THREE.MeshLambertMaterial {
    const glass = this.material.clone();
    glass.transparent = true;
    glass.depthWrite = false;
    glass.emissiveMap = null;
    return glass;
  }

  private add(id: number): Die {
    const mesh = new THREE.Mesh(this.geometry, this.material);
    const edges = new THREE.LineSegments(this.edgeGeometry, this.edges.rising[0]);
    edges.visible = false;
    // Over the glass they belong to, whichever of the two is nearer.
    edges.renderOrder = 2;
    const die: Die = { mesh, edges, glass: null };
    this.dice.set(id, die);
    this.group.add(mesh, edges);
    return die;
  }

  private pose(mesh: THREE.Mesh, cube: Cube, state: RunState, alpha: number): void {
    const move = cube.move;
    if (cube.state === 'moving' && move) {
      const p = Math.min(1, (cube.t + alpha) / state.config.actionTicks);
      if (move.kind === 'roll') {
        // Turn around the bottom edge shared by the two cells.
        const pivotX = (move.fromX + cube.x) / 2;
        const pivotZ = (move.fromZ + cube.z) / 2;
        this.tmpQuat.setFromAxisAngle(ROLL_AXIS[move.dir], (p * Math.PI) / 2);
        this.tmpVec.set(move.fromX - pivotX, 0.5, move.fromZ - pivotZ).applyQuaternion(this.tmpQuat);
        mesh.position.set(pivotX + this.tmpVec.x, this.tmpVec.y, pivotZ + this.tmpVec.z);
        mesh.quaternion.copy(this.tmpQuat).multiply(quatFor(move.prevOri));
      } else {
        mesh.position.set(move.fromX + (cube.x - move.fromX) * p, 0.5, move.fromZ + (cube.z - move.fromZ) * p);
        mesh.quaternion.copy(quatFor(cube.ori));
      }
      return;
    }
    mesh.position.set(cube.x, 0.5, cube.z);
    mesh.quaternion.copy(quatFor(cube.ori));
  }
}
