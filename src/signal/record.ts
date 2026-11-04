import { DEG } from './kit';
import { figureOf, type SignalCard } from './card';
import { frameDef, thingParam } from './compose';
import type { Frame } from './director';
import { RECIPES } from './recipes';
import type { ParamValues } from './scene';

/**
 * How a record of the link looks (docs/superpowers/specs/2026-11-04-vi-star-novel-design.md,
 * section 10): a transmission that fills the screen, a place of the other side in the cold of
 * night, and in it, behind the band of the words, the voice of the other side: her picture, graded
 * into the cold of the place, with a light edge and the marks of the signal on her. The owner,
 * 4 November 2026: «наши фоны, фотография или генерация с девушкой, светящийся контур»; then, of
 * the silhouette: «покажи саму фигуру, не только силуэт. я хочу картинку. а также наложи на неё
 * подходящий эффект и цветокор.»
 *
 * Every number of the look is here, so it can be turned without looking for it.
 */
export const NOVEL_LOOK = {
  /**
   * How heavy the picture is, 0..1, as a session's contact: 0.25 is the second of the moods
   * (`MOODS`), the cold one - grey air, a lamp that hardly reaches the walls, a softer picture.
   * The colours below are laid over it.
   */
  contact: 0.25,
  /** The place of each record, by its code, and the colours laid over its mood: dark, cold, blue-green. */
  scenes: {
    // 01: the sea with the pole at night. The pole stands aside, where the figure leaves room for it.
    n01: {
      recipe: 'sea_pole',
      values: { skyTop: '#060f15', skyHorizon: '#1b3640', ground: '#0a1a20', lightAmount: 0.3, glint: 0, glow: 0 },
      /** Where the pole stands across the frame, as a share of half its width from the middle, to the right. */
      pole: 0.62,
      poleColor: '#14232a',
      /** The dark of the place: the shadows of the figure go into it, so she stands in the place and is not laid over it. */
      fill: '#0a171d',
    },
    // 02: the room with the chair, under a cold lamp.
    n02: {
      recipe: 'room_chair',
      values: { wall: '#2a3c42', floor: '#17252a', lampColor: '#9cc9d1', dark: '#091317', ambient: 0.4 },
      pole: 0,
      poleColor: '',
      fill: '#0c181c',
    },
    // 03: the corridor, the door at the end the one cold light.
    n03: {
      recipe: 'corridor_door',
      values: {
        wall: '#2c3f45', wallLow: '#1f3035', floor: '#162327', ceiling: '#25363b', doorColor: '#0b1417',
        doorLight: '#86c0c9', lampColor: '#98c3ca', dark: '#071013', ambient: 0.4,
      },
      pole: 0,
      poleColor: '',
      fill: '#0a1518',
    },
  } as Record<string, NovelScene>,
  /** The voice of the other side, a figure to the waist standing in the middle of the frame. */
  figure: {
    /** How tall the figure is, as a share of the frame's height; it stands on the frame's bottom edge. */
    height: 0.8,
    /** The most of the frame's width it takes: on a tall screen it is the width that decides. */
    maxWidth: 0.86,
    /** Where its middle stands across the frame, 0..1. */
    x: 0.5,
    /** The colour of the light at its edge: cold, pale. */
    halo: '#9fd8e0',
    /** How far the light spreads out past the edge, as a share of the figure's height. */
    haloWidth: 0.035,
    /** How strong that light is, 0..1, at its strongest: kept low, so it does not argue with the face. */
    haloAmount: 0.3,
    /** How deep the light comes in over the edge itself, as a share of the figure's height. */
    rimWidth: 0.012,
    /** How strong it is there, 0..1. */
    rimAmount: 0.25,
    /**
     * The colour of her picture, graded towards the cold television of the owner's reference.
     * In this order: the colour is taken out down to `saturation`; the contrast is raised about
     * the middle grey; then the picture goes `tone` of the way towards a scale of its own
     * lightness, from the dark of the place (`fill` of the scene) to `highlight`; and in the
     * middle tones `warmth` of what it was before the scale is kept, so the skin stays warm.
     */
    grade: {
      saturation: 0.45,
      contrast: 1.12,
      tone: 0.6,
      highlight: '#a9dce3',
      warmth: 0.4,
    },
    /** How bright she is while the operator speaks, as a share of how bright she is while she does. */
    operatorBright: 0.6,
    /** How much of the light at her edge and of her glow there is while she speaks, and while the operator does. */
    voice: 1,
    operator: 0.35,
    /** Milliseconds the brightness and the light take to come most of the way to their new strength. */
    fadeMs: 500,
    /**
     * The marks of the signal on her, over those the whole transmission has. `halation`: the light
     * parts of her picture glow softly in `halo`, past themselves by `halationWidth` of her height;
     * only what is lighter than `halationFrom` glows.
     */
    halation: 0.35,
    halationWidth: 0.02,
    halationFrom: 0.55,
    /** How dark every other line of the picture is over her, 0..1. */
    scanlines: 0.06,
    /** Grain over her, 0..1: new 24 times a second, and still with motion kept low. */
    grain: 0.05,
    /**
     * Now and then a band of her lines slips sideways a little and comes back, softly: every
     * `slipEvery` milliseconds (both ends, by chance), for `slipMs`, a band `slipBand` of her
     * height, by `slipShift` of her width. None with motion kept low.
     */
    slipEvery: [4000, 9000],
    slipMs: 260,
    slipBand: 0.05,
    slipShift: 0.006,
    /** The figure breathes: it grows by this share and back, once in this many milliseconds. None with motion kept low. */
    breath: 0.004,
    breathMs: 5600,
    /** Rows of the picture her picture and its edge are worked out in: the picture of a transmission has 240. */
    maskLines: 320,
  },
} as const;

/** The place of a record and what is laid over it. */
export interface NovelScene {
  recipe: string;
  values: Partial<ParamValues>;
  /** Share of half the frame's width the pole stands to the right of the middle; 0 for a place with no pole. */
  pole: number;
  poleColor: string;
  fill: string;
}

/** The look of a record by its code; the first record's for a code there is none of. */
export function novelScene(code: string): NovelScene {
  return NOVEL_LOOK.scenes[code] ?? NOVEL_LOOK.scenes.n01;
}

/**
 * The transmission a record is shown in: its place in the cold mood, made for a window of this
 * shape (`aspect`, width over height). It stays until it is closed, and says nothing of its own:
 * the lines of the record are written over it.
 */
export function novelCard(code: string, random: () => number, aspect: number): SignalCard {
  const look = novelScene(code);
  const recipe = RECIPES.find((one) => one.id === look.recipe) ?? RECIPES[0];
  const values: Partial<ParamValues> = { ...look.values };
  if (look.pole > 0 && recipe.things.includes('pole')) {
    const def = frameDef(recipe);
    const distance = Number(def.params.camDistance.value);
    const halfAcross = Math.tan((Number(def.params.camFov.value) * DEG) / 2) * aspect;
    values[thingParam('pole', 'x')] = look.pole * halfAcross * distance;
    values[thingParam('pole', 'color')] = look.poleColor;
  }
  const frame: Frame = { recipe, variant: 'a', values, mixing: 1 };
  const seed = 1 + Math.floor(random() * 9999);
  return { frame, contact: NOVEL_LOOK.contact, seed, figure: figureOf(frame), caption: null, seconds: Infinity };
}

/** Where a part of the frame is, in shares of it from its left and its bottom. */
export interface FrameBox {
  left: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Where the picture of the figure stands in a frame of this shape (`aspect`, width over height),
 * the picture being `sprite` wide over high: as tall as `height` asks, or narrower on a tall frame,
 * standing on the bottom edge. `breath` makes it that share larger, the bottom edge staying.
 */
export function figureBox(aspect: number, sprite: number, breath = 0, look = NOVEL_LOOK.figure): FrameBox {
  const height = Math.min(look.height, (look.maxWidth * aspect) / Math.max(0.01, sprite)) * (1 + breath);
  const width = (height * sprite) / Math.max(0.01, aspect);
  return { left: look.x - width / 2, bottom: 0, width, height };
}

/** The picture of the figure, and its edge and its light worked out of it. */
export interface FigureMask {
  /**
   * Four bytes a point, rows from the top: the figure itself in the first, its outline spread
   * wide in the second (the light outside it), spread a little in the third (the light over its
   * edge), and its light parts spread in the fourth (its glow).
   */
  data: Uint8Array;
  /** Its picture, four bytes a point as it was, in the same places as `data`. */
  color: Uint8Array;
  width: number;
  height: number;
  /** Points of air around the picture, on every side: the light outside the figure has room in it. */
  pad: number;
}

/** A box blur of one direction of a picture, `radius` points each way; outside the picture is nothing. */
function blurLine(src: Float32Array, dst: Float32Array, width: number, height: number, radius: number, across: boolean): void {
  const length = across ? width : height;
  const lines = across ? height : width;
  const stride = across ? 1 : width;
  const step = across ? width : 1;
  const share = 1 / (2 * radius + 1);
  for (let line = 0; line < lines; line++) {
    const base = line * step;
    let sum = 0;
    for (let i = 0; i <= radius && i < length; i++) sum += src[base + i * stride];
    for (let i = 0; i < length; i++) {
      dst[base + i * stride] = sum * share;
      const enter = i + radius + 1;
      const leave = i - radius;
      if (enter < length) sum += src[base + enter * stride];
      if (leave >= 0) sum -= src[base + leave * stride];
    }
  }
}

/** Three box blurs one after another: near enough the soft fall of a light. `reach` is how far it goes, in points. */
function spread(alpha: Float32Array, width: number, height: number, reach: number): Float32Array {
  const radius = Math.max(1, Math.round(reach / 3));
  const a = Float32Array.from(alpha);
  const b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    blurLine(a, b, width, height, radius, true);
    blurLine(b, a, width, height, radius, false);
  }
  return a;
}

/**
 * The edge and the glow of the figure out of its picture (`pixels`, four bytes a point, rows from
 * the top, `width` by `height`, not premultiplied). The picture is cut at the waist: below its
 * last row the figure goes on, so the cut gives no light.
 */
export function figureMask(pixels: ArrayLike<number>, width: number, height: number, look = NOVEL_LOOK.figure): FigureMask {
  const haloReach = Math.max(1, look.haloWidth * height);
  const rimReach = Math.max(1, look.rimWidth * height);
  const glowReach = Math.max(1, look.halationWidth * height);
  const pad = Math.ceil(Math.max(haloReach, glowReach)) + 2;
  const w = width + pad * 2;
  const h = height + pad * 2;
  const body = new Float32Array(w * h);
  const light = new Float32Array(w * h);
  const color = new Uint8Array(w * h * 4);
  const from = Math.min(0.99, look.halationFrom);
  for (let y = 0; y < h; y++) {
    // The rows under the picture repeat its last one.
    const row = Math.min(height - 1, y - pad);
    if (row < 0) continue;
    for (let x = 0; x < width; x++) {
      const at = (row * width + x) * 4;
      const to = y * w + x + pad;
      const cover = pixels[at + 3] / 255;
      body[to] = cover;
      const lightness = (0.2126 * pixels[at] + 0.7152 * pixels[at + 1] + 0.0722 * pixels[at + 2]) / 255;
      light[to] = (Math.max(0, lightness - from) / (1 - from)) * cover;
      for (let c = 0; c < 4; c++) color[to * 4 + c] = pixels[at + c];
    }
  }
  const halo = spread(body, w, h, haloReach);
  const rim = spread(body, w, h, rimReach);
  const glow = spread(light, w, h, glowReach);
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = Math.round(body[i] * 255);
    data[i * 4 + 1] = Math.round(Math.min(1, halo[i]) * 255);
    data[i * 4 + 2] = Math.round(Math.min(1, rim[i]) * 255);
    data[i * 4 + 3] = Math.round(Math.min(1, glow[i]) * 255);
  }
  return { data, color, width: w, height: h, pad };
}
