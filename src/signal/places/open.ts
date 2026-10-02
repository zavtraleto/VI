import * as THREE from 'three';
import { ps1Material, type Ps1Fog, type Ps1Glint, type Ps1Light } from '../../display/ps1';
import { CameraRig, DEG, color, handheld, num } from '../kit';
import { LOOK_MOODS, LOOK_PARAMS, mixColor, type Mood, type ParamValues } from '../scene';
import type { PlaceContext, PlaceDef, PlaceInstance, Stage } from '../stage';
import type { Lamp } from '../surface';

/** The ground reaches this far from the camera; the fog has to end before it does. */
const NEAR = 0.5;
const FAR = 800;
const ROWS = 64;
const COLUMNS = 40;
/** Half of the fan of ground in front of the camera, wide enough for any screen. */
const HALF_ANGLE = 80 * DEG;
/** The sky is a wall this far from the camera; it only has to be inside the far plane. */
export const SKY_RADIUS = 100;
const LIGHT_ELEVATION = 40 * DEG;
/** A glint is a dash across the view: this many times wider than it is tall. */
const GLINT_STRETCH = 4;

interface Wave {
  kx: number;
  kz: number;
  /** Radians per second at speed 1. */
  omega: number;
  phase: number;
  weight: number;
}

/**
 * A wall around the far side of the camera: the colour of the horizon at eye level, turning
 * into the colour of the top by `topAngle` above it, and into `below` under it where there is
 * no ground to hide that.
 */
export function skyGeometry(topAngle: number, top: THREE.Color, horizon: THREE.Color, below: THREE.Color = horizon): THREE.BufferGeometry {
  const rows: [number, THREE.Color][] = [
    [-70 * DEG, below],
    [-12 * DEG, below],
    [0, horizon],
    [Math.min(topAngle, 80 * DEG), top],
    [85 * DEG, top],
  ];
  const columns = 16;
  const positions: number[] = [];
  const colors: number[] = [];
  for (const [angle, tone] of rows) {
    for (let i = 0; i <= columns; i++) {
      const turn = (i / columns - 0.5) * 2 * 85 * DEG;
      positions.push(Math.sin(turn) * SKY_RADIUS, Math.tan(angle) * SKY_RADIUS, -Math.cos(turn) * SKY_RADIUS);
      colors.push(tone.r, tone.g, tone.b);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows.length - 1; j++) {
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i;
      const b = a + columns + 1;
      index.push(a, a + 1, b + 1, a, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  return geometry;
}

/** The sky of a place, drawn first and behind everything; it goes where the camera goes. */
export function skyMesh(
  context: PlaceContext,
  snap: number,
  topAngle: number,
  top: string,
  horizon: string,
  below: string = horizon,
): THREE.Mesh {
  const material = context.keep(ps1Material({ vertexColors: true, fog: null, snap, light: null }));
  material.depthTest = false;
  material.depthWrite = false;
  const geometry = context.keep(skyGeometry(topAngle, new THREE.Color(top), new THREE.Color(horizon), new THREE.Color(below)));
  const sky = new THREE.Mesh(geometry, material);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

/** The light of a sky as the things under it take it: from one side, the same everywhere. */
export function skyLight(lightTurn: number, amount: number): { light: Ps1Light; lamp: Lamp; ambient: THREE.Color } {
  // 0 comes from behind the camera, 90 from the right, 180 from beyond what the camera looks at.
  const direction = new THREE.Vector3(
    Math.sin(lightTurn) * Math.cos(LIGHT_ELEVATION),
    Math.sin(LIGHT_ELEVATION),
    Math.cos(lightTurn) * Math.cos(LIGHT_ELEVATION),
  );
  return {
    light: { direction, amount },
    lamp: { position: new THREE.Vector3(), color: new THREE.Color(1, 1, 1), reach: Infinity, amount, direction },
    ambient: new THREE.Color(1, 1, 1).multiplyScalar(1 - amount),
  };
}

/**
 * A surface to the horizon: a fan in front of the camera whose cells grow with distance, so
 * they stay about the same size on screen. Waves move its vertices: water, or land that lies
 * in slow folds.
 */
function groundFan(
  context: PlaceContext,
  camZ: number,
  material: THREE.ShaderMaterial,
  waveHeight: number,
  waveSpeed: number,
): { mesh: THREE.Mesh; update(seconds: number): void } {
  const waves: Wave[] = [];
  const random = context.stream(1);
  const heading = random() * Math.PI * 2;
  const lengths = [14, 8, 5];
  const weights = [0.55, 0.3, 0.15];
  for (let i = 0; i < lengths.length; i++) {
    const k = (Math.PI * 2) / (lengths[i] * (0.85 + random() * 0.3));
    const turn = heading + (random() - 0.5) * 1.4;
    // Deep water: longer waves run faster.
    waves.push({ kx: Math.cos(turn) * k, kz: Math.sin(turn) * k, omega: Math.sqrt(9.81 * k), phase: random() * Math.PI * 2, weight: weights[i] });
  }
  const vertices = (ROWS + 1) * (COLUMNS + 1);
  const positions = new Float32Array(vertices * 3);
  const normals = new Float32Array(vertices * 3);
  /** How much of the waves a vertex takes: far cells are too large to carry them. */
  const fade = new Float32Array(vertices);
  for (let j = 0; j <= ROWS; j++) {
    const distance = NEAR * (FAR / NEAR) ** (j / ROWS);
    for (let i = 0; i <= COLUMNS; i++) {
      const turn = (i / COLUMNS - 0.5) * 2 * HALF_ANGLE;
      const v = j * (COLUMNS + 1) + i;
      positions[v * 3] = Math.sin(turn) * distance;
      positions[v * 3 + 2] = camZ - Math.cos(turn) * distance;
      normals[v * 3 + 1] = 1;
      fade[v] = 1 / (1 + (distance / 90) ** 2);
    }
  }
  const geometry = context.keep(new THREE.BufferGeometry());
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const normalAttribute = new THREE.BufferAttribute(normals, 3);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('normal', normalAttribute);
  const index: number[] = [];
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLUMNS; i++) {
      const a = j * (COLUMNS + 1) + i;
      const b = a + COLUMNS + 1;
      index.push(a, a + 1, b + 1, a, b + 1, b);
    }
  }
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    update(seconds) {
      for (let v = 0; v < vertices; v++) {
        const x = positions[v * 3];
        const z = positions[v * 3 + 2];
        const amplitude = waveHeight * fade[v];
        let y = 0;
        let slopeX = 0;
        let slopeZ = 0;
        for (const wave of waves) {
          const angle = wave.kx * x + wave.kz * z + wave.omega * waveSpeed * seconds + wave.phase;
          const a = amplitude * wave.weight;
          y += a * Math.sin(angle);
          const c = a * Math.cos(angle);
          slopeX += c * wave.kx;
          slopeZ += c * wave.kz;
        }
        positions[v * 3 + 1] = y;
        const length = Math.hypot(slopeX, 1, slopeZ);
        normals[v * 3] = -slopeX / length;
        normals[v * 3 + 1] = 1 / length;
        normals[v * 3 + 2] = -slopeZ / length;
      }
      positionAttribute.needsUpdate = true;
      normalAttribute.needsUpdate = true;
      material.uniforms.uTime.value = seconds;
    },
  };
}

/** Places for things to stand in the open: the middle of the frame, then farther and to the sides. */
export function openSpots(random: () => number): THREE.Vector3[] {
  const spots = [new THREE.Vector3(0, 0, 0)];
  for (let i = 0; i < 11; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    spots.push(new THREE.Vector3(side * (3 + random() * 6 + i * 0.6), 0, -(1 + random() * 5 + i * 2.2)));
  }
  return spots;
}

function build(values: ParamValues, context: PlaceContext, subject: number): PlaceInstance {
  const n = (name: string) => Number(values[name]);
  const { scene, keep, stream, bare } = context;
  const snap = n('snap');
  const fog: Ps1Fog = { color: String(values.skyHorizon), near: n('fogNear'), far: Math.max(n('fogFar'), n('fogNear') + 1) };
  const lightTurn = n('lightAngle') * DEG;
  const { light, lamp, ambient } = skyLight(lightTurn, n('lightAmount'));

  const camera = new THREE.PerspectiveCamera(n('camFov'), 1, 0.1, 2000);
  const rig = new CameraRig(
    camera,
    { x: 0, height: n('camHeight'), distance: n('camDistance'), pitch: n('camPitch'), yaw: 0, roll: n('camRoll') },
    handheld(stream(4), n('drift'), n('driftSpeed')),
  );

  // The top colour is reached where the upper edge of the frame is.
  const sky = skyMesh(context, snap, Math.max(5 * DEG, n('camPitch') * DEG + (n('camFov') * DEG) / 2), String(values.skyTop), fog.color as string);
  if (!bare) scene.add(sky);

  const glintSize = n('glintSize') * DEG;
  const glint: Ps1Glint | null =
    n('glint') > 0
      ? {
          color: String(values.glintColor),
          amount: n('glint'),
          cell: new THREE.Vector2(glintSize * GLINT_STRETCH, glintSize),
          direction: new THREE.Vector2(light.direction.x, light.direction.z),
          width: n('glintWidth') * DEG,
          rate: n('glintSpeed'),
        }
      : null;
  const groundMaterial = keep(ps1Material({ color: String(values.ground), fog, snap, light, glint }));
  let ground: ReturnType<typeof groundFan> | null = null;

  const stage: Stage = {
    scene,
    rig,
    keep,
    stream,
    snap,
    fog,
    lamps: [lamp],
    ambient,
    // The light is the same everywhere: a surface needs no cutting to take it.
    cell: Infinity,
    sky: true,
    lightTurn,
    spots: openSpots(stream(5)),
  };

  return {
    stage,
    subject(height, portrait) {
      if (portrait) rig.portrait(portrait, height);
      // The camera is set for the thing that belongs here; another is framed the same way.
      else if (height > 0) rig.scale(Math.min(1.6, Math.max(0.22, height / subject)));
      // The fan is laid out from where the camera will stand.
      ground = groundFan(context, rig.target.z + rig.distance, groundMaterial, n('waveHeight'), n('waveSpeed'));
      if (!bare) scene.add(ground.mesh);
    },
    update(seconds, aspect) {
      ground?.update(seconds);
      rig.update(seconds, aspect);
      sky.position.copy(camera.position);
    },
  };
}

interface Palette {
  skyTop: string;
  skyHorizon: string;
  ground: string;
}

/** What the open places turn into as the mood gets heavier: the same grey day, the same wrong colour, the same dusk, the same red and black. */
const MOOD_SKIES: Record<Exclude<Mood, 'dream'>, Palette & { glintColor: string }> = {
  sad: { skyTop: '#8e9aa3', skyHorizon: '#c9cdcd', ground: '#9aa4a8', glintColor: '#e6ebee' },
  strange: { skyTop: '#c9c58f', skyHorizon: '#f0e9c6', ground: '#9fb3a0', glintColor: '#fff7d0' },
  anxious: { skyTop: '#3d4048', skyHorizon: '#c98a5a', ground: '#3b3f45', glintColor: '#ffb884' },
  fear: { skyTop: '#1a0305', skyHorizon: '#b3200f', ground: '#120609', glintColor: '#ffcfa3' },
};

interface OpenConfig {
  id: string;
  channel: number;
  native: string | null;
  /** Height of the thing the camera is set for. */
  subject: number;
  /** The colours of the place at its lightest. */
  palette: Palette;
  /**
   * How far each mood takes the colours towards what all open places share. At 1 the place
   * is the same as every other: the heavier the mood, the less the places differ.
   */
  merge: Record<Exclude<Mood, 'dream'>, number>;
  /** Values that differ from the sea's, at the lightest mood and in each mood. */
  values?: Partial<ParamValues>;
  moods?: Partial<Record<Mood, Partial<ParamValues>>>;
}

/** What the moods do to any open place besides its colours: the air, the water, the camera, the look. */
const OPEN_MOODS: Record<Mood, Partial<ParamValues>> = {
  dream: {},
  // The colour has gone out of it: a grey day, hardly a glint.
  sad: { fogNear: 10, fogFar: 90, waveHeight: 0.08, waveSpeed: 0.6, glint: 0.12, camPitch: 2, drift: 0.2, driftSpeed: 0.6, lightAmount: 0.3 },
  // The wrong colour and the wrong place to stand: low over the ground.
  strange: { waveSpeed: 0.35, glint: 0.5, glintSize: 0.5, glintWidth: 60, camHeight: 0.6, camFov: 62, camPitch: 14, camRoll: 5 },
  // Dusk, close, and nothing holds still.
  anxious: {
    fogNear: 15, fogFar: 120, waveHeight: 0.3, waveSpeed: 1.6, glint: 0.5, glintSpeed: 11, camDistance: 9, camFov: 60,
    camPitch: 10, drift: 0.7, driftSpeed: 1.8,
  },
  // Black, red and the white of the light on the ground. It is slow again.
  fear: {
    fogNear: 30, fogFar: 300, waveSpeed: 0.5, glint: 0.75, glintWidth: 16, camHeight: 1.2, camDistance: 11, camFov: 55,
    camPitch: 9, camRoll: -3, drift: 0.5, driftSpeed: 0.5, lightAngle: 180,
  },
};

function openPlace(config: OpenConfig): PlaceDef {
  const { palette } = config;
  const moods = { dream: {} } as Record<Mood, Partial<ParamValues>>;
  for (const mood of ['sad', 'strange', 'anxious', 'fear'] as const) {
    const to = MOOD_SKIES[mood];
    const share = config.merge[mood];
    moods[mood] = {
      ...OPEN_MOODS[mood],
      ...LOOK_MOODS[mood],
      skyTop: mixColor(palette.skyTop, to.skyTop, share),
      skyHorizon: mixColor(palette.skyHorizon, to.skyHorizon, share),
      ground: mixColor(palette.ground, to.ground, share),
      glintColor: to.glintColor,
      ...config.moods?.[mood],
    };
  }
  const params = {
    skyTop: color(palette.skyTop),
    skyHorizon: color(palette.skyHorizon),
    ground: color(palette.ground),
    fogNear: num(20, 0, 300, 1),
    fogFar: num(160, 10, FAR, 1),
    waveHeight: num(0.12, 0, 1, 0.01),
    waveSpeed: num(1, 0, 4, 0.05),
    glint: num(0.35, 0, 1, 0.01),
    glintColor: color('#ffffff'),
    glintSize: num(0.25, 0.05, 2, 0.01),
    glintWidth: num(25, 2, 90, 1),
    glintSpeed: num(5, 0, 20, 0.5),
    camHeight: num(2.2, 0.3, 12, 0.1),
    camDistance: num(16, 4, 60, 0.5),
    camFov: num(45, 20, 90, 1),
    camPitch: num(6, -20, 30, 0.5),
    camRoll: num(0, -30, 30, 0.5),
    drift: num(0.35, 0, 1, 0.01),
    driftSpeed: num(1, 0, 4, 0.05),
    // Beyond what the camera looks at and a little to the right: the glints lie between the light and the eye.
    lightAngle: num(165, 0, 360, 1),
    lightAmount: num(0.5, 0, 1, 0.01),
    ...LOOK_PARAMS,
  };
  for (const [name, value] of Object.entries(config.values ?? {})) {
    const spec = (params as Record<string, { value: unknown }>)[name];
    if (spec && value !== undefined) spec.value = value;
  }
  return {
    id: config.id,
    channel: config.channel,
    native: config.native,
    params,
    moods,
    dissolve: ['skyHorizon'],
    build: (values, context) => build(values, context, config.subject),
  };
}

/** IMAGE 0001: a pale sea to the horizon and the sky. The pole stands in it. */
export const sea = openPlace({
  id: 'sea',
  channel: 3,
  native: 'pole',
  subject: 8,
  palette: { skyTop: '#bcd6e6', skyHorizon: '#f2f0ea', ground: '#cfd8dc' },
  // These are the sea's own moods: the others are measured against them.
  merge: { sad: 1, strange: 1, anxious: 1, fear: 1 },
  moods: {
    anxious: { glow: 0.25, vignette: 0.4 },
    fear: { blur: 1.3, smear: 2.2, vignette: 0.5 },
  },
});

/** Dark water under a night sky: the place of a lamp left on. */
export const nightwater = openPlace({
  id: 'nightwater',
  channel: 6,
  native: 'lamp',
  subject: 4.4,
  palette: { skyTop: '#070b22', skyHorizon: '#1f2a5c', ground: '#0a1026' },
  merge: { sad: 0.45, strange: 0.5, anxious: 0.8, fear: 1 },
  values: {
    fogNear: 12, fogFar: 110, waveHeight: 0.08, waveSpeed: 0.7, glint: 0.3, glintColor: '#cfd8ff', glintWidth: 40,
    camHeight: 1.5, camDistance: 10, camPitch: 5, lightAngle: 180, lightAmount: 0.25, glow: 0.3,
  },
  moods: {
    sad: { skyTop: '#11151f', skyHorizon: '#3a4150', ground: '#141820' },
  },
});

/** Pale grass to the horizon, lying in slow folds: the place of a bare tree. */
export const field = openPlace({
  id: 'field',
  channel: 4,
  native: 'tree',
  subject: 5.2,
  palette: { skyTop: '#bfd9e6', skyHorizon: '#eef2e4', ground: '#9db88a' },
  merge: { sad: 0.75, strange: 0.7, anxious: 0.9, fear: 1 },
  values: {
    fogNear: 25, fogFar: 220, waveHeight: 0.3, waveSpeed: 0.06, glint: 0, camHeight: 1.6, camDistance: 11, camPitch: 5,
    lightAngle: 70, lightAmount: 0.5,
  },
  moods: {
    // Land has no light on it to break up, and it does not run like water.
    sad: { glint: 0, waveSpeed: 0.04, waveHeight: 0.3 },
    strange: { glint: 0, waveSpeed: 0.04, ground: '#b3b06a' },
    anxious: { glint: 0, waveSpeed: 0.1, waveHeight: 0.4 },
    fear: { glint: 0, waveSpeed: 0.04, lightAngle: 180 },
  },
});

/** Too much light: the ground and the sky are one white, and what stands here is lost in it. */
export const glare = openPlace({
  id: 'glare',
  channel: 1,
  native: 'sun',
  subject: 5,
  palette: { skyTop: '#ffffff', skyHorizon: '#fffdf6', ground: '#f4f2ec' },
  merge: { sad: 0.5, strange: 0.45, anxious: 0.6, fear: 0.9 },
  values: {
    fogNear: 4, fogFar: 46, waveHeight: 0.04, waveSpeed: 0.5, glint: 0.25, glintWidth: 50, camHeight: 1.6, camDistance: 10,
    camPitch: 7, lightAngle: 180, lightAmount: 0.25, glow: 0.35, vignette: 0.05,
  },
  moods: {
    sad: { fogNear: 4, fogFar: 40, glow: 0.2 },
    strange: { glow: 0.4 },
    anxious: { fogNear: 6, fogFar: 60, glow: 0.5 },
    fear: { fogNear: 10, fogFar: 120 },
  },
});
