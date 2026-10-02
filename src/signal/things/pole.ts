import * as THREE from 'three';
import { ps1Material } from '../../display/ps1';
import { DEG, bool, color, num } from '../kit';
import type { ThingDef } from '../stage';
import { block, body } from './kit';

/** Distance to the next pole of the line, which is never in the frame. */
const SPAN = 60;
const SEGMENTS = 16;
/** Where the insulators sit along a crossarm, as fractions of its length from the middle. */
const INSULATORS = [-0.42, -0.2, 0.2, 0.42];
/** A wire is held still at its tie and is free to tremble this far along from it. */
const WIRE_FREE = 1.5;
/** How far a wire swings and trembles at `wireTremble` 1, in metres. */
const WIRE_SWING = 0.5;
const WIRE_SHAKE = 0.12;
/** The post goes on under the ground. */
const SUNK = 2;

/** One wire from a tie on this pole to the next pole, or down through the ground. */
interface Wire {
  from: THREE.Vector3;
  to: THREE.Vector3;
  droop: number;
  broken: boolean;
  length: number;
  /** Where in their cycles the swing, the two tremors and the bounce start. */
  phases: number[];
}

/** A telephone pole: a square post, crossarms across the line, an insulator for every wire. */
export const pole: ThingDef = {
  id: 'pole',
  channel: 3,
  params: {
    color: color('#6f777c'),
    height: num(8, 3, 16, 0.1),
    tilt: num(3, 0, 20, 0.1),
    crossarms: num(2, 0, 4, 1),
    wireSag: num(1.5, 0, 8, 0.05),
    wireUnderwater: bool(false),
    wireTremble: num(0.3, 0, 1, 0.01),
    wireSpeed: num(1, 0, 4, 0.05),
  },
  moods: {
    dream: {},
    sad: { color: '#4d5459', wireSag: 2.4, wireTremble: 0.15 },
    strange: { color: '#4a4f45', height: 11, tilt: 14, wireSag: 4.5 },
    anxious: { color: '#17181a', tilt: 7, wireTremble: 0.8, wireSpeed: 1.8 },
    fear: { color: '#050404', tilt: 10, wireTremble: 0.6 },
  },
  tint: ['color'],
  build(values, stage, stream) {
    const n = (name: string) => Number(values[name]);
    const tone = String(values.color);
    const height = n('height');
    const object = new THREE.Group();
    const leaning = new THREE.Group();
    object.add(leaning);
    const random = stream(2);
    // The line runs mostly across the frame, so the wires leave it at the sides.
    const lineTurn = (12 + random() * 18) * DEG * (random() < 0.5 ? -1 : 1);
    const along = new THREE.Vector3(Math.cos(lineTurn), 0, Math.sin(lineTurn));
    const across = new THREE.Vector3(-Math.sin(lineTurn), 0, Math.cos(lineTurn));
    const lean = random() * Math.PI * 2;
    leaning.quaternion.setFromAxisAngle(new THREE.Vector3(Math.cos(lean), 0, Math.sin(lean)), n('tilt') * DEG);
    const armTurn = Math.atan2(-across.z, across.x);

    const blocks = [block(0.26, height + SUNK, 0.26, 0, (height - SUNK) / 2, 0)];
    /** Where the wires are tied, on the pole before it leans. */
    const ties: THREE.Vector3[] = [];
    const crossarms = Math.round(n('crossarms'));
    for (let i = 0; i < crossarms; i++) {
      const y = height - 0.45 - i * 0.75;
      if (y < 1) break;
      const length = 2 + random() * 0.5;
      const arm = new THREE.Vector3(0, y, 0).addScaledVector(along, 0.18);
      blocks.push(block(length, 0.11, 0.11, arm.x, arm.y, arm.z, armTurn));
      for (const place of INSULATORS) {
        const at = new THREE.Vector3(0, y + 0.125, 0).addScaledVector(along, 0.18).addScaledVector(across, place * length);
        blocks.push(block(0.09, 0.14, 0.09, at.x, at.y, at.z, armTurn));
        ties.push(at.clone().setY(y + 0.195));
      }
    }
    const { surface } = body(stage, blocks, tone, leaning);
    leaning.updateMatrix();

    // Wires: from every insulator to the same place on the next pole either way. With
    // `wireUnderwater` one of them has come loose and goes down through the ground.
    const wires: Wire[] = [];
    let positions: THREE.BufferAttribute | null = null;
    if (ties.length > 0) {
      const random = stream(3);
      const sag = n('wireSag');
      // Drawn whether or not a wire is loose: the other wires hang the same either way.
      const pick = Math.floor(random() * ties.length);
      const loose = values.wireUnderwater === true ? pick : -1;
      const looseSide = random() < 0.5 ? -1 : 1;
      ties.forEach((tie, i) => {
        for (const side of [-1, 1]) {
          const from = tie.clone().applyMatrix4(leaning.matrix);
          const droop = sag * (0.9 + random() * 0.2);
          const reach = height * (0.9 + random() * 0.5);
          const broken = i === loose && side === looseSide;
          // The next pole stands straight: its ties are where this one's would be without the lean.
          const to = broken ? from.clone().addScaledVector(along, side * reach).setY(-SUNK) : tie.clone().addScaledVector(along, side * SPAN);
          const phases = [0, 0, 0, 0].map(() => random() * Math.PI * 2);
          wires.push({ from, to, droop, broken, length: from.distanceTo(to), phases });
        }
      });
      positions = new THREE.BufferAttribute(new Float32Array(wires.length * SEGMENTS * 6), 3);
      const geometry = stage.keep(new THREE.BufferGeometry());
      geometry.setAttribute('position', positions);
      const lines = new THREE.LineSegments(geometry, stage.keep(ps1Material({ color: tone, fog: stage.fog, snap: stage.snap, light: null })));
      lines.frustumCulled = false;
      object.add(lines);
    }

    const tremble = n('wireTremble');
    const speed = n('wireSpeed');
    const point = new THREE.Vector3();
    return {
      object,
      height,
      surface,
      update(seconds) {
        if (!positions) return;
        const t = seconds * speed;
        const put = (wire: Wire, s: number, index: number): void => {
          const { from, to, phases } = wire;
          point.lerpVectors(from, to, s);
          // A loose wire leaves level and falls; a tied one hangs between its two ends.
          if (wire.broken) point.y = from.y + (to.y - from.y) * s ** 1.7;
          else point.y -= 4 * wire.droop * s * (1 - s);
          if (tremble > 0) {
            const reach = s * wire.length;
            // Nothing moves at a tie. A tied wire is held at both ends, a loose one by the ground.
            const free = (1 - Math.exp(-reach / WIRE_FREE)) * (1 - Math.exp(-(wire.length - reach) / WIRE_FREE));
            // The whole span swings slowly in the wind; fast waves run along it on top of that.
            const swing = WIRE_SWING * Math.sin(Math.PI * s) * Math.sin(t * 0.9 + phases[0]);
            const shake = WIRE_SHAKE * free * (0.6 * Math.sin(reach * 0.9 - t * 9 + phases[1]) + 0.4 * Math.sin(reach * 2.3 + t * 14 + phases[2]));
            const bounce = WIRE_SHAKE * free * 0.6 * Math.sin(reach * 1.4 - t * 11 + phases[3]);
            point.addScaledVector(across, tremble * (swing + shake));
            point.y += tremble * bounce;
          }
          positions!.setXYZ(index, point.x, point.y, point.z);
        };
        wires.forEach((wire, w) => {
          for (let k = 0; k < SEGMENTS; k++) {
            const index = (w * SEGMENTS + k) * 2;
            put(wire, k / SEGMENTS, index);
            put(wire, (k + 1) / SEGMENTS, index + 1);
          }
        });
        positions.needsUpdate = true;
      },
    };
  },
};
