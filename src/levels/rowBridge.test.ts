import { describe, expect, it } from 'vitest';
import { normalSpec } from './boardFile';
import { STOPS } from './chapters';
import { LEVELS } from './levels';
import { CAMPAIGN } from './campaign';
import { ROAD, ROAD_BLOCKS, ROAD_HINTS, ROAD_IDLE, ROAD_LESSONS, ROAD_SIGNS } from './road';

/** The hints the code had: those of the road and those of the chapters, as `HINTS` of campaign.ts held them. */
const HINTS: Readonly<Record<string, { key: string }>> = { ...ROAD_HINTS, R11: { key: 'roadHintWalk' }, 'C1-05': { key: 'hintSeven' }, R13: { key: 'roadHintPush' }, R10: { key: 'roadHintClimb' } };
import { ROW } from './row.gen';

/** While the old row and the new one stand side by side: they are one row, board by board and help by help. */
describe('the row of row.json against the row of the code', () => {
  it('has the same boards in the same places, played the same', () => {
    const OLD = [...ROAD, ...LEVELS];
    expect(ROW.places.map((place) => place.code)).toEqual(OLD.map((spec) => spec.id));
    ROW.places.forEach((place, i) => {
      const old = OLD[i];
      const played = (spec: typeof old) => ({ ...normalSpec(spec), id: spec.id, seed: undefined, chapter: undefined, undos: undefined, faces: spec.faces, values: [...spec.values].sort() });
      expect(played(place.spec), place.code).toEqual(played(old));
      const meta = STOPS[place.code];
      expect([place.role, place.teaches, place.archetype, place.event], place.code).toEqual([meta.role, meta.teaches, meta.archetype, meta.event]);
      expect(CAMPAIGN[i]).toBe(place);
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
