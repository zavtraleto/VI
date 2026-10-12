import { describe, expect, it } from 'vitest';
import { pickCell, reachOf, type CellPoint } from './cellPick';

/** A board of three by three seen from a slant: a step east is 40 right and 20 down, a step south 40 left and 20 down. */
const points: CellPoint[] = [];
for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) points.push({ x, z, px: 200 + x * 40 - z * 40, py: 100 + x * 20 + z * 20 });

describe('pickCell', () => {
  const reach = reachOf(points);
  it('takes the cell whose middle is nearest the point', () => {
    expect(pickCell(points, { px: 200, py: 100 }, reach)).toEqual({ x: 0, z: 0 });
    expect(pickCell(points, { px: 243, py: 118 }, reach)).toEqual({ x: 1, z: 0 });
    expect(pickCell(points, { px: 200, py: 135 }, reach)).toEqual({ x: 1, z: 1 });
  });
  it('takes none where the point is off the board', () => {
    expect(pickCell(points, { px: 200, py: 40 }, reach)).toBeNull();
    expect(pickCell(points, { px: 400, py: 100 }, reach)).toBeNull();
    expect(pickCell([], { px: 0, py: 0 }, 10)).toBeNull();
  });
  it('reaches a little over half way to the cell beside it', () => {
    expect(reach).toBeCloseTo(Math.hypot(40, 20) * 0.6);
    expect(reachOf([points[0]])).toBe(0);
  });
});
