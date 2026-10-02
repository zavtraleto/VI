import * as THREE from 'three';
import { DELTA, DIRS, cubeHeight, inChain, isHeld, type RunState } from '../rules';
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
 * brought. Light stands on the pips of its dice and shortens as they go down: that is how
 * long there is. When the light is gone, so is the chain.
 */
export class ChainSigns {
  readonly group = new THREE.Group();
  private readonly dockGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly dockMaterials: THREE.MeshBasicMaterial[];
  private readonly docks: THREE.Mesh[] = [];
  private readonly pillars: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly lit: THREE.Color[] = [];
  private readonly cells = new Map<number, number>();
  private readonly matrix = new THREE.Matrix4();
  private readonly at = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly upright = new THREE.Quaternion();
  private readonly colour = new THREE.Color();

  constructor(private readonly values: ParamValues) {
    this.dockGeometry.rotateX(-Math.PI / 2);
    const frame = dockTexture();
    this.dockMaterials = [1, 2, 3, 4, 5, 6].map(
      () => new THREE.MeshBasicMaterial({ ...LIGHT, map: frame }),
    );
    this.pillars = new THREE.InstancedMesh(
      pillarGeometry(),
      new THREE.MeshBasicMaterial({ ...LIGHT, vertexColors: true, side: THREE.DoubleSide }),
      MAX_PILLARS,
    );
    this.pillars.count = 0;
    this.pillars.frustumCulled = false;
    this.pillars.renderOrder = 3;
    this.group.add(this.pillars);
  }

  setPalette(palette: Palette): void {
    this.dockMaterials.forEach((material, i) => material.color.set(i === 0 ? palette.signal : palette.channels[i]));
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
    let pillars = 0;

    // Nothing joins a finished group in a puzzle.
    if (!state.puzzle) {
      const bright = n('pillarBright');
      const tall = n('pillarHeight') * reach;
      for (const cube of state.cubes) {
        if (!inChain(cube)) continue;
        const value = cube.ori.top;
        for (const dir of DIRS) {
          const x = cube.x + DELTA[dir].dx;
          const z = cube.z + DELTA[dir].dz;
          if (x < 0 || z < 0 || x >= size || z >= size) continue;
          const cell = x + z * size;
          if (!this.cells.has(cell)) this.cells.set(cell, value);
        }

        const left = cubeHeight(cube, state.config, isHeld(state, cube) ? 0 : alpha);
        if (tall <= 0 || bright <= 0 || left <= 0) continue;
        const top = left - 0.5 + dip(cube.id) + CUBE_SIZE / 2;
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
    for (const material of this.dockMaterials) material.opacity = opacity;
    let used = 0;
    for (const [cell, value] of this.cells) {
      const dock = this.docks[used++] ?? this.add();
      dock.material = this.dockMaterials[value - 1];
      dock.position.set(cell % size, 0.012, Math.floor(cell / size));
      dock.visible = opacity > 0;
    }
    for (let i = used; i < this.docks.length; i++) this.docks[i].visible = false;
  }

  dispose(): void {
    this.dockGeometry.dispose();
    this.dockMaterials[0].map?.dispose();
    for (const material of this.dockMaterials) material.dispose();
    this.pillars.geometry.dispose();
    this.pillars.material.dispose();
    this.pillars.dispose();
  }

  private add(): THREE.Mesh {
    const dock = new THREE.Mesh(this.dockGeometry, this.dockMaterials[0]);
    // Before the see-through dice, as the marks of the chain are.
    dock.renderOrder = -1;
    this.docks.push(dock);
    this.group.add(dock);
    return dock;
  }
}
