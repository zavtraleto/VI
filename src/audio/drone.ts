import type { ParamValues } from '../signal/scene';
import { soundNumber } from './params';
import { hertz, tuning, type Tuning } from './scale';
import { cents, type Rand } from './variation';

/**
 * The air of a level: a few soft tones of the mode, held under the board, very quietly. It is the
 * one sound of the game that goes on by itself, and it is heard on levels only. Nothing in it is
 * noise and nothing in it is a tune: every tone breathes at a pace of its own, so what is heard of
 * the chord drifts, and now and then one of the tones gives way to another degree of the mode.
 * Its notes are those the dice are played on, so whatever the player plays is in accord with it.
 */

/** The intervals over the root that are at rest with it, in semitones: a tone of the air is only ever on one of these. */
const CALM = [0, 3, 4, 5, 7];

/**
 * The tones of the air. `octave` is the octave of the tone against that of the root; one that is
 * `fixed` stays on the root, the others move over the calm degrees of the mode. `level` is how
 * loud it is against the rest, `breath` the seconds one breath of it takes and how deep it goes
 * (below zero: it breathes out while the others breathe in), `pan` where it stands.
 */
export const DRONE_TONES = [
  { octave: -1, fixed: true, level: 0.9, breath: 31, depth: 0.3, pan: 0 },
  { octave: 0, fixed: true, level: 0.6, breath: 23, depth: -0.4, pan: -0.2 },
  { octave: -1, fixed: false, level: 0.6, breath: 41, depth: 0.45, pan: 0.35 },
  { octave: 0, fixed: false, level: 0.3, breath: 29, depth: -0.45, pan: -0.4 },
] as const;

/** How long a tone takes to go quiet before it moves and to come back after it, as the time constants of its fall and rise, and the wait between them; in seconds. */
const SHIFT_OUT = 1.6;
const SHIFT_WAIT = 7;
const SHIFT_IN = 2.4;
/** How long the air takes to come and to go, as time constants, and how long after it has been told to go its tones are stopped; in seconds. */
const COME = 1.3;
const GO = 0.6;
const GONE = 4;
/** How much of it is left while the level waits. */
const HELD = 0.5;
/** The wait before a tone moves, against the time the panel gives: from this much of it, over this much more. */
const WAIT_FROM = 0.7;
const WAIT_OVER = 0.8;

/** The semitones over the root a tone that moves may stand on: the calm degrees of the mode, and the root an octave up in place of the root itself. */
export function droneChoices(steps: readonly number[]): number[] {
  const calm = steps.filter((step) => step !== 0 && CALM.includes(step));
  return [...calm, 12];
}

/** Where every tone of the air stands at first, in semitones over the root of its own octave: the moving ones on the highest calm degree and on the root. */
export function droneStart(steps: readonly number[]): number[] {
  const choices = droneChoices(steps);
  const high = choices.length > 1 ? choices[choices.length - 2] : 12;
  let moving = 0;
  return DRONE_TONES.map((tone) => (tone.fixed ? 0 : moving++ === 0 ? high : 12));
}

/**
 * The next change of the air: one of the tones that move goes to another calm degree. `at` is
 * where the tones stand; the tone and the degree are never the ones they would be with no change.
 */
export function droneShift(at: readonly number[], steps: readonly number[], rand: Rand): { tone: number; semis: number } {
  const moving = DRONE_TONES.flatMap((tone, index) => (tone.fixed ? [] : [index]));
  const tone = moving[Math.min(moving.length - 1, Math.floor(rand() * moving.length))];
  const others = droneChoices(steps).filter((semis) => semis !== at[tone]);
  if (others.length === 0) return { tone, semis: at[tone] };
  return { tone, semis: others[Math.min(others.length - 1, Math.floor(rand() * others.length))] };
}

interface Tone {
  one: OscillatorNode;
  two: OscillatorNode;
  breath: OscillatorNode;
  /** What is taken down while the tone moves to its next degree. */
  level: GainNode;
}

/** The air as it sounds: made when a level comes on, and let go once it has died away after the level is left. */
export class Drone {
  private readonly bus: GainNode;
  private readonly cut: BiquadFilterNode;
  private readonly send: GainNode;
  private readonly tones: Tone[] = [];
  private readonly nodes: AudioNode[] = [];
  private at: number[];
  private held = false;
  private going = false;
  private timer = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    dry: AudioNode,
    wet: AudioNode,
    private readonly values: ParamValues,
    private readonly rand: Rand,
  ) {
    const now = ctx.currentTime;
    const tune = this.tune();
    this.at = droneStart(tune.steps);
    this.bus = ctx.createGain();
    this.bus.gain.setValueAtTime(0, now);
    this.cut = ctx.createBiquadFilter();
    this.cut.type = 'lowpass';
    this.cut.Q.value = -3;
    this.send = ctx.createGain();
    this.cut.connect(this.bus);
    this.bus.connect(dry);
    this.bus.connect(this.send);
    this.send.connect(wet);
    this.nodes.push(this.bus, this.cut, this.send);

    DRONE_TONES.forEach((spec, index) => {
      const hz = this.hz(tune, index);
      const one = ctx.createOscillator();
      const two = ctx.createOscillator();
      one.type = two.type = 'triangle';
      one.frequency.setValueAtTime(hz, now);
      // A second tone a few cents off: the two beat slowly, each pair at a pace of its own.
      two.frequency.setValueAtTime(hz * cents(3 + index), now);
      const twin = ctx.createGain();
      twin.gain.value = 0.5;
      const level = ctx.createGain();
      const breathing = ctx.createGain();
      breathing.gain.value = spec.level * (1 - Math.abs(spec.depth));
      const breath = ctx.createOscillator();
      breath.frequency.value = 1 / spec.breath;
      const depth = ctx.createGain();
      depth.gain.value = spec.level * spec.depth;
      breath.connect(depth);
      depth.connect(breathing.gain);
      one.connect(level);
      two.connect(twin);
      twin.connect(level);
      level.connect(breathing);
      this.nodes.push(one, two, twin, level, breathing, breath, depth);
      if (typeof ctx.createStereoPanner === 'function') {
        const pan = ctx.createStereoPanner();
        pan.pan.value = spec.pan;
        breathing.connect(pan);
        pan.connect(this.cut);
        this.nodes.push(pan);
      } else {
        breathing.connect(this.cut);
      }
      for (const source of [one, two, breath]) source.start(now);
      this.tones.push({ one, two, breath, level });
    });
    this.refresh();
    this.wait();
  }

  private tune(): Tuning {
    const { values } = this;
    return tuning(String(values.mode), String(values.root), soundNumber(values, 'octave'), soundNumber(values, 'fine'));
  }

  private hz(tune: Tuning, index: number): number {
    return hertz(tune.root + this.at[index] + 12 * DRONE_TONES[index].octave + tune.fine / 100);
  }

  /** The values of the panel have changed, or the level waits or goes on: how loud the air is, how dark, how much of the echo it takes. */
  refresh(): void {
    if (this.going) return;
    const now = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(soundNumber(this.values, 'droneGain') * (this.held ? HELD : 1), now, COME);
    this.cut.frequency.setTargetAtTime(soundNumber(this.values, 'droneCut'), now, 0.05);
    this.send.gain.setTargetAtTime(soundNumber(this.values, 'droneVerb'), now, 0.05);
  }

  /** The level waits under a window, or goes on. */
  setHeld(held: boolean): void {
    if (held === this.held) return;
    this.held = held;
    this.refresh();
  }

  /** One of the tones goes quiet, moves to another degree and comes back: `at` is in the time of the context. */
  shift(at = this.ctx.currentTime): void {
    const tune = this.tune();
    const { tone, semis } = droneShift(this.at, tune.steps, this.rand);
    this.at[tone] = semis;
    const hz = this.hz(tune, tone);
    const { one, two, level } = this.tones[tone];
    level.gain.setTargetAtTime(0, at, SHIFT_OUT);
    one.frequency.setValueAtTime(hz, at + SHIFT_WAIT);
    two.frequency.setValueAtTime(hz * cents(3 + tone), at + SHIFT_WAIT);
    level.gain.setTargetAtTime(1, at + SHIFT_WAIT, SHIFT_IN);
  }

  private wait(): void {
    if (typeof window === 'undefined') return;
    const seconds = soundNumber(this.values, 'droneMove') * (WAIT_FROM + WAIT_OVER * this.rand());
    this.timer = window.setTimeout(() => {
      if (this.going) return;
      // A context that stands still - the page is hidden - is not given changes to pile up.
      if (this.ctx.state === 'running') this.shift();
      this.wait();
    }, seconds * 1000);
  }

  /** The level is left: the air dies away, and its tones are let go once it has. */
  stop(): void {
    if (this.going) return;
    this.going = true;
    if (this.timer) window.clearTimeout(this.timer);
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(0, now, GO);
    for (const { one, two, breath } of this.tones) for (const source of [one, two, breath]) source.stop(now + GONE);
    this.tones[0].one.onended = () => {
      for (const node of this.nodes) node.disconnect();
    };
  }
}
