import * as THREE from 'three';
import { inChain, type RunState } from '../rules';
import type { ParamValues } from '../signal/scene';
import type { Palette } from '../shell/theme';
import { CUBE_SIZE } from './cubes';
import { topTurn } from './orientationQuat';
import { chainMarkTexture } from './textures';

/**
 * Shows where a chain can still be added to. The cell of every die sinking in a chain carries
 * that die's top face, lit in the colour of its channel, until the die is gone: a die that has
 * all but sunk out of sight still counts, and the mark is what says so.
 */
export class ChainMarks {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly materials: THREE.MeshBasicMaterial[];
  private readonly marks: THREE.Mesh[] = [];

  constructor(values: ParamValues) {
    this.materials = [1, 2, 3, 4, 5, 6].map(
      (value) =>
        new THREE.MeshBasicMaterial({
          map: chainMarkTexture(value, CUBE_SIZE, values),
          transparent: true,
          depthWrite: false,
        }),
    );
  }

  setPalette(palette: Palette): void {
    // The one is not a channel: where it goes down, the mark is the red of its pip.
    this.materials.forEach((material, i) => material.color.set(i === 0 ? palette.signal : palette.channels[i]));
  }

  sync(state: RunState, timeMs: number, reducedMotion: boolean): void {
    const opacity = reducedMotion ? 1 : 0.82 + 0.18 * Math.sin((timeMs / 700) * Math.PI * 2);
    for (const material of this.materials) material.opacity = opacity;

    let used = 0;
    // Nothing joins a finished group in a puzzle.
    if (!state.puzzle) {
      for (const cube of state.cubes) {
        if (!inChain(cube)) continue;
        const mark = this.marks[used++] ?? this.add();
        mark.material = this.materials[cube.ori.top - 1];
        mark.position.set(cube.x, 0.014, cube.z);
        mark.rotation.set(-Math.PI / 2, 0, topTurn(cube.ori));
        mark.visible = true;
      }
    }
    for (let i = used; i < this.marks.length; i++) this.marks[i].visible = false;
  }

  dispose(): void {
    this.geometry.dispose();
    for (const material of this.materials) {
      material.map?.dispose();
      material.dispose();
    }
  }

  private add(): THREE.Mesh {
    const mark = new THREE.Mesh(this.geometry, this.materials[0]);
    // Before the see-through dice, so a mark shows through the die that stands on it.
    mark.renderOrder = -1;
    this.marks.push(mark);
    this.group.add(mark);
    return mark;
  }
}
