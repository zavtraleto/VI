import * as THREE from 'three';
import { ps1Material } from '../../display/ps1';
import { DEG, color, num } from '../kit';
import type { ThingDef } from '../stage';

/** The sun stands this far from the camera: inside the sky, which is drawn under everything. */
const DISTANCE = 90;
const SEGMENTS = 20;
/** A sun that goes down stops here, in degrees: just under the horizon. */
const SET = -2;

/**
 * The red sun. From the other side the surface is the sky, and the only one apart from the
 * rest above it is a red disc: when it is in the picture, the player is being looked at. It
 * stands where the light of the place comes from, and only where there is a sky.
 */
export const sun: ThingDef = {
  id: 'sun',
  channel: 1,
  sky: true,
  params: {
    color: color('#d8261a'),
    /** Degrees above the horizon, and across, as seen from the camera. */
    elevation: num(9, -2, 60, 0.5),
    size: num(3.2, 0.5, 15, 0.1),
    pulse: num(0.2, 0, 1, 0.01),
    /** How fast it goes down, in degrees a minute: it stops just under the horizon. 0 leaves it where it stands. */
    fall: num(0, 0, 5, 0.01),
  },
  moods: {
    dream: {},
    sad: { color: '#a8382c', elevation: 5 },
    strange: { size: 5, elevation: 15 },
    anxious: { size: 4.2, elevation: 4, pulse: 0.4 },
    fear: { color: '#ff2a14', size: 6.5, elevation: 7, pulse: 0.6 },
  },
  tint: ['color'],
  build(values, stage) {
    const object = new THREE.Group();
    const radius = Math.tan(Number(values.size) * DEG * 0.5) * DISTANCE;
    const material = stage.keep(ps1Material({ color: String(values.color), fog: null, snap: stage.snap, light: null }));
    // Over the sky, under everything else: whatever stands in front of it hides it.
    material.depthTest = false;
    material.depthWrite = false;
    const disc = new THREE.Mesh(stage.keep(new THREE.CircleGeometry(radius, SEGMENTS)), material);
    disc.renderOrder = -0.5;
    disc.frustumCulled = false;
    object.add(disc);
    const start = Number(values.elevation);
    const fall = Number(values.fall);
    const pulse = Number(values.pulse);
    const tone = new THREE.Color(String(values.color));
    const camera = stage.rig.camera;
    const turn = stage.lightTurn;
    return {
      object,
      height: 0,
      update(seconds) {
        const told = stage.live?.sun ?? null;
        const elevation = (told ? told.at : Math.max(SET, start - (fall * seconds) / 60)) * DEG;
        // It goes where the camera goes, like the sky: it is never nearer.
        disc.position.set(
          camera.position.x + Math.sin(turn) * Math.cos(elevation) * DISTANCE,
          camera.position.y + Math.sin(elevation) * DISTANCE,
          camera.position.z + Math.cos(turn) * Math.cos(elevation) * DISTANCE,
        );
        disc.lookAt(camera.position);
        const flare = stage.live?.flare ?? 0;
        disc.scale.setScalar((told ? told.size : 1) * (1 + 0.3 * flare));
        const beat = 1 + pulse * 0.08 * Math.sin(seconds * 0.9) + 0.6 * flare;
        if (told) (material.uniforms.uColor.value as THREE.Color).setRGB(told.r, told.g, told.b).multiplyScalar(beat);
        else (material.uniforms.uColor.value as THREE.Color).copy(tone).multiplyScalar(beat);
      },
    };
  },
};
