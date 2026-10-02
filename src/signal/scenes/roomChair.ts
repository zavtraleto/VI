import * as THREE from 'three';
import { ps1Material, type Ps1Fog } from '../../display/ps1';
import { DEG, bool, color, flickering, grainTexture, handheld, keeper, num, streams } from '../kit';
import { LOOK_PARAMS, type ParamValues, type SceneDef, type SceneInstance } from '../scene';
import { Surface, corners, hull, lampLight, type Block, type Lamp } from '../surface';

/** The lamp hangs on a cord and swings like a pendulum: radians per second at speed 1. */
const SWING_RATE = 1.3;
/** A shadow lies this far above the floor, so that the two do not fight for the same pixels. */
const SHADOW_LIFT = 0.012;
/** The outline of a box thrown on the floor has six corners at most: four triangles. */
const SHADOW_TRIANGLES = 4;
const CHAIR_TOP = 0.92;

/**
 * A plain chair out of boxes, standing on the origin. Whoever sits on it looks down -z; the
 * back of the chair is on the +z side.
 */
function chairBlocks(place: THREE.Matrix4): Block[] {
  const parts: [number, number, number, number, number, number][] = [
    // Seat.
    [0.42, 0.035, 0.42, 0, 0.45, 0],
    // Legs.
    [0.04, 0.45, 0.04, -0.19, 0.225, -0.19],
    [0.04, 0.45, 0.04, 0.19, 0.225, -0.19],
    [0.04, 0.45, 0.04, -0.19, 0.225, 0.19],
    [0.04, 0.45, 0.04, 0.19, 0.225, 0.19],
    // Back: two uprights and two rails.
    [0.04, 0.47, 0.04, -0.19, 0.685, 0.19],
    [0.04, 0.47, 0.04, 0.19, 0.685, 0.19],
    [0.42, 0.09, 0.03, 0, 0.86, 0.19],
    [0.42, 0.05, 0.03, 0, 0.66, 0.19],
  ];
  return parts.map(([w, h, d, x, y, z]) => ({
    size: new THREE.Vector3(w, h, d),
    matrix: place.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z)),
  }));
}

function build(values: ParamValues, seed: number): SceneInstance {
  const n = (name: string) => Number(values[name]);
  const tone = (name: string) => new THREE.Color(String(values[name]));
  const stream = streams(seed);
  const { keep, dispose } = keeper();

  const snap = n('snap');
  const dark = tone('dark');
  const fog: Ps1Fog = { color: String(values.dark), near: n('fogNear'), far: Math.max(n('fogFar'), n('fogNear') + 1) };
  const ambient = dark.clone().multiplyScalar(n('ambient'));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(n('camFov'), 1, 0.05, 200);
  camera.rotation.order = 'YXZ';

  // The room: the chair stands on the origin and faces the far wall.
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
  const roomMesh = new THREE.Mesh(
    keep(room.geometry()),
    keep(ps1Material({ map: concrete, vertexColors: true, fog, snap, light: null })),
  );
  roomMesh.frustumCulled = false;
  scene.add(roomMesh);

  // The chair, and with `twin` a second one that takes almost the same place.
  const random = stream(2);
  const chairAt = new THREE.Vector3(n('chairX'), 0, 0);
  const place = (shift: number, turn: number): THREE.Matrix4 =>
    new THREE.Matrix4()
      .makeTranslation(chairAt.x + shift, 0, chairAt.z + shift * 0.4)
      .multiply(new THREE.Matrix4().makeRotationY(turn));
  // Never quite square to the wall: someone left it there.
  const askew = (random() - 0.5) * 6 * DEG;
  const blocks = chairBlocks(place(0, n('chairTurn') * DEG + askew));
  if (values.twin === true) blocks.push(...chairBlocks(place(n('twinShift'), (n('chairTurn') + n('twinTurn')) * DEG + askew)));
  const chairTone = tone('chairColor');
  const chair = new Surface();
  for (const block of blocks) chair.box(block, chairTone);
  const chairMesh = new THREE.Mesh(keep(chair.geometry()), keep(ps1Material({ vertexColors: true, fog, snap, light: null })));
  chairMesh.frustumCulled = false;
  scene.add(chairMesh);

  // The lamp: a bare bulb on a cord.
  const lampHome = new THREE.Vector3(n('lampX'), Math.min(n('lampHeight'), height - 0.05), n('lampZ'));
  const lamp: Lamp = { position: lampHome.clone(), color: tone('lampColor'), reach: n('lampReach'), amount: n('lampAmount') };
  const lampAmount = lamp.amount;
  const bulbMaterial = keep(ps1Material({ color: String(values.lampColor), fog: null, snap, light: null }));
  const bulb = new THREE.Mesh(keep(new THREE.BoxGeometry(0.09, 0.12, 0.09)), bulbMaterial);
  bulb.frustumCulled = false;
  scene.add(bulb);
  const cordPositions = new THREE.BufferAttribute(new Float32Array(6), 3);
  const cordGeometry = keep(new THREE.BufferGeometry());
  cordGeometry.setAttribute('position', cordPositions);
  const cord = new THREE.LineSegments(cordGeometry, keep(ps1Material({ color: '#0c0c0c', fog, snap, light: null })));
  cord.frustumCulled = false;
  scene.add(cord);
  const lampSway = n('lampSway');
  const lampPhase = stream(3)() * Math.PI * 2;
  const flicker = n('flicker');
  const bulbTone = tone('lampColor');

  // Shadows of the chair: the outline of every box, thrown on the floor from the lamp. The
  // floor under them is left with the ambient light alone. `shadowTurn` throws them from a
  // lamp that is not there.
  const shadowStrength = n('shadow');
  const shadowTurn = n('shadowTurn') * DEG;
  const shadowStretch = Math.max(0.1, n('shadowStretch'));
  const shadowPositions = new THREE.BufferAttribute(new Float32Array(blocks.length * SHADOW_TRIANGLES * 9), 3);
  const shadowGeometry = keep(new THREE.BufferGeometry());
  shadowGeometry.setAttribute('position', shadowPositions);
  const shadowMaterial = keep(ps1Material({ fog, snap, light: null }));
  shadowMaterial.polygonOffset = true;
  shadowMaterial.polygonOffsetFactor = -2;
  shadowMaterial.polygonOffsetUnits = -2;
  const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadowMesh.frustumCulled = false;
  shadowMesh.visible = shadowStrength > 0;
  scene.add(shadowMesh);
  const blockCorners = blocks.map(corners);
  const source = new THREE.Vector3();
  const moveShadows = (): void => {
    // The lamp as the shadows see it: turned about the chair, and lowered to stretch them.
    source.copy(lamp.position).sub(chairAt).applyAxisAngle(THREE.Object3D.DEFAULT_UP, shadowTurn).add(chairAt);
    source.y = CHAIR_TOP + Math.max(0.3, (source.y - CHAIR_TOP) / shadowStretch);
    const out = shadowPositions.array as Float32Array;
    out.fill(0);
    blockCorners.forEach((points, b) => {
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
    shadowPositions.needsUpdate = true;
    // What the floor by the chair gets from the lamp is taken away, as much as `shadow` says.
    const lit = lampLight(lamp, chairAt.x, 0, chairAt.z, 0, 1, 0) * (1 - shadowStrength);
    (shadowMaterial.uniforms.uColor.value as THREE.Color).setRGB(
      floor.r * (ambient.r + lamp.color.r * lit),
      floor.g * (ambient.g + lamp.color.g * lit),
      floor.b * (ambient.b + lamp.color.b * lit),
    );
  };

  const camX = n('camX');
  const camHeight = n('camHeight');
  const camDistance = n('camDistance');
  const camPitch = n('camPitch') * DEG;
  const camYaw = n('camYaw') * DEG;
  const camRoll = n('camRoll') * DEG;
  const hand = handheld(stream(4), n('drift'), n('driftSpeed'));
  const lamps = [lamp];

  return {
    scene,
    camera,
    update(timeMs, aspect) {
      if (camera.aspect !== aspect) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      }
      const seconds = timeMs / 1000;

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

      room.light(lamps, ambient);
      chair.light(lamps, ambient);
      moveShadows();

      const sway = hand(seconds);
      // A tall window is too narrow for a camera that stands or looks aside: bring it back in.
      const narrow = Math.min(1, aspect);
      camera.position.set(camX * narrow + sway.x, camHeight + sway.y, camDistance);
      camera.rotation.set(camPitch + sway.pitch, camYaw * narrow + sway.yaw, camRoll + sway.roll);
    },
    dispose,
  };
}

/** IMAGE 0002: a concrete room, a chair turned to an empty wall. */
export const roomChair: SceneDef = {
  id: 'room_chair',
  params: {
    wall: color('#c9cbc6'),
    floor: color('#a3a5a0'),
    chairColor: color('#7a6a58'),
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
    chairX: num(0, -4, 4, 0.05),
    chairTurn: num(0, -180, 180, 1),
    twin: bool(false),
    twinShift: num(0.12, -0.6, 0.6, 0.01),
    twinTurn: num(14, -90, 90, 1),
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
  variants: {
    a: {},
    // IMAGE 0006: the same room, two chairs take almost the same place.
    b: { twin: true },
  },
  moods: {
    dream: {},
    // A cold lamp that hardly reaches the walls, seen from above.
    sad: {
      wall: '#9aa0a2', floor: '#7b8082', chairColor: '#4b4640', lampColor: '#cfd6dc', dark: '#7f8a94', ambient: 0.5,
      stains: 0.4, fogNear: 3, fogFar: 26, lampReach: 9, lampAmount: 0.6, lampSway: 0.04, camHeight: 1.9,
      camDistance: 5.2, camPitch: -12, drift: 0.15, driftSpeed: 0.6, blur: 1, noise: 0.2, vignette: 0.35,
    },
    // The room is too high, the camera lies on the floor, and the shadow falls towards the lamp.
    strange: {
      wall: '#b9b78a', floor: '#7d8a6e', lampColor: '#f4ffc8', dark: '#5a6a58', roomHeight: 5, lampHeight: 3.6,
      lampSway: 0.5, shadowTurn: 150, shadowStretch: 2.2, camX: -0.8, camHeight: 0.5, camFov: 62, camPitch: 6,
      camYaw: -8, camRoll: 6, snap: 120, chroma: 1.4,
    },
    // A low sodium lamp that swings and fails, the chair close, the corners gone.
    anxious: {
      wall: '#a08f7c', floor: '#6b5f55', chairColor: '#2a2420', lampColor: '#ffb46a', dark: '#221f26', ambient: 0.6,
      fogNear: 3, fogFar: 22, lampHeight: 1.9, lampReach: 9, lampAmount: 1.6, lampSway: 0.35, flicker: 0.6,
      shadowStretch: 2, camHeight: 1.2, camDistance: 2.6, camFov: 62, camPitch: -3, drift: 0.7, driftSpeed: 1.8,
      depth: 4, smear: 2, chroma: 1.2, glow: 0.2, noise: 0.35, vignette: 0.45,
    },
    // One red lamp beyond the chair, low. The chair is a shape and its shadow comes this way.
    fear: {
      wall: '#a8645a', floor: '#6a4640', chairColor: '#0a0606', lampColor: '#ff3a22', dark: '#0a0405', ambient: 0.6,
      fogNear: 3, fogFar: 18, lampX: 0.2, lampZ: -1.4, lampHeight: 1.5, lampReach: 8, lampAmount: 1.8, lampSway: 0.2,
      flicker: 0.85, shadowStretch: 3, camHeight: 0.7, camDistance: 3.2, camFov: 58, camPitch: 4, camRoll: -4,
      drift: 0.45, driftSpeed: 0.5, depth: 4, blur: 1.2, smear: 2, chroma: 1.1, glow: 0.55, noise: 0.3,
      vignette: 0.55,
    },
  },
  build,
};
