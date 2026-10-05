import * as THREE from 'three';
import { DELTA, DIRS, cubeAt, cubeHeight, inChain, isDock, isHeld, isStep, worldRuns, type Cube, type RunState } from '../rules';
import type { ParamValues } from '../signal/scene';
import type { Palette } from '../shell/theme';
import { CUBE_SIZE } from './cubes';
import { LIGHT } from './light';
import { dockTexture } from './textures';

/** Most frames there can be at one height: one on every cell of the largest board. */
const MAX_DOCKS = 9 * 9;
/**
 * Under this height the frame at the top of a chain fades into the one on the floor. The two
 * are about to meet there, and two frames that nearly lie on each other are one frame too bright.
 */
const RAISED_FADE = 0.5;

/**
 * How much of a die is above the floor. A die held by the tutorial stays put between ticks,
 * and so does one on a level whose world stands.
 */
const heightOf = (state: RunState, cube: Cube, alpha: number): number =>
  cubeHeight(cube, state.config, isHeld(state, cube) || !worldRuns(state) ? 0 : alpha);

/** Where the top face of a die that high is, apart from the dip a step makes in it. */
const faceAt = (height: number): number => height - 0.5 + CUBE_SIZE / 2;

/**
 * What a chain that is still open looks like on the board, apart from the marks on its own
 * cells. A frame of its colour lies on every cell beside it: that is where a die can be
 * brought, and it is brighter where the player's next step can use the cell. Where the cell is
 * free and the docks are steps, the frame lies a second time at the height of the top of the
 * chain's dice and comes down with them: the cell is walked on from up there as well. How
 * long there is, is read off the dice themselves.
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
  private readonly cells = new Map<number, number>();
  private readonly matrix = new THREE.Matrix4();
  private readonly at = new THREE.Vector3();
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
    // Up at the height of the dice the frames are drawn after them: a die that stands behind a
    // frame shows through its light, and one in front hides it.
    this.raised = new THREE.InstancedMesh(lying, this.docks.material, MAX_DOCKS);
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

  sync(state: RunState, alpha: number, timeMs: number, reducedMotion: boolean, ghosts: readonly { x: number; z: number; value: number }[] = []): void {
    const n = (name: string): number => Number(this.values[name] ?? 0);
    const { size } = state.config;
    this.cells.clear();
    this.tops.clear();

    // Nothing joins a finished group in a puzzle.
    if (!state.puzzle) {
      for (const cube of state.cubes) {
        if (!inChain(cube)) continue;
        const value = cube.ori.top;
        const face = faceAt(heightOf(state, cube, alpha));
        for (const dir of DIRS) {
          const x = cube.x + DELTA[dir].dx;
          const z = cube.z + DELTA[dir].dz;
          if (x < 0 || z < 0 || x >= size || z >= size) continue;
          const cell = x + z * size;
          if (!this.cells.has(cell)) this.cells.set(cell, value);
          this.tops.set(cell, Math.max(this.tops.get(cell) ?? 0, face));
        }
      }
      // A cell a die of the chain stood on until it was rolled over keeps the frame of the chain: the die is
      // gone at once, and its place in the group is not.
      for (const ghost of ghosts) this.cells.set(ghost.x + ghost.z * size, ghost.value);
      // A cell a die of the chain stands on has its mark already.
      for (const cube of state.cubes) if (inChain(cube)) this.cells.delete(cube.x + cube.z * size);
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
   * How high the upper frame of a cell lies: at the top face of the highest die of the chain
   * beside it. Nought where there is none. The one who plays stands on it, not on the floor
   * under it: from the frame the next die is one step away, as it is from a die.
   */
  lift(state: RunState, x: number, z: number, alpha: number): number {
    const n = (name: string): number => Number(this.values[name] ?? 0);
    if (!state.config.experiments.dockSteps || n('dockTop') <= 0 || n('dockBright') <= 0) return 0;
    if (!isDock(state, x, z)) return 0;
    let lift = 0;
    for (const dir of DIRS) {
      const cube = cubeAt(state, x + DELTA[dir].dx, z + DELTA[dir].dz);
      if (cube && inChain(cube)) lift = Math.max(lift, faceAt(heightOf(state, cube, alpha)));
    }
    return lift;
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
  }
}
