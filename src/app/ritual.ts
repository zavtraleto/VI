import type { ContactLook } from '../render/view';

/** One thing of the board, or of the program around it, that changes as the contact grows. */
export type ContactLine = 'grid' | 'dice' | 'backdrop' | 'screen' | 'program' | 'red';

export const CONTACT_LINES: readonly ContactLine[] = ['grid', 'dice', 'backdrop', 'screen', 'program', 'red'];

/**
 * The steps of the contact, by the dice sent to the other side that reach them. A step moves
 * one line one step on: the board changes a little at a time and never all at once.
 * Presentation only: rules never read these.
 *
 * They are counted in dice and not in points: the score of a pro is hundreds of times that of
 * a novice, and steps by score came all at once in a pro's first two minutes and hardly at all
 * to a novice. Dice sent differ a few times over, so that everybody goes through the first
 * half in a run, and the last step waits for a run a strong player would call long.
 */
export const CONTACT_STEPS: readonly { sent: number; line: ContactLine }[] = [
  // A group sent runs over the lines of the surface.
  { sent: 4, line: 'grid' },
  // The program no longer reads its link as empty: a pattern is found.
  { sent: 8, line: 'program' },
  // The pips of every die answer a group sent.
  { sent: 13, line: 'dice' },
  // The dark leans to the channel sent most.
  { sent: 18, line: 'backdrop' },
  // The colours of the picture part for a moment when a group goes.
  { sent: 24, line: 'screen' },
  // The lines pulse by themselves.
  { sent: 30, line: 'grid' },
  // The readings slip sideways now and then.
  { sent: 37, line: 'program' },
  // The dice breathe.
  { sent: 45, line: 'dice' },
  // The dark answers a group sent.
  { sent: 55, line: 'backdrop' },
  // The picture jolts when a large group goes.
  { sent: 70, line: 'screen' },
  // The run over the lines takes the colour of the group.
  { sent: 90, line: 'grid' },
  // Signs of a hand that is not the program's turn up among the digits.
  { sent: 115, line: 'program' },
  // Red seeps into the dark.
  { sent: 145, line: 'red' },
  // The light of the dice going down stands longer and taller.
  { sent: 180, line: 'dice' },
  // The readings come apart.
  { sent: 220, line: 'program' },
  // Black, white and red.
  { sent: 270, line: 'red' },
];

/** Dice sent at the steps alone. */
export const RITUAL_THRESHOLDS: readonly number[] = CONTACT_STEPS.map((step) => step.sent);

export const STAGE_TRANSITION_MS = 1500;
export const PHASE_SHIFT_MS = 900;
/** How long a chain holds the contact above what the dice sent have earned. */
export const BOOST_MS = 4000;
/** A chain this long, made past the last step, turns the picture inside out. */
const PEAK_CHAIN = 3;

export function stageForSent(sent: number): number {
  let stage = 0;
  while (stage < RITUAL_THRESHOLDS.length && sent >= RITUAL_THRESHOLDS[stage]) stage++;
  return stage;
}

/** Dice sent at which the next step comes, or null past the last one. */
export function nextThreshold(sent: number): number | null {
  const stage = stageForSent(sent);
  return stage < RITUAL_THRESHOLDS.length ? RITUAL_THRESHOLDS[stage] : null;
}

/** How many steps of a line lie under a depth: a step is whole once the depth is past it. */
export function lineLevel(line: ContactLine, depth: number): number {
  let level = 0;
  CONTACT_STEPS.forEach((step, i) => {
    if (step.line === line) level += Math.min(1, Math.max(0, depth - i));
  });
  return level;
}

/**
 * Tracks how far the contact has gone in the current run and eases what the board shows of it.
 * A step, once reached, stays until the run ends. A chain lifts the contact for a few seconds
 * above what the dice sent have earned: a glimpse of what lies deeper.
 */
export class Ritual {
  stage = 0;
  /** What the board shows. The same object for as long as the ritual lives. */
  readonly look: ContactLook = { grid: 0, dice: 0, backdrop: 0, screen: 0, program: 0, red: 0, peak: 0, channel: 0 };
  /** Steps a chain has added on top of the stage, falling back to 0. */
  private lift = 0;
  /** Groups sent in this run by the value on their dice, index 0 = the 1. */
  private readonly sent = [0, 0, 0, 0, 0, 0];

  reset(): void {
    this.stage = 0;
    this.lift = 0;
    this.sent.fill(0);
    Object.assign(this.look, { grid: 0, dice: 0, backdrop: 0, screen: 0, program: 0, red: 0, peak: 0, channel: 0 });
  }

  /** A group has been sent: its channel is counted. `chain` is 1 for a group that starts a chain. */
  send(value: number, chain: number): void {
    this.sent[value - 1]++;
    let most = this.look.channel;
    this.sent.forEach((count, i) => {
      if (count > (most > 0 ? this.sent[most - 1] : 0)) most = i + 1;
    });
    this.look.channel = most;
    if (chain < 2) return;
    this.lift = Math.max(this.lift, chain - 1);
    if (this.stage === CONTACT_STEPS.length && chain >= PEAK_CHAIN) this.look.peak = 1;
  }

  /** Returns the steps newly reached by this update, in order. `sent` is the dice gone to the other side in this run. */
  update(sent: number, dtMs: number): number[] {
    const reached: number[] = [];
    const target = stageForSent(sent);
    while (this.stage < target) {
      this.stage++;
      reached.push(this.stage);
      if (this.stage === CONTACT_STEPS.length) this.look.peak = 1;
    }
    this.lift = Math.max(0, this.lift - (dtMs / BOOST_MS) * Math.max(1, this.lift));
    const depth = this.stage + this.lift;
    const ease = dtMs / STAGE_TRANSITION_MS;
    for (const line of CONTACT_LINES) {
      const level = lineLevel(line, depth);
      const now = this.look[line];
      this.look[line] = now < level ? Math.min(level, now + ease) : Math.max(level, now - ease);
    }
    this.look.peak = Math.max(0, this.look.peak - dtMs / PHASE_SHIFT_MS);
    return reached;
  }
}
