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
    // A space that ties two signs together (U+00A0) is not a place to break at.
    for (const word of part.split(/[^\S\u00a0]+/).filter(Boolean)) {
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

/** What more a caption can be asked for: a dark plate under it, its words coming one at a time, letters no smaller than this. */
export interface CaptionOptions {
  /** A dark band across the frame under the words, as under the subtitles of an old film. */
  plate?: boolean;
  /** How many of the words are there yet; all of them when left out. Each word stands where it will stand. */
  words?: number;
  /** The smallest the letters get, in pixels of the canvas. */
  minSize?: number;
}

export interface CaptionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What was drawn that can be pressed: the words of the link, one box a line, in pixels of the canvas. */
export interface CaptionDrawn {
  link: CaptionBox[];
}

/** The words of a caption, and whether each is of its link: the words between braces, which are not drawn. */
export function captionWords(text: string): { word: string; link: boolean }[] {
  const words: { word: string; link: boolean }[] = [];
  let open = false;
  // A space that ties two signs together (U+00A0) keeps them one word, as in `wrapCaption`.
  for (const raw of text.split(/[^\S ]+/).filter(Boolean)) {
    const opens = raw.includes('{');
    const closes = raw.includes('}');
    const word = raw.replace(/[{}]/g, '');
    if (word) words.push({ word, link: open || opens });
    if (opens) open = true;
    if (closes) open = false;
  }
  return words;
}

/** The text of a caption as it is read: without the braces of its link. */
export function plainCaption(text: string): string {
  return text.replace(/[{}]/g, '');
}

/** The words of a hint come one at a time, this far apart, unless the lab says otherwise (`hintWordMs`). */
export const HINT_WORD_MS = 180;

/**
 * The words that are there `elapsedMs` after they began: the first at once, and one more every
 * `perWordMs`, as if somebody said them; all of them where no time is given to a word. What is
 * returned is the start of the text as it is written, so its length is the signs to show.
 */
export function wordsShown(text: string, elapsedMs: number, perWordMs = HINT_WORD_MS): string {
  if (!(perWordMs > 0)) return text;
  const words = text.split(' ');
  const count = Math.floor(Math.max(0, elapsedMs) / perWordMs) + 1;
  return count >= words.length ? text : words.slice(0, count).join(' ');
}

/** The plate under the words: how dark, how wide the words get on it, and how far its bottom stays from the bottom of the frame. */
const PLATE = 'rgba(0, 0, 0, 0.55)';
const PLATE_WIDTH = 0.86;
const PLATE_BOTTOM = 0.06;

/**
 * Writes a caption into the frame `x, y, width, height` of a canvas. The canvas is not cleared.
 * Burnt into the picture as it always was, unless a plate is asked for: then the words stand
 * on a dark band, may come one at a time, and the words of a link are underlined.
 */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: CaptionOptions = {},
): CaptionDrawn {
  const drawn: CaptionDrawn = { link: [] };
  if (!text) return drawn;
  const unit = Math.min(height, (width * 3) / 4);
  const size = Math.max(unit * SIZE, options.minSize ?? 0);
  ctx.font = `${size}px ${CAPTION_FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, size / 7);
  ctx.strokeStyle = EDGE;
  ctx.fillStyle = COLOR;
  const measure = (line: string): number => ctx.measureText(line).width;
  if (!options.plate) {
    ctx.textAlign = 'center';
    const lines = wrapCaption(text, width * WIDTH, measure);
    lines.forEach((line, i) => {
      const at = y + height * (1 - BOTTOM) - (lines.length - 1 - i) * size * LEADING;
      ctx.strokeText(line, x + width / 2, at);
      ctx.fillText(line, x + width / 2, at);
    });
    return drawn;
  }

  const words = captionWords(text);
  const lines = wrapCaption(words.map(({ word }) => word).join(' '), width * PLATE_WIDTH, measure);
  const bottom = y + height * (1 - PLATE_BOTTOM);
  const step = size * LEADING;
  ctx.fillStyle = PLATE;
  ctx.fillRect(x, bottom - (lines.length + 1) * step, width, (lines.length + 1) * step);
  ctx.textAlign = 'left';
  const space = measure(' ');
  const shown = options.words ?? words.length;
  let index = 0;
  lines.forEach((line, i) => {
    const at = bottom - step * 0.5 - size * 0.25 - (lines.length - 1 - i) * step;
    let left = x + (width - measure(line)) / 2;
    let link: CaptionBox | null = null;
    for (const word of line.split(' ')) {
      const w = measure(word);
      const of = words[index];
      if (index < shown) {
        ctx.fillStyle = COLOR;
        ctx.strokeText(word, left, at);
        ctx.fillText(word, left, at);
        if (of?.link) {
          if (link) link.w = left + w - link.x;
          else link = { x: left, y: at - size, w, h: step };
        }
      }
      left += w + space;
      index++;
    }
    if (link) {
      drawn.link.push(link);
      ctx.fillStyle = COLOR;
      ctx.fillRect(link.x, at + size * 0.12, link.w, Math.max(1, size / 14));
    }
  });
  return drawn;
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
