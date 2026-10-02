import * as THREE from 'three';
import { DEG, bool, keeper, num, streams } from './kit';
import { placeById } from './places';
import { MOODS, type Mood, type ParamSpec, type ParamValues, type SceneDef, type SceneInstance } from './scene';
import type { PlaceDef, ThingDef, ThingInstance } from './stage';
import type { Block } from './surface';
import { thingById } from './things';

/**
 * What a frame is made of: a place and the things in it. The first thing is the one the
 * camera is set for. Everything else about the frame is in its values.
 */
export interface Recipe {
  id: string;
  place: string;
  things: readonly string[];
  /** What is in the picture, as named sets of values: the same frame with one thing changed. */
  variants?: Record<string, Partial<ParamValues>>;
}

/**
 * How a thing stands in a frame, whatever the thing: where, turned how, how deep in the
 * ground, what size, how many. These are the deviations: a thing half gone through the
 * surface, a thing doubled, a thing of the wrong size, a thing that is nearer than it was.
 */
const SLOT: Record<string, ParamSpec> = {
  /** Metres from its spot: across the frame, and towards the camera. */
  x: num(0, -20, 20, 0.05),
  z: num(0, -30, 30, 0.05),
  /** How far it has come from its spot towards the camera: 0 is its spot, 1 is where the camera stands. */
  near: num(0, 0, 0.9, 0.01),
  turn: num(0, -180, 180, 1),
  tilt: num(0, 0, 60, 0.5),
  /** How much of its height is under the surface: it goes through it as a die does through the board. */
  sink: num(0, 0, 1, 0.01),
  scale: num(1, 0.2, 5, 0.01),
  /** A second one takes almost the same place. */
  twin: bool(false),
  twinShift: num(0.12, -0.6, 0.6, 0.01),
  twinTurn: num(14, -90, 90, 1),
  /** How many of them there are, each at a spot of its own. */
  count: num(1, 1, 12, 1),
};

/** The name of a parameter of a thing among the values of a frame. */
export const thingParam = (thing: string, name: string): string => `${thing}.${name}`;

function resolve(recipe: Recipe): { place: PlaceDef; things: ThingDef[] } {
  const place = placeById(recipe.place);
  if (!place) throw new Error(`No place "${recipe.place}".`);
  const things: ThingDef[] = [];
  for (const id of recipe.things) {
    const thing = thingById(id);
    if (!thing) throw new Error(`No thing "${id}".`);
    if (!things.includes(thing)) things.push(thing);
  }
  return { place, things };
}

/** The values of one thing out of the values of the frame: its own parameters and how it stands. */
function slotValues(values: ParamValues, thing: ThingDef): { own: ParamValues; slot: ParamValues } {
  const own: ParamValues = {};
  const slot: ParamValues = {};
  for (const name of Object.keys(thing.params)) own[name] = values[thingParam(thing.id, name)] ?? thing.params[name].value;
  for (const name of Object.keys(SLOT)) slot[name] = values[thingParam(thing.id, name)] ?? SLOT[name].value;
  return { own, slot };
}

interface Standing {
  instance: ThingInstance;
  /** What puts the thing in its place: the thing itself is left as it was built. */
  holder: THREE.Group;
  /** The lit body, somewhere inside the thing: it is lit where it now stands. */
  lit: THREE.Object3D | null;
  sky: boolean;
}

function litBody(instance: ThingInstance): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  if (!instance.surface) return null;
  instance.object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry.getAttribute('color')) found = child;
  });
  return found;
}

function build(recipe: Recipe, values: ParamValues, seed: number, bare: boolean): SceneInstance {
  const { place: placeDef, things } = resolve(recipe);
  const stream = streams(seed);
  const { keep, dispose } = keeper();
  const scene = new THREE.Scene();
  const place = placeDef.build(values, { scene, keep, stream, bare });
  const { stage } = place;

  const standing: Standing[] = [];
  const casters: Block[] = [];
  /** The camera is set for the first thing that stands on the ground, as soon as it is built. */
  let framed = false;
  /** Spots taken so far: every thing and every copy of it stands at its own. */
  let taken = 0;
  // Shown alone, it is the last thing of the frame that is shown: the one that does not belong here.
  const shown = bare ? things.slice(-1) : things;
  shown.forEach((thing, index) => {
    const slotIndex = bare ? 0 : index;
    const { own, slot } = slotValues(values, thing);
    // A thing of the sky stands in no place that has none.
    if (thing.sky) {
      if (!stage.sky && !bare) return;
      const instance = thing.build(own, stage, (part) => stream(part + slotIndex * 10));
      scene.add(instance.object);
      standing.push({ instance, holder: new THREE.Group(), lit: null, sky: true });
      return;
    }
    const count = bare ? 1 : Math.max(1, Math.round(Number(slot.count)));
    const copies = slot.twin === true && !bare ? count + 1 : count;
    for (let copy = 0; copy < copies; copy++) {
      const twin = slot.twin === true && !bare && copy === copies - 1;
      // A twin is the same thing again: the same chance, so the same shape.
      const part = twin ? 0 : copy;
      const instance = thing.build(own, stage, (n) => stream(n + slotIndex * 10 + part * 100));
      const spot = stage.spots[(twin ? taken - 1 : taken) % stage.spots.length];
      if (!twin) taken++;
      const holder = new THREE.Group();
      const size = Number(slot.scale);
      const shift = twin ? Number(slot.twinShift) : 0;
      // The first of a thing stands where it is put; the others are scattered a little by chance.
      const scatter = copy > 0 && !twin ? stream(50 + slotIndex * 10 + copy) : null;
      if (!framed) {
        framed = true;
        place.subject(instance.height * size, bare ? new THREE.Vector3(spot.x, 0, spot.z) : null);
      }
      const camera = stage.rig.stand();
      const near = bare ? 0 : Number(slot.near);
      holder.position.set(
        spot.x + (camera.x - spot.x) * near + Number(slot.x) + shift,
        -Number(slot.sink) * instance.height * size,
        spot.z + (camera.z - spot.z) * near + Number(slot.z) + shift * 0.4,
      );
      const turn = (Number(slot.turn) + (twin ? Number(slot.twinTurn) : 0)) * DEG + (scatter ? (scatter() - 0.5) * 2.4 : 0);
      const tilt = Number(slot.tilt) * DEG;
      if (tilt > 0) {
        const lean = stream(60 + slotIndex * 10 + copy)() * Math.PI * 2;
        holder.quaternion.setFromAxisAngle(new THREE.Vector3(Math.cos(lean), 0, Math.sin(lean)), tilt);
      }
      holder.rotateY(turn);
      holder.scale.setScalar(size);
      holder.add(instance.object);
      scene.add(holder);
      holder.updateMatrixWorld(true);
      standing.push({ instance, holder, lit: litBody(instance), sky: false });
      if (instance.lamp) stage.lamps.push(instance.lamp.lamp);
      for (const item of instance.blocks ?? []) casters.push({ size: item.size, matrix: holder.matrix.clone().multiply(item.matrix) });
    }
  });
  if (!framed) place.subject(0, null);
  place.casters?.(casters, stage.spots[0]);

  const at = new THREE.Vector3();
  return {
    scene,
    camera: stage.rig.camera,
    update(timeMs, aspect) {
      const seconds = timeMs / 1000;
      // A thing that carries a light moves it first: the place and the other things are lit by it.
      for (const { instance, holder, sky } of standing) {
        if (sky) continue;
        instance.update?.(seconds);
        if (instance.lamp) {
          holder.updateMatrixWorld(true);
          instance.lamp.lamp.position.copy(at.copy(instance.lamp.at).applyMatrix4(instance.object.matrixWorld));
        }
      }
      place.update(seconds, aspect);
      for (const { instance, holder, lit, sky } of standing) {
        // What stands in the sky follows the camera, which the place has just moved.
        if (sky) instance.update?.(seconds);
        if (!instance.surface || !lit) continue;
        holder.updateMatrixWorld(true);
        instance.surface.light(stage.lamps, stage.ambient, lit.matrixWorld);
      }
    },
    dispose,
  };
}

const defs = new Map<string, SceneDef>();

/**
 * A frame as a scene: the parameters of its place, and for each thing in it the thing's own
 * parameters and how it stands, under the thing's name (`chair.sink`, `pole.height`). The
 * moods of the place and of the things go together.
 */
export function frameDef(recipe: Recipe): SceneDef {
  const key = `${recipe.id}|${recipe.place}|${recipe.things.join()}`;
  const kept = defs.get(key);
  if (kept) return kept;
  const { place, things } = resolve(recipe);

  const params: Record<string, ParamSpec> = { ...place.params };
  for (const thing of things) {
    for (const [name, spec] of Object.entries(thing.params)) params[thingParam(thing.id, name)] = spec;
    if (thing.sky) continue;
    for (const [name, spec] of Object.entries(SLOT)) params[thingParam(thing.id, name)] = spec;
  }
  const moods = {} as Record<Mood, Partial<ParamValues>>;
  for (const mood of MOODS) {
    moods[mood] = { ...place.moods[mood] };
    for (const thing of things) {
      for (const [name, value] of Object.entries(thing.moods[mood])) moods[mood][thingParam(thing.id, name)] = value;
    }
  }
  const def: SceneDef = {
    id: recipe.id,
    params,
    variants: recipe.variants ?? { a: {} },
    moods,
    channel: place.channel,
    thing: {
      tint: things.slice(-1).flatMap((thing) => thing.tint.map((name) => thingParam(thing.id, name))),
      dissolve: place.dissolve,
      frame: {},
    },
    build: (values, seed, bare = false) => build(recipe, values, seed, bare),
  };
  defs.set(key, def);
  return def;
}
