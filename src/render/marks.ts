import * as THREE from 'three';
import { inChain, type RunState } from '../rules';
import { CUBE_SIZE } from './cubes';
import { topTurn } from './orientationQuat';
import { chainMarkTexture } from './textures';
import type { Theme } from './theme';

/**
 * Shows where a chain can still be added to. The cell of every die sinking in a chain carries
 * that die's top face, lit, until the die is gone: a die that has all but sunk out of sight
 * still counts, and the mark is what says so.
 */
export class ChainMarks {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly materials: THREE.MeshBasicMaterial[];
  private readonly marks: THREE.Mesh[] = [];

  constructor(theme: Theme) {
    this.materials = [1, 2, 3, 4, 5, 6].map(
      (value) =>
        new THREE.MeshBasicMaterial({
          map: chainMarkTexture(value, theme.alarm, CUBE_SIZE),
          transparent: true,
          depthWrite: false,
        }),
    );
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

  private add(): THREE.Mesh {
    const mark = new THREE.Mesh(this.geometry, this.materials[0]);
    // Before the see-through dice, so a mark shows through the die that stands on it.
    mark.renderOrder = -1;
    this.marks.push(mark);
    this.group.add(mark);
    return mark;
  }
}
