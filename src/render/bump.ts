/** The share of a bump the die takes to go out; the rest of it it comes back. */
const BUMP_OUT = 0.35;
/** A step that is stopped again this soon after the last, the same way, is the same press held: it is not answered again. */
export const BUMP_QUIET_MS = 400;

/**
 * How far the die under the figure, or the figure on the floor, stands towards a step that was
 * stopped, `sinceMs` after it was: out quickly to `reach`, in cells, and back slower, in `forMs`
 * in all. Nought before and after.
 */
export function bumpOffset(sinceMs: number, forMs: number, reach: number): number {
  if (!(forMs > 0) || sinceMs <= 0 || sinceMs >= forMs) return 0;
  const p = sinceMs / forMs;
  if (p < BUMP_OUT) {
    const out = 1 - p / BUMP_OUT;
    return reach * (1 - out * out);
  }
  const back = (p - BUMP_OUT) / (1 - BUMP_OUT);
  return reach * (1 - back * back * (3 - 2 * back));
}
