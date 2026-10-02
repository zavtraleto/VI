import * as THREE from 'three';
import { LIGHT } from './light';

/** Something that happened that the board answers: a group sent, a chain added to, a step of the contact. */
export interface BoardBeat {
  kind: 'match' | 'chain' | 'one' | 'step' | 'level' | 'peak';
  /** The channel of the group, 1 to 6; 0 when no group goes. */
  value: number;
  /** How strong it is, 0 to 4: the larger the result, the larger the answer. */
  tier: number;
  /** Cells of the group, empty when no group goes. */
  cells: readonly { x: number; z: number }[];
}

/** Most sparks there can be at once; the oldest give way to new ones. */
const MAX_SPARKS = 480;
const MAX_RINGS = 6;
/** Pull on a spark, in cells per second squared. */
const GRAVITY = 6.5;
/** Sparks from every die of a group, by tier. */
const SPARKS_PER_DIE = [5, 7, 10, 13, 16];
/** How far the ring runs over the surface, in cells, and how long it takes, by tier. */
const RING_REACH = [2.2, 3, 4.2, 5.5, 7];
const RING_MS = [420, 480, 560, 640, 720];

/**
 * Light thrown up by a group going down: square sparks in the colour of its channel, and a ring
 * that runs out over the surface from it. Both are light: they are added to what is behind them
 * and leave the clear parts of the layer clear. One draw for all the sparks.
 */
export class BoardBursts {
  readonly group = new THREE.Group();
  private readonly sparks: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  // A spark: where it is, where it goes, how old it is, how long it lives, how large it is, its colour.
  private readonly pos = new Float32Array(MAX_SPARKS * 3);
  private readonly vel = new Float32Array(MAX_SPARKS * 3);
  private readonly age = new Float32Array(MAX_SPARKS);
  private readonly life = new Float32Array(MAX_SPARKS);
  private readonly size = new Float32Array(MAX_SPARKS);
  private readonly hue: THREE.Color[] = [];
  private count = 0;
  private readonly rings: { mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; age: number; life: number; reach: number; strength: number }[] = [];
  private readonly ringGeometry = new THREE.RingGeometry(0.94, 1, 72, 1);
  private readonly matrix = new THREE.Matrix4();
  private readonly at = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly colour = new THREE.Color();
  /** The sparks face the camera. */
  private readonly facing = new THREE.Quaternion();
  private lit: readonly THREE.Color[] = [];

  constructor() {
    this.sparks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ ...LIGHT, side: THREE.DoubleSide }), MAX_SPARKS);
    this.sparks.count = 0;
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 4;
    this.sparks.setColorAt(0, this.colour.set(0, 0, 0));
    for (let i = 0; i < MAX_SPARKS; i++) this.hue.push(new THREE.Color());
    this.group.add(this.sparks);
    this.ringGeometry.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mesh = new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({ ...LIGHT, side: THREE.DoubleSide, opacity: 0 }));
      mesh.visible = false;
      mesh.renderOrder = -2;
      this.rings.push({ mesh, age: 0, life: 1, reach: 1, strength: 0 });
      this.group.add(mesh);
    }
  }

  /** The colours the light of each channel takes, the one first. */
  setColours(lit: readonly THREE.Color[]): void {
    this.lit = lit;
  }

  /** Throws the light of a group: sparks from every die, a ring from its middle. */
  fire(beat: BoardBeat): void {
    if (beat.cells.length === 0 || beat.value < 1) return;
    const tier = Math.max(0, Math.min(4, Math.round(beat.tier)));
    const tint = this.lit[beat.value - 1] ?? this.colour.set(1, 1, 1);
    const each = SPARKS_PER_DIE[tier];
    let cx = 0;
    let cz = 0;
    for (const cell of beat.cells) {
      cx += cell.x;
      cz += cell.z;
      for (let i = 0; i < each; i++) {
        const slot = this.count < MAX_SPARKS ? this.count++ : Math.floor(Math.random() * MAX_SPARKS);
        const angle = Math.random() * Math.PI * 2;
        const out = 0.4 + Math.random() * (0.8 + tier * 0.35);
        this.pos.set([cell.x + (Math.random() - 0.5) * 0.7, 0.55 + Math.random() * 0.5, cell.z + (Math.random() - 0.5) * 0.7], slot * 3);
        this.vel.set([Math.cos(angle) * out, 2.4 + Math.random() * (1.6 + tier * 0.6), Math.sin(angle) * out], slot * 3);
        this.age[slot] = 0;
        this.life[slot] = 0.45 + Math.random() * (0.35 + tier * 0.1);
        this.size[slot] = 0.07 + Math.random() * (0.06 + tier * 0.015);
        this.hue[slot].copy(tint);
      }
    }
    const ring = this.rings.reduce((oldest, candidate) => (candidate.age / candidate.life > oldest.age / oldest.life ? candidate : oldest));
    ring.age = 0;
    ring.life = RING_MS[tier] / 1000;
    ring.reach = RING_REACH[tier];
    ring.strength = 0.75 + tier * 0.06;
    ring.mesh.material.color.copy(tint);
    ring.mesh.position.set(cx / beat.cells.length, 0.006, cz / beat.cells.length);
    ring.mesh.visible = true;
  }

  /** Moves everything on by a frame. `camera` is what the sparks turn to. */
  update(dtMs: number, camera: THREE.Camera): void {
    const dt = Math.min(dtMs, 100) / 1000;
    this.facing.copy(camera.quaternion);
    let n = this.count;
    for (let i = 0; i < n; ) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        // The last spark takes the place of the one that is gone.
        n--;
        this.pos.copyWithin(i * 3, n * 3, n * 3 + 3);
        this.vel.copyWithin(i * 3, n * 3, n * 3 + 3);
        this.age[i] = this.age[n];
        this.life[i] = this.life[n];
        this.size[i] = this.size[n];
        this.hue[i].copy(this.hue[n]);
        continue;
      }
      const k = i * 3;
      this.vel[k + 1] -= GRAVITY * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const left = 1 - this.age[i] / this.life[i];
      const size = this.size[i] * (0.4 + 0.6 * left);
      this.at.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
      this.sparks.setMatrixAt(i, this.matrix.compose(this.at, this.facing, this.scale.set(size, size, size)));
      this.sparks.setColorAt(i, this.colour.copy(this.hue[i]).multiplyScalar(Math.min(1, left * 1.6)));
      i++;
    }
    this.count = n;
    this.sparks.count = n;
    this.sparks.visible = n > 0;
    if (n > 0) {
      this.sparks.instanceMatrix.needsUpdate = true;
      if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;
    }

    for (const ring of this.rings) {
      if (!ring.mesh.visible) continue;
      ring.age += dt;
      const t = ring.age / ring.life;
      if (t >= 1) {
        ring.mesh.visible = false;
        continue;
      }
      // Fast at first, slowing as it goes out; fading as it goes.
      const eased = 1 - (1 - t) * (1 - t) * (1 - t);
      const radius = 0.4 + eased * ring.reach;
      ring.mesh.scale.set(radius, 1, radius);
      ring.mesh.material.opacity = ring.strength * (1 - t) * (1 - t);
    }
  }

  reset(): void {
    this.count = 0;
    this.sparks.count = 0;
    this.sparks.visible = false;
    for (const ring of this.rings) ring.mesh.visible = false;
  }

  dispose(): void {
    this.sparks.geometry.dispose();
    this.sparks.material.dispose();
    this.sparks.dispose();
    this.ringGeometry.dispose();
    for (const ring of this.rings) ring.mesh.material.dispose();
  }
}
