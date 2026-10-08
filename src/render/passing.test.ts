import { describe, expect, it } from 'vitest';
import { comeShare, dieShare, goneShare, isLit, litFlash, passingHeight, riseSpan, riseStart, stoodBy, unlitGrey, type DicePassing } from './passing';

function leaving(litMs: number, moveMs: number, count = 3): DicePassing {
  return { mode: 'leave', ranks: new Map(), count, stair: -1, litMs, moveMs, stepMs: 140, moveForMs: 1300, flashMs: 350 };
}

function coming(moveMs: number, count = 4, stair = -1): DicePassing {
  return { mode: 'come', ranks: new Map(), count, stair, litMs: 0, moveMs, stepMs: 90, moveForMs: 600, flashMs: 0 };
}

describe('the time of one die among several', () => {
  it('begins a step later for every place and takes the time given', () => {
    expect(dieShare(0, 0, 140, 1300)).toBe(0);
    expect(dieShare(650, 0, 140, 1300)).toBe(0.5);
    expect(dieShare(650, 2, 140, 1300)).toBeCloseTo((650 - 280) / 1300);
    expect(dieShare(279, 2, 140, 1300)).toBe(0);
    expect(dieShare(5000, 2, 140, 1300)).toBe(1);
  });

  it('with no time to take is done the moment its turn comes', () => {
    expect(dieShare(139, 1, 140, 0)).toBe(0);
    expect(dieShare(140, 1, 140, 0)).toBe(1);
  });
});

describe('the dice of a board that is passed', () => {
  it('light up one after another, the first at once', () => {
    expect(isLit(leaving(0, -1), 0)).toBe(true);
    expect(isLit(leaving(0, -1), 1)).toBe(false);
    expect(isLit(leaving(139, -1), 1)).toBe(false);
    expect(isLit(leaving(140, -1), 1)).toBe(true);
    expect(isLit(leaving(280, -1), 2)).toBe(true);
  });

  it('count a die that was going before the combo as lit from the start', () => {
    expect(isLit(leaving(0, -1), 3)).toBe(true);
    expect(litFlash(leaving(0, -1), 3)).toBe(0);
  });

  it('flash as they light up, and the flash goes down', () => {
    expect(litFlash(leaving(100, -1), 1)).toBe(0);
    expect(litFlash(leaving(140, -1), 1)).toBe(1);
    expect(litFlash(leaving(140 + 175, -1), 1)).toBeCloseTo(0.5);
    expect(litFlash(leaving(140 + 350, -1), 1)).toBe(0);
  });

  it('stand whole until they are lit, and until they begin to go', () => {
    expect(passingHeight(leaving(0, -770), 1, 0.9)).toBe(1);
    expect(passingHeight(leaving(400, -370), 1, 0.9)).toBe(0.9);
    expect(passingHeight(leaving(770, 0), 0, 1)).toBe(1);
  });

  it('go under one after another, slowly at first, and are gone a step apart', () => {
    const half = leaving(2000, 650);
    expect(goneShare(half, 0)).toBe(0.5);
    expect(passingHeight(half, 0, 1)).toBe(0.75);
    expect(goneShare(half, 2)).toBeLessThan(goneShare(half, 1));
    expect(passingHeight(leaving(3000, 1300), 0, 1)).toBe(0);
    expect(passingHeight(leaving(3000, 1300), 2, 1)).toBeGreaterThan(0);
    expect(passingHeight(leaving(3000, 1300 + 280), 2, 1)).toBe(0);
  });

  it('take the dice that were going already with the last of the combo', () => {
    const at = leaving(3000, 900);
    expect(goneShare(at, 5)).toBe(goneShare(at, 2));
  });
});

describe('the dice of a board that comes', () => {
  it('begin a step apart in their order', () => {
    expect(riseStart(0, 4, false, 90, 600)).toBe(0);
    expect(riseStart(3, 4, false, 90, 600)).toBe(270);
    expect(riseSpan(4, false, 90, 600)).toBe(870);
    expect(riseSpan(0, false, 90, 600)).toBe(0);
  });

  it('bring a stair last, when every other die stands', () => {
    expect(riseStart(2, 4, true, 90, 600)).toBe(180);
    expect(riseStart(3, 4, true, 90, 600)).toBe(180 + 600);
    expect(riseSpan(4, true, 90, 600)).toBe(180 + 600 + 600);
    expect(riseStart(0, 1, true, 90, 600)).toBe(0);
  });

  it('count the dice that stand', () => {
    expect(stoodBy(599, 4, false, 90, 600)).toBe(0);
    expect(stoodBy(600, 4, false, 90, 600)).toBe(1);
    expect(stoodBy(869, 4, false, 90, 600)).toBe(3);
    expect(stoodBy(870, 4, false, 90, 600)).toBe(4);
    expect(stoodBy(870, 4, true, 90, 600)).toBe(3);
    expect(stoodBy(1380, 4, true, 90, 600)).toBe(4);
  });

  it('are under the floor before their turn and come up fast at first', () => {
    expect(passingHeight(coming(-200), 0, 1)).toBe(0);
    expect(passingHeight(coming(89), 1, 1)).toBe(0);
    expect(comeShare(coming(300), 0)).toBe(0.5);
    expect(passingHeight(coming(300), 0, 1)).toBe(0.75);
    expect(passingHeight(coming(600), 0, 1)).toBe(1);
  });

  it('bring a stair up to its own height and no further', () => {
    const done = coming(5000, 4, 7);
    expect(passingHeight(done, 3, 0.5)).toBe(0.5);
    const waiting = coming(700, 4, 7);
    expect(passingHeight(waiting, 3, 0.5)).toBe(0);
    expect(passingHeight(waiting, 0, 1)).toBe(1);
  });
});

describe('the grey of a fixed die', () => {
  it('is as bright as its channel is to the eye, by the share the look keeps', () => {
    expect(unlitGrey(1, 1, 1, 0.35)).toBeCloseTo(0.35);
    expect(unlitGrey(0, 1, 0, 0.5)).toBeCloseTo(0.3576);
    expect(unlitGrey(0, 0, 1, 1)).toBeLessThan(unlitGrey(1, 0, 0, 1));
    expect(unlitGrey(0.4, 0.2, 0.7, 0)).toBe(0);
  });
});
