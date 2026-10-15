import { describe, expect, it } from 'vitest';
import { normalSpec } from './boardFile';
import { CAMPAIGN, HINTS } from './campaign';
import { ROAD, ROAD_BLOCKS, ROAD_IDLE, ROAD_LESSONS, ROAD_SIGNS } from './road';
import { ROW } from './row.gen';

/** While the old row and the new one stand side by side: they are one row, board by board and help by help. */
describe('the row of row.json against the row of the code', () => {
  it('has the same boards in the same places, played the same', () => {
    expect(ROW.places.map((place) => place.code)).toEqual(CAMPAIGN.map((stop) => stop.spec.id));
    ROW.places.forEach((place, i) => {
      const old = CAMPAIGN[i].spec;
      const played = (spec: typeof old) => ({ ...normalSpec(spec), id: spec.id, seed: undefined, chapter: undefined, undos: undefined, faces: spec.faces, values: [...spec.values].sort() });
      expect(played(place.spec), place.code).toEqual(played(old));
      expect([place.role, place.teaches, place.archetype, place.event], place.code).toEqual([CAMPAIGN[i].role, CAMPAIGN[i].teaches, CAMPAIGN[i].archetype, CAMPAIGN[i].event]);
    });
  });

  it('helps the player where the code helped', () => {
    const block = ROAD_BLOCKS.find((one) => one.oneScale)!;
    ROW.places.forEach((place, i) => {
      const piece = i < ROAD.length ? i : null;
      const wait = piece === null ? undefined : piece === 0 ? 'first' : ROAD_LESSONS.includes(place.code) ? 'lesson' : 'free';
      const camera = piece === null ? undefined : piece >= block.from && piece <= block.to ? 'hold' : 'cells';
      const plaques = piece !== null && piece < 2 ? 'all' : place.number <= 10 ? 'near' : undefined;
      const want = { hint: HINTS[place.code]?.key, sign: ROAD_SIGNS[place.code], plaques, wait, camera };
      expect(place.help, place.code).toEqual(Object.fromEntries(Object.entries(want).filter(([, value]) => value !== undefined)));
      if (piece !== null) expect(ROAD_IDLE[place.code], place.code).toBeDefined();
    });
  });
});
