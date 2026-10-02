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
  /** How many signs of the text are there yet, for words that come little by little; all of them when left out. */
  reveal?: number;
}

const LEADING = 1.3;
const COLOR = '#f4f1ea';
const DIM = 'rgba(244, 241, 234, 0.62)';
const EDGE = 'rgba(8, 8, 10, 0.9)';
/** The picture of the voice has this many times the lines of the program's own picture. */
const DETAIL = 2;

/**
 * Text that is not the program's: prose in the language of the one who plays - what the
 * exercise asks for, a hint, a note - in the white serif of the captions of transmissions.
 * The program's own font is a raster of sixteen dots and cannot carry a sentence; and a
 * sentence addressed to the player is not the program reading out its own records.
 *
 * It is a layer of its own, finer than the program's picture and under the same lines of the
 * tube. It is drawn anew only when what it says has changed.
 */
export class Voice {
  private readonly layer: CanvasLayer;
  private readonly probe = document.createElement('canvas').getContext('2d')!;
  private said = '';
  private queue: VoiceLine[] = [];

  constructor(
    private readonly display: Display,
    /** The look of the program's interface: the voice is shown on its tube. */
    private readonly shell: ParamValues,
    name: string,
  ) {
    this.layer = display.addCanvasLayer({ name, lines: 480, look: { opacity: 0, filter: 'linear' } });
    this.layer.onResize = () => (this.said = '');
    void loadCaptionFont('VI Жя').then(() => (this.said = ''));
  }

  /** Height in CSS pixels that a text takes at a width and a size of letters. */
  height(text: string, width: number, size: number): number {
    if (!text) return 0;
    this.probe.font = `${size}px ${CAPTION_FONT}`;
    return wrapCaption(text, width, (line) => this.probe.measureText(line).width).length * size * LEADING;
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
    ctx.clearRect(0, 0, layer.width, layer.height);
    ctx.lineJoin = 'round';
    ctx.textBaseline = 'alphabetic';
    for (const line of this.queue) {
      const size = line.size * scale;
      ctx.font = `${size}px ${CAPTION_FONT}`;
      const width = line.box.width * scale;
      const rows = wrapCaption(line.text, width, (row) => ctx.measureText(row).width);
      const tall = rows.length * size * LEADING;
      const free = line.box.height * scale - tall;
      const top = line.box.y * scale + (line.anchor === 'bottom' ? free : line.anchor === 'middle' ? free / 2 : 0);
      const centre = (line.align ?? 'center') === 'center';
      ctx.textAlign = centre ? 'center' : 'left';
      ctx.lineWidth = Math.max(1.5, size / 7);
      ctx.strokeStyle = EDGE;
      ctx.fillStyle = line.dim ? DIM : COLOR;
      const x = line.box.x * scale + (centre ? width / 2 : 0);
      // Words that are still coming keep the places they will have: a line is written from
      // where it will start, and the lines not reached yet are left empty.
      let left = line.reveal ?? Infinity;
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
    layer.markDirty();
  }

  /** Nothing is said. */
  clear(): void {
    this.begin();
    this.end();
  }
}
