import { Display } from '../display/display';
import type { CanvasLayer, Layer } from '../display/layer';
import {
  MOODS,
  captionLines,
  isMood,
  sceneRecord,
  sceneValues,
  signalLook,
  type Mood,
  type ParamValues,
  type SceneDef,
  type SceneInstance,
} from '../signal/scene';
import { SCENES, sceneById } from '../signal/scenes';
import { Panel } from './panel';

/**
 * The caption is a subtitle burnt into the picture: light letters with a dark edge, centred
 * low in the frame. The letters are sized as a fraction of the frame a 4:3 screen would show.
 */
const CAPTION_SIZE = 1 / 13;
const CAPTION_LEADING = 1.3;
/** The widest a line gets and how far the last line stays from the bottom, as fractions of the frame. */
const CAPTION_WIDTH = 0.82;
const CAPTION_BOTTOM = 0.12;
/** The game's own serif. A stand-in until the fonts of the program are chosen. */
const CAPTION_FONT = 'Forum, Georgia, "Times New Roman", serif';
const CAPTION_COLOR = '#f4f1ea';
const CAPTION_EDGE = 'rgba(8, 8, 10, 0.9)';
/** How much of the picture's blur, smear and colour parting the letters take. */
const CAPTION_SOFTNESS = 0.35;
/** A line breaks here whatever its width. */
const CAPTION_BREAK = /\s*[|\n]\s*/;

/** Words put into lines no wider than `width`, as `measure` sees them. */
function wrap(text: string, width: number, measure: (line: string) => number): string[] {
  const lines: string[] = [];
  for (const part of text.split(CAPTION_BREAK)) {
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

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // No permission, or the page is not focused: the old way below still works.
  }
  // The clipboard API is missing on a page opened over plain http, as from a phone on the same network.
  const area = document.createElement('textarea');
  area.value = text;
  area.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

/**
 * The page where a transmission is looked at and tuned:
 * `?lab=sea_pole&variant=b&mood=strange&seed=3`, with `&ui=0` to leave the panel out.
 */
export class Lab {
  readonly display = new Display();
  def: SceneDef;
  variant: string;
  mood: Mood;
  seed: number;
  /** The same object for as long as the scene stays: the panel is bound to it. */
  values: ParamValues;
  caption = '';
  /** What the last copy put on the clipboard. */
  copied: string | null = null;
  private readonly signal: Layer;
  private readonly captionLayer: CanvasLayer;
  private instance: SceneInstance | null = null;
  /** The scene has to be built again before the next frame. */
  private stale = true;

  constructor() {
    const query = new URLSearchParams(window.location.search);
    this.def = sceneById(query.get('lab')) ?? SCENES[0];
    this.variant = this.knownVariant(query.get('variant'));
    const mood = query.get('mood');
    this.mood = isMood(mood) ? mood : MOODS[0];
    const seed = Number.parseInt(query.get('seed') ?? '', 10);
    this.seed = Number.isFinite(seed) ? seed : 1;
    this.values = sceneValues(this.def, this.variant, this.mood);

    this.caption = query.get('caption') ?? '';

    const lines = Number(this.values.lines);
    this.signal = this.display.addLayer({ name: 'signal', lines });
    this.captionLayer = this.display.addCanvasLayer({ name: 'caption', lines: this.captionLines(lines) });
    this.captionLayer.onResize = () => this.drawCaption();
    this.drawCaption();
    // The serif comes with the page and may not be there yet for the first drawing.
    void document.fonts?.load(`16px ${CAPTION_FONT}`, this.caption || 'VI').then(() => this.drawCaption());

    if (query.get('ui') !== '0') new Panel(this);
    const loop = (time: number): void => {
      requestAnimationFrame(loop);
      this.frame(time);
    };
    requestAnimationFrame(loop);
  }

  /** Draws one frame. Called from the console where frames have to be stepped by hand. */
  frame(timeMs: number): void {
    this.display.sync();
    if (this.stale || !this.instance) this.rebuild();
    // The window may have turned since the last frame.
    this.captionLayer.setLines(this.captionLines(Number(this.values.lines)));
    const instance = this.instance!;
    instance.update(timeMs, this.display.width / this.display.height);
    this.signal.render(instance.scene, instance.camera);
    this.display.present(timeMs);
  }

  /** A parameter or the seed has changed: the scene is built anew, time goes on. */
  touch(): void {
    this.stale = true;
  }

  setScene(id: string): void {
    const def = sceneById(id);
    if (!def || def === this.def) return;
    this.def = def;
    this.variant = this.knownVariant(null);
    this.values = sceneValues(def, this.variant, this.mood);
    this.touch();
    this.writeAddress();
  }

  setVariant(variant: string): void {
    this.variant = this.knownVariant(variant);
    this.reset();
    this.writeAddress();
  }

  setMood(mood: Mood): void {
    this.mood = mood;
    this.reset();
    this.writeAddress();
  }

  setSeed(seed: number): void {
    this.seed = Math.round(seed) | 0;
    this.touch();
    this.writeAddress();
  }

  /** Back to the variant and the mood as they are defined. The seed stays. */
  reset(): void {
    Object.assign(this.values, sceneValues(this.def, this.variant, this.mood));
    this.touch();
  }

  /** `|` starts a new line; long lines wrap by themselves. */
  setCaption(text: string): void {
    this.caption = text;
    this.drawCaption();
    this.writeAddress();
  }

  /** The tuned scene as JSON: its id, the seed and the values that differ from the defaults. */
  json(): string {
    const record: Record<string, unknown> = { ...sceneRecord(this.def, this.seed, this.values) };
    if (this.caption) record.caption = this.caption;
    return JSON.stringify(record, null, 2);
  }

  async copy(): Promise<boolean> {
    const text = this.json();
    const done = await copyText(text);
    this.copied = done ? text : null;
    return done;
  }

  private knownVariant(name: string | null): string {
    const names = Object.keys(this.def.variants);
    return name !== null && names.includes(name) ? name : (names[0] ?? '');
  }

  private rebuild(): void {
    this.instance?.dispose();
    this.instance = this.def.build(this.values, this.seed);
    this.stale = false;
    const look = signalLook(this.values);
    this.signal.setLines(Number(this.values.lines));
    Object.assign(this.signal.look, look);
    // The caption goes through the same signal, but it has to stay readable: letters are not
    // dithered and take only a part of the blur.
    Object.assign(this.captionLayer.look, look, {
      depth: 8,
      dither: 0,
      glow: 0,
      blur: look.blur * CAPTION_SOFTNESS,
      smear: look.smear * CAPTION_SOFTNESS,
      chroma: look.chroma * CAPTION_SOFTNESS,
    });
  }

  private captionLines(lines: number): number {
    return captionLines(lines, this.display.width / this.display.height);
  }

  private drawCaption(): void {
    const { ctx, width, height } = this.captionLayer;
    ctx.clearRect(0, 0, width, height);
    if (this.caption) {
      const unit = Math.min(height, (width * 3) / 4);
      const size = unit * CAPTION_SIZE;
      ctx.font = `${size}px ${CAPTION_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1.5, size / 7);
      ctx.strokeStyle = CAPTION_EDGE;
      ctx.fillStyle = CAPTION_COLOR;
      const lines = wrap(this.caption, width * CAPTION_WIDTH, (line) => ctx.measureText(line).width);
      lines.forEach((line, i) => {
        const y = height * (1 - CAPTION_BOTTOM) - (lines.length - 1 - i) * size * CAPTION_LEADING;
        ctx.strokeText(line, width / 2, y);
        ctx.fillText(line, width / 2, y);
      });
    }
    this.captionLayer.markDirty();
  }

  /** The address always names what is on screen, so it can be reloaded or sent to a phone. */
  private writeAddress(): void {
    const query = new URLSearchParams(window.location.search);
    query.set('lab', this.def.id);
    query.set('variant', this.variant);
    query.set('mood', this.mood);
    query.set('seed', String(this.seed));
    if (this.caption) query.set('caption', this.caption);
    else query.delete('caption');
    window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
  }
}

export function startLab(): Lab {
  const lab = new Lab();
  // For the console, and for stepping frames where the browser does not run them itself.
  (window as unknown as { lab: Lab }).lab = lab;
  return lab;
}
