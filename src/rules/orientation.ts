import type { Dir, Orientation } from './types';

export const CANONICAL: Orientation = { top: 1, bottom: 6, north: 2, south: 5, east: 3, west: 4 };

/** Orientation after rolling one cell in `dir`. The two faces on the roll axis stay put. */
export function roll(o: Orientation, dir: Dir): Orientation {
  switch (dir) {
    case 'N':
      return { ...o, top: o.south, bottom: o.north, north: o.top, south: o.bottom };
    case 'S':
      return { ...o, top: o.north, bottom: o.south, south: o.top, north: o.bottom };
    case 'E':
      return { ...o, top: o.west, bottom: o.east, east: o.top, west: o.bottom };
    case 'W':
      return { ...o, top: o.east, bottom: o.west, west: o.top, east: o.bottom };
  }
}

export function orientationKey(o: Orientation): string {
  return `${o.top}${o.bottom}${o.north}${o.south}${o.east}${o.west}`;
}

function buildAll(): Orientation[] {
  const seen = new Map<string, Orientation>();
  const queue: Orientation[] = [CANONICAL];
  seen.set(orientationKey(CANONICAL), CANONICAL);
  while (queue.length > 0) {
    const o = queue.shift()!;
    for (const dir of ['N', 'S', 'E', 'W'] as const) {
      const next = roll(o, dir);
      const key = orientationKey(next);
      if (!seen.has(key)) {
        seen.set(key, next);
        queue.push(next);
      }
    }
  }
  return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, o]) => o);
}

/** The 24 spatial orientations of the canonical die, in a stable order. */
export const ALL_ORIENTATIONS: readonly Orientation[] = buildAll();

export function orientationsWithTop(top: number): Orientation[] {
  return ALL_ORIENTATIONS.filter((o) => o.top === top);
}
