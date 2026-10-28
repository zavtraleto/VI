import { describe, expect, it } from 'vitest';
import { fileBoard } from './boardFiles';
import { D_ROWS } from './calibration';
import { MEASURES_VERSION, cacheKey, type SlowMeasures } from './measureCache';
import { rankOf } from './measures';
import { FIXTURE } from './rowFixture';
import { difficulty } from './scale';
import { CAMPAIGN_HEAD, ROAD_HEAD, campaignNotes, campaignRow, dOf, slowMeasuresOf } from './table';

/**
 * The cache of the slow measures of a board (docs/superpowers/specs/2026-10-28-vi-progression-tools-design.md,
 * section 8) and the table of the campaign read from it. The tests make their own measures by hand or measure a
 * board of the fixture: none of them reads `boards/.measures/`.
 */

/** The measures of a board made up by hand: a board the hasty persona clears every time, seen whole. */
const MADE: SlowMeasures = {
  road: { firsts: 1, worst: 4, lost: 0, boards: 12, capped: true },
  facts: { lost: false, planner: 1, casual: 1, order: false, cleared: {} },
  shares: { hasty: 1, casual: 1, careful: 1, planner: 1 },
  reader: 0.9,
  explorer: { careful: { offPar: 0, waysSeen: 1 }, planner: { offPar: 0, waysSeen: 1 } },
  depth: { par: 2, forks: 1, ways: 1, waysLong: 3, slack: 1, lossAt: null, lostShare: 0, complete: true, waysCapped: false, longCapped: false, lossSampled: false },
  hidden: 0,
  states: 40,
};
const cellOf = (row: readonly string[], column: string): string => row[CAMPAIGN_HEAD.indexOf(column)];

describe('the key of the cache', () => {
  const spec = fileBoard('R03');

  it('is sixteen hex digits and the version of the measures', () => {
    expect(cacheKey(spec)).toMatch(/^[0-9a-f]{16}-\d+$/);
    expect(cacheKey(spec).endsWith(`-${MEASURES_VERSION}`)).toBe(true);
    expect(cacheKey(spec).endsWith('-1')).toBe(true);
  });

  it('is the same for the board renamed, and for its fields given in another order', () => {
    expect(cacheKey({ ...spec, id: 'other' })).toBe(cacheKey(spec));
    const turned = Object.fromEntries(Object.entries(spec).reverse()) as typeof spec;
    expect(cacheKey(turned)).toBe(cacheKey(spec));
  });

  it('is another for the board with one die turned, and for another move it teaches', () => {
    const [first, ...rest] = spec.layout!.dice;
    const turned = { ...spec, layout: { ...spec.layout!, dice: [{ ...first, top: first.top === 6 ? 5 : 6 }, ...rest] } };
    expect(cacheKey(turned)).not.toBe(cacheKey(spec));
    expect(cacheKey(spec, 'push')).not.toBe(cacheKey(spec));
    expect(cacheKey(spec, 'push')).not.toBe(cacheKey(spec, 'link'));
  });
});

describe('the row of the table of the campaign', () => {
  const spec = fileBoard('R03');

  it('has a cell to every column, the road read off the measures', () => {
    const row = campaignRow(3, spec, '0:free', MADE);
    expect(row).toHaveLength(CAMPAIGN_HEAD.length);
    expect(CAMPAIGN_HEAD.slice(0, ROAD_HEAD.length)).toEqual([...ROAD_HEAD]);
    expect(['n', 'board', 'firsts', 'worst', 'lost', 'boards', 'hasty', 'casual'].map((column) => cellOf(row, column))).toEqual(['3', 'R03', '1', '4+', '0+', '12+', '100%', '100%']);
  });

  it('says the rank as a number, and past the deep persona as >8', () => {
    expect(cellOf(campaignRow(3, spec, '0:free', MADE), 'rank')).toBe('1');
    const none: SlowMeasures = { ...MADE, shares: { hasty: 0, casual: 0, careful: 0, planner: 0, deep: 0 } };
    expect(cellOf(campaignRow(3, spec, '0:free', none), 'rank')).toBe('>8');
  });

  it('says a board that cannot be lost with -, a share sampled with ~, and ways not all counted with +', () => {
    const row = campaignRow(3, spec, '0:free', MADE);
    expect([cellOf(row, 'loss'), cellOf(row, 'ways'), cellOf(row, 'reader'), cellOf(row, 'hid'), cellOf(row, 'forks')]).toEqual(['- 0%', '1/3', '90%', '0', '1']);
    const sampled: SlowMeasures = { ...MADE, depth: { ...MADE.depth, lossAt: 2, lostShare: 0.123, lossSampled: true, longCapped: true } };
    expect([cellOf(campaignRow(3, spec, '0:free', sampled), 'loss'), cellOf(campaignRow(3, spec, '0:free', sampled), 'ways')]).toEqual(['2 ~12%', '1/3+']);
    const cut: SlowMeasures = { ...MADE, depth: { ...MADE.depth, complete: false } };
    expect(cellOf(campaignRow(3, spec, '0:free', cut), 'ways')).toBe('1/3+');
  });

  it('gives the D of the scale on the same facts', () => {
    const many: SlowMeasures = { ...MADE, shares: { hasty: 0, casual: 0.2, careful: 0.6, planner: 1 }, hidden: 2, depth: { ...MADE.depth, forks: 4, lossAt: 1 } };
    const d = difficulty({ rank: rankOf(many.shares), forks: 4, hidden: 2, lossAt: 1, par: spec.par ?? 0 });
    expect(dOf(spec, many)).toBe(d);
    expect(cellOf(campaignRow(3, spec, '0:free', many), 'D')).toBe(String(d));
  });
});

describe('the slow measures of a board', () => {
  const place = FIXTURE.places[3];
  const measures = slowMeasuresOf(place.spec, place.teaches, 50, 2);

  it('are JSON values only, and play the planner and the casual persona once', () => {
    expect(JSON.parse(JSON.stringify(measures))).toEqual(measures);
    expect(measures.facts).not.toHaveProperty('d');
    // The shares of the facts are those of the ranks: the personas are not played twice.
    expect([measures.facts.planner, measures.facts.casual]).toEqual([measures.shares.planner, measures.shares.casual]);
    expect(measures.road.boards).toBeGreaterThan(0);
    expect(measures.states).toBeGreaterThan(0);
  });
});

describe('the notes under the table of the campaign', () => {
  it('say the boards of one road past the 50th, the rows of the scale, the pairs and the places out of their band', () => {
    const at = (number: number, code: string, role = 'apply') => ({ ...FIXTURE.places[0], number, code, role: role as 'apply', spec: { ...fileBoard('R03'), id: code } });
    const stops = [at(30, D_ROWS[0].codes[0]), at(52, 'one-road'), at(53, 'many-roads')];
    const one: SlowMeasures = { ...MADE, depth: { ...MADE.depth, waysLong: 1 } };
    const text = campaignNotes(stops, [MADE, one, MADE]);
    expect(text).toContain('одна дорога: 52 one-road');
    expect(text).not.toContain('53 many-roads');
    // The first row of the scale holds the board of the 30th place at D 2, within 1 to 3.
    expect(text).toMatch(new RegExp(`${D_ROWS[0].codes[0]} 2$`, 'm'));
    expect(text).toMatch(/раздел 6/);
    expect(text).toMatch(/раздел 5/);
    // Places 52 and 53 are at D 2, under the band of 5 to 6 of their decade.
    expect(text).toMatch(/51–60: 2 из 2/);
  });
});
