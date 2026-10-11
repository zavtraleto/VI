import type { GameEvent } from '../rules/types';

/**
 * The phone answers in the hand only when dice leave: a combo, a link of a chain, a board that
 * is passed. A move, a step and a wall are never felt. Like the sound, it reads what the rules
 * and the beats say and changes nothing.
 *
 * A browser gives no strength, only how long the motor runs and how long it rests, in
 * milliseconds: a tick is as short as a motor still answers, and what matters more is said with
 * more ticks, never with a longer one.
 */
export const PULSES = {
  combo: [8],
  link: [8, 70, 8],
  passed: [8, 90, 8, 90, 8],
} as const satisfies Record<string, readonly number[]>;

export type PulseName = keyof typeof PULSES;

/** What may take the place of what: a pulse is never cut short by a lesser one. */
const RANK: Record<PulseName, number> = { combo: 0, link: 1, passed: 2 };

/** The longest a tick may be made by the scale of the probe, in milliseconds. */
const TICK_MOST = 40;

export function pulseOfBeat(beat: { kind: string }): PulseName | null {
  if (beat.kind === 'match') return 'combo';
  if (beat.kind === 'chain') return 'link';
  return null;
}

export function pulseOfEvent(event: GameEvent): PulseName | null {
  return event.type === 'cleared' || event.type === 'levelPassed' ? 'passed' : null;
}

/** A pulse with its ticks made `scale` times as long; its rests are kept. */
export function scaled(pulse: readonly number[], scale: number): number[] {
  return pulse.map((ms, index) => (index % 2 === 0 ? Math.min(TICK_MOST, Math.max(1, Math.round(ms * scale))) : ms));
}

/**
 * What the address says of the probe: `?haptic=off` takes it away, `?haptic=2` makes every tick
 * twice as long, for a phone whose motor does not answer a short one.
 */
export function hapticScale(search: string): number {
  const asked = new URLSearchParams(search).get('haptic');
  if (asked === null) return 1;
  if (asked === 'off') return 0;
  const scale = Number(asked);
  return Number.isFinite(scale) && scale > 0 ? Math.min(5, scale) : 1;
}

export class Haptics {
  /** Until when the last pulse runs, by the clock of the page, and what it was. */
  private busyUntil = 0;
  private busyRank = -1;

  constructor(
    private readonly scale = 1,
    /** The motor; null where the browser has none (an iPhone, a desktop). */
    private readonly vibrate: ((pattern: number[]) => boolean) | null = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
      ? (pattern) => navigator.vibrate(pattern)
      : null,
    private readonly now: () => number = () => performance.now(),
  ) {}

  beat(beat: { kind: string }): void {
    const name = pulseOfBeat(beat);
    if (name) this.play(name);
  }

  handle(event: GameEvent): void {
    const name = pulseOfEvent(event);
    if (name) this.play(name);
  }

  play(name: PulseName): void {
    if (!this.vibrate || this.scale <= 0) return;
    const at = this.now();
    if (at < this.busyUntil && RANK[name] <= this.busyRank) return;
    const pattern = scaled(PULSES[name], this.scale);
    try {
      // False before the first press, on a hidden page, or where a frame is not let: nothing is felt, and nothing is wrong.
      if (!this.vibrate(pattern)) return;
    } catch {
      return;
    }
    this.busyUntil = at + pattern.reduce((sum, ms) => sum + ms, 0);
    this.busyRank = RANK[name];
  }
}
