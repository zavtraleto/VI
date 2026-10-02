import * as THREE from 'three';
import { ps1Material, type Ps1Fog } from '../../display/ps1';
import { CameraRig, DEG, color, grainTexture, handheld, num } from '../kit';
import { LOOK_MOODS, LOOK_PARAMS, type ParamValues } from '../scene';
import type { PlaceContext, PlaceDef, PlaceInstance, Stage } from '../stage';
import { Surface } from '../surface';
import { openSpots, skyLight, skyMesh } from './open';

/** The low wall round the edge of the roof. */
const PARAPET_THICK = 0.25;

function build(values: ParamValues, context: PlaceContext): PlaceInstance {
  const n = (name: string) => Number(values[name]);
  const tone = (name: string) => new THREE.Color(String(values[name]));
  const { scene, keep, stream, bare } = context;
  const snap = n('snap');
  const fog: Ps1Fog = { color: String(values.skyHorizon), near: n('fogNear'), far: Math.max(n('fogFar'), n('fogNear') + 1) };
  const lightTurn = n('lightAngle') * DEG;
  const { lamp, ambient } = skyLight(lightTurn, n('lightAmount'));

  const camera = new THREE.PerspectiveCamera(n('camFov'), 1, 0.1, 2000);
  const rig = new CameraRig(
    camera,
    { x: n('camX'), height: n('camHeight'), distance: n('camDistance'), pitch: n('camPitch'), yaw: 0, roll: n('camRoll') },
    handheld(stream(4), n('drift'), n('driftSpeed')),
  );
  // Below the edge of the roof there is only the haze over the city.
  const sky = skyMesh(
    context,
    snap,
    Math.max(5 * DEG, n('camPitch') * DEG + (n('camFov') * DEG) / 2),
    String(values.skyTop),
    String(values.skyHorizon),
    String(values.haze),
  );
  if (!bare) scene.add(sky);

  // The roof: a slab that ends a few steps beyond what stands on it, with a low wall round it.
  const width = n('roofWidth');
  const depth = n('roofDepth');
  const front = n('camDistance') + 3;
  const backEdge = front - depth;
  const slabTone = tone('slab');
  const roof = new Surface()
    .sheet(new THREE.Vector3(-width / 2, 0, front), new THREE.Vector3(width, 0, 0), new THREE.Vector3(0, 0, -depth), slabTone, 1, 3);
  const parapet = n('parapet');
  if (parapet > 0) {
    const edge = (x: number, z: number, w: number, d: number) =>
      roof.box({ size: new THREE.Vector3(w, parapet, d), matrix: new THREE.Matrix4().makeTranslation(x, parapet / 2, z) }, slabTone, 1, 3);
    edge(0, backEdge, width, PARAPET_THICK);
    edge(-width / 2, (front + backEdge) / 2, PARAPET_THICK, depth);
    edge(width / 2, (front + backEdge) / 2, PARAPET_THICK, depth);
  }
  const concrete = keep(grainTexture(stream(1), 0.3));
  const roofMesh = new THREE.Mesh(keep(roof.geometry()), keep(ps1Material({ map: concrete, vertexColors: true, fog, snap, light: null })));
  roofMesh.frustumCulled = false;
  if (!bare) scene.add(roofMesh);

  const stage: Stage = {
    scene,
    rig,
    keep,
    stream,
    snap,
    fog,
    lamps: [lamp],
    ambient,
    cell: Infinity,
    sky: true,
    lightTurn,
    // Only as far as the roof goes.
    spots: openSpots(stream(5)).map((spot) =>
      spot.set(Math.max(-width / 2 + 0.6, Math.min(width / 2 - 0.6, spot.x * 0.5)), 0, Math.max(backEdge + 0.8, spot.z * 0.5)),
    ),
  };

  return {
    stage,
    subject(size, portrait) {
      if (portrait) rig.portrait(portrait, size);
      else if (size > 0) rig.scale(Math.min(1.5, Math.max(0.6, size / 3.3)));
    },
    update(seconds, aspect) {
      roof.light(stage.lamps, ambient);
      rig.update(seconds, aspect);
      sky.position.copy(camera.position);
    },
  };
}

/** A flat roof under a dusk sky: the place of an aerial. Below its edge, only haze. */
export const roof: PlaceDef = {
  id: 'roof',
  channel: 5,
  native: 'antenna',
  params: {
    skyTop: color('#3b2f63'),
    skyHorizon: color('#e29bb4'),
    haze: color('#8a5f86'),
    slab: color('#8d8796'),
    fogNear: num(14, 0, 200, 1),
    fogFar: num(120, 10, 600, 1),
    roofWidth: num(14, 4, 40, 0.5),
    roofDepth: num(16, 4, 40, 0.5),
    parapet: num(0.6, 0, 2, 0.05),
    camX: num(-0.6, -5, 5, 0.05),
    camHeight: num(1.5, 0.3, 8, 0.1),
    camDistance: num(7, 2, 30, 0.5),
    camFov: num(50, 20, 90, 1),
    camPitch: num(9, -20, 40, 0.5),
    camRoll: num(0, -30, 30, 0.5),
    drift: num(0.35, 0, 1, 0.01),
    driftSpeed: num(1, 0, 4, 0.05),
    // The last of the light is beyond the aerial: it stands against it.
    lightAngle: num(175, 0, 360, 1),
    lightAmount: num(0.45, 0, 1, 0.01),
    ...LOOK_PARAMS,
    glow: { ...LOOK_PARAMS.glow, value: 0.2 },
  },
  moods: {
    dream: {},
    sad: {
      ...LOOK_MOODS.sad,
      skyTop: '#4a4a5c', skyHorizon: '#a69aa6', haze: '#6e6672', slab: '#77747c', fogNear: 8, fogFar: 80, drift: 0.2,
      driftSpeed: 0.6, lightAmount: 0.3,
    },
    strange: {
      ...LOOK_MOODS.strange,
      skyTop: '#59603a', skyHorizon: '#e7dc9a', haze: '#9a9a62', slab: '#8b8a6c', camHeight: 0.5, camFov: 64, camPitch: 18,
      camRoll: 6,
    },
    anxious: {
      ...LOOK_MOODS.anxious,
      skyTop: '#2b2833', skyHorizon: '#c97a4a', haze: '#4a3330', slab: '#4a4650', fogNear: 10, fogFar: 70, camDistance: 5,
      camFov: 60, drift: 0.7, driftSpeed: 1.8,
    },
    fear: {
      ...LOOK_MOODS.fear,
      skyTop: '#1a0305', skyHorizon: '#b3200f', haze: '#2a0606', slab: '#1c1010', fogNear: 20, fogFar: 200, camHeight: 1,
      camDistance: 6, camFov: 55, camRoll: -3, drift: 0.5, driftSpeed: 0.5, lightAngle: 180,
    },
  },
  dissolve: ['skyHorizon'],
  build,
};
