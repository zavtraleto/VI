import type { ClimbRow } from '../climb';
import type { Kit } from '../kit';
import { CELL_H, CELL_W, MIN_ZONE, type Box } from '../layout';
import type { ShellContext, ShellFocus, ShellItem, ShellScreen } from '../screen';
import { word } from '../../ui/i18n';
import { PANEL_SAY_SIZE } from '../theme';
import { digits, type PanelName } from '../text';

/** Something a panel can be told to do: a line that is pressed. */
export interface PanelCommand {
  id: string;
  label: PanelName;
  action: () => void;
  /** It acts inside the press itself: see `ShellItem.instant`. */
  instant?: boolean;
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
  | { kind: 'climb'; rows: (count: number) => readonly (ClimbRow | null)[]; lines: number }
  /**
   * The tasks, as numbered cells with what each has earned; `note` is said under them for the cell
   * in focus. `marks` is how many a cell can earn, three when left out. With `program` the note
   * is the program's own text and is written in its font, not said in the voice. A cell that is
   * `locked` is drawn faint and without marks: it can be looked at, and what picking it does is
   * the panel's to say.
   */
  | {
      kind: 'levels';
      id: string;
      levels: readonly { stars: number; locked?: boolean }[];
      current: number;
      pick: (index: number) => void;
      note: (index: number) => string;
      marks?: number;
      program?: boolean;
    }
  /** What a task has earned, out of three. */
  | { kind: 'stars'; count: number }
  /**
   * Prose in the language of the player, in the voice. With `when`, its room is kept and it is
   * said once that holds. With `after`, its words are typed out, once so many signs of the
   * panel have come: see `typed` of the panel. With `large`, its letters are as tall as a line
   * of the program's own font and grow with the window: what a player has to read to play.
   * With `room`, the line is as tall as the tallest of those texts takes, whichever it says.
   */
  | { kind: 'say'; text: string; size?: number; dim?: boolean; when?: () => boolean; after?: number; large?: boolean; room?: readonly string[] }
  | { kind: 'gap' };

/**
 * A line of a log. `own` marks the line of the one who is playing: it is written in full
 * tone and, when it lies below what the log has room for, the last rows show it with the lines
 * next to it. `place` stands in for the count of lines where the log has places of its own.
 */
export type TableLine = readonly [label: string, value: string, own?: boolean, place?: number];

export interface PanelSpec {
  title: PanelName | (() => PanelName);
  rows: readonly PanelRow[];
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

/** Widest a panel gets, in pixels of the picture. */
const WIDTH = 264;
const MARGIN = 8;
const PAD = 8;
/** Space between two lines that are pressed. */
const GAP = 4;
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
/** Cells of tasks across a tall picture and across a wide one. */
const LEVELS_TALL = 6;
const LEVELS_WIDE = 10;
/** Half a blink of the bar of the name, in milliseconds. */
const BLINK_MS = 110;
/** Rows a log keeps for the line of the one who plays and the lines next to it. */
const NEAR_ROWS = 5;

interface Placed {
  row: PanelRow;
  box: Box;
}

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
export class PanelScreen implements ShellScreen {
  readonly home?: string;
  /** Which half of a blink the bar of the name is in; -1 while it does not blink. */
  private blink = -1;
  /** Signs of the words that are typed out that are there. */
  private typed = 0;

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

  draw(kit: Kit, focus: ShellFocus): void {
    const { bg, ink, dim, faint } = kit.palette;
    const { plate, placed } = this.plan();
    if (this.alone) kit.fill(bg);
    else kit.veil();
    kit.box(plate, bg);
    kit.frame(plate, ink, true);
    const title = typeof this.spec.title === 'function' ? this.spec.title() : this.spec.title;
    // In the dark half of a blink the bar is only its line.
    const hollow = this.blink === 1;
    if (hollow) kit.rect(plate.x + 1, plate.y + CELL_H + 1, plate.w - 2, 1, ink);
    else kit.rect(plate.x + 1, plate.y + 1, plate.w - 2, CELL_H + 1, ink);
    kit.text(title.native, plate.x + 6, plate.y + 1, hollow ? ink : bg, { bold: true });
    kit.text(word(title.name), plate.x + plate.w - 6, plate.y + 1, hollow ? ink : bg, { align: 'right', bold: true });

    const left = plate.x + PAD;
    const right = plate.x + plate.w - PAD;
    for (const { row, box } of placed) {
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
          row.commands.forEach((command, i) => this.drawCommand(kit, command, this.part(box, i, row.commands.length), focus));
          break;
        case 'switch': {
          const on = focus.focus === row.id;
          const pressed = focus.pressed === row.id;
          kit.frame(box, on ? ink : faint);
          if (on) this.mark(kit, box);
          const y = box.y + Math.round((box.h - CELL_H) / 2);
          kit.field(named(row.label), row.value(), box.x + 14, box.x + box.w - 8, y, pressed ? ink : dim, ink);
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
          const count = this.tableLines(row.lines, box.h - CELL_H);
          const own = all.findIndex((line) => line[2]);
          // The line of the one who is playing lies below what is in sight: the last rows show
          // it with the lines next to it, under a line that says the log is cut there.
          const near = own >= count ? Math.min(NEAR_ROWS, count - (count > NEAR_ROWS ? 3 : 1)) : 0;
          const from = Math.min(Math.max(own - Math.floor(near / 2), count - near), all.length - near);
          const rows = near > 0 ? [...all.slice(0, count - near), ...all.slice(from, from + near)] : all.slice(0, count);
          kit.text('No.', left, box.y, dim);
          kit.text(row.head(), left + CELL_W * 4, box.y, dim);
          const status = row.status?.() ?? '';
          if (status) kit.text(status, right, box.y, dim, { align: 'right' });
          kit.rect(left, box.y + CELL_H - 1, right - left, 1, faint);
          if (rows.length === 0) kit.text(row.empty(), plate.x + plate.w / 2, box.y + CELL_H + 4, dim, { align: 'center' });
          if (near > 0 && count > near) kit.dither(left, box.y + CELL_H + 1 + (count - near) * CELL_H, right - left, 1, dim, 4);
          rows.forEach(([label, value, mine, place], i) => {
            const y = box.y + CELL_H + 2 + i * CELL_H;
            kit.text(digits(place ?? i + 1, 2), left, y, mine ? ink : dim);
            const labelEnd = kit.text(label, left + CELL_W * 4, y, mine ? ink : dim, { bold: mine === true });
            const valueStart = right - kit.measure(value);
            kit.text(value, valueStart, y, ink, { bold: i === 0 || mine === true });
            kit.leader(labelEnd + CELL_W, valueStart - CELL_W, y, faint);
          });
          break;
        }
        case 'climb': {
          const lines = row.rows(this.tableLines(row.lines, box.h));
          lines.forEach((line, i) => {
            if (!line) return;
            const y = box.y + 2 + i * CELL_H;
            const run = line.tone === 'run';
            const full = run || line.tone === 'own';
            // The session itself is a filled bar across the panel, with the red mark of the seventh on it.
            if (run) {
              kit.rect(plate.x + 2, y, plate.w - 4, CELL_H, ink);
              this.mark(kit, { x: plate.x - 3, y, w: 0, h: CELL_H });
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
          let noted = row.current;
          this.levelCells(row, box).forEach((cell, i) => {
            const id = `${row.id}-${i}`;
            const on = focus.focus === id;
            if (on) noted = i;
            const filled = on && focus.pressed !== id;
            if (row.levels[i].locked) {
              // A level that is shut: its number alone, faint, in a frame that only focus lights.
              kit.frame(cell, on ? dim : faint);
              kit.text(digits(i + 1, 2), cell.x + cell.w / 2, cell.y + 2, on ? dim : faint, { align: 'center' });
              return;
            }
            if (filled) kit.box(cell, ink);
            else kit.frame(cell, on || i === row.current ? ink : faint);
            kit.text(digits(i + 1, 2), cell.x + cell.w / 2, cell.y + 2, filled ? bg : ink, { align: 'center' });
            this.stars(kit, row.levels[i].stars, cell.x + cell.w / 2, cell.y + cell.h - 7, 4, filled ? bg : ink, filled ? bg : faint, row.marks);
          });
          const note = row.note(noted);
          const line: Box = { x: left, y: box.y + box.h - CELL_H - 2, w: right - left, h: CELL_H + 2 };
          if (row.program) kit.text(note, Math.round(line.x + line.w / 2), line.y + 1, dim, { align: 'center' });
          else this.context.voice.say({ text: note, box: kit.toWindow(line), size: PANEL_SAY_SIZE - 2, dim: true, anchor: 'middle' });
          break;
        }
        case 'stars':
          this.stars(kit, row.count, plate.x + plate.w / 2, box.y + 3, 10, ink, faint);
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

  /** The red mark of the seventh, on the line it stands at. */
  private mark(kit: Kit, box: Box): void {
    kit.rect(box.x + 5, box.y + Math.round(box.h / 2) - 2, 5, 5, kit.palette.signal);
  }

  /** Squares in a row around `centre`, three unless `of` says otherwise: as many filled as there are stars. */
  private stars(kit: Kit, count: number, centre: number, y: number, side: number, on: string, off: string, of = 3): void {
    const step = side + Math.max(2, Math.round(side / 2));
    const start = Math.round(centre - (step * of - (step - side)) / 2);
    for (let i = 0; i < of; i++) {
      const cell: Box = { x: start + i * step, y, w: side, h: side };
      if (i < count) kit.box(cell, on);
      else kit.frame(cell, off);
    }
  }

  private drawCommand(kit: Kit, command: PanelCommand, box: Box, focus: ShellFocus): void {
    const { bg, ink, dim, faint } = kit.palette;
    const on = focus.focus === command.id;
    const pressed = focus.pressed === command.id;
    const y = box.y + Math.round((box.h - CELL_H) / 2);
    const text = named(command.label);
    // A narrow part has room for the name alone.
    const label = kit.measure(text) > box.w - 20 ? word(command.label.name) : text;
    if (on && !pressed) {
      kit.box(box, ink);
      kit.text(label, box.x + box.w / 2, y, bg, { align: 'center', bold: true });
    } else {
      kit.frame(box, on ? ink : faint);
      kit.text(label, box.x + box.w / 2, y, on ? ink : dim, { align: 'center' });
    }
    if (on) this.mark(kit, box);
  }

  /** One of `count` equal parts of a line, side by side. */
  private part(box: Box, index: number, count: number): Box {
    const width = Math.floor((box.w - GAP * (count - 1)) / count);
    return { x: box.x + index * (width + GAP), y: box.y, w: index === count - 1 ? box.x + box.w - (box.x + index * (width + GAP)) : width, h: box.h };
  }

  private levelColumns(): number {
    const picture = this.context.picture();
    return picture.width > picture.height ? LEVELS_WIDE : LEVELS_TALL;
  }

  private levelCells(row: Extract<PanelRow, { kind: 'levels' }>, box: Box): Box[] {
    const columns = this.levelColumns();
    const tall = this.zone();
    const wide = Math.floor((box.w - GAP * (columns - 1)) / columns);
    return row.levels.map((_, i) => ({
      x: box.x + (i % columns) * (wide + GAP),
      y: box.y + Math.floor(i / columns) * (tall + GAP),
      w: wide,
      h: tall,
    }));
  }

  /** Height of a line that is pressed: what a finger needs, whatever the picture is. */
  private zone(): number {
    const picture = this.context.picture();
    const zoom = this.context.window().height / Math.max(1, picture.height);
    return Math.max(CELL_H + 8, ceilTo(MIN_ZONE / Math.max(0.1, zoom), 4));
  }

  /** Rows of a log that fit in `room` pixels, and no more than `most`. */
  private tableLines(most: number, room: number): number {
    return Math.max(1, Math.min(most, Math.floor((room - 4) / CELL_H)));
  }

  /** The lines of the panel as they stand on this picture: commands that stack on a tall one are lines of their own there. */
  private rows(): readonly PanelRow[] {
    const picture = this.context.picture();
    if (picture.width > picture.height) return this.spec.rows;
    return this.spec.rows.flatMap((row): PanelRow[] => (row.kind === 'commands' && row.stacked ? row.commands.map((command) => ({ kind: 'command', ...command })) : [row]));
  }

  /** Where the panel stands and where each of its lines is, in pixels of the picture. */
  private plan(): { plate: Box; placed: Placed[] } {
    const picture = this.context.picture();
    const safe = this.context.safe();
    const zoom = this.context.window().height / Math.max(1, picture.height);
    const zone = this.zone();
    const width = Math.min(WIDTH, picture.width - safe.left - safe.right - MARGIN * 2);
    const inner = width - PAD * 2;
    const room = picture.height - safe.top - safe.bottom - MARGIN * 2;

    const height = (row: PanelRow, lines: number): number => {
      switch (row.kind) {
        case 'field':
          return CELL_H + 2;
        case 'number':
        case 'standing':
          return CELL_H * 3 + 4;
        case 'command':
        case 'commands':
        case 'switch':
        case 'tabs':
          return zone + GAP;
        case 'table':
          return CELL_H + 4 + Math.min(lines, row.lines) * CELL_H;
        case 'climb':
          return 4 + Math.min(lines, row.lines) * CELL_H;
        case 'levels':
          return Math.ceil(row.levels.length / this.levelColumns()) * (zone + GAP) + CELL_H + 4;
        case 'stars':
          return CELL_H + 4;
        case 'say': {
          const size = saySize(row, zoom, picture.width > picture.height);
          const tallest = Math.max(...[row.text, ...(row.room ?? [])].map((text) => this.context.voice.height(text, inner * zoom, size)));
          return Math.ceil(tallest / zoom) + 6;
        }
        case 'gap':
          return 6;
      }
    };
    // A log gives up lines before the panel grows past the screen.
    const rows = this.rows();
    let lines = Math.max(0, ...rows.map((row) => (row.kind === 'table' || row.kind === 'climb' ? row.lines : 0)));
    const total = (): number => CELL_H + 2 + PAD + rows.reduce((sum, row) => sum + height(row, lines), 0) + PAD - GAP;
    while (lines > 3 && total() > room) lines--;

    const tall = total();
    const plate: Box = {
      x: Math.round(safe.left + (picture.width - safe.left - safe.right - width) / 2),
      y: Math.round(safe.top + MARGIN + Math.max(0, (room - tall) / 2)),
      w: width,
      h: tall,
    };
    const placed: Placed[] = [];
    let y = plate.y + CELL_H + 2 + PAD;
    for (const row of rows) {
      const h = height(row, lines);
      const pressed = row.kind === 'command' || row.kind === 'commands' || row.kind === 'switch' || row.kind === 'tabs';
      placed.push({ row, box: { x: plate.x + PAD, y, w: inner, h: pressed ? h - GAP : h } });
      y += h;
    }
    return { plate, placed };
  }

  private zones(): ShellItem[] {
    const items: ShellItem[] = [];
    const toWindow = (box: Box) => {
      const window = this.context.window();
      const picture = this.context.picture();
      const sx = window.width / Math.max(1, picture.width);
      const sy = window.height / Math.max(1, picture.height);
      return { x: box.x * sx, y: box.y * sy, width: box.w * sx, height: box.h * sy };
    };
    for (const { row, box } of this.plan().placed) {
      if (row.kind === 'command') items.push({ id: row.id, rect: toWindow(box), action: row.action, instant: row.instant });
      else if (row.kind === 'switch') items.push({ id: row.id, rect: toWindow(box), action: row.action });
      else if (row.kind === 'commands') {
        row.commands.forEach((command, i) =>
          items.push({ id: command.id, rect: toWindow(this.part(box, i, row.commands.length)), action: command.action, instant: command.instant }),
        );
      } else if (row.kind === 'tabs') {
        const count = row.labels().length;
        for (let i = 0; i < count; i++) items.push({ id: `${row.id}-${i}`, rect: toWindow(this.part(box, i, count)), action: () => row.pick(i) });
      } else if (row.kind === 'levels') {
        this.levelCells(row, box).forEach((cell, i) => items.push({ id: `${row.id}-${i}`, rect: toWindow(cell), action: () => row.pick(i) }));
      }
    }
    return items;
  }
}
