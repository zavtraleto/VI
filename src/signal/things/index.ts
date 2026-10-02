import type { ThingDef } from '../stage';
import { chair, mannequin, phone, table, tv, wall } from './here';
import { antenna, door, lamp, tree } from './outside';
import { pole } from './pole';
import { sun } from './sky';

/** Every thing there is, in the order the lab lists them. */
export const THINGS: readonly ThingDef[] = [pole, chair, door, tree, antenna, lamp, sun, mannequin, table, phone, tv, wall];

export function thingById(id: string | null | undefined): ThingDef | undefined {
  return THINGS.find((thing) => thing.id === id);
}
