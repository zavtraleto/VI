import { describe, expect, it } from 'vitest';
import { paintStar, paintStarGhost, starReach, starRow, starShape, starTones, type StarKit } from './star';

const COLOURS = { core: '#fbfff2', light: '#9fd8ff', deep: '#3d49f0' };

/** A kit that draws nothing and keeps how far from a point everything it was asked to draw reaches. */
function recorder(cx: number, cy: number): { kit: StarKit; reach: () => number; count: () => number } {
  let far = 0;
  let drawn = 0;
  const note = (x: number, y: number, w: number, h: number): void => {
    drawn++;
    far = Math.max(far, Math.abs(x - cx), Math.abs(x + w - 1 - cx), Math.abs(y - cy), Math.abs(y + h - 1 - cy));
  };
  const kit: StarKit = {
    rect: (x, y, w, h) => note(x, y, w, h),
    light: (x, y, w, h, _color, alpha) => {
      if (alpha > 0) note(x, y, w, h);
    },
    halo: (x, y, radius, _color, alpha) => {
      if (alpha > 0) note(Math.round(x - radius), Math.round(y - radius), Math.round(radius * 2), Math.round(radius * 2));
    },
  };
  return { kit, reach: () => far, count: () => drawn };
}

describe('the shape of a star', () => {
  it('has a point straight up, is the same on both sides, and keeps inside its radius', () => {
    for (const radius of [4, 9, 15, 22]) {
      const { runs } = starShape(radius);
      const dots = new Set<string>();
      for (const run of runs) for (let i = 0; i < run.w; i++) dots.add(`${run.x + i},${run.y}`);
      const top = Math.min(...runs.map((run) => run.y));
      expect(top).toBeLessThanOrEqual(-radius + 1);
      expect(dots.has(`0,${top}`)).toBe(true);
      for (const key of dots) {
        const [x, y] = key.split(',').map(Number);
        expect(Math.hypot(x, y)).toBeLessThanOrEqual(radius + 0.01);
        expect(dots.has(`${-x},${y}`)).toBe(true);
      }
      // Five points and the hollows between them: a good deal less than the disc it stands in.
      expect(dots.size).toBeLessThan(Math.PI * radius * radius * 0.55);
      expect(dots.size).toBeGreaterThan(Math.PI * radius * radius * 0.2);
    }
  });

  it('has a rim, and dots just outside it that are no part of it', () => {
    const { runs, rim, blur } = starShape(15);
    const dots = new Set<string>();
    for (const run of runs) for (let i = 0; i < run.w; i++) dots.add(`${run.x + i},${run.y}`);
    expect(rim.length).toBeGreaterThan(40);
    for (const dot of rim) expect(dots.has(`${dot.x},${dot.y}`)).toBe(true);
    expect(blur.length).toBeGreaterThan(40);
    for (const dot of blur) expect(dots.has(`${dot.x},${dot.y}`)).toBe(false);
  });

  it('is white at the heart and of two blues at the tips', () => {
    const tones = starTones(COLOURS);
    const { runs } = starShape(15);
    const at = (x: number, y: number): string => tones[runs.find((run) => run.y === y && x >= run.x && x < run.x + run.w)!.tone];
    expect(at(0, 0)).toBe(COLOURS.core);
    expect(new Set(runs.map((run) => tones[run.tone])).size).toBeGreaterThan(6);
    for (const tone of tones) expect(tone).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('a star as it is drawn', () => {
  it('lights nothing further than its reach, at rest or at the height of its burst', () => {
    for (const radius of [4, 12, 22]) {
      for (const glow of [{ flare: 0, shimmer: 0 }, { flare: 1, shimmer: 1 }, { flare: 0.4, shimmer: -1 }]) {
        const { kit, reach, count } = recorder(100, 100);
        paintStar(kit, 100, 100, radius, COLOURS, glow);
        expect(count()).toBeGreaterThan(20);
        expect(reach()).toBeLessThanOrEqual(starReach(radius));
      }
    }
  });

  it('has more light at its burst than at rest', () => {
    const rest = recorder(0, 0);
    const burst = recorder(0, 0);
    paintStar(rest.kit, 0, 0, 15, COLOURS, { flare: 0, shimmer: 0 });
    paintStar(burst.kit, 0, 0, 15, COLOURS, { flare: 1, shimmer: 0 });
    expect(burst.reach()).toBeGreaterThan(rest.reach());
  });

  it('is an outline with no glow where it is not held', () => {
    const { kit, reach, count } = recorder(50, 50);
    paintStarGhost(kit, 50, 50, 15, COLOURS);
    expect(count()).toBeGreaterThan(80);
    expect(reach()).toBeLessThanOrEqual(17);
  });
});

describe('the row of the three stars', () => {
  it('takes no more than three quarters of the picture, and is larger on a larger one', () => {
    for (const width of [150, 180, 240, 270, 360, 640]) {
      const { radius, gap, wide } = starRow(width);
      expect(wide).toBe(3 * (2 * radius + 1) + 2 * gap);
      expect(wide).toBeLessThanOrEqual(width * 0.75);
      expect(radius).toBeGreaterThanOrEqual(8);
    }
    expect(starRow(270).radius).toBeGreaterThan(starRow(180).radius);
    expect(starRow(640).radius).toBe(22);
  });
});
