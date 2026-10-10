/**
 * Measures of the page's own, for whoever looks for a frame that came late: `performance`
 * keeps them, the tools of the browser show them, and `?perf` lists those of the first seconds
 * of play. Every name begins with `vi-`. They cost a reading of the clock, and are in every build.
 */

/** A part of a frame shorter than this is not written down, in milliseconds: only what could hold a frame up is. */
const SLOW_MS = 8;
/** No more than this many are kept: the browser never lets go of them itself. */
const MOST = 400;

let kept = 0;

/** Writes down how long something took, from `from` by the clock of the page until now, if it was `least` milliseconds or more. */
export function span(name: string, from: number, least = SLOW_MS): void {
  const to = performance.now();
  if (to - from < least || kept >= MOST) return;
  kept++;
  try {
    performance.measure(`vi-${name}`, { start: from, end: to });
  } catch {
    // A browser without this measure: nothing is measured.
  }
}

/** Marks a moment of the page: `vi-play` is the press of the command that starts, `vi-first-move` the first move taken. */
export function mark(name: string): void {
  try {
    performance.mark(`vi-${name}`);
  } catch {
    // Nothing is marked.
  }
}
