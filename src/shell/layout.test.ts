import { describe, expect, it } from 'vitest';
import { CANONICAL } from '../rules/orientation';
import {
  CELL_W,
  MIN_ZONE,
  NET,
  markNodes,
  menuLayout,
  netProjection,
  netStep,
  pictureSize,
  signPlaces,
  textWidth,
  type Box,
  type MenuLayout,
  type NetView,
} from './layout';

const noInsets = { top: 0, right: 0, bottom: 0, left: 0 };
/** A phone held upright and a desktop window, as canvases of a pixel and a half per CSS pixel. */
const phoneCanvas = { width: 562, height: 1218 };
const desktopCanvas = { width: 1920, height: 1080 };
const view: NetView = { yaw: 32, pitch: 44, gap: 1.4, fill: 0.86 };

function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function inside(inner: Box, outer: Box): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

function blocks(layout: MenuLayout): Box[] {
  return [layout.subject, layout.space, layout.record, layout.status].filter((box): box is Box => box !== null);
}

describe('pictureSize', () => {
  it('makes a pixel of the picture a whole number of pixels of the canvas', () => {
    expect(pictureSize(phoneCanvas, 280, 360)).toEqual({ width: 281, height: 609 });
    expect(pictureSize(desktopCanvas, 280, 360)).toEqual({ width: 640, height: 360 });
    expect(pictureSize({ width: 1280, height: 720 }, 280, 360)).toEqual({ width: 640, height: 360 });
  });

  it('never asks for more pixels than the canvas has', () => {
    expect(pictureSize({ width: 200, height: 300 }, 280, 360)).toEqual({ width: 200, height: 300 });
  });
});

describe('textWidth', () => {
  it('gives Latin and the Cyrillic of the program one place and everything else two', () => {
    expect(textWidth('VI 07')).toBe(5 * CELL_W);
    expect(textWidth('記録')).toBe(4 * CELL_W);
    expect(textWidth('ЖУРНАЛ')).toBe(6 * CELL_W);
    expect(textWidth('TÜRKÇE İŞ')).toBe(9 * CELL_W);
    expect(textWidth('ｾﾂｿﾞｸ')).toBe(5 * CELL_W);
    expect(textWidth('VI', 2)).toBe(4 * CELL_W);
  });

  it('says where each sign of a mixed line stands', () => {
    expect(signPlaces('図1 展')).toEqual([0, 2, 3, 4]);
  });
});

describe('the net of a die', () => {
  it('has six faces in the shape of a cross', () => {
    expect(NET).toHaveLength(6);
    expect(new Set(NET.map((cell) => `${cell.col}/${cell.row}`)).size).toBe(6);
    expect(NET.filter((cell) => cell.col === 1)).toHaveLength(4);
  });

  it('never puts opposite faces side by side', () => {
    for (const [a, b] of [
      [1, 6],
      [2, 5],
      [3, 4],
    ]) {
      const from = NET[a - 1];
      const to = NET[b - 1];
      expect(Math.abs(from.col - to.col) + Math.abs(from.row - to.row)).toBe(2);
    }
  });

  it('is walked from face to face, and stops at its edges', () => {
    expect(netStep(1, 'up')).toBe(2);
    expect(netStep(1, 'left')).toBe(4);
    expect(netStep(1, 'right')).toBe(3);
    expect(netStep(1, 'down')).toBe(5);
    expect(netStep(5, 'down')).toBe(6);
    expect(netStep(6, 'up')).toBe(5);
    expect(netStep(2, 'up')).toBe(2);
    expect(netStep(2, 'left')).toBe(2);
    expect(netStep(3, 'right')).toBe(3);
    expect(netStep(6, 'down')).toBe(6);
  });

  it('is the die of the board unfolded: the one in the middle, its neighbours where they face', () => {
    const at = (face: number) => NET[face - 1];
    const one = at(CANONICAL.top);
    expect(at(CANONICAL.north)).toEqual({ col: one.col, row: one.row - 1 });
    expect(at(CANONICAL.south)).toEqual({ col: one.col, row: one.row + 1 });
    expect(at(CANONICAL.east)).toEqual({ col: one.col + 1, row: one.row });
    expect(at(CANONICAL.west)).toEqual({ col: one.col - 1, row: one.row });
  });
});

describe('menuLayout on a phone', () => {
  const picture = pictureSize(phoneCanvas, 280, 360);
  const zoom = 812 / picture.height;
  const layout = menuLayout(picture, noInsets, zoom);
  const whole: Box = { x: 0, y: 0, w: picture.width, h: picture.height };

  it('stacks the records and the dice without a gap between them being lost', () => {
    expect(layout.wide).toBe(false);
    const all = blocks(layout);
    expect(all).toHaveLength(4);
    for (const box of all) expect(inside(box, whole)).toBe(true);
    all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
    expect(layout.subject!.y).toBeLessThan(layout.space.y);
    expect(layout.space.y).toBeLessThan(layout.record.y);
    expect(layout.record.y).toBeLessThan(layout.status.y);
  });

  it('keeps the bar that runs a file inside its record and tall enough for a finger', () => {
    expect(inside(layout.exec, layout.record)).toBe(true);
    expect(layout.exec.h * zoom).toBeGreaterThanOrEqual(MIN_ZONE);
  });

  it('gives the dice the larger part of what is left', () => {
    expect(layout.space.h).toBeGreaterThan(200);
    expect(layout.legend).toBeNull();
  });

  it('lets the record of the subject go on a short screen', () => {
    const short = pictureSize({ width: 480, height: 720 }, 280, 360);
    const tight = menuLayout(short, noInsets, 480 / short.height);
    expect(tight.subject).toBeNull();
    expect(tight.space.h).toBeGreaterThan(100);
    expect(inside(tight.record, { x: 0, y: 0, w: short.width, h: short.height })).toBe(true);
  });

  it('leaves the edges the screen keeps to itself', () => {
    const inset = menuLayout(picture, { top: 35, right: 0, bottom: 26, left: 0 }, zoom);
    expect(inset.header.y).toBeGreaterThanOrEqual(35);
    expect(inset.status.y + inset.status.h).toBeLessThanOrEqual(picture.height - 26);
  });
});

describe('menuLayout on a wide screen', () => {
  const picture = pictureSize(desktopCanvas, 280, 360);
  const zoom = 720 / picture.height;
  const layout = menuLayout(picture, noInsets, zoom);
  const whole: Box = { x: 0, y: 0, w: picture.width, h: picture.height };

  it('puts the dice on the left and the records in a column on the right', () => {
    expect(layout.wide).toBe(true);
    const all = blocks(layout);
    expect(all).toHaveLength(4);
    for (const box of all) expect(inside(box, whole)).toBe(true);
    all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
    expect(layout.space.x + layout.space.w).toBeLessThan(layout.record.x);
    expect(layout.subject!.x).toBe(layout.record.x);
    expect(layout.status.x).toBe(layout.record.x);
  });

  it('names the keys at the bottom', () => {
    expect(layout.legend).not.toBeNull();
    expect(layout.legend!).toBeGreaterThanOrEqual(layout.status.y + layout.status.h);
    expect(layout.legend! + 16).toBeLessThanOrEqual(picture.height);
  });

  it('fits a phone held sideways, without the record of the subject', () => {
    const sideways = pictureSize({ width: 1218, height: 562 }, 280, 360);
    const tight = menuLayout(sideways, { top: 0, right: 30, bottom: 14, left: 30 }, 375 / sideways.height);
    const all = blocks(tight);
    expect(tight.subject).toBeNull();
    for (const box of all) expect(inside(box, { x: 0, y: 0, w: sideways.width, h: sideways.height })).toBe(true);
    all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
    expect(tight.exec.h * (375 / sideways.height)).toBeGreaterThanOrEqual(MIN_ZONE);
  });
});

describe('netProjection', () => {
  const box: Box = { x: 8, y: 136, w: 265, h: 265 };
  const projection = netProjection(box, view);

  it('keeps every die inside its part of the picture', () => {
    for (const point of [...projection.centres, ...projection.tops]) {
      expect(point.x).toBeGreaterThan(box.x);
      expect(point.x).toBeLessThan(box.x + box.w);
      expect(point.y).toBeGreaterThan(box.y);
      expect(point.y).toBeLessThan(box.y + box.h);
    }
  });

  it('puts the top of a die above its middle', () => {
    projection.centres.forEach((centre, i) => {
      expect(projection.tops[i].y).toBeLessThan(centre.y);
      expect(projection.tops[i].x).toBeCloseTo(centre.x);
    });
  });

  it('shows rows of the net further down the nearer they are', () => {
    const y = (face: number): number => projection.centres[face - 1].y;
    expect(y(2)).toBeLessThan(y(1));
    expect(y(1)).toBeLessThan(y(5));
    expect(y(5)).toBeLessThan(y(6));
    expect(projection.centres[3].x).toBeLessThan(projection.centres[0].x);
    expect(projection.centres[0].x).toBeLessThan(projection.centres[2].x);
  });

  it('gives the dice zones that do not share a point', () => {
    const zones = projection.centres.map((centre) => ({
      x: centre.x - projection.zone / 2,
      y: centre.y - projection.zone / 2,
      w: projection.zone * 0.999,
      h: projection.zone * 0.999,
    }));
    zones.forEach((a, i) => zones.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
    expect(projection.zone).toBeGreaterThan(24);
  });

  it('looks from where the camera of the picture will stand', () => {
    expect(projection.halfWidth * projection.unit * 2).toBeCloseTo(box.w);
    expect(projection.halfHeight * projection.unit * 2).toBeCloseTo(box.h);
  });
});

describe('markNodes', () => {
  it('stands six nodes as the six of a die', () => {
    const mark = markNodes(6, 'grid');
    expect(mark.points).toHaveLength(6);
    expect(mark.width).toBe(0.5);
    expect(new Set(mark.points.map((p) => p.x)).size).toBe(2);
    expect(new Set(mark.points.map((p) => p.y)).size).toBe(3);
    expect(new Set(mark.points.map((p) => `${p.x}/${p.y}`)).size).toBe(6);
  });

  it('keeps every node inside the box of the mark', () => {
    for (const arrangement of ['grid', 'ring', 'row'] as const) {
      for (const count of [1, 2, 3, 6, 9]) {
        const mark = markNodes(count, arrangement);
        expect(mark.points).toHaveLength(count);
        for (const point of mark.points) {
          expect(point.x).toBeGreaterThanOrEqual(-1e-9);
          expect(point.x).toBeLessThanOrEqual(mark.width + 1e-9);
          expect(point.y).toBeGreaterThanOrEqual(-1e-9);
          expect(point.y).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });
});
