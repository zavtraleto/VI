import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from './campaign';
import { CAMPAIGN_PLACES } from './campaignRecipes';
import { levelId } from './generate';
import { PLACES } from './recipes';
import { ROAD_PLACES } from './roadRecipes';

/** The faces an act is on, by its number. */
const FACES: Readonly<Record<number, readonly number[]>> = { 1: [3] };

describe('the places of the acts of the campaign', () => {
  it('have codes of their own, none a place of the probe or of the road, and slots of their own', () => {
    const codes = CAMPAIGN_PLACES.map(levelId);
    expect(new Set(codes).size).toBe(codes.length);
    const taken = new Set([...PLACES, ...ROAD_PLACES].map(levelId));
    for (const code of codes) expect(taken.has(code), code).toBe(false);
    for (const place of CAMPAIGN_PLACES) expect(levelId(place)).toBe(place.id);
    const slots = [...PLACES, ...ROAD_PLACES, ...CAMPAIGN_PLACES].map((place) => place.slot);
    for (const place of CAMPAIGN_PLACES) expect(slots.filter((slot) => slot === place.slot).length, place.id).toBe(1);
  });

  it('name their act, their role and what the board is to show, and are on the faces of their act', () => {
    for (const place of CAMPAIGN_PLACES) {
      expect(place.act, place.id).toBeGreaterThan(0);
      expect(['opening', 'apply', 'twist', 'join', 'peak', 'rest'], place.id).toContain(place.role);
      expect(place.brief.length, place.id).toBeGreaterThan(0);
      for (const face of place.faces) expect(FACES[place.act], place.id).toContain(face);
    }
  });

  it('say of a board the act and the role the row says of it', () => {
    for (const place of CAMPAIGN_PLACES) {
      const stop = CAMPAIGN.find((one) => one.spec.id === place.id);
      expect(stop, place.id).toBeDefined();
      expect([stop!.act, stop!.role], place.id).toEqual([place.act, place.role]);
    }
  });

  it('are boards of four cells a side at the most, open to the floor, cut only by whole rows or columns: no cell cut out inside', () => {
    for (const place of CAMPAIGN_PLACES) {
      expect(place.size, place.id).toBeLessThanOrEqual(4);
      expect(place.floor, place.id).toBeUndefined();
      const cut = new Set((place.holes ?? []).map(([x, z]) => `${x},${z}`));
      const line = (cells: string[]): boolean => cells.every((cell) => cut.has(cell));
      for (const [x, z] of place.holes ?? []) {
        const row = Array.from({ length: place.size }, (_, i) => `${i},${z}`);
        const column = Array.from({ length: place.size }, (_, i) => `${x},${i}`);
        expect(line(row) || line(column), `${place.id} ${x},${z}`).toBe(true);
      }
    }
  });
});
