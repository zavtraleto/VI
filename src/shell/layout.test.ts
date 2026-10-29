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
  zoneOf,
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
  return [layout.header.box, layout.subject, layout.space, layout.record].filter((box): box is Box => box !== null);
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

describe('zoneOf', () => {
  const phone = 640 / 480;
  const desk = 3;

  it('grows a button a field that is not drawn to what a finger needs, as much above as below', () => {
    expect(zoneOf({ x: 8, y: 100, w: 238, h: 24 }, phone)).toEqual({ x: 8, y: 94, w: 238, h: 36 });
    expect(zoneOf({ x: 8, y: 100, w: 238, h: 24 }, phone).h * phone).toBeGreaterThanOrEqual(MIN_ZONE);
  });

  it('grows a square button across too', () => {
    expect(zoneOf({ x: 100, y: 100, w: 24, h: 24 }, phone)).toEqual({ x: 94, y: 94, w: 36, h: 36 });
  });

  it('leaves a button as it is where it is tall enough: a desk, and a cell a finger high', () => {
    expect(zoneOf({ x: 8, y: 100, w: 248, h: 24 }, desk)).toEqual({ x: 8, y: 100, w: 248, h: 24 });
    expect(zoneOf({ x: 8, y: 100, w: 36, h: 36 }, phone)).toEqual({ x: 8, y: 100, w: 36, h: 36 });
  });

  it('lets two buttons a gap of the grid apart reach over each other by no more than a step of it', () => {
    const one = zoneOf({ x: 8, y: 100, w: 238, h: 24 }, phone);
    const next = zoneOf({ x: 8, y: 132, w: 238, h: 24 }, phone);
    expect(one.y + one.h - next.y).toBe(4);
  });
});

describe('textWidth', () => {
  it('gives a drawn letter its own width and a dot after it, a figure seven dots, and anything else one place or two', () => {
    expect(textWidth('I')).toBe(3);
    expect(textWidth('Ж')).toBe(11);
    expect(textWidth('0123456789')).toBe(70);
    expect(textWidth('VI 07')).toBe(8 + 3 + 6 + 7 + 7);
    expect(textWidth('記録')).toBe(4 * CELL_W);
    expect(textWidth('ｾﾂｿﾞｸ')).toBe(5 * CELL_W);
    expect(textWidth('VI', 2)).toBe(22);
  });

  it('says where each sign of a mixed line stands, in pixels of the picture', () => {
    expect(signPlaces('図1 展')).toEqual([0, 16, 23, 29]);
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
    expect(netStep(1, 'left')).toBe(3);
    expect(netStep(1, 'right')).toBe(4);
    expect(netStep(1, 'down')).toBe(5);
    expect(netStep(5, 'down')).toBe(6);
    expect(netStep(6, 'up')).toBe(5);
    expect(netStep(2, 'up')).toBe(2);
    expect(netStep(2, 'left')).toBe(2);
    expect(netStep(3, 'left')).toBe(3);
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
  /** 360 by 640 CSS pixels at three canvas pixels to one: a picture of 270 by 480. */
  const picture = pictureSize({ width: 1080, height: 1920 }, 280, 360);
  const zoom = 640 / picture.height;
  const layout = menuLayout(picture, noInsets);
  const whole: Box = { x: 0, y: 0, w: picture.width, h: picture.height };

  it('is a picture of 270 by 480', () => {
    expect(picture).toEqual({ width: 270, height: 480 });
  });

  it('has a header of two lines and a rule under it', () => {
    expect(layout.header).toEqual({ box: { x: 8, y: 0, w: 254, h: 45 }, y: 8, second: 24, left: 8, right: 262, rule: 44 });
  });

  it('keeps the record at the bottom and gives the dice everything between it and the header', () => {
    expect(layout.wide).toBe(false);
    expect(layout.subject).toBeNull();
    expect(layout.record).toEqual({ x: 8, y: 322, w: 254, h: 150 });
    expect(layout.space).toEqual({ x: 8, y: 52, w: 254, h: 262 });
    expect(layout.legend).toBeNull();
    const all = blocks(layout);
    for (const box of all) expect(inside(box, whole)).toBe(true);
    all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
  });

  it('has the bar that runs a file a button tall inside its record, and its zone a finger tall', () => {
    expect(layout.exec).toEqual({ x: 16, y: 439, w: 238, h: 24 });
    expect(inside(layout.exec, layout.record)).toBe(true);
    expect(zoneOf(layout.exec, zoom).h * zoom).toBeGreaterThanOrEqual(MIN_ZONE);
    expect(inside(zoneOf(layout.exec, zoom), layout.record)).toBe(true);
  });

  it('keeps the record whole on a short screen', () => {
    const short = pictureSize({ width: 480, height: 720 }, 280, 360);
    const tight = menuLayout(short, noInsets);
    expect(tight.space.h).toBeGreaterThan(100);
    expect(inside(tight.record, { x: 0, y: 0, w: short.width, h: short.height })).toBe(true);
  });

  it('leaves the edges the screen keeps to itself', () => {
    const inset = menuLayout(picture, { top: 35, right: 0, bottom: 26, left: 0 });
    expect(inset.header.box.y).toBeGreaterThanOrEqual(35);
    expect(inset.record.y + inset.record.h).toBeLessThanOrEqual(picture.height - 26);
  });

  it('stands the header and the dice on the grid', () => {
    for (const n of [layout.header.y, layout.header.second, layout.header.rule, layout.space.y, layout.exec.h]) expect(n % 4).toBe(0);
  });
});

describe('menuLayout on a wide screen', () => {
  const picture = pictureSize(desktopCanvas, 280, 360);
  const layout = menuLayout(picture, noInsets);
  const whole: Box = { x: 0, y: 0, w: picture.width, h: picture.height };

  it('puts the dice on the left and the records in a column on the right', () => {
    expect(layout.wide).toBe(true);
    expect(layout.subject).toEqual({ x: 368, y: 52, w: 264, h: 112 });
    expect(layout.record).toEqual({ x: 368, y: 172, w: 264, h: 150 });
    expect(layout.space).toEqual({ x: 8, y: 52, w: 352, h: 276 });
    expect(layout.exec).toEqual({ x: 376, y: 289, w: 248, h: 24 });
    const all = blocks(layout);
    for (const box of all) expect(inside(box, whole)).toBe(true);
    all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
  });

  it('names the keys at the bottom', () => {
    expect(layout.legend).toBe(336);
    expect(layout.legend!).toBeGreaterThanOrEqual(layout.record.y + layout.record.h);
    expect(layout.legend!).toBeGreaterThanOrEqual(layout.space.y + layout.space.h);
    expect(layout.legend! + 16).toBeLessThanOrEqual(picture.height);
  });

  it('fits a phone held sideways, without the record of the subject', () => {
    const sideways = pictureSize({ width: 1218, height: 562 }, 280, 360);
    const tight = menuLayout(sideways, { top: 0, right: 30, bottom: 14, left: 30 });
    const all = blocks(tight);
    expect(tight.subject).toBeNull();
    for (const box of all) expect(inside(box, { x: 0, y: 0, w: sideways.width, h: sideways.height })).toBe(true);
    all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
    const zoom = 375 / sideways.height;
    expect(zoneOf(tight.exec, zoom).h * zoom).toBeGreaterThanOrEqual(MIN_ZONE);
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
    expect(projection.centres[2].x).toBeLessThan(projection.centres[0].x);
    expect(projection.centres[0].x).toBeLessThan(projection.centres[3].x);
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
