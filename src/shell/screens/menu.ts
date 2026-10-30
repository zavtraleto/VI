import type { Layer } from '../../display/layer';
import type { Rect } from '../../display/sizing';
import { t, word } from '../../ui/i18n';
import type { Kit } from '../kit';
import { CELL_H, CELL_W, fingerOf, menuLayout, netProjection, netStep, textWidth, zoneOf, type Box, type Dir4, type MenuLayout, type NetProjection } from '../layout';
import { drawLogo } from '../logo';
import type { ShellContext, ShellFocus, ShellItem, ShellScreen } from '../screen';
import { ShellSpace } from '../space';
import { LEGEND, MENU_FILES, PAGER, README_DATE, REVISION, STATUS, SUBJECT, digits, type FileField, type MenuFile } from '../text';
import { BAR_H, BUTTON_H, EDGE, GAP, UNIT, type Palette } from '../theme';

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
  /** Boards of the campaign passed, pieces of the road and levels alike, out of how many there are. */
  levelsDone: number;
  levelsTotal: number;
  /** The rules the file of how the game is played has to read. */
  rules: number;
  /** Sessions on record. */
  sessions: number;
}

/** The bar that runs the file in focus. */
const EXEC_ID = 'exec';
/** The arrows of the record: to the file before and to the file after. */
const PREV_ID = 'prev';
const NEXT_ID = 'next';
/** Width of the part of the bar of the record an arrow stands in, from the edge of the record to the line after it. */
const PAGER_WIDTH = BUTTON_H;
/** Rows of a callout and of the key, and the room between the net and a column of callouts. */
const LABEL_ROW = 20;
const CALLOUT_GAP = GAP;
/** Side of the little face before a name in the key under the net of a tall picture. */
const KEY_FACE = 12;
/** The key: three rows, and half a step of the grid above and below them. */
const KEY_HEIGHT = 3 * LABEL_ROW + EDGE;
/** Where the lines of the record of a file stand, from its top: the name twice its size, the name in the program's language, the dry line, the field. */
const RECORD_NAME = 29;
const RECORD_NATIVE = 45;
const RECORD_LINE = 69;
const RECORD_FIELD = 93;
/** Where the lines of the record of the subject start, from its top, and the step between them. */
const SUBJECT_TOP = 28;
const SUBJECT_STEP = 20;

/** The name of a file beside its die: where it stands, and where its line leaves the die. */
interface Callout {
  file: MenuFile;
  /** The box of the name; its line comes in at `edge`, the side of the box nearer the net. */
  box: Box;
  edge: number;
  from: { x: number; y: number };
}

/** What names the dice: callouts on a wide picture, a key under the net on a tall one. */
interface Names {
  /** Where the dice hang: the part of the space the names leave them. */
  net: Box;
  callouts: Callout[];
  /** The key: two columns of three rows, the files in the order of their faces. */
  key: Box | null;
}

type NetView = { yaw: number; pitch: number; gap: number; fill: number };

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
    const { layout, projection, zoom, names } = this.plan();
    const side = Math.max(projection.zone, fingerOf(zoom));
    const items: ShellItem[] = MENU_FILES.map((file) => {
      const centre = projection.centres[file.face - 1];
      return {
        id: file.id,
        rect: this.toWindow({ x: centre.x - side / 2, y: centre.y - side / 2, w: side, h: side }),
        action: this.actions[file.id],
        confirm: true,
      };
    });
    // The name of a file beside its die stands the figure on it, as the arrows of the record do.
    for (const { file, box } of names.callouts) {
      items.push({
        id: `name-${file.id}`,
        rect: this.toWindow(zoneOf(box, zoom)),
        action: () => this.context.focus(this.stand(file)),
        passive: true,
        instant: true,
        quiet: true,
      });
    }
    items.push({ id: EXEC_ID, rect: this.toWindow(zoneOf(layout.exec, zoom)), action: () => this.actions[this.current.id](), passive: true });
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
    return this.stand(MENU_FILES.find((file) => file.face === face)!);
  }

  /** The figure stands on a file from this moment. */
  private stand(file: MenuFile): string {
    this.current = file;
    return file.id;
  }

  /**
   * The zones of the two arrows: squares in the top corners of the record, as large as a finger
   * needs and never smaller than a button, not drawn. The arrows themselves stand in the bar, at its ends.
   */
  private pagers(layout: MenuLayout, zoom: number): { prev: Box; next: Box } {
    const { record } = layout;
    const side = fingerOf(zoom);
    return {
      prev: { x: record.x, y: record.y, w: side, h: side },
      next: { x: record.x + record.w - side, y: record.y, w: side, h: side },
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
   * The header moves by itself: the levels of the channels wander, the clock goes. It alone is
   * drawn again, a few times a second; the rest of the picture stays.
   */
  tick(kit: Kit, timeMs: number): boolean {
    const rate = this.context.reducedMotion() ? 0 : Number(this.context.values.idleHz);
    const tick = rate > 0 ? Math.floor((timeMs / 1000) * rate) : 0;
    const second = Math.floor(Date.now() / 1000);
    if (tick === this.beat && second === this.second) return false;
    this.beat = tick;
    this.second = second;
    const { header } = this.plan().layout;
    kit.clear(header.box);
    this.drawHeader(kit, header);
    return true;
  }

  scene(layer: Layer, palette: Palette, focus: ShellFocus, timeMs: number): boolean {
    this.follow(focus);
    const { projection, names } = this.plan();
    this.space.stand(this.current.face);
    this.space.render(layer, this.toWindow(names.net), projection, palette, timeMs, this.context.reducedMotion());
    return true;
  }

  dispose(): void {
    this.space.dispose();
  }

  draw(kit: Kit, focus: ShellFocus): void {
    this.follow(focus);
    const { layout, projection, names } = this.plan();
    const palette = kit.palette;
    const file = this.current;
    const channel = palette.channels[file.face - 1];

    this.drawHeader(kit, layout.header);
    if (layout.subject) this.drawSubject(kit, layout.subject);
    this.drawWire(kit, layout, projection, channel);
    this.drawNames(kit, names);
    this.drawRecord(kit, layout, file, channel, focus.pressed);
    if (layout.legend !== null) kit.text(`←↑↓→ ${word(LEGEND.move)}   ENTER ${word(LEGEND.pick)}`, layout.header.left, layout.legend, palette.dim);
  }

  /** The file in focus becomes the one the figure stands on. */
  private follow(focus: ShellFocus): void {
    const file = MENU_FILES.find((candidate) => candidate.id === focus.focus);
    if (file) this.current = file;
  }

  private plan(): { layout: MenuLayout; projection: NetProjection; zoom: number; names: Names } {
    const { values } = this.context;
    const picture = this.context.picture();
    const zoom = this.context.window().height / Math.max(1, picture.height);
    const layout = menuLayout(picture, this.context.safe());
    const view: NetView = {
      yaw: Number(values.spaceYaw),
      pitch: Number(values.spacePitch),
      gap: Number(values.spaceGap),
      fill: Number(values.spaceFill),
    };
    const names = layout.wide ? this.callouts(layout.space, view) : this.keyed(layout.space);
    return { layout, projection: netProjection(names.net, view), zoom, names };
  }

  /**
   * The key under the net of a tall picture: there is no room beside the dice for their names
   * (the owner, 28 October 2026, chose a key there and callouts on a wide one). Two columns of
   * three rows, a little face of each die and the name of its file, a gap of the grid over it;
   * the dice keep the rest.
   */
  private keyed(space: Box): Names {
    const key: Box = { x: space.x, y: space.y + space.h - KEY_HEIGHT, w: space.w, h: KEY_HEIGHT };
    return { net: { ...space, h: Math.max(CELL_H, space.h - KEY_HEIGHT - GAP) }, callouts: [], key };
  }

  /**
   * The names of the files beside their dice, on a wide picture: the dice on the left of the
   * net, and the one in its middle, are named in a column to its left, the others in a column to
   * its right; each name at the height of its die where the names leave room for it, with a line
   * from the die to its name. The net gives the columns their room.
   */
  private callouts(space: Box, view: NetView): Names {
    const whole = netProjection(space, view);
    const middle = whole.centres.reduce((sum, centre) => sum + centre.x, 0) / whole.centres.length;
    const left = MENU_FILES.filter((file) => whole.centres[file.face - 1].x < middle || file.face === 1);
    const right = MENU_FILES.filter((file) => !left.includes(file));
    const width = (file: MenuFile): number => textWidth(word(file.name)) + 2 * UNIT;
    const widest = (files: readonly MenuFile[]): number => Math.max(0, ...files.map(width));
    const leftWidth = widest(left);
    const rightWidth = widest(right);
    const net: Box = {
      x: space.x + leftWidth + CALLOUT_GAP,
      y: space.y,
      w: Math.max(CELL_H, space.w - leftWidth - rightWidth - 2 * CALLOUT_GAP),
      h: space.h,
    };
    const projection = netProjection(net, view);
    const top = space.y;
    const bottom = space.y + space.h - LABEL_ROW;
    const column = (files: readonly MenuFile[], onLeft: boolean): Callout[] => {
      const sorted = [...files].sort((a, b) => projection.centres[a.face - 1].y - projection.centres[b.face - 1].y);
      const ys: number[] = [];
      for (const file of sorted) {
        const want = Math.round(projection.centres[file.face - 1].y - LABEL_ROW / 2);
        ys.push(Math.max(want, ys.length > 0 ? ys[ys.length - 1] + LABEL_ROW : top));
      }
      // Names pushed past the bottom go back up together.
      for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], i === ys.length - 1 ? bottom : ys[i + 1] - LABEL_ROW);
      const reach = projection.unit * 0.75;
      return sorted.map((file, i) => {
        const w = width(file);
        const centre = projection.centres[file.face - 1];
        const x = onLeft ? net.x - CALLOUT_GAP - w : net.x + net.w + CALLOUT_GAP;
        return {
          file,
          box: { x, y: ys[i], w, h: LABEL_ROW },
          edge: onLeft ? x + w : x,
          from: { x: Math.round(centre.x + (onLeft ? -reach : reach)), y: Math.round(centre.y) },
        };
      });
    };
    return { net, callouts: [...column(left, true), ...column(right, false)], key: null };
  }

  /**
   * The names of the files: a callout beside each die with its line from the die, or the key
   * under the net. The file the figure stands on has its name filled and its line in its
   * colour; the others are dim, their lines faint, with a dot of their colour where the line
   * leaves the die.
   */
  private drawNames(kit: Kit, names: Names): void {
    const { bg, ink, dim, faint, channels } = kit.palette;
    for (const { file, box, edge, from } of names.callouts) {
      const on = file.id === this.current.id;
      const channel = channels[file.face - 1];
      const y = box.y + box.h / 2;
      const bend = edge + (edge > from.x ? -UNIT : UNIT);
      kit.wire([from, { x: bend, y: from.y }, { x: bend, y }, { x: edge, y }], on ? channel : faint);
      kit.rect(from.x - 1, from.y - 1, 3, 3, channel);
      if (on) kit.box(box, ink);
      kit.text(word(file.name), box.x + UNIT, box.y + (box.h - CELL_H) / 2, on ? bg : dim, { bold: on });
    }
    const { key } = names;
    if (!key) return;
    const half = Math.floor((key.w - GAP) / 2);
    MENU_FILES.forEach((file, i) => {
      const on = file.id === this.current.id;
      const x = key.x + (i % 2) * (half + GAP);
      const y = key.y + EDGE / 2 + Math.floor(i / 2) * LABEL_ROW;
      if (on) kit.rect(x, y, half, LABEL_ROW, ink);
      kit.face(file.face, x + UNIT, y + (LABEL_ROW - KEY_FACE) / 2, KEY_FACE, channels[file.face - 1], bg);
      kit.text(word(file.name), x + UNIT + KEY_FACE + GAP, y + (LABEL_ROW - CELL_H) / 2, on ? bg : dim, { bold: on });
    });
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
    kit.bar(box, SUBJECT.title, SUBJECT.number, faint, ink);

    // Where a portrait would be: a grey mannequin, as the program draws the one it does not know.
    const slot: Box = { x: box.x + EDGE, y: box.y + SUBJECT_TOP, w: 40, h: 72 };
    kit.box(slot, bg);
    kit.dither(slot.x, slot.y, slot.w, slot.h, faint, 4);
    kit.frame(slot, faint);
    kit.disc(slot.x + 20, slot.y + 22, 9, dim);
    // The shoulders run down to the frame.
    for (let row = 0; row < slot.h - 38; row++) {
      const half = Math.min(17, 9 + row * 1.2);
      kit.dither(Math.round(slot.x + 20 - half), slot.y + 37 + row, Math.round(half * 2), 1, dim, 2);
    }

    const left = slot.x + slot.w + EDGE;
    SUBJECT.fields.forEach(([label, value], i) => {
      kit.field(label, value, left, box.x + box.w - EDGE, box.y + SUBJECT_TOP + i * SUBJECT_STEP, dim, ink);
    });
  }

  /**
   * The wire from the die the figure stands on to the record of its file. The dice have no
   * frame, caption or marks of their own: they are the ground of the menu.
   */
  private drawWire(kit: Kit, layout: MenuLayout, projection: NetProjection, channel: string): void {
    const { space, record } = layout;
    const centre = projection.centres[this.current.face - 1];
    const from = { x: centre.x + projection.unit * 0.75, y: centre.y };
    kit.rect(Math.round(from.x) - 1, Math.round(from.y) - 1, 3, 3, channel);
    if (layout.wide) {
      // In the middle of the gap between the dice and the column, into the middle of the bar of the record.
      const bus = record.x - GAP / 2;
      const into = record.y + 1 + BAR_H / 2;
      kit.wire([from, { x: bus, y: from.y }, { x: bus, y: into }, { x: record.x, y: into }], channel);
    } else {
      const bus = space.x + space.w - UNIT;
      kit.wire([from, { x: Math.max(bus, from.x), y: from.y }, { x: Math.max(bus, from.x), y: record.y }], channel);
    }
  }

  /** The record of the file the figure stands on, with the bar that runs it. */
  private drawRecord(kit: Kit, layout: MenuLayout, file: MenuFile, channel: string, pressed: string | null): void {
    const { bg, ink, dim } = kit.palette;
    const box = layout.record;
    const left = box.x + EDGE;
    const right = box.x + box.w - EDGE;
    kit.box(box, bg);
    kit.frame(box, channel, true);
    kit.bar(box, '', '', channel, bg);
    // The ends of the bar are the arrows that turn the record, each with a line of the dark after it; a pressed one is dark with a lit arrow.
    const ends: readonly [id: string, sign: string, x: number][] = [
      [PREV_ID, PAGER.prev, box.x + 1],
      [NEXT_ID, PAGER.next, box.x + box.w - PAGER_WIDTH],
    ];
    for (const [id, sign, x] of ends) {
      const held = pressed === id;
      const w = PAGER_WIDTH - 1;
      if (held) kit.rect(x, box.y + 1, w, BAR_H, bg);
      kit.text(sign, x + w / 2, box.y + 3, held ? channel : bg, { align: 'center', bold: true });
    }
    kit.rect(box.x + PAGER_WIDTH, box.y + 1, 1, BAR_H, bg);
    kit.rect(box.x + box.w - PAGER_WIDTH - 1, box.y + 1, 1, BAR_H, bg);
    kit.text(`FILE ${digits(file.face, 2)}/${digits(MENU_FILES.length, 2)}`, box.x + PAGER_WIDTH + EDGE, box.y + 3, bg, { bold: true });
    kit.text(`${STATUS.channels}${file.face}`, box.x + box.w - PAGER_WIDTH - EDGE, box.y + 3, bg, { align: 'right', bold: true });

    const nameEnd = kit.text(word(file.name), left, box.y + RECORD_NAME, ink, { scale: 2, bold: true });
    kit.text(file.native, nameEnd + CELL_W, box.y + RECORD_NATIVE, dim);
    kit.text(t(file.line), left, box.y + RECORD_LINE, ink);
    kit.field(`${file.field[0]} ${word(file.field[1])}`, this.value(file.field[2]), left, right, box.y + RECORD_FIELD, dim, ink);

    const exec = layout.exec;
    const label = `${file.exec.native} ${word(file.exec.name)}`;
    const textY = exec.y + (exec.h - CELL_H) / 2;
    if (pressed !== null && pressed !== PREV_ID && pressed !== NEXT_ID) {
      kit.frame(exec, ink);
      kit.text(label, exec.x + exec.w / 2, textY, ink, { align: 'center', bold: true });
    } else {
      kit.box(exec, ink);
      kit.text(label, exec.x + exec.w / 2, textY, bg, { align: 'center', bold: true });
    }
  }

  /**
   * The header: the logo and the clock on its first line; on its second the levels of the six
   * channels, the noise of a line that nothing is connected to, and the revision; the rule under it.
   */
  private drawHeader(kit: Kit, header: MenuLayout['header']): void {
    const { ink, dim, faint, channels } = kit.palette;
    drawLogo(kit, header.left, header.y, 1, ink);
    const now = new Date();
    const clock = [now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => digits(part, 2)).join(':');
    kit.text(clock, header.right, header.y, ink, { align: 'right' });

    const y = header.second;
    let x = kit.text(STATUS.channels, header.left, y, dim) + CELL_W;
    channels.forEach((channel, i) => {
      const level = 2 + Math.round(chance(this.beat, i) * 10);
      kit.rect(x, y + 14 - level, CELL_W, level, channel);
      x += CELL_W + UNIT;
    });
    kit.text(REVISION, header.right, y, dim, { align: 'right' });
    kit.rect(header.left, header.rule, header.right - header.left, 1, faint);
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
