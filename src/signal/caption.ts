import type { SignalLook } from './scene';

/**
 * A caption is a subtitle burnt into the picture: light letters with a dark edge, centred low
 * in the frame. It is the voice of the other side, and the serif is how that voice is told
 * from the program's. The letters are sized as a fraction of the frame a 4:3 screen would show.
 */
const SIZE = 1 / 13;
const LEADING = 1.3;
/** The widest a line gets and how far the last line stays from the bottom, as fractions of the frame. */
const WIDTH = 0.82;
const BOTTOM = 0.12;
/** The game's own serif. A stand-in until the fonts of the program are chosen. */
export const CAPTION_FONT = 'Forum, Georgia, "Times New Roman", serif';
const COLOR = '#f4f1ea';
const EDGE = 'rgba(8, 8, 10, 0.9)';
/** How much of the picture's blur, smear and colour parting the letters take. */
const SOFTNESS = 0.35;
/** A line breaks here whatever its width. */
const BREAK = /\s*[|\n]\s*/;

/** Words put into lines no wider than `width`, as `measure` sees them. `|` starts a new line. */
export function wrapCaption(text: string, width: number, measure: (line: string) => number): string[] {
  const lines: string[] = [];
  for (const part of text.split(BREAK)) {
    let line = '';
    for (const word of part.split(/\s+/).filter(Boolean)) {
      const longer = line ? `${line} ${word}` : word;
      if (line && measure(longer) > width) {
        lines.push(line);
        line = word;
      } else {
        line = longer;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * The look of the layer the caption is drawn on. It goes through the same signal as the
 * picture, but it has to stay readable: letters are not dithered and take only a part of the blur.
 */
export function captionLook(look: SignalLook): SignalLook {
  return {
    ...look,
    depth: 8,
    dither: 0,
    glow: 0,
    blur: look.blur * SOFTNESS,
    smear: look.smear * SOFTNESS,
    chroma: look.chroma * SOFTNESS,
  };
}

/** Writes a caption into the frame `x, y, width, height` of a canvas. The canvas is not cleared. */
export function drawCaption(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number): void {
  if (!text) return;
  const unit = Math.min(height, (width * 3) / 4);
  const size = unit * SIZE;
  ctx.font = `${size}px ${CAPTION_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, size / 7);
  ctx.strokeStyle = EDGE;
  ctx.fillStyle = COLOR;
  const lines = wrapCaption(text, width * WIDTH, (line) => ctx.measureText(line).width);
  lines.forEach((line, i) => {
    const at = y + height * (1 - BOTTOM) - (lines.length - 1 - i) * size * LEADING;
    ctx.strokeText(line, x + width / 2, at);
    ctx.fillText(line, x + width / 2, at);
  });
}

/** The serif comes with the page and may not be there for the first drawing: this waits for it. */
export function loadCaptionFont(sample: string): Promise<void> {
  const fonts = document.fonts;
  if (!fonts) return Promise.resolve();
  return fonts.load(`16px ${CAPTION_FONT}`, sample || 'VI').then(
    () => undefined,
    () => undefined,
  );
}
