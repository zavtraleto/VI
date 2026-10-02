import { CAPTION_FONT } from '../signal/caption';
import type { CanvasLayer } from '../display/layer';
import type { Rect, Size } from '../display/sizing';
import type { ParamValues } from '../signal/scene';
import { CELL_H, CELL_W, signPlaces, textWidth, type Box, type Point } from './layout';
import { PROGRAM_FONT, type Palette } from './theme';

export interface TextOptions {
  /** How many times its own size the text is; whole numbers only. */
  scale?: number;
  /** Which edge of the text `x` is. */
  align?: 'left' | 'right' | 'center';
  /** Strokes two dots thick in place of one. */
  bold?: boolean;
}

/** A line of text as dots: drawn once, kept, tinted every time it is used. */
interface Mask {
  canvas: HTMLCanvasElement;
  width: number;
}

/** A dot is lit when at least this much of it is covered, out of 255. */
const DOT_THRESHOLD = 128;
/**
 * The font's strokes are a dot and a half thick. A quarter of a dot to one side leaves one
 * dot of each stroke more than half covered; a quarter to the other leaves two.
 */
const LIGHT_SHIFT = -0.25;
const BOLD_SHIFT = 0.25;
/** Lines of text kept as dots; when there are more, all are thrown away and drawn anew. */
const MASK_LIMIT = 600;
/** Pips of each value on a grid of three by three, row by row. */
export const FACE_PIPS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};

/**
 * Drawing of the interface on its canvas layer. The picture has few pixels and every one of
 * them is either lit or not: text is a raster font at its own size, lines run along the
 * pixels, colours are solid. Everything is given in pixels of the picture.
 */
export class Kit {
  /** The colours of this moment of the day. Whoever owns the kit keeps them current. */
  palette: Palette;
  private readonly masks = new Map<string, Mask>();
  private readonly tint = document.createElement('canvas');
  private readonly strip = document.createElement('canvas');

  constructor(
    private readonly layer: CanvasLayer,
    private readonly window: Size,
    readonly values: ParamValues,
    palette: Palette,
  ) {
    this.palette = palette;
  }

  /** The picture in its own pixels. */
  get width(): number {
    return this.layer.width;
  }

  get height(): number {
    return this.layer.height;
  }

  /** CSS pixels of the window per pixel of the picture. */
  get zoom(): number {
    return this.window.height / Math.max(1, this.layer.height);
  }

  number(name: string): number {
    return Number(this.values[name] ?? 0);
  }

  /** A box of the picture as a rectangle of the window, for the zones that take a press. */
  toWindow(box: Box): Rect {
    const sx = this.window.width / Math.max(1, this.layer.width);
    const sy = this.window.height / Math.max(1, this.layer.height);
    return { x: box.x * sx, y: box.y * sy, width: box.w * sx, height: box.h * sy };
  }

  /** Starts a picture: an empty layer and a known state of the canvas. */
  begin(): void {
    const { ctx } = this.layer;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.layer.width, this.layer.height);
  }

  /** Empties a part of the picture, to draw that part alone again. */
  clear(box: Box): void {
    this.layer.ctx.clearRect(Math.round(box.x), Math.round(box.y), Math.round(box.w), Math.round(box.h));
  }

  /**
   * Slides rows of the picture sideways, between `x` and `x + w`: a signal that slips. What was
   * drawn so far moves; what is drawn after stays where it is put.
   */
  tear(rows: readonly { y: number; h: number; dx: number }[], x = 0, w = this.layer.width): void {
    const { ctx } = this.layer;
    const { strip } = this;
    const left = Math.round(x);
    const wide = Math.round(w);
    for (const row of rows) {
      const y = Math.round(row.y);
      const h = Math.max(1, Math.round(row.h));
      const dx = Math.round(row.dx);
      if (dx === 0 || wide <= 0) continue;
      // Setting the size empties the strip.
      strip.width = wide;
      strip.height = h;
      strip.getContext('2d')!.drawImage(ctx.canvas, left, y, wide, h, 0, 0, wide, h);
      ctx.clearRect(left, y, wide, h);
      ctx.drawImage(strip, left + dx, y);
    }
  }

  /**
   * A sign in a hand that is not the program's: the serif of the captions of transmissions,
   * soft among the dots of the raster. `size` is the height of the program's letters it stands in for.
   */
  foreign(text: string, x: number, y: number, size: number, color: string): void {
    const { ctx } = this.layer;
    ctx.font = `${Math.round(size * 1.1)}px ${CAPTION_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(text, Math.round(x), Math.round(y + size * 0.86));
  }

  /** The picture is finished: the layer takes it to the screen. */
  end(): void {
    this.layer.markDirty();
  }

  /** A new font has arrived: text drawn with the stand-in is forgotten. */
  forgetText(): void {
    this.masks.clear();
  }

  /** The whole picture in one colour. */
  fill(color: string): void {
    this.rect(0, 0, this.layer.width, this.layer.height, color);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    if (w <= 0 || h <= 0) return;
    const { ctx } = this.layer;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  box(box: Box, color: string): void {
    this.rect(box.x, box.y, box.w, box.h, color);
  }

  /** Every other dot of a rectangle, as a chessboard: the half-tone of a screen with one colour. */
  dither(x: number, y: number, w: number, h: number, color: string, every = 2): void {
    const { ctx } = this.layer;
    ctx.fillStyle = color;
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    for (let row = 0; row < h; row++) {
      for (let col = (row * (every >> 1)) % every; col < w; col += every) ctx.fillRect(x0 + col, y0 + row, 1, 1);
    }
  }

  /** The outline of a box, one dot thick, with a stud at each corner where asked. */
  frame(box: Box, color: string, studs = false): void {
    const { x, y, w, h } = box;
    this.rect(x, y, w, 1, color);
    this.rect(x, y + h - 1, w, 1, color);
    this.rect(x, y, 1, h, color);
    this.rect(x + w - 1, y, 1, h, color);
    if (!studs) return;
    for (const cx of [x, x + w - 1]) for (const cy of [y, y + h - 1]) this.rect(cx - 1, cy - 1, 3, 3, color);
  }

  /** A line from point to point through every dot on the way, at any angle. */
  wire(points: readonly Point[], color: string): void {
    const { ctx } = this.layer;
    ctx.fillStyle = color;
    for (let i = 1; i < points.length; i++) {
      let x = Math.round(points[i - 1].x);
      let y = Math.round(points[i - 1].y);
      const x1 = Math.round(points[i].x);
      const y1 = Math.round(points[i].y);
      const dx = Math.abs(x1 - x);
      const dy = -Math.abs(y1 - y);
      const sx = x < x1 ? 1 : -1;
      const sy = y < y1 ? 1 : -1;
      let error = dx + dy;
      for (;;) {
        ctx.fillRect(x, y, 1, 1);
        if (x === x1 && y === y1) break;
        const twice = 2 * error;
        if (twice >= dy) {
          error += dy;
          x += sx;
        }
        if (twice <= dx) {
          error += dx;
          y += sy;
        }
      }
    }
  }

  /** A filled circle of whole dots. */
  disc(cx: number, cy: number, radius: number, color: string): void {
    const { ctx } = this.layer;
    ctx.fillStyle = color;
    const r = Math.max(0.5, radius);
    for (let row = Math.floor(-r); row <= Math.ceil(r); row++) {
      const half = Math.sqrt(Math.max(0, r * r - row * row));
      const from = Math.round(cx - half);
      const to = Math.round(cx + half);
      if (to > from) ctx.fillRect(from, Math.round(cy) + row, to - from, 1);
    }
  }

  /** Width of a line of text in pixels of the picture. */
  measure(text: string, scale = 1): number {
    return textWidth(text, scale);
  }

  /**
   * A line of text; `y` is the top of its row of places. Returns where the text ends, so the
   * next piece of the line can follow it.
   */
  text(text: string, x: number, y: number, color: string, options: TextOptions = {}): number {
    const scale = Math.max(1, Math.round(options.scale ?? 1));
    const width = textWidth(text, scale);
    const left = Math.round(options.align === 'right' ? x - width : options.align === 'center' ? x - width / 2 : x);
    if (text === '') return left;
    const mask = this.mask(text, scale, options.bold ?? false);
    const { tint } = this;
    if (tint.width < mask.canvas.width || tint.height < mask.canvas.height) {
      tint.width = Math.max(tint.width, mask.canvas.width);
      tint.height = Math.max(tint.height, mask.canvas.height);
    }
    const paint = tint.getContext('2d')!;
    paint.globalCompositeOperation = 'copy';
    paint.drawImage(mask.canvas, 0, 0);
    paint.globalCompositeOperation = 'source-in';
    paint.fillStyle = color;
    paint.fillRect(0, 0, mask.canvas.width, mask.canvas.height);
    this.layer.ctx.drawImage(tint, 0, 0, mask.canvas.width, mask.canvas.height, left, Math.round(y), mask.canvas.width, mask.canvas.height);
    return left + width;
  }

  /**
   * A line of text that stays readable over a picture: the same text in the dark of the tube
   * all around it first, as an edge.
   */
  edged(text: string, x: number, y: number, color: string, options: TextOptions = {}): number {
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) if (dx !== 0 || dy !== 0) this.text(text, x + dx, y + dy, this.palette.bg, options);
    }
    return this.text(text, x, y, color, options);
  }

  /** The face of a die, flat: a square of its colour with its pips as dots. The one has a single large pip. */
  face(value: number, x: number, y: number, size: number, color: string, pip: string): void {
    this.rect(x, y, size, size, color);
    const dot = Math.max(1, Math.round(size * (value === 1 ? 0.3 : 0.18)));
    for (const cell of FACE_PIPS[value] ?? []) {
      const cx = x + size * (0.22 + 0.28 * (cell % 3));
      const cy = y + size * (0.22 + 0.28 * Math.floor(cell / 3));
      this.rect(Math.round(cx - dot / 2), Math.round(cy - dot / 2), dot, dot, pip);
    }
  }

  /** A small picture made elsewhere, dot for dot, with its top left corner at `x, y`. */
  image(source: CanvasImageSource, x: number, y: number): void {
    this.layer.ctx.drawImage(source, Math.round(x), Math.round(y));
  }

  /** The dark of the tube over every other dot of the picture: what lies under a panel is still there, but has stepped back. */
  veil(): void {
    this.dither(0, 0, this.layer.width, this.layer.height, this.palette.bg);
  }

  /** A row of dots between two points of a line, on the grid of places: what joins a name to its value. */
  leader(from: number, to: number, y: number, color: string): void {
    const start = Math.ceil(from / CELL_W) * CELL_W;
    for (let x = start; x + CELL_W <= to; x += CELL_W) this.rect(x + 3, y + 11, 2, 2, color);
  }

  /** A name on the left, its value on the right, dots between: a line of a form. */
  field(label: string, value: string, x: number, right: number, y: number, labelColor: string, valueColor: string): void {
    const labelEnd = this.text(label, x, y, labelColor);
    const valueStart = right - this.measure(value);
    this.text(value, valueStart, y, valueColor);
    this.leader(labelEnd + CELL_W, valueStart - CELL_W, y, this.palette.faint);
  }

  /** The dots of a line of text: every sign at its own place, each dot lit or not. */
  private mask(text: string, scale: number, bold: boolean): Mask {
    const key = `${scale}${bold ? 'b' : 'l'}${text}`;
    const kept = this.masks.get(key);
    if (kept) return kept;
    if (this.masks.size >= MASK_LIMIT) this.masks.clear();

    const canvas = document.createElement('canvas');
    const width = textWidth(text, scale);
    canvas.width = Math.max(1, width);
    canvas.height = CELL_H * scale;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.font = `${CELL_H * scale}px ${PROGRAM_FONT}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    const shift = (bold ? BOLD_SHIFT : LIGHT_SHIFT) * scale;
    const places = signPlaces(text);
    let i = 0;
    for (const sign of text) {
      ctx.fillText(sign, places[i] * CELL_W * scale + shift, 14 * scale + shift);
      i++;
    }
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = image;
    for (let at = 0; at < data.length; at += 4) {
      const lit = data[at + 3] >= DOT_THRESHOLD;
      data[at] = data[at + 1] = data[at + 2] = 255;
      data[at + 3] = lit ? 255 : 0;
    }
    ctx.putImageData(image, 0, 0);
    const mask = { canvas, width };
    this.masks.set(key, mask);
    return mask;
  }
}
