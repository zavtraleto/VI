import type { ParamSpec, ParamValues } from '../signal/scene';
import type { BootTiming } from './bootScript';
import type { MarkArrangement } from './layout';

const number = (value: number, min: number, max: number, step: number): ParamSpec => ({ kind: 'number', value, min, max, step });
const color = (value: string): ParamSpec => ({ kind: 'color', value });
const flag = (value: boolean): ParamSpec => ({ kind: 'boolean', value });
const choice = (value: string, options: readonly string[]): ParamSpec => ({ kind: 'choice', value, options: [...options] });

/** The one font of the program's voice: a 16-dot gothic, drawn at its own size and never smoothed. */
export const PROGRAM_FONT = '"DotGothic16", monospace';

/**
 * The grid of the interface, in dots of the picture. Every size and every space is a whole
 * number of `UNIT`s, and the heights of blocks and the spaces between them of two: `EDGE` from
 * the edge of the picture and inside a plate or a record, `GAP` between blocks and between two
 * things that are pressed, `GROUP` between groups of lines. A button is a line and a half of
 * text tall, the same on a phone and on a desk; where a finger needs more, its zone grows by a
 * field that is not drawn (`zoneOf`). The bar of a name is a line of text with two dots above
 * and below it; the red mark of the seventh is a square of `MARK`.
 */
export const UNIT = 4;
export const EDGE = 8;
export const GAP = 8;
export const GROUP = 16;
export const BUTTON_H = 24;
export const BAR_H = 20;
export const MARK = 4;

/** Letters of the voice, in CSS pixels: prose is one size wherever it stands - a line of a panel, the README, the note under the list of the levels, the note over the board. */
export const PANEL_SAY_SIZE = 16;
export const README_SAY_SIZE = PANEL_SAY_SIZE;
export const NOTE_SIZE = PANEL_SAY_SIZE;

/**
 * Every parameter of the look of the interface, by the folder it stands in on the lab's panel.
 * The interface is one layer: nothing that draws it has colours, sizes or timings of its own.
 */
export const SHELL_GROUPS = {
  screen: {
    /** Pixels of the picture across a tall window, and down a wide one. The picture is a tube of few lines. */
    pixelsTall: number(280, 200, 480, 4),
    pixelsWide: number(360, 240, 540, 4),
    /** The pixels are stretched to the screen softly, not in hard squares. */
    smooth: flag(true),
    blur: number(0.2, 0, 3, 0.05),
    smear: number(0.2, 0, 6, 0.05),
    chroma: number(0.4, 0, 4, 0.05),
    glow: number(0.4, 0, 1, 0.01),
    noise: number(0.08, 0, 1, 0.01),
    scanlines: number(0.3, 0, 1, 0.01),
    vignette: number(0.35, 0, 1, 0.01),
  },
  colors: {
    /** The dark of the tube and the one tone that glows on it, at night and at noon; the hours between are mixed. */
    bgNight: color('#04050d'),
    bgDay: color('#151c34'),
    toneNight: color('#8e9bff'),
    toneDay: color('#cfe8ff'),
    /** The hour the colours are taken for; below zero it is the clock of the player. */
    hour: number(-1, -1, 24, 0.5),
    /** The one who is separate: the seventh. Nothing else is red but its marks: beside the chosen command, and in the corner of the cursor over what a press runs. */
    signal: color('#ff3a2e'),
    /** The star of a level that is passed, the same at every hour: its white heart, the pale light of its facets, the deep blue of those turned away. */
    starCore: color('#fbfff2'),
    starLight: color('#9fd8ff'),
    starDeep: color('#3d49f0'),
    /** The six channels, by the faces of the die: bars of a television test card. */
    ch1: color('#ece9e2'),
    ch2: color('#fce872'),
    ch3: color('#2ae4fe'),
    ch4: color('#8ff3a9'),
    ch5: color('#ee91e2'),
    ch6: color('#6090fa'),
    /**
     * Prose, in the program's letters (the owner, 29 October 2026: «можно так же молочно белым»):
     * milky; its key words in the colour of what they name - a face in its channel's colour, any
     * other key word in `sayKey`; a dark ring around the letters over a picture, and a dark band
     * under the words of a window.
     */
    sayInk: color('#e4e0d6'),
    sayKey: color('#f2c879'),
    sayEdge: color('#08080a'),
    sayPlate: number(0.55, 0, 1, 0.01),
    /** How much of the tone the secondary text and the thin lines keep. */
    dim: number(0.67, 0.2, 1, 0.01),
    faint: number(0.3, 0.05, 1, 0.01),
  },
  space: {
    /** Where the six dice are looked at from, in degrees. */
    spaceYaw: number(32, 0, 90, 1),
    spacePitch: number(50, 15, 85, 1),
    /** Distance between the dice, in dice; how much of its part of the screen the net takes. */
    spaceGap: number(1.6, 1, 2.5, 0.05),
    spaceFill: number(1, 0.4, 1, 0.01),
    /** How far a die rises and falls, how long one such breath is, how far it turns from side to side. */
    spaceBob: number(0.08, 0, 0.4, 0.01),
    spaceBobSec: number(6, 1, 20, 0.5),
    spaceTurn: number(5, 0, 45, 1),
    /** How bright the glass of a die is, its edges, and the die the figure stands on. */
    spaceGlass: number(0.14, 0, 1, 0.01),
    spaceEdge: number(0.6, 0, 2, 0.05),
    spaceLit: number(2.2, 1, 4, 0.1),
    /** The rings under the dice; 0 leaves them out. */
    spaceRings: number(0.2, 0, 1, 0.01),
    /** Bits per colour channel of the picture of the dice, and the dither that hides the steps. */
    spaceDepth: number(5, 3, 8, 1),
    spaceDither: number(1, 0, 1, 0.05),
    /** How long the figure takes from one die to the next, in milliseconds. */
    hopMs: number(180, 0, 600, 10),
  },
  logo: {
    logoNodes: number(6, 1, 12, 1),
    logoArrange: choice('grid', ['grid', 'ring', 'row'] satisfies MarkArrangement[]),
    /** Dots between two letters of the logo. */
    logoTrack: number(3, 0, 8, 1),
    /** How many times its own size the logo of the boot is. */
    bootLogoScale: number(3, 1, 6, 1),
  },
  aim: {
    /**
     * The faces a level asks for, in the corner where the seal lay: at the start of a level they
     * rise into sight as if from deep under the board seen from above. They wait this long after
     * the board takes its first move, rise for this long, one this long after the one before;
     * first seen, a face is this share of its size; they stand this many dots apart. A face that
     * is done flares up for this long, towards the tone of the tube by this share, and goes back
     * down for this long; then the faces after it slide over into its place for this long.
     */
    aimDelayMs: number(250, 0, 2000, 10),
    aimRiseMs: number(700, 100, 3000, 10),
    aimStaggerMs: number(140, 0, 1000, 10),
    aimFrom: number(0.15, 0, 1, 0.01),
    aimGap: number(3, 0, 12, 1),
    aimFlashMs: number(160, 0, 1000, 10),
    aimFlash: number(0.6, 0, 1, 0.01),
    aimSinkMs: number(600, 100, 3000, 10),
    aimSlideMs: number(260, 0, 2000, 10),
  },
  lock: {
    /**
     * The frame over where a tap or a click takes the player (docs/superpowers/specs/2026-10-29-vi-tap-control-design.md):
     * a box square to the screen around the die or the floor of the cell, as a lock-on of REZ or a
     * mark of NieR:Automata. It stands this many dots clear of what it frames; at each corner an arm
     * this share of the side (half or more is the whole box); a stud on every corner where asked.
     * It comes in this many dots wider and draws in to its place for this long. Its colour is that
     * of what it frames, lightened towards white by this share: the lines of the board over a
     * cell, the top face of a die over a die (the owner, 29 October 2026).
     */
    lockGap: number(3, 0, 16, 1),
    lockArm: number(0.3, 0.05, 0.5, 0.01),
    lockStuds: flag(true),
    lockFrom: number(8, 0, 40, 1),
    lockSnapMs: number(140, 0, 600, 10),
    lockLight: number(0.45, 0, 1, 0.05),
  },
  motion: {
    /** How long a pressed zone answers before its action, in milliseconds. */
    pressMs: number(140, 0, 500, 10),
    /** How many times a second the levels of the channels move. */
    idleHz: number(4, 0, 15, 1),
  },
  boot: {
    bootMs: number(6000, 2500, 10000, 100),
    bootShortMs: number(1200, 300, 3000, 50),
    bootDarkMs: number(400, 0, 1500, 50),
    bootLinkMs: number(1100, 0, 3000, 50),
    bootLogoMs: number(1500, 300, 3000, 50),
  },
} satisfies Record<string, Record<string, ParamSpec>>;

export const SHELL_PARAMS: Record<string, ParamSpec> = Object.assign({}, ...Object.values(SHELL_GROUPS));

export function shellDefaults(): ParamValues {
  const values: ParamValues = {};
  for (const [name, spec] of Object.entries(SHELL_PARAMS)) values[name] = spec.value;
  return values;
}

/** Only the values that differ from the defaults: what is worth writing down. */
export function shellChanged(values: ParamValues): ParamValues {
  const changed: ParamValues = {};
  for (const [name, spec] of Object.entries(SHELL_PARAMS)) {
    const value = values[name];
    if (value === undefined) continue;
    // Colours come back from a colour picker in either case.
    const same = typeof value === 'string' ? value.toLowerCase() === String(spec.value).toLowerCase() : value === spec.value;
    if (!same) changed[name] = value;
  }
  return changed;
}

/** A value as the kind of its parameter, from text: an address or a pasted record. */
export function parseShellValue(name: string, text: string): number | string | boolean | undefined {
  const spec = SHELL_PARAMS[name];
  if (!spec) return undefined;
  if (spec.kind === 'number') {
    const value = Number(text);
    return Number.isFinite(value) ? value : undefined;
  }
  if (spec.kind === 'boolean') return text === 'true' || text === '1';
  if (spec.kind === 'choice') return spec.options.includes(text) ? text : undefined;
  return text;
}

const num = (values: ParamValues, name: string): number => Number(values[name] ?? 0);

export function bootTiming(values: ParamValues): BootTiming {
  return {
    totalMs: num(values, 'bootMs'),
    shortMs: num(values, 'bootShortMs'),
    darkMs: num(values, 'bootDarkMs'),
    linkMs: num(values, 'bootLinkMs'),
    logoMs: num(values, 'bootLogoMs'),
    // The tube has no half-lit state: the logo is there or it is not.
    fadeMs: 0,
  };
}

/** The colours of prose: its letters, its key words, the ring around them and the band under them. */
export interface SayColors {
  ink: string;
  /** Secondary prose. */
  dim: string;
  /** A key word that names no face. */
  key: string;
  /** A key word that names a face: index 0 is the face 1. */
  faces: string[];
  edge: string;
  /** The band under the words of a window, with its own see-through. */
  plate: string;
}

/** The colours of prose from the values of the look; the defaults where none are given. */
export function sayColors(values: ParamValues = shellDefaults()): SayColors {
  const ink = String(values.sayInk);
  const edge = String(values.sayEdge);
  const [r, g, b] = parseHex(edge);
  return {
    ink,
    dim: mixHex(edge, ink, 0.66),
    key: String(values.sayKey),
    // The one is told by its red pip, the seventh's colour; the other faces by their channels.
    faces: [String(values.signal), ...[2, 3, 4, 5, 6].map((face) => String(values[`ch${face}`]))],
    edge,
    plate: `rgba(${r}, ${g}, ${b}, ${num(values, 'sayPlate')})`,
  };
}

/** The colours the interface is drawn with at one moment of the day. All of them are solid. */
export interface Palette {
  /** The dark of the tube. */
  bg: string;
  /** The tone that glows: text and whatever is in focus. */
  ink: string;
  /** Secondary text. */
  dim: string;
  /** Thin lines and what stays in the background. */
  faint: string;
  /** The seventh. */
  signal: string;
  /** The six channels, index 0 is the face 1. */
  channels: string[];
  /** The star of a level that is passed: its heart, its light, its deep. */
  star: { core: string; light: string; deep: string };
}

function parseHex(hex: string): [number, number, number] {
  const text = hex.replace('#', '');
  const full = text.length === 3 ? [...text].map((digit) => digit + digit).join('') : text.padEnd(6, '0');
  const value = Number.parseInt(full.slice(0, 6), 16) || 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** A colour between two others; `amount` 0 is the first, 1 the second. */
export function mixHex(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const t = Math.min(1, Math.max(0, amount));
  const channel = (i: number): string => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** The hour of the player's clock, with its minutes as a fraction. */
export function clockHour(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

/** How much of the day there is at an hour: 0 in the dead of night, 1 an hour after noon. */
export function dayAmount(hour: number): number {
  return 0.5 + 0.5 * Math.cos(((hour - 13) / 24) * Math.PI * 2);
}

/** The colours for an hour of the day. The parameter `hour`, when it is set, takes the place of the clock. */
export function paletteAt(values: ParamValues, clockHour: number): Palette {
  const set = num(values, 'hour');
  const day = dayAmount(set >= 0 ? set : clockHour);
  const bg = mixHex(String(values.bgNight), String(values.bgDay), day);
  const ink = mixHex(String(values.toneNight), String(values.toneDay), day);
  return {
    bg,
    ink,
    dim: mixHex(bg, ink, num(values, 'dim')),
    faint: mixHex(bg, ink, num(values, 'faint')),
    signal: String(values.signal),
    channels: [1, 2, 3, 4, 5, 6].map((face) => String(values[`ch${face}`])),
    star: { core: String(values.starCore), light: String(values.starLight), deep: String(values.starDeep) },
  };
}
