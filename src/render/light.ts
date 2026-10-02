import * as THREE from 'three';

/**
 * Light added to what is behind it. The alpha of the picture is left alone: the board is drawn
 * over nothing, and light over nothing has to stay light, not turn into a dark patch.
 */
export const LIGHT = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const;
