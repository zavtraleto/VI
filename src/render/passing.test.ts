import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { shellDefaults } from '../shell/theme';
import { boardDefaults } from './params';
import { comeShare, dieShare, goneShare, isLit, litFlash, passingHeight, riseSpan, riseStart, stoodBy, faded, type DicePassing } from './passing';

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

describe('the faded colour of a fixed die', () => {
  const look = { ...boardDefaults(), ...shellDefaults() } as Record<string, number | string | boolean>;
  const fade = Number(look.fixedFade);
  const light = Number(look.fixedLight);
  /** A colour as the screen shows it: hue in degrees, how much colour there is in it, how light it is, 0 to 1. */
  const seen = (r: number, g: number, b: number): { hue: number; colour: number; lightness: number; rgb: number[] } => {
    const rgb = new THREE.Color().setRGB(r, g, b).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
    const most = Math.max(rgb.r, rgb.g, rgb.b);
    const least = Math.min(rgb.r, rgb.g, rgb.b);
    const hsl = new THREE.Color().setRGB(r, g, b).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
    return { hue: hsl.h * 360, colour: most > 0 ? (most - least) / most : 0, lightness: most, rgb: [rgb.r, rgb.g, rgb.b] };
  };
  const faces = [1, 2, 3, 4, 5, 6].map((face) => {
    const full = new THREE.Color(String(look[`ch${face}`]));
    return { face, full: seen(full.r, full.g, full.b), dead: seen(...faded(full.r, full.g, full.b, fade, light)) };
  });

  it('keeps the hue of every one of the six faces', () => {
    for (const { face, full, dead } of faces) {
      const apart = Math.abs(((dead.hue - full.hue + 540) % 360) - 180);
      expect(apart, `face ${face}`).toBeLessThan(6);
    }
  });

  it('keeps a part of its colour, well under what the face has and never none: no face is plain grey', () => {
    for (const { face, full, dead } of faces) {
      expect(dead.colour, `face ${face}`).toBeLessThan(full.colour * 0.6);
      expect(dead.colour, `face ${face}`).toBeGreaterThan(full.colour * 0.3);
    }
  });

  it('is much less lit than the face and never out: no face is plain black', () => {
    for (const { face, full, dead } of faces) {
      expect(dead.lightness, `face ${face}`).toBeLessThan(full.lightness * 0.7);
      expect(dead.lightness, `face ${face}`).toBeGreaterThan(0.35);
    }
  });

  it('leaves the six apart from one another', () => {
    for (const a of faces) {
      for (const b of faces) {
        if (a.face >= b.face) continue;
        const apart = Math.hypot(...a.dead.rgb.map((value, i) => value - b.dead.rgb[i]));
        expect(apart, `faces ${a.face} and ${b.face}`).toBeGreaterThan(0.08);
      }
    }
  });

  it('is the face itself with nothing taken, a grey with all its colour taken, and black with all its light taken', () => {
    expect(faded(0.4, 0.2, 0.7, 0, 1)).toEqual([0.4, 0.2, 0.7]);
    const [r, g, b] = faded(0.4, 0.2, 0.7, 1, 0.5);
    expect(r).toBeCloseTo(0.35);
    expect(g).toBeCloseTo(0.35);
    expect(b).toBeCloseTo(0.35);
    expect(faded(0.4, 0.2, 0.7, 0.45, 0)).toEqual([0, 0, 0]);
  });
});
