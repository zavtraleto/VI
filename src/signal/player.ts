import type { Display } from '../display/display';
import type { CanvasLayer, Layer } from '../display/layer';
import { quality } from '../display/quality';
import { loadShellFonts } from '../shell/fonts';
import { Kit } from '../shell/kit';
import { pictureSize } from '../shell/layout';
import { clockHour, paletteAt, sayColors } from '../shell/theme';
import { PLATE_WIDTH, captionLook, drawCaption, plainCaption, wordsShown, type CaptionBox } from './caption';
import { GLIMPSE_SECONDS, cardScene, cardTitle, stepCard, type SignalCard } from './card';
import { stepLook } from './director';
import { lineText, pickLine } from './sceneLines';
import { language, t } from '../ui/i18n';
import { RecordBands } from './bands';
import { VoiceFigure } from './figure';
import { hintCard } from './hintFrame';
import { SignalLeak, type LeakKind } from './leak';
import { NOVEL_LOOK, faceAt, novelCard, novelScene } from './record';
import { signalLook, type ParamValues, type SceneInstance } from './scene';
import type { SessionReading } from './terminal';
import { BAR, windowLayout, type WindowLayout, type WindowPlace } from './window';

/** A file opens from the top down, like a picture coming over a slow line. */
const OPEN_MS = 450;
/** A press closes the window only after this long, so the last press of the session does not. */
const SKIP_AFTER_MS = 600;
/** A glimpse comes before one session in this many: counted anew by chance each time, both ends included. */
const GLIMPSE_EVERY: readonly [number, number] = [4, 7];
/** A window that is told something, or answers a session, stands in the middle of the screen and fills it. */
const TOLD_PLACE: WindowPlace = { x: 0.5, y: 0.5 };
/** The picture of the voice of the other side is not waited for longer than this: the record opens without it, and it comes when it comes. */
const FIGURE_PATIENCE_MS = 3000;

/** Words the game has to tell the player before a board, in a window of their own. */
export interface Telling {
  /** The words; those in braces are a link. */
  text: string;
  /** The window has been closed. */
  onDone: () => void;
  /** The link has been pressed: called instead of `onDone`. */
  onLink?: () => void;
  /** Enter follows the link, as a press on it does; false: Enter closes the window as any other key. True when left out. */
  linkByKey?: boolean;
  /** Milliseconds a word; 0 puts the words there at once. */
  wordMs: number;
  /** Motion kept low: the words stand whole at once, and make no sound. */
  reduced: boolean;
}

/**
 * A record of the link (docs/superpowers/specs/2026-11-04-vi-star-novel-design.md): the lines of
 * two voices, one after another, over a place of the other side with the voice standing in it.
 */
export interface Recording {
  /** The code of the record: which place it is shown in. */
  code: string;
  /** The name of the file, in the bar of the window. */
  title: string;
  /** The word in the bar the record is closed by before its end. */
  skip: string;
  /** Who says each line, by name, and what they say. */
  lines: readonly { who: 'operator' | 'voice'; name: string; text: string }[];
  /** Milliseconds a word; 0 puts the words of a line there at once. */
  wordMs: number;
  /** Motion kept low: the words stand whole at once, and the figure stands still. */
  reduced: boolean;
  /** The record has been closed: by its end, its word in the bar, or Esc. */
  onDone: () => void;
}

/** How far a record has come. */
interface Recorded {
  recording: Recording;
  /** The line that is being said. */
  line: number;
  /** Where the band of the words is, in CSS pixels; null until it has been drawn. */
  band: CaptionBox | null;
  /** Where a press closes the record, in CSS pixels: the box at the left of the bar and its word at the right. */
  skips: CaptionBox[];
  /** The frame her face began to come through a silhouette on; null before it has. */
  revealFrom: number | null;
}

/** How far the words of a telling have come. */
interface Told {
  telling: Telling;
  /** The words as they are read, without the braces of the link. */
  plain: string;
  total: number;
  /** How many words are there. */
  words: number;
  /** All of them are: the window can be closed. */
  full: boolean;
  /** The frame the first word came at; null until the window has opened. */
  since: number | null;
  /** Where the words of the link are, in CSS pixels. */
  links: CaptionBox[];
}

interface Playing {
  card: SignalCard;
  title: string;
  values: ParamValues;
  instance: SceneInstance;
  contact: number;
  /** How much of the screen the window takes, 0..1: as strong as the contact, or the whole of it for a telling. */
  size: number;
  /** Words the game tells, or null for a transmission that says what it says. For a record, its line now. */
  told: Told | null;
  /** A record of the link, line by line; null for anything else. */
  record: Recorded | null;
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
  | { kind: 'open'; figure: number; contact: number; seconds: number; glimpse: boolean; told: boolean }
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
  /** Hears each word of a telling as it comes: its first sign. */
  onWord: ((sign: string) => void) | null = null;
  /** The lines of the other side the player has heard, by their ids: kept by whoever owns the save, changed here. */
  heard: string[] = [];
  /** A line has been said: `heard` has changed and is to be kept. */
  onHeard: (() => void) | null = null;
  /** In development `?signal=always` shows one before every session, to look at them without waiting. */
  private readonly always = import.meta.env.DEV && new URLSearchParams(window.location.search).get('signal') === 'always';
  /** In development `?scene=3` makes every transmission one of that step, and a glimpse before every session says its line too: to look at the steps. */
  private readonly sceneProbe = import.meta.env.DEV ? Number(new URLSearchParams(window.location.search).get('scene') ?? NaN) : NaN;
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
  /** The voice of the other side, once its picture has come; asked for with the first record. */
  private figure: VoiceFigure | null = null;
  private figureLoading: Promise<VoiceFigure | null> | null = null;
  /** The bands of interference of a record, made with the first one. */
  private bands: RecordBands | null = null;
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
    this.kit = new Kit(this.chrome, display, shell, paletteAt(shell, clockHour()));
    void loadShellFonts().then(() => {
      this.kit.forgetText();
      this.drawn = '';
    });
    window.addEventListener('pointerdown', () => this.skip());
    window.addEventListener('keydown', () => this.skip());
    // A telling takes every press before the game hears it: the press that closes it moves nothing on the board.
    window.addEventListener('pointerdown', (e) => this.press(e, { x: e.clientX, y: e.clientY }), true);
    window.addEventListener('keydown', (e) => this.press(e, null, e.code), true);
  }

  /** A transmission is on screen: the game waits for it. */
  get busy(): boolean {
    return this.playing !== null;
  }

  /**
   * The answer to a session: a scene of the step the player has come to (`SCENE_STEPS`), and a
   * line of the other side under it, one not heard yet. `onDone` comes when it is over.
   */
  answer(step: number, onDone: () => void): void {
    if (!this.enabled) {
      onDone();
      return;
    }
    if (this.sceneProbe > 0) step = this.sceneProbe;
    const line = pickLine(stepLook(step).tier, this.heard, this.random);
    this.onHeard?.();
    const card = stepCard(this.random, step, lineText(line, language()));
    this.play(
      card,
      card.contact,
      () => {
        this.answered = true;
        onDone();
      },
      false,
      1,
      TOLD_PLACE,
    );
  }

  /** Before a session, once in a few: a transmission of the step the player has come to, for some seconds, with nothing to say. */
  glimpse(step: number): void {
    const answered = this.answered;
    this.answered = false;
    this.leak?.reset();
    if (!this.enabled) return;
    this.untilGlimpse = Math.max(0, this.untilGlimpse - 1);
    // Right after an answer the session starts at once; the glimpse waits for the next one.
    const probe = this.sceneProbe > 0;
    if (answered || (this.untilGlimpse > 0 && !this.always && !probe)) return;
    this.untilGlimpse = this.glimpseGap();
    if (probe) {
      const line = pickLine(stepLook(this.sceneProbe).tier, this.heard, this.random);
      const card = stepCard(this.random, this.sceneProbe, lineText(line, language()));
      this.play(card, card.contact, () => undefined, false, 1, TOLD_PLACE);
      return;
    }
    const card = stepCard(this.random, step, null, GLIMPSE_SECONDS);
    this.play(card, card.contact, () => undefined, true);
  }

  /**
   * Tells the player something before a board: the light sea with the pole fills the
   * screen, and the words come one at a time on a dark band. A press puts all of them there, the
   * next one closes the window; a press on the link follows it.
   */
  tell(telling: Telling): void {
    if (!this.enabled) {
      telling.onDone();
      return;
    }
    // In development `?scene=` shows the answer of that step in place of the words, to look at it.
    if (this.sceneProbe > 0) {
      this.answer(this.sceneProbe, telling.onDone);
      return;
    }
    const layout = windowLayout(this.pictureNow(), 1, TOLD_PLACE);
    const plain = plainCaption(telling.text);
    const card = hintCard(this.random, layout.content.w / Math.max(1, layout.content.h), telling.text);
    const total = plain.split(' ').length;
    const full = telling.reduced || !(telling.wordMs > 0);
    const told: Told = { telling, plain, total, words: full ? total : 0, full, since: null, links: [] };
    this.play(card, card.contact, telling.onDone, false, 1, TOLD_PLACE, told);
  }

  /**
   * A record of the link: its place fills the screen in the cold of night, the voice of the other
   * side stands in it, and its lines come one at a time on a dark band, the name of who says each
   * over it. A press puts all the words of a line there, the next goes to the next line, and after
   * the last the record closes. Its word in the bar of the window, and Esc, close it at once.
   */
  record(recording: Recording): void {
    if (!this.enabled || recording.lines.length === 0) {
      recording.onDone();
      return;
    }
    const layout = windowLayout(this.pictureNow(), 1, TOLD_PLACE);
    const card = novelCard(recording.code, this.random, layout.content.w / Math.max(1, layout.content.h));
    const record: Recorded = { recording, line: 0, band: null, skips: [], revealFrom: null };
    this.play(card, card.contact, recording.onDone, false, 1, TOLD_PLACE, this.lineTold(recording, 0), record);
  }

  /** A line of a record as words to be told. */
  private lineTold(recording: Recording, line: number): Told {
    const text = recording.lines[line]?.text ?? '';
    const plain = plainCaption(text);
    const total = plain.split(' ').length;
    const full = recording.reduced || !(recording.wordMs > 0);
    const telling: Telling = { text, onDone: recording.onDone, wordMs: recording.wordMs, reduced: recording.reduced, linkByKey: false };
    return { telling, plain, total, words: full ? total : 0, full, since: null, links: [] };
  }

  /** The figure of the voice, asked for once; it is there for every record after the first. */
  private voiceFigure(): Promise<VoiceFigure | null> {
    this.figureLoading ??= VoiceFigure.load().then((figure) => {
      this.figure = figure;
      // A picture that could not be fetched is asked for again by the next record.
      if (!figure) this.figureLoading = null;
      return figure;
    });
    return this.figureLoading;
  }

  /** Closes the window that is open, if it has been open long enough to have been seen. A telling is closed by `press`. */
  skip(): void {
    const { playing } = this;
    if (playing && !playing.told && playing.elapsed >= SKIP_AFTER_MS) this.finish();
  }

  /** A press while a telling is on screen: it is the telling's, and nobody else hears it. */
  private press(event: Event, at: { x: number; y: number } | null, code: string | null = null): void {
    const { playing } = this;
    const told = playing?.told;
    // Until the window is on screen the game waits all the same (`busy`): a press passes, so a scene that never comes holds no key.
    if (!playing || !told || playing.start === null) return;
    event.stopImmediatePropagation();
    if (code !== null && (event as KeyboardEvent).repeat) return;
    const { record } = playing;
    const within = (box: CaptionBox): boolean => at !== null && at.x >= box.x && at.x <= box.x + box.w && at.y >= box.y && at.y <= box.y + box.h;
    if (record && (code === 'Escape' || record.skips.some(within))) {
      this.finish();
      return;
    }
    if (!told.full) {
      told.full = true;
      told.words = told.total;
      return;
    }
    if (playing.elapsed < SKIP_AFTER_MS) return;
    if (record) {
      if (record.line + 1 >= record.recording.lines.length) {
        this.finish();
        return;
      }
      record.line++;
      playing.told = this.lineTold(record.recording, record.line);
      this.written = '';
      this.drawn = '';
      return;
    }
    const onLink = told.links.some(within);
    const byKey = code === 'Enter' && told.telling.linkByKey !== false;
    this.finish(told.links.length > 0 && (onLink || byKey));
  }

  /** The size of the interface's picture on the screen as it is now. */
  private pictureNow(): { width: number; height: number } {
    const { display } = this;
    display.sync();
    const canvas = { width: display.width * display.pixelRatio, height: display.height * display.pixelRatio };
    return pictureSize(canvas, Number(this.shell.pixelsTall), Number(this.shell.pixelsWide));
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
      this.onSound?.({ kind: 'open', figure: playing.card.figure, contact: playing.contact, seconds: playing.card.seconds, glimpse: playing.glimpse, told: playing.told !== null });
    }
    playing.start ??= timeMs;
    const elapsed = timeMs - playing.start;
    playing.elapsed = elapsed;
    if (elapsed >= playing.durationMs) {
      this.finish();
      return;
    }

    // The window is a part of the interface: the same few pixels and the same tube.
    const size = this.pictureNow();
    this.chrome.setLines(size.height);
    Object.assign(this.chrome.look, signalLook(this.shell), { opacity: 1, depth: 8, dither: 0 });
    this.kit.palette = paletteAt(this.shell, clockHour());
    const layout = windowLayout({ width: this.chrome.width, height: this.chrome.height }, playing.size, playing.place);

    // The picture keeps the lines of its scene inside the window, however small the window is.
    const rect = this.kit.toWindow(layout.content);
    const { values } = playing;
    this.picture.setLines(Math.round((Number(values.lines) * display.height) / Math.max(1, rect.height)));
    Object.assign(this.picture.look, signalLook(values), { opacity: 1 });
    playing.instance.update(timeMs, rect.width / Math.max(1, rect.height));
    this.picture.render(playing.instance.scene, playing.instance.camera, { rect });
    const { record, told } = playing;
    if (record) {
      const { reduced } = record.recording;
      // A silhouette's face comes through on its line of the record, through the bands of interference.
      const scene = novelScene(record.recording.code);
      if (scene.revealAt !== null && record.line >= scene.revealAt) record.revealFrom ??= timeMs;
      const since = record.revealFrom === null ? null : timeMs - record.revealFrom;
      const face = faceAt(scene, record.line, since, reduced);
      const revealing = scene.figure === 'silhouette' && since !== null && !reduced && since < NOVEL_LOOK.figure.reveal.ms;
      const boost = revealing ? Math.sin((since / NOVEL_LOOK.figure.reveal.ms) * Math.PI) : 0;
      const bands = (this.bands ??= new RecordBands());
      const banded = bands.update(timeMs, reduced, boost);
      if (this.figure) {
        const speaking = record.recording.lines[record.line]?.who === 'voice';
        this.figure.update(timeMs, rect.width / Math.max(1, rect.height), speaking, scene.fill, reduced, bands.now, face);
        this.picture.renderOver(this.figure.scene, this.figure.camera, { rect });
      }
      if (banded) this.picture.renderOver(bands.scene, bands.camera, { rect });
    }

    const opened = Math.min(1, elapsed / OPEN_MS);
    if (told && opened >= 1) this.say(told, timeMs);
    this.writeCaption(playing, rect, opened >= 1);
    const lines = record?.recording.lines.length ?? 1;
    const played = told ? ((record?.line ?? 0) + told.words / told.total) / lines : elapsed / playing.durationMs;
    this.drawWindow(layout, playing, opened, played);
  }

  /** The words of a telling that have come by now, each heard as it comes. */
  private say(told: Told, timeMs: number): void {
    told.since ??= timeMs;
    if (told.full) return;
    const words = wordsShown(told.plain, timeMs - told.since, told.telling.wordMs).split(' ').length;
    const all = told.plain.split(' ');
    for (let i = told.words; i < words; i++) this.onWord?.(all[i]?.[0] ?? '');
    told.words = words;
    told.full = words >= told.total;
  }

  private glimpseGap(): number {
    const [from, to] = GLIMPSE_EVERY;
    return from + Math.floor(this.random() * (to - from + 1));
  }

  private play(
    card: SignalCard,
    contact: number,
    onDone: () => void,
    glimpse = false,
    size = contact,
    place: WindowPlace = { x: this.random(), y: this.random() },
    told: Told | null = null,
    record: Recorded | null = null,
  ): void {
    this.finish();
    const { def, values } = cardScene(card);
    const playing: Playing = {
      card,
      title: record ? record.recording.title : cardTitle(card, t('signalTitle')),
      values,
      instance: def.build(values, card.seed),
      contact,
      size,
      told,
      record,
      glimpse,
      place,
      durationMs: card.seconds * 1000,
      start: null,
      elapsed: 0,
      ready: false,
      warmed: Promise.resolve(),
      onDone,
    };
    this.playing = playing;
    // The programs of the scene are built before the window opens, not on its first frame.
    // A record waits for the voice of the other side as well, for a while: its picture is fetched with the first record.
    const figure = record
      ? Promise.race([
          this.voiceFigure().then((one) => one && this.picture.warm(one.scene, one.camera)),
          new Promise((resolve) => window.setTimeout(resolve, FIGURE_PATIENCE_MS)),
        ])
      : null;
    const bands = record ? (this.bands ??= new RecordBands()) : null;
    const banded = bands ? this.picture.warm(bands.scene, bands.camera) : null;
    playing.warmed = Promise.all([this.picture.warm(playing.instance.scene, playing.instance.camera), figure, banded]).then(() => (playing.ready = true));
    this.drawn = '';
    this.written = '';
  }

  /** The window goes. `link`: it was closed by its link, which is followed instead of `onDone`. */
  private finish(link = false): void {
    const { playing } = this;
    if (!playing) return;
    this.playing = null;
    // A scene whose programs are still being built is let go once they are there: the building looks for them.
    void playing.warmed.then(() => playing.instance.dispose());
    this.picture.look.opacity = 0;
    this.words.look.opacity = 0;
    this.chrome.look.opacity = 0;
    if (playing.record) {
      this.figure?.reset();
      this.bands?.reset();
    }
    if (playing.start !== null) this.onSound?.({ kind: 'close' });
    const onLink = link ? playing.told?.telling.onLink : undefined;
    if (onLink) onLink();
    else playing.onDone();
  }

  /**
   * The caption, low in the picture, once the file has opened. It has the pixels of the
   * picture, or more where the window is too narrow to write in.
   */
  private writeCaption(playing: Playing, rect: { x: number; y: number; width: number; height: number }, shown: boolean): void {
    const { words, display } = this;
    const { told, record } = playing;
    // A line of a record that the voice of the other side says comes through with the picture;
    // the operator's is the program's own, and is written with its window.
    const said = record?.recording.lines[record.line];
    const caption = record ? (said?.who === 'voice' ? said.text : '') : playing.card.caption;
    const text = shown ? (caption ?? '') : '';
    if (!text) {
      words.look.opacity = 0;
      return;
    }
    // The words are the program's letters at their own size: the layer has the pixels of the
    // program's picture, and a dot of the letters is one of them.
    words.setLines(this.pictureNow().height);
    Object.assign(words.look, captionLook(signalLook(playing.values)), { opacity: 1 });
    const scale = words.height / Math.max(1, display.height);
    const state = [text, told?.words, rect.x, rect.y, rect.width, rect.height, words.width, words.height].join();
    if (state === this.written) return;
    this.written = state;
    words.ctx.clearRect(0, 0, words.width, words.height);
    const colors = sayColors(this.shell);
    const options = told ? { plate: true, words: told.words, dot: 1, colors } : { dot: 1, colors };
    const drawn = drawCaption(words.ctx, text, rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale, options);
    const back = (box: CaptionBox): CaptionBox => ({ x: box.x / scale, y: box.y / scale, w: box.w / scale, h: box.h / scale });
    if (told) told.links = drawn.link.map(back);
    if (record && drawn.plate) record.band = back(drawn.plate);
    words.markDirty();
  }

  /**
   * The window of an old office program, kept light: an outline with a shadow, a filled bar
   * with the name of the file and a box to close it by, and at the bottom a thin line that
   * fills as the file plays.
   */
  private drawWindow(layout: WindowLayout, playing: Playing, opened: number, played: number): void {
    const { kit } = this;
    const { frame, title, content, status } = layout;
    const { bg, ink, dim, faint } = kit.palette;

    const filled = Math.round(status.w * Math.min(1, Math.max(0, played)));
    const veil = Math.round(content.h * (1 - opened));
    const { record, told } = playing;
    const band = record?.band;
    const said = record ? [record.line, told?.words, band?.x, band?.y, band?.w, band?.h].join(':') : '';
    const state = [frame.x, frame.y, frame.w, frame.h, playing.title, filled, veil, bg, ink, said].join();
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
    let room = title.w - (box + 10) - 4;
    if (record) {
      // A record is closed before its end by the word at the right of the bar, or by the box at its left.
      // Either is pressed anywhere from the top of the screen to a bar below the bar.
      const skip = record.recording.skip;
      const skipX = title.x + title.w - 4 - kit.measure(skip);
      kit.text(skip, skipX, title.y + 1, bg);
      room = skipX - 8 - (title.x + box + 10);
      const reach = title.y + title.h + BAR;
      const css = (part: { x: number; y: number; w: number; h: number }): CaptionBox => {
        const rect = kit.toWindow(part);
        return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
      };
      record.skips = [css({ x: 0, y: 0, w: title.x + box + 6, h: reach }), css({ x: skipX - 6, y: 0, w: this.chrome.width - skipX + 6, h: reach })];
    }
    let name = playing.title;
    while (name.length > 0 && kit.measure(name) > room) name = name.slice(0, -1);
    kit.text(name, title.x + box + 10, title.y + 1, bg);

    // The file opens from the top down: what has not arrived yet is the dark of the tube.
    if (veil > 0) {
      kit.rect(content.x, content.y + content.h - veil, content.w, veil, bg);
      kit.dither(content.x, content.y + content.h - veil, content.w, Math.min(veil, 2), dim);
    } else if (record && told) {
      this.drawLine(record, told, content);
    }

    // How much of the file has played: a line under the picture.
    kit.box(status, bg);
    kit.rect(status.x, status.y, filled, status.h, dim);

    kit.frame(frame, ink);
    kit.end();
  }

  /**
   * What of a line of a record is the program's own, drawn with its window: the operator's words
   * on the dark band, as the voice's come on it through the picture, and over the band, at the
   * left of its words, a filled plate with the name of who speaks.
   */
  private drawLine(record: Recorded, told: Told, content: { x: number; y: number; w: number; h: number }): void {
    const { kit } = this;
    const { bg, ink } = kit.palette;
    const said = record.recording.lines[record.line];
    if (!said) return;
    const scale = this.chrome.height / Math.max(1, this.display.height);
    if (said.who === 'operator') {
      const options = { plate: true, words: told.words, dot: 1, colors: sayColors(this.shell) };
      const drawn = drawCaption(this.chrome.ctx, said.text, content.x, content.y, content.w, content.h, options);
      if (drawn.plate) record.band = { x: drawn.plate.x / scale, y: drawn.plate.y / scale, w: drawn.plate.w / scale, h: drawn.plate.h / scale };
    }
    const band = record.band;
    if (!band) return;
    const x = Math.round((band.x + (band.w * (1 - PLATE_WIDTH)) / 2) * scale);
    const y = Math.round(band.y * scale) - BAR;
    kit.box({ x, y, w: kit.measure(said.name) + 8, h: BAR }, ink);
    kit.text(said.name, x + 4, y + 1, bg);
  }
}
