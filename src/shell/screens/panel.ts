import type { Kit } from '../kit';
import { CELL_H, CELL_W, MIN_ZONE, type Box } from '../layout';
import type { ShellContext, ShellFocus, ShellItem, ShellScreen } from '../screen';
import { digits, type PanelName } from '../text';

/** Something a panel can be told to do: a line that is pressed. */
export interface PanelCommand {
  id: string;
  label: PanelName;
  action: () => void;
}

/** A line of a panel, from top to bottom. */
export type PanelRow =
  /** A name and its value, with dots between. */
  | { kind: 'field'; label: PanelName; value: string }
  /** A name, and under it a number at twice the size: the reading the panel is about. */
  | { kind: 'number'; label: PanelName; value: number; places: number }
  | ({ kind: 'command' } & PanelCommand)
  /** Several commands side by side. */
  | { kind: 'commands'; commands: readonly PanelCommand[] }
  /** A setting: pressing it takes its next value. */
  | { kind: 'switch'; id: string; label: PanelName; value: () => string; action: () => void }
  /** One of several, side by side: the one picked is filled. */
  | { kind: 'tabs'; id: string; labels: () => readonly string[]; selected: () => number; pick: (index: number) => void }
  /** A log: its place, a date or a name and a value on every line. `lines` is the most it shows. */
  | { kind: 'table'; head: () => string; rows: () => readonly TableLine[]; empty: () => string; lines: number }
  /** The tasks, as numbered cells with what each has earned; `note` is said under them for the cell in focus. */
  | { kind: 'levels'; id: string; levels: readonly { stars: number }[]; current: number; pick: (index: number) => void; note: (index: number) => string }
  /** What a task has earned, out of three. */
  | { kind: 'stars'; count: number }
  /** Prose in the language of the player, in the voice. */
  | { kind: 'say'; text: string; dim?: boolean }
  | { kind: 'gap' };

/**
 * A line of a log. `own` marks the line of the one who is playing: it is written in full
 * tone and stays in sight when the log is cut short. `place` stands in for the count of lines
 * where the log has places of its own.
 */
export type TableLine = readonly [label: string, value: string, own?: boolean, place?: number];

export interface PanelSpec {
  title: PanelName;
  rows: readonly PanelRow[];
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
/** Letters of the voice inside a panel, in CSS pixels. */
const SAY_SIZE = 16;
/** Cells of tasks across a tall picture and across a wide one. */
const LEVELS_TALL = 6;
const LEVELS_WIDE = 10;

interface Placed {
  row: PanelRow;
  box: Box;
}

const ceilTo = (value: number, step: number): number => Math.ceil(value / step) * step;

/**
 * A panel of the program over whatever is on screen: a framed record with a filled bar for
 * its name, as the records of the menu are, and under the bar its lines - readings, settings,
 * commands. A line that can be pressed is filled while it is in focus, and the red mark of the
 * seventh stands on it.
 */
export class PanelScreen implements ShellScreen {
  readonly home?: string;

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

  update(): boolean {
    return false;
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
    kit.rect(plate.x + 1, plate.y + 1, plate.w - 2, CELL_H + 1, ink);
    kit.text(this.spec.title.native, plate.x + 6, plate.y + 1, bg, { bold: true });
    kit.text(this.spec.title.name, plate.x + plate.w - 6, plate.y + 1, bg, { align: 'right', bold: true });

    const left = plate.x + PAD;
    const right = plate.x + plate.w - PAD;
    for (const { row, box } of placed) {
      switch (row.kind) {
        case 'field':
          kit.field(`${row.label.native} ${row.label.name}`, row.value, left, right, box.y, dim, ink);
          break;
        case 'number': {
          kit.text(`${row.label.native} ${row.label.name}`, left, box.y, dim);
          const text = digits(row.value, row.places);
          const zeros = Math.min(text.length - 1, text.length - String(Math.max(0, Math.round(row.value))).length);
          const after = kit.text(text.slice(0, zeros), left, box.y + CELL_H, faint, { scale: 2 });
          kit.text(text.slice(zeros), after, box.y + CELL_H, ink, { scale: 2, bold: true });
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
          kit.field(`${row.label.native} ${row.label.name}`, row.value(), box.x + 14, box.x + box.w - 8, y, pressed ? ink : dim, ink);
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
          const count = this.tableLines(row, box);
          const own = all.findIndex((line) => line[2]);
          // The line of the one who is playing takes the last place in sight when it lies below it.
          const rows = own >= count ? [...all.slice(0, count - 1), all[own]] : all.slice(0, count);
          kit.text('No.', left, box.y, dim);
          kit.text(row.head(), left + CELL_W * 4, box.y, dim);
          kit.rect(left, box.y + CELL_H - 1, right - left, 1, faint);
          if (rows.length === 0) kit.text(row.empty(), plate.x + plate.w / 2, box.y + CELL_H + 4, dim, { align: 'center' });
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
        case 'levels': {
          let noted = row.current;
          this.levelCells(row, box).forEach((cell, i) => {
            const id = `${row.id}-${i}`;
            const on = focus.focus === id;
            if (on) noted = i;
            const filled = on && focus.pressed !== id;
            if (filled) kit.box(cell, ink);
            else kit.frame(cell, on || i === row.current ? ink : faint);
            kit.text(digits(i + 1, 2), cell.x + cell.w / 2, cell.y + 2, filled ? bg : ink, { align: 'center' });
            this.stars(kit, row.levels[i].stars, cell.x + cell.w / 2, cell.y + cell.h - 7, 4, filled ? bg : ink, filled ? bg : faint);
          });
          const note = row.note(noted);
          const at = kit.toWindow({ x: left, y: box.y + box.h - CELL_H - 2, w: right - left, h: CELL_H + 2 });
          this.context.voice.say({ text: note, box: at, size: SAY_SIZE - 2, dim: true, anchor: 'middle' });
          break;
        }
        case 'stars':
          this.stars(kit, row.count, plate.x + plate.w / 2, box.y + 3, 10, ink, faint);
          break;
        case 'say':
          this.context.voice.say({ text: row.text, box: kit.toWindow(box), size: SAY_SIZE, align: 'left', dim: row.dim });
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

  /** Three squares in a row around `centre`: as many filled as there are stars. */
  private stars(kit: Kit, count: number, centre: number, y: number, side: number, on: string, off: string): void {
    const step = side + Math.max(2, Math.round(side / 2));
    const start = Math.round(centre - (step * 3 - (step - side)) / 2);
    for (let i = 0; i < 3; i++) {
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
    const text = `${command.label.native} ${command.label.name}`;
    // A narrow part has room for the name alone.
    const label = kit.measure(text) > box.w - 20 ? command.label.name : text;
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

  private tableLines(row: Extract<PanelRow, { kind: 'table' }>, box: Box): number {
    return Math.max(1, Math.min(row.lines, Math.floor((box.h - CELL_H - 4) / CELL_H)));
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
          return CELL_H * 3 + 4;
        case 'command':
        case 'commands':
        case 'switch':
        case 'tabs':
          return zone + GAP;
        case 'table':
          return CELL_H + 4 + lines * CELL_H;
        case 'levels':
          return Math.ceil(row.levels.length / this.levelColumns()) * (zone + GAP) + CELL_H + 4;
        case 'stars':
          return CELL_H + 4;
        case 'say':
          return Math.ceil(this.context.voice.height(row.text, inner * zoom, SAY_SIZE) / zoom) + 6;
        case 'gap':
          return 6;
      }
    };
    // A log gives up lines before the panel grows past the screen.
    let lines = Math.max(0, ...this.spec.rows.map((row) => (row.kind === 'table' ? row.lines : 0)));
    const total = (): number => CELL_H + 2 + PAD + this.spec.rows.reduce((sum, row) => sum + height(row, lines), 0) + PAD - GAP;
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
    for (const row of this.spec.rows) {
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
      if (row.kind === 'command') items.push({ id: row.id, rect: toWindow(box), action: row.action });
      else if (row.kind === 'switch') items.push({ id: row.id, rect: toWindow(box), action: row.action });
      else if (row.kind === 'commands') {
        row.commands.forEach((command, i) => items.push({ id: command.id, rect: toWindow(this.part(box, i, row.commands.length)), action: command.action }));
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
