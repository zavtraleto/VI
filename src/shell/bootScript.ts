/** How long the parts of the boot take, in milliseconds. */
export interface BootTiming {
  /** The whole of the first start, and of every later one. */
  totalMs: number;
  shortMs: number;
  /** The dark screen before the first line of the check. */
  darkMs: number;
  /** The wait for the link device, on top of what any other line takes. */
  linkMs: number;
  /** How long the logo of the first start stays. */
  logoMs: number;
  /** The change from the dark screen to the light one. */
  fadeMs: number;
}

export interface BootOptions {
  /** The first start of the program on this device: the long boot with the check. */
  first: boolean;
  /** Reduced motion: nothing comes in step by step. */
  reduced: boolean;
  /** Lines of the check. The last one is the link device. */
  rows: number;
}

/** What is on screen at a moment of the boot. */
export interface BootFrame {
  /** Lines of the check that show their name, and how many of those show their result. */
  labels: number;
  values: number;
  /** The line after the check. */
  tail: boolean;
  /** 0 is the dark screen of the check, 1 the light one of the logo. */
  light: number;
  /** 0..1, how much of the logo is there. */
  logo: number;
  /** The one line under the logo of a later start. */
  line: boolean;
  done: boolean;
}

/** A line shows its result this far into its own step. */
const VALUE_AT = 0.45;
/** With reduced motion the check stands still for this long. */
const REDUCED_CHECK_MS = 1500;
/** The line of a later start comes this far into it. */
const LINE_AT = 0.25;
/** A step of the check is never shorter than this, whatever the total asks for. */
const MIN_STEP_MS = 60;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** One step of the check: a line takes one, the line after the check waits one and stays two. */
function stepMs(timing: BootTiming, rows: number): number {
  const rest = timing.totalMs - timing.darkMs - timing.linkMs - timing.logoMs;
  return Math.max(MIN_STEP_MS, rest / (rows + 3));
}

/** When the logo takes the screen, on the first start. */
function logoStart(timing: BootTiming, options: BootOptions): number {
  if (options.reduced) return REDUCED_CHECK_MS;
  return timing.darkMs + (options.rows + 3) * stepMs(timing, options.rows) + timing.linkMs;
}

/** How long the boot takes from its first frame to the menu. */
export function bootLength(timing: BootTiming, options: BootOptions): number {
  if (!options.first) return timing.shortMs;
  return logoStart(timing, options) + timing.logoMs;
}

/**
 * The boot at `timeMs` from its start. The first start is a dark screen, the check line by
 * line with a wait before the link device answers, then the logo on a light screen. Later
 * starts are the logo and one line.
 */
export function bootFrame(timeMs: number, timing: BootTiming, options: BootOptions): BootFrame {
  const t = Math.max(0, timeMs);
  const { rows, reduced } = options;
  const done = t >= bootLength(timing, options);
  const fade = (since: number): number => (reduced || timing.fadeMs <= 0 ? 1 : clamp01((t - since) / timing.fadeMs));

  if (!options.first) {
    return { labels: 0, values: 0, tail: false, light: 1, logo: fade(0), line: reduced || t >= timing.shortMs * LINE_AT, done };
  }

  const start = logoStart(timing, options);
  if (t >= start) {
    const shown = fade(start);
    return { labels: 0, values: 0, tail: false, light: shown, logo: shown, line: false, done };
  }
  if (reduced) return { labels: rows, values: rows, tail: true, light: 0, logo: 0, line: false, done };

  const step = stepMs(timing, rows);
  const since = t - timing.darkMs;
  const labels = since < 0 ? 0 : Math.min(rows, Math.floor(since / step) + 1);
  // Every line answers a little after it appears; the last one makes the program wait.
  const quick = since < 0 ? 0 : Math.min(rows - 1, Math.floor((since - VALUE_AT * step) / step) + 1);
  const linkAt = (rows - 1 + VALUE_AT) * step + timing.linkMs;
  const values = since >= linkAt ? rows : Math.max(0, quick);
  const tail = since >= rows * step + timing.linkMs + step;
  return { labels, values, tail, light: 0, logo: 0, line: false, done };
}
