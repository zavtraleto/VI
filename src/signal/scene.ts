import type * as THREE from 'three';
import { nextRandom } from '../rules/rng';

/** What a parameter of a scene is and where it starts. */
export type ParamSpec =
  | { kind: 'number'; value: number; min: number; max: number; step: number }
  | { kind: 'color'; value: string }
  | { kind: 'boolean'; value: boolean }
  /** One of a list of names, like a font. */
  | { kind: 'choice'; value: string; options: string[] };

/** The value of every parameter by its name. */
export type ParamValues = Record<string, number | string | boolean>;

/**
 * A transmission as code: its picture is built from parameters and a seed, with no asset
 * files. The same seed and parameters always give the same frame.
 */
export interface SceneDef {
  id: string;
  /** Defaults and ranges. */
  params: Record<string, ParamSpec>;
  /** Named sets of differences from the defaults. */
  variants: Record<string, Partial<ParamValues>>;
  build(values: ParamValues, seed: number): SceneInstance;
}

export interface SceneInstance {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(timeMs: number, aspect: number): void;
  dispose(): void;
}

/**
 * Parameters of the look that every scene has. `snap` goes to the scene's materials; the rest
 * belongs to the layer the scene is drawn into.
 */
export const LOOK_PARAMS = {
  /** Height of the picture in pixels. */
  lines: { kind: 'number', value: 240, min: 120, max: 480, step: 1 },
  /** Bits per colour channel; 8 leaves the colours as they are. */
  depth: { kind: 'number', value: 5, min: 3, max: 8, step: 1 },
  /** Strength of the ordered dither that hides the steps of a low colour depth. */
  dither: { kind: 'number', value: 1, min: 0, max: 1, step: 0.05 },
  /** Cells of the grid the vertices snap to, down the height of the picture; 0 turns it off. */
  snap: { kind: 'number', value: 240, min: 0, max: 480, step: 1 },
  /** The picture is stretched to the screen softly, not in hard squares. */
  smooth: { kind: 'boolean', value: true },
  /** Radius of the blur, in pixels of the picture. */
  blur: { kind: 'number', value: 0.7, min: 0, max: 4, step: 0.05 },
  /** Extra blur along the lines only, in pixels of the picture. */
  smear: { kind: 'number', value: 1, min: 0, max: 8, step: 0.05 },
  /** How far red and blue part from green along the lines, in pixels of the picture. */
  chroma: { kind: 'number', value: 0.6, min: 0, max: 4, step: 0.05 },
  /** Light spilling out of the bright parts. */
  glow: { kind: 'number', value: 0, min: 0, max: 1, step: 0.01 },
  /** Grain that changes from frame to frame. */
  noise: { kind: 'number', value: 0.15, min: 0, max: 1, step: 0.01 },
  /** How dark the gaps between the lines are. */
  scanlines: { kind: 'number', value: 0.15, min: 0, max: 1, step: 0.01 },
  /** How dark the corners are. */
  vignette: { kind: 'number', value: 0.2, min: 0, max: 1, step: 0.01 },
} satisfies Record<string, ParamSpec>;

/** The part of a layer's look that the parameters of a scene set. */
export interface SignalLook {
  depth: number;
  dither: number;
  filter: 'nearest' | 'linear';
  blur: number;
  smear: number;
  chroma: number;
  glow: number;
  noise: number;
  scanlines: number;
  vignette: number;
}

/** What the look parameters of a scene mean for the layer it is drawn into. */
export function signalLook(values: ParamValues): SignalLook {
  const n = (name: string): number => Number(values[name] ?? 0);
  return {
    depth: Number(values.depth ?? 8),
    dither: n('dither'),
    filter: values.smooth === true ? 'linear' : 'nearest',
    blur: n('blur'),
    smear: n('smear'),
    chroma: n('chroma'),
    glow: n('glow'),
    noise: n('noise'),
    scanlines: n('scanlines'),
    vignette: n('vignette'),
  };
}

/**
 * Lines for a layer of text over a scene. A scene on a tall window is narrow, too narrow to
 * write on: the text gets as many pixels across as the scene would have on a 4:3 screen.
 */
export function captionLines(lines: number, aspect: number): number {
  return Math.round(lines * Math.max(1, 4 / 3 / aspect));
}

export function defaultValues(def: SceneDef): ParamValues {
  const values: ParamValues = {};
  for (const [name, spec] of Object.entries(def.params)) values[name] = spec.value;
  return values;
}

/** The defaults with a variant laid over them. An unknown variant is the defaults. */
export function variantValues(def: SceneDef, variant: string): ParamValues {
  const values = defaultValues(def);
  for (const [name, value] of Object.entries(def.variants[variant] ?? {})) {
    if (name in values && value !== undefined) values[name] = value;
  }
  return values;
}

function same(a: number | string | boolean, b: number | string | boolean): boolean {
  // Colours come back from a colour picker in either case.
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

/** Only the values that differ from the defaults: what is worth writing down. */
export function changedValues(def: SceneDef, values: ParamValues): ParamValues {
  const changed: ParamValues = {};
  for (const [name, spec] of Object.entries(def.params)) {
    const value = values[name];
    if (value !== undefined && !same(value, spec.value)) changed[name] = value;
  }
  return changed;
}

/** A tuned scene as plain data: enough to build the same frame again. */
export interface SceneRecord {
  scene: string;
  seed: number;
  values: ParamValues;
}

export function sceneRecord(def: SceneDef, seed: number, values: ParamValues): SceneRecord {
  return { scene: def.id, seed, values: changedValues(def, values) };
}

/** A stream of numbers in 0..1 that depends on the seed alone. Scenes never use `Math.random`. */
export function seededRandom(seed: number): () => number {
  const holder = { rng: seed | 0 };
  return () => nextRandom(holder);
}
