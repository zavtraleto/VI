import { dotFor, dotsLine, dotsWidth, writeDots } from '../shell/pixelText';
import { sayColors, type SayColors } from '../shell/theme';
import type { SignalLook } from './scene';

/**
 * A caption is a subtitle burnt into the picture: milky letters with a dark ring, centred low
 * in the frame. It is written in the program's own letters, as every text of the game is (the
 * owner, 29 October 2026). The letters are sized as a fraction of the frame a 4:3 screen would
 * show, and drawn in whole pixels a dot.
 */
const SIZE = 1 / 13;
/** Dots from the top of one line to the top of the next: the sixteen of the font and four of air. */
const PITCH_DOTS = 20;
/** The widest a line gets and how far the last line stays from the bottom, as fractions of the frame. */
const WIDTH = 0.82;
const BOTTOM = 0.12;
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
    for (const word of part.split(/[^\S ]+/).filter(Boolean)) {
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

/** Writes a line of letters, `dot` pixels a dot, its top left at `x, y`; with `edge`, a ring of that colour around it. */
export type CaptionWriter = (text: string, x: number, y: number, dot: number, color: string, edge: string | null) => void;

/** What more a caption can be asked for: a dark plate under it, its words coming one at a time, letters no smaller than this. */
export interface CaptionOptions {
  /** A dark band across the frame under the words, as under the subtitles of an old film. */
  plate?: boolean;
  /** How many of the words are there yet; all of them when left out. Each word stands where it will stand. */
  words?: number;
  /** The smallest the letters get, in pixels of the canvas. */
  minSize?: number;
  /** Pixels of the canvas a dot of the letters, in place of what the size of the frame gives. */
  dot?: number;
  /** The colours; those of the look's defaults when left out. */
  colors?: SayColors;
  /** What writes a line; the program's letters on `ctx` when left out. */
  write?: CaptionWriter;
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

/**
 * A word of a caption: whether it is of its link, the words between braces, and whether it is a
 * key word, the words between square brackets - `[1:единица]` names the face 1 and takes its
 * colour, `[звено]` names no face. The marks are not drawn. A word may go on past its link or
 * its key, as a stop does: `linkSigns` and `keyTo` are how much of it is theirs, and a key may
 * begin inside a word, at `keyFrom`.
 */
export interface CaptionWord {
  word: string;
  link: boolean;
  linkSigns?: number;
  /** `k` for a key word that names no face; `1`..`6` for one that names a face. */
  key?: string;
  keyFrom?: number;
  keyTo?: number;
}

/** The words of a caption, which of them are its link and which are key words. */
export function captionWords(text: string): CaptionWord[] {
  const words: CaptionWord[] = [];
  let link = false;
  let key: string | null = null;
  // A space that ties two signs together (U+00A0) keeps them one word, as in `wrapCaption`.
  for (const raw of text.split(/[^\S ]+/).filter(Boolean)) {
    let word = '';
    let inLink: boolean = link;
    let linkSigns: number | undefined;
    let wordKey: string | null = key;
    let keyFrom = 0;
    let keyTo: number | undefined;
    for (let i = 0; i < raw.length; i++) {
      const sign = raw[i];
      if (sign === '{') {
        link = inLink = true;
      } else if (sign === '}') {
        link = false;
        linkSigns = word.length;
      } else if (sign === '[') {
        const face = /^\[([1-6]):/.exec(raw.slice(i));
        key = wordKey = face ? face[1] : 'k';
        keyFrom = word.length;
        if (face) i += 2;
      } else if (sign === ']') {
        key = null;
        keyTo = word.length;
      } else {
        word += sign;
      }
    }
    if (!word) continue;
    const entry: CaptionWord = { word, link: inLink };
    if (inLink && linkSigns !== undefined && linkSigns < word.length) entry.linkSigns = linkSigns;
    if (wordKey) {
      entry.key = wordKey;
      if (keyFrom > 0) entry.keyFrom = keyFrom;
      if (keyTo !== undefined && keyTo < word.length) entry.keyTo = keyTo;
    }
    words.push(entry);
  }
  return words;
}

/** The text of a caption as it is read: without the marks of its link and its key words. */
export function plainCaption(text: string): string {
  return text.replace(/\[[1-6]:/g, '').replace(/[{}[\]]/g, '');
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

/** How wide the words get on the plate, and how far its bottom stays from the bottom of the frame. */
const PLATE_WIDTH = 0.86;
const PLATE_BOTTOM = 0.06;

/**
 * Writes a caption into the frame `x, y, width, height` of a canvas. The canvas is not cleared.
 * Burnt into the picture, unless a plate is asked for: then the words stand on a dark band, may
 * come one at a time, and the words of a link are underlined. Key words take their colours.
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
  const colors = options.colors ?? sayColors();
  const write: CaptionWriter = options.write ?? ((line, at, top, dot, color, edge) => writeDots(ctx, line, at, top, dot, color, edge));
  const unit = Math.min(height, (width * 3) / 4);
  const dot = options.dot ?? dotFor(Math.max(unit * SIZE, options.minSize ?? 0));
  const tall = dotsLine(dot);
  const pitch = PITCH_DOTS * dot;
  const measure = (line: string): number => dotsWidth(line, dot);
  const tokens = captionWords(text);
  // A `|` breaks the line and is not a word of it.
  const words = tokens.filter(({ word }) => word !== '|');
  const lines = wrapCaption(tokens.map(({ word }) => word).join(' '), width * (options.plate ? PLATE_WIDTH : WIDTH), measure);

  let topOf: (i: number) => number;
  if (options.plate) {
    const bottom = Math.round(y + height * (1 - PLATE_BOTTOM));
    const band = (lines.length + 1) * pitch;
    ctx.fillStyle = colors.plate;
    ctx.fillRect(x, bottom - band, width, band);
    // The letters stand from the fourth row of their sixteen: a dot higher looks the middle of the band.
    topOf = (i) => bottom - band + pitch / 2 + i * pitch + (pitch - tall) / 2 - dot;
  } else {
    const last = Math.round(y + height * (1 - BOTTOM)) - tall;
    topOf = (i) => last - (lines.length - 1 - i) * pitch;
  }

  const colorOf = (key: string): string => (key === 'k' ? colors.key : (colors.faces[Number(key) - 1] ?? colors.key));
  const space = measure(' ');
  const shown = options.words ?? words.length;
  let index = 0;
  lines.forEach((line, i) => {
    const top = Math.round(topOf(i));
    let left = Math.round(x + (width - measure(line)) / 2);
    let link: CaptionBox | null = null;
    for (const word of line.split(' ')) {
      const w = measure(word);
      const of = words[index];
      if (index < shown) {
        if (of?.key) {
          const from = of.keyFrom ?? 0;
          const to = of.keyTo ?? word.length;
          const head = word.slice(0, from);
          const body = word.slice(from, to);
          const tail = word.slice(to);
          if (head) write(head, left, top, dot, colors.ink, colors.edge);
          write(body, left + measure(head), top, dot, colorOf(of.key), colors.edge);
          if (tail) write(tail, left + measure(head + body), top, dot, colors.ink, colors.edge);
        } else {
          write(word, left, top, dot, colors.ink, colors.edge);
        }
        if (of?.link) {
          const lit = of.linkSigns === undefined ? w : measure(word.slice(0, of.linkSigns));
          if (link) link.w = left + lit - link.x;
          else link = { x: left, y: top - (pitch - tall) / 2, w: lit, h: pitch };
        }
      }
      left += w + space;
      index++;
    }
    if (link) {
      drawn.link.push(link);
      ctx.fillStyle = colors.ink;
      ctx.fillRect(link.x, top + tall, link.w, dot);
    }
  });
  return drawn;
}
