import * as THREE from 'three';
import type { GameEvent, RunState } from '../rules';
import { warningTexture } from './textures';
import type { Theme } from './theme';

const MARKS = 8;
const BOLTS = 4;
const BOLT_MS = 320;
const BOLT_HEIGHT = 7;

interface Bolt {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  age: number;
}

/**
 * Tells the player where a cube is about to rise: a bolt strikes the cell, then a mark
 * flickers on it until the cube starts coming up.
 */
export class SpawnWarnings {
  readonly group = new THREE.Group();
  private readonly marks: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly bolts: Bolt[] = [];

  constructor(theme: Theme) {
    const texture = warningTexture(theme.ivoryCss);
    for (let i = 0; i < MARKS; i++) {
      const mark = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.9),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
      );
      mark.rotation.x = -Math.PI / 2;
      mark.position.y = 0.018;
      mark.visible = false;
      this.marks.push(mark);
      this.group.add(mark);
    }
    for (let i = 0; i < BOLTS; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, BOLT_HEIGHT, 0.07),
        new THREE.MeshBasicMaterial({
          color: theme.ivory,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      mesh.position.y = BOLT_HEIGHT / 2;
      mesh.visible = false;
      this.bolts.push({ mesh, age: BOLT_MS });
      this.group.add(mesh);
    }
  }

  notify(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type !== 'warned') continue;
      const bolt = this.bolts.reduce((oldest, b) => (b.age > oldest.age ? b : oldest));
      bolt.age = 0;
      bolt.mesh.position.x = event.x;
      bolt.mesh.position.z = event.z;
    }
  }

  reset(): void {
    for (const bolt of this.bolts) bolt.age = BOLT_MS;
  }

  sync(state: RunState, dtMs: number, timeMs: number, reducedMotion: boolean): void {
    this.marks.forEach((mark, i) => {
      const pending = state.pending[i];
      mark.visible = pending !== undefined;
      if (!pending) return;
      mark.position.x = pending.x;
      mark.position.z = pending.z;
      // The flicker speeds up as the cube gets closer to rising.
      const progress = pending.t / Math.max(1, state.config.warnTicks);
      const period = 220 - 130 * progress;
      const flicker = reducedMotion ? 1 : 0.55 + 0.45 * Math.sign(Math.sin((timeMs / period) * Math.PI * 2));
      mark.material.opacity = 0.9 * flicker;
      mark.scale.setScalar(reducedMotion ? 1 : 1.15 - 0.15 * progress);
    });

    for (const bolt of this.bolts) {
      bolt.age = Math.min(BOLT_MS, bolt.age + dtMs);
      const life = 1 - bolt.age / BOLT_MS;
      bolt.mesh.visible = life > 0 && !reducedMotion;
      bolt.mesh.material.opacity = life * life;
      bolt.mesh.scale.x = bolt.mesh.scale.z = 0.4 + life * 1.6;
    }
  }
}
