import * as THREE from 'three';
import { ps1Material, type Ps1Fog } from '../../display/ps1';
import { CameraRig, DEG, color, flickering, grainTexture, handheld, num } from '../kit';
import { LOOK_PARAMS, type ParamValues } from '../scene';
import type { PlaceContext, PlaceDef, PlaceInstance, Stage } from '../stage';
import { Surface, corners, hull, lampLight, type Block, type Lamp } from '../surface';
import { floodWater } from './water';

/** The lamp hangs on a cord and swings like a pendulum: radians per second at speed 1. */
const SWING_RATE = 1.3;
/** A shadow lies this far above the floor, so that the two do not fight for the same pixels. */
const SHADOW_LIFT = 0.012;
/** The outline of a box thrown on the floor has six corners at most: four triangles. */
const SHADOW_TRIANGLES = 4;
/** Shadows are worked out as if from a lamp no lower than this above what throws them. */
const CASTER_TOP = 0.92;
/** Where things stand besides the middle: around it, inside the walls. */
const SPOTS: readonly [number, number][] = [
  [0, 0],
  [-1.7, -1.1],
  [1.8, -0.5],
  [-2.3, 0.9],
  [2.4, -1.9],
  [0.9, -2.1],
  [-0.9, -2.3],
  [2.6, 1.2],
  [-2.8, -1.7],
  [1.4, 1.6],
];

function build(values: ParamValues, context: PlaceContext): PlaceInstance {
  const n = (name: string) => Number(values[name]);
  const tone = (name: string) => new THREE.Color(String(values[name]));
  const { scene, keep, stream, bare } = context;

  const snap = n('snap');
  const dark = tone('dark');
  const fog: Ps1Fog = { color: String(values.dark), near: n('fogNear'), far: Math.max(n('fogFar'), n('fogNear') + 1) };
  const ambient = dark.clone().multiplyScalar(n('ambient'));

  const camera = new THREE.PerspectiveCamera(n('camFov'), 1, 0.05, 200);
  const rig = new CameraRig(
    camera,
    { x: n('camX'), height: n('camHeight'), distance: n('camDistance'), pitch: n('camPitch'), yaw: n('camYaw'), roll: n('camRoll') },
    handheld(stream(4), n('drift'), n('driftSpeed')),
  );

  // The room: what stands in the middle faces the far wall.
  const width = n('roomWidth');
  const depth = n('roomDepth');
  const height = n('roomHeight');
  const far = -Math.min(n('wallDistance'), depth - 1);
  const back = far + depth;
  const wall = tone('wall');
  const floor = tone('floor');
  const room = new Surface()
    .sheet(new THREE.Vector3(-width / 2, 0, back), new THREE.Vector3(width, 0, 0), new THREE.Vector3(0, 0, -depth), floor)
    .sheet(new THREE.Vector3(-width / 2, height, far), new THREE.Vector3(width, 0, 0), new THREE.Vector3(0, 0, depth), wall)
    .sheet(new THREE.Vector3(-width / 2, 0, far), new THREE.Vector3(width, 0, 0), new THREE.Vector3(0, height, 0), wall)
    .sheet(new THREE.Vector3(width / 2, 0, back), new THREE.Vector3(-width, 0, 0), new THREE.Vector3(0, height, 0), wall)
    .sheet(new THREE.Vector3(-width / 2, 0, back), new THREE.Vector3(0, 0, -depth), new THREE.Vector3(0, height, 0), wall)
    .sheet(new THREE.Vector3(width / 2, 0, far), new THREE.Vector3(0, 0, depth), new THREE.Vector3(0, height, 0), wall);
  const concrete = keep(grainTexture(stream(1), n('stains')));
  const roomMesh = new THREE.Mesh(keep(room.geometry()), keep(ps1Material({ map: concrete, vertexColors: true, fog, snap, light: null })));
  roomMesh.frustumCulled = false;
  if (!bare) scene.add(roomMesh);

  // The lamp: a bare bulb on a cord.
  const lampHome = new THREE.Vector3(n('lampX'), Math.min(n('lampHeight'), height - 0.05), n('lampZ'));
  const lamp: Lamp = { position: lampHome.clone(), color: tone('lampColor'), reach: n('lampReach'), amount: n('lampAmount') };
  const lampAmount = lamp.amount;
  const bulbMaterial = keep(ps1Material({ color: String(values.lampColor), fog: null, snap, light: null }));
  const bulb = new THREE.Mesh(keep(new THREE.BoxGeometry(0.09, 0.12, 0.09)), bulbMaterial);
  bulb.frustumCulled = false;
  const cordPositions = new THREE.BufferAttribute(new Float32Array(6), 3);
  const cordGeometry = keep(new THREE.BufferGeometry());
  cordGeometry.setAttribute('position', cordPositions);
  const cord = new THREE.LineSegments(cordGeometry, keep(ps1Material({ color: '#0c0c0c', fog, snap, light: null })));
  cord.frustumCulled = false;
  if (!bare) scene.add(bulb, cord);
  const lampSway = n('lampSway');
  const lampPhase = stream(3)() * Math.PI * 2;
  const flicker = n('flicker');
  const bulbTone = tone('lampColor');
  const seed = Math.floor(stream(6)() * 1e6);

  const water = n('flood') > 0 && !bare ? floodWater(context, { x0: -width / 2, x1: width / 2, z0: far, z1: back }, n('flood'), fog, snap) : null;
  if (water) scene.add(water.mesh);

  // Shadows of what stands here: the outline of every box, thrown on the floor from the lamp.
  // The floor under them is left with the ambient light alone. `shadowTurn` throws them from a
  // lamp that is not there.
  const shadowStrength = n('shadow');
  const shadowTurn = n('shadowTurn') * DEG;
  const shadowStretch = Math.max(0.1, n('shadowStretch'));
  const shadowMaterial = keep(ps1Material({ fog, snap, light: null }));
  shadowMaterial.polygonOffset = true;
  shadowMaterial.polygonOffsetFactor = -2;
  shadowMaterial.polygonOffsetUnits = -2;
  let shadows: { positions: THREE.BufferAttribute; corners: THREE.Vector3[][]; around: THREE.Vector3 } | null = null;
  const source = new THREE.Vector3();
  const moveShadows = (): void => {
    if (!shadows) return;
    const { around } = shadows;
    // The lamp as the shadows see it: turned about what stands in the middle, and lowered to stretch them.
    source.copy(lamp.position).sub(around).applyAxisAngle(THREE.Object3D.DEFAULT_UP, shadowTurn).add(around);
    source.y = CASTER_TOP + Math.max(0.3, (source.y - CASTER_TOP) / shadowStretch);
    const out = shadows.positions.array as Float32Array;
    out.fill(0);
    shadows.corners.forEach((points, b) => {
      const thrown = points.map((point): [number, number] => {
        const t = (source.y - SHADOW_LIFT) / Math.max(0.2, source.y - point.y);
        return [source.x + (point.x - source.x) * t, source.z + (point.z - source.z) * t];
      });
      const outline = hull(thrown);
      const triangles = Math.min(SHADOW_TRIANGLES, outline.length - 2);
      for (let k = 0; k < triangles; k++) {
        // The outline goes counter-clockwise on x and z, which faces down: take it backwards.
        const fan = [outline[0], outline[k + 2], outline[k + 1]];
        fan.forEach(([x, z], corner) => {
          const at = (b * SHADOW_TRIANGLES + k) * 9 + corner * 3;
          out[at] = x;
          out[at + 1] = SHADOW_LIFT;
          out[at + 2] = z;
        });
      }
    });
    shadows.positions.needsUpdate = true;
    // What the floor by the middle gets from the lamp is taken away, as much as `shadow` says.
    const lit = lampLight(lamp, around.x, 0, around.z, 0, 1, 0) * (1 - shadowStrength);
    (shadowMaterial.uniforms.uColor.value as THREE.Color).setRGB(
      floor.r * (ambient.r + lamp.color.r * lit),
      floor.g * (ambient.g + lamp.color.g * lit),
      floor.b * (ambient.b + lamp.color.b * lit),
    );
  };

  const jitter = stream(5);
  const stage: Stage = {
    scene,
    rig,
    keep,
    stream,
    snap,
    fog,
    lamps: [lamp],
    ambient,
    cell: 1,
    sky: false,
    lightTurn: Math.atan2(lampHome.x, lampHome.z),
    spots: SPOTS.map(([x, z], i) =>
      i === 0 ? new THREE.Vector3(x, 0, z) : new THREE.Vector3(x + (jitter() - 0.5) * 0.4, 0, z + (jitter() - 0.5) * 0.4),
    ),
  };

  return {
    stage,
    subject(size, portrait) {
      if (portrait) rig.portrait(portrait, size);
      // The room does not grow: a large thing is seen from as far as the walls allow.
      else if (size > 0) rig.scale(Math.min(back - 0.4, rig.distance * Math.min(1.6, Math.max(0.8, size / 0.92))) / rig.distance);
    },
    casters(blocks, around) {
      // A shadow needs a floor to lie on.
      if (bare || shadowStrength <= 0 || blocks.length === 0) return;
      const positions = new THREE.BufferAttribute(new Float32Array(blocks.length * SHADOW_TRIANGLES * 9), 3);
      const geometry = keep(new THREE.BufferGeometry());
      geometry.setAttribute('position', positions);
      const mesh = new THREE.Mesh(geometry, shadowMaterial);
      mesh.frustumCulled = false;
      scene.add(mesh);
      shadows = { positions, corners: blocks.map((block: Block) => corners(block)), around: around.clone() };
    },
    update(seconds, aspect) {
      const swing = seconds * SWING_RATE;
      lamp.position.set(
        lampHome.x + lampSway * Math.sin(swing + lampPhase),
        lampHome.y,
        lampHome.z + lampSway * 0.4 * Math.sin(swing * 0.83 + lampPhase * 1.7),
      );
      const power = flickering(seconds, flicker, seed);
      lamp.amount = lampAmount * power;
      bulb.position.copy(lamp.position);
      (bulbMaterial.uniforms.uColor.value as THREE.Color).copy(bulbTone).multiplyScalar(0.25 + 0.75 * power);
      cordPositions.setXYZ(0, lampHome.x, height, lampHome.z);
      cordPositions.setXYZ(1, lamp.position.x, lamp.position.y, lamp.position.z);
      cordPositions.needsUpdate = true;
      room.light(stage.lamps, ambient);
      moveShadows();
      water?.update(seconds);
      rig.update(seconds, aspect);
    },
  };
}

/** IMAGE 0002: a concrete room with a lamp. A chair stands in it, turned to an empty wall. */
export const room: PlaceDef = {
  id: 'room',
  channel: 0,
  native: 'chair',
  params: {
    wall: color('#c9cbc6'),
    floor: color('#a3a5a0'),
    lampColor: color('#fff1d2'),
    dark: color('#9aa6b0'),
    ambient: num(0.6, 0, 1.5, 0.01),
    stains: num(0.22, 0, 0.8, 0.01),
    fogNear: num(4, 0, 40, 0.5),
    fogFar: num(40, 2, 120, 1),
    roomWidth: num(7, 3, 16, 0.1),
    roomDepth: num(10, 4, 24, 0.1),
    roomHeight: num(3.2, 2.2, 8, 0.05),
    wallDistance: num(3, 1, 12, 0.1),
    flood: num(0, 0, 1.5, 0.01),
    lampX: num(0.9, -6, 6, 0.05),
    lampZ: num(0.4, -10, 10, 0.05),
    lampHeight: num(2.5, 1, 8, 0.05),
    lampReach: num(11, 2, 30, 0.5),
    lampAmount: num(1, 0, 3, 0.01),
    lampSway: num(0.12, 0, 1.5, 0.01),
    flicker: num(0, 0, 1, 0.01),
    shadow: num(0.8, 0, 1, 0.01),
    shadowTurn: num(0, -180, 180, 1),
    shadowStretch: num(1, 0.3, 6, 0.05),
    camX: num(0.5, -5, 5, 0.05),
    camHeight: num(1.45, 0.2, 6, 0.05),
    camDistance: num(4.2, 1, 14, 0.1),
    camFov: num(48, 20, 100, 1),
    camPitch: num(-5, -40, 40, 0.5),
    camYaw: num(4, -60, 60, 0.5),
    camRoll: num(0, -30, 30, 0.5),
    drift: num(0.3, 0, 1, 0.01),
    driftSpeed: num(1, 0, 4, 0.05),
    ...LOOK_PARAMS,
  },
  moods: {
    dream: {},
    // A cold lamp that hardly reaches the walls, seen from above.
    sad: {
      wall: '#9aa0a2', floor: '#7b8082', lampColor: '#cfd6dc', dark: '#7f8a94', ambient: 0.5, stains: 0.4, fogNear: 3,
      fogFar: 26, lampReach: 9, lampAmount: 0.6, lampSway: 0.04, camHeight: 1.9, camDistance: 5.2, camPitch: -12,
      drift: 0.15, driftSpeed: 0.6, blur: 1, noise: 0.2, vignette: 0.35,
    },
    // The room is too high, the camera lies on the floor, and the shadow falls towards the lamp.
    strange: {
      wall: '#b9b78a', floor: '#7d8a6e', lampColor: '#f4ffc8', dark: '#5a6a58', roomHeight: 5, lampHeight: 3.6,
      lampSway: 0.5, shadowTurn: 150, shadowStretch: 2.2, camX: -0.8, camHeight: 0.5, camFov: 62, camPitch: 6,
      camYaw: -8, camRoll: 6, snap: 120, chroma: 1.4,
    },
    // A low sodium lamp that swings and fails, close, the corners gone.
    anxious: {
      wall: '#a08f7c', floor: '#6b5f55', lampColor: '#ffb46a', dark: '#221f26', ambient: 0.6, fogNear: 3, fogFar: 22,
      lampHeight: 1.9, lampReach: 9, lampAmount: 1.6, lampSway: 0.35, flicker: 0.6, shadowStretch: 2, camHeight: 1.2,
      camDistance: 2.6, camFov: 62, camPitch: -3, drift: 0.7, driftSpeed: 1.8, depth: 4, smear: 2, chroma: 1.2,
      glow: 0.2, noise: 0.35, vignette: 0.45,
    },
    // One red lamp beyond what stands here, low. It is a shape, and its shadow comes this way.
    fear: {
      wall: '#a8645a', floor: '#6a4640', lampColor: '#ff3a22', dark: '#0a0405', ambient: 0.6, fogNear: 3, fogFar: 18,
      lampX: 0.2, lampZ: -1.4, lampHeight: 1.5, lampReach: 8, lampAmount: 1.8, lampSway: 0.2, flicker: 0.85,
      shadowStretch: 3, camHeight: 0.7, camDistance: 3.2, camFov: 58, camPitch: 4, camRoll: -4, drift: 0.45,
      driftSpeed: 0.5, depth: 4, blur: 1.2, smear: 2, chroma: 1.1, glow: 0.55, noise: 0.3, vignette: 0.55,
    },
  },
  dissolve: ['dark'],
  build,
};
