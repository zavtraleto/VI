import { describe, expect, it } from 'vitest';
import { boxesMeet, signRoom, signTurn } from './hudLayout';
import type { Box } from './layout';
import { SIGN_KEY_MS, paintSign, signReach, type SignKit, type SignLook, type SignPlan } from './swipeSign';

const LOOK: SignLook = { runMs: 900, restMs: 500, trail: 0.45, glow: 1 };
const TIMES = { runMs: LOOK.runMs, restMs: LOOK.restMs, keyMs: SIGN_KEY_MS };

/** A kit that draws nothing and keeps every box of dots it was asked to draw on. */
function recorder(): { kit: SignKit; drawn: Box[] } {
  const drawn: Box[] = [];
  const note = (x: number, y: number, w: number, h: number): void => void drawn.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
  const kit: SignKit = {
    palette: { bg: '#000000', ink: '#ffffff', dim: '#888888' } as SignKit['palette'],
    box: (box) => note(box.x, box.y, box.w, box.h),
    frame: (box) => note(box.x, box.y, box.w, box.h),
    // A sign of the program is two places of eight dots wide and sixteen tall at the most, about the middle it is written at.
    text: (_text, x, y) => {
      note(x - 8, y, 16, 16);
      return x + 8;
    },
    light: (x, y, w, h, _color, alpha) => {
      if (alpha > 0) note(x, y, w, h);
    },
    // A disc of whole dots, as the kit draws it: rows from the floor of -r to the ceiling of r.
    halo: (cx, cy, radius, _color, alpha) => {
      if (alpha <= 0) return;
      const r = Math.max(0.5, radius);
      note(Math.round(cx - r), Math.round(cy) + Math.floor(-r), Math.round(cx + r) - Math.round(cx - r), Math.ceil(r) - Math.floor(-r) + 1);
    },
  };
  return { kit, drawn };
}

const inside = (part: Box, whole: Box): boolean => part.x >= whole.x && part.y >= whole.y && part.x + part.w <= whole.x + whole.w && part.y + part.h <= whole.y + whole.h;

/** Trails as the board lies on screen, each way, at whole and at broken places, with stars of one ray to four. */
const PLANS: SignPlan[] = [];
for (const mode of ['dot', 'key'] as const) {
  for (const rays of [1, 2, 3, 4]) {
    for (const trail of [{ x: 0, y: -48 }, { x: 0, y: 40 }, { x: 30.4, y: 16.7 }, { x: -30.4, y: -16.7 }, { x: 20, y: -30 }, { x: 0, y: 0 }]) {
      for (const from of [{ x: 196, y: 349 }, { x: 100.5, y: 33.5 }, { x: 3.49, y: 7.51 }]) PLANS.push({ mode, dir: 'N', from, trail, rays });
    }
  }
}

describe('the swipe sign drawn alone', () => {
  it('lights nothing outside its room at any moment of its run, of its rest, or held still', () => {
    for (const plan of PLANS) {
      const room = signRoom(plan.from, plan.trail, signReach(plan));
      const outside: string[] = [];
      for (let timeMs = 0; timeMs <= 2 * (LOOK.runMs + LOOK.restMs); timeMs += 7) {
        const { kit, drawn } = recorder();
        paintSign(kit, plan, LOOK, timeMs, false);
        for (const box of drawn) if (!inside(box, room)) outside.push(`at ${timeMs}: ${JSON.stringify(box)}`);
      }
      const { kit, drawn } = recorder();
      paintSign(kit, plan, LOOK, 123, true);
      expect(drawn.length).toBeGreaterThan(0);
      for (const box of drawn) if (!inside(box, room)) outside.push(`still: ${JSON.stringify(box)}`);
      expect(outside, `${JSON.stringify(plan)} in ${JSON.stringify(room)}`).toEqual([]);
    }
  });

  it('has a room of whole dots that is no larger than the trail and the star ask for', () => {
    const plan: SignPlan = { mode: 'dot', dir: 'N', from: { x: 196, y: 349 }, trail: { x: 0, y: -48 }, rays: 3 };
    const room = signRoom(plan.from, plan.trail, signReach(plan));
    expect(room).toEqual({ x: 191, y: 296, w: 11, h: 59 });
    // The readings have some hundreds of dots a side: the sign is drawn anew in a few of them.
    expect(room.w * room.h).toBeLessThan(1000);
  });

  it('draws nothing while the star rests, and something while it runs', () => {
    const plan: SignPlan = { mode: 'dot', dir: 'N', from: { x: 196, y: 349 }, trail: { x: 0, y: -48 }, rays: 3 };
    const at = (timeMs: number): number => {
      const { kit, drawn } = recorder();
      paintSign(kit, plan, LOOK, timeMs, false);
      return drawn.length;
    };
    expect(at(100)).toBeGreaterThan(0);
    expect(at(LOOK.runMs + 10)).toBe(0);
    expect(at(LOOK.runMs + LOOK.restMs + 100)).toBeGreaterThan(0);
  });
});

describe('the picture of the swipe sign from frame to frame', () => {
  it('is another on every frame of the run of the star, and one for the whole of its rest', () => {
    // Frames of a screen of sixty a second, and of one of a hundred and forty-four: none of them is skipped.
    for (const gap of [1000 / 60, 1000 / 144]) {
      for (let timeMs = 0; timeMs + gap < LOOK.runMs; timeMs += gap) expect(signTurn('dot', timeMs + gap, TIMES)).not.toBe(signTurn('dot', timeMs, TIMES));
    }
    const rest = signTurn('dot', LOOK.runMs, TIMES);
    for (let timeMs = LOOK.runMs; timeMs < LOOK.runMs + LOOK.restMs; timeMs += 5) expect(signTurn('dot', timeMs, TIMES)).toBe(rest);
    // The rest is no moment of a run.
    expect(rest).toBeLessThan(0);
    expect(signTurn('dot', LOOK.runMs + LOOK.restMs + 1, TIMES)).not.toBe(rest);
  });

  it('is one of two for the key, turned twice a second', () => {
    const seen = new Set<number>();
    let turns = 0;
    let last = signTurn('key', 0, TIMES);
    for (let timeMs = 0; timeMs < 2000; timeMs += 5) {
      const turn = signTurn('key', timeMs, TIMES);
      seen.add(turn);
      if (turn !== last) turns++;
      last = turn;
    }
    expect([...seen].sort()).toEqual([0, 1]);
    expect(turns).toBe(3);
  });

  it('is counted in steps where the sign cannot be drawn alone: all the readings are then drawn for it, thirty times a second at the most', () => {
    let turns = 0;
    let last = signTurn('dot', 0, TIMES, 33);
    for (let timeMs = 0; timeMs < LOOK.runMs; timeMs += 1) {
      const turn = signTurn('dot', timeMs, TIMES, 33);
      if (turn !== last) turns++;
      last = turn;
    }
    expect(turns).toBeLessThanOrEqual(Math.ceil(LOOK.runMs / 33));
    expect(turns).toBeGreaterThan(20);
    // The rest is one picture in steps too.
    expect(signTurn('dot', LOOK.runMs + 1, TIMES, 33)).toBe(signTurn('dot', LOOK.runMs + LOOK.restMs - 1, TIMES, 33));
  });
});

describe('what the swipe sign may lie on', () => {
  it('meets a box it has a dot in common with, and not one it only touches', () => {
    const room = { x: 10, y: 10, w: 20, h: 20 };
    expect(boxesMeet(room, { x: 29, y: 29, w: 5, h: 5 })).toBe(true);
    expect(boxesMeet(room, { x: 30, y: 10, w: 5, h: 5 })).toBe(false);
    expect(boxesMeet(room, { x: 10, y: 30, w: 5, h: 5 })).toBe(false);
    expect(boxesMeet(room, { x: 0, y: 0, w: 10, h: 10 })).toBe(false);
    expect(boxesMeet(room, { x: 15, y: 15, w: 2, h: 2 })).toBe(true);
  });
});
