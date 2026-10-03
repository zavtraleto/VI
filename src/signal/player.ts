import type { Display } from '../display/display';
import type { CanvasLayer, Layer } from '../display/layer';
import { quality } from '../display/quality';
import { loadShellFonts } from '../shell/fonts';
import { Kit } from '../shell/kit';
import { CELL_W, pictureSize } from '../shell/layout';
import { clockHour, paletteAt } from '../shell/theme';
import { captionLook, drawCaption, loadCaptionFont } from './caption';
import { GLIMPSE_SECONDS, cardScene, cardTitle, randomCard, type SignalCard } from './card';
import { SignalLeak, type LeakKind } from './leak';
import { captionLines, signalLook, type ParamValues, type SceneInstance } from './scene';
import type { SessionReading } from './terminal';
import { BAR, windowLayout, type WindowLayout, type WindowPlace } from './window';

/** A file opens from the top down, like a picture coming over a slow line. */
const OPEN_MS = 450;
/** A press closes the window only after this long, so the last press of the session does not. */
const SKIP_AFTER_MS = 600;
/** A glimpse comes before one session in this many: counted anew by chance each time, both ends included. */
const GLIMPSE_EVERY: readonly [number, number] = [4, 7];
/** Cells of the reading of the link in the row at the bottom. */
const LINK_CELLS = 5;
const LINK_LABEL = '接続';

interface Playing {
  card: SignalCard;
  title: string;
  values: ParamValues;
  instance: SceneInstance;
  contact: number;
  /** It comes before a session and asks for nothing, instead of answering one. */
  glimpse: boolean;
  /** Where the window stands in the room the screen leaves it. */
  place: WindowPlace;
  durationMs: number;
  /** The frame it began at; null until the first one. */
  start: number | null;
  /** How long it has been on screen, as of the last frame. */
  elapsed: number;
  /** What it is drawn with is ready. Until then the window stays shut, and its time has not begun. */
  ready: boolean;
  /** Kept when it is. */
  warmed: Promise<unknown>;
  onDone: () => void;
}

/** What a transmission does that can be heard: its window opens, and closes. */
export type SignalSound =
  | { kind: 'open'; figure: number; contact: number; seconds: number; glimpse: boolean }
  | { kind: 'close' };

/**
 * Shows a transmission over the game: the program opens what it has received as a file in a
 * window of its own. The picture is a layer of the display; the window around it is drawn
 * with the means of the program's interface, in its pixels, colours and font.
 *
 * During a session what comes through stays behind the board and stays quiet; that is `SignalLeak`.
 *
 * For now what is shown is picked by chance. Whoever owns the frame calls `frame()` before
 * the display presents.
 */
export class SignalPlayer {
  /** In development `?signal=off` in the address keeps the transmissions out of the game. */
  enabled = !import.meta.env.DEV || new URLSearchParams(window.location.search).get('signal') !== 'off';
  /** Hears the window open and close. */
  onSound: ((event: SignalSound) => void) | null = null;
  /** In development `?signal=always` shows one before every session, to look at them without waiting. */
  private readonly always = import.meta.env.DEV && new URLSearchParams(window.location.search).get('signal') === 'always';
  private readonly picture: Layer;
  /** The words of the other side, written over the picture. */
  private readonly words: CanvasLayer;
  private readonly chrome: CanvasLayer;
  private readonly kit: Kit;
  private readonly leak: SignalLeak | null;
  private playing: Playing | null = null;
  /** What the window was last drawn as; it is drawn anew only when this changes. */
  private drawn = '';
  private written = '';
  /** Sessions still to start before the next glimpse. */
  private untilGlimpse = 0;
  /** An answer has just been shown: the session that starts right after it gets no glimpse. */
  private answered = false;

  constructor(
    private readonly display: Display,
    /** The look of the program's interface: the window is a part of it. */
    private readonly shell: ParamValues,
    /** The layer of the board. With it, things leak through under the board during a session. */
    board?: Layer,
    private readonly random: () => number = Math.random,
  ) {
    this.leak = board && quality().leak ? new SignalLeak(display, shell, board, random) : null;
    this.picture = display.addLayer({ name: 'signal', lines: 240, look: { opacity: 0 } });
    this.words = display.addCanvasLayer({ name: 'signal-caption', lines: 240, look: { opacity: 0 } });
    this.words.onResize = () => (this.written = '');
    this.chrome = display.addCanvasLayer({ name: 'signal-window', lines: 240, look: { opacity: 0 } });
    this.chrome.onResize = () => (this.drawn = '');
    this.untilGlimpse = this.glimpseGap();
    void loadCaptionFont('VI').then(() => (this.written = ''));
    this.kit = new Kit(this.chrome, display, shell, paletteAt(shell, clockHour()));
    void loadShellFonts().then(() => {
      this.kit.forgetText();
      this.drawn = '';
    });
    window.addEventListener('pointerdown', () => this.skip());
    window.addEventListener('keydown', () => this.skip());
  }

  /** A transmission is on screen: the game waits for it. */
  get busy(): boolean {
    return this.playing !== null;
  }

  /** The answer to a session; `contact` is how strong the link got, 0..1. `onDone` comes when it is over. */
  answer(contact: number, onDone: () => void): void {
    if (!this.enabled) {
      onDone();
      return;
    }
    this.play(randomCard(this.random, contact), contact, () => {
      this.answered = true;
      onDone();
    });
  }

  /** Before a session, once in a few: a transmission for some seconds, with nothing to answer. */
  glimpse(): void {
    const answered = this.answered;
    this.answered = false;
    this.leak?.reset();
    if (!this.enabled) return;
    this.untilGlimpse = Math.max(0, this.untilGlimpse - 1);
    // Right after an answer the session starts at once; the glimpse waits for the next one.
    if (answered || (this.untilGlimpse > 0 && !this.always)) return;
    this.untilGlimpse = this.glimpseGap();
    this.play(randomCard(this.random, 0, GLIMPSE_SECONDS), 0, () => undefined, true);
  }

  /** Closes the window that is open, if it has been open long enough to have been seen. */
  skip(): void {
    const { playing } = this;
    if (playing && playing.elapsed >= SKIP_AFTER_MS) this.finish();
  }

  /** A chain has reached `length` groups. */
  chain(length: number): void {
    if (this.enabled && !this.playing) this.leak?.chain(length);
  }

  /** Makes something come through behind the board at once: for looking at it. */
  show(kind: LeakKind): void {
    this.leak?.show(kind);
  }

  /** `session` is the session as it stands while it is being played; null otherwise. */
  frame(timeMs: number, session: SessionReading | null = null): void {
    const { playing, display } = this;
    this.leak?.frame(timeMs, this.enabled && !playing ? session : null);
    if (!playing || !playing.ready) return;
    if (playing.start === null) {
      this.onSound?.({ kind: 'open', figure: playing.card.figure, contact: playing.contact, seconds: playing.card.seconds, glimpse: playing.glimpse });
    }
    playing.start ??= timeMs;
    const elapsed = timeMs - playing.start;
    playing.elapsed = elapsed;
    if (elapsed >= playing.durationMs) {
      this.finish();
      return;
    }

    // The window is a part of the interface: the same few pixels and the same tube.
    display.sync();
    const canvas = { width: display.width * display.pixelRatio, height: display.height * display.pixelRatio };
    const size = pictureSize(canvas, Number(this.shell.pixelsTall), Number(this.shell.pixelsWide));
    this.chrome.setLines(size.height);
    Object.assign(this.chrome.look, signalLook(this.shell), { opacity: 1, depth: 8, dither: 0 });
    this.kit.palette = paletteAt(this.shell, clockHour());
    const layout = windowLayout({ width: this.chrome.width, height: this.chrome.height }, playing.contact, playing.place);

    // The picture keeps the lines of its scene inside the window, however small the window is.
    const rect = this.kit.toWindow(layout.content);
    const { values } = playing;
    this.picture.setLines(Math.round((Number(values.lines) * display.height) / Math.max(1, rect.height)));
    Object.assign(this.picture.look, signalLook(values), { opacity: 1 });
    playing.instance.update(timeMs, rect.width / Math.max(1, rect.height));
    this.picture.render(playing.instance.scene, playing.instance.camera, { rect });

    const opened = Math.min(1, elapsed / OPEN_MS);
    this.writeCaption(playing, rect, opened >= 1);
    this.drawWindow(layout, playing, opened, elapsed / playing.durationMs);
  }

  private glimpseGap(): number {
    const [from, to] = GLIMPSE_EVERY;
    return from + Math.floor(this.random() * (to - from + 1));
  }

  private play(card: SignalCard, contact: number, onDone: () => void, glimpse = false): void {
    this.finish();
    const { def, values } = cardScene(card);
    const playing: Playing = {
      card,
      title: cardTitle(card),
      values,
      instance: def.build(values, card.seed),
      contact,
      glimpse,
      place: { x: this.random(), y: this.random() },
      durationMs: card.seconds * 1000,
      start: null,
      elapsed: 0,
      ready: false,
      warmed: Promise.resolve(),
      onDone,
    };
    this.playing = playing;
    // The programs of the scene are built before the window opens, not on its first frame.
    playing.warmed = this.picture.warm(playing.instance.scene, playing.instance.camera).then(() => (playing.ready = true));
    this.drawn = '';
    this.written = '';
  }

  private finish(): void {
    const { playing } = this;
    if (!playing) return;
    this.playing = null;
    // A scene whose programs are still being built is let go once they are there: the building looks for them.
    void playing.warmed.then(() => playing.instance.dispose());
    this.picture.look.opacity = 0;
    this.words.look.opacity = 0;
    this.chrome.look.opacity = 0;
    if (playing.start !== null) this.onSound?.({ kind: 'close' });
    playing.onDone();
  }

  /**
   * The caption, low in the picture, once the file has opened. It has the pixels of the
   * picture, or more where the window is too narrow to write in.
   */
  private writeCaption(playing: Playing, rect: { x: number; y: number; width: number; height: number }, shown: boolean): void {
    const { words, display } = this;
    const text = shown ? (playing.card.caption ?? '') : '';
    if (!text) {
      words.look.opacity = 0;
      return;
    }
    const lines = captionLines(Number(playing.values.lines), rect.width / Math.max(1, rect.height));
    words.setLines(Math.round((lines * display.height) / Math.max(1, rect.height)));
    Object.assign(words.look, captionLook(signalLook(playing.values)), { opacity: 1 });
    const scale = words.height / Math.max(1, display.height);
    const state = [text, rect.x, rect.y, rect.width, rect.height, words.width, words.height].join();
    if (state === this.written) return;
    this.written = state;
    words.ctx.clearRect(0, 0, words.width, words.height);
    drawCaption(words.ctx, text, rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
    words.markDirty();
  }

  /**
   * The window of an old office program: an outline with a shadow, a filled bar with the name
   * of the file and a box to close it by, a row of readings at the bottom. Each part says
   * something: the name is the file, the cells are the strength of the link, the bar is how
   * much of the file is left, and the size of the window follows the link too.
   */
  private drawWindow(layout: WindowLayout, playing: Playing, opened: number, played: number): void {
    const { kit } = this;
    const { frame, title, content, status } = layout;
    const { bg, ink, dim, faint } = kit.palette;

    const track = Math.max(CELL_W * 4, Math.min(CELL_W * 12, Math.floor(status.w / 3)));
    const filled = Math.round((track - 2) * Math.min(1, Math.max(0, played)));
    const veil = Math.round(content.h * (1 - opened));
    const state = [frame.x, frame.y, frame.w, frame.h, playing.title, filled, veil, bg, ink].join();
    if (state === this.drawn) return;
    this.drawn = state;

    kit.begin();
    // The shadow the window throws on what lies under it.
    kit.dither(frame.x + 3, frame.y + frame.h, frame.w, 3, faint);
    kit.dither(frame.x + frame.w, frame.y + 3, 3, frame.h - 3, faint);

    // Title bar: the box that closes the window, then the name of the file.
    kit.box(title, ink);
    const box = BAR - 6;
    kit.rect(title.x + 3, title.y + 3, box, box, bg);
    kit.rect(title.x + 6, title.y + 3 + Math.floor(box / 2) - 1, box - 6, 2, ink);
    const room = title.w - (box + 10) - 4;
    let name = playing.title;
    while (name.length > 0 && kit.measure(name) > room) name = name.slice(0, -1);
    kit.text(name, title.x + box + 10, title.y + 1, bg);

    // The file opens from the top down: what has not arrived yet is the dark of the tube.
    if (veil > 0) {
      kit.rect(content.x, content.y + content.h - veil, content.w, veil, bg);
      kit.dither(content.x, content.y + content.h - veil, content.w, Math.min(veil, 2), dim);
    }

    // Row of readings: the link on the left, how much of the file has played on the right.
    kit.box(status, bg);
    kit.rect(status.x, status.y, status.w, 1, ink);
    let at = kit.text(LINK_LABEL, status.x + 4, status.y + 1, dim) + 4;
    const lit = Math.round(playing.contact * LINK_CELLS);
    for (let i = 0; i < LINK_CELLS; i++) {
      if (at + 6 > status.x + status.w - track - 8) break;
      if (i < lit) kit.rect(at, status.y + 5, 5, 9, ink);
      else kit.frame({ x: at, y: status.y + 5, w: 5, h: 9 }, faint);
      at += 7;
    }
    const bar = { x: status.x + status.w - track - 4, y: status.y + 5, w: track, h: 9 };
    kit.frame(bar, dim);
    kit.rect(bar.x + 1, bar.y + 1, filled, bar.h - 2, ink);

    kit.frame(frame, ink);
    kit.end();
  }
}
