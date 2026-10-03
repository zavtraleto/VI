import * as THREE from 'three';
import { CURL_GLSL, curlAt, type Curl } from './curl';

/** What every material of the board is told of the bend. One set of them, shared: a change reaches them all. */
interface BendUniforms {
  /** 1 while the board is bent, 0 while it lies flat. */
  uBend: { value: number };
  /** The level direction across the screen that the sheet is curled along. */
  uBendAcross: { value: THREE.Vector3 };
  /** Where the player stands along it. */
  uBendAt: { value: number };
  /** The curl to the left of the player and to the right: flat part, radius, steepest angle. */
  uBendLeft: { value: THREE.Vector3 };
  uBendRight: { value: THREE.Vector3 };
}

const HEAD = /* glsl */ `
uniform float uBend;
uniform vec3 uBendAcross;
uniform float uBendAt;
uniform vec3 uBendLeft;
uniform vec3 uBendRight;
${CURL_GLSL}
/** A point of the world on the bent board: its place on the sheet is curled, its height stands on the sheet. */
vec3 bendPoint(vec3 p) {
  if (uBend < 0.5) return p;
  float s = dot(p, uBendAcross) - uBendAt;
  float side = s < 0.0 ? -1.0 : 1.0;
  vec3 c = curlPoint(abs(s), s < 0.0 ? uBendLeft : uBendRight);
  float along = c.x - p.y * sin(c.z);
  float up = c.y + p.y * cos(c.z);
  return p + uBendAcross * (side * along - s) + vec3(0.0, up - p.y, 0.0);
}
`;

/** In place of the chunk every material of three.js puts its vertices on screen with. */
const PROJECT = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
vec4 bentPosition = modelMatrix * mvPosition;
bentPosition.xyz = bendPoint( bentPosition.xyz );
mvPosition = viewMatrix * bentPosition;
gl_Position = projectionMatrix * mvPosition;
`;

const CHUNK = '#include <project_vertex>';
const KEY = 'bent-board';
const FLAT: Curl = { flat: 0, radius: 1, wall: 0 };

/**
 * Bends the board as a sheet of paper is bent: every point of the scene is moved, in the
 * vertex shader, to where it is on the curled sheet, so the dice, the figure, the signs and
 * the lines of the surface all go up the wall together and lean towards the player. The
 * rules know nothing of it, and neither does anything that builds the scene: the materials
 * of the scene are taken as they are and given the bend.
 */
export class Bend {
  private readonly uniforms: BendUniforms = {
    uBend: { value: 0 },
    uBendAcross: { value: new THREE.Vector3(1, 0, 0) },
    uBendAt: { value: 0 },
    uBendLeft: { value: new THREE.Vector3(0, 1, 0) },
    uBendRight: { value: new THREE.Vector3(0, 1, 0) },
  };
  private readonly taken = new WeakSet<THREE.Material>();
  private left: Curl = FLAT;
  private right: Curl = FLAT;

  /** Whether the board is bent on this frame. */
  get on(): boolean {
    return this.uniforms.uBend.value > 0.5;
  }

  /**
   * Gives the bend to every material of the scene that has not got it yet. Called before the
   * scene is made ready and on every frame after: a die of glass is made when it is needed.
   * Nothing of a bent scene may be left out for lying outside the picture: bent, it may lie inside.
   */
  adopt(scene: THREE.Object3D): void {
    scene.traverse((object) => {
      const { material } = object as THREE.Mesh;
      if (!material) return;
      object.frustumCulled = false;
      for (const one of Array.isArray(material) ? material : [material]) this.take(one);
    });
  }

  /** The board lies flat. */
  flatten(): void {
    this.uniforms.uBend.value = 0;
    this.left = FLAT;
    this.right = FLAT;
  }

  /**
   * The board is curled along `across`, a level direction of the world, around the point that
   * lies at `at` along it; `left` and `right` are the curls to either side.
   */
  set(across: THREE.Vector3, at: number, left: Curl, right: Curl): void {
    const { uniforms } = this;
    uniforms.uBend.value = left.wall > 0 || right.wall > 0 ? 1 : 0;
    uniforms.uBendAcross.value.copy(across);
    uniforms.uBendAt.value = at;
    uniforms.uBendLeft.value.set(left.flat, left.radius, left.wall);
    uniforms.uBendRight.value.set(right.flat, right.radius, right.wall);
    this.left = left;
    this.right = right;
  }

  /** Moves a point of the world to where it is on the bent board: what the shader does, for what is placed by hand. */
  point(p: THREE.Vector3): THREE.Vector3 {
    if (!this.on) return p;
    const across = this.uniforms.uBendAcross.value;
    const s = p.dot(across) - this.uniforms.uBendAt.value;
    const c = curlAt(s < 0 ? this.left : this.right, Math.abs(s));
    const along = c.along - p.y * Math.sin(c.angle);
    const up = c.up + p.y * Math.cos(c.angle);
    p.addScaledVector(across, Math.sign(s || 1) * along - s);
    p.y = up;
    return p;
  }

  private take(material: THREE.Material): void {
    if (this.taken.has(material)) return;
    this.taken.add(material);
    const { uniforms } = this;
    const before = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      before.call(material, shader, renderer);
      if (!shader.vertexShader.includes(CHUNK)) return;
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace('void main() {', `${HEAD}\nvoid main() {`).replace(CHUNK, PROJECT);
    };
    const keyBefore = material.customProgramCacheKey;
    material.customProgramCacheKey = () => `${keyBefore.call(material)}|${KEY}`;
    material.needsUpdate = true;
  }
}
