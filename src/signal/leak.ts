import type { Display } from '../display/display';
import type { CanvasLayer, Layer } from '../display/layer';
import type { Rect, Size } from '../display/sizing';
import { loadShellFonts } from '../shell/fonts';
import { Kit } from '../shell/kit';
import { CELL_H, CELL_W, pictureSize } from '../shell/layout';
import { clockHour, paletteAt } from '../shell/theme';
import { captionLook, drawCaption, loadCaptionFont } from './caption';
import { cardScene, randomCard } from './card';
import { frameDef } from './compose';
import { LinePool } from './lines';
import { PLACES } from './places';
import { LOOK_MOODS, MOODS, LOOK_PARAMS, captionLines, contactValues, signalLook, thingValues, type ParamValues, type SceneInstance } from './scene';
import { THINGS } from './things';
import { terminalLines, type SessionReading } from './terminal';

/** The four things that come through during a session. Each keeps its own time; no two are there at once. */
export type LeakKind = 'words' | 'terminal' | 'thing' | 'flash';

interface Pace {
  /** Seconds of play before the first of a session, and between one and the next: by chance between the ends. */
  first: readonly [number, number];
  gap: readonly [number, number];
}

/**
 * How often each comes. All of it is quiet and none of it is frequent: the player looks at the
 * board, and this is what is felt at the edge of the eye.
 */
const PACE: Record<LeakKind, Pace> = {
  terminal: { first: [14, 26], gap: [32, 56] },
  words: { first: [24, 40], gap: [40, 70] },
  thing: { first: [35, 60], gap: [55, 95] },
  // A flash is the rarest: a session may pass without one.
  flash: { first: [80, 140], gap: [100, 190] },
};
/** After one has gone, nothing else comes for this long. */
const REST_MS = 5000;

/** A line of the other side: slow to come and to go, and never bright. */
const WORDS = { inMs: 2200, holdMs: 4200, outMs: 2600, strength: 0.42, size: 0.36 };
/** A thing of a transmission: far away behind the board, barely there. */
const THING = { inMs: 4000, holdMs: 7000, outMs: 4000, strength: 0.16, size: 0.3 };
/** The program's log runs past: a line every so often, then all of it is gone. */
const TERMINAL = { lineMs: 110, holdMs: 1100, strength: 0.28 };
/**
 * For a few seconds the dark behind the board is one of the scenes: long enough to be read,
 * and still dim. It comes like interference on the line — on, off, and on to stay — holds
 * for a time picked by chance between the two ends, and is cut off.
 */
const FLASH = { stutter: [70, 50] as const, holdMs: [2000, 3000] as const, outMs: 160, strength: 0.32 };
/** A chain of at least this many groups may make the program log a pattern, this often. */
const PATTERN_CHAIN = 3;
const PATTERN_CHANCE = 0.4;
/** The tone a thing takes when it comes from here and not through a channel. */
const HERE = 0;

const between = (range: readonly [number, number], random: () => number): number => range[0] + random() * (range[1] - range[0]);

/** The look of a transmission at a contact of 0..1, for words that come with no picture. */
function wordsLook(contact: number): ParamValues {
  const values: ParamValues = {};
  for (const [name, spec] of Object.entries(LOOK_PARAMS)) values[name] = spec.value;
  const mood = MOODS[Math.min(MOODS.length - 1, Math.round(Math.min(1, Math.max(0, contact)) * (MOODS.length - 1)))];
  return { ...values, ...LOOK_MOODS[mood] } as ParamValues;
}

/**
 * A frame for something that comes through, four wide to three high and `size` of the shorter
 * side of the window tall. With `edge`, it keeps to the ends of the longer side, where the
 * board leaves room; without, it may stand anywhere, the board in front of it. `along` and
 * `across` are chances, 0..1.
 */
export function leakRect(window: Size, size: number, along: number, across: number, edge = true): Rect {
  const height = Math.min(window.width, window.height) * size;
  const width = Math.min(window.width, (height * 4) / 3);
  // The middle of the longer side is the board's: the first and the last third are left.
  const place = !edge ? along : along < 0.5 ? along * 0.6 : 0.4 + along * 0.6;
  const wide = window.width >= window.height;
  const x = (window.width - width) * (wide ? place : across);
  const y = (window.height - height) * (wide ? across : place);
  return { x, y, width, height };
}

interface Coming {
  kind: LeakKind;
  /** Milliseconds of play it has been there, and how long it is there in all. */
  age: number;
  lifeMs: number;
  along: number;
  across: number;
  values: ParamValues | null;
  instance: SceneInstance | null;
  /** A line of the other side, or the lines of the program's log. */
  text: string[];
  /** What it is drawn with is ready. Until then it waits unseen, and its time has not begun. */
  ready: boolean;
  /** Kept when it is. */
  warmed: Promise<unknown>;
}

/**
 * What comes through during a session, in the dark behind the board: a line of the other
 * side, a burst of the program's log, a thing of a transmission far away, and very rarely a
 * flash of a whole scene. They are apart from each other, each in its own time, and all of
 * them quiet: the board is drawn over them, and nothing here asks to be looked at.
 */
export class SignalLeak {
  private readonly picture: Layer;
  private readonly words: CanvasLayer;
  private readonly terminal: CanvasLayer;
  private readonly kit: Kit;
  private readonly pool: LinePool;
  private readonly calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private coming: Coming | null = null;
  /** Milliseconds of play, and when each kind is next due on that clock. */
  private clock = 0;
  private due: Record<LeakKind, number> = { words: 0, terminal: 0, thing: 0, flash: 0 };
  /** Nothing starts before this, whatever is due. */
  private restUntil = 0;
  private last: number | null = null;
  private reading: SessionReading = { contact: 0, noise: 0, channel: 0 };
  private written = '';

  constructor(
    private readonly display: Display,
    /** The look of the program's interface: the colours of the channels and of the dark are its. */
    private readonly shell: ParamValues,
    /** The layer of the board: all of this lies right under it. */
    under: Layer,
    private readonly random: () => number,
  ) {
    this.picture = display.addLayer({ name: 'leak', lines: 240, look: { opacity: 0 } }, under);
    this.words = display.addCanvasLayer({ name: 'leak-caption', lines: 240, look: { opacity: 0 } }, under);
    this.terminal = display.addCanvasLayer({ name: 'leak-terminal', lines: 240, look: { opacity: 0 } }, under);
    this.words.onResize = () => (this.written = '');
    this.terminal.onResize = () => (this.written = '');
    this.kit = new Kit(this.terminal, display, shell, paletteAt(shell, clockHour()));
    this.pool = new LinePool(random);
    this.schedule(true);
    void loadCaptionFont('VI').then(() => (this.written = ''));
    void loadShellFonts().then(() => {
      this.kit.forgetText();
      this.written = '';
    });
  }

  /** What is coming through at this moment, if anything. */
  get kind(): LeakKind | null {
    return this.coming?.kind ?? null;
  }

  /** A session begins: what was there is gone, every line can be said again, the first ones are some way off. */
  reset(): void {
    this.end();
    this.pool.reset();
    this.restUntil = 0;
    this.schedule(true);
  }

  /** A chain has reached `length` groups: the program may log a pattern. */
  chain(length: number): void {
    if (length < PATTERN_CHAIN || this.coming || this.clock < this.restUntil) return;
    if (this.random() < PATTERN_CHANCE) this.start('terminal', true);
  }

  /** `reading` is the session as it stands while it is being played; null while it is not. */
  frame(timeMs: number, reading: SessionReading | null): void {
    const dt = this.last === null ? 0 : Math.min(250, Math.max(0, timeMs - this.last));
    this.last = timeMs;
    if (reading === null) {
      // Paused, over or under a menu: nothing comes through, and what was there waits unseen.
      this.hide();
      return;
    }
    this.reading = reading;
    this.clock += dt;
    if (!this.coming && this.clock >= this.restUntil) {
      const next = (Object.keys(this.due) as LeakKind[]).find((kind) => this.clock >= this.due[kind]);
      if (next) this.start(next, false);
    }
    const { coming } = this;
    if (!coming || !coming.ready) return;
    coming.age += dt;
    if (coming.age >= coming.lifeMs) {
      this.end();
      return;
    }
    this.draw(coming, timeMs);
  }

  /** Makes one come at once, whatever the clock says: for looking at them. */
  show(kind: LeakKind): void {
    this.end();
    this.start(kind, false);
  }

  private schedule(first: boolean, only?: LeakKind): void {
    for (const kind of Object.keys(PACE) as LeakKind[]) {
      if (only && kind !== only) continue;
      this.due[kind] = this.clock + between(first ? PACE[kind].first : PACE[kind].gap, this.random) * 1000;
    }
  }

  private start(kind: LeakKind, pattern: boolean): void {
    const { random } = this;
    this.schedule(false, kind);
    const coming: Coming = { kind, age: 0, lifeMs: 0, along: random(), across: random(), values: null, instance: null, text: [], ready: true, warmed: Promise.resolve() };

    if (kind === 'words') {
      const line = this.pool.next();
      // Everything has been said in this session.
      if (line === null) return;
      coming.text = [line];
      coming.lifeMs = WORDS.inMs + WORDS.holdMs + WORDS.outMs;
    } else if (kind === 'terminal') {
      const now = new Date();
      coming.text = terminalLines(random, this.reading, { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() }, pattern);
      coming.lifeMs = coming.text.length * TERMINAL.lineMs + TERMINAL.holdMs;
    } else {
      const seed = 1 + Math.floor(random() * 9999);
      if (kind === 'flash') {
        // A whole frame, as heavy and as mixed as the contact has made things.
        const { def, values } = cardScene(randomCard(random, this.reading.contact));
        coming.values = values;
        coming.instance = def.build(values, seed);
        coming.lifeMs = FLASH.stutter[0] + FLASH.stutter[1] + between(FLASH.holdMs, random) + FLASH.outMs;
      } else {
        // One thing, without a place: it stands in the light of the place it belongs to.
        const thing = THINGS[Math.min(THINGS.length - 1, Math.floor(random() * THINGS.length))];
        const home = PLACES.find((place) => place.native === thing.id)?.id ?? 'sea';
        const def = frameDef({ id: `${home}:${thing.id}`, place: home, things: [thing.id] });
        const palette = paletteAt(this.shell, clockHour());
        // It carries the colour of its channel; one that is from here has the tone of the program.
        const tint = thing.channel === HERE ? palette.ink : palette.channels[thing.channel - 1];
        coming.values = thingValues(def, contactValues(def, 'a', this.reading.contact), tint, palette.bg);
        coming.instance = def.build(coming.values, seed, true);
        coming.lifeMs = THING.inMs + THING.holdMs + THING.outMs;
      }
      // The programs of a scene are built before it is first drawn: built at the drawing, in
      // the middle of a session, they would hold the board up.
      const { instance } = coming;
      coming.ready = false;
      coming.warmed = this.picture.warm(instance.scene, instance.camera).then(() => (coming.ready = true));
    }
    this.coming = coming;
    this.written = '';
  }

  private end(): void {
    const { coming } = this;
    if (!coming) return;
    // A scene whose programs are still being built is let go once they are there: the building looks for them.
    const { instance } = coming;
    if (instance) void coming.warmed.then(() => instance.dispose());
    this.coming = null;
    this.restUntil = this.clock + REST_MS;
    this.hide();
  }

  private hide(): void {
    this.picture.look.opacity = 0;
    this.words.look.opacity = 0;
    this.terminal.look.opacity = 0;
  }

  private draw(coming: Coming, timeMs: number): void {
    this.display.sync();
    this.hide();
    if (coming.kind === 'words') this.drawWords(coming);
    else if (coming.kind === 'terminal') this.drawTerminal(coming);
    else if (coming.kind === 'thing') this.drawThing(coming, timeMs);
    else this.drawFlash(coming, timeMs);
  }

  private drawWords(coming: Coming): void {
    const { display, words } = this;
    const fade = Math.min(1, coming.age / WORDS.inMs, (coming.lifeMs - coming.age) / WORDS.outMs);
    const rect = leakRect(display, WORDS.size, coming.along, coming.across);
    // The letters have the pixels of a transmission of that size, softened like one.
    const look = signalLook(wordsLook(this.reading.contact));
    const lines = captionLines(240, rect.width / Math.max(1, rect.height));
    words.setLines(Math.round((lines * display.height) / Math.max(1, rect.height)));
    Object.assign(words.look, captionLook({ ...look, vignette: 0 }), { opacity: Math.max(0, fade) * WORDS.strength });
    const scale = words.height / Math.max(1, display.height);
    const state = ['words', coming.text[0], rect.x, rect.y, words.width, words.height].join();
    if (state === this.written) return;
    this.written = state;
    words.ctx.clearRect(0, 0, words.width, words.height);
    drawCaption(words.ctx, coming.text[0], rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
    words.markDirty();
  }

  private drawTerminal(coming: Coming): void {
    const { display, terminal, kit, shell } = this;
    // The log is the program's: its pixels, its font and its tube.
    const canvas = { width: display.width * display.pixelRatio, height: display.height * display.pixelRatio };
    terminal.setLines(pictureSize(canvas, Number(shell.pixelsTall), Number(shell.pixelsWide)).height);
    Object.assign(terminal.look, signalLook(shell), { opacity: TERMINAL.strength, depth: 8, dither: 0, vignette: 0 });
    kit.palette = paletteAt(shell, clockHour());

    // With motion kept low the lines are there at once instead of running in.
    const shown = this.calm ? coming.text.length : Math.min(coming.text.length, 1 + Math.floor(coming.age / TERMINAL.lineMs));
    const state = ['terminal', shown, terminal.width, terminal.height, coming.along, coming.across].join();
    if (state === this.written) return;
    this.written = state;
    const widest = Math.max(...coming.text.map((line) => kit.measure(line)));
    const block = { width: widest + CELL_W * 2, height: (coming.text.length + 1) * CELL_H };
    const picture = { width: terminal.width, height: terminal.height };
    // The same places as the other leaks: by an end of the longer side.
    const edge = coming.along < 0.5 ? coming.along * 0.6 : 0.4 + coming.along * 0.6;
    const wide = picture.width >= picture.height;
    const x = Math.round(Math.max(0, picture.width - block.width) * (wide ? edge : coming.across));
    const y = Math.round(Math.max(0, picture.height - block.height) * (wide ? coming.across : edge));
    kit.begin();
    for (let i = 0; i < shown; i++) kit.text(coming.text[i], x + CELL_W, y + i * CELL_H, kit.palette.dim);
    // The place where the next line will be written.
    if (shown < coming.text.length) kit.rect(x + CELL_W, y + shown * CELL_H + 3, CELL_W - 2, CELL_H - 6, kit.palette.dim);
    kit.end();
  }

  private drawThing(coming: Coming, timeMs: number): void {
    const { display, picture } = this;
    if (!coming.instance || !coming.values) return;
    const fade = Math.min(1, coming.age / THING.inMs, (coming.lifeMs - coming.age) / THING.outMs);
    // Anywhere, the middle too: it is far behind the board, and the board stands in front of it.
    const rect = leakRect(display, THING.size, coming.along, coming.across, false);
    picture.setLines(Math.round((Number(coming.values.lines) * display.height) / Math.max(1, rect.height)));
    Object.assign(picture.look, signalLook(coming.values), { opacity: Math.max(0, fade) * THING.strength, vignette: 0 });
    coming.instance.update(timeMs, rect.width / Math.max(1, rect.height));
    picture.render(coming.instance.scene, coming.instance.camera, { rect });
  }

  private drawFlash(coming: Coming, timeMs: number): void {
    const { display, picture } = this;
    if (!coming.instance || !coming.values) return;
    // On, off, and on to stay: the gap is the dark of the board again. With motion kept low it
    // comes without the stutter.
    const [first, gap] = FLASH.stutter;
    if (!this.calm && coming.age >= first && coming.age < first + gap) return;
    // It does not fade out so much as get cut off.
    const left = Math.min(1, Math.max(0, (coming.lifeMs - coming.age) / FLASH.outMs));
    picture.setLines(Number(coming.values.lines));
    Object.assign(picture.look, signalLook(coming.values), { opacity: FLASH.strength * left });
    coming.instance.update(timeMs, display.width / Math.max(1, display.height));
    picture.render(coming.instance.scene, coming.instance.camera);
  }
}
