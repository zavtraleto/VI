import * as THREE from 'three';
import { ps1Material, type Ps1Fog, type Ps1Glint, type Ps1Light } from '../../display/ps1';
import { DEG, bool, color, handheld, keeper, num, streams } from '../kit';
import { LOOK_PARAMS, type ParamValues, type SceneDef, type SceneInstance } from '../scene';

/** The sea reaches this far from the camera; the fog has to end before it does. */
const SEA_NEAR = 0.5;
const SEA_FAR = 800;
const SEA_ROWS = 64;
const SEA_COLUMNS = 40;
/** Half of the fan of sea in front of the camera, wide enough for any screen. */
const SEA_HALF_ANGLE = 80 * DEG;
/** The sky is a wall this far from the camera; it only has to be inside the far plane. */
const SKY_RADIUS = 100;
/** Distance to the next pole of the line, which is never in the frame. */
const SPAN = 60;
const WIRE_SEGMENTS = 16;
const LIGHT_ELEVATION = 40 * DEG;
/** Where the insulators sit along a crossarm, as fractions of its length from the middle. */
const INSULATORS = [-0.42, -0.2, 0.2, 0.42];
/** A wire is held still at its tie and is free to tremble this far along from it. */
const WIRE_FREE = 1.5;
/** How far a wire swings and trembles at `wireTremble` 1, in metres. */
const WIRE_SWING = 0.5;
const WIRE_SHAKE = 0.12;
/** A glint is a dash across the view: this many times wider than it is tall. */
const GLINT_STRETCH = 4;

/** One wire from a tie on this pole to the next pole, or down into the sea. */
interface Wire {
  from: THREE.Vector3;
  to: THREE.Vector3;
  droop: number;
  broken: boolean;
  length: number;
  /** Where in their cycles the swing, the two tremors and the bounce start. */
  phases: number[];
}

interface Wave {
  kx: number;
  kz: number;
  /** Radians per second at speed 1. */
  omega: number;
  phase: number;
  weight: number;
}

/**
 * A wall around the far side of the camera: the colour of the horizon at eye level and below,
 * turning into the colour of the top by `topAngle` above it.
 */
function skyGeometry(topAngle: number, top: THREE.Color, horizon: THREE.Color): THREE.BufferGeometry {
  const rows: [number, THREE.Color][] = [
    [-20 * DEG, horizon],
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

function build(values: ParamValues, seed: number): SceneInstance {
  const n = (name: string) => Number(values[name]);
  const stream = streams(seed);
  const { keep, dispose } = keeper();

  const snap = n('snap');
  const fog: Ps1Fog = { color: String(values.skyHorizon), near: n('fogNear'), far: Math.max(n('fogFar'), n('fogNear') + 1) };
  const lightTurn = n('lightAngle') * DEG;
  const light: Ps1Light = {
    // 0 comes from behind the camera, 90 from the right, 180 from beyond the pole.
    direction: new THREE.Vector3(
      Math.sin(lightTurn) * Math.cos(LIGHT_ELEVATION),
      Math.sin(LIGHT_ELEVATION),
      Math.cos(lightTurn) * Math.cos(LIGHT_ELEVATION),
    ),
    amount: n('lightAmount'),
  };

  const scene = new THREE.Scene();
  const camHeight = n('camHeight');
  const camDistance = n('camDistance');
  const camPitch = n('camPitch') * DEG;
  const camera = new THREE.PerspectiveCamera(n('camFov'), 1, 0.1, 2000);
  camera.rotation.order = 'YXZ';

  // Sky: drawn first, behind everything, and it goes where the camera goes. The top colour
  // is reached where the upper edge of the frame is.
  const skyMaterial = keep(ps1Material({ vertexColors: true, fog: null, snap, light: null }));
  skyMaterial.depthTest = false;
  skyMaterial.depthWrite = false;
  const sky = new THREE.Mesh(
    keep(
      skyGeometry(
        Math.max(5 * DEG, camPitch + (n('camFov') * DEG) / 2),
        new THREE.Color(String(values.skyTop)),
        new THREE.Color(String(values.skyHorizon)),
      ),
    ),
    skyMaterial,
  );
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  // Sea: a fan in front of the camera whose cells grow with distance, so they stay about
  // the same size on screen. Waves move its vertices.
  const waves: Wave[] = [];
  {
    const random = stream(1);
    const heading = random() * Math.PI * 2;
    const lengths = [14, 8, 5];
    const weights = [0.55, 0.3, 0.15];
    for (let i = 0; i < lengths.length; i++) {
      const k = (Math.PI * 2) / (lengths[i] * (0.85 + random() * 0.3));
      const turn = heading + (random() - 0.5) * 1.4;
      waves.push({
        kx: Math.cos(turn) * k,
        kz: Math.sin(turn) * k,
        // Deep water: longer waves run faster.
        omega: Math.sqrt(9.81 * k),
        phase: random() * Math.PI * 2,
        weight: weights[i],
      });
    }
  }
  const seaVertices = (SEA_ROWS + 1) * (SEA_COLUMNS + 1);
  const seaPositions = new Float32Array(seaVertices * 3);
  const seaNormals = new Float32Array(seaVertices * 3);
  /** How much of the waves a vertex takes: far cells are too large to carry them. */
  const seaFade = new Float32Array(seaVertices);
  for (let j = 0; j <= SEA_ROWS; j++) {
    const distance = SEA_NEAR * (SEA_FAR / SEA_NEAR) ** (j / SEA_ROWS);
    for (let i = 0; i <= SEA_COLUMNS; i++) {
      const turn = (i / SEA_COLUMNS - 0.5) * 2 * SEA_HALF_ANGLE;
      const v = j * (SEA_COLUMNS + 1) + i;
      seaPositions[v * 3] = Math.sin(turn) * distance;
      seaPositions[v * 3 + 2] = camDistance - Math.cos(turn) * distance;
      seaNormals[v * 3 + 1] = 1;
      seaFade[v] = 1 / (1 + (distance / 90) ** 2);
    }
  }
  const seaGeometry = keep(new THREE.BufferGeometry());
  const seaPositionAttribute = new THREE.BufferAttribute(seaPositions, 3);
  const seaNormalAttribute = new THREE.BufferAttribute(seaNormals, 3);
  seaGeometry.setAttribute('position', seaPositionAttribute);
  seaGeometry.setAttribute('normal', seaNormalAttribute);
  {
    const index: number[] = [];
    for (let j = 0; j < SEA_ROWS; j++) {
      for (let i = 0; i < SEA_COLUMNS; i++) {
        const a = j * (SEA_COLUMNS + 1) + i;
        const b = a + SEA_COLUMNS + 1;
        index.push(a, a + 1, b + 1, a, b + 1, b);
      }
    }
    seaGeometry.setIndex(index);
  }
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
  const seaMaterial = keep(ps1Material({ color: String(values.sea), fog, snap, light, glint }));
  const sea = new THREE.Mesh(seaGeometry, seaMaterial);
  sea.frustumCulled = false;
  scene.add(sea);

  const waveHeight = n('waveHeight');
  const waveSpeed = n('waveSpeed');
  const moveSea = (seconds: number): void => {
    for (let v = 0; v < seaVertices; v++) {
      const x = seaPositions[v * 3];
      const z = seaPositions[v * 3 + 2];
      const amplitude = waveHeight * seaFade[v];
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
      seaPositions[v * 3 + 1] = y;
      const length = Math.hypot(slopeX, 1, slopeZ);
      seaNormals[v * 3] = -slopeX / length;
      seaNormals[v * 3 + 1] = 1 / length;
      seaNormals[v * 3 + 2] = -slopeZ / length;
    }
    seaPositionAttribute.needsUpdate = true;
    seaNormalAttribute.needsUpdate = true;
  };

  // Pole: a square post, crossarms across the line of the wires, a box for each insulator.
  const poleHeight = n('poleHeight');
  const poleMaterial = keep(ps1Material({ color: String(values.poleColor), fog, snap, light }));
  const pole = new THREE.Group();
  pole.position.set(n('poleX'), 0, 0);
  const random = stream(2);
  // The line runs mostly across the frame, so the wires leave it at the sides.
  const lineTurn = (12 + random() * 18) * DEG * (random() < 0.5 ? -1 : 1);
  const along = new THREE.Vector3(Math.cos(lineTurn), 0, Math.sin(lineTurn));
  const across = new THREE.Vector3(-Math.sin(lineTurn), 0, Math.cos(lineTurn));
  {
    const lean = random() * Math.PI * 2;
    pole.quaternion.setFromAxisAngle(new THREE.Vector3(Math.cos(lean), 0, Math.sin(lean)), n('poleTilt') * DEG);
  }
  const box = (width: number, height: number, depth: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(width, height, depth)), poleMaterial);
    mesh.frustumCulled = false;
    pole.add(mesh);
    return mesh;
  };
  // The post goes on under the water.
  const sunk = 2;
  box(0.26, poleHeight + sunk, 0.26).position.y = (poleHeight - sunk) / 2;
  /** Where the wires are tied, in the pole's own space. */
  const ties: THREE.Vector3[] = [];
  const crossarms = Math.round(n('crossarms'));
  for (let i = 0; i < crossarms; i++) {
    const y = poleHeight - 0.45 - i * 0.75;
    if (y < 1) break;
    const length = 2 + random() * 0.5;
    const arm = box(length, 0.11, 0.11);
    arm.position.set(0, y, 0).addScaledVector(along, 0.18);
    // The box is long on its x axis: turn that to lie across the line.
    arm.rotation.y = Math.atan2(-across.z, across.x);
    for (const place of INSULATORS) {
      const at = new THREE.Vector3(0, y + 0.125, 0).addScaledVector(along, 0.18).addScaledVector(across, place * length);
      const insulator = box(0.09, 0.14, 0.09);
      insulator.position.copy(at);
      insulator.rotation.y = arm.rotation.y;
      ties.push(at.clone().setY(y + 0.195));
    }
  }
  scene.add(pole);
  pole.updateMatrixWorld(true);

  // Wires: from every insulator to the same place on the next pole either way. With
  // `wireUnderwater` one of them has come loose and goes down into the sea.
  const wires: Wire[] = [];
  let wirePositions: THREE.BufferAttribute | null = null;
  if (ties.length > 0) {
    const random = stream(3);
    const sag = n('wireSag');
    // Drawn whether or not a wire is loose: the other wires hang the same in both variants.
    const pick = Math.floor(random() * ties.length);
    const loose = values.wireUnderwater === true ? pick : -1;
    const looseSide = random() < 0.5 ? -1 : 1;
    ties.forEach((tie, i) => {
      for (const side of [-1, 1]) {
        const from = tie.clone().applyMatrix4(pole.matrixWorld);
        const droop = sag * (0.9 + random() * 0.2);
        const reach = poleHeight * (0.9 + random() * 0.5);
        const broken = i === loose && side === looseSide;
        // The next pole stands straight: its ties are where this one's would be without the lean.
        const to = broken
          ? from.clone().addScaledVector(along, side * reach).setY(-sunk)
          : tie.clone().add(pole.position).addScaledVector(along, side * SPAN);
        const phases = [0, 0, 0, 0].map(() => random() * Math.PI * 2);
        wires.push({ from, to, droop, broken, length: from.distanceTo(to), phases });
      }
    });
    wirePositions = new THREE.BufferAttribute(new Float32Array(wires.length * WIRE_SEGMENTS * 6), 3);
    const geometry = keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', wirePositions);
    const lines = new THREE.LineSegments(
      geometry,
      keep(ps1Material({ color: String(values.poleColor), fog, snap, light: null })),
    );
    lines.frustumCulled = false;
    scene.add(lines);
  }

  const wireTremble = n('wireTremble');
  const wireSpeed = n('wireSpeed');
  const wirePoint = new THREE.Vector3();
  const moveWires = (seconds: number): void => {
    if (!wirePositions) return;
    const t = seconds * wireSpeed;
    /** A point of a wire, `s` of the way along it, written at `index` of the positions. */
    const put = (wire: Wire, s: number, index: number): void => {
      const { from, to, phases } = wire;
      wirePoint.lerpVectors(from, to, s);
      // A loose wire leaves level and falls; a tied one hangs between its two ends.
      if (wire.broken) wirePoint.y = from.y + (to.y - from.y) * s ** 1.7;
      else wirePoint.y -= 4 * wire.droop * s * (1 - s);
      if (wireTremble > 0) {
        const reach = s * wire.length;
        // Nothing moves at a tie. A tied wire is held at both ends, a loose one by the water.
        const free = (1 - Math.exp(-reach / WIRE_FREE)) * (1 - Math.exp(-(wire.length - reach) / WIRE_FREE));
        // The whole span swings slowly in the wind; fast waves run along it on top of that.
        const swing = WIRE_SWING * Math.sin(Math.PI * s) * Math.sin(t * 0.9 + phases[0]);
        const shake =
          WIRE_SHAKE *
          free *
          (0.6 * Math.sin(reach * 0.9 - t * 9 + phases[1]) + 0.4 * Math.sin(reach * 2.3 + t * 14 + phases[2]));
        const bounce = WIRE_SHAKE * free * 0.6 * Math.sin(reach * 1.4 - t * 11 + phases[3]);
        wirePoint.addScaledVector(across, wireTremble * (swing + shake));
        wirePoint.y += wireTremble * bounce;
      }
      wirePositions!.setXYZ(index, wirePoint.x, wirePoint.y, wirePoint.z);
    };
    wires.forEach((wire, w) => {
      for (let k = 0; k < WIRE_SEGMENTS; k++) {
        const index = (w * WIRE_SEGMENTS + k) * 2;
        put(wire, k / WIRE_SEGMENTS, index);
        put(wire, (k + 1) / WIRE_SEGMENTS, index + 1);
      }
    });
    wirePositions.needsUpdate = true;
  };

  const camRoll = n('camRoll') * DEG;
  const hand = handheld(stream(4), n('drift'), n('driftSpeed'));
  const moveCamera = (seconds: number): void => {
    const sway = hand(seconds);
    camera.position.set(sway.x, camHeight + sway.y, camDistance);
    camera.rotation.set(camPitch + sway.pitch, sway.yaw, camRoll + sway.roll);
    sky.position.copy(camera.position);
  };

  return {
    scene,
    camera,
    update(timeMs, aspect) {
      if (camera.aspect !== aspect) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      }
      moveSea(timeMs / 1000);
      moveWires(timeMs / 1000);
      moveCamera(timeMs / 1000);
      seaMaterial.uniforms.uTime.value = timeMs / 1000;
    },
    dispose,
  };
}

/** IMAGE 0001: a pale sea to the horizon, the sky, a single telephone pole. */
export const seaPole: SceneDef = {
  id: 'sea_pole',
  params: {
    skyTop: color('#bcd6e6'),
    skyHorizon: color('#f2f0ea'),
    sea: color('#cfd8dc'),
    poleColor: color('#6f777c'),
    fogNear: num(20, 0, 300, 1),
    fogFar: num(160, 10, SEA_FAR, 1),
    poleHeight: num(8, 3, 16, 0.1),
    poleTilt: num(3, 0, 20, 0.1),
    poleX: num(0, -15, 15, 0.1),
    crossarms: num(2, 0, 4, 1),
    wireSag: num(1.5, 0, 8, 0.05),
    wireUnderwater: bool(false),
    wireTremble: num(0.3, 0, 1, 0.01),
    wireSpeed: num(1, 0, 4, 0.05),
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
    // Beyond the pole and a little to the right: the glints lie between the light and the eye.
    lightAngle: num(165, 0, 360, 1),
    lightAmount: num(0.5, 0, 1, 0.01),
    ...LOOK_PARAMS,
  },
  variants: {
    a: {},
    // IMAGE 0003: the same sea, one wire of the pole goes under the water.
    b: { wireUnderwater: true },
  },
  moods: {
    dream: {},
    // The colour has gone out of it: a grey day, a slack wire, hardly a glint.
    sad: {
      skyTop: '#8e9aa3', skyHorizon: '#c9cdcd', sea: '#9aa4a8', poleColor: '#4d5459', fogNear: 10, fogFar: 90,
      wireSag: 2.4, wireTremble: 0.15, waveHeight: 0.08, waveSpeed: 0.6, glint: 0.12, glintColor: '#e6ebee',
      camPitch: 2, drift: 0.2, driftSpeed: 0.6, lightAmount: 0.3, blur: 1, noise: 0.2, vignette: 0.35,
    },
    // The wrong colour and the wrong place to stand: low over the water, the pole too tall and leaning.
    strange: {
      skyTop: '#c9c58f', skyHorizon: '#f0e9c6', sea: '#9fb3a0', poleColor: '#4a4f45', poleHeight: 11, poleTilt: 14,
      wireSag: 4.5, waveSpeed: 0.35, glint: 0.5, glintColor: '#fff7d0', glintSize: 0.5, glintWidth: 60,
      camHeight: 0.6, camFov: 62, camPitch: 14, camRoll: 5, snap: 120, chroma: 1.4,
    },
    // Dusk, close to the pole, and nothing holds still.
    anxious: {
      skyTop: '#3d4048', skyHorizon: '#c98a5a', sea: '#3b3f45', poleColor: '#17181a', fogNear: 15, fogFar: 120,
      poleTilt: 7, wireTremble: 0.8, wireSpeed: 1.8, waveHeight: 0.3, waveSpeed: 1.6, glint: 0.5,
      glintColor: '#ffb884', glintSpeed: 11, camDistance: 9, camFov: 60, camPitch: 10, drift: 0.7, driftSpeed: 1.8,
      depth: 4, smear: 2, chroma: 1.2, glow: 0.25, noise: 0.35, vignette: 0.4,
    },
    // Black, red and the white of the light on the water. It is slow again.
    fear: {
      skyTop: '#1a0305', skyHorizon: '#b3200f', sea: '#120609', poleColor: '#050404', fogNear: 30, fogFar: 300,
      poleTilt: 10, wireTremble: 0.6, waveSpeed: 0.5, glint: 0.75, glintColor: '#ffcfa3', glintWidth: 16,
      camHeight: 1.2, camDistance: 11, camFov: 55, camPitch: 9, camRoll: -3, drift: 0.5, driftSpeed: 0.5,
      lightAngle: 180, depth: 4, blur: 1.3, smear: 2.2, chroma: 1.1, glow: 0.6, noise: 0.3, vignette: 0.5,
    },
  },
  build,
};
