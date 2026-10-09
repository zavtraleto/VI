import type { Display } from '../display/display';
import type { CanvasLayer } from '../display/layer';
import type { Rect } from '../display/sizing';
import { CAPTION_FONT, loadCaptionFont, wrapCaption } from '../signal/caption';
import type { ParamValues } from '../signal/scene';
import { pictureSize } from './layout';

/** What is written, in white, where the program's own font would not do. */
export interface VoiceLine {
  text: string;
  /** Where it goes, in CSS pixels of the window: its width wraps the text. */
  box: Rect;
  /** Height of the letters in CSS pixels. */
  size: number;
  align?: 'left' | 'center';
  /** Which edge of the box the text holds to when it is shorter than the box. */
  anchor?: 'top' | 'middle' | 'bottom';
  /** Secondary text: fainter. */
  dim?: boolean;
  /** How bright, 0 to 1, for words that come and go; 1 when left out. */
  alpha?: number;
  /** How many signs of the text are there yet, for words that come little by little; all of them when left out. */
  reveal?: number;
  /** As `reveal`, for a text whose own clock says how much of it is there: `reveal()` of the voice leaves it as it is. */
  shown?: number;
  /** Signs that come before this text, where several are typed one after another: it starts when they are there. */
  after?: number;
}

const LEADING = 1.3;
const COLOR = '#f4f1ea';
const DIM = 'rgba(244, 241, 234, 0.62)';
const EDGE = 'rgba(8, 8, 10, 0.9)';
/** The picture of the voice has this many times the lines of the program's own picture. */
const DETAIL = 2;
/** Texts kept as they were put into lines; when there are more, all are thrown away. */
const WRAP_LIMIT = 200;

/** A part of the picture, in its own pixels. */
interface Patch {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Text that is not the program's: prose in the language of the one who plays - what the
 * exercise asks for, a hint, a note - in the white serif of the captions of transmissions.
 * The program's own font is a raster of sixteen dots and cannot carry a sentence; and a
 * sentence addressed to the player is not the program reading out its own records.
 *
 * It is a layer of its own, finer than the program's picture and under the same lines of the
 * tube. It is drawn anew only when what it says has changed, and then only the part of the
 * picture that holds the words is written and sent to the graphics card: the picture is as
 * large as the screen, and words that come sign by sign change it many times a second.
 */
export class Voice {
  private readonly layer: CanvasLayer;
  private readonly probe = document.createElement('canvas').getContext('2d')!;
  private said = '';
  private queue: VoiceLine[] = [];
  /** The part of the picture the words now on it take; null while it is empty. */
  private written: Patch | null = null;
  /** Texts as they were put into lines, by the text, the width and the size of the letters. */
  private readonly wraps = new Map<string, string[]>();

  constructor(
    private readonly display: Display,
    /** The look of the program's interface: the voice is shown on its tube. */
    private readonly shell: ParamValues,
    name: string,
  ) {
    this.layer = display.addCanvasLayer({ name, lines: 480, look: { opacity: 0, filter: 'linear' } });
    this.layer.onResize = () => {
      // A canvas that has taken a new size is empty.
      this.said = '';
      this.written = null;
    };
    void loadCaptionFont('VI Жя').then(() => {
      // The letters of the stand-in font were of other widths.
      this.said = '';
      this.wraps.clear();
    });
  }

  /** Height in CSS pixels that a text takes at a width and a size of letters. */
  height(text: string, width: number, size: number): number {
    if (!text) return 0;
    return this.wrap(this.probe, text, width, size).length * size * LEADING;
  }

  /** A text in lines no wider than `width`, with letters of `size`: worked out once and kept. */
  private wrap(ctx: CanvasRenderingContext2D, text: string, width: number, size: number): string[] {
    const key = `${size}|${width}|${text}`;
    let rows = this.wraps.get(key);
    if (!rows) {
      if (this.wraps.size >= WRAP_LIMIT) this.wraps.clear();
      ctx.font = `${size}px ${CAPTION_FONT}`;
      rows = wrapCaption(text, width, (line) => ctx.measureText(line).width);
      this.wraps.set(key, rows);
    }
    return rows;
  }

  /** Starts what is said this frame. */
  begin(): void {
    this.queue = [];
  }

  say(line: VoiceLine): void {
    if (line.text) this.queue.push(line);
  }

  /** Puts on screen what was said since `begin()`; nothing said, nothing shown. */
  end(): void {
    const { layer, display, shell } = this;
    if (this.queue.length === 0) {
      layer.look.opacity = 0;
      this.said = '';
      return;
    }
    display.sync();
    const canvas = { width: display.width * display.pixelRatio, height: display.height * display.pixelRatio };
    const lines = pictureSize(canvas, Number(shell.pixelsTall), Number(shell.pixelsWide)).height;
    layer.setLines(Math.min(canvas.height, lines * DETAIL));
    Object.assign(layer.look, { opacity: 1, scanlines: Number(shell.scanlines), scanlinePitch: lines, vignette: Number(shell.vignette) });

    const said = JSON.stringify(this.queue) + layer.width + 'x' + layer.height;
    if (said === this.said) return;
    this.said = said;
    const { ctx } = layer;
    const scale = layer.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // What was written before is taken away; the rest of the picture is empty already.
    const before = this.written;
    if (before) ctx.clearRect(before.left, before.top, before.right - before.left, before.bottom - before.top);
    const now: Patch = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    ctx.lineJoin = 'round';
    ctx.textBaseline = 'alphabetic';
    for (const line of this.queue) {
      const size = line.size * scale;
      const width = line.box.width * scale;
      const rows = this.wrap(ctx, line.text, width, size);
      ctx.font = `${size}px ${CAPTION_FONT}`;
      const tall = rows.length * size * LEADING;
      const free = line.box.height * scale - tall;
      const top = line.box.y * scale + (line.anchor === 'bottom' ? free : line.anchor === 'middle' ? free / 2 : 0);
      // Room for the edge of the letters, and for a word that is wider than its line.
      now.left = Math.min(now.left, line.box.x * scale - size);
      now.right = Math.max(now.right, line.box.x * scale + width + size);
      now.top = Math.min(now.top, top - size * 0.5);
      now.bottom = Math.max(now.bottom, top + tall + size * 0.5);
      const centre = (line.align ?? 'center') === 'center';
      ctx.textAlign = centre ? 'center' : 'left';
      ctx.lineWidth = Math.max(1.5, size / 7);
      ctx.strokeStyle = EDGE;
      ctx.fillStyle = line.dim ? DIM : COLOR;
      ctx.globalAlpha = line.alpha ?? 1;
      const x = line.box.x * scale + (centre ? width / 2 : 0);
      // Words that are still coming keep the places they will have: a line is written from
      // where it will start, and the lines not reached yet are left empty.
      let left = line.reveal ?? line.shown ?? Infinity;
      rows.forEach((row, i) => {
        if (left <= 0) return;
        const y = top + (i + 0.82) * size * LEADING;
        const part = row.slice(0, left);
        left -= row.length + 1;
        const at = centre && part.length < row.length ? x - ctx.measureText(row).width / 2 : x;
        if (centre && part.length < row.length) ctx.textAlign = 'left';
        ctx.strokeText(part, at, y);
        ctx.fillText(part, at, y);
        if (centre) ctx.textAlign = 'center';
      });
    }
    ctx.globalAlpha = 1;
    now.left = Math.max(0, Math.floor(now.left));
    now.top = Math.max(0, Math.floor(now.top));
    now.right = Math.min(layer.width, Math.ceil(now.right));
    now.bottom = Math.min(layer.height, Math.ceil(now.bottom));
    this.written = now;
    // Only what has changed goes to the graphics card: where the words were, and where they are.
    const left = Math.min(now.left, before?.left ?? now.left);
    const top = Math.min(now.top, before?.top ?? now.top);
    const right = Math.max(now.right, before?.right ?? now.right);
    const bottom = Math.max(now.bottom, before?.bottom ?? now.bottom);
    layer.markDirty({ x: left, y: top, width: right - left, height: bottom - top });
  }

  /**
   * More of the words that come little by little are there: `signs` of them. What was said
   * last stands as it was, and those words alone are written again.
   */
  reveal(signs: number): void {
    let more = false;
    for (const line of this.queue) {
      if (line.reveal === undefined) continue;
      const now = Math.max(0, signs - (line.after ?? 0));
      if (line.reveal === now) continue;
      line.reveal = now;
      more = true;
    }
    if (more) this.end();
  }

  /** Nothing is said. */
  clear(): void {
    this.begin();
    this.end();
  }
}
