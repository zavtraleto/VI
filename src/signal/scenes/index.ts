import type { SceneDef } from '../scene';
import { corridorDoor } from './corridorDoor';
import { roomChair } from './roomChair';
import { seaPole } from './seaPole';

/** Every transmission there is, in the order the lab lists them. */
export const SCENES: readonly SceneDef[] = [seaPole, roomChair, corridorDoor];

export function sceneById(id: string | null): SceneDef | undefined {
  return SCENES.find((scene) => scene.id === id);
}
