/**
 * The curves every movement of the look goes by, by name, so that the look has one vocabulary
 * of motion (docs/art/VI_Visual_Language.md, «Словарь движения»). `t` is the share of the
 * movement done, 0 to 1; the result is the share of the way gone, 0 to 1, except for a curve
 * that goes past the end and comes back.
 */
export type Curve = (t: number) => number;

export const linear: Curve = (t) => t;
export const inQuad: Curve = (t) => t * t;
export const outQuad: Curve = (t) => 1 - (1 - t) * (1 - t);
export const inCubic: Curve = (t) => t * t * t;
export const outCubic: Curve = (t) => 1 - Math.pow(1 - t, 3);
export const inQuart: Curve = (t) => t * t * t * t;
export const inExpo: Curve = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, 10 * t - 10));
export const inOutSine: Curve = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Goes past the end by about a tenth with the usual `overshoot`, and comes back to it. */
export function outBack(overshoot = 1.70158): Curve {
  const c3 = overshoot + 1;
  return (t) => 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

/** The curves by name: for the numbers of the look that pick one. */
export const CURVES: Record<string, Curve> = { linear, inQuad, outQuad, inCubic, outCubic, inQuart, inExpo, inOutSine, outBack: outBack() };

/** Where a movement from `from` to `to` is at share `t` of its time, along `curve`; held at either end outside 0..1. */
export function tween(t: number, from: number, to: number, curve: Curve): number {
  if (t <= 0) return from;
  if (t >= 1) return to;
  return from + (to - from) * curve(t);
}
