import type { GameEvent, MoveKind } from '../rules';

/**
 * Placeholder sound made entirely with WebAudio: no assets. Every sound here is a stand-in
 * for the final sound design and is meant to be replaced, not tuned.
 */

/** Natural minor scale steps, in semitones, used to raise a chain. */
const MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];
const ROOT_HZ = 55;

interface DroneLayer {
  osc: OscillatorNode;
  gain: GainNode;
  level: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private drones: DroneLayer[] = [];
  private muted = false;
  private stage = 0;
  private lastWarnSecond = -1;
  private suspended = false;

  /** Must be called from a user gesture; browsers keep audio locked until then. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.suspended) void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(ctx.destination);

    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;

    // One drone layer per ritual stage: root, fifth, detuned octave, a dissonant second, a low fourth.
    const layers: [number, OscillatorType, number][] = [
      [ROOT_HZ, 'sine', 0.16],
      [ROOT_HZ * 1.5, 'sine', 0.07],
      [ROOT_HZ * 2.01, 'triangle', 0.045],
      [ROOT_HZ * 1.06, 'sine', 0.07],
      [ROOT_HZ * 0.75, 'sawtooth', 0.035],
    ];
    this.drones = layers.map(([freq, type, level]) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master!);
      osc.start();
      return { osc, gain, level };
    });
    this.applyStage(0.05);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.03);
  }

  /** Silences everything while the game is paused or the tab is hidden. */
  setPaused(paused: boolean): void {
    this.suspended = paused;
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  setStage(stage: number): void {
    if (stage === this.stage) return;
    const rising = stage > this.stage;
    this.stage = stage;
    this.applyStage(1.2);
    if (rising) this.swell(stage);
  }

  private applyStage(seconds: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.drones.forEach((layer, i) => {
      layer.gain.gain.setTargetAtTime(i < this.stage ? layer.level : 0, now, seconds / 3);
    });
  }

  private tone(
    freq: number,
    opts: { type?: OscillatorType; gain?: number; attack?: number; decay: number; to?: number; delay?: number },
  ): void {
    if (!this.ctx || !this.master) return;
    const start = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, start + opts.decay);
    const gain = this.ctx.createGain();
    const peak = opts.gain ?? 0.2;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + (opts.attack ?? 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.decay);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + opts.decay + 0.05);
  }

  private noise(opts: { duration: number; freq: number; type?: BiquadFilterType; gain?: number; q?: number }): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const start = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.type ?? 'lowpass';
    filter.frequency.value = opts.freq;
    filter.Q.value = opts.q ?? 0.7;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(opts.gain ?? 0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start, Math.random() * 0.5);
    source.stop(start + opts.duration + 0.02);
  }

  private chord(rootHz: number, semitones: number[], decay: number, gain: number): void {
    semitones.forEach((s, i) => {
      this.tone(rootHz * 2 ** (s / 12), { type: i === 0 ? 'triangle' : 'sine', gain: gain / (1 + i * 0.4), attack: 0.01, decay, delay: i * 0.012 });
    });
  }

  private swell(stage: number): void {
    this.tone(ROOT_HZ * 0.5, { type: 'sine', gain: 0.35, attack: 0.4, decay: 2.2 });
    this.tone(ROOT_HZ * 2 * 2 ** (MINOR[stage] / 12), { type: 'triangle', gain: 0.12, attack: 0.6, decay: 1.8 });
    this.noise({ duration: 1.6, freq: 500 + stage * 250, type: 'bandpass', gain: 0.1, q: 1.5 });
  }

  private move(kind: MoveKind): void {
    if (kind === 'walk' || kind === 'hop' || kind === 'mount' || kind === 'descend' || kind === 'climb') {
      this.noise({ duration: 0.05, freq: 1400, type: 'bandpass', gain: 0.1, q: 2 });
    } else if (kind === 'push') {
      this.noise({ duration: 0.2, freq: 320, gain: 0.22 });
    }
  }

  /** Board is full: one low pulse per second of the countdown. */
  warn(secondsLeft: number | null): void {
    if (secondsLeft === null) {
      this.lastWarnSecond = -1;
      return;
    }
    if (secondsLeft === this.lastWarnSecond) return;
    this.lastWarnSecond = secondsLeft;
    this.tone(196, { type: 'square', gain: 0.1, decay: 0.16 });
    this.tone(98, { type: 'square', gain: 0.12, decay: 0.2 });
  }

  /** One second of the closing countdown in Time Limited. */
  tick(): void {
    this.tone(660, { type: 'triangle', gain: 0.1, decay: 0.12 });
  }

  handle(event: GameEvent): void {
    switch (event.type) {
      case 'move':
        this.move(event.kind);
        break;
      case 'landed':
        // Short dry thud when a cube comes to rest.
        this.noise({ duration: 0.07, freq: 520, gain: 0.34 });
        this.tone(92, { gain: 0.3, decay: 0.09, to: 60 });
        break;
      case 'blocked':
        this.tone(70, { type: 'square', gain: 0.07, decay: 0.06 });
        break;
      case 'warned':
        // A short crackle where a cube is about to rise.
        this.noise({ duration: 0.09, freq: 3200, type: 'highpass', gain: 0.12 });
        this.tone(1400, { type: 'square', gain: 0.04, decay: 0.08, to: 320 });
        break;
      case 'spawn':
        this.tone(120, { gain: 0.05, attack: 0.2, decay: 0.9, to: 200 });
        break;
      case 'displaced':
        this.noise({ duration: 0.1, freq: 900, type: 'bandpass', gain: 0.14, q: 3 });
        break;
      case 'match':
        this.chord(ROOT_HZ * 2 * 2 ** (MINOR[event.value - 1] / 12), [0, 7, 12], 0.9, 0.22);
        break;
      case 'chain': {
        const step = MINOR[Math.min(event.chain + event.value - 2, MINOR.length - 1)];
        this.chord(ROOT_HZ * 2 * 2 ** (step / 12), [0, 3, 7, 10, 12], 1.3, 0.26);
        break;
      }
      case 'happyOne':
        for (const [i, f] of [880, 1320, 1760].entries()) this.tone(f, { gain: 0.08, decay: 0.5, delay: i * 0.05 });
        break;
      case 'removed':
        this.tone(200, { gain: 0.06, decay: 0.4, to: 55 });
        break;
      case 'fell':
        this.noise({ duration: 0.14, freq: 240, gain: 0.3 });
        break;
      case 'lifted':
        this.tone(140, { gain: 0.08, attack: 0.05, decay: 0.4, to: 220 });
        break;
      case 'levelUp':
        this.tone(ROOT_HZ * 4, { type: 'triangle', gain: 0.12, decay: 0.35 });
        this.tone(ROOT_HZ * 6, { type: 'triangle', gain: 0.12, decay: 0.5, delay: 0.14 });
        break;
      case 'gameOver':
        this.chord(ROOT_HZ * 2, [0, 1, 6], 2.4, 0.3);
        this.tone(ROOT_HZ, { gain: 0.4, decay: 2.6, to: 27 });
        break;
      default:
        break;
    }
  }
}
