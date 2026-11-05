import type { Size } from '../../display/sizing';
import { t, word } from '../../ui/i18n';
import type { Kit } from '../kit';
import { CELL_H, MIN_ZONE, textWidth, type Box, type Insets } from '../layout';
import type { ShellContext, ShellFocus, ShellItem, ShellScreen } from '../screen';
import { CALL, COMMANDS, PANELS } from '../text';
import { PANEL_SAY_SIZE } from '../theme';

/**
 * The screen of an incoming call (docs/superpowers/specs/2026-11-05-vi-live-calls-design.md,
 * section 7.1; the owner, 5 November 2026: «как будто игроку кто-то позвонил… это не сцена, это
 * немного иной интерфейс… принять звонок или сбросить его»). It says no rules: who calls is not
 * known, and the call is about three minutes. Two large buttons under the thumb: decline on the
 * left, take it on the right. Enter takes it, Esc declines it.
 *
 * The look is variant B1, "the phone of the program", a proposal of the agent: the owner leads the
 * look, and the whole of it is drawn by `drawCall` and laid out by `callLayout`, so that another
 * variant (B2 "a strip", B3 "a terminal") is a change of these two alone.
 */

const ACCEPT_ID = 'accept';
const DECLINE_ID = 'decline';
/** The name of the button is written at so many times the size of a line where it fits. */
const SCALE = 2;
const MARGIN = 8;
/** Between the two buttons. */
const GAP = 8;
/** On a phone held upright the buttons stand one such part of the screen above its bottom edge. */
const THUMB = 10;
/** The widest a button gets on a wide screen, in pixels of the picture: as wide as on a phone. */
const BUTTON_MOST = 150;
/** The squares of the signal: how many, how far apart they start, and how often a new one goes out. */
const RINGS = 3;
const RING_STEP = 14;
const RING_MS = 1000;
/** The call rings again so often while its screen is up: two tones and a pause. */
const RING_AGAIN_MS = 2400;

const ceilTo = (value: number, step: number): number => Math.ceil(value / step) * step;

/** Where the parts of the screen stand, in pixels of the picture. */
export interface CallLayout {
  /** The line of the program at the top: `ちゃくしん INCOMING`. */
  label: { x: number; y: number };
  /** The middle of the sign of the call, and the most a square of it reaches out. */
  sign: { x: number; y: number; reach: number };
  /** Who calls: the line of the number, under the sign. */
  number: { x: number; y: number };
  /** The line in the voice of the player: a call of about three minutes. */
  say: Box;
  decline: Box;
  accept: Box;
}

/**
 * The layout of the screen of a call for a picture of this size, a window of this size in CSS
 * pixels and the edges the screen keeps to itself. The buttons are each at least the zone of a
 * finger the interface keeps to (`MIN_ZONE`), side by side in the middle; on a phone held upright
 * they stand low, under the thumb.
 */
export function callLayout(picture: Size, window: Size, safe: Insets): CallLayout {
  const zoom = window.height / Math.max(1, picture.height);
  const room = picture.width - safe.left - safe.right;
  const left = safe.left;
  const widest = Math.max(textWidth(word(COMMANDS.accept.name), SCALE), textWidth(word(COMMANDS.decline.name), SCALE)) + 16;
  const w = Math.max(Math.ceil(MIN_ZONE / Math.max(0.1, zoom)), Math.min(Math.floor((room - 2 * MARGIN - GAP) / 2), Math.max(BUTTON_MOST, widest)));
  const h = Math.max(CELL_H * SCALE + 16, ceilTo((1.5 * MIN_ZONE) / Math.max(0.1, zoom), 4));
  const upright = window.height > window.width;
  const bottom = picture.height - safe.bottom;
  const y = upright ? bottom - Math.round(picture.height / THUMB) - h : Math.round(safe.top + (picture.height - safe.top - safe.bottom) * 0.72);
  const middle = Math.round(left + room / 2);
  const decline = { x: middle - Math.floor(GAP / 2) - w, y, w, h };
  const accept = { x: middle + Math.ceil(GAP / 2), y, w, h };
  const top = safe.top + MARGIN * 2;
  const reach = RING_STEP * (RINGS + 1);
  const signY = Math.round(top + CELL_H * 2 + (y - top - CELL_H * 6) * 0.42);
  const numberY = signY + reach + CELL_H;
  const sayW = Math.min(room - 2 * MARGIN, 260);
  return {
    label: { x: middle, y: top },
    sign: { x: middle, y: signY, reach },
    number: { x: middle, y: numberY },
    say: { x: Math.round(middle - sayW / 2), y: numberY + CELL_H * 2, w: sayW, h: CELL_H * 3 },
    decline,
    accept,
  };
}

/**
 * Draws the screen of a call over the board, which stays in sight and steps back: the line of the
 * program at the top, the sign of the call going out in squares, who calls, and the two buttons.
 * `timeMs` moves the sign; with `still` it stands.
 */
export function drawCall(kit: Kit, layout: CallLayout, focus: ShellFocus, timeMs: number, still: boolean): void {
  const { bg, ink, dim, faint, signal } = kit.palette;
  kit.veil();
  // The line of the program: its word in kana and in the language of the player.
  kit.text(`${PANELS.incoming.native}  ${word(PANELS.incoming.name)}`, layout.label.x, layout.label.y, ink, { align: 'center', bold: true });
  // The sign of the call: squares that go out from the middle, a new one every second, and fade as they go.
  const { sign } = layout;
  kit.rect(sign.x - 3, sign.y - 3, 6, 6, signal);
  const phase = still ? 0 : (timeMs % RING_MS) / RING_MS;
  for (let i = 0; i < RINGS; i++) {
    const along = (i + phase) / RINGS;
    const half = Math.round(RING_STEP * (1 + i + phase));
    if (half > sign.reach) continue;
    kit.frame({ x: sign.x - half, y: sign.y - half, w: half * 2, h: half * 2 }, along < 0.45 ? ink : along < 0.8 ? dim : faint);
  }
  // Who calls: the number is not known.
  kit.text(`${CALL.number.native} ${CALL.number.name}`, layout.number.x, layout.number.y, dim, { align: 'center' });
  kit.text(t('callUnknown').toLocaleUpperCase(), layout.number.x, layout.number.y + CELL_H + 4, ink, { align: 'center' });
  // The two buttons: decline is the program's dim frame, the call is taken by the filled one.
  button(kit, layout.decline, word(COMMANDS.decline.name), focus, DECLINE_ID, { fill: bg, edge: focus.focus === DECLINE_ID ? ink : dim, text: dim });
  button(kit, layout.accept, word(COMMANDS.accept.name), focus, ACCEPT_ID, { fill: ink, edge: ink, text: bg });
}

function button(kit: Kit, box: Box, label: string, focus: ShellFocus, id: string, tone: { fill: string; edge: string; text: string }): void {
  const pressed = focus.pressed === id;
  const scale = kit.measure(label, SCALE) <= box.w - 12 ? SCALE : 1;
  const y = box.y + Math.round((box.h - CELL_H * scale) / 2);
  kit.box(box, pressed ? kit.palette.bg : tone.fill);
  kit.frame(box, pressed ? kit.palette.ink : tone.edge);
  kit.text(label, box.x + box.w / 2, y, pressed ? kit.palette.ink : tone.text, { align: 'center', scale, bold: !pressed && tone.fill !== kit.palette.bg });
  // In focus: the red mark of the seventh in its corner, as on a cell of the list.
  if (focus.focus === id) kit.rect(box.x + 4, box.y + 4, 6, 6, kit.palette.signal);
}

export class CallScreen implements ShellScreen {
  readonly home = ACCEPT_ID;
  private rang = -Infinity;
  private drawnPhase = -1;

  constructor(
    private readonly context: ShellContext,
    private readonly actions: { onAccept: () => void; onDecline: () => void },
  ) {}

  private layout(): CallLayout {
    return callLayout(this.context.picture(), this.context.window(), this.context.safe());
  }

  items(): ShellItem[] {
    const window = this.context.window();
    const picture = this.context.picture();
    const sx = window.width / Math.max(1, picture.width);
    const sy = window.height / Math.max(1, picture.height);
    const { decline, accept } = this.layout();
    const rect = (box: Box) => ({ x: box.x * sx, y: box.y * sy, width: box.w * sx, height: box.h * sy });
    return [
      { id: DECLINE_ID, rect: rect(decline), action: this.actions.onDecline },
      { id: ACCEPT_ID, rect: rect(accept), action: this.actions.onAccept },
    ];
  }

  update(timeMs: number): boolean {
    if (timeMs - this.rang >= RING_AGAIN_MS) {
      this.rang = timeMs;
      this.context.sound({ kind: 'ring' });
    }
    if (this.context.reducedMotion()) return false;
    // The sign moves in steps of a tenth of a second: the picture is drawn again only then.
    const phase = Math.floor((timeMs % RING_MS) / 100);
    if (phase === this.drawnPhase) return false;
    this.drawnPhase = phase;
    return true;
  }

  draw(kit: Kit, focus: ShellFocus): void {
    const layout = this.layout();
    drawCall(kit, layout, focus, this.drawnPhase * 100, this.context.reducedMotion());
    this.context.voice.say({ text: t('callLength'), box: kit.toWindow(layout.say), size: PANEL_SAY_SIZE, align: 'center', dim: true });
  }

  back(): void {
    this.actions.onDecline();
  }
}
