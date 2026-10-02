import type { SceneDef } from '../scene';
import { seaPole } from './seaPole';

/** Every transmission there is, in the order the lab lists them. */
export const SCENES: readonly SceneDef[] = [seaPole];

export function sceneById(id: string | null): SceneDef | undefined {
  return SCENES.find((scene) => scene.id === id);
}
