import type { ParamValues } from '../signal/scene';
import { soundNumber } from './params';
import type { Note } from './score';
import { cents, type Rand } from './variation';

/**
 * The voices: how a note becomes sound. Synthesis in the manner of the FM synthesizers of the
 * late nineties: the sound of that time and of that program.
 *
 * Every note gets nodes of its own, which are let go when it ends. Nothing is looped and no
 * oscillator runs on: a note begins smoothly, dies away and stops. The only noise there is is
 * the click in the attack of a knock, a few thousandths of a second long.
 */

/** What a voice is made with, and where it sends its sound. */
export interface VoicePort {
  ctx: BaseAudioContext;
  /** The way out with no echo, and the way into the echo. */
  dry: AudioNode;
  wet: AudioNode;
  /** A short piece of noise, for the click of a knock. Played once, a few milliseconds of it. */
  noise: AudioBuffer;
  values: ParamValues;
  rand: Rand;
}

/** A note that is sounding, or is about to. */
export interface Voice {
  /** What it is within its sound: a note that is held is taken off by this. */
  readonly part: string;
  /** When it starts and when its last node stops, in the time of the context. */
  readonly start: number;
  end: number;
  /** Nodes it holds. */
  readonly nodes: number;
  /** It is being taken off before its time. */
  leaving: boolean;
  /** Takes it off quietly, from `at` on, over `fade` seconds: the shortest there is when left out. */
  release(at: number, fade?: number): void;
  /** Lets its nodes go. */
  dispose(): void;
}

/** How long a voice that is taken off takes to fall silent, in seconds. */
export const FADE = 0.03;
/** No note comes in or goes out faster than this. */
const EDGE = 0.002;

/**
 * The attacks of a knock. The device was a table with dice on it, and this is wood: a tone
 * that falls onto its note, an upper tone over it that is gone at once, and a click. Each has
 * the wave of its tone, how far above its note it starts and for how long, the upper tone
 * against the note and how long it lasts, and its click.
 */
const KNOCKS = [
  { wave: 'sine', bend: 1.3, bendMs: 10, over: 4, overMs: 34, clickHz: 2600, clickMs: 4, q: 1.2 },
  { wave: 'triangle', bend: 1.15, bendMs: 16, over: 3, overMs: 42, clickHz: 3600, clickMs: 3, q: 2 },
  { wave: 'sine', bend: 1.5, bendMs: 7, over: 5.4, overMs: 24, clickHz: 1900, clickMs: 5, q: 0.9 },
  { wave: 'triangle', bend: 1.08, bendMs: 22, over: 2.76, overMs: 50, clickHz: 3100, clickMs: 2.5, q: 3 },
] as const;

/** The nodes of one note as they are made. */
class Build {
  readonly nodes: AudioNode[] = [];
  readonly sources: AudioScheduledSourceNode[] = [];
  /** The way out that the echo never hears: for the noise of a click, which the echo would draw out into a hiss. */
  readonly direct: GainNode;

  constructor(readonly port: VoicePort) {
    this.direct = this.gain(1);
  }

  num(name: string): number {
    return soundNumber(this.port.values, name);
  }

  osc(type: OscillatorType, hz: number, at: number, end: number): OscillatorNode {
    const node = this.port.ctx.createOscillator();
    node.type = type;
    node.frequency.setValueAtTime(hz, at);
    node.start(at);
    node.stop(end);
    this.nodes.push(node);
    this.sources.push(node);
    return node;
  }

  gain(value: number): GainNode {
    const node = this.port.ctx.createGain();
    node.gain.value = value;
    this.nodes.push(node);
    return node;
  }

  pan(value: number): StereoPannerNode {
    const node = this.port.ctx.createStereoPanner();
    node.pan.value = Math.min(1, Math.max(-1, value));
    this.nodes.push(node);
    return node;
  }

  filter(type: BiquadFilterType, hz: number, q: number): BiquadFilterNode {
    const node = this.port.ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = hz;
    node.Q.value = q;
    this.nodes.push(node);
    return node;
  }

  /** A few milliseconds of the noise, from a place in it that is never the same. Played once. */
  click(at: number, seconds: number): AudioBufferSourceNode {
    const { ctx, noise, rand } = this.port;
    const node = ctx.createBufferSource();
    node.buffer = noise;
    node.start(at, rand() * Math.max(0, noise.duration - seconds - 0.01), seconds);
    this.nodes.push(node);
    this.sources.push(node);
    return node;
  }
}

/**
 * The loudness of a note over its life: up to its loudest in `attack`, down to a thousandth of
 * it over `decay`, and from there to nothing. Returns the moment it is silent.
 */
function envelope(param: AudioParam, at: number, attack: number, peak: number, decay: number): number {
  const top = Math.max(peak, 0.0001);
  const rise = Math.max(EDGE, attack);
  param.setValueAtTime(0, at);
  param.linearRampToValueAtTime(top, at + rise);
  param.exponentialRampToValueAtTime(top * 0.001, at + rise + decay);
  param.linearRampToValueAtTime(0, at + rise + decay + 0.015);
  return at + rise + decay + 0.02;
}

/**
 * A bell: a carrier and a modulator in a ratio that is not whole. The strike is bright, the
 * tail is clean and long. It has two carriers a few cents apart, so the tone beats slowly; a
 * wide bell has one of them on each side. Under them, quietly, is the octave below: its body.
 */
function bellVoice(b: Build, note: Note, at: number, out: GainNode): number {
  const amp = b.gain(0);
  // A low bell rings longer than a high one, as a large one does.
  const decay = note.decay * Math.min(1.3, Math.max(0.7, (600 / note.hz) ** 0.25));
  const end = envelope(amp.gain, at, note.attack, note.gain / 1.6, decay);
  const ratio = b.num('bellRatio');
  const carrier = b.osc('sine', note.hz, at, end);
  const twin = b.osc('sine', note.hz * cents(b.num('bellDetune')), at, end);
  const twinLevel = b.gain(0.5);
  // The higher the note, the less it is modulated: a high bell would be harsh otherwise.
  const deep = b.num('bellBright') * note.bright * Math.min(1, Math.sqrt(520 / note.hz)) * note.hz * ratio;
  if (deep > 1) {
    const mod = b.osc('sine', note.hz * ratio, at, end);
    const depth = b.gain(0);
    depth.gain.setValueAtTime(deep, at);
    depth.gain.exponentialRampToValueAtTime(deep * 0.03, at + Math.min(0.6, decay * 0.4));
    mod.connect(depth);
    depth.connect(carrier.frequency);
    depth.connect(twin.frequency);
  }
  const apart = Math.min(1, Math.max(0, note.wide));
  if (apart > 0.02 && typeof b.port.ctx.createStereoPanner === 'function') {
    const left = b.pan(-apart);
    const right = b.pan(apart);
    carrier.connect(left);
    left.connect(amp);
    twin.connect(twinLevel);
    twinLevel.connect(right);
    right.connect(amp);
  } else {
    carrier.connect(amp);
    twin.connect(twinLevel);
    twinLevel.connect(amp);
  }
  const body = b.num('bellBody');
  if (body > 0.005 && note.hz > 180) {
    // The body is gone sooner than the note: what is left ringing is the clean tone.
    const under = b.osc('sine', note.hz / 2, at, end);
    const level = b.gain(0);
    level.gain.setValueAtTime(body, at);
    level.gain.exponentialRampToValueAtTime(body * 0.02, at + Math.max(0.05, decay * 0.45));
    under.connect(level);
    level.connect(amp);
  }
  amp.connect(out);
  return end;
}

/** A knock: a short tone that falls onto its note, with the wood of an upper tone and a click in its attack. */
function knockVoice(b: Build, note: Note, at: number, out: GainNode): number {
  const kind = KNOCKS[Math.abs(Math.round(note.variant)) % KNOCKS.length];
  const share = Math.min(1, Math.max(0, note.bright));
  const amp = b.gain(0);
  const end = envelope(amp.gain, at, note.attack, note.gain * (1 - 0.5 * share), note.decay);
  const tone = b.osc(kind.wave, note.hz * kind.bend, at, end);
  tone.frequency.exponentialRampToValueAtTime(note.hz, at + kind.bendMs / 1000);
  if (note.dull) {
    const cut = b.filter('lowpass', 520, 0.7);
    tone.connect(cut);
    cut.connect(amp);
  } else {
    tone.connect(amp);
    const wood = b.num('knockWood') * Math.min(1, Math.sqrt(700 / note.hz));
    if (wood > 0.005) {
      const upper = b.osc('sine', Math.min(9000, note.hz * kind.over), at, end);
      const level = b.gain(0);
      level.gain.setValueAtTime(wood, at);
      level.gain.exponentialRampToValueAtTime(wood * 0.001, at + kind.overMs / 1000);
      upper.connect(level);
      level.connect(amp);
    }
  }
  amp.connect(out);
  if (share > 0.01) {
    const seconds = (kind.clickMs / 1000) * (note.dull ? 2 : 1);
    const loud = Math.max(0.0001, note.gain * share * 1.6);
    const noise = b.click(at, seconds + 0.006);
    const band = b.filter('bandpass', note.dull ? kind.clickHz * 0.3 : kind.clickHz, kind.q);
    const level = b.gain(0);
    level.gain.setValueAtTime(0, at);
    level.gain.linearRampToValueAtTime(loud, at + 0.001);
    level.gain.exponentialRampToValueAtTime(loud * 0.001, at + 0.001 + seconds);
    level.gain.linearRampToValueAtTime(0, at + 0.003 + seconds);
    noise.connect(band);
    band.connect(level);
    level.connect(b.direct);
  }
  return end;
}

/** The click of the program: short and dry, with a hard edge. Muffled, it is a dull low tone. */
function clickVoice(b: Build, note: Note, at: number, out: GainNode): number {
  const amp = b.gain(0);
  const end = envelope(amp.gain, at, note.attack, note.gain, note.decay);
  if (note.dull) {
    const tone = b.osc('triangle', note.hz, at, end);
    const cut = b.filter('lowpass', Math.max(300, note.hz * 3), 0.7);
    tone.connect(cut);
    cut.connect(amp);
  } else {
    const tone = b.osc('sine', note.hz, at, end);
    const deep = 0.9 * note.bright * Math.min(1, Math.sqrt(900 / note.hz)) * note.hz * 2;
    if (deep > 1) {
      const mod = b.osc('sine', note.hz * 2, at, end);
      const depth = b.gain(0);
      depth.gain.setValueAtTime(deep, at);
      depth.gain.exponentialRampToValueAtTime(deep * 0.02, at + Math.min(0.02, note.decay));
      mod.connect(depth);
      depth.connect(tone.frequency);
    }
    tone.connect(amp);
  }
  amp.connect(out);
  return end;
}

/** A low: a sine that starts above its note and falls to it. */
function lowVoice(b: Build, note: Note, at: number, out: GainNode): number {
  const amp = b.gain(0);
  const end = envelope(amp.gain, at, note.attack, note.gain, note.decay);
  const falls = note.drop > 1.001 && note.fall > 0;
  const tone = b.osc('sine', falls ? note.hz * note.drop : note.hz, at, end);
  if (falls) tone.frequency.exponentialRampToValueAtTime(note.hz, at + note.fall);
  tone.connect(amp);
  amp.connect(out);
  return end;
}

/**
 * The voice of the other side: soft, slow to come, long to go. Two sines a few cents apart,
 * and a little of the octave over them, so that a small speaker carries a low note too.
 */
function otherVoice(b: Build, note: Note, at: number, out: GainNode): number {
  const amp = b.gain(0);
  const end = envelope(amp.gain, at, note.attack, note.gain / 1.7, note.decay);
  const one = b.osc('sine', note.hz, at, end);
  const two = b.osc('sine', note.hz * cents(b.num('otherDetune')), at, end);
  const twoLevel = b.gain(0.6);
  one.connect(amp);
  two.connect(twoLevel);
  twoLevel.connect(amp);
  const over = 0.12 * Math.min(2, Math.max(0, note.bright));
  if (over > 0.005) {
    const upper = b.osc('sine', note.hz * 2, at, end);
    const level = b.gain(over);
    upper.connect(level);
    level.connect(amp);
  }
  amp.connect(out);
  return end;
}

/** The share of the echo a voice takes. The program has none: it is dry. */
function echoShare(b: Build, note: Note): number {
  const own = note.voice === 'bell' ? b.num('bellVerb') : note.voice === 'knock' ? b.num('knockVerb') : note.voice === 'other' ? b.num('otherVerb') : note.voice === 'low' ? 0.05 : 0;
  return Math.min(1, Math.max(0, own * note.echo));
}

/**
 * Starts a note at `at`, in the time of the context. `ended` is told when its nodes have been
 * let go: at its end, or after it has been taken off.
 */
export function startVoice(port: VoicePort, note: Note, at: number, ended: (voice: Voice) => void): Voice {
  const b = new Build(port);
  const out = b.gain(1);
  const end =
    note.voice === 'bell'
      ? bellVoice(b, note, at, out)
      : note.voice === 'knock'
        ? knockVoice(b, note, at, out)
        : note.voice === 'click'
          ? clickVoice(b, note, at, out)
          : note.voice === 'low'
            ? lowVoice(b, note, at, out)
            : otherVoice(b, note, at, out);

  if (Math.abs(note.pan) > 0.001 && typeof port.ctx.createStereoPanner === 'function') {
    const pan = port.ctx.createStereoPanner();
    pan.pan.value = Math.min(1, Math.max(-1, note.pan));
    b.nodes.push(pan);
    out.connect(pan);
    b.direct.connect(pan);
    pan.connect(port.dry);
  } else {
    out.connect(port.dry);
    b.direct.connect(port.dry);
  }
  const share = echoShare(b, note);
  if (share > 0.001) {
    const send = b.gain(share);
    out.connect(send);
    send.connect(port.wet);
  }

  let gone = false;
  const voice: Voice = {
    part: note.part,
    start: at,
    end,
    nodes: b.nodes.length,
    leaving: false,
    release(from: number, fade = FADE): void {
      if (voice.leaving || gone) return;
      voice.leaving = true;
      // One that has not begun yet begins silent and stops at once.
      const stop = Math.max(from + fade, voice.start) + 0.005;
      if (stop >= voice.end) return;
      out.gain.setValueAtTime(1, from);
      out.gain.linearRampToValueAtTime(0, from + fade);
      for (const source of b.sources) {
        try {
          source.stop(stop);
        } catch {
          // It has already stopped by itself.
        }
      }
      voice.end = stop;
    },
    dispose(): void {
      if (gone) return;
      gone = true;
      for (const source of b.sources) source.onended = null;
      for (const node of b.nodes) node.disconnect();
      ended(voice);
    },
  };
  // The first oscillator runs to the end of the note: when it stops, the note is over.
  const last = b.sources.find((source) => source instanceof OscillatorNode) ?? b.sources[0];
  if (last) last.onended = () => voice.dispose();
  return voice;
}

/**
 * One note of every make there is: each voice, a knock on each of its waves, the muffled ones,
 * off to a side and with a share of the echo. Played once into nothing when the sound opens, they
 * have the browser build what a note is made of - the tables of its waves, its filters, its
 * noise - before the first note of a move asks for it.
 */
export function warmNotes(): Note[] {
  const base: Note = { voice: 'knock', part: 'warm', hz: 440, at: 0, gain: 0.2, pan: 0.3, attack: 0.002, decay: 0.03, bright: 0.6, variant: 0, dull: false, drop: 1.5, fall: 0.02, echo: 1, wide: 0.5 };
  return [
    ...KNOCKS.map((_, variant) => ({ ...base, variant })),
    { ...base, dull: true },
    { ...base, voice: 'bell' },
    { ...base, voice: 'click' },
    { ...base, voice: 'click', dull: true },
    { ...base, voice: 'low' },
    { ...base, voice: 'other' },
  ];
}
