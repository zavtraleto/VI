import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from './campaign';
import { CAMPAIGN_PLACES } from './campaignRecipes';
import { levelId } from './generate';
import { PLACES } from './recipes';
import { ROAD_PLACES } from './roadRecipes';

/** The faces an act of the first edition or a chapter of the second is on, by the edition and its number. */
const FACES: Readonly<Record<string, readonly number[]>> = { '1:1': [3], '1:2': [2, 3, 4], '2:1': [2, 3], '2:2': [2, 3] };
/** The roles of a place, by the edition it was laid for. */
const ROLES: Readonly<Record<number, readonly string[]>> = {
  1: ['opening', 'apply', 'twist', 'join', 'peak', 'rest'],
  2: ['meet', 'learn', 'apply', 'event', 'twist', 'peak', 'rest'],
};

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
      expect(ROLES[place.edition], place.id).toContain(place.role);
      expect(place.brief.length, place.id).toBeGreaterThan(0);
      for (const face of place.faces) expect(FACES[`${place.edition}:${place.act}`], place.id).toContain(face);
    }
  });

  it('say of a board of a chapter the role the row says of it', () => {
    // A board of the second edition the owner sent back to the spares keeps its place, and the row says nothing of it.
    // The chapters of the row are those of the third campaign (die, leaving, floor, order, more; section 14), so the act is no chapter number now.
    for (const place of CAMPAIGN_PLACES.filter((one) => one.edition === 2 && CAMPAIGN.some((stop) => stop.spec.id === one.id))) {
      const stop = CAMPAIGN.find((one) => one.spec.id === place.id);
      expect(stop, place.id).toBeDefined();
      expect(stop!.role, place.id).toBe(place.role);
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
