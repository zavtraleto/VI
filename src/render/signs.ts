import * as THREE from 'three';
import { DELTA, DIRS, cubeHeight, inChain, isDock, isHeld, isStep, type RunState } from '../rules';
import type { ParamValues } from '../signal/scene';
import type { Palette } from '../shell/theme';
import { CUBE_SIZE } from './cubes';
import { LIGHT } from './light';
import { topTurn } from './orientationQuat';
import { PIP_LAYOUT, PIP_STEP, dockTexture, pipRadius } from './textures';

/** Sides of a pillar of light. */
const PILLAR_SIDES = 10;
/** Most pillars there can be: six pips on every die of the largest board. */
const MAX_PILLARS = 7 * 7 * 6;
/** Most frames there can be at one height: one on every cell of the largest board. */
const MAX_DOCKS = 9 * 9;
/**
 * Under this height the frame at the top of a chain fades into the one on the floor. The two
 * are about to meet there, and two frames that nearly lie on each other are one frame too bright.
 */
const RAISED_FADE = 0.5;

/** A tube of unit height standing on the origin, bright at the foot and gone at the top. */
function pillarGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, PILLAR_SIDES, 1, true);
  geometry.translate(0, 0.5, 0);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) colors.fill(1 - position.getY(i), i * 3, i * 3 + 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * What a chain that is still open looks like on the board, apart from the marks on its own
 * cells. A frame of its colour lies on every cell beside it: that is where a die can be
 * brought, and it is brighter where the player's next step can use the cell. Where the cell is
 * free and the docks are steps, the frame lies a second time at the height of the top of the
 * chain's dice and comes down with them: the cell is walked on from up there as well. Light
 * stands on the pips of its dice and shortens as they go down: that is how long there is. When
 * the light is gone, so is the chain.
 */
export class ChainSigns {
  readonly group = new THREE.Group();
  /** The frames of the cells beside a chain: one draw for all of them, each in the colour of its chain. */
  private readonly docks: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** The same frames at the height of the top of the chain's dice, over the cells that are steps. */
  private readonly raised: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** How high the top of the chain is beside a cell: the highest of its dice there. */
  private readonly tops = new Map<number, number>();
  private readonly dockColours: THREE.Color[] = [];
  private readonly pillars: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly lit: THREE.Color[] = [];
  private readonly cells = new Map<number, number>();
  private readonly matrix = new THREE.Matrix4();
  private readonly at = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly whole = new THREE.Vector3(1, 1, 1);
  private readonly upright = new THREE.Quaternion();
  private readonly colour = new THREE.Color();

  constructor(private readonly values: ParamValues) {
    const lying = new THREE.PlaneGeometry(1, 1);
    lying.rotateX(-Math.PI / 2);
    this.docks = new THREE.InstancedMesh(lying, new THREE.MeshBasicMaterial({ ...LIGHT, map: dockTexture() }), MAX_DOCKS);
    this.docks.count = 0;
    this.docks.frustumCulled = false;
    // Before the see-through dice, as the marks of the chain are.
    this.docks.renderOrder = -1;
    // The colours of the frames are there from the start: the program for them is built with the board.
    this.docks.setColorAt(0, this.colour.set(0, 0, 0));
    this.group.add(this.docks);
    // Up at the height of the dice the frames are drawn after them, as the pillars are: a die
    // that stands behind a frame shows through its light, and one in front hides it.
    this.raised = new THREE.InstancedMesh(lying, this.docks.material, MAX_DOCKS);
    this.raised.count = 0;
    this.raised.frustumCulled = false;
    this.raised.renderOrder = 3;
    this.raised.setColorAt(0, this.colour.set(0, 0, 0));
    this.group.add(this.raised);
    this.pillars = new THREE.InstancedMesh(
      pillarGeometry(),
      // Light adds up the same in any order: both sides go in one draw, not the far side and then the near.
      new THREE.MeshBasicMaterial({ ...LIGHT, vertexColors: true, side: THREE.DoubleSide, forceSinglePass: true }),
      MAX_PILLARS,
    );
    this.pillars.count = 0;
    this.pillars.frustumCulled = false;
    this.pillars.renderOrder = 3;
    // The colours of the pillars are there from the start: the program for them is built with the board.
    this.pillars.setColorAt(0, this.colour.set(0, 0, 0));
    this.group.add(this.pillars);
  }

  setPalette(palette: Palette): void {
    for (let i = 0; i < 6; i++) this.dockColours[i] = new THREE.Color(i === 0 ? palette.signal : palette.channels[i]);
    // The light of a die is the colour of its channel; the one is not a channel, and its light is red.
    for (let value = 1; value <= 6; value++) {
      this.lit[value - 1] = new THREE.Color(value === 1 ? palette.signal : palette.channels[value - 1]);
    }
  }

  /** `reach` makes the light taller than its parameter says: the contact can lift it. */
  sync(state: RunState, alpha: number, timeMs: number, reducedMotion: boolean, dip: (cubeId: number) => number, reach = 1): void {
    const n = (name: string): number => Number(this.values[name] ?? 0);
    const { size } = state.config;
    this.cells.clear();
    this.tops.clear();
    let pillars = 0;

    // Nothing joins a finished group in a puzzle.
    if (!state.puzzle) {
      const bright = n('pillarBright');
      const tall = n('pillarHeight') * reach;
      for (const cube of state.cubes) {
        if (!inChain(cube)) continue;
        const value = cube.ori.top;
        const left = cubeHeight(cube, state.config, isHeld(state, cube) ? 0 : alpha);
        // Where the top face of the die is, apart from the dip a step makes in it.
        const face = left - 0.5 + CUBE_SIZE / 2;
        for (const dir of DIRS) {
          const x = cube.x + DELTA[dir].dx;
          const z = cube.z + DELTA[dir].dz;
          if (x < 0 || z < 0 || x >= size || z >= size) continue;
          const cell = x + z * size;
          if (!this.cells.has(cell)) this.cells.set(cell, value);
          this.tops.set(cell, Math.max(this.tops.get(cell) ?? 0, face));
        }

        if (tall <= 0 || bright <= 0 || left <= 0) continue;
        const top = face + dip(cube.id);
        const turn = topTurn(cube.ori);
        const cos = Math.cos(turn);
        const sin = Math.sin(turn);
        const width = pipRadius(value, this.values) * CUBE_SIZE * 2 * n('pillarWidth');
        this.scale.set(width, tall * left, width);
        this.colour.copy(this.lit[value - 1]).multiplyScalar(bright);
        for (const [column, row] of PIP_LAYOUT[value]) {
          if (pillars >= MAX_PILLARS) break;
          // Where the pip lies on the top face as the die shows it.
          const px = (column - 1) * PIP_STEP * CUBE_SIZE;
          const py = -(row - 1) * PIP_STEP * CUBE_SIZE;
          this.at.set(cube.x + px * cos - py * sin, top, cube.z - (px * sin + py * cos));
          this.pillars.setMatrixAt(pillars, this.matrix.compose(this.at, this.upright, this.scale));
          this.pillars.setColorAt(pillars, this.colour);
          pillars++;
        }
      }
      // A cell a die of the chain stands on has its mark already.
      for (const cube of state.cubes) if (inChain(cube)) this.cells.delete(cube.x + cube.z * size);
    }

    this.pillars.count = pillars;
    this.pillars.visible = pillars > 0;
    if (pillars > 0) {
      this.pillars.instanceMatrix.needsUpdate = true;
      if (this.pillars.instanceColor) this.pillars.instanceColor.needsUpdate = true;
    }

    const opacity = n('dockBright') * (reducedMotion ? 1 : 0.75 + 0.25 * Math.sin((timeMs / 700) * Math.PI * 2));
    this.docks.material.opacity = opacity;
    let docks = 0;
    let raised = 0;
    if (opacity > 0) {
      // A dock the player's next step can use, down to it or up from it, is brighter than one
      // that only takes a die. A colour cannot be brighter than itself, and light adds up: the
      // frame is laid as many times as it is brighter, the last time at a part of its strength.
      const step = Math.max(1, n('dockStep'));
      // With the steps of the docks a free cell beside a chain is walked on from the top of its
      // dice as well as from the floor: its frame lies up there too, and comes down with them.
      const upper = state.config.experiments.dockSteps ? n('dockTop') : 0;
      for (const [cell, value] of this.cells) {
        const x = cell % size;
        const z = Math.floor(cell / size);
        const times = step > 1 && isStep(state, x, z) ? step : 1;
        docks = this.lay(this.docks, docks, x, 0.012, z, value, times, 1);
        const lift = upper > 0 && isDock(state, x, z) ? (this.tops.get(cell) ?? 0) : 0;
        if (lift > 0) raised = this.lay(this.raised, raised, x, lift, z, value, times, upper * Math.min(1, lift / RAISED_FADE));
      }
    }
    this.show(this.docks, docks);
    this.show(this.raised, raised);
  }

  /**
   * Lays the frame of a cell at a height, `times` over and the last time at the part that is
   * left of it. Returns how many frames the mesh holds after that.
   */
  private lay(mesh: THREE.InstancedMesh, count: number, x: number, y: number, z: number, value: number, times: number, strength: number): number {
    this.at.set(x, y, z);
    this.matrix.compose(this.at, this.upright, this.whole);
    for (let left = times; left > 0 && count < MAX_DOCKS; left--) {
      mesh.setMatrixAt(count, this.matrix);
      mesh.setColorAt(count, this.colour.copy(this.dockColours[value - 1]).multiplyScalar(strength * Math.min(1, left)));
      count++;
    }
    return count;
  }

  private show(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.visible = count > 0;
    if (count === 0) return;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.raised.dispose();
    this.docks.geometry.dispose();
    this.docks.material.map?.dispose();
    this.docks.material.dispose();
    this.docks.dispose();
    this.pillars.geometry.dispose();
    this.pillars.material.dispose();
    this.pillars.dispose();
  }
}
