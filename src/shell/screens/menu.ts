import type { Layer } from '../../display/layer';
import type { Rect } from '../../display/sizing';
import { word } from '../../ui/i18n';
import type { Kit } from '../kit';
import { CELL_H, isWide, netProjection, netStep, textWidth, zoneOf, type Box, type Dir4, type NetProjection } from '../layout';
import { drawLogo } from '../logo';
import type { ShellContext, ShellFocus, ShellItem, ShellScreen } from '../screen';
import { ShellSpace } from '../space';
import { MENU_COMMAND, MENU_FILES, digits, type FileField, type MenuFile } from '../text';
import { EDGE, GAP, MENU_DESK, MENU_PHONE, UNIT, mixHex, type Palette } from '../theme';

/** What the files of the main menu do, and the command under them. */
export interface MenuActions {
  onEndless: () => void;
  onLevels: () => void;
  onHowTo: () => void;
  onReadme: () => void;
  onRecords: () => void;
  onSystem: () => void;
  /** The command: the place of the row the player stands on starts, as the screen the program opens on starts it. */
  onPlay: () => void;
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
  /** Records of the link the sum of the stars has opened, out of how many there are. */
  storyOpen: number;
  storyTotal: number;
  /** The language of the player, under its own name. */
  language: string;
  /** The number of the place the command starts. */
  place: number;
}

/** The command under the dice, or at the bottom of the card of a phone. */
const COMMAND_ID = 'play';

/** A card of a desk: its file, where it stands, and whether it is in the column left of the dice. */
interface DeskCard {
  file: MenuFile;
  box: Box;
  left: boolean;
}

type Plan =
  | { kind: 'desk'; net: Box; command: Box; cards: DeskCard[] }
  | {
      kind: 'phone';
      net: Box;
      /** The middle card, its neighbours, and the command on the middle one. */
      card: Box;
      prev: Box;
      next: Box;
      command: Box;
      /** The middle of the row of dots of the pages. */
      dots: number;
      /** What is left of the picture across a line of it: where the zones of the neighbours reach. */
      left: number;
      right: number;
    };

/** The files left of the dice on a desk and right of them, from the top down. */
const DESK_LEFT = ['howto', 'records', 'system'] as const;
const DESK_RIGHT = ['protocol', 'levels', 'readme'] as const;

const fileOf = (id: string): MenuFile | undefined => MENU_FILES.find((file) => file.id === id);
const byFace = (face: number): MenuFile => MENU_FILES.find((file) => file.face === face)!;

/**
 * The main menu (docs/superpowers/specs/2026-11-05-vi-menu-design.md). Its face is the net of a
 * die: six dice of glass in the dark, one file of the program on each, and the red figure that
 * steps from die to die. Every file is a card in the colour of its die, with the pips of its face,
 * its name and what it counts.
 *
 * On a desk the six cards stand in two columns either side of the dice, a wire from each die to
 * its card; the card and the die of a file are one zone, lit together, and open the file at a
 * press. Under the dice is the command that goes on with the levels.
 *
 * On a phone the dice take the screen, and one card stands at the bottom with its command; its
 * neighbours peep in at the sides. A swipe, or a tap on a neighbour, brings the next card; a tap on
 * a die brings its own.
 */
export class MenuScreen implements ShellScreen {
  readonly home = COMMAND_ID;
  private readonly space: ShellSpace;
  private readonly actions: Record<string, () => void>;
  /** The file the figure stands on: on a desk the lit card, on a phone the middle one. */
  private current: MenuFile;

  constructor(
    private readonly context: ShellContext,
    private readonly menu: MenuActions,
    private readonly data: MenuData,
    /** The file the figure waits on: the one the player has come back from. The levels when left out. */
    home?: string,
  ) {
    this.actions = {
      levels: menu.onLevels,
      protocol: menu.onEndless,
      howto: menu.onHowTo,
      readme: menu.onReadme,
      records: menu.onRecords,
      system: menu.onSystem,
    };
    this.current = (home ? fileOf(home) : undefined) ?? byFace(1);
    this.space = new ShellSpace(context.values);
    this.space.place(this.current.face);
  }

  items(): ShellItem[] {
    const plan = this.plan();
    const zoom = this.zoom();
    const items: ShellItem[] = [];
    if (plan.kind === 'desk') {
      const projection = this.projection(plan.net);
      // The card and the die of a file are one zone in two places: pointing at either lights both, and a press opens the file.
      for (const { file, box } of plan.cards) {
        items.push({ id: file.id, rect: this.toWindow(box), action: this.actions[file.id] });
        items.push({ id: file.id, rect: this.toWindow(this.dieZone(projection, file)), action: this.actions[file.id] });
      }
      items.push({ id: COMMAND_ID, rect: this.toWindow(zoneOf(plan.command, zoom)), action: this.menu.onPlay });
      return items;
    }
    const { card, command } = plan;
    // The middle card above its command opens its file: the levels open their list, which the command passes by.
    items.push({ id: this.current.id, rect: this.toWindow({ x: card.x, y: card.y, w: card.w, h: command.y - card.y }), action: this.actions[this.current.id] });
    items.push({ id: COMMAND_ID, rect: this.toWindow(command), action: () => this.run(this.current) });
    // A neighbour is pressed from the edge of the screen to the middle card, as high as it: it comes to the middle, as by a swipe.
    items.push(
      { id: 'prev', rect: this.toWindow({ x: plan.left, y: card.y, w: card.x - plan.left, h: card.h }), action: () => this.context.focus(this.beside(-1)), passive: true, instant: true, quiet: true },
      { id: 'next', rect: this.toWindow({ x: card.x + card.w, y: card.y, w: plan.right - card.x - card.w, h: card.h }), action: () => this.context.focus(this.beside(1)), passive: true, instant: true, quiet: true },
    );
    // A die brings its card to the middle and opens nothing. Its zone stops where the cards begin.
    const projection = this.projection(plan.net);
    for (const file of MENU_FILES) {
      const zone = this.dieZone(projection, file);
      const bottom = Math.min(zone.y + zone.h, card.y);
      if (bottom <= zone.y) continue;
      items.push({
        id: `die-${file.id}`,
        rect: this.toWindow({ ...zone, h: bottom - zone.y }),
        action: () => this.context.focus(this.stand(file)),
        passive: true,
        instant: true,
        quiet: true,
      });
    }
    return items;
  }

  /** On a phone a swipe anywhere brings the card after (to the left) or before (to the right). A desk makes nothing of it. */
  swipe(dir: 'left' | 'right'): string | null {
    if (this.plan().kind !== 'phone') return null;
    return this.beside(dir === 'left' ? 1 : -1);
  }

  /**
   * The keys walk the net as the figure walks the board: to the die next to this one. Down from
   * where the net ends is the command, and up from the command the die the figure stands on. On
   * a phone left and right bring the cards before and after.
   */
  move(focus: string | null, dir: Dir4): string | null {
    const on = focus === null ? undefined : fileOf(focus);
    if (this.plan().kind === 'phone') {
      if (dir === 'left' || dir === 'right') return this.beside(dir === 'right' ? 1 : -1);
      return dir === 'down' ? COMMAND_ID : this.current.id;
    }
    if (!on) return dir === 'up' ? this.current.id : COMMAND_ID;
    const face = netStep(on.face, dir);
    if (face === on.face && dir === 'down') return COMMAND_ID;
    return byFace(face).id;
  }

  face(id: string): number | null {
    return fileOf(id.replace(/^die-/, ''))?.face ?? null;
  }

  update(): boolean {
    return false;
  }

  scene(layer: Layer, palette: Palette, focus: ShellFocus, timeMs: number): boolean {
    this.follow(focus);
    const { net } = this.plan();
    this.space.stand(this.current.face);
    this.space.render(layer, this.toWindow(net), this.projection(net), palette, timeMs, this.context.reducedMotion());
    return true;
  }

  dispose(): void {
    this.space.dispose();
  }

  draw(kit: Kit, focus: ShellFocus): void {
    this.follow(focus);
    const plan = this.plan();
    const { top, left } = this.frame();
    drawLogo(kit, left + EDGE, top + EDGE, 1, kit.palette.ink);
    if (plan.kind === 'desk') this.drawDesk(kit, plan, focus);
    else this.drawPhone(kit, plan, focus);
  }

  /** What a command runs: the levels start the place the player stands on, any other file opens. */
  private run(file: MenuFile): void {
    if (file.id === 'levels') this.menu.onPlay();
    else this.actions[file.id]();
  }

  /** The file so many numbers on from the one the figure stands on, round the six; the figure is on it from this moment. */
  private beside(step: number): string {
    const count = MENU_FILES.length;
    return this.stand(byFace(((this.current.face - 1 + step + count) % count) + 1));
  }

  /** The figure stands on a file from this moment, not from the next frame: two quick presses go two files on. */
  private stand(file: MenuFile): string {
    this.current = file;
    return file.id;
  }

  /** A file in focus is the one the figure stands on. */
  private follow(focus: ShellFocus): void {
    const file = focus.focus === null ? undefined : fileOf(focus.focus);
    if (file) this.current = file;
  }

  // ---- plans ----

  /** CSS pixels of the window to a dot of the picture. */
  private zoom(): number {
    return this.context.window().height / Math.max(1, this.context.picture().height);
  }

  /** The picture less what the edges of the screen keep to themselves, rounded out to the grid. */
  private frame(): { left: number; top: number; right: number; bottom: number } {
    const { width, height } = this.context.picture();
    const safe = this.context.safe();
    const out = (value: number): number => Math.ceil(value / UNIT) * UNIT;
    return { left: out(safe.left), top: out(safe.top), right: width - out(safe.right), bottom: height - out(safe.bottom) };
  }

  private plan(): Plan {
    const picture = this.context.picture();
    const frame = this.frame();
    const { column, gutter, minNet } = MENU_DESK;
    // A picture that lies on its side but is too narrow for two columns and the dice between them is laid out as a phone.
    const desk = isWide(picture) && frame.right - frame.left - 2 * (EDGE + column + gutter) >= minNet;
    return desk ? this.desk(frame) : this.phone(frame);
  }

  /** The desk: the dice in the middle, the command under them, three cards either side (section 5). */
  private desk(frame: { left: number; top: number; right: number; bottom: number }): Plan {
    const { column, gutter, card, command: commandH } = MENU_DESK;
    const top = frame.top + MENU_DESK.top;
    const bottom = frame.bottom - (MENU_DESK.height - MENU_DESK.bottom);
    const netX = frame.left + EDGE + column + gutter;
    const netW = frame.right - EDGE - column - gutter - netX;
    const command: Box = { x: netX, y: bottom - commandH, w: netW, h: commandH };
    const net: Box = { x: netX, y: top, w: netW, h: command.y - GAP - top };
    // The top cards level with the top of the dice, the bottom ones with the foot of the command, the middle ones between.
    const step = (bottom - top - card) / 2;
    const ys = [top, top + step, bottom - card].map(Math.round);
    const cards: DeskCard[] = [
      ...DESK_LEFT.map((id, i) => ({ file: fileOf(id)!, box: { x: frame.left + EDGE, y: ys[i], w: column, h: card }, left: true })),
      ...DESK_RIGHT.map((id, i) => ({ file: fileOf(id)!, box: { x: frame.right - EDGE - column, y: ys[i], w: column, h: card }, left: false })),
    ];
    return { kind: 'desk', net, command, cards };
  }

  /** The phone: the dice over the screen, one card at the bottom with its neighbours at the sides, the dots of the pages under it (section 6). */
  private phone(frame: { left: number; top: number; right: number; bottom: number }): Plan {
    const { card: cardW, cardH, gap, inset, command: commandH, dots, netSide, netH, netMiddle } = MENU_PHONE;
    const width = frame.right - frame.left;
    const height = frame.bottom - frame.top;
    const w = Math.min(cardW, width - 2 * EDGE);
    const card: Box = { x: frame.left + Math.round((width - w) / 2), y: frame.bottom - EDGE - dots - cardH, w, h: cardH };
    const prev: Box = { x: card.x - gap - w, y: card.y + inset, w, h: cardH - 2 * inset };
    const next: Box = { x: card.x + w + gap, y: card.y + inset, w, h: cardH - 2 * inset };
    const command: Box = { x: card.x + EDGE, y: card.y + card.h - EDGE - commandH, w: card.w - 2 * EDGE, h: commandH };
    // The dice a little narrower than the screen, their middle a little above its middle, never over the logo.
    const tall = Math.round(height * netH);
    const highest = frame.top + EDGE + CELL_H + 2 * EDGE;
    const net: Box = { x: frame.left + netSide, y: Math.max(highest, frame.top + Math.round(height * netMiddle - tall / 2)), w: width - 2 * netSide, h: tall };
    return { kind: 'phone', net, card, prev, next, command, dots: frame.bottom - EDGE - dots / 2, left: frame.left, right: frame.right };
  }

  private projection(net: Box): NetProjection {
    const { values } = this.context;
    return netProjection(net, { yaw: Number(values.spaceYaw), pitch: Number(values.spacePitch), gap: Number(values.spaceGap), fill: Number(values.spaceFill) });
  }

  /** The square zone around a die. */
  private dieZone(projection: NetProjection, file: MenuFile): Box {
    const centre = projection.centres[file.face - 1];
    const side = projection.zone;
    return { x: centre.x - side / 2, y: centre.y - side / 2, w: side, h: side };
  }

  private toWindow(box: Box): Rect {
    const window = this.context.window();
    const picture = this.context.picture();
    const sx = window.width / Math.max(1, picture.width);
    const sy = window.height / Math.max(1, picture.height);
    return { x: box.x * sx, y: box.y * sy, width: box.w * sx, height: box.h * sy };
  }

  // ---- drawing ----

  private drawDesk(kit: Kit, plan: Extract<Plan, { kind: 'desk' }>, focus: ShellFocus): void {
    const { bg, faint } = kit.palette;
    const projection = this.projection(plan.net);
    const lit = this.current.id;
    // The wires first, the lit one last, so that it lies over the others.
    const order = [...plan.cards].sort((a, b) => Number(a.file.id === lit) - Number(b.file.id === lit));
    for (const { file, box, left } of order) {
      const on = file.id === lit;
      const channel = kit.palette.channels[file.face - 1];
      const centre = projection.centres[file.face - 1];
      const from = { x: Math.round(centre.x + (left ? -1 : 1) * projection.unit * MENU_DESK.wireFrom), y: Math.round(centre.y) };
      const edge = left ? box.x + box.w : box.x;
      const into = box.y + MENU_DESK.wireInto;
      const bend = left ? edge + MENU_DESK.wireBend : edge - MENU_DESK.wireBend;
      kit.wire([from, { x: bend, y: from.y }, { x: bend, y: into }, { x: edge, y: into }], on ? channel : mixHex(bg, faint, MENU_DESK.restWire));
      kit.rect(from.x - 1, from.y - 1, 3, 3, on ? channel : faint);
    }
    for (const { file, box } of plan.cards) this.drawCard(kit, file, box, file.id === lit);
    const label = `${word(this.data.levelsDone > 0 ? MENU_COMMAND.going : MENU_COMMAND.first)} · ${digits(this.data.place, 2)}`;
    this.drawCommand(kit, plan.command, label, focus.focus === COMMAND_ID && focus.pressed !== COMMAND_ID, focus.pressed === COMMAND_ID);
  }

  /** A card of a desk: at rest a quiet frame and a strip dimmed towards the dark; lit, both in its colour, with a light around it and in it. */
  private drawCard(kit: Kit, file: MenuFile, box: Box, on: boolean): void {
    const { bg, ink, dim, faint } = kit.palette;
    const channel = kit.palette.channels[file.face - 1];
    if (on) for (let r = MENU_DESK.glowRings; r >= 1; r--) kit.light(box.x - r, box.y - r, box.w + 2 * r, box.h + 2 * r, channel, MENU_DESK.glowOut);
    kit.box(box, bg);
    if (on) kit.light(box.x, box.y, box.w, box.h, channel, MENU_DESK.glowIn);
    kit.frame(box, on ? channel : mixHex(bg, faint, MENU_DESK.restFrame));
    const strip = on ? channel : mixHex(bg, channel, MENU_DESK.restStrip);
    const nameX = this.drawStrip(kit, file, box, strip, MENU_DESK.strip, MENU_DESK.pips);
    kit.text(word(file.name), nameX, box.y + 1 + (MENU_DESK.strip - CELL_H) / 2, bg, { bold: true });
    // The value in the middle of what the strip leaves of the card.
    const y = box.y + 1 + MENU_DESK.strip + Math.round((box.h - 1 - MENU_DESK.strip - CELL_H) / 2);
    kit.text(word(file.field[0]), box.x + EDGE, y, on ? dim : mixHex(bg, dim, MENU_DESK.restLabel));
    kit.text(this.value(file.field[1]), box.x + box.w - EDGE, y, on ? ink : dim, { align: 'right' });
  }

  /**
   * The strip across the top of a card, inside its frame, and the pips of its face at its left: square,
   * in the dark of the tube on the colour of the strip. Returns where its name starts, half a gap after them.
   */
  private drawStrip(kit: Kit, file: MenuFile, box: Box, color: string, height: number, pips: number): number {
    kit.rect(box.x + 1, box.y + 1, box.w - 2, height, color);
    const inset = 1 + (height - pips) / 2;
    kit.face(file.face, box.x + inset, box.y + inset, pips, color, kit.palette.bg);
    return box.x + inset + pips + EDGE / 2;
  }

  /**
   * The command: filled with the tone, its word in the dark, twice its size where it fits. Under the
   * pointer a light around it and the red mark at its left; held, it is a frame with its word lit.
   */
  private drawCommand(kit: Kit, box: Box, label: string, hover: boolean, pressed: boolean): void {
    const { bg, ink } = kit.palette;
    if (hover) for (let r = MENU_DESK.commandRings; r >= 1; r--) kit.light(box.x - r, box.y - r, box.w + 2 * r, box.h + 2 * r, ink, MENU_DESK.commandGlow);
    if (pressed) kit.frame(box, ink);
    else kit.box(box, ink);
    if (hover) kit.mark(box);
    const scale = textWidth(label, 2) <= box.w - MENU_DESK.commandRoom ? 2 : 1;
    kit.text(label, box.x + box.w / 2, box.y + Math.round((box.h - CELL_H * scale) / 2), pressed ? ink : bg, { align: 'center', bold: true, scale });
  }

  private drawPhone(kit: Kit, plan: Extract<Plan, { kind: 'phone' }>, focus: ShellFocus): void {
    const { bg, ink, dim, faint, channels } = kit.palette;
    const count = MENU_FILES.length;
    const file = this.current;
    const before = byFace(((file.face - 2 + count) % count) + 1);
    const after = byFace((file.face % count) + 1);
    for (const [side, box] of [[before, plan.prev], [after, plan.next]] as const) {
      kit.light(box.x, box.y, box.w, box.h, bg, MENU_PHONE.sideVeil);
      kit.frame(box, mixHex(bg, faint, MENU_PHONE.sideFrame));
      this.drawStrip(kit, side, box, mixHex(bg, channels[side.face - 1], MENU_PHONE.sideStrip), MENU_PHONE.strip, MENU_PHONE.pips);
    }
    const box = plan.card;
    const channel = channels[file.face - 1];
    kit.light(box.x, box.y, box.w, box.h, bg, MENU_PHONE.veil);
    kit.frame(box, channel);
    const nameX = this.drawStrip(kit, file, box, channel, MENU_PHONE.strip, MENU_PHONE.pips);
    const name = word(file.name);
    // Twice its size; a name too long for that in some language is written at its own size.
    const scale = textWidth(name, 2) <= box.x + box.w - EDGE - nameX ? 2 : 1;
    kit.text(name, nameX, box.y + 1 + Math.round((MENU_PHONE.strip - CELL_H * scale) / 2), bg, { scale, bold: true });
    // The value midway between the strip and the command.
    const y = Math.round((box.y + 1 + MENU_PHONE.strip + plan.command.y - CELL_H) / 2);
    kit.text(word(file.field[0]), box.x + EDGE, y, dim);
    kit.text(this.value(file.field[1]), box.x + box.w - EDGE, y, ink, { align: 'right' });
    const label = file.id === 'levels' ? `${word(MENU_COMMAND.first)} · ${digits(this.data.place, 2)}` : word(file.exec.name);
    this.drawCommand(kit, plan.command, label, false, focus.pressed === COMMAND_ID);
    // The dots of the pages: the one of the middle card lit.
    const { dot, dotStep } = MENU_PHONE;
    const start = Math.round((plan.left + plan.right) / 2 - (count * dotStep) / 2);
    for (let i = 0; i < count; i++) kit.rect(start + i * dotStep + (dotStep - dot) / 2, plan.dots - dot / 2, dot, dot, i === file.face - 1 ? ink : faint);
  }

  /** What a card counts, as it is written on it: plain numbers, with no leading zeros but those of the levels. */
  private value(kind: FileField): string {
    const { data } = this;
    switch (kind) {
      case 'levels':
        return `${digits(data.levelsDone, 2)}/${digits(data.levelsTotal, 2)}`;
      case 'bestEndless':
        return String(Math.max(0, Math.round(data.bestEndless)));
      case 'rules':
        return String(data.rules);
      case 'story':
        return `${data.storyOpen}/${data.storyTotal}`;
      case 'sessions':
        return String(data.sessions);
      case 'language':
        return data.language;
    }
  }
}
