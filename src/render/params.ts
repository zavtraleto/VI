import type { ParamSpec, ParamValues } from '../signal/scene';
import { clockHour, paletteAt, type Palette } from '../shell/theme';

const number = (value: number, min: number, max: number, step: number): ParamSpec => ({ kind: 'number', value, min, max, step });
const color = (value: string): ParamSpec => ({ kind: 'color', value });
const choice = (value: string, options: string[]): ParamSpec => ({ kind: 'choice', value, options });

/**
 * Every parameter of the look of the board that is the board's own, by the folder it stands
 * in on the lab's panel. The colours are not here: the six channels, the red of the seventh,
 * the dark and the tone that glows on it are the program's, and come from the shell.
 */
export const BOARD_GROUPS = {
  die: {
    /** How round the edges of a die are, in dice. */
    dieRound: number(0.07, 0, 0.2, 0.005),
    /** Radius of a pip as a share of the face; the single pip of the one is this many times larger. */
    pipSize: number(0.098, 0.05, 0.16, 0.002),
    pipOne: number(1.5, 1, 2.4, 0.05),
    /**
     * Matter is duller than light: how far the faces 2 to 6 are darkened from the colour of
     * their channel, and how much further the 6 is than the 2. The one stays white.
     */
    faceMute: number(0.3, 0, 0.8, 0.01),
    faceFall: number(0.25, 0, 0.6, 0.01),
    /** The first face whose pips are light; the faces before it have dark ones. 2 is all of them, 7 none. */
    pipLightFrom: number(2, 2, 7, 1),
    pipDark: color('#12141c'),
    pipLight: color('#f2eee2'),
    /** How dark the edges of a die are, and how much a face darkens towards them. */
    faceEdge: number(0.35, 0, 1, 0.01),
    faceShade: number(0.12, 0, 0.6, 0.01),
    /** How far the die the figure stands on is pressed into the surface, in dice. */
    pressDepth: number(0.07, 0, 0.2, 0.005),
  },
  glass: {
    /**
     * A die that is coming up or going down is frosted glass: not all here, and milky with
     * the colour of the channel on top. How much of it there is, and how milky it is.
     */
    glassBody: number(0.86, 0.1, 1, 0.01),
    glassFrost: number(0.3, 0, 1, 0.01),
    /** The height from which such a die is whole again, as a share of its own. */
    glassSolid: number(0.8, 0.3, 1, 0.01),
    /** How bright the lit edges of such a die are. */
    glassEdge: number(0.9, 0, 2, 0.05),
    /**
     * How much of all that a low die keeps: one that can be rolled over or stepped onto. The
     * step between the two is what says a die can be climbed.
     */
    glassLow: number(0.42, 0, 1, 0.01),
  },
  light: {
    lightKey: number(2.6, 0, 5, 0.05),
    lightAmbient: number(0.95, 0, 2, 0.05),
  },
  surface: {
    /** Width of the lines between the cells and of the line around them, in cells. */
    gridLine: number(0.03, 0.005, 0.1, 0.005),
    gridEdge: number(0.05, 0.005, 0.15, 0.005),
    /** How much of the tone the lines take, and the floor of the cells under them. */
    gridBright: number(0.5, 0, 1, 0.01),
    gridFill: number(0, 0, 0.5, 0.01),
  },
  figure: {
    /** The one the program has no record of: a grey mannequin. */
    mannequin: color('#8b90a0'),
    /** How far the mannequin has grown into the red of the seventh: 0 is grey, 1 is red. */
    figureRed: number(0, 0, 1, 0.01),
    /** How much of the figure shows through a die that stands in front of it. */
    figureGhost: number(0.4, 0, 1, 0.01),
  },
  signs: {
    /** Frames on the cells next to an open chain. */
    dockBright: number(0.75, 0, 1, 0.01),
    /**
     * Light that stands on the pips of a die going down: how high, in dice, how bright, and how
     * wide against the pip it stands on. Faint and thin: with many dice going down at once the
     * board behind them has to stay readable.
     */
    pillarHeight: number(0.7, 0, 4, 0.05),
    pillarBright: number(0.2, 0, 2, 0.01),
    pillarWidth: number(0.6, 0.1, 1.5, 0.05),
    /** The mark of a cell a die is about to come up on. */
    warnBright: number(0.9, 0, 1, 0.01),
  },
  screen: {
    /** The tube the board is shown on: its lines and its dark corners. The picture itself stays sharp. */
    scanlines: number(0.12, 0, 1, 0.01),
    vignette: number(0.3, 0, 1, 0.01),
  },
  view: {
    /**
     * The whole board in view, or the player followed: the middle of the screen enlarged, the
     * edges of the board pressed together by a lens. `auto` follows where a cell of the whole
     * board would be small, unless the player keeps the whole board or keeps motion low.
     */
    view: choice('auto', ['auto', 'full', 'follow']),
    /**
     * Followed: the least share of the board that fits across the screen at the scale the
     * player is seen at. The player is at most `1 / focus` times as large as with the whole
     * board in view, and the lens presses the rest of the board together by as much.
     */
    focus: number(0.6, 0.3, 1, 0.01),
    /**
     * The least strength of the lens towards any side. The side of the screen the board is
     * fitted to is pressed together by `1 / focus - 1` whatever this is; the other side, where
     * the board has room, is bent by this much and no more. 0 keeps that side flat and the
     * board at its largest.
     */
    lens: number(0, 0, 2, 0.05),
    /** How long the lens takes to come up with the player, in milliseconds. */
    followMs: number(250, 0, 1000, 10),
    /**
     * How near the player comes to an edge of the screen at the very edge of the board, as a
     * share of the screen: that much of it is left to the dark beside them. 0 keeps the board
     * from edge to edge of the screen always; 0.5 keeps the player in the middle of it.
     */
    edge: number(0.1, 0, 0.5, 0.01),
    /**
     * The size of a cell under the player, in CSS pixels. The player is followed when a cell of
     * the whole board would be smaller than this, and the board is enlarged only as far as
     * makes it this size: 64 is a centimetre on a phone, a size a finger and an eye are at
     * ease with.
     */
    minCell: number(64, 0, 120, 1),
    /**
     * How much of what the lens enlarges the board is drawn denser by while it is followed: 1
     * keeps its middle as sharp as with the whole board in view, 0 draws it no denser than the
     * canvas, which costs the graphics card nothing and is softer.
     */
    sharp: number(1, 0, 1, 0.05),
  },
} satisfies Record<string, Record<string, ParamSpec>>;

export const BOARD_PARAMS: Record<string, ParamSpec> = Object.assign({}, ...Object.values(BOARD_GROUPS));

export function boardDefaults(): ParamValues {
  const values: ParamValues = {};
  for (const [name, spec] of Object.entries(BOARD_PARAMS)) values[name] = spec.value;
  return values;
}

/** Only the values that differ from the defaults: what is worth writing down. */
export function boardChanged(values: ParamValues): ParamValues {
  const changed: ParamValues = {};
  for (const [name, spec] of Object.entries(BOARD_PARAMS)) {
    const value = values[name];
    if (value === undefined) continue;
    // Colours come back from a colour picker in either case.
    const same = typeof value === 'string' ? value.toLowerCase() === String(spec.value).toLowerCase() : value === spec.value;
    if (!same) changed[name] = value;
  }
  return changed;
}

/** A value as the kind of its parameter, from text: an address or a pasted record. */
export function parseBoardValue(name: string, text: string): number | string | boolean | undefined {
  const spec = BOARD_PARAMS[name];
  if (!spec) return undefined;
  if (spec.kind === 'number') {
    const value = Number(text);
    return Number.isFinite(value) ? value : undefined;
  }
  if (spec.kind === 'boolean') return text === 'true' || text === '1';
  if (spec.kind === 'choice') return spec.options.includes(text) ? text : undefined;
  return text;
}

/**
 * What an address says of the view, in any build, to try on a device what it is like:
 * `?view=follow&focus=0.6&lens=0&followMs=250&edge=0.1&minCell=64&sharp=1`. Only what is
 * named and makes sense is returned; the rest stays as it is defined.
 */
export function readView(search: string): ParamValues {
  const query = new URLSearchParams(search);
  const values: ParamValues = {};
  for (const [name, spec] of Object.entries(BOARD_GROUPS.view as Record<string, ParamSpec>)) {
    const text = query.get(name);
    if (text === null || text === '') continue;
    const value = parseBoardValue(name, text);
    if (value === undefined) continue;
    if (spec.kind === 'number' && (typeof value !== 'number' || value < spec.min || value > spec.max)) continue;
    values[name] = value;
  }
  return values;
}

/** What the board is drawn from: its own values and the values of the shell, which hold the colours. */
export interface BoardLook {
  board: ParamValues;
  shell: ParamValues;
}

/** The colours of the program at this hour of the player's clock. */
export function boardPalette(look: BoardLook): Palette {
  return paletteAt(look.shell, clockHour());
}
