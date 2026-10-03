import * as THREE from 'three';
import type { LayerLook } from './layer';
import { LENS_GLSL, lensBends } from './lens';

/**
 * A layer seen through its lens, for the passes that put a layer on the screen: the part of
 * a fragment shader, after `uMap` and `uArea` are declared. `lensPoint` is the point of the
 * layer a point of the screen shows; `lensMisses` says the lens looks past the part of the
 * layer it lies over, as it does in the corners; `lensTexel` reads the layer.
 *
 * Towards its edges the lens presses several pixels of the layer into one of the screen, so
 * four of them are read across that pixel: read once, the edges would glitter as the picture moves.
 */
export const LENS_PASS = /* glsl */ `
uniform bool uLens;
/** Strength to the left, the right, the bottom and the top. */
uniform vec4 uLensK;
uniform vec2 uLensCentre;
uniform vec2 uLensFrom;
${LENS_GLSL}
vec2 lensPoint(vec2 uv) {
  return lensUv(uv, uArea, uLensCentre, uLensFrom, uLensK);
}

bool lensMisses(vec2 point) {
  return point.x < uArea.x || point.y < uArea.y || point.x > uArea.z || point.y > uArea.w;
}

vec4 lensTexel(vec2 at) {
  vec2 dx = dFdx(at);
  vec2 dy = dFdy(at);
  return 0.25 * (
    texture2D(uMap, at - 0.125 * dx - 0.375 * dy) +
    texture2D(uMap, at + 0.375 * dx - 0.125 * dy) +
    texture2D(uMap, at - 0.375 * dx + 0.125 * dy) +
    texture2D(uMap, at + 0.125 * dx + 0.375 * dy)
  );
}
`;

/** What such a pass is told of the lens. */
export interface LensUniforms {
  uLens: { value: boolean };
  uLensK: { value: THREE.Vector4 };
  uLensCentre: { value: THREE.Vector2 };
  uLensFrom: { value: THREE.Vector2 };
}

export function lensUniforms(): LensUniforms {
  return {
    uLens: { value: false },
    uLensK: { value: new THREE.Vector4(0, 0, 0, 0) },
    uLensCentre: { value: new THREE.Vector2(0.5, 0.5) },
    uLensFrom: { value: new THREE.Vector2(0.5, 0.5) },
  };
}

/** Takes the lens of a look. `on` is false for a pass that keeps the layer in its own pixels. */
export function setLens(uniforms: LensUniforms, look: LayerLook, on: boolean): void {
  const { lens: k, lensCentre: centre } = look;
  const from = look.lensFrom ?? centre;
  uniforms.uLens.value = on && (lensBends(k) || from.x !== centre.x || from.y !== centre.y);
  if (!uniforms.uLens.value) return;
  if (typeof k === 'number') uniforms.uLensK.value.set(k, k, k, k);
  else uniforms.uLensK.value.set(k.left, k.right, k.bottom, k.top);
  uniforms.uLensCentre.value.set(centre.x, centre.y);
  uniforms.uLensFrom.value.set(from.x, from.y);
}
