import * as THREE from 'three';
import { DEG, color, flickering, num } from '../kit';
import type { ThingDef } from '../stage';
import type { Block, Lamp } from '../surface';
import { block, body, glowing, shadeMoods } from './kit';

/** Things that stand outside, each the thing of one of the open places. */

/** A bare tree: a trunk and a few branches, no leaves. It moves a little in the wind. */
export const tree: ThingDef = {
  id: 'tree',
  channel: 4,
  params: { color: color('#5a5048'), height: num(5.2, 2, 12, 0.1), sway: num(0.3, 0, 1, 0.01) },
  moods: shadeMoods('color', '#5a5048', { strange: { height: 7.5 }, anxious: { sway: 0.7 }, fear: { sway: 0.15 } }),
  tint: ['color'],
  build(values, stage, stream) {
    const height = Number(values.height);
    const object = new THREE.Group();
    const crown = new THREE.Group();
    object.add(crown);
    const random = stream(2);
    const trunk = height * 0.55;
    const blocks: Block[] = [block(0.26, trunk, 0.26, 0, trunk / 2, 0)];
    /** A branch: a box from a point on the trunk, leaning out and up. */
    const branch = (from: THREE.Vector3, length: number, thick: number, turn: number, rise: number): THREE.Vector3 => {
      const dir = new THREE.Vector3(Math.cos(turn) * Math.cos(rise), Math.sin(rise), Math.sin(turn) * Math.cos(rise));
      const middle = from.clone().addScaledVector(dir, length / 2);
      const matrix = new THREE.Matrix4().makeTranslation(middle.x, middle.y, middle.z);
      // A box is long along y: turn y to the way the branch goes.
      matrix.multiply(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)));
      blocks.push({ size: new THREE.Vector3(thick, length, thick), matrix });
      return from.clone().addScaledVector(dir, length);
    };
    const count = 5 + Math.floor(random() * 3);
    for (let i = 0; i < count; i++) {
      const from = new THREE.Vector3(0, trunk * (0.55 + (0.45 * i) / count), 0);
      const turn = random() * Math.PI * 2;
      const tip = branch(from, height * (0.25 + random() * 0.2), 0.13, turn, (30 + random() * 40) * DEG);
      branch(tip, height * (0.12 + random() * 0.12), 0.07, turn + (random() - 0.5) * 1.6, (20 + random() * 50) * DEG);
    }
    // The top of the trunk goes on as the highest branch.
    branch(new THREE.Vector3(0, trunk, 0), height - trunk, 0.16, random() * Math.PI * 2, 80 * DEG);
    const { surface } = body(stage, blocks, String(values.color), crown);
    const sway = Number(values.sway);
    const phase = random() * Math.PI * 2;
    return {
      object,
      height,
      surface,
      blocks,
      update(seconds) {
        // A gust bends the crown further for a moment.
        const bend = sway * (1 + 2.5 * (stage.live?.stir ?? 0));
        crown.rotation.z = bend * 0.6 * DEG * Math.sin(seconds * 0.8 + phase);
        crown.rotation.x = bend * 0.4 * DEG * Math.sin(seconds * 0.63 + phase * 1.7);
      },
    };
  },
};

/** A street lamp left on. Its light falls on what stands near it; it may fail. */
export const lamp: ThingDef = {
  id: 'lamp',
  channel: 6,
  params: {
    color: color('#3e4246'),
    light: color('#ffe6a8'),
    amount: num(1.1, 0, 3, 0.01),
    reach: num(14, 2, 40, 0.5),
    flicker: num(0, 0, 1, 0.01),
  },
  moods: shadeMoods('color', '#3e4246', {
    sad: { light: '#dfe6ea', amount: 0.7 },
    strange: { light: '#f4ffc8' },
    anxious: { light: '#ffb46a', flicker: 0.6 },
    fear: { light: '#ff3a22', flicker: 0.85 },
  }),
  tint: ['color'],
  build(values, stage, stream) {
    const object = new THREE.Group();
    const blocks = [block(0.14, 4.3, 0.14, 0, 2.15, 0), block(0.95, 0.08, 0.08, 0.42, 4.26, 0), block(0.36, 0.1, 0.22, 0.86, 4.2, 0)];
    const { surface } = body(stage, blocks, String(values.color), object);
    const head = glowing(stage, new THREE.BoxGeometry(0.3, 0.03, 0.17), String(values.light), false);
    head.position.set(0.86, 4.14, 0);
    object.add(head);
    const tone = new THREE.Color(String(values.light));
    const light: Lamp = { position: new THREE.Vector3(), color: tone, reach: Number(values.reach), amount: Number(values.amount) };
    const amount = light.amount;
    const flicker = Number(values.flicker);
    const salt = stream(2)() * 1000;
    return {
      object,
      height: 4.4,
      surface,
      blocks,
      lamp: { lamp: light, at: new THREE.Vector3(0.86, 3.9, 0) },
      update(seconds) {
        const power = flickering(seconds, flicker, salt);
        light.amount = amount * power;
        ((head.material as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color).copy(tone).multiplyScalar(0.2 + 0.8 * power);
      },
    };
  },
};

/** A television aerial on a mast: a boom with its rods across, and a smaller one under it. */
export const antenna: ThingDef = {
  id: 'antenna',
  channel: 5,
  params: { color: color('#3f3946'), sway: num(0.3, 0, 1, 0.01) },
  moods: shadeMoods('color', '#3f3946', { anxious: { sway: 0.8 } }),
  tint: ['color'],
  build(values, stage, stream) {
    const object = new THREE.Group();
    const head = new THREE.Group();
    object.add(head);
    const random = stream(2);
    const turn = (random() - 0.5) * 1.2;
    const blocks: Block[] = [block(0.07, 3.3, 0.07, 0, 1.65, 0)];
    const aerial = (y: number, length: number, rods: number): void => {
      blocks.push(block(length, 0.04, 0.04, 0, y, 0, turn));
      for (let i = 0; i < rods; i++) {
        const along = -length / 2 + ((i + 0.5) * length) / rods;
        const rod = 0.95 - (i * 0.45) / rods;
        blocks.push(block(0.03, 0.03, rod, Math.cos(turn) * along, y, -Math.sin(turn) * along, turn));
      }
    };
    aerial(3.2, 1.5, 6);
    aerial(2.55, 1, 4);
    const { surface } = body(stage, blocks, String(values.color), head);
    const sway = Number(values.sway);
    const phase = random() * Math.PI * 2;
    return {
      object,
      height: 3.3,
      surface,
      blocks,
      update(seconds) {
        head.rotation.z = sway * 0.5 * DEG * Math.sin(seconds * 1.1 + phase);
      },
    };
  },
};

/** A door with no wall round it: its frame, light where the opening is, and its leaf standing ajar. */
export const door: ThingDef = {
  id: 'door',
  channel: 2,
  params: {
    color: color('#5b6660'),
    light: color('#fff8e6'),
    open: num(0.3, 0, 1, 0.01),
    swing: num(0.08, 0, 1, 0.01),
  },
  moods: shadeMoods('color', '#5b6660', {
    sad: { light: '#e6ecf0' },
    strange: { light: '#f6ffcf', swing: 0.3 },
    anxious: { light: '#ffc98a', swing: 0.15 },
    fear: { light: '#ff2a14', open: 0.15, swing: 0.12 },
  }),
  tint: ['light'],
  build(values, stage, stream) {
    const width = 0.9;
    const height = 2.05;
    const frame = 0.07;
    const object = new THREE.Group();
    const blocks = [
      block(frame, height, 0.12, -width / 2 - frame / 2, height / 2, 0),
      block(frame, height, 0.12, width / 2 + frame / 2, height / 2, 0),
      block(width + frame * 2, frame, 0.12, 0, height + frame / 2, 0),
    ];
    const { surface } = body(stage, blocks, String(values.color), object);
    // The light is in the opening and nowhere else: from behind, the door is only a frame.
    const light = glowing(stage, new THREE.PlaneGeometry(width, height), String(values.light), false);
    light.position.set(0, height / 2, 0);
    object.add(light);
    const hinge = new THREE.Group();
    hinge.position.set(-width / 2, 0, 0.02);
    const leaf = glowing(stage, new THREE.BoxGeometry(width, height, 0.04), String(values.color));
    leaf.position.set(width / 2, height / 2, 0.02);
    hinge.add(leaf);
    object.add(hinge);
    const tone = new THREE.Color(String(values.light));
    const lampLight: Lamp = { position: new THREE.Vector3(), color: tone, reach: 9, amount: 1 };
    const open = Number(values.open);
    const swing = Number(values.swing);
    const phase = stream(2)() * Math.PI * 2;
    return {
      object,
      height: height + frame,
      surface,
      blocks,
      lamp: { lamp: lampLight, at: new THREE.Vector3(0, height * 0.6, 0.6) },
      update(seconds) {
        // The leaf opens towards the camera; the light that gets out goes with how far it is open.
        const ajar = Math.min(1, Math.max(0.02, open + swing * Math.sin(seconds * 0.5 + phase)));
        hinge.rotation.y = -ajar * 0.5 * Math.PI;
        lampLight.amount = 1.6 * (1 - Math.cos(ajar * 0.5 * Math.PI));
      },
    };
  },
};
