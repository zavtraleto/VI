import { describe, expect, it } from 'vitest';
import { levelId } from './generate';
import { CHAPTERS, PLACES, boundsOf, type Recipe, type Scene } from './recipes';

/** Dice a scene puts on the board: a combo of as many as its face has pips unless it says, a link of one, the 1 that is brought and the 1s that wait for it. */
function diceOf(scene: Scene, place: Recipe): number {
  if (scene.event === 'combo') return scene.dice ?? scene.face ?? place.faces[0];
  return scene.event === 'link' ? 1 : 1 + (scene.dice ?? 1);
}
const scenesOf = (place: Recipe): readonly Scene[] => place.scenes ?? [];
const name = (index: number): string => `P${String(index + 1).padStart(2, '0')}`;

describe('the chapters of the levels', () => {
  it('are one: the probe', () => {
    expect(CHAPTERS.map((chapter) => chapter.key)).toEqual(['probe']);
  });

  it('is open from its first level, with the floor open, no net under the player and a generous limit of moves', () => {
    expect(CHAPTERS[0]).toEqual({ key: 'probe', times: 5, gate: false, floor: true, guard: 'none' });
  });
});

describe('the places of the probe', () => {
  it('are twenty, named and numbered in their order, all of the one chapter', () => {
    expect(PLACES).toHaveLength(20);
    expect(PLACES.map(levelId)).toEqual(PLACES.map((_, index) => name(index)));
    expect(PLACES.map((place) => place.slot)).toEqual(PLACES.map((_, index) => index + 1));
    for (const place of PLACES) expect(place.chapter, place.id).toBe(0);
  });

  it('say what the player is to feel, each in its own words', () => {
    const briefs = PLACES.map((place) => place.brief);
    for (const brief of briefs) expect(brief?.length ?? 0).toBeGreaterThan(10);
    expect(new Set(briefs).size).toBe(briefs.length);
  });

  it('teach nothing: no line, no arrow, no window, no net, and the floor is left as the chapter has it', () => {
    for (const place of PLACES) {
      for (const key of ['lesson', 'arrow', 'guide', 'until', 'story', 'guard', 'floor', 'safe'] as const) expect(place[key], `${place.id} ${key}`).toBeUndefined();
    }
  });

  it('are about one face or two, on a board of three cells a side to five', () => {
    for (const place of PLACES) {
      expect(place.faces.length, place.id).toBeGreaterThanOrEqual(1);
      expect(place.faces.length, place.id).toBeLessThanOrEqual(2);
      expect(new Set(place.faces).size, place.id).toBe(place.faces.length);
      // A 1 makes no combo: the 1s are counted apart.
      for (const face of place.faces) expect([2, 3, 4, 5, 6], place.id).toContain(face);
      expect([3, 4, 5], place.id).toContain(place.size);
    }
  });

  it('have a route each: scenes that begin with a combo, of the faces of the place', () => {
    for (const place of PLACES) {
      const scenes = scenesOf(place);
      expect(scenes.length, place.id).toBeGreaterThan(0);
      // A link and the 1s are brought to a combo: with none before them there is nothing to lay them beside.
      expect(scenes[0].event, place.id).toBe('combo');
      for (const scene of scenes) {
        if (scene.event !== 'ones') expect(place.faces, place.id).toContain(scene.face ?? place.faces[0]);
        for (const range of [scene.moves, scene.looseMoves]) {
          if (!range) continue;
          expect(range[0], place.id).toBeGreaterThanOrEqual(1);
          expect(range[1], place.id).toBeGreaterThanOrEqual(range[0]);
        }
      }
    }
  });

  it('ask for as many dice as their scenes lay, and leave them room to move', () => {
    for (const place of PLACES) {
      const laid = scenesOf(place).reduce((sum, scene) => sum + diceOf(scene, place), 0);
      expect(laid, place.id).toBeGreaterThanOrEqual(place.dice);
      expect(laid, place.id).toBeLessThanOrEqual(place.dice + (place.more ?? 0));
      expect(place.size * place.size - laid, place.id).toBeGreaterThanOrEqual(1);
      // The free cells a place asks for are those its dice leave.
      if (place.room) {
        expect(place.size * place.size - laid, place.id).toBeGreaterThanOrEqual(place.room[0]);
        expect(place.size * place.size - laid, place.id).toBeLessThanOrEqual(place.room[1]);
      }
    }
  });

  it('let the 1s work where a scene sweeps them, and nowhere else', () => {
    for (const place of PLACES) {
      const swept = scenesOf(place).some((scene) => scene.event === 'ones');
      expect((place.ones ?? 0) > 0, place.id).toBe(swept);
      if (place.ends?.event === 'ones' || place.parts?.includes('ones')) expect(swept, place.id).toBe(true);
    }
  });

  it('bound every way alike: an end that is not drawn out, no long silence under the count, a board not cleared by fiddling', () => {
    for (const place of PLACES) {
      expect(place.tail, place.id).toEqual([0, 2]);
      expect(place.random, place.id).toEqual([0, 0.1]);
      expect(place.silence, place.id).toBeDefined();
      expect(boundsOf(place).map((bound) => bound.what), place.id).toEqual(expect.arrayContaining(['par', 'random']));
    }
  });

  it('give every bound as a range from the less to the more, and the fewest moves as one move at the least', () => {
    for (const place of PLACES) {
      expect(place.par[0], place.id).toBeGreaterThanOrEqual(1);
      for (const key of ['par', 'depth', 'traps', 'random', 'tail', 'firsts', 'quiet', 'counted', 'last', 'links', 'room'] as const) {
        const range = place[key];
        if (range) expect(range[1], `${place.id} ${key}`).toBeGreaterThanOrEqual(range[0]);
      }
    }
  });

  it('say what kind of route the way is to be, and do not avoid what their routes are made of', () => {
    for (const place of PLACES) {
      const scenes = scenesOf(place);
      const avoid = place.avoid ?? [];
      expect(place.kinds?.length ?? 0, place.id).toBeGreaterThan(0);
      if (avoid.includes('floor')) {
        // A push is made from the floor, and a way that stays off the floor is on top all along.
        expect(scenes.some((scene) => scene.by === 'push'), place.id).toBe(false);
        expect(place.kinds!.some((kind) => kind === 'top' || kind === 'bridge'), place.id).toBe(true);
      }
      if (avoid.includes('ones')) expect(scenes.some((scene) => scene.event === 'ones'), place.id).toBe(false);
      if (avoid.includes('link')) expect(scenes.some((scene) => scene.event === 'link'), place.id).toBe(false);
      for (const technique of [...(place.needs ?? []), ...(place.shows ?? [])]) expect(avoid, place.id).not.toContain(technique);
      for (const part of place.parts ?? []) expect(avoid, place.id).not.toContain(part);
    }
  });

  it('ask only for what a board can be: clusters apart are not one cluster, and two faces are counted where there are two', () => {
    for (const place of PLACES) {
      if ((place.islands ?? 1) > 1) expect(place.compact, place.id).toBe(false);
      if (place.bothFaces) expect(place.faces, place.id).toHaveLength(2);
      // With no die showing a face that works, every die of a combo has been rolled away from it: a die that is pushed, or left, shows it still.
      if (place.blind) {
        for (const scene of scenesOf(place)) {
          expect(scene.by, place.id).toBe('roll');
          if (scene.event === 'combo') expect(scene.loose, place.id).toBe(diceOf(scene, place) - 1);
        }
      }
    }
  });
});

describe('the bounds of a place', () => {
  const place: Recipe = { slot: 1, size: 3, dice: 3, faces: [3], compact: true, par: [1, 1], random: [0.4, 1] };

  it('are listed with what is measured, from what to what', () => {
    expect(boundsOf(place)).toEqual([
      { what: 'par', from: 1, to: 1 },
      { what: 'random', from: 0.4, to: 1 },
    ]);
  });

  it('are those the place names, in one order: moves, depth, traps, the random share', () => {
    expect(boundsOf({ ...place, traps: [0.2, 1], depth: [2, 4] }).map((bound) => bound.what)).toEqual(['par', 'depth', 'traps', 'random']);
    expect(boundsOf({ ...place, random: undefined })).toEqual([{ what: 'par', from: 1, to: 1 }]);
  });
});
