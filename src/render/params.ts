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
    faceMute: number(0.1, 0, 0.8, 0.01),
    /** How much a face darkens from its middle towards its edges, as a screen does. */
    faceShade: number(0.2, 0, 0.6, 0.01),
    /**
     * The face on top is the one that counts, and is lit in full. What the faces on the sides
     * keep of that light; how far apart the two sides in view are, which gives the die its
     * shape; how much a side darkens towards the foot of the die.
     */
    faceSide: number(0.9, 0.2, 1, 0.01),
    sideTilt: number(0.1, 0, 0.6, 0.01),
    sideFall: number(0.25, 0, 0.9, 0.01),
    /**
     * The pips are the places of a face that are not lit; the pip of the one is lit, and red.
     * Radius of a pip as a share of the face; the single pip of the one is this many times larger.
     */
    pipSize: number(0.09, 0.05, 0.16, 0.002),
    pipOne: number(1.5, 1, 2.4, 0.05),
    pipDark: color('#171616'),
    /** The screen is a little less lit around a pip: how far that reaches, in radii of the pip, and how dark it is. */
    pipDusk: number(0.2, 0, 2, 0.05),
    pipDuskDark: number(0.3, 0, 1, 0.01),
    /** How far the die the figure stands on is pressed into the surface, in dice. */
    pressDepth: number(0.1, 0, 0.2, 0.005),
    /** A step that is stopped: how far the figure goes that way, in cells, and how long it takes to go and come back. */
    bumpReach: number(0.1, 0, 0.3, 0.01),
    bumpMs: number(140, 40, 400, 10),
  },
  edge: {
    /**
     * A line of light runs along the middle of every rounded edge, and the faces run up to it:
     * no dark stands between a face and its edge. Its width, as a share of the face; how bright
     * it is around the face on top, and what the other edges keep of that; how far it is from
     * the tone of the program towards white.
     */
    edgeWidth: number(0.04, 0, 0.1, 0.002),
    edgeBright: number(0.75, 0, 1, 0.01),
    edgeSide: number(0.49, 0, 1, 0.01),
    edgePale: number(0.45, 0, 1, 0.01),
    /** The light of the line spread over the face beside it: how far, as a share of the face, and how bright. */
    edgeSpread: number(0.03, 0.005, 0.15, 0.005),
    edgeGlow: number(0.5, 0, 1, 0.01),
  },
  glass: {
    /**
     * A die that is coming up or going down is frosted glass: not all here, and milky with
     * the colour of the channel on top. How much of it there is, and how milky it is.
     */
    glassBody: number(0.7, 0.1, 1, 0.01),
    glassFrost: number(0.2, 0, 1, 0.01),
    /** The height from which such a die is whole again, as a share of its own. */
    glassSolid: number(0.85, 0.3, 1, 0.01),
    /** How bright the lit edges of such a die are. */
    glassEdge: number(1.4, 0, 2, 0.05),
    /**
     * What a low die keeps of its dots and of the light of its edges: one that can be rolled
     * over or stepped onto. The step between the two is what says a die can be climbed.
     */
    glassLow: number(0.7, 0, 1, 0.01),
    /**
     * A die that is not all here is drawn through a mesh of the dots of the tube: as much of
     * it as is here, so many dots it has. One that is going down thins out and is gone at the
     * very end, as a message that leaves for the other side: how much of it is gone by then, 0
     * leaves it whole. One that is coming up gathers its dots and has them all when it stands:
     * how much of it is missing at the start. The size of a dot, in dots of the tube.
     */
    sinkMelt: number(1, 0, 1, 0.01),
    /** How much of their light the dice of a group that goes throw on what stands around them: 1 is all of it, as it was before 12 October 2026. */
    glassLight: number(0.2, 0, 1, 0.01),
    riseMelt: number(1, 0, 1, 0.01),
    meshDot: number(0.5, 0.5, 4, 0.25),
    /**
     * A die that has come up keeps the colour of its channel on its edges for a moment and
     * lets it go to the pale of the program, and its light comes to the tube: how long that
     * takes, in milliseconds. 0 changes it at once.
     */
    settleMs: number(180, 0, 600, 10),
  },
  surface: {
    /** Width of the lines between the cells and of the line around them, in cells. */
    gridLine: number(0.035, 0.005, 0.1, 0.005),
    gridEdge: number(0.035, 0.005, 0.15, 0.005),
    /** How much of the tone the lines take, and the floor of the cells under them. */
    gridBright: number(0.85, 0, 1, 0.01),
    gridFill: number(0, 0, 0.5, 0.01),
  },
  figure: {
    /** The one the program has no record of: a grey mannequin. */
    mannequin: color('#8b90a0'),
    /** How far the mannequin has grown into the red of the seventh: 0 is grey, 1 is red. */
    figureRed: number(1, 0, 1, 0.01),
    /**
     * The figure is plastic that can be seen through. How much of the body there is where it is
     * looked at straight on, 1 is a body nothing shows through; how much denser and lighter it
     * is towards its outline; how bright the one gleam on it is.
     */
    figureBody: number(0.5, 0.05, 1, 0.01),
    figureRim: number(0.7, 0, 1, 0.01),
    figureShine: number(0.6, 0, 1, 0.01),
    /** How much of the figure shows through a die that stands in front of it. */
    figureGhost: number(0.21, 0, 1, 0.01),
  },
  water: {
    /**
     * The water the board lies on, a probe (`water.ts`). Its swell is soft humps, as the water of
     * Super Mario Sunshine is layers of one soft picture: how high the small ones are and how
     * large, in cells, how fast they drift, in cells a second, and how high the large ones under
     * them are, which are some four times as large. How much lighter the water is far off, at
     * the top of the frame.
     */
    swellHeight: number(0.045, 0, 0.4, 0.005),
    swellLength: number(0.8, 0.1, 3, 0.01),
    swellSpeed: number(0.03, 0, 1, 0.005),
    longSwell: number(0.16, 0, 1.5, 0.01),
    farLight: number(0.01, 0, 0.3, 0.005),
    /** While a board is passed - its dice go, its lines are erased and drawn, the camera travels - the swell goes down by this much. */
    passCalm: number(0.85, 0, 1, 0.01),
    /**
     * The rings of what happens on the board: what of its speed a ring loses on a step, how
     * fast it runs, in cells a second (as fast as its picture can carry, at the most), and how
     * many steps are counted in a second. How wide a ring starts, in cells, and how
     * high: of a step, of a die that stands or is thrown, of a group.
     */
    rippleDamp: number(0.004, 0, 0.1, 0.001),
    dieDamp: number(0.022, 0, 0.1, 0.001),
    rippleSpeed: number(0.55, 0.1, 3, 0.05),
    rippleHz: number(60, 10, 120, 5),
    dropRadius: number(0.5, 0.1, 1.5, 0.05),
    dropStep: number(0.05, 0, 1, 0.005),
    dropSmall: number(0.025, 0, 1, 0.005),
    dropMid: number(0.06, 0, 2, 0.005),
    dropBig: number(0.3, 0, 4, 0.05),
    /**
     * The board is a stiff sheet on the water: how still the water is under its cells, what
     * the mirror loses there, and how still the water is in a cell cut out, 0 as around the
     * board and 1 as under a cell.
     */
    calm: number(0.9, 0, 1, 0.01),
    calmReflect: number(0.5, 0, 1, 0.01),
    /** What of the stillness under the cells the rings take: at 1 a ring is as still there as the swell, at 0 it runs under the board as over open water. */
    ringCalm: number(0.45, 0, 1, 0.01),
    holeCalm: number(0.3, 0, 1, 0.01),
    /**
     * The dice in the water: how strong the mirror is, 0 for none and nothing drawn for it;
     * how far the slope of a wave moves it; how fast it fades up the die.
     */
    reflectStrength: number(0.18, 0, 1, 0.01),
    reflectWarp: number(0.012, 0, 0.3, 0.002),
    reflectFade: number(3.5, 0, 12, 0.1),
    /**
     * A lamp stands over the water far off, and the water gives it back as a path of glints from
     * the lamp to the eye, dark beside it: how bright the glints are, 0 for none; how tight, the
     * higher the narrower the path and the smaller a glint; and to which side of the frame the
     * path lies, -1 the left and 1 the right.
     */
    glint: number(0.05, 0, 3, 0.01),
    glintTight: number(14, 2, 600, 1),
    lampSide: number(1, -1.5, 1.5, 0.05),
    /** The light of a ring, and how much darker than the dark of the board the water is. */
    crestLight: number(0.2, 0, 2, 0.01),
    waterDeep: number(0.15, 0, 0.3, 0.01),
    /**
     * What the water gives back of the sky: no lamp and no moon, nothing that reads as a cloud,
     * lighter and darker shapes that go slowly and turn into one another. How light, 0 for none;
     * how large, in cells; how fast they go, in cells a second; how far the slope of a wave moves
     * them, in cells (the owner, 27 October: «источника света в отражении не должно быть видно.
     * облака тоже не должны "читаться" как облака»).
     */
    skyLight: number(0.03, 0, 0.5, 0.005),
    skySize: number(7, 0.5, 30, 0.5),
    skySpeed: number(0.35, 0, 2, 0.01),
    skyWarp: number(10, 0, 40, 0.5),
    /**
     * Dark shapes under the water, small and large, that come up, drift, change their outline and
     * go down, each on a time of its own («как будто под водой что-то происходит, но неясно что»).
     * How dark, 0 for none; how large, in cells; how fast they drift, in cells a second; how long
     * one is there, in seconds; how far the slope of a wave moves them; how soft their edge is.
     * They are deep, not on the surface («движение под водой и на глубине»): they darken the
     * water and not the sky in it.
     */
    shadeDark: number(0.6, 0, 1, 0.01),
    shadeSize: number(3, 0.3, 10, 0.1),
    shadeSpeed: number(0.12, 0, 0.5, 0.005),
    shadeLife: number(40, 5, 200, 1),
    refract: number(1.5, 0, 4, 0.05),
    shadeSoft: number(0.35, 0.02, 1, 0.01),
    /**
     * Rings that come from past the frame, from nothing that is seen («игрок делает круги сам, а
     * странные затухающие волны/круги могут приходить "из вне"»), slower than the player's: about
     * how many seconds from one to the next, 0 for none; how high; how fast they run, in cells a
     * second; how wide, in cells; in how many seconds one dies out to a third; how far past the
     * frame one starts, in cells.
     */
    outerEvery: number(40, 0, 240, 1),
    outerHeight: number(0.1, 0, 0.5, 0.005),
    outerSpeed: number(0.4, 0.05, 3, 0.05),
    outerWidth: number(1.2, 0.2, 5, 0.1),
    outerLife: number(45, 1, 120, 1),
    outerFar: number(2, 0, 20, 0.5),
  },
  signs: {
    /**
     * The zone of a combo. On the floor of every free cell beside an open chain, four corners:
     * a socket, the place a die is brought to. How bright they are.
     */
    dockBright: number(0.7, 0, 1, 0.01),
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
    warnBright: number(0.55, 0, 1, 0.01),
  },
  screen: {
    /** The tube the board is shown on: its lines and its dark corners. The sign itself stays sharp. */
    scanlines: number(0.3, 0, 1, 0.01),
    vignette: number(0.39, 0, 1, 0.01),
    /**
     * The light the tube spreads around what gives light off: the faces on top, the edges, the
     * red of the one. How much of it there is; how far it reaches, in lines of the tube; how
     * much of it lies over the dice themselves, the rest going into the dark around them; and
     * what the edges give to it against the faces.
     */
    glow: number(0.65, 0, 1.5, 0.01),
    glowReach: number(5.5, 1, 16, 0.5),
    glowOver: number(0.14, 0, 1, 0.01),
    glowEdge: number(0.2, 0, 2, 0.05),
    /**
     * Where that light is taken from. 0: from the faces on top, the edges and the red of the
     * one, drawn alone for it. Above 0: from the picture itself, as the consoles of the last
     * years of the tube took it - whatever is brighter than this gives light, the figure and a
     * die that flashes with the rest.
     */
    glowThreshold: number(0.5, 0, 0.95, 0.01),
    /**
     * The frame before stays under the new one for a moment, and what moves leaves a trail:
     * how long it takes to go, in milliseconds, while the board is played, and where a board
     * comes or a combo is taken. 0 leaves none.
     */
    trailMs: number(30, 0, 400, 5),
    trailPeakMs: number(160, 0, 600, 10),
    /**
     * A die blinks once with that light when a combo takes it: how bright the light around it
     * is at its most, against that of a standing die, 0 for no blink; how long the blink is,
     * in milliseconds.
     */
    comboGlow: number(1.6, 0, 3, 0.05),
    comboBlinkMs: number(700, 0, 2000, 50),
    /** How far red and blue stand apart along the lines while nothing happens, in lines of the tube. */
    fringe: number(0, 0, 1, 0.01),
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
  road: {
    /**
     * The passage from a board that is passed to the next, in the order it goes. The combo that
     * clears a board takes its dice away by the numbers of the group `leaving` (the finale); a
     * die of it flashes as it sounds, and this is how long that light takes to go down.
     */
    comboHoldMs: number(350, 0, 1500, 10),
    /** The lines of the board are erased towards the cell of the player: how long the whole of it takes. */
    eraseMs: number(700, 100, 3000, 50),
    /** The camera comes to the frame of the next board: nine tenths of the way in this time. */
    cameraMs: number(900, 0, 3000, 50),
    /** The lines of the next board are drawn from the cell of the player: how long the whole of it takes. */
    drawMs: number(1100, 100, 4000, 50),
    /**
     * The point that draws a line and erases it, a bright point of light as on the screen of a
     * console: 0 is no point, at 1 the end of the line is lit in full and twice as wide as its
     * line, past 1 it is only larger, and the light around the point is as much stronger. How
     * wide its hot core is, in widths of the thin line; how far the light around it reaches,
     * in cells; how far towards white its middle goes. The tube spreads that light further. And how long the light the point leaves
     * behind lasts: on a line just drawn, going down to the light of the lines; on a line just
     * erased, going out.
     */
    headGlow: number(1.6, 0, 3, 0.05),
    headSize: number(2, 0.5, 6, 0.1),
    headHalo: number(0.45, 0, 1, 0.01),
    headCore: number(0.9, 0, 1, 0.01),
    afterglowMs: number(250, 0, 1500, 10),
    /** The dice of the next board come up out of the floor when its lines are drawn: how long one takes, and how much later each step further from the player. */
    riseMs: number(600, 100, 2000, 50),
    riseStepMs: number(90, 0, 400, 10),
    /**
     * A die that is fixed looks faded, dead, until its combo: how much of the colour of a face
     * is washed out, 0 the channel as it is and 1 a grey; what the face keeps of its light;
     * and what its edges keep of theirs.
     */
    fixedFade: number(0.45, 0, 1, 0.01),
    fixedLight: number(0.3, 0, 1, 0.01),
    fixedEdge: number(0.5, 0, 1, 0.01),
    /**
     * A die that leaves a level is shown by steps, as shares of a whole die, and not as the rules
     * have it: as low as this the moment it leaves, and as low as this with its last move left to
     * it, where it can still be stepped up onto; with no move left it is gone. From one to the next
     * it comes down with the roll of the figure, as the group `leaving` below has it. Only the look: the rules, and a session, are as
     * they were (the owner, 12 October: «сразу 75–80%, после первого хода 10–15%»; 18 October:
     * «две ступени: 75 - 30, или примерно такие», the last step a step and not a slab on the floor).
     */
    leaveFirst: number(0.75, 0.3, 1, 0.01),
    leaveLast: number(0.3, 0, 0.6, 0.01),
    /**
     * A stair, a die the board is laid with as leaving, stands this high while it has two moves
     * left, and goes down to the last step with the first move as any die that leaves; a stair
     * with one move left stands on the last step. So the stair of the second piece is two steps
     * up from the floor (the owner, 12 October: «первая ступень — самое низкое положение кости.
     * вторая ступень — посередине»). Half way between the last step and the first, so that the
     * floor, the two steps of a stair and a die that has just left stand at even intervals.
     */
    stairMiddle: number(0.53, 0, 1, 0.01),
    /**
     * The swipe sign: a small bright star that runs beside the die of the figure and leaves a
     * thin line behind it. How long the rays of the star are, in pixels of the picture; how much
     * of its run the line behind it stays lit for, 0 to 1; how long a run takes and how long
     * nothing is shown before the next; how strong the light around the star is; and how long
     * the run is, in cells of the board.
     */
    signStar: number(4, 2, 10, 1),
    signTrail: number(0.6, 0, 1, 0.05),
    signRunMs: number(800, 200, 3000, 50),
    signRestMs: number(350, 0, 2000, 50),
    signGlow: number(1, 0, 2, 0.05),
    signLength: number(1.2, 0.5, 2.5, 0.05),
    /** The words of the window of a hint come a word at a time: how long each word waits for the one before it; 0 puts them up whole. */
    hintWordMs: number(180, 0, 600, 10),
  },
  leaving: {
    /**
     * The leaving of a group on a level is gentle, and has one accent: the board answers a combo
     * on the tick it is made, and from there the dice only settle (the owner, 13 October, after
     * playing two builds that struck: the motion had become «дёрганной» и «нервной»; it is to be
     * «приятной, эффектной и радовать игрока», «нежная и приятная», not sluggish). A group that is
     * sent sinks to its first step in `dropMs`, all its dice together, along `dropCurve` (0
     * outCubic, 1 inOutSine, 2 outQuad): quick off the mark, soft at the end. With every roll of
     * the figure it comes a step down with the roll; with the last it goes into the floor, and it
     * goes silent: the one ring of the combo runs when it is made.
     */
    dropMs: number(300, 80, 800, 10),
    dropCurve: number(0, 0, 2, 1),
    /**
     * A die the rules hold where a new die has joined its chain is never shown lower than the last
     * step (`leaveLast`): one held in its last move comes back up to it in `holdRiseMs`, and goes on
     * down from it in `holdFallMs` once it is let go, so a die almost gone that still counts reads
     * as one the figure can climb (the owner, 28 October 2026).
     */
    holdRiseMs: number(220, 0, 800, 10),
    holdFallMs: number(160, 0, 600, 10),
    /**
     * The last combo of a board: every die of the board flashes at once, on one chord; they stand
     * lit for `finaleHangMs`, and go under the floor together in `finaleDropMs`, slowly at first,
     * with the one ring of the combo, made when it flashes.
     */
    finaleHangMs: number(250, 0, 800, 10),
    finaleDropMs: number(450, 100, 1200, 10),
    /** The lean of the camera on a beat: up to its peak in `punchAttackMs`, then down with a half-life of `punchDecayMs`. In every mode. */
    punchAttackMs: number(30, 0, 120, 5),
    punchDecayMs: number(120, 30, 400, 10),
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
 * What an address says of the view, of the passage between boards and of the leaving of a group (`?dropMs=400`), in any build, to try on
 * a device what it is like: `?view=follow&focus=0.6&minCell=64&followMs=250&edge=0.1&lens=0`,
 * `?drawMs=1600&eraseMs=900&headGlow=1.5`. Only what is named and makes sense is returned; the
 * rest stays as it is defined.
 */
export function readView(search: string): ParamValues {
  const query = new URLSearchParams(search);
  const values: ParamValues = {};
  const read: Record<string, ParamSpec> = { ...BOARD_GROUPS.view, ...BOARD_GROUPS.road, ...BOARD_GROUPS.leaving };
  for (const [name, spec] of Object.entries(read)) {
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
