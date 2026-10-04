import type { ShellSound } from './screen';

/**
 * The way a finished session goes up the log of sessions: from under its last line, past one
 * line after another, to the place its score takes. It sets off slowly, gathers speed, and
 * slows down again as it comes to its place, so the last lines are gone past one by one.
 *
 * Nothing here draws: this is what is on the way at a moment, and what of it can be heard.
 */

/** A line of the log the session may go past. */
export interface ClimbLine {
  name: string;
  score: number;
  /** The best the player had before this session. */
  own: boolean;
  /** A record of one of the six. */
  subject: boolean;
}

/** A line of the log as the way up shows it at a moment. */
export interface ClimbRow {
  place: number;
  name: string;
  score: number;
  /** The session itself; the best the player had before it; a line gone past this instant; any other line. */
  tone: 'run' | 'own' | 'lit' | 'dim';
}

export interface ClimbOptions {
  /** The log without this session, best first. */
  lines: readonly ClimbLine[];
  /** What the session came to. */
  score: number;
  /** The name the session goes up under. */
  name: string;
  /** The session is the best the player has had. */
  record: boolean;
  /** Nothing moves: the place is shown at once. */
  reduced?: boolean;
  /** Time before the way up begins, in milliseconds: what the end of a session needs to be heard. */
  leadMs?: number;
}

/** The first gap between two lines, and how much shorter each next one is. */
const START_GAP_MS = 230;
const START_RATIO = 0.8;
/** The last gap, and how much shorter each one before it is. */
const END_GAP_MS = 540;
const END_RATIO = 0.72;
/** The shortest gap at full speed, and the longest the whole way may take: past that, full speed is faster. */
const FAST_GAP_MS = 20;
const LONGEST_MS = 6400;
/** From the last line gone past to the place being taken. */
const SETTLE_MS = 460;
/** A session that goes past nothing still counts its score up for this long. */
const COUNT_MS = 700;
/** How long a line stays lit after it has been gone past. */
const LIT_MS = 110;
/** How long the place stays lit once it is taken. */
const PLACED_MS = 1400;

/**
 * The moments at which a session goes past each of `count` lines, in milliseconds from setting
 * off. The gaps shrink from the first one on and grow towards the last one; between the two
 * the way runs at full speed, which is the faster the more lines there are.
 */
export function passTimes(count: number): number[] {
  const n = Math.max(0, Math.round(count));
  const shaped = (i: number): number => Math.max(START_GAP_MS * START_RATIO ** i, END_GAP_MS * END_RATIO ** (n - 1 - i));
  const total = (fast: number): number => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Math.max(fast, shaped(i));
    return sum;
  };
  // Full speed is brought down until the whole way fits the longest it may take.
  let fast = FAST_GAP_MS;
  if (total(fast) > LONGEST_MS) {
    let low = 0;
    for (let step = 0; step < 24; step++) {
      const mid = (low + fast) / 2;
      if (total(mid) > LONGEST_MS) fast = mid;
      else low = mid;
    }
    fast = low;
  }
  const times: number[] = [];
  let at = 0;
  for (let i = 0; i < n; i++) {
    at += Math.max(fast, shaped(i));
    times.push(at);
  }
  return times;
}

export class Climb {
  /** Lines the session goes past. */
  readonly gained: number;
  /** The place it takes. */
  readonly place: number;
  readonly record: boolean;
  private readonly lines: readonly ClimbLine[];
  private readonly score: number;
  private readonly name: string;
  private readonly times: number[];
  /** When the place is taken, from setting off. */
  private readonly endMs: number;
  private readonly leadMs: number;
  /** Nothing moves: when the way would set off, the place is taken at once. */
  private readonly still: boolean;
  /** The frame clock at the last frame, when the way set off by it, and when the place was taken by it. */
  private now = 0;
  private start: number | null = null;
  private placedAt: number | null = null;
  /** Time on the way, from setting off. */
  private elapsed = 0;
  /** Lines gone past so far, and until when the last of them is lit. */
  private passed = 0;
  private litUntil = 0;
  private placed = false;
  /** What was last drawn: a frame that shows the same is not drawn again. */
  private drawn = '';

  constructor(
    options: ClimbOptions,
    private readonly sound: (event: ShellSound) => void = () => undefined,
  ) {
    this.lines = options.lines;
    this.score = Math.max(0, Math.round(options.score));
    this.name = options.name;
    this.record = options.record;
    // A line with as much stays ahead: it was there first.
    const ahead = this.lines.filter((line) => line.score >= this.score).length;
    this.gained = this.lines.length - ahead;
    this.place = ahead + 1;
    this.times = passTimes(this.gained);
    this.endMs = this.gained > 0 ? this.times[this.gained - 1] + SETTLE_MS : COUNT_MS;
    this.leadMs = Math.max(0, options.leadMs ?? 0);
    this.still = options.reduced ?? false;
  }

  /** The place is taken: nothing moves any more. */
  get done(): boolean {
    return this.placed;
  }

  /**
   * How many lines the log has with the session in it. A record takes the place of the line
   * the player had, once its own place is taken: the log does not grow by it.
   */
  get total(): number {
    const replaced = this.placed && this.record && this.lines.some((line) => line.own);
    return this.lines.length + (replaced ? 0 : 1);
  }

  /** The place has just been taken: it is shown lit. */
  get lit(): boolean {
    return this.placedAt !== null && this.now - this.placedAt < PLACED_MS;
  }

  /** Takes the way to this moment of the frame clock. Returns true when what it shows has changed. */
  update(timeMs: number): boolean {
    this.now = timeMs;
    if (!this.placed) {
      this.start ??= timeMs + this.leadMs;
      // Below nothing until the way sets off: the end of the session is heard out first.
      this.elapsed = timeMs - this.start;
      if (this.still && this.elapsed >= 0) this.finish();
    }
    if (!this.placed) {
      let heard = false;
      while (this.passed < this.gained && this.times[this.passed] <= this.elapsed) {
        const line = this.lines[this.lines.length - 1 - this.passed];
        this.passed++;
        this.litUntil = this.times[this.passed - 1] + LIT_MS;
        if (line.own) this.sound({ kind: 'past', who: 'own', along: this.along() });
        else if (line.subject) this.sound({ kind: 'past', who: 'subject', along: this.along() });
        else heard = true;
      }
      // Several lines gone past within one frame are one click.
      if (heard) this.sound({ kind: 'climb', along: this.along() });
      if (this.elapsed >= this.endMs) this.land();
    }
    if (this.placed) this.placedAt ??= timeMs;
    const key = `${this.passed}/${this.shownScore()}/${this.elapsed < this.litUntil}/${this.placed}/${this.lit}`;
    if (key === this.drawn) return false;
    this.drawn = key;
    return true;
  }

  /** Goes straight to the place. */
  finish(): void {
    if (this.placed) return;
    this.passed = this.gained;
    this.land();
  }

  private land(): void {
    this.placed = true;
    this.elapsed = Math.max(this.elapsed, this.endMs);
    this.sound({ kind: 'placed', along: this.along(), record: this.record, moved: this.gained > 0 });
  }

  /** How high in the log the session stands now: 0 under its last line, 1 at its top. */
  private along(): number {
    return this.lines.length > 0 ? this.passed / this.lines.length : 1;
  }

  /** The place the session has now. */
  shownPlace(): number {
    return this.lines.length - this.passed + 1;
  }

  /**
   * The score as it is counted up: it reaches the score of a line at the moment that line is
   * gone past, and its own after the last of them.
   */
  shownScore(): number {
    if (this.placed || this.elapsed >= this.endMs) return this.score;
    if (this.elapsed <= 0) return 0;
    const at = (i: number): number => (i < 0 ? 0 : i >= this.gained ? this.endMs : this.times[i]);
    const worth = (i: number): number => (i < 0 ? 0 : i >= this.gained ? this.score : this.lines[this.lines.length - 1 - i].score);
    const next = this.passed;
    const from = at(next - 1);
    const to = at(next);
    const part = to > from ? Math.min(1, Math.max(0, (this.elapsed - from) / (to - from))) : 1;
    return Math.round(worth(next - 1) + (worth(next) - worth(next - 1)) * part);
  }

  /**
   * What the log shows around the session at this moment, in `count` rows: the session in the
   * middle one, the lines still ahead over it, nearest first from the middle up, and the lines
   * gone past under it. A row with no line is null.
   */
  rows(count: number): (ClimbRow | null)[] {
    const size = Math.max(1, Math.round(count));
    const middle = Math.floor(size / 2);
    const ahead = this.lines.length - this.passed;
    // The place is taken with a record: the line the player had before is gone from the log.
    const gone = this.placed && this.record ? this.lines.findIndex((line) => line.own) : -1;
    const below = this.lines.map((_, i) => i).filter((i) => i >= ahead && i !== gone);
    const lit = !this.placed && this.elapsed < this.litUntil;
    const rows: (ClimbRow | null)[] = [];
    for (let row = 0; row < size; row++) {
      if (row === middle) {
        rows.push({ place: ahead + 1, name: this.name, score: this.shownScore(), tone: 'run' });
        continue;
      }
      const i = row < middle ? ahead - (middle - row) : below[row - middle - 1];
      const line = i === undefined || i < 0 ? undefined : this.lines[i];
      if (!line) {
        rows.push(null);
        continue;
      }
      // A line ahead keeps its place; one gone past stands a place lower, unless the player's old line has left the log above it.
      const place = row < middle ? i + 1 : i + 2 - (gone >= 0 && i > gone ? 1 : 0);
      const tone = line.own ? 'own' : row === middle + 1 && lit ? 'lit' : 'dim';
      rows.push({ place, name: line.name, score: line.score, tone });
    }
    return rows;
  }
}
