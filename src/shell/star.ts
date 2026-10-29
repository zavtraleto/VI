import type { Kit } from './kit';
import { mixHex } from './theme';

/**
 * The star of a level that is passed, as it is drawn over the board: a thing of five points cut
 * in facets, white at the heart and cold blue to the tips, that gives light - a glow around it
 * and long thin rays. It is drawn in whole dots of the picture, as everything of the program is,
 * and its light in steps: the tube runs them together. Nothing here reads a clock or the page.
 */

/** The three colours a star is made of: its white heart, the pale light of its facets, the deep blue of those turned away. */
export interface StarColours {
  core: string;
  light: string;
  deep: string;
}

/** What of a kit a star is drawn with. */
export type StarKit = Pick<Kit, 'rect' | 'light' | 'halo'>;

/** A row of dots of one tone, from the middle of the star: `tone` is a place in `starTones`. */
interface Run {
  x: number;
  y: number;
  w: number;
  tone: number;
}

/** The inner corners of the star stand this far from its middle, in shares of its radius. */
const INNER = 0.4;
/** The white of the heart reaches this far, in shares of the radius, and falls off in this many steps. */
const HEART = 0.5;
const HEART_STEPS = 4;
/** Tones: two facets, by the steps of the heart, and the bright line of the edge of each. */
const TONES = 2 * (HEART_STEPS + 1) * 2;

const toneOf = (facet: number, heart: number, edge: boolean): number => (facet * (HEART_STEPS + 1) + heart) * 2 + (edge ? 1 : 0);

/** The ten corners of a star of radius 1 with a point straight up, tips and inner corners by turns, y growing downwards. */
function corners(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 1 : INNER;
    const a = (i * Math.PI) / 5;
    out.push({ x: Math.sin(a) * r, y: -Math.cos(a) * r });
  }
  return out;
}

const CORNERS = corners();

/** Where a dot stands in the star: outside it (null), or in which facet, how near the heart, and whether on the edge. */
function dotAt(dx: number, dy: number, radius: number): { facet: number; heart: number; edge: boolean } | null {
  const x = dx / radius;
  const y = dy / radius;
  let turn = Math.atan2(x, -y);
  if (turn < 0) turn += Math.PI * 2;
  const sector = Math.min(9, Math.floor(turn / (Math.PI / 5)));
  const a = CORNERS[sector];
  const b = CORNERS[(sector + 1) % 10];
  // How far inside the side of the star this sector ends with, in dots.
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const inside = (((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)) / length) * radius;
  if (inside < 0) return null;
  const far = Math.hypot(x, y) / HEART;
  const heart = Math.max(0, Math.min(HEART_STEPS, Math.ceil((1 - far) * HEART_STEPS)));
  return { facet: sector % 2, heart, edge: inside < 1 };
}

const shapes = new Map<number, { runs: Run[]; rim: { x: number; y: number }[]; blur: { x: number; y: number }[] }>();

/**
 * A star of `radius` dots as rows of one tone, the dots of its rim, and the dots just outside
 * the rim, for an outline that is smeared. Worked out once for a radius and kept.
 */
export function starShape(radius: number): { runs: Run[]; rim: { x: number; y: number }[]; blur: { x: number; y: number }[] } {
  const r = Math.max(2, Math.round(radius));
  const kept = shapes.get(r);
  if (kept) return kept;
  const runs: Run[] = [];
  const rim: { x: number; y: number }[] = [];
  const within = new Set<string>();
  for (let y = -r; y <= r; y++) {
    let run: Run | null = null;
    for (let x = -r; x <= r; x++) {
      const dot = dotAt(x, y, r);
      if (!dot) {
        run = null;
        continue;
      }
      within.add(`${x},${y}`);
      if (dot.edge) rim.push({ x, y });
      const tone = toneOf(dot.facet, dot.heart, dot.edge);
      if (run && run.tone === tone) run.w++;
      else {
        run = { x, y, w: 1, tone };
        runs.push(run);
      }
    }
  }
  const blur: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const dot of rim) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${dot.x + dx},${dot.y + dy}`;
      if (within.has(key) || seen.has(key)) continue;
      seen.add(key);
      blur.push({ x: dot.x + dx, y: dot.y + dy });
    }
  }
  const shape = { runs, rim, blur };
  shapes.set(r, shape);
  return shape;
}

const palettes = new Map<string, string[]>();

/** The colour of every tone of a star, for its three colours: worked out once for them and kept. */
export function starTones(colours: StarColours): string[] {
  const key = `${colours.core}|${colours.light}|${colours.deep}`;
  const kept = palettes.get(key);
  if (kept) return kept;
  const tones: string[] = new Array(TONES);
  // The facet turned to the light is pale, nearly white; the one turned away is the blue between the light and the deep.
  const facets = [mixHex(colours.light, colours.core, 0.12), mixHex(colours.light, colours.deep, 0.72)];
  for (let facet = 0; facet < 2; facet++) {
    for (let heart = 0; heart <= HEART_STEPS; heart++) {
      const body = mixHex(facets[facet], colours.core, heart / HEART_STEPS);
      tones[toneOf(facet, heart, false)] = body;
      tones[toneOf(facet, heart, true)] = mixHex(body, colours.core, 0.75);
    }
  }
  palettes.set(key, tones);
  return tones;
}

/** How the light of a star stands at a moment: `flare` 0 to 1 is the burst it comes on with, `shimmer` -1 to 1 its slow breathing. */
export interface StarGlow {
  flare: number;
  shimmer: number;
}

/** The light around a star: from this many radii out, to this many, in this many steps. */
const GLOW_FAR = 1.75;
const GLOW_NEAR = 0.9;
const GLOW_STEPS = 10;

/** The long rays of a star reach this many radii from its middle at rest; the short ones between them, this share of that. */
const RAY = 1.9;
const RAY_SHORT = 0.5;

/** How far from its middle a star lights the picture, in dots: its longest ray at the height of its burst. */
export function starReach(radius: number): number {
  return Math.ceil(radius * RAY * 1.15 * 1.8) + 1;
}

/**
 * Draws a star that is lit, its middle at `cx, cy`: the glow under it, the star, and over it the
 * rays and the heat of the heart.
 */
export function paintStar(kit: StarKit, cx: number, cy: number, radius: number, colours: StarColours, glow: StarGlow = { flare: 0, shimmer: 0 }): void {
  const r = Math.max(2, Math.round(radius));
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const flare = Math.max(0, Math.min(1, glow.flare));
  const breath = 1 + 0.15 * Math.max(-1, Math.min(1, glow.shimmer));
  const strong = breath * (1 + 0.8 * flare);
  // The light around: thin discs one in another, each a little of the colour, so that it grows towards the star in
  // many small steps and no ring of it is seen; the deep blue widest, the pale light nearest.
  for (let i = 0; i < GLOW_STEPS; i++) {
    const share = i / (GLOW_STEPS - 1);
    kit.halo(x0 + 0.5, y0, r * (GLOW_FAR - (GLOW_FAR - GLOW_NEAR) * share) * strong, share < 0.5 ? colours.deep : colours.light, 0.03 + 0.035 * share);
  }
  const tones = starTones(colours);
  for (const run of starShape(r).runs) kit.rect(x0 + run.x, y0 + run.y, run.w, 1, tones[run.tone]);
  // The rays: four long, up, down and to the sides, and four short between them; each a line a dot wide that goes out.
  const long = Math.round(r * RAY * strong);
  const ray = (dx: number, dy: number, length: number, most: number): void => {
    for (let i = 1; i <= length; i++) {
      const left = 1 - i / (length + 1);
      kit.light(x0 + dx * i, y0 + dy * i, 1, 1, colours.core, most * left * left);
    }
  };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ray(dx, dy, long, 0.75);
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) ray(dx, dy, Math.round(long * RAY_SHORT * 0.7), 0.4);
  // The heart is hotter than the facets show: white over them, and all of the star at the height of its burst.
  kit.halo(x0 + 0.5, y0, r * 0.45 * breath, colours.core, 0.35 + 0.25 * flare);
  kit.halo(x0 + 0.5, y0, r * 0.22, colours.core, 0.6);
  if (flare > 0) kit.halo(x0 + 0.5, y0, r * 1.05, colours.core, 0.5 * flare);
}

/** Draws a star that is not held: its outline alone, dull and smeared, with no light. */
export function paintStarGhost(kit: StarKit, cx: number, cy: number, radius: number, colours: StarColours): void {
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const shape = starShape(radius);
  for (const dot of shape.blur) kit.light(x0 + dot.x, y0 + dot.y, 1, 1, colours.deep, 0.14);
  for (const dot of shape.rim) kit.light(x0 + dot.x, y0 + dot.y, 1, 1, colours.light, 0.2);
  // Smeared sideways too, as a thing the tube has not caught.
  for (const dot of shape.rim) kit.light(x0 + dot.x + 1, y0 + dot.y, 1, 1, colours.deep, 0.1);
}

/**
 * A small star, as a cell of the list of the levels and a result have them: the same star cut in
 * facets, but with no light of its own - neither glow nor rays nor the heat of the heart. One that
 * is `held` is filled with its facets; one that is not is its outline alone, as `paintStarGhost` has it.
 */
export function paintStarSmall(kit: StarKit, cx: number, cy: number, radius: number, colours: StarColours, held: boolean): void {
  if (!held) {
    paintStarGhost(kit, cx, cy, radius, colours);
    return;
  }
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const tones = starTones(colours);
  for (const run of starShape(radius).runs) kit.rect(x0 + run.x, y0 + run.y, run.w, 1, tones[run.tone]);
}

/** How large the stars of a pass are and how far apart, for a picture `width` dots wide: three of them and their gaps take no more than three quarters of it. */
export function starRow(width: number): { radius: number; gap: number; wide: number } {
  let radius = Math.max(8, Math.min(22, Math.round(width * 0.085)));
  const row = (r: number): { radius: number; gap: number; wide: number } => {
    const gap = Math.max(4, Math.round(r * 0.5));
    return { radius: r, gap, wide: 3 * (2 * r + 1) + 2 * gap };
  };
  while (radius > 4 && row(radius).wide > width * 0.75) radius--;
  return row(radius);
}
