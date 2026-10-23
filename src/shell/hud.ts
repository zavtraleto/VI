import type { Display } from '../display/display';
import type { CanvasLayer } from '../display/layer';
import type { Rect } from '../display/sizing';
import type { BoardLook } from '../render/params';
import { faceColour, pipColour } from '../render/textures';
import type { Dir, GoalLine } from '../rules';
import { signalLook } from '../signal/scene';
import { loadShellFonts } from './fonts';
import { COUNTER_CUBE, COUNTER_GAP, NOTE_SIZE, counterLeft, counterWidth, hudLayout, undoButton, restartDot, netBounds, netCellAt, boxesMeet, signBeside, signPlace, signTurn, turned, TOOL_ICON, type FloorAxes, type HudLayout } from './hudLayout';
import { FACE_PIPS, Kit } from './kit';
import { CELL_H, CELL_W, pictureSize, type Box, type Insets, type Point } from './layout';
import { word } from '../ui/i18n';
import { praiseWord } from './praise';
import { paintStar, paintStarGhost, starRow } from './star';
import { SIGN_KEY, SIGN_KEY_MS, paintSign, signBounds, type SignLook, type SignPlan } from './swipeSign';
import { COMMANDS, HUD, READS, digits, goalLabel, goalProgress } from './text';
import { clockHour, mixHex, paletteAt, type Palette } from './theme';
import { Voice } from './voice';

/** Seconds as the clock of a live session reads them, `MM:SS`; null where there is no clock. */
export function clockText(seconds: number | null): string | null {
  return seconds === null ? null : `${digits(Math.floor(seconds / 60), 2)}:${digits(seconds % 60, 2)}`;
}

/** The readings of a session that is scored. */
export interface HudSession {
  kind: 'session';
  score: number;
  best: number;
  level: number;
  /** Seconds left of a live session; null in a session with no clock. */
  clock: number | null;
  /** Seconds left to free a cell of a board that is full. */
  danger: number | null;
  /** Steps the contact has taken, out of how many there are, and the score of the next one. */
  stage: number;
  steps: number;
  next: number | null;
}

/**
 * The readings of a level: the score of the levels, large; the moves made on this try and the
 * fewest the board is cleared in, small; and a line for whatever its goal counts.
 */
export interface HudLevel {
  kind: 'level';
  /** Its place in the list of the levels; null on a level that is not in the list and has no number. */
  number: number | null;
  /** The score of the levels: the stars the player holds, in points. */
  score: number;
  /** Moves made. */
  made: number;
  /** The fewest moves the board is cleared in; null where they are not known. */
  best: number | null;
  /** One line per thing the goal counts. */
  goal: readonly GoalLine[];
}

/**
 * The stars of a level that has just been passed: `stars` of three light up over the board, and
 * the last `fresh` of them, those the player did not hold, fly to the score, each with `points`.
 * `value` is the channel of the combo that passed it; `at` is in CSS pixels of the window.
 */
export interface HudAward {
  stars: number;
  fresh: number;
  points: number;
  value: number;
  at: Point;
}

/** A face of the net: its value and how many quarter turns its picture lies at. */
export interface NetFace {
  value: number;
  turns: number;
}

/** The die under the player, unfolded: its top face and the four sides, each folded out the way it looks. */
export interface HudSeal {
  axes: FloorAxes;
  /** null on the floor: there is no die to unfold. */
  faces: Record<'top' | Dir, NetFace> | null;
  sinking: boolean;
  /** A step that way leads nowhere. */
  blocked: Record<Dir, boolean>;
  /** The side a swipe is steering towards, the side to pulse, the side to bring on top. */
  active: Dir | null;
  pulse: Dir | null;
  marked: Dir | null;
  /**
   * Sides a step to which is a commitment on a level: from the die that is going onto one that
   * stands, with no step back. They are marked as the side to bring on top is.
   */
  commits?: readonly Dir[];
}

/** How many dice of a group are in place, over the group: `at` is in CSS pixels of the window. */
export interface HudCounter {
  value: number;
  have: number;
  need: number;
  at: Point;
  /** The plaque is asking to be looked at: it is lit and unlit by turns. */
  blink?: boolean;
}

/**
 * The swipe sign: beside the die of the figure, on its right, the way to swipe now, with no
 * word. For those who swipe it is a small bright star that runs parallel to the board and
 * leaves a thin line behind it, again and again; for those who press keys, the arrow key, in
 * the same place and blinking.
 */
export interface HudSign {
  dir: Dir;
  mode: 'dot' | 'key';
  /** The die under the figure, or its cell on the floor, as it lies on screen, in CSS pixels of the window: the sign stands to the right of it. */
  body: Box;
  /** A cell of the board the way of the swipe, as it lies on screen, in CSS pixels: the trail is parallel to it. */
  step: Point;
  /** Where a plain swipe that steps the same way points on screen, a unit; null where no plain swipe is read as this step. */
  plain?: Point | null;
}

/** The multiplier of a chain, over its dice. `at` is in CSS pixels of the window. */
export interface HudLabel {
  id: number;
  value: number;
  chain: number;
  at: Point;
  /** On a level, which has no points to multiply: a word is said over the chain where the multiplier would be (`praiseWord`). */
  praise?: boolean;
}

/** A beat as the readings answer it: the points of a group leave it for the score. */
export interface HudBeat {
  kind: 'match' | 'chain' | 'one' | 'step' | 'level' | 'peak';
  /** The channel of the group, 1 to 6; 0 when no group goes. */
  value: number;
  chain: number;
  points: number;
  /** How strong it is, 0 to 4. */
  tier: number;
  /** The middle of the group in CSS pixels of the window; null when no group goes. */
  at: Point | null;
}

/** Everything the session shows over the board at one moment. */
export interface HudView {
  header: HudSession | HudLevel;
  seal: HudSeal | null;
  /** On a level: the faces it asks for, in the corner where the seal lay. */
  aim?: HudAim | null;
  labels: readonly HudLabel[];
  /** One line at the bottom: a hint. */
  note: { text: string; alarm: boolean } | null;
  /** On a level: over every group that is short, how many dice it has of how many it takes. */
  counters?: readonly HudCounter[];
  /** The swipe sign, while a level shows it. */
  sign?: HudSign | null;
  /** The two buttons of a level. `retryOnly` leaves the one that starts over, where no move can be taken back. */
  tools: HudTools | null;
  /** The four buttons of those who would rather press than swipe; `box` is theirs in the window. */
  pad: { pulse: Dir | null; box: Rect } | null;
  /** The part of the window the board has, in CSS pixels. */
  stage: Rect;
  /**
   * How far the contact has gone for the program: steps of its own line, eased, and the moment
   * past the last step. The readings find a pattern, slip, take foreign signs, come apart.
   */
  contact: { program: number; peak: number };
  reducedMotion: boolean;
}

export interface HudTools {
  canUndo: boolean;
  urgent: boolean;
  retryOnly?: boolean;
  /** How many moves can still be taken back, where they are counted: the number stands after the word of the button. */
  left?: number;
  /** The player has turned the sound off: the button of the sound is crossed out. */
  muted: boolean;
}

/** What the contact does to the readings at one moment. */
interface Decay {
  /** Rows of the readings that have slipped sideways. */
  tears: { y: number; h: number; dx: number }[];
  /** The digit of the score that is in a foreign hand; -1 when none is. */
  foreign: number;
  /** The digit of the score that has come off and is falling, and how far through its fall it is. */
  falling: { index: number; phase: number } | null;
  /** 0 to 1: how far the readings have come apart. */
  drift: number;
}

const WHOLE: Decay = { tears: [], foreign: -1, falling: null, drift: 0 };

/** A number between 0 and 1 that is always the same for the same `n`. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface HudActions {
  /** Nothing lies over the session: its zones take presses. */
  live(): boolean;
  onPause(): void;
  onUndo(): void;
  onRestart(): void;
  /** The button of the sound was pressed: the sound goes off, or comes back. */
  onSound(): void;
  /** Points of a group have reached the score; the score has counted a little further up. */
  onPoints?(points: number, tier: number): void;
  onCount?(): void;
  /** A star of a level that is passed has lit up: the first of them is 0. */
  onStar?(index: number): void;
  /** A button that has nothing to do was pressed. */
  onRefused?(): void;
  press(dir: Dir): void;
  release(): void;
  cancel(): void;
}

interface Zone {
  id: string;
  /** In CSS pixels of the window. */
  rect: Rect;
  /** Held down for as long as the finger stays: a direction. Otherwise it acts when let go. */
  dir?: Dir;
  action?: () => void;
}

/**
 * The faces a level asks for, and the moment they began to rise into sight. A face that is done
 * has the moment it began to leave; one that a move taken back brought back, the moment it began
 * to rise again.
 */
export interface HudAim {
  since: number;
  faces: readonly { value: number; left: number | null; back: number | null }[];
}

/** What on the page takes presses of its own. */
const FOREIGN = `${import.meta.env.DEV ? '.overlay, .debug-panel, .lil-gui, ' : ''}button, input, select, textarea, a`;
const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];
const ARROW: Record<Dir, string> = { N: '↑', E: '→', S: '↓', W: '←' };
/** How far in the dots of a face its edge and its pips reach, as shares of the face. */
const NET_EDGE = 0.07;
const NET_PIP = 0.12;
const NET_PIP_ONE = 0.19;
/** A star of a pass comes on with a burst of its light that takes this long, and then breathes, once in this long. */
const STAR_FLARE_MS = 320;
const STAR_BREATH_MS = 1700;
/** The foot of the row of the stars is this far under the place the game asks for them at, in dots: what keeps them clear of the board. */
const STAR_FOOT = 7;
/** A star that flies to the score is this small when it lands, in dots of its radius. */
const STAR_LAND = 4;
/**
 * The stars of a pass light up one after another this far apart, stand for this long after the
 * last, and then leave: those that are new fly to the score one after another, the rest go out.
 */
const STAR_STEP_MS = 190;
const STAR_HOLD_MS = 1300;
const STAR_FLY_STEP_MS = 150;
const STAR_FLY_MS = 460;
/**
 * The two buttons of a level as pictures, nine dots by nine: the arrow that turns back takes
 * the last move back, the arrow that goes round starts the level over.
 */
const ICON_UNDO = ['.........', '..#......', '.##......', '#######..', '.##....#.', '..#.....#', '........#', '.......#.', '..#####..'];
/** The button of the sound: a loudspeaker and what comes out of it; with the sound off, the loudspeaker alone and a cross over it. */
const ICON_SOUND = ['....#....', '...##..#.', '#####...#', '#####.#.#', '#####.#.#', '#####.#.#', '#####...#', '...##..#.', '....#....'];
const ICON_MUTE = ['....#....', '...##....', '#####....', '#####....', '#####....', '#####....', '#####....', '...##....', '....#....'];
const ICON_CROSS = ['#.......#', '.#.....#.', '..#...#..', '...#.#...', '....#....', '...#.#...', '..#...#..', '.#.....#.', '#.......#'];
const ICON_RETRY = ['..####.#.', '.#....##.', '#....###.', '#........', '#.......#', '#.......#', '.#.....#.', '..#####..', '.........'];
/** How long a reading that has just changed keeps flashing, and a multiplier stays large, in milliseconds. */
const FLASH_MS = 1200;
const BUMP_MS = 220;
/**
 * The multiplier of a chain does not hang over it: it stands for this long after the chain
 * last grew, and goes out over the last of that, there and not there, as the tube puts
 * things out. One whose chain is over goes out at once, the same way.
 */
const LABEL_MS = 2600;
const LABEL_OUT_MS = 330;
/**
 * When the chain grows the multiplier is pushed, and swings about its middle: this far for
 * every link of the chain, in degrees. A chain of thirty all but turns it over.
 */
const SWING_DEG = 12.5;
const SWING_MOST_DEG = 400;
/** A word over a chain of a level is pushed no further than this: turned more, it cannot be read. */
const SWING_WORD_DEG = 24;
/**
 * No two answers are alike. A push finds the multiplier wherever the swing before has left
 * it, goes one way or the other, and is one of three kinds, never the kind before: a pendulum
 * that swings long, a turn that goes far once and comes back, a rattle that is small and
 * quick. For each: how long one swing there and back takes, from and to, in milliseconds; how
 * soon it dies down, as a share of not swinging at all; how hard the push is against a plain one.
 */
const SWINGS: readonly { ms: [number, number]; damp: [number, number]; push: number }[] = [
  { ms: [470, 700], damp: [0.1, 0.17], push: 1 },
  { ms: [520, 760], damp: [0.3, 0.42], push: 1.9 },
  { ms: [210, 300], damp: [0.1, 0.16], push: 0.5 },
];
/** With a push the multiplier hops as well: this many dots of the picture and as many again for every few links, and how long a hop and the hops together take. */
const HOP_DOTS = 1.5;
const HOP_PER_LINK = 0.45;
const HOP_MS: [number, number] = [240, 380];
const HOPS_DIE_MS = 260;

/** A swing that dies down: when it was last pushed, where it stood and how fast it turned then, how quick it is and how soon it dies. */
interface Swing {
  from: number;
  angle: number;
  speed: number;
  /** Turns of the swing in a second, as an angle. */
  rate: number;
  damp: number;
  kind: number;
  /** Which way the last push went. */
  way: number;
}

/** A multiplier over the board. */
interface Multiplier {
  chain: number;
  /** What is written: the multiplier, or on a level a word for the chain. */
  text: string;
  /** A word, not a number: it is written no larger than the picture is wide. */
  praise: boolean;
  value: number;
  at: Point;
  /** When the chain last grew, and until when the multiplier is shown. */
  joined: number;
  until: number;
  swing: Swing;
  /** The hop of the last push: how high, in dots of the picture, and how long one hop takes. */
  hop: { high: number; beat: number };
}

const between = ([from, to]: readonly [number, number]): number => from + Math.random() * (to - from);

/** The angle of a swing at a moment, in radians, and how fast it is turning then. */
function swingAt(swing: Swing, timeMs: number): { angle: number; speed: number } {
  const t = Math.max(0, timeMs - swing.from) / 1000;
  const { rate, damp, angle: a } = swing;
  const live = rate * Math.sqrt(1 - damp * damp);
  const b = (swing.speed + damp * rate * a) / live;
  const fall = Math.exp(-damp * rate * t);
  const cos = Math.cos(live * t);
  const sin = Math.sin(live * t);
  return { angle: fall * (a * cos + b * sin), speed: fall * ((b * live - damp * rate * a) * cos - (a * live + damp * rate * b) * sin) };
}

/** A multiplier pushed by a link its chain has taken: the swing it was in goes on from where it is, with the push added. */
function pushed(kept: Multiplier | undefined, label: HudLabel, timeMs: number): Multiplier {
  const before = kept ? swingAt(kept.swing, timeMs) : { angle: 0, speed: 0 };
  // Never the kind before, and more often than not the other way.
  const kind = kept ? (kept.swing.kind + 1 + Math.floor(Math.random() * (SWINGS.length - 1))) % SWINGS.length : Math.floor(Math.random() * SWINGS.length);
  const way = kept ? (Math.random() < 0.65 ? -kept.swing.way : kept.swing.way) : Math.random() < 0.5 ? -1 : 1;
  const { ms, damp, push } = SWINGS[kind];
  const rate = (Math.PI * 2 * 1000) / between(ms);
  const most = (Math.min(label.praise ? SWING_WORD_DEG : SWING_MOST_DEG, label.chain * SWING_DEG) * Math.PI) / 180;
  return {
    chain: label.chain,
    text: label.praise ? praiseWord(label.chain, Math.random(), kept?.praise ? kept.text : null) : `×${label.chain}`,
    praise: label.praise === true,
    value: label.value,
    at: label.at,
    joined: timeMs,
    until: timeMs + LABEL_MS,
    swing: { from: timeMs, angle: before.angle, speed: before.speed + way * most * rate * push * (0.85 + Math.random() * 0.3), rate, damp: between(damp), kind, way },
    hop: { high: (HOP_DOTS + Math.min(label.chain, 16) * HOP_PER_LINK) * (0.6 + Math.random() * 0.8), beat: between(HOP_MS) },
  };
}
/** A word over a chain keeps this far from the sides of the picture, in its dots. */
const LABEL_SIDE = 4;
/** Half a period of everything that blinks. */
const BLINK_MS = 250;
/** A plaque that asks to be looked at is lit and unlit by turns this often. */
const COUNTER_BLINK_MS = 500;
/** A plaque brought in from the edge of the window stands this far from it, in picture pixels: as clear of it as the swipe sign. */
const COUNTER_PAD = 1;
/**
 * The swipe sign: how far it stands from the die and from the edges of what it may stand in, in
 * pixels of the picture. How it is drawn is in `swipeSign.ts`; what the owner turns - the star,
 * its line, its times - is in the look of the board (`road`).
 */
const SIGN_GAP = 3;
const SIGN_PAD = 2;
/** A sign that cannot be drawn alone has all the readings drawn anew for it, and then no more often than this, in milliseconds. */
const SIGN_STEP_MS = 33;
/** Points of a group stand over it for this long, then fly to the score for this long. */
const POP_MS = 420;
const FLY_MS = 380;
/** How long the score shows that points have reached it. */
const HIT_MS = 200;
/** How often a row of the readings may slip, a digit may change hands, a digit may come off; how long it falls. */
const TEAR_SLOT_MS = 110;
const FOREIGN_SLOT_MS = 170;
const FALL_EVERY_MS = 1700;
const FALL_MS = 900;
/** The colour of a sign in a foreign hand: the white of the captions. */
const FOREIGN_INK = '#f4f1ea';

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** When the stars of a pass begin to leave, in milliseconds from the first of them: all three have had their turn to light, and have stood. */
function starsLeave(): number {
  return STAR_STEP_MS * 2 + STAR_HOLD_MS;
}

let probe: HTMLElement | null = null;

/** What the edges of the screen keep to themselves in CSS pixels, read from an element padded by them. */
function safeInsets(): Insets {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.append(probe);
  }
  const style = getComputedStyle(probe);
  const side = (value: string): number => Number.parseFloat(value) || 0;
  return { top: side(style.paddingTop), right: side(style.paddingRight), bottom: side(style.paddingBottom), left: side(style.paddingLeft) };
}

/**
 * What the program shows of a session over the board: its readings at the top, the die under
 * the player unfolded, the multipliers of chains, the buttons. It is a layer of
 * the one canvas, in the same few pixels, colours and font as the program's menu, and under
 * the same tube. Prose in the language of the player is the voice's, not the program's.
 *
 * Whoever owns the frame calls `frame()` before the display presents.
 */
export class GameHud {
  /** Height of the readings at the top of a tall screen, in CSS pixels: the board starts below it. */
  headerHeight = 0;
  /** Width of the readings down the left of a wide screen, in CSS pixels: the board starts beside it. */
  columnWidth = 0;
  private readonly layer: CanvasLayer;
  private readonly kit: Kit;
  private readonly voice: Voice;
  private readonly net = document.createElement('canvas');
  private zones: Zone[] = [];
  private held: { zone: Zone; pointer: number } | null = null;
  private drawn = '';
  private netDrawn = '';
  /** The score as it is shown: it runs up to the score as it is. */
  private shown = 0;
  private lastLevel = 1;
  private lastStage = 0;
  private levelFlash = 0;
  private stageFlash = 0;
  /** The multipliers now over the board, by chain: the number, its channel, where it stands, when the chain last grew and until when it is shown. */
  private readonly chains = new Map<number, Multiplier>();
  /** Chains whose multiplier has gone out while they still stand, and how long each was then: it is not shown again until the chain grows. */
  private readonly said = new Map<number, number>();
  private lastTime = 0;
  /** Points on their way from a group to the score. `from` is in pixels of the picture. */
  private flyers: { points: number; value: number; tier: number; from: Point; born: number }[] = [];
  /** The last points to reach the score: when, and of which channel and tier. */
  private hit = { at: -Infinity, value: 0, tier: 0 };
  /** Where points fly to: the middle of the score, in pixels of the picture. */
  private scoreAt: Point = { x: 0, y: 0 };
  /** The stars of the pass just made: where they stand in pixels of the picture, since when, and how many of the new ones have reached the score. */
  private passed: (HudAward & { born: number; landed: number; lit: number }) | null = null;
  /** Nothing has been shown since the last start: the score of the levels is there at once, and does not run up from nothing. */
  private fresh = true;
  /**
   * The swipe sign of the picture as it was last drawn whole, where the sign can be drawn alone:
   * how it is laid out, the part of the picture it can light (`room`), and what was in that part
   * before the sign was drawn. Null where there is no sign, or it lies on a button.
   */
  private signKept: { plan: SignPlan; room: Box; under: ImageData } | null = null;
  /** Which picture of the sign is on the picture now (`signTurn`). */
  private signTurned = 0;

  constructor(
    private readonly display: Display,
    private readonly look: BoardLook,
    private readonly actions: HudActions,
  ) {
    this.layer = display.addCanvasLayer({ name: 'hud', lines: 240, look: { opacity: 0 } });
    this.layer.onResize = () => (this.drawn = '');
    this.kit = new Kit(this.layer, display, look.shell, paletteAt(look.shell, clockHour()));
    this.voice = new Voice(display, look.shell, 'hud-voice');
    void loadShellFonts().then(() => {
      this.kit.forgetText();
      this.drawn = '';
    });
    // On the way down, before the page hands the press to the swipes of the board.
    window.addEventListener('pointerdown', (e) => this.onDown(e), true);
    window.addEventListener('pointerup', (e) => this.onUp(e), true);
    window.addEventListener('pointercancel', (e) => this.onCancel(e), true);
  }

  /** The readings answer a beat: the points of a group stand over it, then fly to the score. */
  beat(beat: HudBeat): void {
    if (beat.points <= 0 || !beat.at) return;
    const zoom = this.kit.zoom;
    this.flyers.push({ points: beat.points, value: beat.value, tier: beat.tier, from: { x: beat.at.x / zoom, y: beat.at.y / zoom }, born: this.lastTime });
  }

  /** A level is passed: its stars stand over the board, and the new ones fly to the score. */
  award(award: HudAward): void {
    const zoom = this.kit.zoom;
    this.passed = { ...award, at: { x: award.at.x / zoom, y: award.at.y / zoom }, born: this.lastTime, landed: 0, lit: 0 };
  }

  /** A new session: nothing of the last one is left flashing. */
  reset(): void {
    this.flyers = [];
    this.hit = { at: -Infinity, value: 0, tier: 0 };
    this.shown = 0;
    // The stars of a pass are not put away: the board after it is put on under them.
    this.fresh = true;
    this.lastLevel = 1;
    this.lastStage = 0;
    this.levelFlash = 0;
    this.stageFlash = 0;
    this.chains.clear();
    this.said.clear();
    this.drawn = '';
  }

  /**
   * Draws what the session shows; `null` puts it all away. With `unseen` it is laid out and keeps
   * its room, so that the board stands where it will, and nothing of it is shown.
   */
  frame(view: HudView | null, timeMs: number, unseen = false): void {
    const { layer, display, kit } = this;
    if (!view) {
      layer.look.opacity = 0;
      this.voice.clear();
      this.zones = [];
      this.drawn = '';
      return;
    }
    display.sync();
    const { shell } = this.look;
    const canvas = { width: display.width * display.pixelRatio, height: display.height * display.pixelRatio };
    layer.setLines(pictureSize(canvas, Number(shell.pixelsTall), Number(shell.pixelsWide)).height);
    Object.assign(layer.look, signalLook(shell), { opacity: unseen ? 0 : 1, depth: 8, dither: 0 });
    // The program holds its picture worse as the contact grows: the colours part, the grain
    // thickens; past the last step the readings turn inside out with the board.
    const { program, peak } = view.contact;
    const worn = clamp(program - 1, 0, 3) / 3;
    layer.look.chroma += 0.5 * worn;
    layer.look.noise += 0.05 * worn;
    layer.look.invert = !view.reducedMotion && peak > 0.72;
    kit.palette = paletteAt(shell, clockHour());

    const zoom = kit.zoom;
    const css = safeInsets();
    const safe = { top: css.top / zoom, right: css.right / zoom, bottom: css.bottom / zoom, left: css.left / zoom };
    const header = view.header;
    const layout = hudLayout({ width: kit.width, height: kit.height }, safe, zoom, { restart: view.tools !== null, sound: view.tools !== null && header.kind === 'level', level: header.kind === 'level', goal: header.kind === 'level' && header.goal.length > 0 });
    this.lastTime = timeMs;
    this.headerHeight = layout.wide ? 0 : Math.round(layout.height * zoom - css.top);
    this.columnWidth = layout.wide ? Math.round(layout.column * zoom - css.left) : 0;
    this.follow(view, timeMs);

    // What moves by itself: only these make the picture be drawn again while nothing else changes.
    const still = view.reducedMotion;
    const blink = still ? 1 : Math.floor(timeMs / BLINK_MS) % 2;
    const flashing = timeMs < this.levelFlash || timeMs < this.stageFlash;
    const bumps = [...this.chains.values()].some((chain) => timeMs < chain.joined + BUMP_MS);
    // A multiplier that is shown swings, and goes out: the picture is drawn anew for it, thirty times a second.
    const swings = this.chains.size === 0 ? 0 : still ? this.chains.size : Math.floor(timeMs / 33);
    const decay = this.decayAt(view.header.kind === 'session' ? program : 0, timeMs, still, layout.rule + 2);
    // Points in the air and the score they have just reached are drawn anew every frame.
    const moving = this.flyers.length > 0 || this.passed !== null || timeMs < this.hit.at + HIT_MS ? Math.floor(timeMs) : 0;
    // The swipe sign runs, or blinks, and the picture is not drawn anew for it: only its own part of it is (`signAgain`).
    const sign = view.sign ?? null;
    // A plaque that blinks is drawn anew each time it turns.
    const plaque = !still && (view.counters ?? []).some((counter) => counter.blink) ? Math.floor(timeMs / COUNTER_BLINK_MS) % 2 : 0;
    const signed = sign ? JSON.stringify(sign) : '';
    // Faces of the aim that are rising or leaving are drawn anew every frame.
    const aim = view.aim ?? null;
    const rising = aim && !still && this.aimMoves(aim, timeMs) ? Math.floor(timeMs) : 0;
    const state = [swings, JSON.stringify(view.header), JSON.stringify(view.seal), JSON.stringify(aim), rising, JSON.stringify(view.labels), JSON.stringify(view.note), JSON.stringify(view.counters ?? null), plaque, signed, JSON.stringify(view.tools), JSON.stringify(view.pad), JSON.stringify(view.stage), still, Math.floor(program), this.shown, blink, flashing, bumps, moving, JSON.stringify(decay), kit.width, kit.height, kit.palette.ink, kit.palette.bg].join('|');
    if (state === this.drawn) {
      const turn = this.signTurnAt(sign, timeMs, still);
      if (turn === this.signTurned) return;
      if (this.signKept) {
        this.signTurned = turn;
        this.signAgain(timeMs);
        return;
      }
      // A sign that lies on a button is drawn with it: the whole picture, as before.
    }
    this.drawn = state;
    this.signKept = null;

    this.zones = [];
    this.voice.begin();
    kit.begin();
    if (view.header.kind === 'session') {
      if (layout.wide) this.drawSessionWide(view.header, layout, timeMs, blink, program, decay);
      else this.drawSession(view.header, layout, timeMs, blink, program, decay);
    } else if (layout.wide) {
      this.drawLevelWide(view.header, layout, timeMs);
    } else {
      this.drawLevel(view.header, layout, timeMs);
    }
    this.drawPause(layout);
    // The readings slip: what is drawn so far is theirs, the rest of the picture stays whole.
    if (decay.tears.length > 0) kit.tear(decay.tears, 0, layout.wide ? layout.column : kit.width);
    const stage = this.toPicture(view.stage);
    if (view.seal) this.drawSeal(view.seal, layout, blink);
    if (aim) this.drawAim(aim, layout, timeMs, still);
    this.drawLabels(timeMs, still);
    this.drawFlyers(timeMs);
    // The stars of a pass keep under the readings and inside the window.
    if (this.passed) this.drawAward(this.passed, timeMs, still, layout.wide ? safe.top + 10 : layout.height + 6);
    // A step of the contact: the program says so over the board, for as long as its cell blinks.
    if (view.header.kind === 'session' && timeMs < this.stageFlash) {
      const text = `${program >= 1 ? HUD.found : HUD.link} ${digits(view.header.stage, 2)}/${digits(view.header.steps, 2)}`;
      this.flagged(text, Math.round(stage.x + (stage.w - kit.measure(text)) / 2), Math.round(stage.y + 6), blink === 0);
    }
    // A plaque over a heap of a level keeps inside what the edges of the screen leave of the window.
    const within: Box = { x: safe.left, y: safe.top, w: kit.width - safe.right - safe.left, h: kit.height - safe.bottom - safe.top };
    for (const counter of view.counters ?? []) this.drawCounter(counter, plaque === 0, within);
    if (sign) {
      // The sign keeps clear of the edges of the screen and of the readings.
      const left = layout.wide ? layout.column : safe.left;
      const top = layout.wide ? safe.top : layout.height;
      const tools = view.tools && !view.tools.retryOnly ? this.undoPlan(view.tools, stage, view.pad ? this.toPicture(view.pad.box) : null, layout.left).box : null;
      const plan = this.signPlan(sign, { x: left, y: top, w: kit.width - safe.right - left, h: kit.height - safe.bottom - top });
      // What is drawn after the sign lies over it: a sign that reaches a button is not drawn alone.
      const room = signBounds(plan);
      const covered = (tools !== null && boxesMeet(room, tools)) || (view.pad ? boxesMeet(room, this.toPicture(view.pad.box)) : false);
      if (!still && !covered) this.signKept = { plan, room, under: kit.grab(room) };
      paintSign(kit, plan, this.signLook(), timeMs, still);
    }
    this.signTurned = this.signTurnAt(sign, timeMs, still);
    if (view.tools) this.drawRestart(layout);
    if (view.tools) this.drawSound(layout, view.tools.muted);
    if (view.tools && !view.tools.retryOnly) this.drawUndo(view.tools, stage, blink, view.pad ? this.toPicture(view.pad.box) : null, layout.left);
    if (view.pad) this.drawPad(view.pad, blink);
    if (view.note) {
      const width = Math.min(view.stage.width - 24, 460);
      this.voice.say({
        text: view.note.text,
        box: { x: view.stage.x + (view.stage.width - width) / 2, y: view.stage.y, width, height: view.stage.height - 12 },
        size: NOTE_SIZE,
        anchor: 'bottom',
      });
    }
    kit.end();
    this.voice.end();
  }

  /** Keeps what runs from frame to frame: the number that counts up, what has just changed. */
  private follow(view: HudView, timeMs: number): void {
    const { header } = view;
    if (header.kind === 'session') {
      // Points on their way are not in the score yet: it takes them when they reach it.
      let coming = 0;
      this.flyers = this.flyers.filter((flyer) => {
        if (!view.reducedMotion && timeMs < flyer.born + POP_MS + FLY_MS) {
          coming += flyer.points;
          return true;
        }
        this.hit = { at: timeMs, value: flyer.value, tier: flyer.tier };
        this.actions.onPoints?.(flyer.points, flyer.tier);
        return false;
      });
      const gap = header.score - coming - this.shown;
      // A fifth of the way each frame, and never slower than one: the number runs up to the score.
      if (view.reducedMotion || header.score < this.shown) this.shown = header.score;
      else if (gap > 0) {
        this.shown += Math.max(1, Math.ceil(gap * 0.2));
        this.actions.onCount?.();
      }
      if (header.level !== null && header.level > this.lastLevel) this.levelFlash = timeMs + FLASH_MS;
      if (header.level !== null) this.lastLevel = header.level;
      if (header.stage > this.lastStage) this.stageFlash = timeMs + FLASH_MS;
      this.lastStage = header.stage;
    } else if (header.kind === 'level') {
      this.flyers = [];
      // The points of a star that is still on its way are not in the score yet.
      const { passed } = this;
      let coming = 0;
      if (passed) {
        const age = timeMs - passed.born;
        const leave = starsLeave();
        // A star is heard as it lights up; with motion kept low they all stand at once, and one is heard.
        const lit = view.reducedMotion ? passed.stars : clamp(Math.floor(age / STAR_STEP_MS) + 1, 0, passed.stars);
        for (; passed.lit < lit; passed.lit++) if (!view.reducedMotion || passed.lit === passed.stars - 1) this.actions.onStar?.(passed.lit);
        const landed = view.reducedMotion ? passed.fresh : clamp(Math.floor((age - leave - STAR_FLY_MS) / STAR_FLY_STEP_MS) + 1, 0, passed.fresh);
        for (; passed.landed < landed; passed.landed++) {
          this.hit = { at: timeMs, value: passed.value, tier: 1 };
          this.actions.onPoints?.(passed.points, 1);
        }
        coming = (passed.fresh - passed.landed) * passed.points;
        const last = leave + Math.max(LABEL_OUT_MS, passed.fresh > 0 ? (passed.fresh - 1) * STAR_FLY_STEP_MS + STAR_FLY_MS : 0);
        if (age >= last) this.passed = null;
      }
      const due = header.score - coming;
      const gap = due - this.shown;
      if (this.fresh || view.reducedMotion || gap < 0) this.shown = due;
      else if (gap > 0) {
        this.shown += Math.max(1, Math.ceil(gap * 0.2));
        this.actions.onCount?.();
      }
      this.fresh = false;
    } else {
      this.shown = 0;
      this.flyers = [];
      this.passed = null;
    }
    const seen = new Set<number>();
    for (const label of view.labels) {
      seen.add(label.id);
      const kept = this.chains.get(label.id);
      // A chain of a level stands until the player moves: what was said over it has gone out, and is said once.
      if (!kept && this.said.get(label.id) === label.chain) continue;
      // A chain that has grown: its multiplier is shown anew, and swings.
      if (!kept || kept.chain !== label.chain) this.chains.set(label.id, pushed(kept, label, timeMs));
      else kept.at = label.at;
    }
    for (const [id, kept] of this.chains) {
      // A chain that is over: its multiplier goes out where it stood, and is not switched off.
      if (!seen.has(id)) kept.until = Math.min(kept.until, timeMs + LABEL_OUT_MS);
      if (timeMs >= kept.until) {
        this.chains.delete(id);
        if (seen.has(id)) this.said.set(id, kept.chain);
      }
    }
    for (const id of this.said.keys()) if (!seen.has(id)) this.said.delete(id);
  }

  private toPicture(rect: Rect): Box {
    const zoom = this.kit.zoom;
    return { x: rect.x / zoom, y: rect.y / zoom, w: rect.width / zoom, h: rect.height / zoom };
  }

  /** A number with its leading zeros stepped back: the counter of an instrument. */
  private counter(value: number, places: number, x: number, y: number, scale: number, align: 'left' | 'right', strong: boolean): void {
    const { kit } = this;
    const { ink, dim, faint } = kit.palette;
    const text = digits(value, places);
    const zeros = Math.min(text.length - 1, text.length - String(Math.max(0, Math.round(value))).length);
    const left = align === 'right' ? x - kit.measure(text, scale) : x;
    const after = kit.text(text.slice(0, zeros), left, y, faint, { scale });
    kit.text(text.slice(zeros), after, y, strong ? ink : dim, { scale, bold: strong });
  }

  /**
   * The score: the large counter, digit by digit. Points that have just reached it light it in
   * their colour and lift it for a moment. As the contact grows a digit may be in a foreign
   * hand, and one may come off and fall.
   */
  private score(x: number, y: number, timeMs: number, decay: Decay): void {
    const { kit } = this;
    const { ink, faint, dim } = kit.palette;
    const scale = 2;
    const text = digits(this.shown, 6);
    const zeros = Math.min(text.length - 1, text.length - String(Math.max(0, Math.round(this.shown))).length);
    const since = timeMs - this.hit.at;
    const lit = since >= 0 && since < HIT_MS;
    const colour = lit && this.hit.value > 0 ? this.beatColour(this.hit.value) : ink;
    const lift = lit && since < HIT_MS / 2 ? -1 - Math.min(2, this.hit.tier) : 0;
    this.scoreAt = { x: x + kit.measure(text, scale) / 2, y: y + CELL_H };
    let at = x;
    for (let i = 0; i < text.length; i++) {
      const sign = text[i];
      const wide = kit.measure(sign, scale);
      const strong = i >= zeros;
      if (decay.falling?.index === i) {
        // It has come off: it falls out of the readings, and its place stays empty.
        const fall = decay.falling.phase * decay.falling.phase * 150;
        kit.text(sign, at, y + fall, dim, { scale });
      } else if (decay.foreign === i) {
        kit.foreign(sign, at + 1, y + lift, CELL_H * scale, FOREIGN_INK);
      } else {
        kit.text(sign, at, y + (strong ? lift : 0), strong ? colour : faint, { scale, bold: strong });
      }
      at += wide;
    }
  }

  /** The light of a channel, as its points and its multiplier have it. */
  private beatColour(value: number): string {
    const { palette } = this.kit;
    return value === 1 ? palette.signal : mixHex(palette.channels[value - 1], '#ffffff', 0.5);
  }

  /** What the contact does to the readings at this moment; nothing before its second step. */
  private decayAt(program: number, timeMs: number, still: boolean, band: number): Decay {
    if (still || program <= 1) return WHOLE;
    const tears: Decay['tears'] = [];
    const slot = Math.floor(timeMs / TEAR_SLOT_MS);
    const deep = clamp(program - 1, 0, 3);
    if (hash(slot) < 0.1 * Math.min(1, deep) + 0.06 * Math.max(0, deep - 1)) {
      const rows = 1 + Math.floor(hash(slot + 0.5) * (1 + deep));
      for (let i = 0; i < rows; i++) {
        const dx = Math.round((hash(slot * 7 + i) - 0.5) * 2 * (3 + 3 * deep));
        if (dx !== 0) tears.push({ y: Math.floor(hash(slot * 3 + i) * band), h: 1 + Math.floor(hash(slot * 5 + i) * 3), dx });
      }
    }
    let foreign = -1;
    if (program > 2) {
      const s = Math.floor(timeMs / FOREIGN_SLOT_MS);
      if (hash(s + 77.7) < 0.14 + 0.1 * clamp(program - 2, 0, 2)) foreign = Math.floor(hash(s + 13.3) * 6);
    }
    const drift = clamp(program - 3, 0, 1);
    let falling: Decay['falling'] = null;
    if (drift > 0) {
      const turn = Math.floor(timeMs / FALL_EVERY_MS);
      const phase = (timeMs - turn * FALL_EVERY_MS) / FALL_MS;
      if (phase < 1 && hash(turn + 5.5) < 0.75 * drift) falling = { index: Math.floor(hash(turn + 9.1) * 6), phase: Math.round(phase * 30) / 30 };
    }
    if (tears.length === 0 && foreign < 0 && !falling && drift === 0) return WHOLE;
    return { tears, foreign, falling, drift };
  }

  /** How far a part of the readings has slid from its place, once they come apart. */
  private adrift(part: number, drift: number): number {
    return drift > 0 ? Math.round((hash(part * 31.7) - 0.5) * 8 * drift) : 0;
  }

  private drawFlyers(timeMs: number): void {
    const { kit } = this;
    for (const flyer of this.flyers) {
      const age = timeMs - flyer.born;
      const colour = this.beatColour(flyer.value);
      const text = `+${flyer.points}`;
      const big = flyer.tier >= 2 ? 2 : 1;
      if (age < POP_MS) {
        // It jumps out large and settles, rising a little.
        const scale = age < 90 ? big + 1 : big;
        const rise = 10 * (1 - (1 - age / POP_MS) ** 2);
        kit.edged(text, flyer.from.x, flyer.from.y + 3 - rise - (scale - big) * CELL_H * 0.5, colour, { scale, align: 'center', bold: true });
        continue;
      }
      const start = { x: flyer.from.x, y: flyer.from.y - 7 };
      const along = (p: number): Point => {
        const t = clamp(p, 0, 1);
        const eased = t * t;
        // A shallow arc: it leaves sideways and comes in from below.
        return { x: start.x + (this.scoreAt.x - start.x) * (1 - (1 - t) ** 2), y: start.y + (this.scoreAt.y - start.y) * eased };
      };
      const p = (age - POP_MS) / FLY_MS;
      for (let i = 4; i >= 1; i--) {
        const tail = along(p - i * 0.06);
        const side = 5 - i;
        kit.rect(Math.round(tail.x) - side / 2, Math.round(tail.y) + (CELL_H * big) / 2 - side / 2, side, side, colour);
      }
      // A large result stays large until it is nearly there.
      const head = along(p);
      const scale = p < 0.6 ? big : 1;
      kit.edged(text, head.x, head.y, colour, { scale, align: 'center', bold: true });
    }
  }

  private drawSession(session: HudSession, layout: HudLayout, timeMs: number, blink: number, program: number, decay: Decay): void {
    const { kit } = this;
    const { ink, dim, faint } = kit.palette;
    const { left, end, mid, rowA, rowB, rowC, big, tight } = layout;
    const { drift } = decay;

    kit.text(HUD.score, left + this.adrift(1, drift), rowA, dim);
    this.score(left, big, timeMs, decay);

    // The record so far; it is the session's own from the moment the session passes it.
    const record = session.score > session.best;
    const flagged = (text: string, x: number, y: number, on: boolean): void => this.flagged(text, x, y, on);

    // The middle: what the session is, and the time a live session has left; its last ten seconds blink.
    const clock = clockText(session.clock);
    let covered = false;
    if (session.danger !== null) {
      // The board is full. Its own rhythm, so it never reads as decoration.
      const text = `${HUD.full}${digits(session.danger, 2)}`;
      flagged(text, mid, rowA, blink === 0);
      covered = mid + kit.measure(text) > end - kit.measure(HUD.best) - 4;
    } else if (clock !== null && tight) {
      flagged(clock, mid, rowA, session.clock! <= 10 && blink === 0);
    } else {
      const tag = `${HUD.level} ${digits(session.level, 2)}`;
      flagged(tag, mid, rowA, timeMs < this.levelFlash && blink === 0);
      if (clock !== null) flagged(clock, mid, rowB, session.clock! <= 10 && blink === 0);
    }

    if (!covered) kit.text(HUD.best, end + this.adrift(2, drift), rowA, dim, { align: 'right' });
    this.counter(Math.max(session.best, session.score), 6, end, rowB, 1, 'right', record);

    // The link: a cell for every step the contact can take, lit as far as it has gone, and
    // the score of the next step. What does not fit beside the large number is left out.
    // Once the program has found a pattern on the link, that is what it reads.
    const pitch = session.steps > 10 ? 4 : 7;
    const cells = session.steps * pitch;
    const next = session.next === null ? '' : digits(session.next, 4);
    let label: string = program >= 1 ? HUD.found : HUD.link;
    let tail = next;
    const width = (): number => (label ? kit.measure(label) + 4 : 0) + cells + (tail ? 4 + kit.measure(tail) : 0);
    if (end - width() < mid - 4) tail = '';
    if (end - width() < mid - 4) label = '';
    let at = end - width();
    if (label) {
      const fresh = timeMs < this.stageFlash;
      if (fresh) this.flagged(label, at + this.adrift(3, drift), rowC, blink === 0);
      else kit.text(label, at + this.adrift(3, drift), rowC, program >= 1 ? ink : dim);
      at += kit.measure(label) + 4;
    }
    for (let i = 0; i < session.steps; i++) {
      const cell: Box = { x: at + i * pitch, y: rowC + 4 + this.adrift(10 + i, drift * 0.6), w: pitch - 2, h: 9 };
      const fresh = i === session.stage - 1 && timeMs < this.stageFlash;
      if (i < session.stage && !(fresh && blink === 0)) kit.box(cell, ink);
      else kit.frame(cell, faint);
    }
    if (tail) kit.text(tail, at + cells + 4, rowC, dim);
  }

  /** A reading that calls for the eye: filled while `on`, plain otherwise. */
  private flagged(text: string, x: number, y: number, on: boolean): void {
    const { kit } = this;
    const { bg, ink } = kit.palette;
    if (on) {
      kit.rect(x - 2, y, kit.measure(text) + 4, CELL_H, ink);
      kit.text(text, x, y, bg, { bold: true });
    } else {
      kit.text(text, x, y, ink);
    }
  }

  /** The readings of a session as a column: one to a line, as wide as the large number. */
  private drawSessionWide(session: HudSession, layout: HudLayout, timeMs: number, blink: number, program: number, decay: Decay): void {
    const { kit } = this;
    const { ink, dim, faint } = kit.palette;
    const { left, right, lines } = layout;
    const { drift } = decay;

    kit.text(HUD.score, left + this.adrift(1, drift), lines.label, dim);
    this.score(left, lines.big, timeMs, decay);

    if (session.danger !== null) {
      // The board is full. Its own rhythm, so it never reads as decoration.
      this.flagged(`${HUD.full}${digits(session.danger, 2)}`, left, lines.tag, blink === 0);
    } else {
      const tag = `${HUD.level} ${digits(session.level, 2)}`;
      this.flagged(tag, left, lines.tag, timeMs < this.levelFlash && blink === 0);
      const clock = clockText(session.clock);
      if (clock !== null) this.flagged(clock, right - kit.measure(clock), lines.tag, session.clock! <= 10 && blink === 0);
    }

    const record = session.score > session.best;
    kit.text(HUD.best, left + this.adrift(2, drift), lines.best, dim);
    this.counter(Math.max(session.best, session.score), 6, right, lines.best, 1, 'right', record);

    // The link: the score of its next step beside its name, and under them a cell for every
    // step the contact can take, lit as far as it has gone. Once the program has found a
    // pattern on the link, that is what it reads.
    const label = program >= 1 ? HUD.found : HUD.link;
    if (timeMs < this.stageFlash) this.flagged(label, left + this.adrift(3, drift), lines.link, blink === 0);
    else kit.text(label, left + this.adrift(3, drift), lines.link, program >= 1 ? ink : dim);
    if (session.next !== null) kit.text(digits(session.next, 4), right, lines.link, dim, { align: 'right' });
    const pitch = Math.max(4, Math.floor((right - left + 2) / Math.max(1, session.steps)));
    for (let i = 0; i < session.steps; i++) {
      const cell: Box = { x: left + i * pitch, y: lines.cells + this.adrift(10 + i, drift * 0.6), w: pitch - 2, h: 9 };
      const fresh = i === session.stage - 1 && timeMs < this.stageFlash;
      if (i < session.stage && !(fresh && blink === 0)) kit.box(cell, ink);
      else kit.frame(cell, faint);
    }
  }

  /**
   * The two small readings of a level, one under the other, their numbers ending at `right`: the
   * moves made on this try, and the fewest the board is cleared in. `left` puts the names at the
   * left edge of a column; without it they stand close before the numbers.
   */
  private levelReads(level: HudLevel, right: number, rows: readonly [number, number], left?: number): void {
    const { kit } = this;
    const { dim, faint } = kit.palette;
    const names = right - kit.measure('000') - CELL_W;
    const name = (text: string, y: number): void => void kit.text(text, left ?? names - kit.measure(text), y, dim);
    // Under the buttons and quieter than the score: names and numbers in the one dim tone.
    name(READS.current, rows[0]);
    kit.text(digits(level.made, 3), right, rows[0], dim, { align: 'right' });
    name(READS.best, rows[1]);
    if (level.best === null) kit.text('--', right, rows[1], faint, { align: 'right' });
    else kit.text(digits(level.best, 3), right, rows[1], dim, { align: 'right' });
  }

  /**
   * The stars of a pass over the board: three, lit one after another, each with a burst of its
   * light; then the new ones fly to the score and the rest go out. A star that is held gives
   * light and breathes; one that is not is its outline, dull and smeared (`star.ts`).
   */
  private drawAward(passed: NonNullable<GameHud['passed']>, timeMs: number, still: boolean, top: number): void {
    const { kit } = this;
    const colours = kit.palette.star;
    const age = timeMs - passed.born;
    const leave = starsLeave();
    const { radius, gap, wide } = starRow(kit.width);
    const side = radius * 2 + 1;
    const step = side + gap;
    // Their lower points stand where the foot of the row is asked for: a larger star goes up from there, not down on the board.
    const y = Math.max(top + radius, Math.round(passed.at.y + STAR_FOOT - radius));
    const x0 = Math.round(clamp(passed.at.x - wide / 2, 4, kit.width - wide - 4)) + radius;
    for (let i = 0; i < 3; i++) {
      const cx = x0 + i * step;
      const since = age - i * STAR_STEP_MS;
      const lit = i < passed.stars && (still || since >= 0);
      const glow = still ? { flare: 0, shimmer: 0 } : { flare: clamp(1 - since / STAR_FLARE_MS, 0, 1), shimmer: Math.sin((timeMs / STAR_BREATH_MS) * Math.PI * 2 + i * 2.1) };
      const stand = (): void => {
        if (lit) paintStar(kit, cx, y, radius, colours, glow);
        else paintStarGhost(kit, cx, y, radius, colours);
      };
      // The stars the player did not hold are the last of those that are lit: they are the ones that fly.
      const flies = i < passed.stars && i >= passed.stars - passed.fresh;
      const sets = leave + (i - (passed.stars - passed.fresh)) * STAR_FLY_STEP_MS;
      if (age < leave || (flies && !still && age < sets)) {
        stand();
        continue;
      }
      if (!flies || still) {
        // It goes out where it stood, there and not there, as the tube puts things out.
        const left = leave + LABEL_OUT_MS - age;
        if (left <= 0 || (!still && Math.floor(left / 55) % 2 === 1)) continue;
        stand();
        continue;
      }
      const p = (age - sets) / STAR_FLY_MS;
      if (p >= 1) continue;
      const along = (at: number): Point => {
        const t = clamp(at, 0, 1);
        // A shallow arc, as the points of a group fly: it leaves sideways and comes in from below.
        return { x: cx + (this.scoreAt.x - cx) * (1 - (1 - t) ** 2), y: y + (this.scoreAt.y - y) * t * t };
      };
      // Behind it, the light it leaves: paler the further back.
      for (let tail = 5; tail >= 1; tail--) {
        const at = along(p - tail * 0.05);
        kit.halo(Math.round(at.x) + 0.5, Math.round(at.y), Math.max(1.5, (radius * (6 - tail)) / 12), colours.light, 0.1 + 0.05 * (5 - tail));
      }
      const head = along(p);
      paintStar(kit, head.x, head.y, Math.round(radius - (radius - STAR_LAND) * clamp(p, 0, 1)), colours, { flare: 0, shimmer: 1 });
    }
  }

  /**
   * A line of the goal of a level, its count ending at `right`: the face it asks for as a
   * picture of that face, anything else by its name. `left` puts the name at the left edge
   * of a column; without it the name stands close before the count.
   */
  private goalLine(line: GoalLine, right: number, y: number, left?: number): void {
    const { kit } = this;
    const { ink, dim } = kit.palette;
    const values = this.look.board;
    const count = goalProgress(line);
    const countStart = right - kit.measure(count);
    kit.text(count, countStart, y, ink);
    if (line.what === 'face') {
      const side = 12;
      kit.face(line.value, left ?? countStart - 4 - side, y + 2, side, faceColour(line.value, kit.palette, values), pipColour(line.value, kit.palette, values));
    } else {
      const name = goalLabel(line);
      kit.text(name, left ?? countStart - 4 - kit.measure(name), y, dim);
    }
  }

  /** The readings of a level as a column: the score, the number of the level, its two small readings, and a line of its goal where it has one. */
  private drawLevelWide(level: HudLevel, layout: HudLayout, timeMs: number): void {
    const { kit } = this;
    const { ink, dim } = kit.palette;
    const { left, right, lines } = layout;
    kit.text(HUD.score, left, lines.label, dim);
    this.score(left, lines.big, timeMs, WHOLE);
    if (level.number !== null) kit.text(`${HUD.level} ${digits(level.number, 2)}`, left, lines.tag, ink);
    this.levelReads(level, right, layout.moves, left);
    if (level.goal.length > 0) this.goalLine(level.goal[0], right, lines.cells, left);
  }

  private drawLevel(level: HudLevel, layout: HudLayout, timeMs: number): void {
    const { kit } = this;
    const { ink, dim } = kit.palette;
    const { left, end, rowA, big } = layout;
    kit.text(HUD.score, left, rowA, dim);
    this.score(left, big, timeMs, WHOLE);
    if (level.number !== null) kit.text(`${HUD.level} ${digits(level.number, 2)}`, layout.tag.x, layout.tag.y, ink);
    // A line of the goal, where there is one, stands before the buttons; the two small readings under them, one under the other.
    if (level.goal.length > 0) this.goalLine(level.goal[0], end, rowA);
    this.levelReads(level, layout.right, layout.moves);
  }

  private drawPause(layout: HudLayout): void {
    const { kit } = this;
    const { ink, faint } = kit.palette;
    const box = layout.pause;
    const pressed = this.held?.zone.id === 'pause';
    if (pressed) kit.box(box, ink);
    else kit.frame(box, faint);
    const tall = Math.max(8, Math.round(box.h / 3));
    const wide = Math.max(2, Math.round(box.w / 10));
    const y = box.y + Math.round((box.h - tall) / 2);
    const colour = pressed ? kit.palette.bg : ink;
    kit.rect(box.x + Math.round(box.w / 2) - wide * 2, y, wide, tall, colour);
    kit.rect(box.x + Math.round(box.w / 2) + wide, y, wide, tall, colour);
    this.zones.push({ id: 'pause', rect: kit.toWindow(box), action: () => this.actions.onPause() });
  }

  /** The button that starts a level over: beside the pause, of its size and drawn as it is, with the arrow that goes round in place of the two bars. */
  private drawRestart(layout: HudLayout): void {
    const { kit } = this;
    const { ink, faint } = kit.palette;
    const box = layout.restart;
    if (!box) return;
    const pressed = this.held?.zone.id === 'retry';
    if (pressed) kit.box(box, ink);
    else kit.frame(box, faint);
    const dot = restartDot(box.w);
    const colour = pressed ? kit.palette.bg : ink;
    const ix = box.x + Math.round((box.w - TOOL_ICON * dot) / 2);
    const iy = box.y + Math.round((box.h - TOOL_ICON * dot) / 2);
    ICON_RETRY.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#') kit.rect(ix + c * dot, iy + r * dot, dot, dot, colour);
    });
    this.zones.push({ id: 'retry', rect: kit.toWindow(box), action: () => this.actions.onRestart() });
  }

  /**
   * The button of the sound: left of the one that starts over, of its size and drawn as it is,
   * with a loudspeaker in it. With the sound off the loudspeaker is dim and a cross lies over it.
   */
  private drawSound(layout: HudLayout, muted: boolean): void {
    const { kit } = this;
    const { ink, dim, faint, bg } = kit.palette;
    const box = layout.sound;
    if (!box) return;
    const pressed = this.held?.zone.id === 'sound';
    if (pressed) kit.box(box, ink);
    else kit.frame(box, faint);
    const dot = restartDot(box.w);
    const ix = box.x + Math.round((box.w - TOOL_ICON * dot) / 2);
    const iy = box.y + Math.round((box.h - TOOL_ICON * dot) / 2);
    const paint = (icon: readonly string[], colour: string): void =>
      icon.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) if (row[c] === '#') kit.rect(ix + c * dot, iy + r * dot, dot, dot, colour);
      });
    if (muted) {
      paint(ICON_MUTE, pressed ? faint : dim);
      paint(ICON_CROSS, pressed ? bg : ink);
    } else {
      paint(ICON_SOUND, pressed ? bg : ink);
    }
    this.zones.push({ id: 'sound', rect: kit.toWindow(box), action: () => this.actions.onSound() });
  }

  /**
   * The die under the player, unfolded and laid in the plane of the board, so that a side
   * points where a step that way leads. The same net the menu of the program is built on.
   */
  private drawSeal(seal: HudSeal, layout: HudLayout, blink: number): void {
    const { kit, net } = this;
    const palette = kit.palette;
    const side = this.netSide();
    const bounds = netBounds({ x: 0, y: 0 }, side, seal.axes);
    const state = [JSON.stringify(seal), side, blink, palette.ink, palette.bg, palette.channels.join()].join('|');
    if (state !== this.netDrawn) {
      this.netDrawn = state;
      this.paintNet(seal, side, bounds, palette, blink);
    }
    kit.image(net, layout.net.x, layout.net.y);
  }

  /** The side of a face of the seal, and of a face of the aim that stands in its place, in dots. */
  private netSide(): number {
    const { kit } = this;
    return Math.min(22, Math.max(13, Math.round(Math.min(kit.width, kit.height) * 0.075)));
  }

  /** When a face of an aim begins to rise: one after another from the start of the level, or at once where it comes back. */
  private aimRose(aim: HudAim, index: number): number {
    const { kit } = this;
    return aim.faces[index].back ?? aim.since + kit.number('aimDelayMs') + index * kit.number('aimStaggerMs');
  }

  /** Whether a face of an aim is rising, leaving, or making room at this moment. */
  private aimMoves(aim: HudAim, timeMs: number): boolean {
    const { kit } = this;
    const leave = kit.number('aimFlashMs') + kit.number('aimSinkMs');
    const slide = kit.number('aimSlideMs');
    return aim.faces.some((face, index) =>
      face.left !== null ? timeMs < face.left + leave + slide : timeMs < this.aimRose(aim, index) + Math.max(kit.number('aimRiseMs'), face.back !== null ? slide : 0),
    );
  }

  /**
   * Where in the row a face of an aim stands, in places: one for every face before it that is
   * there. A face that has gone gives up its place, and the faces after it slide over into it
   * once it is out of sight; one that comes back takes its place again, and they slide back.
   */
  private aimSlot(aim: HudAim, index: number, timeMs: number, still: boolean): number {
    const { kit } = this;
    const leave = kit.number('aimFlashMs') + kit.number('aimSinkMs');
    const slide = kit.number('aimSlideMs');
    const eased = (since: number): number => {
      const t = slide > 0 ? clamp(since / slide, 0, 1) : since >= 0 ? 1 : 0;
      return t * t * (3 - 2 * t);
    };
    let slot = 0;
    for (const face of aim.faces.slice(0, index)) {
      if (face.left !== null) slot += still ? 0 : 1 - eased(timeMs - face.left - leave);
      else if (face.back !== null) slot += still ? 1 : eased(timeMs - face.back);
      else slot += 1;
    }
    return slot;
  }

  /**
   * The faces a level asks for, in a row where the seal lay, each in the colours it has on the die.
   * At the start of a level they rise into sight as if from deep under the board seen from above:
   * small and lost in the dark far down, full size and full colour at the top, one after another.
   * A face that is done flares up for a moment, and then goes back down the way it came, as the
   * dice of its combo go; the faces after it then slide over into its place. With reduced motion
   * they stand there at once, and a face that is done is gone at once.
   */
  private drawAim(aim: HudAim, layout: HudLayout, timeMs: number, still: boolean): void {
    const { kit } = this;
    const { palette } = kit;
    const values = this.look.board;
    const side = this.netSide();
    const gap = kit.number('aimGap');
    const from = kit.number('aimFrom');
    const flashMs = kit.number('aimFlashMs');
    const sinkMs = kit.number('aimSinkMs');
    aim.faces.forEach(({ value, left }, index) => {
      // How far up the face is, from 0 deep down to 1 at the top, and how much of the flare it has.
      let up: number;
      let flare = 0;
      if (left !== null) {
        const gone = timeMs - left;
        if (still || gone >= flashMs + sinkMs) return;
        if (gone < flashMs) {
          up = 1;
          flare = Math.sin((gone / flashMs) * (Math.PI / 2));
        } else {
          const t = (gone - flashMs) / sinkMs;
          up = 1 - t ** 3;
          flare = 1 - t;
        }
      } else {
        const t = still ? 1 : clamp((timeMs - this.aimRose(aim, index)) / kit.number('aimRiseMs'), 0, 1);
        if (t <= 0) return;
        up = 1 - (1 - t) ** 3;
      }
      const size = Math.max(1, Math.round(side * (from + (1 - from) * up)));
      const cx = layout.net.x + this.aimSlot(aim, index, timeMs, still) * (side + gap) + side / 2;
      const cy = layout.net.y + side / 2;
      const bright = kit.number('aimFlash') * flare;
      const face = mixHex(mixHex(palette.bg, faceColour(value, palette, values), up), palette.ink, bright);
      const pip = mixHex(mixHex(palette.bg, pipColour(value, palette, values), up), palette.ink, bright * 0.5);
      kit.face(value, Math.round(cx - size / 2), Math.round(cy - size / 2), size, face, pip);
    });
  }

  private paintNet(seal: HudSeal, side: number, bounds: Box, palette: Palette, blink: number): void {
    const { net } = this;
    net.width = bounds.w;
    net.height = bounds.h;
    const ctx = net.getContext('2d')!;
    const image = ctx.createImageData(bounds.w, bounds.h);
    const { data } = image;
    const values = this.look.board;
    const bg = rgb(palette.bg);
    const mix = (hex: string, amount: number): [number, number, number] => rgb(mixHex(hex, palette.bg, amount));
    const centre = { x: -bounds.x, y: -bounds.y };

    for (let y = 0; y < bounds.h; y++) {
      for (let x = 0; x < bounds.w; x++) {
        const hit = netCellAt(x + 0.5, y + 0.5, centre, side, seal.axes);
        if (!hit) continue;
        const dir = hit.cell === 'top' ? null : hit.cell;
        const edge = Math.min(hit.u, 1 - hit.u, hit.v, 1 - hit.v);
        const marked = dir !== null && (dir === seal.marked || (seal.commits?.includes(dir) ?? false));
        const lit = dir !== null && (dir === seal.active || ((dir === seal.pulse || marked) && blink === 1));
        const outline = edge < (marked ? NET_EDGE * 2 : NET_EDGE);
        let colour: [number, number, number] | null = null;
        if (!seal.faces) {
          // On the floor there is no die: the net stays as an outline.
          if (outline && (x + y) % 2 === 0) colour = rgb(lit ? palette.ink : palette.faint);
        } else if (outline) {
          colour = rgb(lit ? palette.ink : palette.dim);
        } else {
          const face = seal.faces[hit.cell];
          const fade = dir !== null && seal.blocked[dir] ? 0.6 : 0;
          const at = turned(hit.u, hit.v, face.turns);
          const column = Math.min(2, Math.floor(at.u * 3));
          const row = Math.min(2, Math.floor(at.v * 3));
          const reach = face.value === 1 ? NET_PIP_ONE : NET_PIP;
          const cx = face.value === 1 ? 0.5 : 0.22 + 0.28 * column;
          const cy = face.value === 1 ? 0.5 : 0.22 + 0.28 * row;
          const pip = FACE_PIPS[face.value].includes(row * 3 + column) && Math.abs(at.u - cx) < reach && Math.abs(at.v - cy) < reach;
          const hex = pip ? pipColour(face.value, palette, values) : faceColour(face.value, palette, values);
          // A die on its way down is not all here: every other dot of it.
          if (hit.cell === 'top' && seal.sinking && (x + y) % 2 === 0) colour = bg;
          else colour = mix(hex, fade);
        }
        if (!colour) continue;
        const i = (y * bounds.w + x) * 4;
        data[i] = colour[0];
        data[i + 1] = colour[1];
        data[i + 2] = colour[2];
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  /**
   * The multipliers of the chains: each is pushed when its chain grows, the harder the longer
   * the chain is, swings about its middle and hops, comes to rest, and goes out a few seconds later.
   */
  private drawLabels(timeMs: number, still: boolean): void {
    const { kit } = this;
    const zoom = kit.zoom;
    for (const label of this.chains.values()) {
      const left = label.until - timeMs;
      if (left <= 0) continue;
      // Going out: there and not there a few times.
      if (!still && left < LABEL_OUT_MS && Math.floor(left / 55) % 2 === 1) continue;
      const since = timeMs - label.joined;
      // A long chain is written larger; every join makes it jump.
      const base = label.chain >= 4 ? 3 : 2;
      const asked = since < BUMP_MS ? base + 1 : base;
      // A word is longer than a multiplier: it is written as large as the picture has room for, and stands inside it.
      const wide = kit.measure(label.text);
      const scale = label.praise ? Math.max(1, Math.min(asked, Math.floor((kit.width - LABEL_SIDE * 2) / Math.max(1, wide)))) : asked;
      const half = (wide * scale) / 2 + LABEL_SIDE;
      const x = label.praise && half * 2 <= kit.width ? Math.min(kit.width - half, Math.max(half, label.at.x / zoom)) : label.at.x / zoom;
      const angle = still ? 0 : swingAt(label.swing, timeMs).angle;
      const hop = still ? 0 : label.hop.high * Math.exp(-since / HOPS_DIE_MS) * Math.abs(Math.sin((since / label.hop.beat) * Math.PI));
      kit.turned(label.text, x, label.at.y / zoom - (CELL_H * scale) / 2 - hop, angle, this.beatColour(label.value), { scale, bold: true });
    }
  }

  /**
   * A small plate over the board, its foot at `at`: filled when what it says is complete. Given
   * `within`, a plate that would run past a side of it is moved in from that side, whole.
   */
  private plate(at: Point, width: number, full: boolean, within?: Box): Box {
    const { kit } = this;
    const { bg, ink } = kit.palette;
    const zoom = kit.zoom;
    const middle = at.x / zoom;
    const plate: Box = { x: within ? counterLeft(middle, width, within, COUNTER_PAD) : Math.round(middle - width / 2), y: Math.round(at.y / zoom - CELL_H - 4), w: width, h: CELL_H + 2 };
    kit.box(plate, full ? ink : bg);
    kit.frame(plate, ink);
    return plate;
  }

  /** A die's face on a plaque, flat; `lit` false gives it as dim as the thin lines are. */
  private plateFace(value: number, x: number, y: number, lit = true): void {
    const { kit } = this;
    const values = this.look.board;
    const face = faceColour(value, kit.palette, values);
    const pip = pipColour(value, kit.palette, values);
    if (lit) kit.face(value, x, y, COUNTER_CUBE, face, pip);
    else kit.face(value, x, y, COUNTER_CUBE, mixHex(kit.palette.bg, face, kit.number('faint')), mixHex(kit.palette.bg, pip, kit.number('faint')));
  }

  /**
   * Over a group: a cube of its face for each die it takes, the ones it has lit and the rest dim.
   * A plaque that blinks goes dim all through when `lit` is false. Given `within`, the plaque of
   * a heap at the edge of the window is brought in from the edge. This is a first version; the
   * owner adjusts its look.
   */
  private drawCounter(counter: HudCounter, lit: boolean, within?: Box): void {
    const { value, have, need, at } = counter;
    const plate = this.plate(at, counterWidth(need), have >= need, within);
    for (let i = 0; i < need; i++) this.plateFace(value, plate.x + 3 + i * (COUNTER_CUBE + COUNTER_GAP), plate.y + 3, lit && i < have);
  }

  /**
   * Where the swipe sign stands: inside the part of the picture it may stand in, its trail beside
   * the die of the figure and parallel to the
   * board. The star runs along that trail and the key stands in the middle of it (`paintSign`).
   */
  private signPlan(sign: HudSign, inside: Box): SignPlan {
    const zoom = this.kit.zoom;
    const n = (name: string): number => Number(this.look.board[name] ?? 0);
    const rays = Math.max(1, Math.round(n('signStar')));
    const body: Box = { x: sign.body.x / zoom, y: sign.body.y / zoom, w: sign.body.w / zoom, h: sign.body.h / zoom };
    // Beside the die: clear of it by the rays of the star, or by half the key.
    const reach = sign.mode === 'key' ? SIGN_KEY / 2 : rays;
    const run = signBeside(body, { x: sign.step.x / zoom, y: sign.step.y / zoom }, n('signLength'), SIGN_GAP + reach);
    const { trail } = run;
    const place = (start: Point, way: Point): Point => signPlace(start, way, inside, reach + SIGN_PAD);
    const from = place(run.from, trail);
    // The plain stroke: as long as the one along the board, beside the die as that one is.
    let plain: SignPlan['plain'] = null;
    if (sign.mode === 'dot' && sign.plain) {
      const cell = Math.hypot(sign.step.x, sign.step.y) / zoom;
      const straight = signBeside(body, { x: sign.plain.x * cell, y: sign.plain.y * cell }, n('signLength'), SIGN_GAP + reach);
      plain = { from: place(straight.from, straight.trail), trail: straight.trail };
    }
    return { mode: sign.mode, dir: sign.dir, from, trail, rays, plain };
  }

  /** The numbers of the look the sign is drawn with, as they are now: the owner turns them while the game runs. */
  private signLook(): SignLook {
    const n = (name: string): number => Number(this.look.board[name] ?? 0);
    return { runMs: n('signRunMs'), restMs: n('signRestMs'), trail: n('signTrail'), glow: n('signGlow') };
  }

  /** Which picture of the sign belongs to this moment (`signTurn`): 0 where there is no sign, or it is held still. */
  private signTurnAt(sign: HudSign | null, timeMs: number, still: boolean): number {
    if (!sign || still) return 0;
    const { runMs, restMs } = this.signLook();
    return signTurn(sign.mode, timeMs, { runMs, restMs, keyMs: SIGN_KEY_MS }, this.signKept ? 0 : SIGN_STEP_MS);
  }

  /**
   * The sign as it is at this moment, drawn alone: its part of the picture is put back as it was
   * before the sign, the sign is drawn on it, and only that part goes to the screen. The readings
   * are text and frames over the whole picture, and a star that runs is another picture on every
   * frame: drawn with them, it had all of them drawn and sent anew thirty times a second.
   */
  private signAgain(timeMs: number): void {
    const kept = this.signKept;
    if (!kept) return;
    this.kit.put(kept.under, kept.room);
    paintSign(this.kit, kept.plan, this.signLook(), timeMs, false);
    this.kit.endPart(kept.room);
  }

  /**
   * Where the button that takes a move back stands (`undoButton`), with its word in the language
   * of the player: in the bottom left corner, its picture under the left edge of the readings
   * (`left`), inside what the edges of the screen leave, and over the four buttons of those who
   * press (`pad`) where those are under it.
   */
  private undoPlan(tools: HudTools, stage: Box, pad: Box | null, left: number): { tall: number; dot: number; box: Box } {
    const { kit } = this;
    const word = kit.measure(this.undoWord(tools));
    const bottom = Math.min(stage.y + stage.h, kit.height - safeInsets().bottom / kit.zoom);
    const room: Box = { ...stage, h: bottom - stage.y };
    // The picture of the button is 6 dots inside its box: it stands right under the readings.
    const edge = Math.max(0, left - 6);
    const plan = undoButton(room, kit.zoom, word, edge);
    if (!pad || !boxesMeet(plan.box, pad)) return plan;
    return undoButton({ ...room, h: pad.y - room.y }, kit.zoom, word, edge);
  }

  /** The word of the button, and after it how many moves are left to take back, where they are counted. */
  private undoWord(tools: HudTools): string {
    const name = word(COMMANDS.undo.name);
    return tools.left === undefined ? name : `${name} ${tools.left}`;
  }

  /**
   * The button that takes a move back, out of the way of swipes: the arrow that turns back and
   * its word, with no frame, and the number of moves left to take back where a try has only so
   * many. Until there is a move to take back, and once none is left, it is faint. At a dead end
   * it blinks, picture and word: it is the one to press.
   */
  private drawUndo(tools: HudTools, stage: Box, blink: number, pad: Box | null, left: number): void {
    const { kit } = this;
    const { ink, dim, faint } = kit.palette;
    const { tall, dot, box } = this.undoPlan(tools, stage, pad, left);
    const held = this.held?.zone.id === 'undo';
    const urgent = tools.urgent && tools.canUndo;
    const colour = !tools.canUndo ? faint : held ? dim : urgent && blink !== 0 ? faint : ink;
    const ix = box.x + 6;
    const iy = box.y + Math.round((tall - ICON_UNDO.length * dot) / 2);
    ICON_UNDO.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#') kit.rect(ix + c * dot, iy + r * dot, dot, dot, colour);
    });
    kit.text(this.undoWord(tools), ix + TOOL_ICON * dot + 6, box.y + Math.round((tall - CELL_H) / 2), colour);
    if (tools.canUndo) this.zones.push({ id: 'undo', rect: kit.toWindow(box), action: () => this.actions.onUndo() });
  }

  /** Four buttons in a cross: up is north, right is east. */
  private drawPad(pad: { pulse: Dir | null; box: Rect }, blink: number): void {
    const { kit } = this;
    const { bg, ink, dim } = kit.palette;
    const box = this.toPicture(pad.box);
    const side = Math.floor(Math.min(box.w, box.h) / 3) - 2;
    if (side < CELL_H) return;
    const cx = Math.round(box.x + box.w / 2);
    const cy = Math.round(box.y + box.h / 2);
    const place: Record<Dir, Point> = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } };
    for (const dir of DIRS) {
      const id = `pad-${dir}`;
      const cell: Box = { x: cx - side / 2 + place[dir].x * (side + 2), y: cy - side / 2 + place[dir].y * (side + 2), w: side, h: side };
      const filled = this.held?.zone.id === id || (pad.pulse === dir && blink === 0);
      if (filled) kit.box(cell, ink);
      else {
        kit.box(cell, bg);
        kit.frame(cell, dim);
      }
      kit.text(ARROW[dir], cell.x + side / 2, cell.y + Math.round((side - CELL_H) / 2), filled ? bg : ink, { align: 'center' });
      this.zones.push({ id, rect: kit.toWindow(cell), dir });
    }
  }

  private zoneAt(e: PointerEvent): Zone | null {
    if (!this.actions.live()) return null;
    if (e.target instanceof Element && e.target.closest(FOREIGN) !== null) return null;
    for (const zone of this.zones) {
      const { rect } = zone;
      if (e.clientX >= rect.x && e.clientX < rect.x + rect.width && e.clientY >= rect.y && e.clientY < rect.y + rect.height) return zone;
    }
    return null;
  }

  private onDown(e: PointerEvent): void {
    if (this.held || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const zone = this.zoneAt(e);
    if (!zone) return;
    // A press on a zone is not the start of a swipe.
    e.stopPropagation();
    this.held = { zone, pointer: e.pointerId };
    this.drawn = '';
    if (zone.dir) this.actions.press(zone.dir);
  }

  private onUp(e: PointerEvent): void {
    const { held } = this;
    if (!held || held.pointer !== e.pointerId) return;
    e.stopPropagation();
    this.held = null;
    this.drawn = '';
    if (held.zone.dir) this.actions.release();
    else if (this.zoneAt(e)?.id === held.zone.id) held.zone.action?.();
  }

  private onCancel(e: PointerEvent): void {
    const { held } = this;
    if (!held || held.pointer !== e.pointerId) return;
    this.held = null;
    this.drawn = '';
    if (held.zone.dir) this.actions.cancel();
  }
}
