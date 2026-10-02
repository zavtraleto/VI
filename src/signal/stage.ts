import type * as THREE from 'three';
import type { Ps1Fog } from '../display/ps1';
import type { CameraRig } from './kit';
import type { Mood, ParamSpec, ParamValues } from './scene';
import type { Block, Lamp, Surface } from './surface';

/**
 * A transmission is put together from a place and the things that stand in it. The place
 * gives the ground, the air, the light and the camera; a thing is built on its own and takes
 * all of that from the place it has been put in. So a chair can stand in the sea and a pole
 * in a room.
 */

/** What a place gives the things that stand in it. */
export interface Stage {
  scene: THREE.Scene;
  rig: CameraRig;
  keep<T extends { dispose(): void }>(item: T): T;
  /** A stream of chance for a part of the scene. */
  stream(part: number): () => number;
  /** Cells of the grid vertices snap to. */
  snap: number;
  /** What everything fades into with distance. */
  fog: Ps1Fog;
  /** The lights of the place, as they are at this moment. Things may add their own. */
  lamps: Lamp[];
  ambient: THREE.Color;
  /** How finely a lit surface has to be cut: light is only known at the vertices. */
  cell: number;
  /** The place is open to the sky: something can stand in it. */
  sky: boolean;
  /** The way to the main light over the ground, in radians: 0 is behind the camera, π beyond what it looks at. */
  lightTurn: number;
  /** Where things stand; the first is the middle of the frame. */
  spots: THREE.Vector3[];
}

export interface PlaceInstance {
  stage: Stage;
  /**
   * The camera is set for a thing `height` tall in the middle of the frame. With `portrait`
   * it is a plain look at one thing standing at that spot.
   */
  subject(height: number, portrait: THREE.Vector3 | null): void;
  update(seconds: number, aspect: number): void;
  /** Boxes that throw shadows here, in the world; `around` is what a wrong shadow is turned about. */
  casters?(blocks: Block[], around: THREE.Vector3): void;
}

export interface PlaceContext {
  scene: THREE.Scene;
  keep<T extends { dispose(): void }>(item: T): T;
  stream(part: number): () => number;
  /** The place is left out: only its light, its air and its camera are wanted. */
  bare: boolean;
}

export interface PlaceDef {
  id: string;
  /** The face of the die whose channel the place answers through; 0 for a place that is here, not there. */
  channel: number;
  /** The thing that belongs here, or none. */
  native: string | null;
  params: Record<string, ParamSpec>;
  moods: Record<Mood, Partial<ParamValues>>;
  /** Colour parameters that become the dark of the board when a thing is shown alone. */
  dissolve: readonly string[];
  build(values: ParamValues, context: PlaceContext): PlaceInstance;
}

export interface ThingInstance {
  /** Built standing on the ground at the origin, looking down -z. Whoever composes the frame puts it in its place. */
  object: THREE.Object3D;
  height: number;
  /** Its lit parts, to be lit again every frame where the thing now stands. */
  surface?: Surface;
  /** Its boxes, where it was built: what throws its shadow. */
  blocks?: Block[];
  /** A light it carries, and where on the thing that light is. */
  lamp?: { lamp: Lamp; at: THREE.Vector3 };
  update?(seconds: number): void;
}

export interface ThingDef {
  id: string;
  /** The face of the die whose channel it belongs to; 0 for a thing that is from here. */
  channel: number;
  /** It stands in the sky and not on the ground. */
  sky?: boolean;
  params: Record<string, ParamSpec>;
  moods: Record<Mood, Partial<ParamValues>>;
  /** Colour parameters that take the colour of its channel when it is shown alone. */
  tint: readonly string[];
  /** `stream(n)` gives chance for a part of the thing; a twin asks for the same parts and looks the same. */
  build(values: ParamValues, stage: Stage, stream: (part: number) => () => number): ThingInstance;
}
