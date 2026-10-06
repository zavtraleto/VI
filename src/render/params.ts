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
    /**
     * A face is a screen: it gives its own light, the colour of its channel as it is, and no
     * lamp changes it. How far all six are taken down from their channels together; no face
     * is taken further than another.
     */
    faceMute: number(0, 0, 0.8, 0.01),
    /** How much a face darkens from its middle towards its edges, as a screen does. */
    faceShade: number(0.14, 0, 0.6, 0.01),
    /**
     * The face on top is the one that counts, and is lit in full. What the faces on the sides
     * keep of that light; how far apart the two sides in view are, which gives the die its
     * shape; how much a side darkens towards the foot of the die.
     */
    faceSide: number(0.78, 0.2, 1, 0.01),
    sideTilt: number(0.24, 0, 0.6, 0.01),
    sideFall: number(0.47, 0, 0.9, 0.01),
    /** What a face that does not work on the level in hand keeps of its light. */
    faceOff: number(0.5, 0.1, 1, 0.01),
    /**
     * The pips are the places of a face that are not lit; the pip of the one is lit, and red.
     * Radius of a pip as a share of the face; the single pip of the one is this many times larger.
     */
    pipSize: number(0.098, 0.05, 0.16, 0.002),
    pipOne: number(1.5, 1, 2.4, 0.05),
    pipDark: color('#171616'),
    /** The screen is a little less lit around a pip: how far that reaches, in radii of the pip, and how dark it is. */
    pipDusk: number(0.5, 0, 2, 0.05),
    pipDuskDark: number(0.14, 0, 1, 0.01),
    /** How far the die the figure stands on is pressed into the surface, in dice. */
    pressDepth: number(0.08, 0, 0.2, 0.005),
  },
  edge: {
    /**
     * A line of light runs along the middle of every rounded edge, and the faces run up to it:
     * no dark stands between a face and its edge. Its width, as a share of the face; how bright
     * it is around the face on top, and what the other edges keep of that; how far it is from
     * the tone of the program towards white.
     */
    edgeWidth: number(0.042, 0, 0.1, 0.002),
    edgeBright: number(0.92, 0, 1, 0.01),
    edgeSide: number(0.15, 0, 1, 0.01),
    edgePale: number(0.44, 0, 1, 0.01),
    /** The light of the line spread over the face beside it: how far, as a share of the face, and how bright. */
    edgeSpread: number(0.03, 0.005, 0.15, 0.005),
    edgeGlow: number(0.42, 0, 1, 0.01),
  },
  glass: {
    /**
     * A die that is coming up or going down is frosted glass: not all here, and milky with
     * the colour of the channel on top. How much of it there is, and how milky it is.
     */
    glassBody: number(0.7, 0.1, 1, 0.01),
    glassFrost: number(0.3, 0, 1, 0.01),
    /** The height from which such a die is whole again, as a share of its own. */
    glassSolid: number(0.98, 0.3, 1, 0.01),
    /** How bright the lit edges of such a die are. */
    glassEdge: number(1.7, 0, 2, 0.05),
    /**
     * What a low die keeps of its dots and of the light of its edges: one that can be rolled
     * over or stepped onto. The step between the two is what says a die can be climbed.
     */
    glassLow: number(0.69, 0, 1, 0.01),
    /**
     * A die that is not all here is drawn through a mesh of the dots of the tube: as much of
     * it as is here, so many dots it has. One that is going down thins out and is gone at the
     * very end, as a message that leaves for the other side: how much of it is gone by then, 0
     * leaves it whole. One that is coming up gathers its dots and has them all when it stands:
     * how much of it is missing at the start. The size of a dot, in dots of the tube.
     */
    sinkMelt: number(1, 0, 1, 0.01),
    riseMelt: number(1, 0, 1, 0.01),
    meshDot: number(1, 0.5, 4, 0.25),
    /**
     * A die that has come up keeps the colour of its channel on its edges for a moment and
     * lets it go to the pale of the program, and its light comes to the tube: how long that
     * takes, in milliseconds. 0 changes it at once.
     */
    settleMs: number(180, 0, 600, 10),
  },
  surface: {
    /** Width of the lines between the cells and of the line around them, in cells. */
    gridLine: number(0.055, 0.005, 0.1, 0.005),
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
    /**
     * The zone of a combo. On the floor of every free cell beside an open chain, four corners:
     * a socket, the place a die is brought to. How bright they are.
     */
    dockBright: number(0.84, 0, 1, 0.01),
    /**
     * A shelf at the height of the top of the chain's dice, over the free cells beside it: with
     * the steps of the docks they are walked on from up there. It is shown over all of them
     * when the zone comes, and then only where the player's next step can use it. How strong it
     * is - 0 leaves the cells to the floor - and what share of the dots of the tube inside its
     * line are lit: a thing to stand on that is hardly there.
     */
    dockTop: number(0.6, 0, 1, 0.01),
    shelfDots: number(0.25, 0, 1, 0.01),
    /** The mark of a cell a die is about to come up on. */
    warnBright: number(0.59, 0, 1, 0.01),
  },
  screen: {
    /** The tube the board is shown on: its lines and its dark corners. The sign itself stays sharp. */
    scanlines: number(0.42, 0, 1, 0.01),
    vignette: number(0.39, 0, 1, 0.01),
    /**
     * The light the tube spreads around what gives light off: the faces on top, the edges, the
     * red of the one. How much of it there is; how far it reaches, in lines of the tube; how
     * much of it lies over the dice themselves, the rest going into the dark around them; and
     * what the edges give to it against the faces.
     */
    glow: number(0.74, 0, 1.5, 0.01),
    glowReach: number(7.5, 1, 16, 0.5),
    glowOver: number(0.14, 0, 1, 0.01),
    glowEdge: number(0.8, 0, 2, 0.05),
    /** How far red and blue stand apart along the lines while nothing happens, in lines of the tube. */
    fringe: number(0.1, 0, 1, 0.01),
    /**
     * How far they part for a moment on what is rare in a session without end: a chain of
     * three links or more - further the longer it is - and a board left clean.
     */
    fringeBeat: number(1.2, 0, 4, 0.05),
    /** Grain of the tube over the board, new 24 times a second. */
    grain: number(0.08, 0, 0.6, 0.01),
  },
  view: {
    /**
     * The whole board in view, or the player followed: the board seen larger, the screen a
     * window that moves over it with the player. `auto` follows where a cell of the whole
     * board would be small, unless the player keeps the whole board or keeps motion low.
     */
    view: choice('auto', ['auto', 'full', 'follow']),
    /**
     * Followed: the least share of the board that fits across the screen. A cell is at most
     * `1 / focus` times as large as with the whole board in view.
     */
    focus: number(0.6, 0.3, 1, 0.01),
    /**
     * The size of a cell while the player is followed, in CSS pixels. The player is followed
     * when a cell of the whole board would be smaller than this, and the board is enlarged
     * only as far as makes it this size: 64 is a centimetre on a phone, a size a finger and
     * an eye are at ease with.
     */
    minCell: number(64, 0, 120, 1),
    /** How long the view takes to come up with the player, in milliseconds. */
    followMs: number(250, 0, 1000, 10),
    /**
     * How near the player comes to an edge of the screen at the very edge of the board, as a
     * share of the screen: that much of it is left to the dark beside them. 0 keeps the dark
     * out of the picture; 0.5 keeps the player in the middle of the screen.
     */
    edge: number(0.1, 0, 0.5, 0.01),
    /**
     * A lens over the picture, to be tried: off at 0. The board and the dice are drawn as
     * they are, flat and whole; the lens presses the picture of them together towards the
     * edges of the screen, so that more of the board is in view than the screen has room for.
     * 1 brings in the whole board.
     */
    lens: number(0, 0, 1, 0.05),
    /**
     * With the lens: how much of what it enlarges the board is drawn denser by. 1 keeps the
     * picture around the player as sharp as with no lens, 0 draws it no denser than the
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
 * `?view=follow&focus=0.6&minCell=64&followMs=250&edge=0.1&lens=0`. Only what is
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
