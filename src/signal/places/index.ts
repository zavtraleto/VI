import type { PlaceDef } from '../stage';
import { corridor } from './corridor';
import { field, glare, nightwater, sea } from './open';
import { roof } from './roof';
import { room } from './room';

/**
 * Every place there is. The open ones answer through a channel each, by the face of the die;
 * the room is here, not there.
 */
export const PLACES: readonly PlaceDef[] = [sea, room, corridor, field, roof, nightwater, glare];

export function placeById(id: string | null | undefined): PlaceDef | undefined {
  return PLACES.find((place) => place.id === id);
}
