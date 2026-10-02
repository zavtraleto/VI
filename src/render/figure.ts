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
