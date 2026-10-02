import { frameDef } from '../compose';
import { RECIPES } from '../recipes';
import type { SceneDef } from '../scene';

/** Every transmission that has a name, in the order the lab lists them. */
export const SCENES: readonly SceneDef[] = RECIPES.map((recipe) => frameDef(recipe));

export function sceneById(id: string | null): SceneDef | undefined {
  return SCENES.find((scene) => scene.id === id);
}
