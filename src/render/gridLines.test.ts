import { describe, expect, it } from 'vitest';
import { cellShare, drawnShare, farthest, gridSegments, waveFrom, type GridSegment } from './gridLines';

/** Every cell of a square but those named: the cells cut out of it. */
function holesBut(size: number, kept: readonly [x: number, z: number][]): { x: number; z: number }[] {
  const holes: { x: number; z: number }[] = [];
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) if (!kept.some(([kx, kz]) => kx === x && kz === z)) holes.push({ x, z });
  }
  return holes;
}

/** A side by its two ends, whichever way it is directed. */
const key = (s: GridSegment): string => {
  const a = `${s.ax},${s.az}`;
  const b = `${s.bx},${s.bz}`;
  return a < b ? `${a}-${b}` : `${b}-${a}`;
};

const side = (segments: GridSegment[], ax: number, az: number, bx: number, bz: number): GridSegment => {
  const wanted = key({ ax, az, bx, bz, edge: false, reach: 0 });
  const found = segments.find((s) => key(s) === wanted);
  if (!found) throw new Error(`no side ${wanted}`);
  return found;
};

describe('the sides of the cells of a board', () => {
  it('a board of one cell has four, all of them its edge', () => {
    const segments = gridSegments(1, []);
    expect(segments).toHaveLength(4);
    expect(segments.every((s) => s.edge)).toBe(true);
  });

  it('a strip of three cells has ten, eight of them its edge', () => {
    const segments = gridSegments(3, holesBut(3, [[1, 0], [1, 1], [1, 2]]));
    expect(segments).toHaveLength(10);
    expect(segments.filter((s) => s.edge)).toHaveLength(8);
  });

  it('a board of three by three has twenty-four, twelve of them its edge', () => {
    const segments = gridSegments(3, []);
    expect(segments).toHaveLength(24);
    expect(segments.filter((s) => s.edge)).toHaveLength(12);
  });

  it('names no side twice, and every side is one cell long', () => {
    const segments = gridSegments(4, [{ x: 1, z: 1 }, { x: 3, z: 0 }]);
    expect(new Set(segments.map(key)).size).toBe(segments.length);
    for (const s of segments) expect(Math.abs(s.bx - s.ax) + Math.abs(s.bz - s.az)).toBe(1);
  });

  it('the sides of a cell that is cut out are the edge of the cells around it', () => {
    const segments = gridSegments(3, [{ x: 1, z: 1 }]);
    expect(segments).toHaveLength(24);
    expect(segments.filter((s) => s.edge)).toHaveLength(16);
    expect(side(segments, 1, 1, 2, 1).edge).toBe(true);
  });
});

describe('the wave from a cell', () => {
  it('from a corner reaches further and further, up to the far corner, and leaves no side out', () => {
    const wave = waveFrom(gridSegments(3, []), { x: 0, z: 0 });
    expect(wave).toHaveLength(24);
    for (const s of wave) expect(Number.isInteger(s.reach) && s.reach >= 0).toBe(true);
    // The four sides of the cell it starts from come first.
    expect(wave.filter((s) => s.reach === 0).map(key).sort()).toEqual(['0,0-0,1', '0,0-1,0', '0,1-1,1', '1,0-1,1']);
    // Then the sides that leave its corners, and so on along the lines: the far corner is four steps on.
    expect(wave.filter((s) => s.reach === 1).map(key).sort()).toEqual(['0,1-0,2', '1,0-2,0', '1,1-1,2', '1,1-2,1']);
    expect(farthest(wave)).toBe(4);
    expect(wave.filter((s) => s.reach === 4).map(key).sort()).toEqual(['2,3-3,3', '3,2-3,3']);
    expect(side(wave, 2, 1, 2, 2).reach).toBe(2);
    expect(side(wave, 3, 0, 3, 1).reach).toBe(3);
  });

  it('begins no side before the drawing has come to one of its ends', () => {
    for (const from of [{ x: 0, z: 0 }, { x: 2, z: 4 }, { x: 3, z: 1 }]) {
      const wave = waveFrom(gridSegments(5, [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 4, z: 4 }, { x: 2, z: 2 }]), from);
      for (const s of wave) {
        if (s.reach === 0) continue;
        // A side that ends at its nearer end, and is whole by the time this one begins.
        const before = wave.filter((o) => o !== s && o.reach < s.reach && ((o.bx === s.ax && o.bz === s.az) || (o.reach === 0 && o.ax === s.ax && o.az === s.az)));
        expect(before.length, `${key(s)} from ${from.x},${from.z}`).toBeGreaterThan(0);
      }
    }
  });

  it('directs every side from its nearer end to its farther one', () => {
    const wave = waveFrom(gridSegments(3, []), { x: 0, z: 0 });
    const far = (x: number, z: number): number => Math.hypot(x - 0.5, z - 0.5);
    for (const s of wave) expect(far(s.ax, s.az), key(s)).toBeLessThanOrEqual(far(s.bx, s.bz) + 1e-9);
    // Along a line of the board the point runs on from one side to the next.
    const first = side(wave, 1, 1, 1, 2);
    const second = side(wave, 1, 2, 1, 3);
    expect([first.ax, first.az, first.bx, first.bz]).toEqual([1, 1, 1, 2]);
    expect([second.ax, second.az, second.bx, second.bz]).toEqual([1, 2, 1, 3]);
    expect(second.reach).toBe(first.reach + 1);
  });

  it('runs around the cell it starts from one way', () => {
    const wave = waveFrom(gridSegments(3, []), { x: 1, z: 1 }).filter((s) => s.reach === 0);
    // North side to the east, east side to the south, south side to the west, west side to the north.
    expect(wave.map((s) => [s.ax, s.az, s.bx, s.bz].join()).sort()).toEqual(['1,1,2,1', '1,2,1,1', '2,1,2,2', '2,2,1,2']);
  });

  it('leaves the sides it was given as they were', () => {
    const plain = gridSegments(3, []);
    const before = JSON.stringify(plain);
    waveFrom(plain, { x: 2, z: 2 });
    expect(JSON.stringify(plain)).toBe(before);
  });

  it('goes by the lines of the board: two parts joined by one cell are both reached, the long way round', () => {
    // Two blocks two cells wide and five tall, with one cell between them in the middle row.
    const holes = [0, 1, 3, 4].map((z) => ({ x: 2, z }));
    const wave = waveFrom(gridSegments(5, holes), { x: 0, z: 0 });
    for (const s of wave) expect(Number.isFinite(s.reach)).toBe(true);
    // The way to the other part is over the cell between them.
    expect(side(wave, 2, 2, 3, 2).reach).toBe(3);
    // The near side of the other part is across a cut two cells from the start, and is come to from below, five steps on.
    const near = side(wave, 3, 0, 3, 1);
    expect(near.reach).toBe(5);
    expect([near.ax, near.az]).toEqual([3, 1]);
    expect(side(wave, 5, 0, 5, 1).reach).toBe(7);
    expect(farthest(wave)).toBe(8);
    expect(wave.filter((s) => s.reach === 8).map(key).sort()).toEqual(['4,5-5,5', '5,4-5,5']);
  });

  it('goes on over a corner two cells share', () => {
    const wave = waveFrom(gridSegments(2, [{ x: 1, z: 0 }, { x: 0, z: 1 }]), { x: 0, z: 0 });
    expect(wave).toHaveLength(8);
    expect([0, 1, 2].map((reach) => wave.filter((s) => s.reach === reach).length)).toEqual([4, 2, 2]);
  });

  it('a part no line leads to comes after everything else', () => {
    const wave = waveFrom(gridSegments(3, holesBut(3, [[0, 0], [1, 0], [2, 2]])), { x: 0, z: 0 });
    expect(wave).toHaveLength(11);
    expect(farthest(wave)).toBe(3);
    expect(wave.filter((s) => s.reach === 3).map(key).sort()).toEqual(['2,2-2,3', '2,2-3,2', '2,3-3,3', '3,2-3,3']);
  });

  it('from a cell that is not of the board starts at the corner nearest to it', () => {
    const wave = waveFrom(gridSegments(2, []), { x: 5, z: 5 });
    expect(wave.filter((s) => s.reach === 0).map(key).sort()).toEqual(['1,2-2,2', '2,1-2,2']);
    expect(farthest(wave)).toBe(3);
  });
});

describe('how much of a side is drawn', () => {
  it('the nearest sides are being drawn at once, the farthest not yet', () => {
    expect(drawnShare(0, 4, 0.1)).toBeGreaterThan(0);
    expect(drawnShare(0, 4, 0.1)).toBeLessThan(1);
    expect(drawnShare(4, 4, 0.1)).toBe(0);
  });

  it('nothing is drawn at 0 and everything at 1', () => {
    for (const reach of [0, 1, 2, 3, 4]) {
      expect(drawnShare(reach, 4, 0)).toBe(0);
      expect(drawnShare(reach, 4, 1)).toBe(1);
    }
    expect(drawnShare(0, 0, 1)).toBe(1);
  });

  it('a side takes one part of the wave to draw, and the farthest ends with the wave', () => {
    // Five parts for sides 0 to 4 cells away: the side two cells away is drawn from 0.4 to 0.6.
    expect(drawnShare(2, 4, 0.4)).toBe(0);
    expect(drawnShare(2, 4, 0.5)).toBeCloseTo(0.5);
    expect(drawnShare(2, 4, 0.6)).toBeCloseTo(1);
    expect(drawnShare(4, 4, 0.9)).toBeCloseTo(0.5);
  });

  it('says the share at which the cell the wave starts from stands alone', () => {
    const share = cellShare(4);
    expect(drawnShare(0, 4, share)).toBeCloseTo(1);
    expect(drawnShare(1, 4, share)).toBeCloseTo(0);
    expect(cellShare(0)).toBe(1);
  });
});
