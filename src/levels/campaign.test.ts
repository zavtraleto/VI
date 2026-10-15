import { describe, expect, it } from 'vitest';
import { CAMPAIGN, campaignCells, campaignDone, campaignFocus, placeOfCode, plaquesOf } from './campaign';
import { FIXTURE } from './rowFixture';
import { ROW } from './row.gen';

const row = FIXTURE.places;
const none = { passed: {}, stats: {} };

describe('the row of the campaign', () => {
  it('is the row laid from row.json, numbered from one, every board once', () => {
    expect(CAMPAIGN).toBe(ROW.places);
    expect(CAMPAIGN.map((place) => place.number)).toEqual(CAMPAIGN.map((_, i) => i + 1));
    expect(new Set(CAMPAIGN.map((place) => place.code)).size).toBe(CAMPAIGN.length);
  });

  it('finds a place by its code, and none for a code it has not', () => {
    expect(placeOfCode('G1', row)).toBe(3);
    expect(placeOfCode('R99', row)).toBe(-1);
  });
});

describe('the cells of the list', () => {
  it('show nothing passed to one who is new, and the stars of the fewest moves to one who passed', () => {
    expect(campaignCells(none, row).every((cell) => !cell.passed && cell.stars === 0)).toBe(true);
    const cells = campaignCells({ passed: { F1: true, G1: true }, stats: { F1: { bestMoves: 3 }, G1: { bestMoves: 99 } } }, row);
    expect(cells[0]).toMatchObject({ number: 1, passed: true, stars: 3 });
    expect(cells[3]).toMatchObject({ number: 4, passed: true, stars: 1 });
  });

  it('gives one star to a board passed with no fewest moves kept', () => {
    expect(campaignCells({ passed: { F2: true }, stats: {} }, row)[1].stars).toBe(1);
  });

  it('carries the faces and the goal of every board, for the line under the cells', () => {
    expect(campaignCells(none, row)[0].faces).toEqual([2]);
    expect(campaignCells(none, row)[3].faces).toEqual([2, 3]);
    expect(campaignCells(none, row)[3].goal.length).toBeGreaterThan(0);
  });
});

describe('where the list opens', () => {
  it('is the place the player stands on, by its code', () => {
    expect(campaignFocus({ ...none, at: 'G1' }, row)).toBe(3);
  });

  it('is the first place not passed for one with no place kept, and the first when all are', () => {
    expect(campaignFocus(none, row)).toBe(0);
    expect(campaignFocus({ passed: { F1: true, F2: true }, stats: {} }, row)).toBe(2);
    expect(campaignFocus({ passed: Object.fromEntries(row.map((place) => [place.code, true])), stats: {} }, row)).toBe(0);
  });

  it('counts the boards passed of the row, and no code that is not in it', () => {
    expect(campaignDone({ passed: { F1: true, G2: true, R99: true } }, row)).toBe(2);
  });
});

describe('the plaques of a place', () => {
  it('are what its help says, and none where it says nothing', () => {
    expect(row.map((place) => plaquesOf(place.help))).toEqual(['all', 'near', 'near', null, null]);
  });
});
