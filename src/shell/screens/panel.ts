import type { ClimbRow } from '../climb';
import type { Kit } from '../kit';
import { CELL_H, CELL_W, fingerOf, textWidth, zoneOf, type Box, type Dir4 } from '../layout';
import type { ShellContext, ShellFocus, ShellItem, ShellScreen } from '../screen';
import { word } from '../../ui/i18n';
import { paintStar, paintStarGhost, paintStarSmall, type StarColours } from '../star';
import { BAR_H, BUTTON_H, EDGE, GAP, LEVEL_CELL_W, LEVELS_LIST, MARK, PANEL_SAY_SIZE, SCROLL_BAR, UNIT } from '../theme';
import { digits, type PanelName } from '../text';

/** Something a panel can be told to do: a line that is pressed. */
export interface PanelCommand {
  id: string;
  label: PanelName;
  action: () => void;
  /** It acts inside the press itself: see `ShellItem.instant`. */
  instant?: boolean;
  /** The command the panel is about: twice as tall as a button, its word twice the size. */
  large?: boolean;
}

/** A line of a panel, from top to bottom. */
export type PanelRow =
  /** A name and its value, with dots between. */
  | { kind: 'field'; label: PanelName; value: string | (() => string) }
  /** A name, and under it a number at twice the size: the reading the panel is about. */
  | { kind: 'number'; label: PanelName; value: number; places: number }
  /**
   * The reading a result is about and, beside it, the place it took in the log, both at twice
   * the size; `of` is how many lines the log has. `lit` shows the place filled: it has just been taken.
   */
  | { kind: 'standing'; label: PanelName; value: () => number; places: number; rank: PanelName; place: () => number; of: () => number; lit: () => boolean }
  | ({ kind: 'command' } & PanelCommand)
  /** Several commands side by side; `stacked` puts them one under another where the picture is tall. */
  | { kind: 'commands'; commands: readonly PanelCommand[]; stacked?: boolean }
  /** A setting: pressing it takes its next value. */
  | { kind: 'switch'; id: string; label: PanelName; value: () => string; action: () => void }
  /** One of several, side by side: the one picked is filled. */
  | { kind: 'tabs'; id: string; labels: () => readonly string[]; selected: () => number; pick: (index: number) => void }
  /**
   * A log: its place, a name and a value on every line. `lines` is the most it shows; `status`
   * is said at the end of its head, where there is something to say about the log as a whole.
   */
  | { kind: 'table'; head: () => string; rows: () => readonly TableLine[]; empty: () => string; lines: number; status?: () => string }
  /**
   * A part of a log around one line of it, which stands in the middle row: a session on its way
   * up the log. `rows` gives what is in sight in so many rows; `lines` is the most it shows.
   */
  | {
      kind: 'climb';
      /** What is in sight in so many rows, scrolled so many rows from where the session stands. */
      rows: (count: number, shift?: number) => readonly (ClimbRow | null)[];
      lines: number;
      /** How far it can be scrolled up (less than nought) and down; it cannot where left out. */
      range?: (count: number) => readonly [least: number, most: number];
    }
  /**
   * The boards of the levels, as numbered cells with what each has earned, and nothing under them
   * (the owner, 30 October 2026). `marks` is how many a cell can earn, three when left out. Only
   * boards stand in it: the calls are a layer of their own (the owner, 5 November 2026: «клетки из
   * списка давай убирать»). The same cells hold the records of the link in `STORY` (the owner,
   * 6 November 2026): a `closed` one is drawn faint and is not pressed.
   */
  | {
      kind: 'levels';
      id: string;
      levels: readonly { stars: number; closed?: boolean }[];
      current: number;
      pick: (index: number) => void;
      marks?: number;
    }
  /**
   * What a level has earned, out of three. With `shine` they are the large stars of a pass, that
   * give light: they light up one after another, each with a flare and `onLit`, and then stand;
   * `still` has them all lit at once, without the flare, and `onLit` once. Where all three are
   * held, they then blaze once together, with `onAll`; `still` has `onAll` and no blaze.
   */
  | { kind: 'stars'; count: number; shine?: { still: boolean; onLit?: (index: number) => void; onAll?: () => void } }
  /**
   * Prose in the language of the player, in the voice. With `when`, its room is kept and it is
   * said once that holds. With `after`, its words are typed out, once so many signs of the
   * panel have come: see `typed` of the panel. With `large`, its letters are as tall as a line
   * of the program's own font and grow with the window: what a player has to read to play.
   * With `room`, the line is as tall as the tallest of those texts takes, whichever it says.
   */
  | { kind: 'say'; text: string; size?: number; dim?: boolean; when?: () => boolean; after?: number; large?: boolean; room?: readonly string[] }
  | { kind: 'gap'; h?: number };

/**
 * A line of a log. `own` marks the line of the one who is playing: it is written in full
 * tone and, when it lies below what the log has room for, the last rows show it with the lines
 * next to it. `place` stands in for the count of lines where the log has places of its own.
 */
export type TableLine = readonly [label: string, value: string, own?: boolean, place?: number];

export interface PanelSpec {
  title: PanelName | (() => PanelName);
  rows: readonly PanelRow[];
  /**
   * The panel takes the whole screen: as wide and as tall as the picture less its edges, its last
   * line at the bottom. A list of the levels in it has its cells as tall as fills what is left.
   */
  full?: boolean;
  /** The bar of the name blinks: what the name says has just happened. */
  flash?: () => boolean;
  /** The panel moves by itself: asked every frame, answers true when it has to be drawn again. */
  live?: (timeMs: number) => boolean;
  /**
   * How many signs of the words that are typed out are there at this time. More of them
   * change nothing but themselves: they are written again, and the panel stands as it is.
   */
  typed?: (timeMs: number) => number;
  /** The zone in focus when the panel opens. */
  home?: string;
  /** Esc and the system's "back". */
  back?: () => void;
}

/** Widest a panel gets, in pixels of the picture. Its edges, the space inside them and between its lines are those of the grid (`theme.ts`). */
const WIDTH = 264;
/**
 * Large letters of the voice, in pixels of the picture, on a tall picture and on a wide one.
 * They are measured in the picture and not in the window, so that they are the same part of a
 * panel on a phone and on a desk, where a panel is three times the size. On a phone 360 wide
 * they come to 20 CSS pixels and some thirty signs to a line; on a screen 1080 tall to 36 and
 * some forty: lines short enough to be read at a glance, and letters a little under the
 * program's own on a desk, where they are read from further off.
 */
const SAY_LARGE_TALL = 15;
const SAY_LARGE_WIDE = 12;
/** Cells of the levels across a tall picture; across a wide one, as many as `LEVEL_CELL_W` makes of its width, and no fewer. */
const LEVELS_TALL = 6;
/**
 * Space between two cells of the levels: the gap of the grid, as between the lines of a panel
 * (the owner, 30 October 2026: «отступы между квадратиками побольше»). A cell is as tall as a
 * finger needs, and no lower than this, so that its thirds are a line of the font each and more.
 */
const CELL_GAP = GAP;
const CELL_LEAST = 36;
/** The ring round a cell in focus stands this far out from it, inside the gap. */
const CELL_RING = 2;
/** The stars of a result: their radius, and from the middle of one to the next. */
const RESULT_STAR = 6;
const RESULT_STAR_STEP = 20;
/**
 * The large stars of a pass, on the grid: their radius is the height of a button, and each stands
 * in a square of its own five lines of text on a side, so that there is air around it.
 * The first waits a moment after the panel; then one by one, this far apart, each grows out of
 * its outline past its size and settles, and flares, the light falling off slowly. Then they
 * stand: a panel that is drawn anew every frame takes most of the frame on a desk.
 */
const SHINE_STAR = BUTTON_H;
const SHINE_H = CELL_H * 5;
const SHINE_STEP = SHINE_H;
const SHINE_WAIT_MS = 250;
const SHINE_STEP_MS = 300;
const SHINE_GROW_MS = 260;
const SHINE_FLARE_MS = 650;
/** A star grows from this share of its size to this share, and settles back to its size. */
const SHINE_FROM = 0.5;
const SHINE_PEAK = 1.3;
/**
 * All three held (the owner, 30 October 2026: «моргнуть ещё раз, всеми тремя и насыщено,
 * светло»): this long after the third lights up, when its flare is nearly gone, the three blaze
 * once together - up in the first of these milliseconds, down slowly over the second.
 */
const BLAZE_AFTER_MS = 600;
const BLAZE_UP_MS = 70;
const BLAZE_DOWN_MS = 900;
/** When the three blaze, in milliseconds after the first star lights up. */
const BLAZE_FROM_MS = SHINE_STEP_MS * 2 + BLAZE_AFTER_MS;

/** The blaze of all three stars, `since` milliseconds after it began: 0 to 1, quickly up and slowly down. */
function blazeAt(since: number): number {
  if (since < 0) return 0;
  if (since < BLAZE_UP_MS) return Math.sin((since / BLAZE_UP_MS) * (Math.PI / 2));
  const left = Math.max(0, 1 - (since - BLAZE_UP_MS) / BLAZE_DOWN_MS);
  return left * left;
}

/** The size of a star that began to light `since` milliseconds ago, as a share of its own: quickly past it, then slowly back. */
function shineSize(since: number): number {
  const t = Math.min(1, since / SHINE_GROW_MS);
  const rise = 0.45;
  if (t < rise) {
    const u = t / rise;
    return SHINE_FROM + (SHINE_PEAK - SHINE_FROM) * (1 - (1 - u) * (1 - u));
  }
  const u = (t - rise) / (1 - rise);
  return SHINE_PEAK - (SHINE_PEAK - 1) * u * u * (3 - 2 * u);
}
/** While they light up the stars are drawn anew this often, in milliseconds: thirty times a second. */
const SHINE_FRAME_MS = 33;
/** The fewest rows of cells of the levels a panel shows where the list does not fit and scrolls. */
const LEVELS_SHOWN_MIN = 3;
/** The list of the levels where it scrolls, and the bars of what scrolls (`theme.ts`). */
const { cutLeast: LEVELS_CUT_LEAST, cutMost: LEVELS_CUT_MOST } = LEVELS_LIST;
const { width: SCROLL_W, inset: SCROLL_IN } = SCROLL_BAR;
/** Half a blink of the bar of the name, in milliseconds. */
const BLINK_MS = 110;
/** Rows a log keeps for the line of the one who plays and the lines next to it. */
const NEAR_ROWS = 5;
/** The head of a log: its line of names, and under it the rule, before the first line of the log. */
const TABLE_HEAD = CELL_H + UNIT;

interface Placed {
  row: PanelRow;
  box: Box;
  /** Of the list of the levels: the rows of cells in sight. */
  shown?: number;
}

/** The cells of the list of the levels as they lie: every cell, the row of the list each is in, and the rows in sight. */
interface LevelView {
  cells: Box[];
  rowOf: number[];
  /** The first row in sight, how many are, and how many the list has. A finger stops the list anywhere, so `from` can stand between rows. */
  from: number;
  shown: number;
  rows: number;
  /** What of the list is in sight, the rings of the cells with it: a row half in sight is cut at its edge. */
  window: Box;
}

/** How the list goes on after a finger lets it go: the part of its speed it keeps each millisecond, and the speed, in CSS pixels a millisecond, it stops at. */
const COAST_KEEP = 0.997;
const COAST_STOP = 0.02;

const ceilTo = (value: number, step: number): number => Math.ceil(value / step) * step;

/** A name as a line reads it: the program's own word, then the word in the language of the player. */
const named = (label: PanelName): string => `${label.native} ${word(label.name)}`;

/** Height of the letters of a line of prose, in CSS pixels, where a pixel of the picture is `zoom` of them and the picture is `wide` or tall. */
function saySize(row: Extract<PanelRow, { kind: 'say' }>, zoom: number, wide: boolean): number {
  if (row.size !== undefined) return row.size;
  if (!row.large) return PANEL_SAY_SIZE;
  return Math.max(PANEL_SAY_SIZE, Math.round((wide ? SAY_LARGE_WIDE : SAY_LARGE_TALL) * zoom));
}

/**
 * A panel of the program over whatever is on screen: a framed record with a filled bar for
 * its name, as the records of the menu are, and under the bar its lines - readings, settings,
 * commands. A line that can be pressed is filled while it is in focus, and the red mark of the
 * seventh stands on it.
 */
/** Room a command needs beside its word: the red mark on one side, as much on the other. */
const COMMAND_ROOM = 20;

/**
 * The parts of a line of commands side by side: equal, where every word fits its part; else each
 * as wide as its word asks and what is left shared out evenly, so a long word stands beside a
 * short one. A part shows the name alone where both names do not fit (`drawCommand`): the name
 * is what has to fit. Null where the words do not fit the line either way.
 */
export function commandParts(box: Box, commands: readonly PanelCommand[]): Box[] | null {
  const count = commands.length;
  const needs = commands.map((command) => textWidth(word(command.label.name)) + COMMAND_ROOM);
  const room = box.w - GAP * (count - 1);
  const equal = Math.floor(room / count);
  let widths: number[];
  if (needs.every((need) => need <= equal)) widths = needs.map(() => equal);
  else {
    const spare = room - needs.reduce((sum, need) => sum + need, 0);
    if (spare < 0) return null;
    widths = needs.map((need) => need + Math.floor(spare / count));
  }
  // The last part takes what rounding left, to the edge of the line.
  const parts: Box[] = [];
  let x = box.x;
  widths.forEach((w, i) => {
    parts.push({ x, y: box.y, w: i === count - 1 ? box.x + box.w - x : w, h: box.h });
    x += w + GAP;
  });
  return parts;
}

/**
 * The thumb of a bar `tall` dots long of a list `total` long, `shown` of it in sight from `first`:
 * where it starts along the bar, and how long it is - its share of the whole, and no shorter than
 * the grid's step.
 */
export function scrollThumb(tall: number, first: number, shown: number, total: number): [at: number, length: number] {
  const thumb = Math.min(tall, Math.max(UNIT, Math.round((tall * shown) / Math.max(shown, total))));
  const span = Math.max(1e-6, total - shown);
  const at = Math.round(((tall - thumb) * Math.max(0, Math.min(first, span))) / span);
  return [at, thumb];
}

/**
 * Cells of a list on the whole screen that scrolls, `room` dots tall: as tall as `base`, or taller,
 * so that the rows wholly in sight leave a share of the next one between `LEVELS_CUT_LEAST`
 * and `LEVELS_CUT_MOST` of a cell, the cut row; of all such heights the one nearest to what `whole`
 * rows would grow to filling the room, as the cells stood before the cut row. Where no height gives
 * such a share, the cells grow to fill the room with whole rows. `shown` is the rows in sight, the
 * cut row a share of one.
 */
export function cutRows(room: number, base: number, whole: number): { cell: number; shown: number } {
  const filling = Math.max(base, Math.floor((room + CELL_GAP) / Math.max(1, whole) - CELL_GAP));
  let best: number | null = null;
  // On whole dots and not on the grid: the grid's step is too coarse to cut a row so and keep the cells near square.
  for (let cell = base; cell <= base * 2; cell++) {
    const step = cell + CELL_GAP;
    const rows = Math.floor((room + CELL_GAP) / step);
    const cut = (room - rows * step) / cell;
    if (rows < 2 || cut < LEVELS_CUT_LEAST || cut > LEVELS_CUT_MOST) continue;
    if (best === null || Math.abs(cell - filling) < Math.abs(best - filling)) best = cell;
  }
  const cell = best ?? filling;
  return { cell, shown: (room + CELL_GAP) / (cell + CELL_GAP) };
}

export class PanelScreen implements ShellScreen {
  readonly home?: string;
  /** Which half of a blink the bar of the name is in; -1 while it does not blink. */
  private blink = -1;
  /** Signs of the words that are typed out that are there. */
  private typed = 0;
  /** The first row of the cells of the levels in sight, where the list scrolls; null till the panel is laid out. */
  private top: number | null = null;
  /** Height of a cell of the levels where a panel on the whole screen grows them to fill it; null where they are as tall as a finger. Laid out by `plan`. */
  private cellTall: number | null = null;
  /** CSS pixels the wheel has turned the list that do not make a row yet, down counted up: the small steps of a touchpad add up. */
  private wheeled = 0;
  /** The list going on by itself after a finger let it go: rows a millisecond, down counted up, and the time it was last moved; 0 and null while it stands. */
  private coast = 0;
  private coastAt: number | null = null;
  /**
   * A log scrolled by the player: the first line of a table in sight, null while it stands as
   * it opened (its top, and the player's line under it); the rows a way up the log is scrolled.
   */
  private logTop: number | null = null;
  private logShift = 0;
  /** The large stars: when the panel was first drawn, the time now, and how many have been heard to light up. */
  private shineFrom: number | null = null;
  private now = 0;
  private shineHeard = 0;
  /** The chord of all three stars has been heard. */
  private shineAllHeard = false;

  constructor(
    private readonly context: ShellContext,
    private readonly spec: PanelSpec,
    /** Nothing is under the panel: it stands on the dark of the tube. */
    private readonly alone = false,
  ) {
    this.home = spec.home ?? this.zones()[0]?.id;
  }

  items(): ShellItem[] {
    return this.zones();
  }

  update(timeMs: number): boolean {
    let changed = this.spec.live?.(timeMs) ?? false;
    if (this.coasting(timeMs)) changed = true;
    if (this.shine(timeMs)) changed = true;
    const typed = this.spec.typed?.(timeMs) ?? 0;
    if (typed !== this.typed) {
      this.typed = typed;
      this.context.voice.reveal(typed);
    }
    const blink = this.spec.flash?.() ? Math.floor(timeMs / BLINK_MS) % 2 : -1;
    if (blink !== this.blink) {
      this.blink = blink;
      changed = true;
    }
    return changed;
  }

  back(): void {
    this.spec.back?.();
  }

  /** The list after a finger let it go, frame by frame: it goes on and slows down, and stands at its end. True while it moves. */
  private coasting(timeMs: number): boolean {
    if (this.coast === 0) return false;
    const list = this.levels();
    if (!list) {
      this.coast = 0;
      return false;
    }
    const at = this.coastAt ?? timeMs;
    // A frame late by much does not throw the list far.
    const dt = Math.min(50, Math.max(0, timeMs - at));
    this.coastAt = timeMs;
    const { view } = list;
    const top = Math.max(0, Math.min(view.rows - view.shown, view.from + this.coast * dt));
    this.coast *= Math.pow(COAST_KEEP, dt);
    // It stands at the end it goes towards.
    const end = this.coast < 0 ? top === 0 : top === view.rows - view.shown;
    if (end || Math.abs(this.coast) * this.rowPixels() < COAST_STOP) this.coast = 0;
    if (top === this.top) return this.coast !== 0;
    this.top = top;
    return true;
  }

  /** CSS pixels of the window a row of the cells of the levels takes, its gap with it. */
  private rowPixels(): number {
    return (this.cellHeight() + CELL_GAP) * this.zoom();
  }

  /**
   * A finger held on the panel and drawn up or down so many CSS pixels since the last time, up
   * counted up: the list goes with it, as far as its ends. False where the panel has no list that scrolls.
   */
  drag(pixels: number): boolean {
    const list = this.levels();
    if (!list || list.view.shown >= list.view.rows) return false;
    const { view } = list;
    this.coast = 0;
    this.top = Math.max(0, Math.min(view.rows - view.shown, view.from + pixels / this.rowPixels()));
    return true;
  }

  /** The finger let the list go at so many CSS pixels a millisecond, up counted up: it goes on and slows down; with motion kept low it stands. */
  fling(speed: number): void {
    this.coast = this.context.reducedMotion() ? 0 : speed / this.rowPixels();
    this.coastAt = null;
  }

  /** A finger on the panel stops the list where it goes on by itself. True where it was moving. */
  hold(): boolean {
    const moving = this.coast !== 0;
    this.coast = 0;
    return moving;
  }

  /** The large stars, frame by frame: they are heard as they light up, and drawn anew while they flare. */
  private shine(timeMs: number): boolean {
    const row = this.spec.rows.find((one): one is Extract<PanelRow, { kind: 'stars' }> => one.kind === 'stars' && one.shine !== undefined);
    if (!row?.shine) return false;
    this.shineFrom ??= timeMs;
    const before = this.now;
    this.now = timeMs;
    const { still, onLit, onAll } = row.shine;
    const age = timeMs - this.shineFrom - SHINE_WAIT_MS;
    const lit = still ? row.count : age < 0 ? 0 : Math.min(row.count, Math.floor(age / SHINE_STEP_MS) + 1);
    // With motion kept low they all stand at once, and one is heard.
    for (; this.shineHeard < lit; this.shineHeard++) if (!still || this.shineHeard === row.count - 1) onLit?.(this.shineHeard);
    const all = row.count >= 3;
    // The chord of all three: with the blaze, or with motion kept low at once, after the star.
    if (all && !this.shineAllHeard && (still || age >= BLAZE_FROM_MS)) {
      this.shineAllHeard = true;
      onAll?.();
    }
    if (still) return before === 0;
    // Once the last has flared, and all three have blazed, they stand, and are drawn once more, still.
    const over = SHINE_WAIT_MS + (all ? BLAZE_FROM_MS + BLAZE_UP_MS + BLAZE_DOWN_MS : SHINE_STEP_MS * Math.max(0, row.count - 1) + SHINE_FLARE_MS);
    if (before - this.shineFrom >= over) return false;
    return timeMs - this.shineFrom >= over || Math.floor(timeMs / SHINE_FRAME_MS) !== Math.floor(before / SHINE_FRAME_MS);
  }

  /** The large stars of a pass in a line, `cy` their middle: those lit give light, the rest are their dull outline. */
  private shineRow(kit: Kit, row: Extract<PanelRow, { kind: 'stars' }>, centre: number, cy: number): void {
    const { still } = row.shine!;
    const age = this.now - (this.shineFrom ?? this.now) - SHINE_WAIT_MS;
    const first = Math.round(centre - SHINE_STEP);
    const blaze = still || row.count < 3 ? 0 : blazeAt(age - BLAZE_FROM_MS);
    for (let i = 0; i < 3; i++) {
      const cx = first + i * SHINE_STEP;
      const since = still ? Infinity : age - i * SHINE_STEP_MS;
      // Its outline stays under it while it grows into it.
      if (i >= row.count || since < SHINE_GROW_MS) paintStarGhost(kit, cx, cy, SHINE_STAR, kit.palette.star);
      if (i >= row.count || since < 0) continue;
      const left = Math.max(0, 1 - since / SHINE_FLARE_MS);
      paintStar(kit, cx, cy, SHINE_STAR * shineSize(since), kit.palette.star, { flare: left * left, shimmer: 0, blaze });
    }
  }

  draw(kit: Kit, focus: ShellFocus): void {
    const { bg, ink, dim, faint } = kit.palette;
    const { plate, placed } = this.plan();
    if (this.alone) kit.fill(bg);
    else kit.veil();
    kit.box(plate, bg);
    kit.frame(plate, ink, true);
    const title = typeof this.spec.title === 'function' ? this.spec.title() : this.spec.title;
    // In the dark half of a blink the bar is only its line.
    kit.bar(plate, title.native, word(title.name), ink, bg, this.blink === 1);

    const left = plate.x + EDGE;
    const right = plate.x + plate.w - EDGE;
    for (const { row, box, shown } of placed) {
      switch (row.kind) {
        case 'field':
          kit.field(named(row.label), typeof row.value === 'function' ? row.value() : row.value, left, right, box.y, dim, ink);
          break;
        case 'number': {
          kit.text(named(row.label), left, box.y, dim);
          const text = digits(row.value, row.places);
          const zeros = Math.min(text.length - 1, text.length - String(Math.max(0, Math.round(row.value))).length);
          const after = kit.text(text.slice(0, zeros), left, box.y + CELL_H, faint, { scale: 2 });
          kit.text(text.slice(zeros), after, box.y + CELL_H, ink, { scale: 2, bold: true });
          break;
        }
        case 'standing': {
          kit.text(named(row.label), left, box.y, dim);
          const text = digits(row.value(), row.places);
          const zeros = Math.min(text.length - 1, text.length - String(Math.max(0, Math.round(row.value()))).length);
          const after = kit.text(text.slice(0, zeros), left, box.y + CELL_H, faint, { scale: 2 });
          kit.text(text.slice(zeros), after, box.y + CELL_H, ink, { scale: 2, bold: true });
          // The place at the right edge, and after it how many lines the log has, at the size of a label.
          kit.text(named(row.rank), right, box.y, dim, { align: 'right' });
          const of = `/${digits(row.of(), 2)}`;
          const ofStart = right - kit.measure(of);
          kit.text(of, ofStart, box.y + CELL_H * 2, dim);
          const place = digits(row.place(), 2);
          const placeStart = ofStart - 3 - kit.measure(place, 2);
          const lit = row.lit();
          if (lit) kit.rect(placeStart - 2, box.y + CELL_H, kit.measure(place, 2) + 4, CELL_H * 2, ink);
          kit.text(place, placeStart, box.y + CELL_H, lit ? bg : ink, { scale: 2, bold: true });
          break;
        }
        case 'command':
          this.drawCommand(kit, row, box, focus);
          break;
        case 'commands':
          this.partsOf(box, row.commands).forEach((part, i) => this.drawCommand(kit, row.commands[i], part, focus));
          break;
        case 'switch': {
          const on = focus.focus === row.id;
          const pressed = focus.pressed === row.id;
          kit.frame(box, on ? ink : faint);
          if (on) kit.mark(box);
          const y = box.y + Math.round((box.h - CELL_H) / 2);
          kit.field(named(row.label), row.value(), box.x + 2 * EDGE, box.x + box.w - EDGE, y, pressed ? ink : dim, ink);
          break;
        }
        case 'tabs': {
          const selected = row.selected();
          const labels = row.labels();
          labels.forEach((label, i) => {
            const part = this.part(box, i, labels.length);
            const y = part.y + Math.round((part.h - CELL_H) / 2);
            if (i === selected) {
              kit.box(part, ink);
              kit.text(label, part.x + part.w / 2, y, bg, { align: 'center', bold: true });
            } else {
              kit.frame(part, focus.focus === `${row.id}-${i}` ? ink : faint);
              kit.text(label, part.x + part.w / 2, y, dim, { align: 'center' });
            }
          });
          break;
        }
        case 'table': {
          const all = row.rows();
          const count = this.tableLines(row.lines, box.h - TABLE_HEAD);
          const own = all.findIndex((line) => line[2]);
          // The line of the one who is playing lies below what is in sight: the last rows show
          // it with the lines next to it, under a line that says the log is cut there.
          const near = this.logTop === null && own >= count ? Math.min(NEAR_ROWS, count - (count > NEAR_ROWS ? 3 : 1)) : 0;
          const top = Math.min(this.logTop ?? 0, Math.max(0, all.length - count));
          const from = Math.min(Math.max(own - Math.floor(near / 2), count - near), all.length - near);
          const rows = near > 0 ? [...all.slice(0, count - near), ...all.slice(from, from + near)] : all.slice(top, top + count);
          kit.text('No.', left, box.y, dim);
          kit.text(row.head(), left + CELL_W * 4, box.y, dim);
          const status = row.status?.() ?? '';
          if (status) kit.text(status, right, box.y, dim, { align: 'right' });
          kit.rect(left, box.y + TABLE_HEAD - 2, right - left, 1, faint);
          if (rows.length === 0) kit.text(row.empty(), plate.x + plate.w / 2, box.y + TABLE_HEAD, dim, { align: 'center' });
          if (near > 0 && count > near) kit.dither(left, box.y + TABLE_HEAD - 1 + (count - near) * CELL_H, right - left, 1, dim, 4);
          rows.forEach(([label, value, mine, place], i) => {
            const y = box.y + TABLE_HEAD + i * CELL_H;
            const rank = place ?? top + i + 1;
            kit.text(digits(rank, 2), left, y, mine ? ink : dim);
            const labelEnd = kit.text(label, left + CELL_W * 4, y, mine ? ink : dim, { bold: mine === true });
            const valueStart = right - kit.measure(value);
            kit.text(value, valueStart, y, ink, { bold: rank === 1 || mine === true });
            kit.leader(labelEnd + CELL_W, valueStart - CELL_W, y, faint);
          });
          this.scrollBar(kit, plate.x + plate.w - SCROLL_IN - SCROLL_W, box.y + TABLE_HEAD, count * CELL_H, near > 0 ? 0 : top, count, all.length);
          break;
        }
        case 'climb': {
          const count = this.tableLines(row.lines, box.h);
          const range = row.range?.(count);
          if (range && range[0] < range[1]) this.scrollBar(kit, plate.x + plate.w - SCROLL_IN - SCROLL_W, box.y, count * CELL_H, this.logShift - range[0], count, range[1] - range[0] + count);
          const lines = row.rows(count, this.logShift);
          lines.forEach((line, i) => {
            if (!line) return;
            const y = box.y + i * CELL_H;
            const run = line.tone === 'run';
            const full = run || line.tone === 'own';
            // The session itself is a filled bar across the panel, with the red mark of the seventh on it at its left end.
            if (run) {
              kit.rect(plate.x + 2, y, plate.w - 4, CELL_H, ink);
              kit.mark({ x: plate.x, y, w: plate.w, h: CELL_H }, plate.x + 2);
            }
            const tone = run ? bg : full || line.tone === 'lit' ? ink : dim;
            kit.text(digits(line.place, 2), left, y, tone, { bold: run });
            const nameEnd = kit.text(line.name, left + CELL_W * 4, y, tone, { bold: full });
            const value = digits(line.score, 6);
            const valueStart = right - kit.measure(value);
            kit.text(value, valueStart, y, run ? bg : ink, { bold: full });
            if (!run) kit.leader(nameEnd + CELL_W, valueStart - CELL_W, y, faint);
          });
          break;
        }
        case 'levels': {
          const view = this.levelView(row, box, shown);
          kit.within(view.window, () => view.cells.forEach((cell, i) => {
            if (!this.inSight(view, i)) return;
            const id = `${row.id}-${i}`;
            const on = focus.focus === id;
            kit.frame(cell, on || i === row.current ? ink : faint);
            this.levelCell(kit, cell, digits(i + 1, 2), row.levels[i].stars, row.marks ?? 3, row.levels[i].closed === true);
            // In focus: a ring round the cell, a little out from it, and the red mark of the seventh in its corner.
            if (on) {
              kit.frame({ x: cell.x - CELL_RING, y: cell.y - CELL_RING, w: cell.w + 2 * CELL_RING, h: cell.h + 2 * CELL_RING }, focus.pressed === id ? faint : ink);
              kit.rect(cell.x + 2, cell.y + 2, MARK, MARK, kit.palette.signal);
            }
          }));
          // Where it scrolls, a thin bar at each side, alike (the owner, 5 November 2026: «очень тонкие скроллбары, симметрично»).
          for (const x of this.levelBars(plate)) this.scrollBar(kit, x, box.y, view.window.h - 2 * CELL_RING, view.from, view.shown, view.rows);
          break;
        }
        case 'stars':
          // A star with a point up reaches higher than lower: its middle stands a little low, so that it sits in the middle of its line.
          if (row.shine) this.shineRow(kit, row, plate.x + plate.w / 2, box.y + Math.floor(box.h / 2) + Math.round(SHINE_STAR * 0.1));
          else this.starRow(kit, row.count, 3, plate.x + plate.w / 2, box.y + Math.floor(box.h / 2), RESULT_STAR, RESULT_STAR_STEP, kit.palette.star);
          break;
        case 'say':
          if (row.when?.() ?? true) {
            const reveal = row.after === undefined ? undefined : Math.max(0, this.typed - row.after);
            this.context.voice.say({ text: row.text, box: kit.toWindow(box), size: saySize(row, kit.zoom, kit.width > kit.height), align: 'left', dim: row.dim, reveal, after: row.after });
          }
          break;
        case 'gap':
          break;
      }
    }
  }

  /**
   * What says a list scrolls: a strip two dots wide between its lines and a frame of the panel, at
   * `x`, as tall as its lines in sight - half seen in the faint tone, with the part in sight solid
   * in the dim one, where it stands and as much of the strip as is in sight of the whole. Only
   * where the list has more than is in sight. It is not pressed.
   */
  private scrollBar(kit: Kit, x: number, y: number, tall: number, first: number, shown: number, total: number): void {
    if (total <= shown + 1e-6 || tall <= 0) return;
    const { dim, faint } = kit.palette;
    kit.dither(x, y, SCROLL_W, tall, faint, 2);
    const [at, thumb] = scrollThumb(tall, first, shown, total);
    kit.rect(x, y + at, SCROLL_W, thumb, dim);
  }

  /** Where the bars of a list stand across a panel: at its left and at its right, as far from each frame. */
  private levelBars(plate: Box): [number, number] {
    return [plate.x + SCROLL_IN, plate.x + plate.w - SCROLL_IN - SCROLL_W];
  }

  /**
   * The cell of a board in the list of the levels (the owner, 30 October 2026): what it has
   * earned is the cell filled from the bottom in the light of the stars, a third to a star, the
   * whole cell for three; its number at the size of the font in the middle, dark where the fill
   * is behind it and light above, the line between them running through the signs.
   */
  private levelCell(kit: Kit, cell: Box, label: string, stars: number, marks: number, closed = false): void {
    const { bg, ink, faint } = kit.palette;
    // A closed cell: its number in the faint tone, nothing else.
    if (closed) {
      kit.text(label, cell.x + cell.w / 2, Math.round(cell.y + (cell.h - CELL_H) / 2), faint, { align: 'center', bold: true });
      return;
    }
    const fill = Math.round((cell.h * Math.max(0, Math.min(marks, stars))) / Math.max(1, marks));
    const line = cell.y + cell.h - fill;
    if (fill > 0) kit.rect(cell.x, line, cell.w, fill, kit.palette.star.light);
    const x = cell.x + cell.w / 2;
    const y = Math.round(cell.y + (cell.h - CELL_H) / 2);
    if (fill < cell.h) kit.within({ x: cell.x, y: cell.y, w: cell.w, h: line - cell.y }, () => kit.text(label, x, y, ink, { align: 'center', bold: true }));
    if (fill > 0) kit.within({ x: cell.x, y: line, w: cell.w, h: fill }, () => kit.text(label, x, y, bg, { align: 'center', bold: true }));
  }

  /** Small stars in a row around `centre`, their middles `step` apart and at `cy`: as many held as `count`. */
  private starRow(kit: Kit, count: number, of: number, centre: number, cy: number, radius: number, step: number, colours: StarColours): void {
    const first = Math.round(centre - (step * (of - 1)) / 2);
    for (let i = 0; i < of; i++) paintStarSmall(kit, first + i * step, cy, radius, colours, i < count);
  }

  private drawCommand(kit: Kit, command: PanelCommand, box: Box, focus: ShellFocus): void {
    const { bg, ink, dim, faint } = kit.palette;
    const on = focus.focus === command.id;
    const pressed = focus.pressed === command.id;
    const text = named(command.label);
    // A large command has its word twice the size where it fits so; a narrow part has room for the name alone.
    const room = box.w - COMMAND_ROOM;
    const scale = command.large && Math.min(kit.measure(text, 2), kit.measure(word(command.label.name), 2)) <= room ? 2 : 1;
    const label = kit.measure(text, scale) > room ? word(command.label.name) : text;
    const y = box.y + Math.round((box.h - CELL_H * scale) / 2);
    if (on && !pressed) {
      kit.box(box, ink);
      kit.text(label, box.x + box.w / 2, y, bg, { align: 'center', bold: true, scale });
    } else {
      kit.frame(box, on ? ink : faint);
      kit.text(label, box.x + box.w / 2, y, on ? ink : dim, { align: 'center', scale });
    }
    if (on) kit.mark(box);
  }

  /** One of `count` equal parts of a line, side by side. */
  /** The parts of a line of commands side by side: as `commandParts` has them, or equal where nothing fits. */
  private partsOf(box: Box, commands: readonly PanelCommand[]): Box[] {
    return commandParts(box, commands) ?? commands.map((_command, i) => this.part(box, i, commands.length));
  }

  private part(box: Box, index: number, count: number): Box {
    const width = Math.floor((box.w - GAP * (count - 1)) / count);
    return { x: box.x + index * (width + GAP), y: box.y, w: index === count - 1 ? box.x + box.w - (box.x + index * (width + GAP)) : width, h: box.h };
  }

  /** Cells across a list `width` wide: six on a tall picture, on a wide one as many as are `LEVEL_CELL_W` wide. */
  private levelColumns(width: number): number {
    const picture = this.context.picture();
    if (picture.width <= picture.height) return LEVELS_TALL;
    return Math.max(LEVELS_TALL, Math.floor((width + CELL_GAP) / (LEVEL_CELL_W + CELL_GAP)));
  }

  /** CSS pixels of the window to a pixel of the picture. */
  private zoom(): number {
    return this.context.window().height / Math.max(1, this.context.picture().height);
  }

  /**
   * Height of a button of a panel - a command, a setting, a tab, an arrow of a list: as tall as a
   * finger needs, drawn so and not only pressed so (the owner, 30 October 2026: the buttons of the
   * panels larger on a phone, on the grid). A button where a finger is no taller.
   */
  private buttonHeight(): number {
    return fingerOf(this.zoom());
  }

  /** Height of a cell of the list: what a finger needs, and no lower than its number and its stars take. */
  private cellHeight(): number {
    return this.cellTall ?? Math.max(CELL_LEAST, fingerOf(this.zoom()));
  }

  /**
   * The cells of the list, row after row.
   */
  private levelCells(row: Extract<PanelRow, { kind: 'levels' }>, box: Box): Box[] {
    const columns = this.levelColumns(box.w);
    const tall = this.cellHeight();
    const wide = Math.floor((box.w - CELL_GAP * (columns - 1)) / columns);
    // The dots the whole cells leave over are shared to both sides.
    const left = box.x + Math.floor((box.w - (wide * columns + CELL_GAP * (columns - 1))) / 2);
    return row.levels.map((_, slot) => ({
      x: left + (slot % columns) * (wide + CELL_GAP),
      y: box.y + Math.floor(slot / columns) * (tall + CELL_GAP),
      w: wide,
      h: tall,
    }));
  }

  /** Rows of cells the list of the levels takes. */
  private levelRows(row: Extract<PanelRow, { kind: 'levels' }>, width: number): number {
    const cells = this.levelCells(row, { x: 0, y: 0, w: width, h: 0 });
    return cells.length === 0 ? 0 : Math.round(cells[cells.length - 1].y / (this.cellHeight() + CELL_GAP)) + 1;
  }

  /** Height of the list of the levels with `shown` of its `rows` rows of cells in sight; a share of a row is a row cut at the bottom. */
  private levelsHeight(rows: number, shown: number): number {
    const seen = Math.min(rows, shown);
    return Math.round(seen * (this.cellHeight() + CELL_GAP) - CELL_GAP);
  }

  /**
   * The cells of the list as they stand in its box: the rows out of sight above it are taken off the
   * top, so that the first row in sight lies at the top of the box (`top`, laid out by `plan`).
   */
  private levelView(row: Extract<PanelRow, { kind: 'levels' }>, box: Box, inSight = Infinity): LevelView {
    const step = this.cellHeight() + CELL_GAP;
    const laid = this.levelCells(row, { x: box.x, y: 0, w: box.w, h: 0 });
    const rowOf = laid.map((cell) => Math.round(cell.y / step));
    const rows = rowOf.length === 0 ? 0 : rowOf[rowOf.length - 1] + 1;
    const shown = Math.max(1, Math.min(rows, inSight));
    const from = Math.max(0, Math.min(this.top ?? 0, rows - shown));
    const top = box.y;
    // On whole dots, wherever between rows the list stands.
    const cells = laid.map((cell, i) => ({ ...cell, y: top + Math.round((rowOf[i] - from) * step) }));
    const window = { x: box.x - CELL_RING, y: top - CELL_RING, w: box.w + 2 * CELL_RING, h: Math.round(shown * step - CELL_GAP) + 2 * CELL_RING };
    return { cells, rowOf, from, shown, rows, window };
  }

  /** Some of the cell is in sight: it is drawn, cut at the edge of the list, and takes a press there. */
  private inSight(view: LevelView, index: number): boolean {
    const cell = view.cells[index];
    return cell.y + cell.h > view.window.y && cell.y < view.window.y + view.window.h;
  }

  /** All of the row is in sight. */
  private rowWhole(view: LevelView, row: number): boolean {
    return row >= view.from - 1e-6 && row <= view.from + view.shown - 1 + 1e-6;
  }

  /** The list of the levels, where the panel has one, and how it lies. */
  private levels(): { row: Extract<PanelRow, { kind: 'levels' }>; view: LevelView } | null {
    const placed = this.plan().placed.find((one) => one.row.kind === 'levels');
    if (!placed || placed.row.kind !== 'levels') return null;
    return { row: placed.row, view: this.levelView(placed.row, placed.box, placed.shown) };
  }

  /** The cell of a row of the list nearest across to a cell, by the middles. */
  private nearestIn(view: LevelView, target: number, index: number): number {
    const middle = (i: number): number => view.cells[i].x + view.cells[i].w / 2;
    let best = -1;
    view.cells.forEach((_cell, i) => {
      if (view.rowOf[i] === target && (best < 0 || Math.abs(middle(i) - middle(index)) < Math.abs(middle(best) - middle(index)))) best = i;
    });
    return best;
  }

  /**
   * A key up or down on a cell of a list that scrolls: where the row that way lies out of sight,
   * the list goes a row that way and the focus with it. Else the places of the zones say.
   */
  move(focus: string | null, dir: Dir4): string | null | undefined {
    const list = this.levels();
    if (!list || (dir !== 'up' && dir !== 'down') || focus === null || !focus.startsWith(`${list.row.id}-`)) return undefined;
    const { row, view } = list;
    const index = Number(focus.slice(row.id.length + 1));
    const target = view.rowOf[index] + (dir === 'down' ? 1 : -1);
    if (target < 0 || target >= view.rows || this.rowWhole(view, target)) return undefined;
    // The row that way comes in sight at the edge it is reached from, wherever the list stood (a turned window moves it).
    this.coast = 0;
    this.top = Math.max(0, Math.min(view.rows - view.shown, dir === 'down' ? target - view.shown + 1 : target));
    return `${row.id}-${this.nearestIn(view, target, index)}`;
  }

  /**
   * A finger drawn up or down over the panel, or the wheel of a mouse (`wheel`), so many CSS pixels of
   * the window: the list goes that many rows that way, a finger one at least, the wheel as its steps add
   * up to rows. The focus stays where it is still in sight, and goes to the nearest row in sight where it
   * is not. A finger drawn on a list at its end that way is taken all the same, and starts no level. Null
   * where the list fits, and where the wheel has not turned it a row.
   */
  scroll(dir: 'up' | 'down', pixels: number, focus: string | null, wheel = false): string | null {
    const list = this.levels();
    if (!list) return this.scrollLog(dir, pixels, focus, wheel);
    if (list.view.shown >= list.view.rows) return null;
    const { row, view } = list;
    const rowPixels = this.rowPixels();
    let by: number;
    if (wheel) {
      // A turn the other way drops what was added up this way.
      const signed = dir === 'down' ? pixels : -pixels;
      this.wheeled = Math.sign(this.wheeled) === -Math.sign(signed) ? signed : this.wheeled + signed;
      by = Math.trunc(Math.abs(this.wheeled) / rowPixels);
      if (by === 0) return null;
      this.wheeled -= Math.sign(this.wheeled) * by * rowPixels;
    } else by = Math.max(1, Math.round(pixels / rowPixels));
    // Steps of the wheel go by whole rows, from the row nearest where a finger left the list.
    const from = Math.max(0, Math.min(view.rows - view.shown, Math.round(view.from) + (dir === 'down' ? by : -by)));
    if (from === view.from) return wheel ? null : focus;
    this.coast = 0;
    this.top = from;
    const index = focus !== null && focus.startsWith(`${row.id}-`) ? Number(focus.slice(row.id.length + 1)) : -1;
    // The rows wholly in sight: the list stands between rows at its end, a row cut at the other edge.
    const first = Math.ceil(from - 1e-6);
    const last = Math.max(first, Math.floor(from + view.shown - 1 + 1e-6));
    if (index < 0) return focus ?? `${row.id}-${view.cells.findIndex((_cell, i) => view.rowOf[i] === first)}`;
    const near = Math.max(first, Math.min(last, view.rowOf[index]));
    return near === view.rowOf[index] ? focus : `${row.id}-${this.nearestIn(view, near, index)}`;
  }

  /**
   * A finger drawn up or down over a panel with a log, or the wheel: the log goes that many
   * lines that way, a finger one at least, the wheel as its steps add up to lines. The focus
   * stays. Null where the panel has no log, where the log all fits, and where the wheel has
   * not turned it a line.
   */
  private scrollLog(dir: 'up' | 'down', pixels: number, focus: string | null, wheel: boolean): string | null {
    const placed = this.plan().placed.find((one) => one.row.kind === 'table' || one.row.kind === 'climb');
    if (!placed) return null;
    const { row, box } = placed;
    const linePixels = CELL_H * this.zoom();
    let by: number;
    if (wheel) {
      const signed = dir === 'down' ? pixels : -pixels;
      this.wheeled = Math.sign(this.wheeled) === -Math.sign(signed) ? signed : this.wheeled + signed;
      by = Math.trunc(Math.abs(this.wheeled) / linePixels);
      if (by === 0) return null;
      this.wheeled -= Math.sign(this.wheeled) * by * linePixels;
    } else by = Math.max(1, Math.round(pixels / linePixels));
    const step = dir === 'down' ? by : -by;
    const kept = focus ?? this.home ?? null;
    if (row.kind === 'table') {
      const count = this.tableLines(row.lines, box.h - TABLE_HEAD);
      const total = row.rows().length;
      if (total <= count) return null;
      const top = Math.max(0, Math.min(total - count, (this.logTop ?? 0) + step));
      // At its end the wheel is not taken; a finger is, and presses nothing under it.
      if (top === (this.logTop ?? 0)) return wheel ? null : kept;
      this.logTop = top;
      return kept;
    }
    if (row.kind !== 'climb' || !row.range) return null;
    const [least, most] = row.range(this.tableLines(row.lines, box.h));
    if (least === most) return null;
    const shift = Math.max(least, Math.min(most, this.logShift + step));
    if (shift === this.logShift) return wheel ? null : kept;
    this.logShift = shift;
    return kept;
  }

  /** Rows of a log that fit in `room` pixels, and no more than `most`. */
  private tableLines(most: number, room: number): number {
    return Math.max(1, Math.min(most, Math.floor(room / CELL_H)));
  }

  /** Width of the panel on this picture, and of what stands inside it. */
  private widths(): { width: number; inner: number } {
    const picture = this.context.picture();
    const safe = this.context.safe();
    const across = picture.width - safe.left - safe.right - EDGE * 2;
    const width = this.spec.full ? across : Math.min(WIDTH, across);
    return { width, inner: width - EDGE * 2 };
  }

  /**
   * The lines of the panel as they stand on this picture: commands that stack on a tall one are
   * lines of their own there. Commands side by side whose words do not fit their parts go on in
   * as many lines as they need, as evenly as they can: four that do not fit one line stand two and two.
   */
  private rows(): readonly PanelRow[] {
    const picture = this.context.picture();
    const wide = picture.width > picture.height;
    const { inner } = this.widths();
    return this.spec.rows.flatMap((row): PanelRow[] => {
      if (row.kind !== 'commands') return [row];
      if (!wide && row.stacked) return row.commands.map((command) => ({ kind: 'command', ...command }));
      const { commands } = row;
      for (let lines = 1; lines < commands.length; lines++) {
        const across = Math.ceil(commands.length / lines);
        const split: (typeof commands)[] = [];
        for (let i = 0; i < commands.length; i += across) split.push(commands.slice(i, i + across));
        if (split.every((line) => commandParts({ x: 0, y: 0, w: inner, h: 0 }, line) !== null)) {
          return lines === 1 ? [row] : split.map((line): PanelRow => ({ kind: 'commands', commands: line }));
        }
      }
      return commands.map((command) => ({ kind: 'command', ...command }));
    });
  }

  /**
   * Where the panel stands and where each of its lines is, in pixels of the picture: the frame, the
   * bar of the name, a gap, and every line with a gap after it, the last gap the edge at the bottom.
   */
  private plan(): { plate: Box; placed: Placed[] } {
    const picture = this.context.picture();
    const safe = this.context.safe();
    const zoom = this.zoom();
    const { width, inner } = this.widths();
    const room = picture.height - safe.top - safe.bottom - EDGE * 2;
    // The cells are as tall as a finger, till a panel on the whole screen grows them below.
    this.cellTall = null;

    // Rows of cells of the levels in sight: all of them, unless the panel would grow past the screen.
    let shown = Infinity;
    const height = (row: PanelRow, lines: number): number => {
      switch (row.kind) {
        case 'field':
          return CELL_H;
        case 'stars':
          return row.shine ? SHINE_H : CELL_H;
        case 'number':
        case 'standing':
          return CELL_H * 3;
        case 'command':
          return row.large ? Math.max(BUTTON_H * 2, this.buttonHeight()) : this.buttonHeight();
        case 'commands':
        case 'switch':
        case 'tabs':
          return this.buttonHeight();
        case 'table':
          return TABLE_HEAD + Math.min(lines, row.lines) * CELL_H;
        case 'climb':
          return Math.min(lines, row.lines) * CELL_H;
        case 'levels':
          return this.levelsHeight(this.levelRows(row, inner), shown);
        case 'say': {
          const size = saySize(row, zoom, picture.width > picture.height);
          const tallest = Math.max(...[row.text, ...(row.room ?? [])].map((text) => this.context.voice.height(text, inner * zoom, size)));
          return ceilTo(tallest / zoom, UNIT);
        }
        case 'gap':
          return row.h ?? GAP;
      }
    };
    // A log gives up lines before the panel grows past the screen.
    const rows = this.rows();
    let lines = Math.max(0, ...rows.map((row) => (row.kind === 'table' || row.kind === 'climb' ? row.lines : 0)));
    const total = (): number => 1 + BAR_H + GAP + rows.reduce((sum, row) => sum + height(row, lines) + GAP, 0) + 1;
    while (lines > 3 && total() > room) lines--;
    // The list of the levels gives up rows and scrolls, before the panel grows past the screen.
    const list = rows.find((row) => row.kind === 'levels');
    if (list?.kind === 'levels') {
      shown = this.levelRows(list, inner);
      while (shown > LEVELS_SHOWN_MIN && total() > room) shown--;
      // On the whole screen, the cells grow till the list fills the room left over with a row cut at its bottom.
      if (this.spec.full && shown < this.levelRows(list, inner)) {
        const fit = cutRows(room - total() + this.levelsHeight(Infinity, shown), this.cellHeight(), shown);
        this.cellTall = fit.cell;
        shown = fit.shown;
      }
      // The first time, the row of the cell of the place stands in sight, about the middle.
      if (this.top === null) {
        const step = this.cellHeight() + CELL_GAP;
        const rowOf = this.levelCells(list, { x: 0, y: 0, w: inner, h: 0 }).map((cell) => Math.round(cell.y / step));
        this.top = Math.max(0, (rowOf[list.current] ?? 0) - Math.floor(shown / 2));
      }
    }

    const tall = total();
    // On the whole screen, what is left over stands before the last line, which stands at the bottom.
    const spare = this.spec.full ? Math.max(0, room - tall) : 0;
    const plate: Box = {
      x: Math.round(safe.left + (picture.width - safe.left - safe.right - width) / 2),
      y: Math.round(safe.top + EDGE + (this.spec.full ? 0 : Math.max(0, (room - tall) / 2))),
      w: width,
      h: tall + spare,
    };
    const placed: Placed[] = [];
    let y = plate.y + 1 + BAR_H + GAP;
    for (const [i, row] of rows.entries()) {
      if (i === rows.length - 1) y += spare;
      const h = height(row, lines);
      placed.push({ row, box: { x: plate.x + EDGE, y, w: inner, h }, ...(row.kind === 'levels' ? { shown } : {}) });
      y += h + GAP;
    }
    return { plate, placed };
  }

  /** The zones that take a press: every button, grown by its field where a finger needs more (`zoneOf`). */
  private zones(): ShellItem[] {
    const items: ShellItem[] = [];
    const zoom = this.zoom();
    // A zone may be cut to a part of the picture (`within`) after it has grown.
    const toWindow = (drawn: Box, within?: Box) => {
      let box = zoneOf(drawn, zoom);
      if (within) {
        const y = Math.max(box.y, within.y);
        box = { ...box, y, h: Math.min(box.y + box.h, within.y + within.h) - y };
      }
      const window = this.context.window();
      const picture = this.context.picture();
      const sx = window.width / Math.max(1, picture.width);
      const sy = window.height / Math.max(1, picture.height);
      return { x: box.x * sx, y: box.y * sy, width: box.w * sx, height: box.h * sy };
    };
    for (const { row, box, shown } of this.plan().placed) {
      if (row.kind === 'command') items.push({ id: row.id, rect: toWindow(box), action: row.action, instant: row.instant });
      else if (row.kind === 'switch') items.push({ id: row.id, rect: toWindow(box), action: row.action });
      else if (row.kind === 'commands') {
        this.partsOf(box, row.commands).forEach((part, i) => {
          const command = row.commands[i];
          items.push({ id: command.id, rect: toWindow(part), action: command.action, instant: command.instant });
        });
      } else if (row.kind === 'tabs') {
        const count = row.labels().length;
        for (let i = 0; i < count; i++) items.push({ id: `${row.id}-${i}`, rect: toWindow(this.part(box, i, count)), action: () => row.pick(i) });
      } else if (row.kind === 'levels') {
        const view = this.levelView(row, box, shown);
        // A cell half in sight takes a press in the part of it that is.
        view.cells.forEach((cell, i) => {
          if (this.inSight(view, i) && row.levels[i].closed !== true) items.push({ id: `${row.id}-${i}`, rect: toWindow(cell, view.window), action: () => row.pick(i) });
        });
      }
    }
    return items;
  }
}
