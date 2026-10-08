import type { Display } from '../display/display';
import type { CanvasLayer } from '../display/layer';
import type { Rect } from '../display/sizing';
import type { BoardLook } from '../render/params';
import { faceColour, figureColour, pipColour } from '../render/textures';
import type { Dir, GoalLine } from '../rules';
import { signalLook } from '../signal/scene';
import { loadShellFonts } from './fonts';
import { COUNTER_CUBE, COUNTER_GAP, counterLeft, counterWidth, hudLayout, netBounds, netCellAt, signPlace, turned, type FloorAxes, type HudLayout } from './hudLayout';
import { FACE_PIPS, Kit } from './kit';
import { CELL_H, CELL_W, MIN_ZONE, pictureSize, type Box, type Insets, type Point } from './layout';
import { word } from '../ui/i18n';
import { HUD, digits, goalLabel, goalProgress } from './text';
import { clockHour, mixHex, paletteAt, type Palette } from './theme';
import { Voice } from './voice';

/** The readings of a session that is scored. */
export interface HudSession {
  kind: 'session';
  score: number;
  best: number;
  /** The level, or null in a session that is not counted. */
  level: number | null;
  /** Seconds left of a session with a limit. */
  clock: number | null;
  /** Seconds left to free a cell of a board that is full. */
  danger: number | null;
  /** Steps the contact has taken, out of how many there are, and the score of the next one. */
  stage: number;
  steps: number;
  next: number | null;
}

/** The readings of a task: it is counted in moves. */
export interface HudTask {
  kind: 'task';
  number: number;
  moves: number;
  target: number;
  /** Fewest moves the task has been cleared in. */
  best: number | null;
}

/** The readings of a level: the moves it has taken, the most it may take where it has a limit, and how far its goal has come. */
export interface HudLevel {
  kind: 'level';
  /** Its place in the list of the levels; null on a level that is not in the list and has no number. */
  number: number | null;
  /** The most moves the level may take; null on a level with no limit. */
  limit: number | null;
  /** Moves made. */
  made: number;
  /** One line per thing the goal counts. */
  goal: readonly GoalLine[];
  /**
   * What the level before this one came to, where the board follows it with no window: its
   * stars and its moves, in the place of the moves of this one until the first of them is made.
   */
  outcome: { stars: number; moves: number } | null;
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
  /** The side a swipe is steering towards, the side the exercise asks for, the side to bring on top. */
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
 * The swipe sign: beside the board, the way to swipe now, with no word. For those who swipe it
 * is a dot of the colour of the figure that slides along a short trail and goes out, again and
 * again; for those who press keys, the arrow key, in place and blinking.
 */
export interface HudSign {
  dir: Dir;
  mode: 'dot' | 'key';
  /** Where the trail starts, outside the board, in CSS pixels of the window. A place off the screen is brought to its edge. */
  at: Point;
  /** The trail from there, in CSS pixels: a cell of the board long, the way a swipe to `dir` goes on screen. */
  trail: Point;
}

/** The multiplier of a chain, over its dice. `at` is in CSS pixels of the window. */
export interface HudLabel {
  id: number;
  value: number;
  chain: number;
  at: Point;
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

export interface HudLesson {
  /** Which part of the exercise this is, out of how many, and the channel it sets. */
  number: number;
  count: number;
  value: number;
  /** What it says, in the language of the player. */
  line: string;
  /** The words wait to be read: the exercise goes on when the player presses. */
  waits: boolean;
  /** How many dice of the group are in place, over the group. */
  counter: HudCounter | null;
  /** Over the die whose hidden face matters: opposite faces add up to seven. */
  seven: Point | null;
  glyph: 'swipe' | 'keys' | 'none';
  dir: Dir | null;
  /** Where `dir` points on screen, y growing downwards. */
  screen: Point | null;
}

/** Everything the session shows over the board at one moment. */
export interface HudView {
  header: HudSession | HudTask | HudLevel;
  seal: HudSeal | null;
  labels: readonly HudLabel[];
  lesson: HudLesson | null;
  /** One line at the bottom: a hint, or what a task says about the group just made. */
  note: { text: string; alarm: boolean } | null;
  /** On a level: over every group that is short, how many dice it has of how many it takes. */
  counters?: readonly HudCounter[];
  /** The swipe sign, while a level shows it. */
  sign?: HudSign | null;
  /**
   * The two buttons of a task. `retryOnly` leaves the one that starts over, where no move can be
   * taken back; `undos` is how many moves can still be, written beside the button of a level.
   */
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
  undos?: number;
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
  onSkip(): void;
  /** The words of the exercise have been read. */
  onContinue(): void;
  /** One more sign of the words of the exercise has come. */
  onSign?(sign: string): void;
  /** Points of a group have reached the score; the score has counted a little further up. */
  onPoints?(points: number, tier: number): void;
  onCount?(): void;
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

/** What on the page takes presses of its own. */
const FOREIGN = `${import.meta.env.DEV ? '.overlay, .debug-panel, .lil-gui, ' : ''}button, input, select, textarea, a`;
const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];
const ARROW: Record<Dir, string> = { N: '↑', E: '→', S: '↓', W: '←' };
/** How far in the dots of a face its edge and its pips reach, as shares of the face. */
const NET_EDGE = 0.07;
const NET_PIP = 0.12;
const NET_PIP_ONE = 0.19;
/** Side of a star of the line a passed level leaves in the readings, in pixels of the picture: that of the stars of a result. */
const OUTCOME_STAR = 10;
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
  const most = (Math.min(SWING_MOST_DEG, label.chain * SWING_DEG) * Math.PI) / 180;
  return {
    chain: label.chain,
    value: label.value,
    at: label.at,
    joined: timeMs,
    until: timeMs + LABEL_MS,
    swing: { from: timeMs, angle: before.angle, speed: before.speed + way * most * rate * push * (0.85 + Math.random() * 0.3), rate, damp: between(damp), kind, way },
    hop: { high: (HOP_DOTS + Math.min(label.chain, 16) * HOP_PER_LINK) * (0.6 + Math.random() * 0.8), beat: between(HOP_MS) },
  };
}
/** Half a period of everything that blinks. */
const BLINK_MS = 250;
/** A plaque that asks to be looked at is lit and unlit by turns this often. */
const COUNTER_BLINK_MS = 500;
/** A plaque brought in from the edge of the window stands this far from it, in picture pixels: as clear of it as the swipe sign. */
const COUNTER_PAD = 1;
/** How long the dot of a swipe takes along its line. */
const SWIPE_MS = 900;
const NUDGE_MS = 300;
/**
 * The swipe sign, a first version for the owner to adjust: how long its dot takes along the
 * trail, how long nothing is shown before it sets off again, the last part of the way over which
 * it goes out, half a period of the blinking of the arrow key, and the side of that key in dots.
 */
const SIGN_SLIDE_MS = 700;
const SIGN_REST_MS = 300;
const SIGN_OUT = 0.35;
const SIGN_KEY_MS = 500;
const SIGN_KEY = 18;
/** The words of the exercise come one sign at a time, this many milliseconds apart. */
const SIGN_MS = 38;
/** Words that are all there cannot be passed sooner than this: a press meant for a move does not skip them. */
const READ_MS = 350;
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
/**
 * Letters of the voice over the board, in CSS pixels. On a tall screen they are a fixed size;
 * on a wide one they follow the height of the window, between these two.
 */
const LINE_SIZE_TALL = 19;
const LINE_SIZE_WIDE: readonly [number, number] = [26, 46];
const LINE_SHARE_WIDE = 0.052;
const NOTE_SIZE = 17;

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
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
 * the player unfolded, the multipliers of chains, the exercise, the buttons. It is a layer of
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
  private nudged = 0;
  /** The words of the exercise now on screen, and the frame they began to come at. */
  private line = '';
  private lineStart = 0;
  /** The moment all of them were there. */
  private lineFull = 0;
  /** How many of them had come by the last frame. */
  private signsSaid = 0;
  private lastTime = 0;
  /** Points on their way from a group to the score. `from` is in pixels of the picture. */
  private flyers: { points: number; value: number; tier: number; from: Point; born: number }[] = [];
  /** The last points to reach the score: when, and of which channel and tier. */
  private hit = { at: -Infinity, value: 0, tier: 0 };
  /** Where points fly to: the middle of the score, in pixels of the picture. */
  private scoreAt: Point = { x: 0, y: 0 };
  /** Every line the exercise can say: the room kept for them is that of the longest. */
  private lessonLines: readonly string[] = [];

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

  /** The exercise answers a step off its script. */
  nudge(timeMs: number): void {
    this.nudged = timeMs;
  }

  /** The readings answer a beat: the points of a group stand over it, then fly to the score. */
  beat(beat: HudBeat): void {
    if (beat.points <= 0 || !beat.at) return;
    const zoom = this.kit.zoom;
    this.flyers.push({ points: beat.points, value: beat.value, tier: beat.tier, from: { x: beat.at.x / zoom, y: beat.at.y / zoom }, born: this.lastTime });
  }

  /**
   * The player has pressed to go on. Words that are still coming arrive at once and the press
   * is spent on that; words that are all there have been read. Returns whether they had been.
   */
  proceed(): boolean {
    if (this.line === '') return false;
    if (this.signs(this.lastTime) < this.line.length) {
      this.lineStart = -Infinity;
      this.lineFull = this.lastTime;
      this.drawn = '';
      return false;
    }
    if (this.lastTime < this.lineFull + READ_MS) return false;
    this.actions.onContinue();
    return true;
  }

  /** How many signs of the words of the exercise have come by now. */
  private signs(timeMs: number): number {
    return Math.max(0, Math.floor((timeMs - this.lineStart) / SIGN_MS));
  }

  /** A new session: nothing of the last one is left flashing. */
  reset(): void {
    this.line = '';
    this.flyers = [];
    this.hit = { at: -Infinity, value: 0, tier: 0 };
    this.shown = 0;
    this.lastLevel = 1;
    this.lastStage = 0;
    this.levelFlash = 0;
    this.stageFlash = 0;
    this.chains.clear();
    this.drawn = '';
  }

  /** Tells the voice every line the exercise can say, so the room for them never changes. */
  setLessonLines(lines: readonly string[]): void {
    this.lessonLines = lines;
  }

  /**
   * How much of the top of the stage the exercise keeps for its words, in CSS pixels: the
   * board is laid out below.
   */
  reserve(stage: Rect): number {
    const { size, width } = this.lineFrame(stage);
    let tallest = 0;
    for (const line of this.lessonLines) tallest = Math.max(tallest, this.voice.height(line, width, size));
    return Math.ceil((CELL_H + 6) * this.kit.zoom + tallest + 6);
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
    const layout = hudLayout({ width: kit.width, height: kit.height }, safe, zoom);
    this.lastTime = timeMs;
    const words = view.lesson?.line ?? '';
    if (words !== this.line) {
      this.line = words;
      this.lineStart = view.reducedMotion ? -Infinity : timeMs;
      this.lineFull = view.reducedMotion ? timeMs : timeMs + words.length * SIGN_MS;
    }
    const signs = Math.min(words.length, this.signs(timeMs));
    if (signs > this.signsSaid) this.actions.onSign?.(words[signs - 1]);
    this.signsSaid = signs;
    this.headerHeight = layout.wide ? 0 : Math.round(layout.height * zoom - css.top);
    this.columnWidth = layout.wide ? Math.round(layout.column * zoom - css.left) : 0;
    this.follow(view, timeMs);

    // What moves by itself: only these make the picture be drawn again while nothing else changes.
    const still = view.reducedMotion;
    const blink = still ? 1 : Math.floor(timeMs / BLINK_MS) % 2;
    const swipe = view.lesson?.glyph === 'swipe' && !still ? Math.floor(timeMs / 33) : 0;
    const flashing = timeMs < this.levelFlash || timeMs < this.stageFlash || timeMs < this.nudged + NUDGE_MS;
    const bumps = [...this.chains.values()].some((chain) => timeMs < chain.joined + BUMP_MS);
    // A multiplier that is shown swings, and goes out: the picture is drawn anew for it, thirty times a second.
    const swings = this.chains.size === 0 ? 0 : still ? this.chains.size : Math.floor(timeMs / 33);
    const decay = this.decayAt(view.header.kind === 'session' ? program : 0, timeMs, still, layout.rule + 2);
    // Points in the air and the score they have just reached are drawn anew every frame.
    const moving = this.flyers.length > 0 || timeMs < this.hit.at + HIT_MS ? Math.floor(timeMs) : 0;
    // The swipe sign slides, or blinks: the picture is drawn anew for it.
    const sign = view.sign ?? null;
    // A plaque that blinks is drawn anew each time it turns.
    const plaque = !still && (view.counters ?? []).some((counter) => counter.blink) ? Math.floor(timeMs / COUNTER_BLINK_MS) % 2 : 0;
    const signed = !sign ? '' : `${JSON.stringify(sign)}@${still ? 0 : sign.mode === 'dot' ? Math.floor(timeMs / 33) : Math.floor(timeMs / SIGN_KEY_MS) % 2}`;
    const state = [swings, JSON.stringify(view.header), JSON.stringify(view.seal), JSON.stringify(view.labels), JSON.stringify(view.lesson), JSON.stringify(view.note), JSON.stringify(view.counters ?? null), plaque, signed, JSON.stringify(view.tools), JSON.stringify(view.pad), JSON.stringify(view.stage), still, Math.floor(program), this.shown, blink, swipe, flashing, bumps, signs >= words.length, moving, JSON.stringify(decay), kit.width, kit.height, kit.palette.ink, kit.palette.bg].join('|');
    if (state === this.drawn) {
      // Words that are still coming change nothing but themselves: the readings stay as they are.
      this.voice.reveal(signs);
      return;
    }
    this.drawn = state;

    this.zones = [];
    this.voice.begin();
    kit.begin();
    if (view.header.kind === 'session') {
      if (layout.wide) this.drawSessionWide(view.header, layout, timeMs, blink, program, decay);
      else this.drawSession(view.header, layout, timeMs, blink, program, decay);
    } else if (view.header.kind === 'level') {
      if (layout.wide) this.drawLevelWide(view.header, layout);
      else this.drawLevel(view.header, layout);
    } else if (layout.wide) {
      this.drawTaskWide(view.header, layout);
    } else {
      this.drawTask(view.header, layout);
    }
    this.drawPause(layout);
    // The readings slip: what is drawn so far is theirs, the rest of the picture stays whole.
    if (decay.tears.length > 0) kit.tear(decay.tears, 0, layout.wide ? layout.column : kit.width);
    const stage = this.toPicture(view.stage);
    // On a tall screen the words of the exercise take the place of the net.
    if (view.seal && !(view.lesson && !layout.wide)) this.drawSeal(view.seal, layout, blink);
    this.drawLabels(timeMs, still);
    this.drawFlyers(timeMs);
    // A step of the contact: the program says so over the board, for as long as its cell blinks.
    if (view.header.kind === 'session' && !view.lesson && timeMs < this.stageFlash) {
      const text = `${program >= 1 ? HUD.found : HUD.link} ${digits(view.header.stage, 2)}/${digits(view.header.steps, 2)}`;
      this.flagged(text, Math.round(stage.x + (stage.w - kit.measure(text)) / 2), Math.round(stage.y + 6), blink === 0);
    }
    if (view.lesson) this.drawLesson(view.lesson, view.stage, stage, timeMs, still, signs, blink);
    // A plaque over a heap of a level keeps inside what the edges of the screen leave of the window.
    const within: Box = { x: safe.left, y: safe.top, w: kit.width - safe.right - safe.left, h: kit.height - safe.bottom - safe.top };
    for (const counter of view.counters ?? []) this.drawCounter(counter, plaque === 0, within);
    if (sign) {
      // The sign keeps clear of the edges of the screen and of the readings.
      const left = layout.wide ? layout.column : safe.left;
      const top = layout.wide ? safe.top : layout.height;
      this.drawSign(sign, timeMs, still, { x: left, y: top, w: kit.width - safe.right - left, h: kit.height - safe.bottom - top });
    }
    if (view.tools) this.drawTools(view.tools, stage, blink);
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
    } else {
      this.shown = 0;
      this.flyers = [];
    }
    const seen = new Set<number>();
    for (const label of view.labels) {
      seen.add(label.id);
      const kept = this.chains.get(label.id);
      // A chain that has grown: its multiplier is shown anew, and swings.
      if (!kept || kept.chain !== label.chain) this.chains.set(label.id, pushed(kept, label, timeMs));
      else kept.at = label.at;
    }
    for (const [id, kept] of this.chains) {
      // A chain that is over: its multiplier goes out where it stood, and is not switched off.
      if (!seen.has(id)) kept.until = Math.min(kept.until, timeMs + LABEL_OUT_MS);
      if (timeMs >= kept.until) this.chains.delete(id);
    }
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

  /** The rule under the readings; it breaks up as they come apart. */
  private rule(x: number, y: number, w: number, drift: number): void {
    const { kit } = this;
    const { faint } = kit.palette;
    if (drift <= 0) {
      kit.rect(x, y, w, 1, faint);
      return;
    }
    const piece = 9;
    for (let i = 0; i * piece < w; i++) {
      if (hash(i * 3.3 + 1) < 0.4 * drift) continue;
      kit.rect(x + i * piece, y + this.adrift(40 + i, drift * 0.5), Math.min(piece, w - i * piece), 1, faint);
    }
  }

  /** Points of a group: they stand over it, then fly to the score with a tail behind them. */
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
    const record = session.level !== null && session.score > session.best;
    const flagged = (text: string, x: number, y: number, on: boolean): void => this.flagged(text, x, y, on);

    // The middle: what the session is, and the time it has.
    const clock = session.clock === null ? null : `${digits(Math.floor(session.clock / 60), 2)}:${digits(session.clock % 60, 2)}`;
    let covered = false;
    if (session.danger !== null) {
      // The board is full. Its own rhythm, so it never reads as decoration.
      const text = `${HUD.full}${digits(session.danger, 2)}`;
      flagged(text, mid, rowA, blink === 0);
      covered = mid + kit.measure(text) > end - kit.measure(HUD.best) - 4;
    } else if (clock !== null && tight) {
      flagged(clock, mid, rowA, session.clock! <= 10 && blink === 0);
    } else {
      const tag = session.level === null ? HUD.practice : `${HUD.level} ${digits(session.level, 2)}`;
      flagged(tag, mid, rowA, timeMs < this.levelFlash && blink === 0);
      if (clock !== null) flagged(clock, mid, rowB, session.clock! <= 10 && blink === 0);
    }

    if (!covered) kit.text(HUD.best, end + this.adrift(2, drift), rowA, dim, { align: 'right' });
    this.counter(Math.max(session.best, session.level === null ? 0 : session.score), 6, end, rowB, 1, 'right', record);

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
    this.rule(left, layout.rule, layout.right - left, drift);
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
      const tag = session.level === null ? HUD.practice : `${HUD.level} ${digits(session.level, 2)}`;
      this.flagged(tag, left, lines.tag, timeMs < this.levelFlash && blink === 0);
      if (session.clock !== null) {
        const clock = `${digits(Math.floor(session.clock / 60), 2)}:${digits(session.clock % 60, 2)}`;
        this.flagged(clock, right - kit.measure(clock), lines.tag, session.clock <= 10 && blink === 0);
      }
    }

    const record = session.level !== null && session.score > session.best;
    kit.text(HUD.best, left + this.adrift(2, drift), lines.best, dim);
    this.counter(Math.max(session.best, session.level === null ? 0 : session.score), 6, right, lines.best, 1, 'right', record);

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
    this.rule(left, layout.rule, right - left, drift);
  }

  private drawTaskWide(task: HudTask, layout: HudLayout): void {
    const { kit } = this;
    const { ink, dim, faint } = kit.palette;
    const { left, right, lines } = layout;
    kit.text(HUD.moves, left, lines.label, dim);
    this.counter(task.moves, 3, left, lines.big, 2, 'left', true);
    kit.text(`${HUD.task}${digits(task.number, 2)}`, left, lines.tag, ink);
    kit.text(HUD.best, left, lines.best, dim);
    if (task.best === null) kit.text('--', right, lines.best, faint, { align: 'right' });
    else this.counter(task.best, 2, right, lines.best, 1, 'right', false);
    kit.text(HUD.target, left, lines.link, dim);
    kit.text(digits(task.target, 2), right, lines.link, ink, { align: 'right' });
    kit.rect(left, layout.rule, right - left, 1, faint);
  }

  private drawTask(task: HudTask, layout: HudLayout): void {
    const { kit } = this;
    const { ink, dim, faint } = kit.palette;
    const { left, end, mid, rowA, rowB, rowC, big, tight } = layout;
    kit.text(HUD.moves, left, rowA, dim);
    this.counter(task.moves, 3, left, big, 2, 'left', true);
    kit.text(`${HUD.task}${digits(task.number, 2)}`, mid, rowA, ink);
    if (!tight) kit.text(HUD.best, end, rowA, dim, { align: 'right' });
    if (task.best === null) kit.text('--', end, rowB, faint, { align: 'right' });
    else this.counter(task.best, 2, end, rowB, 1, 'right', false);
    const target = digits(task.target, 2);
    const at = kit.text(HUD.target, end - kit.measure(target) - 4 - kit.measure(HUD.target), rowC, dim);
    kit.text(target, at + 4, rowC, ink);
    kit.rect(left, layout.rule, layout.right - left, 1, faint);
  }

  /**
   * The moves a level has taken, counted up as large as the moves of a task; where the level
   * has a limit, the most it may take stands after them, small: `007 /30`.
   */
  private levelMoves(level: HudLevel, x: number, y: number): void {
    const { kit } = this;
    if (level.outcome) {
      // The stars as the list of the levels has them: squares, as many filled as there are stars, of three.
      const { ink, faint } = kit.palette;
      const side = OUTCOME_STAR;
      const step = side + Math.round(side / 2);
      const top = y + Math.round((CELL_H * 2 - side) / 2);
      for (let i = 0; i < 3; i++) {
        const cell = { x: x + i * step, y: top, w: side, h: side };
        if (i < level.outcome.stars) kit.box(cell, ink);
        else kit.frame(cell, faint);
      }
      this.counter(level.outcome.moves, 3, x + step * 3 + 2, y, 2, 'left', true);
      return;
    }
    this.counter(level.made, 3, x, y, 2, 'left', true);
    if (level.limit !== null) kit.text(`/${digits(level.limit, 2)}`, x + kit.measure(digits(level.made, 3), 2) + 3, y + CELL_H, kit.palette.dim);
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

  /** The readings of a level as a column: its moves, its number, and a line for each thing its goal counts. */
  private drawLevelWide(level: HudLevel, layout: HudLayout): void {
    const { kit } = this;
    const { ink, dim, faint } = kit.palette;
    const { left, right, lines } = layout;
    kit.text(HUD.moves, left, lines.label, dim);
    this.levelMoves(level, left, lines.big);
    if (level.number !== null) kit.text(`${HUD.level} ${digits(level.number, 2)}`, left, lines.tag, ink);
    const rows = [lines.best, lines.link, lines.cells];
    level.goal.slice(0, rows.length).forEach((line, i) => this.goalLine(line, right, rows[i], left));
    kit.rect(left, layout.rule, right - left, 1, faint);
  }

  private drawLevel(level: HudLevel, layout: HudLayout): void {
    const { kit } = this;
    const { ink, dim, faint } = kit.palette;
    const { left, end, mid, rowA, rowB, rowC, big } = layout;
    kit.text(HUD.moves, left, rowA, dim);
    this.levelMoves(level, left, big);
    if (level.number !== null) kit.text(`${HUD.level} ${digits(level.number, 2)}`, mid, rowA, ink);
    // The goal stands on the right, its last line on the last row.
    const rows = [rowA, rowB, rowC];
    const shown = level.goal.slice(0, rows.length);
    shown.forEach((line, i) => this.goalLine(line, end, rows[rows.length - shown.length + i]));
    kit.rect(left, layout.rule, layout.right - left, 1, faint);
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

  /**
   * The die under the player, unfolded and laid in the plane of the board, so that a side
   * points where a step that way leads. The same net the menu of the program is built on.
   */
  private drawSeal(seal: HudSeal, layout: HudLayout, blink: number): void {
    const { kit, net } = this;
    const palette = kit.palette;
    const side = Math.min(22, Math.max(13, Math.round(Math.min(kit.width, kit.height) * 0.075)));
    const bounds = netBounds({ x: 0, y: 0 }, side, seal.axes);
    const state = [JSON.stringify(seal), side, blink, palette.ink, palette.bg, palette.channels.join()].join('|');
    if (state !== this.netDrawn) {
      this.netDrawn = state;
      this.paintNet(seal, side, bounds, palette, blink);
    }
    kit.image(net, layout.net.x, layout.net.y);
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
      const scale = since < BUMP_MS ? base + 1 : base;
      const angle = still ? 0 : swingAt(label.swing, timeMs).angle;
      const hop = still ? 0 : label.hop.high * Math.exp(-since / HOPS_DIE_MS) * Math.abs(Math.sin((since / label.hop.beat) * Math.PI));
      kit.turned(`×${label.chain}`, label.at.x / zoom, label.at.y / zoom - (CELL_H * scale) / 2 - hop, angle, this.beatColour(label.value), { scale, bold: true });
    }
  }

  /** Where the words of the exercise go, in CSS pixels, and how large their letters are. */
  private lineFrame(stage: Rect): { x: number; width: number; size: number } {
    const tall = stage.height > stage.width;
    const size = tall ? LINE_SIZE_TALL : Math.round(Math.min(LINE_SIZE_WIDE[1], Math.max(LINE_SIZE_WIDE[0], stage.height * LINE_SHARE_WIDE)));
    const width = tall ? stage.width - 20 : Math.min(stage.width * 0.9, size * 34);
    return { x: stage.x + (stage.width - width) / 2, width, size };
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
   * The swipe sign, inside the part of the picture it may stand in. The dot sets off from the
   * start of its trail, draws the trail behind it, grows small towards the end and is gone, and
   * after a moment of nothing sets off again; held still, it stands at the end of its trail.
   * The key is lit and unlit by turns, once a second.
   */
  private drawSign(sign: HudSign, timeMs: number, still: boolean, inside: Box): void {
    const { kit } = this;
    const { bg, ink, dim } = kit.palette;
    const zoom = kit.zoom;
    const at = { x: sign.at.x / zoom, y: sign.at.y / zoom };
    if (sign.mode === 'key') {
      const centre = signPlace(at, { x: 0, y: 0 }, inside, SIGN_KEY / 2 + 1);
      const cell: Box = { x: Math.round(centre.x - SIGN_KEY / 2), y: Math.round(centre.y - SIGN_KEY / 2), w: SIGN_KEY, h: SIGN_KEY };
      const lit = still || Math.floor(timeMs / SIGN_KEY_MS) % 2 === 0;
      if (lit) kit.box(cell, ink);
      else {
        kit.box(cell, bg);
        kit.frame(cell, dim);
      }
      kit.text(ARROW[sign.dir], cell.x + SIGN_KEY / 2, cell.y + Math.round((SIGN_KEY - CELL_H) / 2), lit ? bg : ink, { align: 'center' });
      return;
    }
    const turn = timeMs % (SIGN_SLIDE_MS + SIGN_REST_MS);
    if (!still && turn >= SIGN_SLIDE_MS) return;
    const radius = kit.number('signDot') / 2;
    const trail = { x: sign.trail.x / zoom, y: sign.trail.y / zoom };
    const from = signPlace(at, trail, inside, Math.ceil(radius) + 1);
    const along = still ? 1 : turn / SIGN_SLIDE_MS;
    const eased = 1 - (1 - along) * (1 - along);
    const head = { x: from.x + trail.x * eased, y: from.y + trail.y * eased };
    // The colour of the figure: it is the figure that the swipe moves.
    const colour = figureColour(kit.palette, this.look.board);
    kit.wire([from, head], colour);
    kit.disc(head.x, head.y, still ? radius : radius * Math.min(1, (1 - along) / SIGN_OUT), colour);
  }

  private drawLesson(lesson: HudLesson, stage: Rect, box: Box, timeMs: number, still: boolean, signs: number, blink: number): void {
    const { kit } = this;
    const { bg, ink, dim, faint } = kit.palette;
    const zoom = kit.zoom;
    const middle = Math.round(box.x + box.w / 2);

    // At the very top: which channel this part of the exercise sets, in the program's hand, and
    // under it what is said, in the voice. The words come little by little.
    kit.text(`${HUD.channel}${lesson.value} ${HUD.exercise}  ${lesson.number}/${lesson.count}`, middle, box.y + 3, dim, { align: 'center' });
    const frame = this.lineFrame(stage);
    const top = stage.y + (CELL_H + 6) * zoom;
    this.voice.say({
      text: lesson.line,
      box: { x: frame.x, y: top, width: frame.width, height: this.reserve(stage) - (CELL_H + 6) * zoom },
      size: frame.size,
      anchor: 'top',
      reveal: signs,
    });

    if (lesson.counter) this.drawCounter(lesson.counter, true);
    if (lesson.seven) {
      const text = '=7';
      const at2 = this.plate(lesson.seven, 12 + CELL_W + 12 + kit.measure(text) + 8, false);
      this.plateFace(1, at2.x + 3, at2.y + 3);
      kit.text('+', at2.x + 16, at2.y + 1, ink);
      this.plateFace(6, at2.x + 16 + CELL_W, at2.y + 3);
      kit.text(text, at2.x + 16 + CELL_W + 14, at2.y + 1, ink);
    }

    // At the bottom: the input that makes the move the exercise waits for, or the word that
    // the words above are waiting to be read.
    const nudge = !still && timeMs < this.nudged + NUDGE_MS ? Math.round(Math.sin((timeMs - this.nudged) / 25) * 3) : 0;
    const foot = box.y + box.h - 12;
    if (lesson.waits) {
      if (signs >= lesson.line.length) {
        const text = `${HUD.next} ↓`;
        const wide = kit.measure(text) + 12;
        const plate: Box = { x: middle - wide / 2, y: foot - CELL_H - 4, w: wide, h: CELL_H + 4 };
        if (blink === 0) {
          kit.box(plate, ink);
          kit.text(text, middle, plate.y + 2, bg, { align: 'center', bold: true });
        } else {
          kit.frame(plate, dim);
          kit.text(text, middle, plate.y + 2, ink, { align: 'center' });
        }
      }
    } else if (lesson.glyph === 'swipe' && lesson.screen) {
      const reach = 16;
      const centre = { x: middle + nudge, y: foot - reach - 4 };
      const { x, y } = lesson.screen;
      const from = { x: centre.x - x * reach, y: centre.y - y * reach };
      const to = { x: centre.x + x * reach, y: centre.y + y * reach };
      kit.wire([from, to], dim);
      // The head of the arrow, and the finger that goes along it.
      kit.wire([{ x: to.x - (x - y * 0.6) * 5, y: to.y - (y + x * 0.6) * 5 }, to, { x: to.x - (x + y * 0.6) * 5, y: to.y - (y - x * 0.6) * 5 }], dim);
      const along = still ? 1 : (timeMs % SWIPE_MS) / SWIPE_MS;
      const eased = 1 - (1 - along) * (1 - along);
      kit.disc(from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased, 3.5, ink);
    } else if (lesson.glyph === 'keys' && lesson.dir) {
      const key = 18;
      const place: Record<Dir, Point> = { N: { x: 0, y: -1 }, W: { x: -1, y: 0 }, S: { x: 0, y: 0 }, E: { x: 1, y: 0 } };
      for (const dir of DIRS) {
        const cell: Box = { x: middle + nudge - key / 2 + place[dir].x * (key + 2), y: foot - key + place[dir].y * (key + 2), w: key, h: key };
        const lit = dir === lesson.dir;
        if (lit) kit.box(cell, ink);
        else kit.frame(cell, faint);
        kit.text(ARROW[dir], cell.x + (key - CELL_W * 2) / 2, cell.y + 1, lit ? bg : dim);
      }
    }

    // In the corner: leaves the exercise for a session.
    const tall = Math.max(CELL_H + 4, Math.ceil(MIN_ZONE / zoom));
    const skipText = `${HUD.skip.native} ${word(HUD.skip.name)}`;
    const wide = kit.measure(skipText) + 12;
    const skip: Box = { x: box.x + box.w - wide - 4, y: box.y + box.h - tall - 4, w: wide, h: tall };
    kit.text(skipText, skip.x + 6, skip.y + Math.round((tall - CELL_H) / 2), this.held?.zone.id === 'skip' ? ink : dim);
    this.zones.push({ id: 'skip', rect: kit.toWindow(skip), action: () => this.actions.onSkip() });
    // While the words wait, a press or a swipe anywhere reads them. It comes after the pause
    // and the skip, so a press on one of those is theirs.
    if (lesson.waits) this.zones.push({ id: 'continue', rect: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }, action: () => this.proceed() });
  }

  /**
   * The two buttons every task needs, in the corner of the board and out of the way of swipes.
   * On a level the one that takes a move back says how many moves it still has, and goes out at none.
   */
  private drawTools(tools: HudTools, stage: Box, blink: number): void {
    const { kit } = this;
    const { bg, ink, dim, faint } = kit.palette;
    const tall = Math.max(CELL_H + 8, Math.ceil(MIN_ZONE / kit.zoom));
    const undo = tools.undos === undefined ? HUD.undo : `${HUD.undo} ${tools.undos}`;
    const wide = Math.max(tall, kit.measure(undo) + 12);
    const button = (id: string, text: string, x: number, on: boolean, urgent: boolean, action: () => void): void => {
      const box: Box = { x, y: Math.round(stage.y + 6), w: wide, h: tall };
      const filled = this.held?.zone.id === id || (urgent && blink === 0);
      if (filled) kit.box(box, ink);
      else {
        kit.box(box, bg);
        kit.frame(box, on ? dim : faint);
      }
      kit.text(text, box.x + box.w / 2, box.y + Math.round((tall - CELL_H) / 2), filled ? bg : on ? ink : faint, { align: 'center' });
      if (on) this.zones.push({ id, rect: kit.toWindow(box), action });
    };
    const right = Math.round(stage.x + stage.w - 6);
    button('retry', HUD.retry, right - wide, true, false, () => this.actions.onRestart());
    if (tools.retryOnly) return;
    // A dead end is left by taking the move back: that button becomes the one to press.
    button('undo', undo, right - wide * 2 - 6, tools.canUndo, tools.urgent && tools.canUndo, () => this.actions.onUndo());
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
