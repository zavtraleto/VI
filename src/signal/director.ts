import { thingParam, type Recipe } from './compose';
import { PLACES } from './places';
import { nativeRecipe } from './recipes';
import type { ParamValues } from './scene';
import { THINGS } from './things';

/**
 * What is put in a frame. A frame by chance (`randomFrame`) keeps to the contact of the session it
 * comes in: the stronger it is, the less things keep to their own places, the merge, shown and never
 * said; the leaks behind the field are such frames. A frame of a call (`callFrame`) is the scene of
 * that call, the same every time.
 */

/** A frame to show: what it is made of, and how its things stand. */
export interface Frame {
  recipe: Recipe;
  variant: string;
  /** Values laid over those the contact gives: where things stand and how. */
  values: Partial<ParamValues>;
  /** How far the merge has gone in this frame, 1..4. */
  mixing: number;
}

/** A thing smaller than this is brought nearer to the camera, or it would not be seen at all. */
const SMALL = 2.5;
const HEIGHTS: Record<string, number> = {
  pole: 8,
  chair: 0.92,
  door: 2.1,
  tree: 5.2,
  antenna: 3.3,
  lamp: 4.4,
  mannequin: 1.75,
  table: 0.8,
  phone: 1.75,
  tv: 0.95,
  wall: 2.7,
};
/** Places with no sky over them. */
const INDOORS = ['room', 'corridor'];

/**
 * How far the merge has gone at a contact of 0..1:
 * 1 — every thing in its own place;
 * 2 — one thing that does not belong;
 * 3 — and it is wrong: half gone into the surface, doubled, the wrong size, too near, or the place is under water;
 * 4 — everything in one place under the red sun, and the mannequins are many.
 */
export function mixingFor(contact: number): number {
  if (contact < 0.2) return 1;
  if (contact < 0.45) return 2;
  if (contact < 0.75) return 3;
  return 4;
}

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
const between = (from: number, to: number, random: () => number): number => from + random() * (to - from);
const round = (value: number, digits = 2): number => Number(value.toFixed(digits));

/** Things that stand on the ground and do not belong to the place. */
function visitors(placeId: string): string[] {
  const native = PLACES.find((place) => place.id === placeId)?.native;
  return THINGS.filter((thing) => !thing.sky && thing.id !== native).map((thing) => thing.id);
}

/** A small thing comes forward so that it is seen; a large one stays at its spot. */
function comeNear(values: Partial<ParamValues>, thing: string, random: () => number): void {
  if ((HEIGHTS[thing] ?? SMALL) < SMALL) values[thingParam(thing, 'near')] = round(between(0.35, 0.6, random));
}

/** What more a frame can be asked for: how far the merge has gone, other than the contact gives, and places it may not be in. */
export interface FrameAsk {
  mixing?: number;
  without?: readonly string[];
}

export function randomFrame(random: () => number, contact: number, ask: FrameAsk = {}): Frame {
  const mixing = ask.mixing ?? mixingFor(contact);
  const places = PLACES.filter((place) => !(ask.without ?? []).includes(place.id));
  const open = places.filter((place) => !INDOORS.includes(place.id));
  // At the last step it is most often under the sky: the sun has to be seen.
  const place = mixing === 4 && random() < 0.8 ? pick(open, random) : pick(places, random);
  const indoors = INDOORS.includes(place.id);
  const native = nativeRecipe(place.id);
  const variants = Object.keys(native.variants ?? { a: {} });
  // The changed version of a named frame turns up now and then.
  const variant = variants.length > 1 && random() < 0.3 ? variants[1] : variants[0];
  if (mixing === 1) return { recipe: native, variant, values: {}, mixing };

  const values: Partial<ParamValues> = {};
  const things = [...native.things];
  const pool = visitors(place.id).filter((id) => !things.includes(id));
  const take = (): string => pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1)[0];
  const visitor = take();
  // Where nothing of the place stands on the ground, the visitor is what the camera is set for.
  const framed = !native.things.some((id) => id in HEIGHTS);
  things.push(visitor);
  if (!framed) comeNear(values, visitor, random);

  if (mixing >= 3) {
    // The visitor is wrong in one way.
    const wrong = random();
    if (indoors && wrong < 0.3) {
      values.flood = round(between(0.2, 0.45, random));
    } else if (wrong < 0.55) {
      values[thingParam(visitor, 'sink')] = round(between(0.3, 0.6, random));
      values[thingParam(visitor, 'tilt')] = round(between(6, 22, random), 0);
    } else if (wrong < 0.75) {
      values[thingParam(visitor, 'twin')] = true;
    } else if (wrong < 0.9) {
      values[thingParam(visitor, 'scale')] = random() < 0.5 ? 0.45 : 2.3;
    } else if (!framed) {
      values[thingParam(visitor, 'near')] = round(between(0.6, 0.8, random));
    } else {
      values[thingParam(visitor, 'twin')] = true;
    }
    // And someone stands far off, half the time.
    if (visitor !== 'mannequin' && random() < 0.5 && pool.includes('mannequin')) {
      pool.splice(pool.indexOf('mannequin'), 1);
      things.push('mannequin');
    }
  }

  if (mixing === 4) {
    // Everything in one place: more things, each a little wrong, the mannequins many, the sun over it.
    const more = 2 + Math.floor(random() * 3);
    for (let i = 0; i < more && pool.length > 0; i++) {
      const thing = take();
      things.push(thing);
      if (thing === 'mannequin') continue;
      if (random() < 0.5) {
        values[thingParam(thing, 'sink')] = round(between(0.2, 0.6, random));
        values[thingParam(thing, 'tilt')] = round(between(4, 18, random), 0);
      }
      if ((HEIGHTS[thing] ?? SMALL) < SMALL && random() < 0.6) values[thingParam(thing, 'near')] = round(between(0.2, 0.5, random));
    }
    if (!things.includes('mannequin')) things.push('mannequin');
    values[thingParam('mannequin', 'count')] = 3 + Math.floor(random() * 7);
    if (!indoors && !things.includes('sun')) things.push('sun');
  }

  return { recipe: { id: `${place.id}:${things.join('+')}`, place: place.id, things, variants: native.variants }, variant, values, mixing };
}

/**
 * The scenes of the calls (docs/superpowers/specs/2026-11-05-vi-scenes-story-binding-design.md, section
 * 2): every call has a scene of its own, as every record has (the owner, 5 November 2026: «(а) По
 * номеру»). Each stands in a place of its own, and in each stands the telephone on its post, the
 * receiver off the hook: the sign of the line. The scenes do not darken with the road of the player:
 * that rule is gone (the owner, 5 November 2026: «от этого мы тоже можем уйти сейчас»); each has the
 * mood of what its caller says.
 */
export interface CallScene {
  place: string;
  /** What stands in it besides the telephone. */
  things: readonly string[];
  /** How heavy its picture is, 0..1. */
  contact: number;
  /** Values laid over the place: where the telephone stands, and how. */
  values: Partial<ParamValues>;
}

/**
 * Where the telephone stands in an open place: it comes most of the way towards the camera from its
 * spot, which is off to the side, and a little back towards the middle, so that a narrow screen sees it too.
 */
const PHONE_OPEN = { [thingParam('phone', 'near')]: 0.6, [thingParam('phone', 'x')]: -1.4 };

export const CALL_SCENES: readonly CallScene[] = [
  // 1 «Проверка линии»: a number that has not answered in a long time; a light field.
  { place: 'field', things: ['tree'], contact: 0.1, values: PHONE_OPEN },
  // 2 «Шесть»: six channels, and the noise that is everyone at once; the roof with the antenna.
  { place: 'roof', things: ['antenna'], contact: 0.35, values: { ...PHONE_OPEN, [thingParam('phone', 'x')]: -0.4 } },
  // 3 «Тихое событие»: the dice go under the water; the telephone half under it.
  { place: 'nightwater', things: ['lamp'], contact: 0.25, values: { ...PHONE_OPEN, [thingParam('phone', 'sink')]: 0.25, [thingParam('phone', 'tilt')]: 10 } },
  // 4: the room with the table of the device.
  { place: 'room', things: ['table'], contact: 0.2, values: { [thingParam('phone', 'near')]: 0.45, [thingParam('phone', 'x')]: 1 } },
  // 5: the sea with the pole, the line itself.
  { place: 'sea', things: ['pole'], contact: 0.3, values: PHONE_OPEN },
  // 6: the corridor; the telephone stands at its end.
  { place: 'corridor', things: [], contact: 0.4, values: {} },
  // 7: the glare under the red sun; the telephone stands a little aside, so that the sun is seen.
  { place: 'glare', things: ['sun'], contact: 0.5, values: { [thingParam('phone', 'near')]: 0.2, [thingParam('phone', 'x')]: 0.35 } },
];

/** The calls there are scenes for; a call past the last shows the last. */
export const CALL_SCENE_COUNT = CALL_SCENES.length;

/** An echo of the line, after Endless and in a glimpse, is the scene of the last call, this much lighter. */
export const ECHO_CONTACT = 0.5;

/** The scene of a call, 1..7. */
export function callScene(call: number): CallScene {
  return CALL_SCENES[Math.min(CALL_SCENE_COUNT, Math.max(1, Math.round(call))) - 1];
}

/** The frame of a call: its scene, with the telephone in it. */
export function callFrame(call: number): Frame {
  const scene = callScene(call);
  const native = nativeRecipe(scene.place);
  const things = [...scene.things, 'phone'];
  return {
    recipe: { id: `${scene.place}:${things.join('+')}:call`, place: scene.place, things, variants: native.variants },
    variant: 'a',
    values: { ...scene.values },
    mixing: 2,
  };
}
