/**
 * The lens a layer can be put on screen through: the middle of the picture is enlarged and its
 * edges are pressed together, so all of it stays in view. It is the "fisheye" of focus and
 * context (Sarkar and Brown, 1992).
 *
 * A point is counted from the centre of the lens, in units where the edges of the part of the
 * layer the lens lies over are at 1: the lens is an ellipse, and presses all four edges alike.
 * A point of the screen at the distance `r` from the centre shows the point of the layer at
 *
 *   r_src = r · (1 + k · r²) / (1 + k)
 *
 * so the middle is `1 + k` times as large as the layer has it, an edge stays an edge, and
 * `k = 0` is no lens. Past the edges - in the corners of the rectangle - the lens looks
 * outside the layer: the picture has the shape of a barrel.
 *
 * The strength may differ from side to side. Then the point (x, y) shows
 *
 *   x_src = x · (1 + kx · x² + ky · y²) / (1 + kx)
 *   y_src = y · (1 + kx · x² + ky · y²) / (1 + ky)
 *
 * where `kx` and `ky` are the strengths towards the sides the point lies on. With one strength
 * all round this is the formula above. Across the centre the picture has no break and no bend.
 */

/** The strength of a lens towards each side of its centre. */
export interface LensSides {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/** One number is the same strength all round. */
export type LensStrength = number | LensSides;

export interface Point {
  x: number;
  y: number;
}

/** The strengths towards the sides the point (x, y) lies on; `y` points up. */
function towards(x: number, y: number, k: LensStrength): [kx: number, ky: number] {
  if (typeof k === 'number') return [Math.max(0, k), Math.max(0, k)];
  return [Math.max(0, x < 0 ? k.left : k.right), Math.max(0, y < 0 ? k.bottom : k.top)];
}

/** Whether the strength bends anything at all. */
export function lensBends(k: LensStrength): boolean {
  return typeof k === 'number' ? k > 0 : k.left > 0 || k.right > 0 || k.bottom > 0 || k.top > 0;
}

/** Which point of the layer a point of the screen shows; both from the centre of the lens, 1 at its edges. */
export function lensInverse(x: number, y: number, k: LensStrength): Point {
  const [kx, ky] = towards(x, y, k);
  const g = 1 + kx * x * x + ky * y * y;
  return { x: (x * g) / (1 + kx), y: (y * g) / (1 + ky) };
}

/** Steps of Newton's method at most; it stops as soon as a step moves nothing. */
const STEPS = 16;
const CLOSE = 1e-13;

/** Where on the screen a point of the layer is shown; both from the centre of the lens, 1 at its edges. */
export function lensForward(x: number, y: number, k: LensStrength): Point {
  // The lens keeps every point on its side of the centre, so the strengths are those of the point given.
  const [kx, ky] = towards(x, y, k);
  if (kx === 0 && ky === 0) return { x, y };
  // Started from outside the answer: the formula bends one way only, and the steps come in from there.
  const start = (s: number, strength: number): number => Math.sign(s) * Math.min(Math.abs(s) * (1 + strength), Math.max(1, Math.abs(s)));
  let px = start(x, kx);
  let py = start(y, ky);
  for (let i = 0; i < STEPS; i++) {
    const g = 1 + kx * px * px + ky * py * py;
    const fx = (px * g) / (1 + kx) - x;
    const fy = (py * g) / (1 + ky) - y;
    const xx = (g + 2 * kx * px * px) / (1 + kx);
    const xy = (2 * ky * px * py) / (1 + kx);
    const yx = (2 * kx * px * py) / (1 + ky);
    const yy = (g + 2 * ky * py * py) / (1 + ky);
    const det = xx * yy - xy * yx;
    if (!(Math.abs(det) > 1e-12)) break;
    const dx = (fx * yy - fy * xy) / det;
    const dy = (fy * xx - fx * yx) / det;
    px -= dx;
    py -= dy;
    if (Math.abs(dx) < CLOSE && Math.abs(dy) < CLOSE) break;
  }
  return { x: px, y: py };
}

/**
 * A lens over a rectangle - the part of a layer a scene was drawn to. Points of the rectangle
 * are fractions of it, from its left and its bottom.
 */
export interface Lens {
  /** Where the centre of the lens stands on screen. */
  centre: Point;
  /** The point of the layer that is shown there. */
  from: Point;
  k: LensStrength;
}

/** A coordinate from a centre, 1 at the edge of the rectangle on its side. */
function fromCentre(value: number, centre: number): number {
  const reach = value < centre ? centre : 1 - centre;
  return reach > 0 ? (value - centre) / reach : 0;
}

/** And back: a fraction of the rectangle. */
function toFraction(value: number, centre: number): number {
  return centre + value * (value < 0 ? centre : 1 - centre);
}

/** Which point of the layer the point (u, v) of the screen shows. */
export function lensFrom(lens: Lens, u: number, v: number): Point {
  const p = lensInverse(fromCentre(u, lens.centre.x), fromCentre(v, lens.centre.y), lens.k);
  return { x: toFraction(p.x, lens.from.x), y: toFraction(p.y, lens.from.y) };
}

/** Where on the screen the point (u, v) of the layer is shown. */
export function lensTo(lens: Lens, u: number, v: number): Point {
  const p = lensForward(fromCentre(u, lens.from.x), fromCentre(v, lens.from.y), lens.k);
  return { x: toFraction(p.x, lens.centre.x), y: toFraction(p.y, lens.centre.y) };
}

/**
 * The same in a shader. `lensUv` gives the point of a layer that the point `uv` of the screen
 * shows through a lens over the part `area` of it (left, bottom, right, top); `centre` and
 * `from` are fractions of that part, `k` is the strength to the left, the right, the bottom
 * and the top.
 */
export const LENS_GLSL = /* glsl */ `
vec2 lensSource(vec2 p, vec2 k) {
  return p * (1.0 + dot(k, p * p)) / (1.0 + k);
}

vec2 lensUv(vec2 uv, vec4 area, vec2 centre, vec2 from, vec4 k) {
  vec2 size = area.zw - area.xy;
  vec2 d = (uv - area.xy) / size - centre;
  vec2 side = step(0.0, d);
  vec2 reach = max(mix(centre, 1.0 - centre, side), 1e-6);
  vec2 room = mix(from, 1.0 - from, side);
  vec2 p = lensSource(d / reach, max(mix(k.xz, k.yw, side), 0.0));
  return area.xy + (from + p * room) * size;
}
`;
