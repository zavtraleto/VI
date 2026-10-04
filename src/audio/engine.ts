import type { Beat } from '../app/juice';
import type { GameEvent, RunState } from '../rules';
import type { ShellSound } from '../shell/screen';
import type { SignalSound } from '../signal/player';
import type { ParamValues } from '../signal/scene';
import { soundDefaults, soundNumber } from './params';
import { CUTS, HELD, INTERFACE, REPLY_MOST, SPACING, ScoreMemory, cueOfBeat, cuesOfEvent, leadNote, notesFor, replyCount, silentSign, type Cue, type Note } from './score';
import { Variety, soundRandom, type Rand } from './variation';
import { FADE, startVoice, type Voice, type VoicePort } from './voices';

/**
 * The sound of the game, made entirely in code with WebAudio: no files. Between two sounds
 * there is silence: nothing here hums, loops or runs on. What lasts is the tail of a note.
 */

/** A note is asked for this far ahead of the clock of the context, so it never falls into its past. */
const LEAD = 0.004;
/** The noise the clicks of the knocks are cut from, in seconds. */
const NOISE_SECONDS = 0.5;
/** How long a context may take to start after it has been opened, in milliseconds. */
const OPENING_MS = 1000;
/** An echo that is replaced while notes still go into it is kept this long past its own tail, in seconds: the longest note there is. */
const RING_OUT = 12;

interface Echo {
  wet: GainNode;
  node: ConvolverNode;
  out: GainNode;
  seconds: number;
}

/**
 * The echo: a burst of noise that dies away and grows darker as it does, different on each
 * side. It has no walls in it, no first returns: the board hangs in a void, and this is the
 * void. Its low part is taken out, so that it does not rumble, and its high part is soft from
 * the start, so that it never hisses. Made once, from the sound's own numbers.
 */
function impulse(ctx: BaseAudioContext, seconds: number, rand: Rand): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(2, Math.floor(rate * seconds));
  const before = Math.min(length - 1, Math.floor(rate * 0.012));
  const buffer = ctx.createBuffer(2, length, rate);
  // How fast a one-pole filter follows what it is given, for a corner in hertz, at any rate of the context.
  const follow = (hz: number): number => 1 - Math.exp((-2 * Math.PI * hz) / rate);
  const under = follow(160);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let smooth = 0;
    let slow = 0;
    for (let i = before; i < length; i++) {
      const t = (i - before) / (length - before);
      // From about five thousand hertz down to a few hundred: the tail grows dark.
      smooth += (rand() * 2 - 1 - smooth) * follow(5200 * (1 - t) ** 2 + 500);
      slow += (smooth - slow) * under;
      // Sixty decibels down by its end, and to nothing exactly at it.
      data[i] = (smooth - slow) * Math.exp(-6.9 * t) * (1 - t);
    }
  }
  return buffer;
}

function noiseBuffer(ctx: BaseAudioContext, rand: Rand): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;
  return buffer;
}

/**
 * What every note goes through on its way out: the volume, the one echo all voices share, and
 * a limiter at the end so that peaks do not crackle. It also keeps count of the voices: there
 * are never more than the most allowed, and the oldest are taken off quietly.
 */
export class SoundChain {
  private readonly dry: GainNode;
  private readonly master: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly noise: AudioBuffer;
  /** The echo: the way into it, the echo itself, the way out of it, and how long it rings. */
  private echo: Echo;
  /** What has been taken out of the chain and is let go once it is silent. */
  private retired: { nodes: AudioNode[]; at: number }[] = [];
  private readonly voices = new Set<Voice>();
  private held = 0;
  private muted = false;

  constructor(
    readonly ctx: BaseAudioContext,
    private readonly values: ParamValues,
    private readonly rand: Rand,
  ) {
    this.dry = ctx.createGain();
    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    // A safeguard, not a way of mixing: it only works when notes pile up.
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.15;
    this.master.gain.value = soundNumber(values, 'volMaster');
    this.dry.connect(this.master);
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);
    this.noise = noiseBuffer(ctx, rand);
    this.echo = this.makeEcho();
    this.refresh();
  }

  private makeEcho(): Echo {
    const seconds = soundNumber(this.values, 'verbTail');
    const wet = this.ctx.createGain();
    const node = this.ctx.createConvolver();
    node.buffer = impulse(this.ctx, seconds, this.rand);
    const out = this.ctx.createGain();
    out.gain.value = soundNumber(this.values, 'verbLevel');
    wet.connect(node);
    node.connect(out);
    out.connect(this.master);
    return { wet, node, out, seconds };
  }

  /**
   * Takes the echo out of the chain, with everything that still goes into it: at once, or
   * leaving what rings in it to die away. The notes that come after get an echo of their own.
   */
  private retireEcho(now: number, ringOut: boolean): void {
    const { wet, node, out, seconds } = this.echo;
    if (!ringOut) {
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + FADE);
    }
    this.retired.push({ nodes: [wet, node, out], at: now + (ringOut ? seconds + RING_OUT : FADE + 0.05) });
    this.echo = this.makeEcho();
  }

  /** The values of the panel have changed: the volume, the echo. */
  refresh(): void {
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : soundNumber(this.values, 'volMaster'), now, 0.02);
    if (soundNumber(this.values, 'verbTail') !== this.echo.seconds) this.retireEcho(now, true);
    this.echo.out.gain.setTargetAtTime(soundNumber(this.values, 'verbLevel'), now, 0.02);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.refresh();
  }

  /** Lets go of what has ended. A note lets itself go when it stops; this is for what could not. */
  tidy(): void {
    const now = this.ctx.currentTime;
    for (const voice of [...this.voices]) if (now > voice.end + 0.25) voice.dispose();
    this.retired = this.retired.filter((old) => {
      if (now < old.at) return true;
      for (const node of old.nodes) node.disconnect();
      return false;
    });
  }

  /** Plays notes: `at` is the moment their times are counted from, in the time of the context. */
  play(notes: readonly Note[], at = this.ctx.currentTime + LEAD): void {
    this.tidy();
    const most = Math.max(1, Math.round(soundNumber(this.values, 'maxVoices')));
    const port: VoicePort = { ctx: this.ctx, dry: this.dry, wet: this.echo.wet, noise: this.noise, values: this.values, rand: this.rand };
    for (const note of notes) {
      // No more voices than the most there may be: the oldest gives way, quietly.
      let staying = [...this.voices].filter((voice) => !voice.leaving);
      while (staying.length >= most) {
        const oldest = staying.reduce((a, b) => (b.start < a.start ? b : a));
        oldest.release(at);
        staying = staying.filter((voice) => voice !== oldest);
      }
      const voice = startVoice(port, note, at + note.at, (ended) => {
        this.voices.delete(ended);
        this.held -= ended.nodes;
      });
      this.voices.add(voice);
      this.held += voice.nodes;
    }
  }

  /** Takes off the notes of one part of a sound, over `fade` seconds: a note that was being held is let go. */
  release(part: string, fade: number, at = this.ctx.currentTime + LEAD): void {
    for (const voice of this.voices) if (voice.part === part) voice.release(at, fade);
  }

  /** Cuts every tail off: the voices fall silent at once, and what rings in the echo goes with them. */
  cut(at = this.ctx.currentTime + LEAD): void {
    for (const voice of this.voices) voice.release(at);
    this.retireEcho(at, false);
  }

  /** Voices that sound or are about to, those of them that are being taken off, and the nodes they hold. */
  get count(): { voices: number; leaving: number; nodes: number } {
    let leaving = 0;
    for (const voice of this.voices) if (voice.leaving) leaving++;
    return { voices: this.voices.size - leaving, leaving, nodes: this.held };
  }

  /** A tap on what goes out, after the limiter, for a meter. It makes no sound. */
  tap(): AnalyserNode {
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 2048;
    this.limiter.connect(analyser);
    return analyser;
  }
}

/**
 * The sound as the game uses it: it is told what happens and plays it. The context is opened
 * by the first press, as browsers ask; a pause holds everything, and the platform or the
 * player can turn the sound off.
 */
export class AudioEngine {
  /** The values the sound is made from. The lab's panel changes them in place. */
  readonly values: ParamValues = soundDefaults();
  private ctx: AudioContext | null = null;
  private chain: SoundChain | null = null;
  private muted = false;
  /** The page is hidden, or the platform has asked for quiet: the context stands still. */
  private suspended = false;
  /** The session waits: only the interface is heard. */
  private waiting = false;
  /**
   * The program started before the sound could be opened, and its name was not heard. It is
   * said as soon as there is a voice to say it with: at the first press.
   */
  private owed: Cue | null = null;
  /** The notes the player has last played, as their frequencies: what the other side may give back. */
  private heard: number[] = [];
  /** When the context was opened, by the clock of the page. */
  private openedAt = 0;
  /** How far the contact has gone, 0 to 1. */
  private contact = 0;
  private lastWarnSecond = -1;
  /** The sound's own chance: it has nothing to do with the rules and never reaches the state of a run. */
  private readonly rand: Rand = soundRandom(Math.floor(Math.random() * 0x7fffffff));
  private readonly variety = new Variety();
  private readonly memory = new ScoreMemory();
  /** When a sound of a kind was last played, for those that may not come too often. */
  private readonly last = new Map<Cue['kind'], number>();

  /** Must be called from a user gesture; browsers keep audio locked until then. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state !== 'running' && !this.suspended) void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.openedAt = performance.now();
    this.chain = new SoundChain(ctx, this.values, this.rand);
    this.chain.setMuted(this.muted);
    // A phone holds the sound until something has been started inside a touch: one empty sample is enough.
    const blank = ctx.createBufferSource();
    blank.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    blank.connect(ctx.destination);
    blank.onended = () => blank.disconnect();
    blank.start();
    if (ctx.state !== 'running' && !this.suspended) void ctx.resume();
    const { owed } = this;
    this.owed = null;
    if (owed) this.play(owed);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.chain?.setMuted(muted);
  }

  /**
   * The session waits: it is paused, or the player is in the menu. Nothing of the session is
   * played until it goes on; what was ringing dies away by itself, and the interface goes on
   * being heard.
   */
  setPaused(paused: boolean): void {
    this.waiting = paused;
  }

  /** The page is hidden, or the platform asks for quiet: everything is held, and nothing new is played. */
  setAway(away: boolean): void {
    this.suspended = away;
    if (!this.ctx) return;
    if (away) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  /** How far the contact has gone, 0 to 1. */
  setContact(level: number): void {
    this.contact = Math.min(1, Math.max(0, level));
  }

  /** A new run: the contact is back at nothing, and what the sound kept of the last run is dropped. */
  reset(): void {
    this.contact = 0;
    this.lastWarnSecond = -1;
    this.memory.reset();
    this.last.clear();
    this.heard = [];
  }

  /** The values of the panel have changed. */
  refresh(): void {
    this.chain?.refresh();
  }

  /** Cuts off everything that is sounding. */
  silence(): void {
    this.chain?.cut();
  }

  /** Plays a sound. Nothing is played while the sound is off, held, or not yet opened. */
  play(cue: Cue): void {
    const { ctx, chain } = this;
    if (!ctx || !chain) {
      if (cue.kind === 'logo') this.owed = cue;
      return;
    }
    if (this.muted || this.suspended) return;
    if (this.waiting && !INTERFACE.includes(cue.kind)) return;
    // A context that has just been opened takes a moment to start: what is asked of it then is
    // played when it does. One that stands still for any other reason is not given sounds to
    // pile up and let out all at once.
    if (ctx.state !== 'running' && performance.now() - this.openedAt > OPENING_MS) return;
    const now = ctx.currentTime;
    const gap = SPACING[cue.kind];
    if (gap !== undefined) {
      const last = this.last.get(cue.kind);
      if (last !== undefined && now >= last && now - last < gap) return;
      this.last.set(cue.kind, now);
    }
    if (CUTS.includes(cue.kind)) chain.cut();
    const notes = notesFor(cue, { values: this.values, contact: this.contact, rand: this.rand, variety: this.variety });
    chain.play(notes);
    this.answer(cue, notes);
  }

  /**
   * The other side answers what the player has just played: not at low contact, and the more
   * often the further it has gone. A roll is answered more rarely than a group: there are many.
   */
  private answer(cue: Cue, notes: readonly Note[]): void {
    const lead = leadNote(cue, notes);
    if (!lead) return;
    this.heard = [...this.heard, lead.hz].slice(-REPLY_MOST);
    const count = replyCount(this.contact, this.values, this.rand, cue.kind === 'roll' ? 0.25 : 1);
    if (count > 0) this.play({ kind: 'reply', heard: this.heard.slice(-count) });
  }

  /** What the rules have just said. The state is read, never changed. */
  handle(event: GameEvent, state: RunState): void {
    for (const cue of cuesOfEvent(event, state, this.memory)) this.play(cue);
  }

  /** A beat: the sound answers it with the same strength as the picture. */
  beat(beat: Beat, state: RunState): void {
    const cue = cueOfBeat(beat, state.config.size, this.contact);
    if (cue) this.play(cue);
  }

  /** Board is full: one low beat per second of the countdown. */
  warn(secondsLeft: number | null): void {
    if (secondsLeft === null) {
      this.lastWarnSecond = -1;
      return;
    }
    if (secondsLeft === this.lastWarnSecond) return;
    this.lastWarnSecond = secondsLeft;
    this.play({ kind: 'danger', secondsLeft });
  }

  /** The board comes up for the run that follows the tutorial. */
  begin(): void {
    this.play({ kind: 'begin' });
  }

  /** One second of the closing countdown in Time Limited. */
  tick(): void {
    this.play({ kind: 'clock' });
  }

  /** Points of a group have reached the score. */
  points(points: number, tier: number): void {
    this.play({ kind: 'points', points, tier });
  }

  /** The score has counted a little further up. */
  count(): void {
    this.play({ kind: 'count' });
  }

  /** What the interface of the program has done. */
  ui(event: ShellSound): void {
    switch (event.kind) {
      case 'step':
        this.play({ kind: 'uiStep', face: event.face });
        break;
      case 'stuck':
        this.play({ kind: 'uiStuck' });
        break;
      case 'run':
        this.play({ kind: 'uiRun' });
        break;
      case 'back':
        this.play({ kind: 'uiBack' });
        break;
      case 'open':
        this.play({ kind: 'uiOpen' });
        break;
      case 'close':
        this.play({ kind: 'uiClose' });
        break;
      case 'check':
        this.play({ kind: 'bootCheck' });
        break;
      case 'answer':
        this.play({ kind: 'bootAnswer', found: event.found });
        break;
      case 'logo':
        this.play({ kind: 'logo' });
        break;
      case 'climb':
        this.play({ kind: 'rank', along: event.along });
        break;
      case 'past':
        this.play({ kind: 'rankPast', own: event.who === 'own', along: event.along });
        break;
      case 'placed':
        this.play({ kind: 'rankSet', along: event.along, record: event.record, moved: event.moved });
        break;
    }
  }

  /** The window of a transmission opens, or shuts: the note held while it stood open is let go. */
  signal(event: SignalSound): void {
    if (event.kind === 'open') {
      this.play({ kind: 'window', figure: event.figure, seconds: event.seconds, glimpse: event.glimpse });
      return;
    }
    this.chain?.release(HELD, 0.05);
    this.play({ kind: 'windowShut' });
  }

  /** One more sign of the words of the other side has come. */
  sign(sign: string): void {
    if (silentSign(sign)) return;
    this.play({ kind: 'sign', code: sign.codePointAt(0) ?? 0 });
  }

  /** What the lab reads: whether the sound is open, and how many voices and nodes are alive. */
  probe(): { open: boolean; voices: number; leaving: number; nodes: number } {
    this.chain?.tidy();
    return { open: this.ctx?.state === 'running', ...(this.chain?.count ?? { voices: 0, leaving: 0, nodes: 0 }) };
  }

  /** A meter on what goes out, for the lab. */
  meter(): AnalyserNode | null {
    return this.chain?.tap() ?? null;
  }
}
