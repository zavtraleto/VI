import { thingParam, type Recipe } from './compose';
import { PLACES } from './places';

/**
 * Frames that have a name: each place with the thing that belongs to it, the way the art
 * document describes its first pictures. Anything else is put together on the spot from a
 * place and things.
 */
export const RECIPES: readonly Recipe[] = [
  // IMAGE 0001, and 0003: the same sea, one wire of the pole goes under the water.
  { id: 'sea_pole', place: 'sea', things: ['pole'], variants: { a: {}, b: { [thingParam('pole', 'wireUnderwater')]: true } } },
  // IMAGE 0002, and 0006: the same room, two chairs take almost the same place.
  { id: 'room_chair', place: 'room', things: ['chair'], variants: { a: {}, b: { [thingParam('chair', 'twin')]: true } } },
  // IMAGE 0004, and the same corridor with the door almost shut.
  { id: 'corridor_door', place: 'corridor', things: [], variants: { a: {}, b: { doorOpen: 0.4 } } },
  { id: 'field_tree', place: 'field', things: ['tree'] },
  { id: 'roof_antenna', place: 'roof', things: ['antenna'] },
  { id: 'nightwater_lamp', place: 'nightwater', things: ['lamp'] },
  { id: 'glare_sun', place: 'glare', things: ['sun'] },
  // The room of the institute: the table of the device stands in it.
  { id: 'room_table', place: 'room', things: ['table'] },
];

/** A place with the thing that belongs to it and nothing else. */
export function nativeRecipe(placeId: string): Recipe {
  const named = RECIPES.find((recipe) => recipe.place === placeId);
  if (named) return named;
  const place = PLACES.find((item) => item.id === placeId) ?? PLACES[0];
  return { id: place.id, place: place.id, things: place.native ? [place.native] : [] };
}
