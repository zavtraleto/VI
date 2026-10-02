import * as THREE from 'three';
import { DEG, color, num } from '../kit';
import type { ThingDef } from '../stage';
import { block, body, glowing, shadeMoods } from './kit';

/**
 * Things from here: what stood in the rooms of the institute and what a person leaves
 * behind. None of them belongs to a channel.
 */

/** A plain chair. Whoever sits on it looks down -z; its back is on the +z side. */
export const chair: ThingDef = {
  id: 'chair',
  channel: 0,
  params: { color: color('#7a6a58') },
  moods: {
    dream: {},
    sad: { color: '#4b4640' },
    strange: {},
    anxious: { color: '#2a2420' },
    fear: { color: '#0a0606' },
  },
  tint: ['color'],
  build(values, stage, stream) {
    const object = new THREE.Group();
    // Never quite square to anything: someone left it there.
    object.rotation.y = (stream(2)() - 0.5) * 6 * DEG;
    const blocks = [
      block(0.42, 0.035, 0.42, 0, 0.45, 0),
      block(0.04, 0.45, 0.04, -0.19, 0.225, -0.19),
      block(0.04, 0.45, 0.04, 0.19, 0.225, -0.19),
      block(0.04, 0.45, 0.04, -0.19, 0.225, 0.19),
      block(0.04, 0.45, 0.04, 0.19, 0.225, 0.19),
      block(0.04, 0.47, 0.04, -0.19, 0.685, 0.19),
      block(0.04, 0.47, 0.04, 0.19, 0.685, 0.19),
      block(0.42, 0.09, 0.03, 0, 0.86, 0.19),
      block(0.42, 0.05, 0.03, 0, 0.66, 0.19),
    ];
    const { surface } = body(stage, blocks, String(values.color), object);
    object.updateMatrix();
    // The shadow is thrown by the boxes where the chair stands, turned as it is.
    for (const item of blocks) item.matrix.premultiply(object.matrix);
    return { object, height: 0.92, surface, blocks };
  },
};

/**
 * The table of the device: dice lie on it. The journal says the table would not stop, so the
 * dice on it shift by themselves, a little, now and then.
 */
export const table: ThingDef = {
  id: 'table',
  channel: 0,
  params: { color: color('#6e6256'), dice: color('#e9e4d6'), restless: num(0.4, 0, 1, 0.01) },
  moods: shadeMoods('color', '#6e6256', { anxious: { restless: 0.7 }, fear: { restless: 1, dice: '#b8b2a4' } }),
  tint: ['color'],
  build(values, stage, stream) {
    const object = new THREE.Group();
    const blocks = [
      block(1.2, 0.05, 0.8, 0, 0.725, 0),
      block(0.06, 0.7, 0.06, -0.55, 0.35, -0.35),
      block(0.06, 0.7, 0.06, 0.55, 0.35, -0.35),
      block(0.06, 0.7, 0.06, -0.55, 0.35, 0.35),
      block(0.06, 0.7, 0.06, 0.55, 0.35, 0.35),
    ];
    const { surface } = body(stage, blocks, String(values.color), object);
    const random = stream(2);
    const dice = Array.from({ length: 6 }, () => {
      const die = glowing(stage, new THREE.BoxGeometry(0.09, 0.09, 0.09), String(values.dice));
      die.position.set((random() - 0.5) * 0.9, 0.795, (random() - 0.5) * 0.55);
      die.rotation.y = random() * Math.PI;
      object.add(die);
      return { die, home: die.position.clone(), phase: random() * 100, turn: die.rotation.y };
    });
    const restless = Number(values.restless);
    return {
      object,
      height: 0.8,
      surface,
      blocks,
      update(seconds) {
        for (const item of dice) {
          // Still most of the time; every few seconds a die creeps and turns, then stops.
          const t = seconds * 0.35 + item.phase;
          const step = Math.floor(t);
          const ease = Math.min(1, (t - step) * 4);
          const from = Math.sin(step * 12.9898 + item.phase) * 0.5;
          const to = Math.sin((step + 1) * 12.9898 + item.phase) * 0.5;
          const shift = (from + (to - from) * ease) * 0.05 * restless;
          item.die.position.set(item.home.x + shift, item.home.y, item.home.z - shift * 0.6);
          item.die.rotation.y = item.turn + shift * 9;
        }
      },
    };
  },
};

/**
 * A mannequin: a figure of a body and no one in it, the size of a person. The program keeps
 * one for the seventh, for whom it has no record. There may be many of them.
 */
export const mannequin: ThingDef = {
  id: 'mannequin',
  channel: 0,
  params: { color: color('#b9bcc0') },
  moods: shadeMoods('color', '#b9bcc0'),
  tint: ['color'],
  build(values, stage, stream) {
    const object = new THREE.Group();
    object.rotation.y = (stream(2)() - 0.5) * 40 * DEG;
    const blocks = [
      block(0.13, 0.82, 0.15, -0.09, 0.41, 0),
      block(0.13, 0.82, 0.15, 0.09, 0.41, 0),
      block(0.38, 0.6, 0.21, 0, 1.12, 0),
      block(0.1, 0.64, 0.12, -0.25, 1.1, 0),
      block(0.1, 0.64, 0.12, 0.25, 1.1, 0),
      block(0.08, 0.08, 0.08, 0, 1.46, 0),
      block(0.2, 0.25, 0.22, 0, 1.62, 0),
    ];
    const { surface } = body(stage, blocks, String(values.color), object);
    object.updateMatrix();
    for (const item of blocks) item.matrix.premultiply(object.matrix);
    return { object, height: 1.75, surface, blocks };
  },
};

/** A telephone on a post, its receiver off the hook and hanging by the cord. */
export const phone: ThingDef = {
  id: 'phone',
  channel: 6,
  params: { color: color('#4f5d68'), swing: num(0.5, 0, 1, 0.01) },
  moods: shadeMoods('color', '#4f5d68', { anxious: { swing: 0.8 }, fear: { swing: 0.3 } }),
  tint: ['color'],
  build(values, stage, stream) {
    const object = new THREE.Group();
    const blocks = [
      block(0.08, 1.3, 0.08, 0, 0.65, 0),
      block(0.32, 0.44, 0.18, 0, 1.45, 0.02),
      block(0.4, 0.05, 0.26, 0, 1.7, 0.02),
    ];
    const { surface } = body(stage, blocks, String(values.color), object);
    // The receiver hangs from the side of the box on a short cord and swings.
    const pivot = new THREE.Group();
    pivot.position.set(0.19, 1.36, 0.12);
    const receiver = glowing(stage, new THREE.BoxGeometry(0.05, 0.2, 0.06), String(values.color));
    receiver.position.set(0, -0.42, 0);
    pivot.add(receiver);
    object.add(pivot);
    const swing = Number(values.swing);
    const phase = stream(2)() * Math.PI * 2;
    return {
      object,
      height: 1.75,
      surface,
      blocks,
      update(seconds) {
        pivot.rotation.z = swing * 0.35 * Math.sin(seconds * 2.2 + phase);
        pivot.rotation.x = swing * 0.12 * Math.sin(seconds * 1.7 + phase * 1.3);
      },
    };
  },
};

/** The bars of a television test card: the six channels, as they are on the faces of the dice. */
const BARS = ['#eeeadc', '#dccb5a', '#5fc9d6', '#62bf6e', '#c867c0', '#4f63dc'];

/** A television on a low stand, showing the test card: six bars, the six channels. */
export const tv: ThingDef = {
  id: 'tv',
  channel: 0,
  params: { color: color('#3c3a38'), screen: num(0.9, 0, 1.5, 0.01), roll: num(0.3, 0, 1, 0.01) },
  moods: shadeMoods('color', '#3c3a38', { sad: { screen: 0.6 }, anxious: { roll: 0.7 }, fear: { screen: 0.5, roll: 1 } }),
  tint: ['color'],
  build(values, stage, stream) {
    const object = new THREE.Group();
    const blocks = [block(0.52, 0.42, 0.42, 0, 0.21, 0), block(0.66, 0.52, 0.5, 0, 0.68, 0)];
    const { surface } = body(stage, blocks, String(values.color), object);
    // The screen faces the camera: six bars of colour, each its own strip.
    const screen = Number(values.screen);
    const bars = BARS.map((hex, i) => {
      const bar = glowing(stage, new THREE.PlaneGeometry(0.5 / BARS.length, 0.36), hex);
      bar.position.set(-0.25 + (i + 0.5) * (0.5 / BARS.length), 0.69, 0.252);
      object.add(bar);
      return { bar, tone: new THREE.Color(hex) };
    });
    const lamp = { position: new THREE.Vector3(), color: new THREE.Color('#d8d4ff'), reach: 3.5, amount: 0.5 * screen };
    const roll = Number(values.roll);
    const random = stream(2);
    const salt = random() * 100;
    return {
      object,
      height: 0.95,
      surface,
      blocks,
      lamp: { lamp, at: new THREE.Vector3(0, 0.7, 0.6) },
      update(seconds) {
        // The picture is not quite held: it dims and comes back, and now and then rolls a bar along.
        const tick = Math.floor(seconds * 9);
        const noise = Math.sin(tick * 12.9898 + salt) * 43758.5453;
        const flutter = 0.85 + 0.15 * (noise - Math.floor(noise));
        const shift = Math.floor(seconds * 0.5 * roll + salt) % BARS.length;
        bars.forEach(({ bar }, i) => {
          const tone = bars[(i + shift) % BARS.length].tone;
          ((bar.material as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color).copy(tone).multiplyScalar(screen * flutter);
        });
        lamp.amount = 0.5 * screen * flutter;
      },
    };
  },
};

/** A piece of a concrete wall standing on its own, with a doorway in it. */
export const wall: ThingDef = {
  id: 'wall',
  channel: 0,
  params: { color: color('#c9cbc6') },
  moods: shadeMoods('color', '#c9cbc6'),
  tint: ['color'],
  build(values, stage) {
    const object = new THREE.Group();
    const blocks = [
      block(1.15, 2.7, 0.2, -1.025, 1.35, 0),
      block(1.15, 2.7, 0.2, 1.025, 1.35, 0),
      block(0.9, 0.62, 0.2, 0, 2.39, 0),
    ];
    const { surface } = body(stage, blocks, String(values.color), object);
    return { object, height: 2.7, surface, blocks };
  },
};
