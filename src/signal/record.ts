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
  /** The place of each record, by its code, and the colours laid over its mood: dark, cold, blue (the owner, 4 November 2026: «сделай синее и холоднее»). */
  scenes: {
    // Act I: she is a silhouette (the owner, 5 November 2026: «в первом акте можно показать силуэт девушки, а во втором уже раскрыть личность»).
    // 01: the sea with the pole at night. The pole stands aside, where the figure leaves room for it.
    n01: {
      recipe: 'sea_pole',
      values: { skyTop: '#050a18', skyHorizon: '#1a2a4a', ground: '#08122a', lightAmount: 0.3, glint: 0, glow: 0 },
      aside: { thing: 'pole', share: 0.62, color: '#111a2e' },
      /** The dark of the place: the shadows of the figure go into it, so she stands in the place and is not laid over it. A silhouette is filled with it. */
      fill: '#08101f',
      figure: 'silhouette',
      revealAt: null,
    },
    // 02: the room with the chair, under a cold lamp.
    n02: { recipe: 'room_chair', values: { wall: '#25324a', floor: '#131b2e', lampColor: '#a4bde6', dark: '#070c18', ambient: 0.4 }, aside: null, fill: '#0a1121', figure: 'silhouette', revealAt: null },
    // 03: the corridor, the door at the end the one cold light.
    n03: {
      recipe: 'corridor_door',
      values: {
        wall: '#27344c', wallLow: '#1a2539', floor: '#11192a', ceiling: '#212c42', doorColor: '#0a0f20',
        doorLight: '#8eaee0', lampColor: '#9eb4de', dark: '#060a16', ambient: 0.4,
      },
      aside: null,
      fill: '#08101d',
      figure: 'silhouette',
      revealAt: null,
    },
    // Act II "Room": 04 opens on her silhouette, and on its second line, «Это… лицо», her face comes through.
    n04: { recipe: 'room_chair', values: { wall: '#25324a', floor: '#131b2e', lampColor: '#a4bde6', dark: '#070c18', ambient: 0.4 }, aside: null, fill: '#0a1121', figure: 'silhouette', revealAt: 1 },
    n05: { recipe: 'room_chair', values: { wall: '#25324a', floor: '#131b2e', lampColor: '#a4bde6', dark: '#070c18', ambient: 0.4 }, aside: null, fill: '#0a1121', figure: 'face', revealAt: null },
    // 06 "Water": dark water under a night sky; its lamp stands aside, as the pole does.
    n06: {
      recipe: 'nightwater_lamp',
      values: { skyTop: '#040818', skyHorizon: '#16244a', ground: '#060d24', glintColor: '#a8c0ec', 'lamp.light': '#a8c0ec' },
      aside: { thing: 'lamp', share: 0.62, color: '#111a2e' },
      fill: '#070e1f',
      figure: 'face',
      revealAt: null,
    },
    n07: { recipe: 'room_chair', values: { wall: '#25324a', floor: '#131b2e', lampColor: '#a4bde6', dark: '#070c18', ambient: 0.4 }, aside: null, fill: '#0a1121', figure: 'face', revealAt: null },
    // Acts III and IV: the places the records already have, in the same cold. 08 the corridor of the others, 10 and 13 the room
    // with his table, 11 and 14 the dark water of the surface, 12 and 15 the sea with the pole of 01: the link comes back to where it began.
    n08: { recipe: 'corridor_door', values: { wall: '#27344c', wallLow: '#1a2539', floor: '#11192a', ceiling: '#212c42', doorColor: '#0a0f20', doorLight: '#8eaee0', lampColor: '#9eb4de', dark: '#060a16', ambient: 0.4 }, aside: null, fill: '#08101d', figure: 'face', revealAt: null },
    n09: { recipe: 'room_chair', values: { wall: '#25324a', floor: '#131b2e', lampColor: '#a4bde6', dark: '#070c18', ambient: 0.4 }, aside: null, fill: '#0a1121', figure: 'face', revealAt: null },
    n10: { recipe: 'room_table', values: { wall: '#25324a', floor: '#131b2e', lampColor: '#a4bde6', dark: '#070c18', ambient: 0.4 }, aside: null, fill: '#0a1121', figure: 'face', revealAt: null },
    n11: { recipe: 'nightwater_lamp', values: { skyTop: '#040818', skyHorizon: '#16244a', ground: '#060d24', glintColor: '#a8c0ec', 'lamp.light': '#a8c0ec' }, aside: { thing: 'lamp', share: 0.62, color: '#111a2e' }, fill: '#070e1f', figure: 'face', revealAt: null },
    n12: { recipe: 'sea_pole', values: { skyTop: '#050a18', skyHorizon: '#1a2a4a', ground: '#08122a', lightAmount: 0.3, glint: 0, glow: 0 }, aside: { thing: 'pole', share: 0.62, color: '#111a2e' }, fill: '#08101f', figure: 'face', revealAt: null },
    n13: { recipe: 'room_table', values: { wall: '#25324a', floor: '#131b2e', lampColor: '#a4bde6', dark: '#070c18', ambient: 0.4 }, aside: null, fill: '#0a1121', figure: 'face', revealAt: null },
    n14: { recipe: 'nightwater_lamp', values: { skyTop: '#040818', skyHorizon: '#16244a', ground: '#060d24', glintColor: '#a8c0ec', 'lamp.light': '#a8c0ec' }, aside: { thing: 'lamp', share: 0.62, color: '#111a2e' }, fill: '#070e1f', figure: 'face', revealAt: null },
    n15: { recipe: 'sea_pole', values: { skyTop: '#050a18', skyHorizon: '#1a2a4a', ground: '#08122a', lightAmount: 0.3, glint: 0, glow: 0 }, aside: { thing: 'pole', share: 0.62, color: '#111a2e' }, fill: '#08101f', figure: 'face', revealAt: null },
  } as Record<string, NovelScene>,
  /** The voice of the other side, a figure to the waist standing in the middle of the frame. */
  figure: {
    /** How tall the figure is, as a share of the frame's height; it stands on the frame's bottom edge. */
    height: 0.8,
    /** The most of the frame's width it takes: on a tall screen it is the width that decides. */
    maxWidth: 0.86,
    /** Where its middle stands across the frame, 0..1. */
    x: 0.5,
    /** The colour of the light at its edge and of her glow: cold, pale blue. */
    halo: '#a6c4f4',
    /** How far the light spreads out past the edge, as a share of the figure's height. */
    haloWidth: 0.035,
    /** How strong that light is, 0..1, at its strongest: strong enough that she does not get lost in the dark of the place. */
    haloAmount: 0.6,
    /** How deep the light comes in over the edge itself, as a share of the figure's height. */
    rimWidth: 0.012,
    /** How strong it is there, 0..1. */
    rimAmount: 0.5,
    /**
     * The colour of her picture, graded towards the cold television of the owner's reference.
     * In this order: the colour is taken out down to `saturation`; the contrast is raised about
     * the middle grey; then the picture goes `tone` of the way towards a scale of its own
     * lightness, from the dark of the place (`fill` of the scene) lifted `lift` of the way towards
     * `highlight`, to `highlight`; in the middle tones `warmth` of what it was before the scale is
     * kept, so the face reads and is not a grey mask; and last all of it is made `exposure` times
     * as bright, so she stands out of the place and is not lost in it.
     */
    grade: {
      saturation: 0.4,
      contrast: 1.22,
      tone: 0.62,
      highlight: '#b6cdf4',
      lift: 0.07,
      warmth: 0.25,
      exposure: 1.3,
    },
    /** How bright she is while the operator speaks, as a share of how bright she is while she does: quieter, still seen. */
    operatorBright: 0.82,
    /** How much of the light at her edge and of her glow there is while she speaks, and while the operator does. */
    voice: 1,
    operator: 0.6,
    /** Milliseconds the brightness and the light take to come most of the way to their new strength. */
    fadeMs: 500,
    /**
     * The marks of the signal on her, over those the whole transmission has. `halation`: the light
     * parts of her picture glow softly in `halo`, past themselves by `halationWidth` of her height;
     * only what is lighter than `halationFrom` glows.
     */
    halation: 0.75,
    halationWidth: 0.028,
    halationFrom: 0.45,
    /** How dark every other line of the picture is over her, 0..1. */
    scanlines: 0.06,
    /** Grain over her, 0..1: new 24 times a second, and still with motion kept low. */
    grain: 0.05,
    /** Where a band of interference crosses her, her lines slip sideways by this share of the frame's width at its strongest. */
    slipShift: 0.008,
    /** The figure breathes: it grows by this share and back, once in this many milliseconds. None with motion kept low. */
    breath: 0.004,
    breathMs: 5600,
    /** Rows of the picture her picture and its edge are worked out in: the picture of a transmission has 240. */
    maskLines: 320,
    /** How strong the light out past her edge, and over the edge itself, is while she is a silhouette. */
    silhouetteHalo: 0.55,
    silhouetteRim: 0.7,
    /**
     * Her face coming through a silhouette (record 04): it takes `ms` milliseconds, at once with
     * motion kept low. On the way it breaks up into streaks along her lines by `noise`, the bands of
     * interference come one after another, `bandLight` times as light and `bandNoise` times as torn.
     */
    reveal: {
      ms: 1800,
      noise: 0.6,
      bandLight: 2.5,
      bandNoise: 2,
    },
  },
  /**
   * Bands of interference over the whole frame (the owner, 4 November 2026: «полосы помех -
   * нужны»): one at a time, once in `every` milliseconds (both ends, by chance), a band `height`
   * of the frame high (both ends). `rollShare` of them run down the frame from the top in
   * `rollMs`; the others light up where they are and fade in `flareMs`. A band is lighter by
   * `light` in `color`, broken into streaks along its lines by `noise`, and the figure's lines
   * slip where it crosses her; it grows and fades, never by a jump. None with motion kept low.
   */
  bands: {
    every: [3500, 8000],
    height: [0.03, 0.08],
    rollShare: 0.6,
    rollMs: 1800,
    flareMs: 600,
    light: 0.07,
    noise: 0.1,
    color: '#bcd2f5',
  },
} as const;

/** The place of a record and what is laid over it, and how she is seen in it. */
export interface NovelScene {
  recipe: string;
  values: Partial<ParamValues>;
  /** The thing of the place that stands aside, to the right, a `share` of half the frame's width from the middle, in `color`; null where it may stand where it stands. */
  aside: { thing: string; share: number; color: string } | null;
  fill: string;
  /** How she is seen as the record opens: a silhouette with a light edge, or her face. */
  figure: 'silhouette' | 'face';
  /** The line (counted from 0) on which a silhouette's face comes through; null where it does not. */
  revealAt: number | null;
}

/**
 * How far her face is there, 0..1 (0 a silhouette): from the record's look, the line being said,
 * and how long ago the line her face comes through on began (null before it has). Smooth on the
 * way; whole at once with motion kept low.
 */
export function faceAt(scene: NovelScene, line: number, sinceMs: number | null, still: boolean, look = NOVEL_LOOK.figure.reveal): number {
  if (scene.figure === 'face') return 1;
  if (scene.revealAt === null || line < scene.revealAt || sinceMs === null) return 0;
  if (still) return 1;
  const t = Math.min(1, Math.max(0, sinceMs / Math.max(1, look.ms)));
  return t * t * (3 - 2 * t);
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
  const { aside } = look;
  if (aside && recipe.things.includes(aside.thing)) {
    const def = frameDef(recipe);
    const distance = Number(def.params.camDistance.value);
    const halfAcross = Math.tan((Number(def.params.camFov.value) * DEG) / 2) * aspect;
    values[thingParam(aside.thing, 'x')] = aside.share * halfAcross * distance;
    values[thingParam(aside.thing, 'color')] = aside.color;
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
