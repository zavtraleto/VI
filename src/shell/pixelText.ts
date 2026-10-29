import { CELL_H, signPlaces, textWidth } from './layout';
import { glyphOf, paintGlyph } from './pixelFont';
import { PROGRAM_FONT } from './theme';

/**
 * The letters of the program on any canvas. Every text of the game is written in them: the
 * readings of the program, and the prose that speaks to the player - a hint, a note, what the
 * other side says under a picture (the owner, 29 October 2026: «этого белого шрифта в игре быть
 * вообще не должно больше»). A line is made once as dots, one pixel a dot, and put on the
 * canvas as large as it is asked, in whole pixels a dot, so every dot stays square.
 */

/** A dot is lit when at least this much of it is covered, out of 255. */
const DOT_THRESHOLD = 128;
/**
 * The font's strokes are a dot and a half thick. A quarter of a dot to one side leaves one
 * dot of each stroke more than half covered; a quarter to the other leaves two.
 */
const LIGHT_SHIFT = -0.25;
const BOLD_SHIFT = 0.25;
/** Lines kept as dots, and in their colours; when there are more, all are thrown away and made anew. */
const MASK_LIMIT = 400;
const SPRITE_LIMIT = 600;
/** The eight dots around a dot: where the dark edge of a line lies. */
const AROUND: readonly (readonly [number, number])[] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/**
 * The dots of a line of text, white where lit, `scale` pixels a dot: every sign at its own
 * place. A drawn letter is its own dots (`pixelFont.ts`); any other sign is the font's, made dots.
 */
export function textDots(text: string, scale: number, bold: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, textWidth(text, scale));
  canvas.height = CELL_H * scale;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.font = `${CELL_H * scale}px ${PROGRAM_FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  const shift = (bold ? BOLD_SHIFT : LIGHT_SHIFT) * scale;
  const places = signPlaces(text);
  let i = 0;
  for (const sign of text) {
    const glyph = glyphOf(sign);
    if (glyph) paintGlyph(ctx, glyph, places[i] * scale, 0, scale);
    else ctx.fillText(sign, places[i] * scale + shift, 14 * scale + shift);
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
  return canvas;
}

const masks = new Map<string, HTMLCanvasElement>();
const sprites = new Map<string, HTMLCanvasElement>();

function mask(text: string): HTMLCanvasElement {
  let kept = masks.get(text);
  if (!kept) {
    if (masks.size >= MASK_LIMIT) masks.clear();
    kept = textDots(text, 1, false);
    masks.set(text, kept);
  }
  return kept;
}

/** A line in its colour, one pixel a dot; with `edge`, that colour one dot out all around it. */
function sprite(text: string, color: string, edge: string | null): HTMLCanvasElement {
  const key = `${color}|${edge ?? ''}|${text}`;
  const kept = sprites.get(key);
  if (kept) return kept;
  if (sprites.size >= SPRITE_LIMIT) sprites.clear();
  const dots = mask(text);
  const pad = edge === null ? 0 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = dots.width + pad * 2;
  canvas.height = dots.height + pad * 2;
  const ctx = canvas.getContext('2d')!;
  if (edge === null) ctx.drawImage(dots, 0, 0);
  else for (const [dx, dy] of AROUND) ctx.drawImage(dots, pad + dx, pad + dy);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = edge ?? color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (edge !== null) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sprite(text, color, null), pad, pad);
  }
  sprites.set(key, canvas);
  return canvas;
}

/** Width of a line written `dot` pixels a dot. */
export function dotsWidth(text: string, dot: number): number {
  return textWidth(text) * dot;
}

/** Height of a line of the font, `dot` pixels a dot: sixteen dots. */
export function dotsLine(dot: number): number {
  return CELL_H * dot;
}

/** Whole pixels a dot for letters of about `size` pixels: one at least. */
export function dotFor(size: number): number {
  return Math.max(1, Math.round(size / CELL_H));
}

/**
 * Writes a line in the program's letters on `ctx`, `dot` pixels a dot, its top left at `x, y`.
 * With `edge`, a dark ring one dot wide keeps it readable over a picture. Returns where it ends.
 */
export function writeDots(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, dot: number, color: string, edge: string | null = null): number {
  const width = dotsWidth(text, dot);
  if (!text) return x;
  const image = sprite(text, color, edge);
  const pad = edge === null ? 0 : dot;
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, Math.round(x) - pad, Math.round(y) - pad, image.width * dot, image.height * dot);
  ctx.imageSmoothingEnabled = smooth;
  return x + width;
}
