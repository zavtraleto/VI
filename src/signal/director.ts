import { thingParam, type Recipe } from './compose';
import { PLACES } from './places';
import { nativeRecipe } from './recipes';
import type { ParamValues } from './scene';
import { THINGS } from './things';

/**
 * What is put in a frame, by chance and by how strong the contact is. The stronger it is, the
 * less things keep to their own places: that is the merge, shown and never said.
 *
 * For now this is all chance. The story will decide these things later; the steps stay.
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

export function randomFrame(random: () => number, contact: number): Frame {
  const mixing = mixingFor(contact);
  const open = PLACES.filter((place) => !INDOORS.includes(place.id));
  // At the last step it is most often under the sky: the sun has to be seen.
  const place = mixing === 4 && random() < 0.8 ? pick(open, random) : pick(PLACES, random);
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
