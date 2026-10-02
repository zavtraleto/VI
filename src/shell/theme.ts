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
    /** The one who is separate: the seventh. Nothing else is red. */
    signal: color('#ff3a2e'),
    /** The six channels, by the faces of the die: bars of a television test card. */
    ch1: color('#eeeadc'),
    ch2: color('#dccb5a'),
    ch3: color('#5fc9d6'),
    ch4: color('#62bf6e'),
    ch5: color('#c867c0'),
    ch6: color('#4f63dc'),
    /** How much of the tone the secondary text and the thin lines keep. */
    dim: number(0.55, 0.2, 1, 0.01),
    faint: number(0.3, 0.05, 1, 0.01),
  },
  space: {
    /** Where the six dice are looked at from, in degrees. */
    spaceYaw: number(32, 0, 90, 1),
    spacePitch: number(50, 15, 85, 1),
    /** Distance between the dice, in dice; how much of its part of the screen the net takes. */
    spaceGap: number(1.6, 1, 2.5, 0.05),
    spaceFill: number(0.92, 0.4, 1, 0.01),
    /** How far a die rises and falls, how long one such breath is, how far it turns from side to side. */
    spaceBob: number(0.08, 0, 0.4, 0.01),
    spaceBobSec: number(6, 1, 20, 0.5),
    spaceTurn: number(5, 0, 45, 1),
    /** How bright the glass of a die is, its edges, and the die the figure stands on. */
    spaceGlass: number(0.22, 0, 1, 0.01),
    spaceEdge: number(0.9, 0, 2, 0.05),
    spaceLit: number(2.2, 1, 4, 0.1),
    /** The rings under the dice; 0 leaves them out. */
    spaceRings: number(0.3, 0, 1, 0.01),
    /** Bits per colour channel of the picture of the dice, and the dither that hides the steps. */
    spaceDepth: number(5, 3, 8, 1),
    spaceDither: number(1, 0, 1, 0.05),
    /** How long the figure takes from one die to the next, in milliseconds. */
    hopMs: number(180, 0, 600, 10),
  },
  logo: {
    logoNodes: number(6, 1, 12, 1),
    logoArrange: choice('grid', ['grid', 'ring', 'row'] satisfies MarkArrangement[]),
    /** How many times its own size the logo of the boot is. */
    bootLogoScale: number(3, 1, 6, 1),
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
  };
}
