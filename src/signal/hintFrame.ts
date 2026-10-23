import { DEG } from './kit';
import { figureOf, type SignalCard } from './card';
import { frameDef, thingParam, type Recipe } from './compose';
import type { Frame } from './director';
import type { ParamValues } from './scene';

/**
 * The picture a hint of a board is shown in: the sea with the pole by day, and nothing else.
 * The owner, 15 October 2026: «из сцен используй только море со столбом с разными настройками
 * света, цвета, воды и положением солнца и столба». The owner, 23 October 2026: the scenes
 * pressed and frightened; they are to be calm and light, «без бликов на воде, просто вода,
 * небо и столб». So the sun is gone, the water has no light on it, and the picture is as light
 * as the sea itself (no contact). What changes from one showing to the next is the colour of
 * the day, the water and where the pole stands.
 */

/** The sea with the pole, and nothing in its sky. */
export const HINT_RECIPE: Recipe = { id: 'sea_pole_calm', place: 'sea', things: ['pole'] };

/**
 * How far everything may go. The colours come as whole sets, so the sky, the horizon and the
 * water never disagree: all of them pale, a day near the sea's own.
 */
export const HINT_SCENE = {
  palettes: [
    { skyTop: '#bcd6e6', skyHorizon: '#f2f0ea', ground: '#cfd8dc' },
    { skyTop: '#c6dcea', skyHorizon: '#f4f1e8', ground: '#d4dde0' },
    { skyTop: '#b4d0e2', skyHorizon: '#eef1f0', ground: '#c8d6dc' },
    { skyTop: '#cfdde6', skyHorizon: '#f6f2ea', ground: '#d8dee0' },
  ],
  lightAmount: [0.45, 0.6],
  /** Times the sea's own waves: never livelier than the sea. */
  wave: [0.5, 0.9],
  /** Degrees the camera looks up: the horizon stays above the band of the words. */
  camPitch: [1, 4],
  poleHeight: [6, 10],
  poleTilt: [0, 2],
  poleSag: [1, 2],
  poleColors: ['#6f777c', '#7d858a'],
} as const;

/** Where the pole stands across the frame, as a share of half its width from the middle. */
export interface HintComposition {
  /** Minus is the left. */
  pole: number;
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
const within = (range: readonly [number, number], random: () => number): number => lerp(range[0], range[1], random());
const pick = <T>(items: readonly T[], random: () => number): T => items[Math.min(items.length - 1, Math.floor(random() * items.length))];

/** The pole on a third of the frame, which side by chance. A tall screen has little width to give: the pole comes nearer the middle. */
export function hintComposition(random: () => number, aspect: number): HintComposition {
  const tall = aspect < 1;
  const side = random() < 0.5 ? -1 : 1;
  return { pole: side * lerp(tall ? 0.15 : 0.25, tall ? 0.3 : 0.45, random()) };
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
    glow: 0,
    waveHeight: seaValue('waveHeight') * wave,
    waveSpeed: seaValue('waveSpeed') * wave,
    glint: 0,
    camPitch: within(HINT_SCENE.camPitch, random),
    [thingParam('pole', 'height')]: poleHeight,
    [thingParam('pole', 'tilt')]: within(HINT_SCENE.poleTilt, random),
    [thingParam('pole', 'wireSag')]: within(HINT_SCENE.poleSag, random),
    [thingParam('pole', 'color')]: pick(HINT_SCENE.poleColors, random),
    [thingParam('pole', 'x')]: comp.pole * Math.tan(halfAcross) * distance,
  };
  const frame: Frame = { recipe: HINT_RECIPE, variant: 'a', values, mixing: 1 };
  const seed = 1 + Math.floor(random() * 9999);
  return { frame, contact: 0, seed, figure: figureOf(frame), caption: text, seconds: Infinity };
}
