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
 * How disquieting a transmission is, from the lightest to the heaviest: a light daydream,
 * sadness, strangeness, unease, fear. Every scene has all five.
 */
export const MOODS = ['dream', 'sad', 'strange', 'anxious', 'fear'] as const;
export type Mood = (typeof MOODS)[number];

/**
 * A transmission as code: its picture is built from parameters and a seed, with no asset
 * files. The same seed and parameters always give the same frame.
 */
export interface SceneDef {
  id: string;
  /** Defaults and ranges. */
  params: Record<string, ParamSpec>;
  /** What is in the picture: named sets of differences from the defaults. */
  variants: Record<string, Partial<ParamValues>>;
  /** How the picture feels: differences from the defaults again. `dream` is the defaults. */
  moods: Record<Mood, Partial<ParamValues>>;
  /** The face of the die whose channel the place answers through; 0 for a place that is here, not there. */
  channel: number;
  /** How the thing of the scene is shown without its place, when it leaks into the game. */
  thing: SceneThing;
  /** `bare` leaves the place out: only the thing is built, to stand in the dark of the board. */
  build(values: ParamValues, seed: number, bare?: boolean): SceneInstance;
}

export interface SceneThing {
  /** Colour parameters that take the colour of the channel: the thing carries it. */
  tint: readonly string[];
  /** Colour parameters that take the colour of the dark around: what the thing fades into. */
  dissolve: readonly string[];
  /** Values that bring the thing close enough to be seen alone. */
  frame: Partial<ParamValues>;
}

export interface SceneInstance {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** What the scene is told from outside: set before `update`, all nought for a transmission. See `Live` in `stage.ts`. */
  live: { swell: number; stir: number; flare: number; shade: number; sun: { at: number; size: number; r: number; g: number; b: number } | null };
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

export function isMood(name: string | null): name is Mood {
  return (MOODS as readonly string[]).includes(name ?? '');
}

/**
 * The defaults with a variant and then a mood laid over them: the variant says what is in
 * the picture, the mood how it feels.
 */
export function sceneValues(def: SceneDef, variant: string, mood: Mood): ParamValues {
  const values = variantValues(def, variant);
  for (const [name, value] of Object.entries(def.moods[mood] ?? {})) {
    if (name in values && value !== undefined) values[name] = value;
  }
  return values;
}

function parseHex(hex: string): [number, number, number] {
  const text = hex.replace('#', '');
  const full = text.length === 3 ? [...text].map((digit) => digit + digit).join('') : text.padEnd(6, '0');
  const value = Number.parseInt(full.slice(0, 6), 16) || 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** A colour between two others; `amount` 0 is the first, 1 the second. */
export function mixColor(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const t = Math.min(1, Math.max(0, amount));
  const channel = (i: number): string => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/**
 * Values between two sets of a scene: numbers and colours go smoothly from one to the other,
 * and what cannot be mixed changes over half-way. A number that counts things stays whole.
 */
export function blendValues(def: SceneDef, from: ParamValues, to: ParamValues, amount: number): ParamValues {
  const t = Math.min(1, Math.max(0, amount));
  const out: ParamValues = {};
  for (const [name, spec] of Object.entries(def.params)) {
    const a = from[name] ?? spec.value;
    const b = to[name] ?? spec.value;
    if (spec.kind === 'number' && typeof a === 'number' && typeof b === 'number') {
      const mixed = a + (b - a) * t;
      // Binary dust is cut off; a parameter with whole steps is a count and is rounded.
      const kept = spec.step >= 1 ? Math.round(mixed / spec.step) * spec.step : Number(mixed.toFixed(6));
      out[name] = Math.min(spec.max, Math.max(spec.min, kept));
    } else if (spec.kind === 'color' && typeof a === 'string' && typeof b === 'string') {
      out[name] = mixColor(a, b, t);
    } else {
      out[name] = t < 0.5 ? a : b;
    }
  }
  return out;
}

/**
 * The values of a scene for a contact of 0..1: the moods in their order, from the daydream to
 * fear, with everything between two of them mixed. The picture gets heavier little by little
 * as the contact grows, never by a jump.
 */
export function contactValues(def: SceneDef, variant: string, contact: number): ParamValues {
  const at = Math.min(1, Math.max(0, contact)) * (MOODS.length - 1);
  const lower = Math.min(MOODS.length - 2, Math.floor(at));
  return blendValues(def, sceneValues(def, variant, MOODS[lower]), sceneValues(def, variant, MOODS[lower + 1]), at - lower);
}

/**
 * What a mood does to the look of the picture, whatever the picture is: softer and dimmer
 * for sadness, parted colours and a coarse grid for strangeness, banding and grain for
 * unease, all of it for fear.
 */
export const LOOK_MOODS: Record<Mood, Partial<ParamValues>> = {
  dream: {},
  sad: { blur: 1, noise: 0.2, vignette: 0.35 },
  strange: { snap: 120, chroma: 1.4 },
  anxious: { depth: 4, smear: 2, chroma: 1.2, glow: 0.25, noise: 0.35, vignette: 0.42 },
  fear: { depth: 4, blur: 1.25, smear: 2.1, chroma: 1.1, glow: 0.6, noise: 0.3, vignette: 0.52 },
};

/** The values of a scene for its thing alone, in the colour `tint`, fading into `dark`. */
export function thingValues(def: SceneDef, values: ParamValues, tint: string, dark: string): ParamValues {
  const out: ParamValues = { ...values };
  for (const [name, value] of Object.entries(def.thing.frame)) {
    if (name in out && value !== undefined) out[name] = value;
  }
  for (const name of def.thing.tint) if (name in out) out[name] = tint;
  for (const name of def.thing.dissolve) if (name in out) out[name] = dark;
  return out;
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
