import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The figure of the one who plays: a robe and a head, standing on the origin. It is the same
 * body on the board and in the menu of the program, where it is the cursor. Large enough to
 * be made out on a phone, where a cell is some forty pixels wide.
 */
export function figureGeometry(scale = 1): THREE.BufferGeometry {
  const robe = new THREE.ConeGeometry(0.26, 0.65, 14);
  robe.translate(0, 0.325, 0);
  const head = new THREE.SphereGeometry(0.135, 14, 10);
  head.translate(0, 0.715, 0);
  const figure = mergeGeometries([robe, head])!;
  robe.dispose();
  head.dispose();
  return figure.scale(scale, scale, scale);
}

/** What the body of the figure is made of. */
export interface FigureLook {
  /** How much of the body there is where it is looked at straight on: the rest is what stands behind it. */
  body: number;
  /** How much denser and lighter the body is towards its outline, where the eye goes along more of it. */
  rim: number;
  /** How bright the one gleam on it is. */
  shine: number;
}

export const FIGURE_LOOK: FigureLook = { body: 0.5, rim: 0.7, shine: 0.6 };

const VERTEX = /* glsl */ `
varying vec3 vNormal;

void main() {
  vNormal = normalMatrix * normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Coloured plastic that can be seen through, with no lamp in the scene and no second picture of
 * it: the camera looks along one line everywhere, so how much of the body the eye goes through
 * is told by how far a place of it is turned away. Straight on, the body is thin and what is
 * behind it shows in its colour; towards the outline it is dense and lighter. `BACK` is the far
 * side of it, seen through the near one: darker, and without the gleam.
 */
const FRAGMENT = /* glsl */ `
uniform vec3 uColour;
/** How much of the body there is straight on; how dense its outline is; how bright the gleam is. */
uniform vec3 uLook;

varying vec3 vNormal;

/** Where the gleam comes from, as the camera sees: up and to the left. */
const vec3 GLEAM = vec3(-0.3511, 0.5461, 0.7606);

void main() {
  vec3 normal = normalize(vNormal);
  float away = 1.0 - abs(normal.z);
  // Wide, not a thin line at the outline: on a phone the whole body is some twenty dots of the tube high.
  float edge = smoothstep(0.2, 0.85, away);
#ifdef BACK
  vec3 colour = uColour * (0.35 + 0.3 * edge);
  float alpha = uLook.x * (0.5 + 0.5 * edge);
#else
  float dense = uLook.y * edge;
  vec3 colour = mix(uColour, vec3(1.0), 0.35 * dense * edge);
  float gleam = uLook.z * pow(max(dot(normal, GLEAM), 0.0), 10.0);
  colour += vec3(gleam);
  float alpha = min(1.0, mix(uLook.x, 1.0, dense) + gleam);
#endif
  gl_FragColor = vec4(colour, alpha);
  #include <colorspace_fragment>
}
`;

/**
 * The body of the figure, drawn in two goes: its far side, then its near side over it. The near
 * side writes depth, so that what is drawn later and stands behind stays behind.
 */
export class FigureBody {
  readonly object = new THREE.Group();
  private readonly uniforms = { uColour: { value: new THREE.Color() }, uLook: { value: new THREE.Vector3() } };
  private readonly back: THREE.ShaderMaterial;
  private readonly front: THREE.ShaderMaterial;

  /** `order` is where among the see-through things of its scene the body is drawn. */
  constructor(geometry: THREE.BufferGeometry, order = 0) {
    const material = (far: boolean): THREE.ShaderMaterial =>
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        defines: far ? { BACK: '' } : {},
        transparent: true,
        side: far ? THREE.BackSide : THREE.FrontSide,
        depthWrite: !far,
      });
    this.back = material(true);
    this.front = material(false);
    // Of two things as far away as each other the one made first is drawn first.
    for (const one of [this.back, this.front]) {
      const mesh = new THREE.Mesh(geometry, one);
      mesh.renderOrder = order;
      this.object.add(mesh);
    }
    this.set('#ffffff', FIGURE_LOOK);
  }

  set(colour: string, look: FigureLook): void {
    this.uniforms.uColour.value.set(colour);
    this.uniforms.uLook.value.set(look.body, look.rim, look.shine);
  }

  dispose(): void {
    this.back.dispose();
    this.front.dispose();
  }
}
