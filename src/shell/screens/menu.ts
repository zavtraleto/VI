import type { Layer } from '../../display/layer';
import type { Rect } from '../../display/sizing';
import { t, word } from '../../ui/i18n';
import type { Kit } from '../kit';
import { CELL_H, CELL_W, MIN_ZONE, menuLayout, netProjection, netStep, type Box, type Dir4, type MenuLayout, type NetProjection } from '../layout';
import { drawLogo } from '../logo';
import type { ShellContext, ShellFocus, ShellItem, ShellScreen } from '../screen';
import { ShellSpace } from '../space';
import { EXEC_LABEL, EXEC_NAME, LEGEND, MENU_FILES, PAGER, README_DATE, REVISION, SPACE_CAPTION, STATUS, SUBJECT, digits, fileLine, type FileField, type MenuFile } from '../text';
import type { Palette } from '../theme';

/** What the files of the main menu do. */
export interface MenuActions {
  onEndless: () => void;
  onLevels: () => void;
  onHowTo: () => void;
  onReadme: () => void;
  onRecords: () => void;
  onSystem: () => void;
}

/** What the program has on record about the one who sits at it. */
export interface MenuData {
  /** Best score of a session without a limit. */
  bestEndless: number;
  /** Levels of the game passed, out of how many there are. */
  levelsDone: number;
  levelsTotal: number;
  /** Seconds a session with a limit lasts, as the rules have it: for a line that names the time. */
  limitSec: number;
  /** Rules the file of how the game is played holds. */
  rules: number;
  /** Sessions on record. */
  sessions: number;
}

/** The bar that runs the file in focus. */
const EXEC_ID = 'exec';
/** The arrows of the record: to the file before and to the file after. */
const PREV_ID = 'prev';
const NEXT_ID = 'next';
/** Width of the part of the bar of the record an arrow stands in. */
const PAGER_WIDTH = 3 * CELL_W;

/** A number between 0 and 1 that depends on its two arguments alone. */
function chance(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The main menu. Its face is the net of a die: six dice of glass in the dark, one file of
 * the program on each, and the red figure that steps from die to die. Everything else on the
 * screen is the program's records: of the one who sits at it, and of the file the figure
 * stands on. A file runs when its die is pressed while the figure is on it, or from the bar
 * of its record. The record is also leafed through, file after file by their numbers and round
 * again: by the arrows at the ends of its bar, or by a swipe across it.
 */
export class MenuScreen implements ShellScreen {
  readonly home: string;
  private readonly space: ShellSpace;
  private readonly actions: Record<string, () => void>;
  /** The file the figure stands on. */
  private current: MenuFile;
  private beat = -1;
  private second = -1;

  constructor(
    private readonly context: ShellContext,
    actions: MenuActions,
    private readonly data: MenuData,
    /** The file the figure waits on: the one the player has come back from. The levels when left out. */
    home?: string,
  ) {
    this.actions = {
      levels: actions.onLevels,
      protocol: actions.onEndless,
      howto: actions.onHowTo,
      readme: actions.onReadme,
      records: actions.onRecords,
      system: actions.onSystem,
    };
    // The figure waits in the middle of the net, on the levels, or on the file the player has just left.
    this.current = MENU_FILES.find((file) => file.id === home) ?? MENU_FILES.find((file) => file.face === 1)!;
    this.home = this.current.id;
    this.space = new ShellSpace(context.values);
    this.space.place(this.current.face);
  }

  items(): ShellItem[] {
    const { layout, projection, zoom } = this.plan();
    const side = Math.max(projection.zone, MIN_ZONE / zoom);
    const items: ShellItem[] = MENU_FILES.map((file) => {
      const centre = projection.centres[file.face - 1];
      return {
        id: file.id,
        rect: this.toWindow({ x: centre.x - side / 2, y: centre.y - side / 2, w: side, h: side }),
        action: this.actions[file.id],
        confirm: true,
      };
    });
    items.push({ id: EXEC_ID, rect: this.toWindow(layout.exec), action: () => this.actions[this.current.id](), passive: true });
    const { prev, next } = this.pagers(layout, zoom);
    items.push(
      { id: PREV_ID, rect: this.toWindow(prev), action: () => this.context.focus(this.beside(-1)), passive: true, instant: true, quiet: true },
      { id: NEXT_ID, rect: this.toWindow(next), action: () => this.context.focus(this.beside(1)), passive: true, instant: true, quiet: true },
    );
    return items;
  }

  /** A swipe across the record turns it: to the left brings the file after, to the right the file before. */
  swipe(dir: 'left' | 'right', x: number, y: number): string | null {
    const rect = this.toWindow(this.plan().layout.record);
    if (x < rect.x || x >= rect.x + rect.width || y < rect.y || y >= rect.y + rect.height) return null;
    return this.beside(dir === 'left' ? 1 : -1);
  }

  /**
   * The file so many numbers on from the one the figure stands on, round the six. The figure
   * is on it from this moment, not from the next frame: two quick presses turn the record twice.
   */
  private beside(step: number): string {
    const count = MENU_FILES.length;
    const face = ((this.current.face - 1 + step + count) % count) + 1;
    this.current = MENU_FILES.find((file) => file.face === face)!;
    return this.current.id;
  }

  /**
   * The zones of the two arrows: the top corners of the record, as large as a finger needs
   * whatever the picture is. The arrows themselves stand in the bar, at its ends.
   */
  private pagers(layout: MenuLayout, zoom: number): { prev: Box; next: Box } {
    const { record, exec } = layout;
    const side = Math.max(PAGER_WIDTH, Math.ceil(MIN_ZONE / Math.max(0.1, zoom)));
    const tall = Math.min(side, exec.y - record.y - 2);
    return {
      prev: { x: record.x, y: record.y, w: side, h: tall },
      next: { x: record.x + record.w - side, y: record.y, w: side, h: tall },
    };
  }

  /** The keys walk the net as the figure walks the board: to the die next to this one. */
  move(focus: string | null, dir: Dir4): string | null {
    const from = MENU_FILES.find((file) => file.id === focus) ?? this.current;
    const face = netStep(from.face, dir);
    return MENU_FILES.find((file) => file.face === face)!.id;
  }

  face(id: string): number | null {
    return MENU_FILES.find((file) => file.id === id)?.face ?? null;
  }

  update(): boolean {
    return false;
  }

  /**
   * The line of the program's state moves by itself: the levels of the channels wander, the
   * clock goes. It alone is drawn again, a few times a second; the rest of the picture stays.
   */
  tick(kit: Kit, timeMs: number): boolean {
    const rate = this.context.reducedMotion() ? 0 : Number(this.context.values.idleHz);
    const tick = rate > 0 ? Math.floor((timeMs / 1000) * rate) : 0;
    const second = Math.floor(Date.now() / 1000);
    if (tick === this.beat && second === this.second) return false;
    this.beat = tick;
    this.second = second;
    const { status } = this.plan().layout;
    kit.clear(status);
    this.drawStatus(kit, status);
    return true;
  }

  scene(layer: Layer, palette: Palette, focus: ShellFocus, timeMs: number): boolean {
    this.follow(focus);
    const { layout, projection } = this.plan();
    this.space.stand(this.current.face);
    this.space.render(layer, this.toWindow(layout.space), projection, palette, timeMs, this.context.reducedMotion());
    return true;
  }

  dispose(): void {
    this.space.dispose();
  }

  draw(kit: Kit, focus: ShellFocus): void {
    this.follow(focus);
    const { layout, projection } = this.plan();
    const palette = kit.palette;
    const file = this.current;
    const channel = palette.channels[file.face - 1];

    drawLogo(kit, layout.header.left, layout.header.y, 1, palette.ink);
    kit.text(REVISION, layout.header.right, layout.header.y, palette.dim, { align: 'right' });
    kit.rect(layout.header.left, layout.header.rule, layout.header.right - layout.header.left, 1, palette.faint);

    if (layout.subject) this.drawSubject(kit, layout.subject);
    this.drawSpace(kit, layout, projection, channel);
    this.drawRecord(kit, layout, file, channel, focus.pressed);
    this.drawStatus(kit, layout.status);
    if (layout.legend !== null) kit.text(LEGEND, layout.header.left, layout.legend, palette.dim);
  }

  /** The file in focus becomes the one the figure stands on. */
  private follow(focus: ShellFocus): void {
    const file = MENU_FILES.find((candidate) => candidate.id === focus.focus);
    if (file) this.current = file;
  }

  private plan(): { layout: MenuLayout; projection: NetProjection; zoom: number } {
    const { values } = this.context;
    const picture = this.context.picture();
    const zoom = this.context.window().height / Math.max(1, picture.height);
    const layout = menuLayout(picture, this.context.safe(), zoom);
    const projection = netProjection(layout.space, {
      yaw: Number(values.spaceYaw),
      pitch: Number(values.spacePitch),
      gap: Number(values.spaceGap),
      fill: Number(values.spaceFill),
    });
    return { layout, projection, zoom };
  }

  private toWindow(box: Box): Rect {
    const window = this.context.window();
    const picture = this.context.picture();
    const sx = window.width / Math.max(1, picture.width);
    const sy = window.height / Math.max(1, picture.height);
    return { x: box.x * sx, y: box.y * sy, width: box.w * sx, height: box.h * sy };
  }

  /** The record of the one who sits at the program: the seventh, whom it has no picture of. */
  private drawSubject(kit: Kit, box: Box): void {
    const { bg, ink, dim, faint } = kit.palette;
    kit.frame(box, faint, true);
    kit.rect(box.x + 1, box.y + 1, box.w - 2, CELL_H + 1, faint);
    kit.text(SUBJECT.title, box.x + 6, box.y + 1, ink);
    kit.text(SUBJECT.number, box.x + box.w - 6, box.y + 1, ink, { align: 'right' });

    // Where a portrait would be: a grey mannequin, as the program draws the one it does not know.
    const slot: Box = { x: box.x + 8, y: box.y + 26, w: 40, h: 62 };
    kit.box(slot, bg);
    kit.dither(slot.x, slot.y, slot.w, slot.h, faint, 4);
    kit.frame(slot, faint);
    kit.disc(slot.x + 20, slot.y + 22, 9, dim);
    for (let row = 0; row < 24; row++) {
      const half = Math.min(17, 9 + row * 1.2);
      kit.dither(Math.round(slot.x + 20 - half), slot.y + 37 + row, Math.round(half * 2), 1, dim, 2);
    }

    const left = slot.x + slot.w + CELL_W;
    SUBJECT.fields.forEach(([label, value], i) => {
      kit.field(label, value, left, box.x + box.w - 8, box.y + 24 + i * 17, dim, ink);
    });
  }

  /** What the canvas adds to the dice: the caption of the figure and the wire from a die to its record. */
  private drawSpace(kit: Kit, layout: MenuLayout, projection: NetProjection, channel: string): void {
    const { dim, faint } = kit.palette;
    const { space, record } = layout;
    kit.text(SPACE_CAPTION, space.x, space.y, dim);
    // Marks at the corners of the part of the screen the figure is drawn in, as on a plate of a report.
    const mark = 6;
    for (const right of [false, true]) {
      for (const bottom of [false, true]) {
        // The caption stands in the top left corner.
        if (!right && !bottom) continue;
        const x = right ? space.x + space.w - 1 : space.x;
        const y = bottom ? space.y + space.h - 1 : space.y;
        kit.rect(right ? x - mark + 1 : x, y, mark, 1, faint);
        kit.rect(x, bottom ? y - mark + 1 : y, 1, mark, faint);
      }
    }

    const centre = projection.centres[this.current.face - 1];
    const from = { x: centre.x + projection.unit * 0.75, y: centre.y };
    kit.rect(Math.round(from.x) - 1, Math.round(from.y) - 1, 3, 3, channel);
    if (layout.wide) {
      const bus = record.x - 5;
      kit.wire([from, { x: bus, y: from.y }, { x: bus, y: record.y + 8 }, { x: record.x, y: record.y + 8 }], channel);
    } else {
      const bus = space.x + space.w - 3;
      kit.wire([from, { x: Math.max(bus, from.x), y: from.y }, { x: Math.max(bus, from.x), y: record.y }], channel);
    }
  }

  /** The record of the file the figure stands on, with the bar that runs it. */
  private drawRecord(kit: Kit, layout: MenuLayout, file: MenuFile, channel: string, pressed: string | null): void {
    const { bg, ink, dim } = kit.palette;
    const box = layout.record;
    const left = box.x + 8;
    const right = box.x + box.w - 8;
    kit.box(box, bg);
    kit.frame(box, channel, true);
    kit.rect(box.x + 1, box.y + 1, box.w - 2, CELL_H + 1, channel);
    // The ends of the bar are the arrows that turn the record; a pressed one is dark with a lit arrow.
    const ends: readonly [id: string, sign: string, x: number][] = [
      [PREV_ID, PAGER.prev, box.x + 1],
      [NEXT_ID, PAGER.next, box.x + box.w - 1 - PAGER_WIDTH],
    ];
    for (const [id, sign, x] of ends) {
      const held = pressed === id;
      if (held) kit.rect(x, box.y + 1, PAGER_WIDTH, CELL_H + 1, bg);
      kit.text(sign, x + PAGER_WIDTH / 2, box.y + 1, held ? channel : bg, { align: 'center', bold: true });
    }
    kit.rect(box.x + PAGER_WIDTH + 1, box.y + 1, 1, CELL_H + 1, bg);
    kit.rect(box.x + box.w - PAGER_WIDTH - 2, box.y + 1, 1, CELL_H + 1, bg);
    kit.text(`FILE ${digits(file.face, 2)}/${digits(MENU_FILES.length, 2)}`, box.x + PAGER_WIDTH + 7, box.y + 1, bg, { bold: true });
    kit.text(`${STATUS.channels}${file.face}`, box.x + box.w - PAGER_WIDTH - 7, box.y + 1, bg, { align: 'right', bold: true });

    const nameEnd = kit.text(word(file.name), left, box.y + 22, ink, { scale: 2, bold: true });
    kit.text(file.native, nameEnd + CELL_W, box.y + 22 + CELL_H, dim);
    kit.text(fileLine(t(file.line), this.data.limitSec), left, box.y + 60, ink);
    kit.field(file.field[0], this.value(file.field[1]), left, right, box.y + 82, dim, ink);

    const exec = layout.exec;
    const label = `${EXEC_LABEL} ${word(EXEC_NAME)}`;
    const textY = exec.y + Math.round((exec.h - CELL_H) / 2);
    if (pressed !== null && pressed !== PREV_ID && pressed !== NEXT_ID) {
      kit.frame(exec, ink);
      kit.text(label, exec.x + exec.w / 2, textY, ink, { align: 'center', bold: true });
    } else {
      kit.box(exec, ink);
      kit.text(label, exec.x + exec.w / 2, textY, bg, { align: 'center', bold: true });
    }
  }

  /** The line of the program's own state: the levels of the six channels, the clock, the count of sessions. */
  private drawStatus(kit: Kit, box: Box): void {
    const { ink, dim, faint, channels } = kit.palette;
    kit.rect(box.x, box.y, box.w, 1, faint);
    const y = box.y + 4;
    let x = kit.text(STATUS.channels, box.x, y, dim) + CELL_W;
    channels.forEach((channel, i) => {
      // Noise of an empty line: nothing is connected, the levels wander.
      const level = 2 + Math.round(chance(this.beat, i) * 10);
      kit.rect(x, y + 14 - level, 8, level, channel);
      x += 12;
    });
    const now = new Date();
    const clock = [now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => digits(part, 2)).join(':');
    kit.text(clock, box.x + box.w, y, ink, { align: 'right' });
    kit.text(STATUS.mode, box.x, y + CELL_H, dim);
    const count = digits(this.data.sessions, 4);
    const countStart = box.x + box.w - kit.measure(count);
    kit.text(count, countStart, y + CELL_H, dim);
    kit.text(STATUS.sessions, countStart - CELL_W, y + CELL_H, dim, { align: 'right' });
  }

  private value(kind: FileField): string {
    const { data } = this;
    switch (kind) {
      case 'bestEndless':
        return digits(data.bestEndless, 6);
      case 'levels':
        return `${digits(data.levelsDone, 2)}/${digits(data.levelsTotal, 2)}`;
      case 'rules':
        return digits(data.rules, 2);
      case 'readme':
        return README_DATE;
      case 'sessions':
        return digits(data.sessions, 4);
      case 'revision':
        return REVISION.replace('REV ', '');
    }
  }
}
