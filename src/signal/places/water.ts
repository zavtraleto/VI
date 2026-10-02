import * as THREE from 'three';
import { ps1Material, type Ps1Fog } from '../../display/ps1';
import type { PlaceContext } from '../stage';

/** Water that has come in: how far apart its vertices are, how high its ripples, how dark it is under the air. */
const CELL = 0.5;
const RIPPLE = 0.025;
const DIM = 0.55;

/**
 * Water standing inside a place that should be dry, `level` metres deep: two places in one
 * frame. It is the colour of the air of the place, darker, and it ripples a little.
 */
export function floodWater(
  context: PlaceContext,
  area: { x0: number; x1: number; z0: number; z1: number },
  level: number,
  fog: Ps1Fog,
  snap: number,
): { mesh: THREE.Mesh; update(seconds: number): void } {
  const columns = Math.max(1, Math.ceil((area.x1 - area.x0) / CELL));
  const rows = Math.max(1, Math.ceil((area.z1 - area.z0) / CELL));
  const geometry = context.keep(new THREE.PlaneGeometry(area.x1 - area.x0, area.z1 - area.z0, columns, rows));
  geometry.rotateX(-Math.PI / 2);
  geometry.translate((area.x0 + area.x1) / 2, level, (area.z0 + area.z1) / 2);
  const tone = new THREE.Color(fog.color).multiplyScalar(DIM);
  // Light from above and a little behind: the ripples catch it, the flat water does not.
  const light = { direction: new THREE.Vector3(0.2, 0.9, -0.4).normalize(), amount: 0.45 };
  const mesh = new THREE.Mesh(geometry, context.keep(ps1Material({ color: tone, fog, snap, light })));
  mesh.frustumCulled = false;
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const random = context.stream(7);
  const phase = random() * Math.PI * 2;
  const heading = random() * Math.PI;
  return {
    mesh,
    update(seconds) {
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const z = position.getZ(i);
        const along = x * Math.cos(heading) + z * Math.sin(heading);
        position.setY(i, level + RIPPLE * Math.sin(along * 2.1 + seconds * 1.3 + phase) + RIPPLE * 0.6 * Math.sin(z * 3.3 - seconds * 1.7));
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
    },
  };
}
