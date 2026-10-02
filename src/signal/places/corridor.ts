import * as THREE from 'three';
import { ps1Material, type Ps1Fog } from '../../display/ps1';
import { CameraRig, color, flickering, grainTexture, handheld, num } from '../kit';
import { LOOK_PARAMS, type ParamValues } from '../scene';
import type { PlaceContext, PlaceDef, PlaceInstance, Stage } from '../stage';
import { Surface, type Lamp } from '../surface';
import { floodWater } from './water';

/** The light of the doorway comes from behind the end wall, so the wall itself stays dark. */
const DOOR_LAMP_BEHIND = 0.3;
const FRAME = 0.07;
const SIDE_DOOR = new THREE.Vector3(0.05, 2, 0.9);
const CEILING_LAMP = new THREE.Vector3(0.25, 0.04, 0.9);
/** The slow walk of `dolly` and the swing of the door: radians per second at speed 1. */
const DOLLY_RATE = 0.15;
const SWING_RATE = 0.5;
/** What stands in the corridor stands this far along from the camera to the door, and then farther. */
const SPOT_SHARE = 0.45;

function build(values: ParamValues, context: PlaceContext): PlaceInstance {
  const n = (name: string) => Number(values[name]);
  const tone = (name: string) => new THREE.Color(String(values[name]));
  const { scene, keep, stream, bare } = context;

  const snap = n('snap');
  const fog: Ps1Fog = { color: String(values.dark), near: n('fogNear'), far: Math.max(n('fogFar'), n('fogNear') + 1) };
  const ambient = tone('dark').multiplyScalar(n('ambient'));

  // The corridor runs along z: the end wall with the door is at 0, the camera looks down -z.
  const length = n('length');
  const width = n('width');
  const height = n('height');
  const camDistance = Math.min(n('camDistance'), length - 0.5);
  const camera = new THREE.PerspectiveCamera(n('camFov'), 1, 0.05, 300);
  const rig = new CameraRig(
    camera,
    { x: n('camX'), height: n('camHeight'), distance: camDistance, pitch: n('camPitch'), yaw: n('camYaw'), roll: n('camRoll') },
    handheld(stream(4), n('drift'), n('driftSpeed')),
  );

  const doorWidth = Math.min(n('doorWidth'), width - 0.2);
  const doorHeight = Math.min(n('doorHeight'), height - 0.1);
  const dado = Math.min(n('dado'), height);
  const wall = tone('wall');
  const wallLow = tone('wallLow');
  const shell = new Surface();
  /** A stretch of wall: painted darker up to the dado, lighter above it. */
  const wallSheet = (from: THREE.Vector3, along: THREE.Vector3, bottom: number, top: number): void => {
    const split = Math.min(Math.max(dado, bottom), top);
    if (split > bottom) shell.sheet(from.clone().setY(bottom), along, new THREE.Vector3(0, split - bottom, 0), wallLow);
    if (top > split) shell.sheet(from.clone().setY(split), along, new THREE.Vector3(0, top - split, 0), wall);
  };
  shell
    .sheet(new THREE.Vector3(-width / 2, 0, length), new THREE.Vector3(width, 0, 0), new THREE.Vector3(0, 0, -length), tone('floor'))
    .sheet(new THREE.Vector3(-width / 2, height, 0), new THREE.Vector3(width, 0, 0), new THREE.Vector3(0, 0, length), tone('ceiling'));
  wallSheet(new THREE.Vector3(-width / 2, 0, length), new THREE.Vector3(0, 0, -length), 0, height);
  wallSheet(new THREE.Vector3(width / 2, 0, 0), new THREE.Vector3(0, 0, length), 0, height);
  wallSheet(new THREE.Vector3(width / 2, 0, length), new THREE.Vector3(-width, 0, 0), 0, height);
  // The end wall, around the doorway.
  const side = (width - doorWidth) / 2;
  wallSheet(new THREE.Vector3(-width / 2, 0, 0), new THREE.Vector3(side, 0, 0), 0, height);
  wallSheet(new THREE.Vector3(doorWidth / 2, 0, 0), new THREE.Vector3(side, 0, 0), 0, height);
  wallSheet(new THREE.Vector3(-doorWidth / 2, 0, 0), new THREE.Vector3(doorWidth, 0, 0), doorHeight, height);
  const plaster = keep(grainTexture(stream(1), n('stains')));
  const shellMesh = new THREE.Mesh(keep(shell.geometry()), keep(ps1Material({ map: plaster, vertexColors: true, fog, snap, light: null })));
  shellMesh.frustumCulled = false;
  if (!bare) scene.add(shellMesh);

  // What stands in the corridor: the frame of the door, and shut doors along both walls.
  const fittings = new Surface();
  const doorTone = tone('doorColor');
  const block = (x: number, y: number, z: number, size: THREE.Vector3) => ({ size, matrix: new THREE.Matrix4().makeTranslation(x, y, z) });
  fittings
    .box(block(-doorWidth / 2 - FRAME / 2, doorHeight / 2, 0.02, new THREE.Vector3(FRAME, doorHeight, 0.06)), doorTone)
    .box(block(doorWidth / 2 + FRAME / 2, doorHeight / 2, 0.02, new THREE.Vector3(FRAME, doorHeight, 0.06)), doorTone)
    .box(block(0, doorHeight + FRAME / 2, 0.02, new THREE.Vector3(doorWidth + FRAME * 2, FRAME, 0.06)), doorTone);
  const sideDoors = Math.round(n('sideDoors'));
  for (let i = 0; i < sideDoors; i++) {
    const z = (length * (i + 0.75)) / (sideDoors + 0.5);
    for (const wallSide of [-1, 1]) fittings.box(block(wallSide * (width / 2 - SIDE_DOOR.x / 2), SIDE_DOOR.y / 2, z, SIDE_DOOR), doorTone);
  }
  const fittingsMesh = new THREE.Mesh(keep(fittings.geometry()), keep(ps1Material({ vertexColors: true, fog, snap, light: null })));
  fittingsMesh.frustumCulled = false;
  if (!bare) scene.add(fittingsMesh);

  // Beyond the doorway there is only light. The leaf of the door hangs on the left jamb and
  // opens away from the corridor, a dark shape against it.
  const beyond = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(width + 4, height + 2)),
    keep(ps1Material({ color: String(values.doorLight), fog: null, snap, light: null })),
  );
  beyond.position.set(0, height / 2, -1.2);
  beyond.frustumCulled = false;
  const hinge = new THREE.Group();
  hinge.position.set(-doorWidth / 2, 0, 0);
  const leaf = new THREE.Mesh(
    keep(new THREE.BoxGeometry(doorWidth, doorHeight, 0.04)),
    keep(ps1Material({ color: String(values.doorColor), fog, snap, light: null })),
  );
  leaf.position.set(doorWidth / 2, doorHeight / 2, -0.02);
  leaf.frustumCulled = false;
  hinge.add(leaf);
  if (!bare) scene.add(beyond, hinge);
  const doorOpen = n('doorOpen');
  const doorSwing = n('doorSwing');
  const doorGlow = n('doorGlow');
  const doorLamp: Lamp = {
    position: new THREE.Vector3(0, doorHeight * 0.6, -DOOR_LAMP_BEHIND),
    color: tone('doorLight'),
    reach: n('doorReach'),
    amount: doorGlow,
  };

  // Lamps on the ceiling. Some are dead from the start; one of the rest is failing.
  const random = stream(2);
  const count = Math.round(n('lamps'));
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const dead = new Set(order.slice(0, Math.round(n('deadLamps') * count)));
  const failing = order.find((i) => !dead.has(i)) ?? -1;
  const flicker = n('flicker');
  const lampAmount = n('lampAmount');
  const lampTone = tone('lampColor');
  const swingPhase = random() * Math.PI * 2;
  const seed = Math.floor(stream(6)() * 1e6);
  const ceilingLamps = Array.from({ length: count }, (_, i) => {
    const z = (length * (i + 0.5)) / count;
    const material = keep(ps1Material({ color: String(values.lampColor), fog, snap, light: null }));
    const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(CEILING_LAMP.x, CEILING_LAMP.y, CEILING_LAMP.z)), material);
    mesh.position.set(0, height - CEILING_LAMP.y / 2, z);
    mesh.frustumCulled = false;
    if (!bare) scene.add(mesh);
    const lamp: Lamp = { position: new THREE.Vector3(0, height - 0.3, z), color: lampTone, reach: n('lampReach'), amount: 0 };
    return { lamp, material, dead: dead.has(i), failing: i === failing, salt: seed + i * 7.3 };
  });

  const water = n('flood') > 0 && !bare ? floodWater(context, { x0: -width / 2, x1: width / 2, z0: 0, z1: length }, n('flood'), fog, snap) : null;
  if (water) scene.add(water.mesh);

  const dolly = Math.min(n('dolly'), camDistance - 1);
  const driftSpeed = n('driftSpeed');
  const spot = camDistance * SPOT_SHARE;
  const jitter = stream(5);
  const stage: Stage = {
    scene,
    rig,
    keep,
    stream,
    snap,
    fog,
    lamps: [doorLamp, ...ceilingLamps.map((item) => item.lamp)],
    ambient,
    cell: 1,
    sky: false,
    lightTurn: Math.PI,
    // Down the middle, then nearer the door and closer to the walls.
    spots: Array.from({ length: 10 }, (_, i) =>
      i === 0
        ? new THREE.Vector3(0, 0, spot)
        : new THREE.Vector3((i % 2 ? -1 : 1) * Math.min(width / 2 - 0.35, 0.3 + jitter() * 0.5), 0, Math.max(1, spot - i * spot * 0.12)),
    ),
  };
  // The camera looks at the door, wherever things stand.
  rig.target.set(0, 0, 0);

  return {
    stage,
    subject(size, portrait) {
      if (portrait) rig.portrait(portrait, size);
    },
    update(seconds, aspect) {
      // The door: how far it stands open decides how much light gets into the corridor.
      const open = Math.min(1, Math.max(0, doorOpen + doorSwing * Math.sin(seconds * SWING_RATE + swingPhase)));
      const angle = (open * Math.PI) / 2;
      hinge.rotation.y = angle;
      doorLamp.amount = doorGlow * (1 - Math.cos(angle));
      for (const item of ceilingLamps) {
        // The failing lamp takes the whole of `flicker`, the others a faint echo of it.
        const strength = item.failing ? flicker : flicker * flicker * 0.4;
        const power = item.dead ? 0 : flickering(seconds, strength, item.salt);
        item.lamp.amount = lampAmount * power;
        (item.material.uniforms.uColor.value as THREE.Color).copy(lampTone).multiplyScalar(0.12 + 0.88 * power);
      }
      shell.light(stage.lamps, ambient);
      fittings.light(stage.lamps, ambient);
      water?.update(seconds);
      rig.walked = dolly * 0.5 * (1 - Math.cos(seconds * DOLLY_RATE * driftSpeed));
      rig.update(seconds, aspect);
    },
  };
}

/** IMAGE 0004: an empty corridor, a bright door at the end of it. */
export const corridor: PlaceDef = {
  id: 'corridor',
  channel: 2,
  // The door at the end is part of the corridor itself.
  native: null,
  params: {
    wall: color('#dcdfd6'),
    wallLow: color('#a9bdb2'),
    floor: color('#9a9d94'),
    ceiling: color('#e4e4dc'),
    doorColor: color('#5b6660'),
    doorLight: color('#fff8e6'),
    lampColor: color('#f2f6ff'),
    dark: color('#8c9aa0'),
    ambient: num(0.55, 0, 1.5, 0.01),
    stains: num(0.18, 0, 0.8, 0.01),
    fogNear: num(6, 0, 60, 0.5),
    fogFar: num(60, 2, 200, 1),
    length: num(26, 6, 80, 0.5),
    width: num(2.4, 1.2, 8, 0.05),
    height: num(2.7, 2.1, 7, 0.05),
    dado: num(1.1, 0, 3, 0.05),
    flood: num(0, 0, 1.5, 0.01),
    doorWidth: num(0.9, 0.5, 3, 0.05),
    doorHeight: num(2.05, 1.5, 5, 0.05),
    doorOpen: num(1, 0, 1, 0.01),
    doorSwing: num(0, 0, 1, 0.01),
    doorGlow: num(1.6, 0, 4, 0.01),
    doorReach: num(16, 2, 60, 0.5),
    sideDoors: num(3, 0, 8, 1),
    lamps: num(4, 0, 8, 1),
    lampAmount: num(0.55, 0, 3, 0.01),
    lampReach: num(7, 1, 30, 0.5),
    deadLamps: num(0, 0, 1, 0.05),
    flicker: num(0, 0, 1, 0.01),
    camX: num(0.15, -3, 3, 0.05),
    camHeight: num(1.5, 0.2, 5, 0.05),
    camDistance: num(20, 2, 78, 0.5),
    camFov: num(52, 20, 100, 1),
    camPitch: num(0, -40, 40, 0.5),
    camYaw: num(0, -60, 60, 0.5),
    camRoll: num(0, -30, 30, 0.5),
    dolly: num(1.5, 0, 30, 0.1),
    drift: num(0.3, 0, 1, 0.01),
    driftSpeed: num(1, 0, 4, 0.05),
    ...LOOK_PARAMS,
    glow: { ...LOOK_PARAMS.glow, value: 0.3 },
  },
  moods: {
    dream: {},
    // Longer and colder, half the lamps out, grey daylight in the door.
    sad: {
      wall: '#a7adae', wallLow: '#7b8789', floor: '#6c7172', ceiling: '#b3b7b7', doorLight: '#e6ecf0',
      lampColor: '#dfe6ea', dark: '#727c84', ambient: 0.5, stains: 0.35, fogNear: 4, fogFar: 50, length: 40,
      doorGlow: 1.3, lampAmount: 0.35, deadLamps: 0.5, camDistance: 34, dolly: 0.5, drift: 0.15, driftSpeed: 0.6,
      blur: 1, glow: 0.2, noise: 0.2, vignette: 0.35,
    },
    // Too narrow and too high, too many doors, seen from the floor. The door at the end is moving.
    strange: {
      wall: '#cfc98f', wallLow: '#8fa77c', floor: '#6f7a5e', ceiling: '#d8d39f', doorLight: '#f6ffcf',
      lampColor: '#f4ffd0', dark: '#55604c', width: 1.5, height: 4.2, dado: 1.6, doorWidth: 0.7, doorHeight: 3.4,
      doorSwing: 0.3, sideDoors: 6, lamps: 6, camX: 0, camHeight: 0.5, camDistance: 17, camFov: 70, camPitch: 9,
      camRoll: 4, snap: 120, chroma: 1.4,
    },
    // Sodium light that keeps failing, and the camera walks towards a door that will not hang still.
    anxious: {
      wall: '#a59480', wallLow: '#6f6657', floor: '#514a41', ceiling: '#948873', doorColor: '#191613',
      doorLight: '#ffc98a', lampColor: '#ffb46a', dark: '#1b1a20', ambient: 0.55, fogNear: 4, fogFar: 34, length: 34,
      doorSwing: 0.15, doorGlow: 3, lamps: 5, lampAmount: 1, lampReach: 7, deadLamps: 0.4, flicker: 0.75,
      camHeight: 1.3, camDistance: 12, camFov: 68, dolly: 6, drift: 0.7, driftSpeed: 1.8, depth: 4, smear: 2,
      chroma: 1.2, glow: 0.45, noise: 0.35, vignette: 0.45,
    },
    // The lamps are dead. Red light at the end, and it is slowly getting nearer.
    fear: {
      wall: '#8a6a64', wallLow: '#5c403c', floor: '#4a3a38', ceiling: '#6a504c', doorColor: '#030202',
      doorLight: '#ff2a14', lampColor: '#ff5a3a', dark: '#060203', ambient: 0.5, fogNear: 6, fogFar: 60, length: 50,
      doorSwing: 0.12, doorGlow: 4, doorReach: 40, lampAmount: 0.35, deadLamps: 0.75, flicker: 0.9, camHeight: 0.9,
      camDistance: 16, camFov: 60, camPitch: 3, camRoll: -4, dolly: 9, drift: 0.45, driftSpeed: 0.5, depth: 4,
      blur: 1.2, smear: 2, chroma: 1.1, glow: 0.7, noise: 0.3, vignette: 0.55,
    },
  },
  dissolve: ['dark'],
  build,
};
