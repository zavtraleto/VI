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
  /** The angle at which the sheet is a wall, and how high things stand on a wall against their own height. */
  uBendSteep: { value: number };
  uBendRelief: { value: number };
}

/**
 * Nothing on the curled part of the sheet stands higher than this before it is made low: a
 * die and a little. A beam of light that is many dice tall would lie across the whole screen
 * from a wall.
 */
const TALLEST = 1.25;

const HEAD = /* glsl */ `
uniform float uBend;
uniform vec3 uBendAcross;
uniform float uBendAt;
uniform vec3 uBendLeft;
uniform vec3 uBendRight;
uniform float uBendSteep;
uniform float uBendRelief;
#ifdef BEND_PIVOT
attribute vec3 pivot;
#endif
${CURL_GLSL}
/**
 * A point of the world on the bent board. \`whole\` is the point of the thing it belongs to:
 * the thing is put on the sheet there and turned with the sheet as one piece, so a die stays
 * a die. For what is itself a part of the sheet, \`whole\` is the point, and it bends.
 */
vec3 bendPoint(vec3 p, vec3 whole) {
  if (uBend < 0.5) return p;
  float s = dot(p, uBendAcross) - uBendAt;
  float at = dot(whole, uBendAcross) - uBendAt;
  float side = at < 0.0 ? -1.0 : 1.0;
  vec3 c = curlPoint(abs(at), at < 0.0 ? uBendLeft : uBendRight);
  // The steeper the sheet, the lower what stands on it: on a wall a die of its own height would hang over the flat part.
  float steep = clamp(c.z / max(uBendSteep, 0.001), 0.0, 1.0);
  steep = steep * steep * (3.0 - 2.0 * steep);
  float y = mix(p.y, min(p.y, ${TALLEST.toFixed(2)}) * uBendRelief, steep);
  float off = s - at;
  float co = cos(c.z);
  float si = sin(c.z);
  float across = side * c.x + off * co - side * y * si;
  float up = c.y + side * off * si + y * co;
  return p + uBendAcross * (across - s) + vec3(0.0, up - p.y, 0.0);
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
#if defined( USE_INSTANCING )
	vec3 bentWhole = ( modelMatrix * instanceMatrix[ 3 ] ).xyz;
#elif defined( BEND_PIVOT )
	vec3 bentWhole = ( modelMatrix * vec4( pivot, 1.0 ) ).xyz;
#elif defined( BEND_WHOLE )
	vec3 bentWhole = modelMatrix[ 3 ].xyz;
#else
	vec3 bentWhole = bentPosition.xyz;
#endif
bentPosition.xyz = bendPoint( bentPosition.xyz, bentWhole );
mvPosition = viewMatrix * bentPosition;
gl_Position = projectionMatrix * mvPosition;
`;

const CHUNK = '#include <project_vertex>';
const FLAT: Curl = { flat: 0, radius: 1, wall: 0 };

/**
 * How a thing takes the bend. The sheet itself - the lines of the surface, what lies on the
 * floor - bends point by point. A thing that stands on the sheet is put on it and turned as
 * one piece around a point of its own, so that it keeps its shape: each of many drawn at
 * once around where it stands, a point named for every vertex in `pivot`, or the thing's
 * own place.
 */
type Kind = 'sheet' | 'pivot' | 'whole';
const DEFINE: Record<Kind, string | null> = { sheet: null, pivot: 'BEND_PIVOT', whole: 'BEND_WHOLE' };

/**
 * Bends the board as a sheet of paper is bent: every point of the scene is moved, in the
 * vertex shader, to where it is on the curled sheet, so the dice, the figure, the signs and
 * the lines of the surface all go up the wall together. The rules know nothing of it, and
 * hardly anything that builds the scene does: the materials of the scene are taken as they
 * are and given the bend.
 */
export class Bend {
  private readonly uniforms: BendUniforms = {
    uBend: { value: 0 },
    uBendAcross: { value: new THREE.Vector3(1, 0, 0) },
    uBendAt: { value: 0 },
    uBendLeft: { value: new THREE.Vector3(0, 1, 0) },
    uBendRight: { value: new THREE.Vector3(0, 1, 0) },
    uBendSteep: { value: 1 },
    uBendRelief: { value: 1 },
  };
  private readonly taken = new WeakSet<THREE.Material>();
  private readonly many = new Set<THREE.BufferGeometry>();
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
    // A thing drawn alone with the shape of things drawn many at once is one of them: a die of glass among the dice.
    const { many } = this;
    many.clear();
    scene.traverse((object) => {
      if ((object as THREE.InstancedMesh).isInstancedMesh) many.add((object as THREE.InstancedMesh).geometry);
    });
    scene.traverse((object) => {
      const { material, geometry } = object as THREE.Mesh;
      if (!material) return;
      object.frustumCulled = false;
      const instanced = (object as THREE.InstancedMesh).isInstancedMesh === true;
      const kind: Kind = geometry?.getAttribute('pivot') ? 'pivot' : !instanced && many.has(geometry) ? 'whole' : 'sheet';
      for (const one of Array.isArray(material) ? material : [material]) this.take(one, kind);
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
   * lies at `at` along it; `left` and `right` are the curls to either side. `steep` is the
   * angle of a wall, in radians; on a wall things stand `relief` of their own height.
   */
  set(across: THREE.Vector3, at: number, left: Curl, right: Curl, steep: number, relief: number): void {
    const { uniforms } = this;
    uniforms.uBend.value = left.wall > 0 || right.wall > 0 ? 1 : 0;
    uniforms.uBendAcross.value.copy(across);
    uniforms.uBendAt.value = at;
    uniforms.uBendLeft.value.set(left.flat, left.radius, left.wall);
    uniforms.uBendRight.value.set(right.flat, right.radius, right.wall);
    uniforms.uBendSteep.value = Math.max(steep, 0.001);
    uniforms.uBendRelief.value = relief;
    this.left = left;
    this.right = right;
  }

  /** Moves a point of the world to where it is on the bent board: what the shader does, for what is placed by hand. */
  point(p: THREE.Vector3): THREE.Vector3 {
    if (!this.on) return p;
    const { uniforms } = this;
    const across = uniforms.uBendAcross.value;
    const s = p.dot(across) - uniforms.uBendAt.value;
    const c = curlAt(s < 0 ? this.left : this.right, Math.abs(s));
    const share = Math.min(1, Math.max(0, c.angle / uniforms.uBendSteep.value));
    const steep = share * share * (3 - 2 * share);
    const y = p.y + (Math.min(p.y, TALLEST) * uniforms.uBendRelief.value - p.y) * steep;
    const side = s < 0 ? -1 : 1;
    p.addScaledVector(across, side * (c.along - y * Math.sin(c.angle)) - s);
    p.y = c.up + y * Math.cos(c.angle);
    return p;
  }

  private take(material: THREE.Material, kind: Kind): void {
    if (this.taken.has(material)) return;
    this.taken.add(material);
    const { uniforms } = this;
    const define = DEFINE[kind];
    if (define) material.defines = { ...material.defines, [define]: '' };
    const before = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      before.call(material, shader, renderer);
      if (!shader.vertexShader.includes(CHUNK)) return;
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace('void main() {', `${HEAD}\nvoid main() {`).replace(CHUNK, PROJECT);
    };
    const keyBefore = material.customProgramCacheKey;
    material.customProgramCacheKey = () => `${keyBefore.call(material)}|bent-board-${kind}`;
    material.needsUpdate = true;
  }
}
