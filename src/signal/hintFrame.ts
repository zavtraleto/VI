import { DEG } from './kit';
import { figureOf, type SignalCard } from './card';
import { frameDef, thingParam, type Recipe } from './compose';
import type { Frame } from './director';
import type { ParamValues } from './scene';

/**
 * The picture a hint of a board is shown in: the sea at sundown with the pole and the red sun,
 * and nothing else (the owner, 15 October 2026: «из сцен используй только море со столбом с
 * разными настройками света, цвета, воды и положением солнца и столба»). What changes from one
 * showing to the next is the light, the colours, the water and where the sun and the pole stand.
 */

/** The sea with the pole first, so the camera is set for the pole, and the sun in its sky. */
export const HINT_RECIPE: Recipe = { id: 'sea_pole_sun', place: 'sea', things: ['pole', 'sun'] };

/**
 * How far everything may go. The colours come as whole sets, so the sky, the horizon and the
 * water never disagree. These are a proposal after the owner's reference, for the owner to correct.
 */
export const HINT_SCENE = {
  palettes: [
    { skyTop: '#2a0606', skyHorizon: '#b8321c', ground: '#1a0c0c' },
    { skyTop: '#3b0b0b', skyHorizon: '#d0482a', ground: '#2a1210' },
    { skyTop: '#1e0a14', skyHorizon: '#9e2a22', ground: '#140c12' },
    { skyTop: '#43140c', skyHorizon: '#c86a3a', ground: '#2a1210' },
  ],
  lightAmount: [0.2, 0.45],
  glow: [0.15, 0.4],
  /** Times the sea's own waves. */
  wave: [0.6, 1.4],
  /** The light on the water is a path under the sun, not a field: narrow, of small dashes. */
  glint: [0.3, 0.6],
  glintColors: ['#ffb08a', '#ffd2b0'],
  glintWidth: [10, 20],
  glintSize: [0.12, 0.22],
  /** Degrees the camera looks up: the horizon stays above the band of the words. */
  camPitch: [1, 4],
  sunSize: [2.8, 5.5],
  sunColors: ['#d8261a', '#c0301c'],
  poleHeight: [6, 10],
  poleTilt: [0, 3],
  poleSag: [1, 3],
  poleColors: ['#2a2424', '#3a3232'],
  /** How heavy the picture is: from a light daydream to sadness. */
  contact: [0, 0.25],
} as const;

/** Where the pole and the sun stand across the frame, as shares of half its width from the middle, and how high the sun is. */
export interface HintComposition {
  /** Minus is the left. */
  pole: number;
  sun: number;
  /** Degrees above the horizon. */
  elevation: number;
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
const within = (range: readonly [number, number], random: () => number): number => lerp(range[0], range[1], random());
const pick = <T>(items: readonly T[], random: () => number): T => items[Math.min(items.length - 1, Math.floor(random() * items.length))];

/**
 * The frame cut in thirds: the pole on one side, the sun on the other, which side by chance. A
 * tall screen has little width to give: the pole comes nearer the middle, and the sun stands higher.
 */
export function hintComposition(random: () => number, aspect: number): HintComposition {
  const tall = aspect < 1;
  const side = random() < 0.5 ? -1 : 1;
  const pole = side * lerp(tall ? 0.15 : 0.25, tall ? 0.3 : 0.45, random());
  const sun = -side * lerp(0.2, 0.45, random());
  const elevation = tall ? lerp(4, 18, random()) : lerp(2, 14, random());
  return { pole, sun, elevation };
}

/** The sea's own values, before any of this is laid over them. */
function seaValue(name: string): number {
  return Number(frameDef(HINT_RECIPE).params[name].value);
}

/**
 * A hint as a transmission: its picture, made for a window of this shape (`aspect`, width over
 * height), and its words. It stays until it is closed.
 */
export function hintCard(random: () => number, aspect: number, text: string): SignalCard {
  const comp = hintComposition(random, aspect);
  const palette = pick(HINT_SCENE.palettes, random);
  const poleHeight = within(HINT_SCENE.poleHeight, random);
  // The camera stands as far from the pole as the pole is tall: the sea frames a pole of its own height.
  const distance = seaValue('camDistance') * Math.min(1.6, Math.max(0.22, poleHeight / 8));
  const halfAcross = Math.atan(Math.tan((seaValue('camFov') * DEG) / 2) * aspect);
  const wave = within(HINT_SCENE.wave, random);
  const values: Partial<ParamValues> = {
    skyTop: palette.skyTop,
    skyHorizon: palette.skyHorizon,
    ground: palette.ground,
    lightAmount: within(HINT_SCENE.lightAmount, random),
    glow: within(HINT_SCENE.glow, random),
    waveHeight: seaValue('waveHeight') * wave,
    waveSpeed: seaValue('waveSpeed') * wave,
    glint: within(HINT_SCENE.glint, random),
    glintColor: pick(HINT_SCENE.glintColors, random),
    // A narrow frame shows less of the sea across: its path of light is narrower by as much.
    glintWidth: Math.max(2, Math.round(within(HINT_SCENE.glintWidth, random) * Math.min(1, aspect))),
    glintSize: within(HINT_SCENE.glintSize, random),
    camPitch: within(HINT_SCENE.camPitch, random),
    // The sun stands where the light comes from: 180 is straight ahead, less is to the right.
    lightAngle: 180 - Math.atan(comp.sun * Math.tan(halfAcross)) / DEG,
    [thingParam('sun', 'elevation')]: comp.elevation,
    [thingParam('sun', 'size')]: within(HINT_SCENE.sunSize, random),
    [thingParam('sun', 'color')]: pick(HINT_SCENE.sunColors, random),
    [thingParam('pole', 'height')]: poleHeight,
    [thingParam('pole', 'tilt')]: within(HINT_SCENE.poleTilt, random),
    [thingParam('pole', 'wireSag')]: within(HINT_SCENE.poleSag, random),
    [thingParam('pole', 'color')]: pick(HINT_SCENE.poleColors, random),
    [thingParam('pole', 'x')]: comp.pole * Math.tan(halfAcross) * distance,
  };
  const frame: Frame = { recipe: HINT_RECIPE, variant: 'a', values, mixing: 1 };
  const contact = within(HINT_SCENE.contact, random);
  const seed = 1 + Math.floor(random() * 9999);
  return { frame, contact, seed, figure: figureOf(frame), caption: text, seconds: Infinity };
}
