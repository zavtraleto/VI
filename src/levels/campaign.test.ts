import { describe, expect, it } from 'vitest';
import { CAMPAIGN, HINTS, campaignCells, campaignDone, campaignFocus, numberOf, stopOf } from './campaign';
import { ACT_1, LEVELS, TAIL } from './levels';
import { ROAD, ROAD_END } from './road';

const none = { passed: {}, stats: {} };

describe('the row of the campaign', () => {
  it('is the road and then the list, numbered from one, every board once', () => {
    expect(CAMPAIGN.length).toBe(ROAD.length + LEVELS.length);
    expect(CAMPAIGN.map((stop) => stop.number)).toEqual(CAMPAIGN.map((_, i) => i + 1));
    expect(CAMPAIGN.slice(0, ROAD.length).map((stop) => stop.spec.id)).toEqual(ROAD.map((spec) => spec.id));
    expect(CAMPAIGN.slice(ROAD.length).map((stop) => stop.spec.id)).toEqual(LEVELS.map((spec) => spec.id));
    expect(new Set(CAMPAIGN.map((stop) => stop.spec.id)).size).toBe(CAMPAIGN.length);
  });

  it('names a board by its number: a piece of the road by its place, a level of the list after the road, a board of the lab by none', () => {
    expect(numberOf({ road: 0 })).toBe(1);
    expect(numberOf({ road: ROAD.length - 1 })).toBe(ROAD.length);
    expect(numberOf({ level: 0 })).toBe(ROAD.length + 1);
    expect(numberOf({})).toBeNull();
    expect(stopOf({ level: 2 })?.spec.id).toBe(LEVELS[2].id);
  });
});

describe('the cells of the list', () => {
  it('show nothing passed to one who is new, and the stars of the fewest moves to one who passed', () => {
    expect(campaignCells(none).every((cell) => !cell.passed && cell.stars === 0)).toBe(true);
    const kept = { passed: { R01: true, [LEVELS[0].id]: true }, stats: { R01: { bestMoves: ROAD[0].par }, [LEVELS[0].id]: { bestMoves: 99 } } };
    const cells = campaignCells(kept);
    expect(cells[0]).toMatchObject({ number: 1, passed: true, stars: 3 });
    expect(cells[ROAD.length]).toMatchObject({ number: ROAD.length + 1, passed: true, stars: 1 });
  });

  it('gives one star to a board passed with no fewest moves kept', () => {
    expect(campaignCells({ passed: { R02: true }, stats: {} })[1].stars).toBe(1);
  });

  it('carries the faces and the goal of every board, for the line under the cells', () => {
    expect(campaignCells(none)[0].faces).toEqual(ROAD[0].faces);
    expect(campaignCells(none)[ROAD.length].goal.length).toBeGreaterThan(0);
  });
});

describe('where the list opens', () => {
  it('is the piece the player is on, by the place kept of them', () => {
    expect(campaignFocus({ ...none, road: 'R07' }, false, 0)).toBe(6);
  });
  it('is the first piece for one who is new, whatever they passed of the list', () => {
    expect(campaignFocus({ passed: { [LEVELS[0].id]: true }, stats: {} }, false, 1)).toBe(0);
  });
  it('is the level the player goes on with for one past the road', () => {
    const past = { ...none, road: ROAD_END };
    expect(campaignFocus(past, false, 0)).toBe(ROAD.length);
    expect(campaignFocus(past, false, 3)).toBe(ROAD.length + 3);
  });
  it('counts the boards passed, pieces and levels alike', () => {
    expect(campaignDone({ passed: { R01: true, R02: true, [LEVELS[0].id]: true, F1: true } })).toBe(3);
  });
});

describe('the acts of the row', () => {
  it('names the act and the role of every stop: the road is act 0, the levels of the first act are act 1, the tail is none', () => {
    expect(CAMPAIGN[0]).toMatchObject({ act: 0, role: 'lesson' });
    expect(CAMPAIGN[2]).toMatchObject({ act: 0, role: 'free' });
    expect(CAMPAIGN.slice(ROAD.length, ROAD.length + ACT_1.length).map((stop) => [stop.act, stop.role])).toEqual([[1, 'opening'], [1, 'apply'], [1, 'twist'], [1, 'join']]);
    expect(CAMPAIGN[ROAD.length + ACT_1.length]).toMatchObject({ act: null, role: 'tail' });
    expect(CAMPAIGN.slice(ROAD.length + ACT_1.length).map((stop) => stop.spec.id)).toEqual(TAIL.map((spec) => spec.id));
  });

  it('carries the lines of the road and of the acts by the code of the board', () => {
    expect(HINTS.R06).toEqual({ key: 'roadHintChain', until: 'chain' });
    expect(HINTS[ACT_1[0].id]).toEqual({ key: 'hintSeven', until: 'combo' });
    expect(HINTS[ACT_1[1].id]).toBeUndefined();
  });

  it('keeps the stars of a level that moved into an act: they are kept by its code', () => {
    const cells = campaignCells({ passed: { P03: true }, stats: { P03: { bestMoves: 99 } } });
    const at = CAMPAIGN.findIndex((stop) => stop.spec.id === 'P03');
    expect(CAMPAIGN[at].act).toBe(1);
    expect(cells[at]).toMatchObject({ passed: true, stars: 1 });
  });

  it('opens the list on the first level of the act not yet passed', () => {
    // nextLevel of the game is the first index of LEVELS not passed: with three of the act passed, 3.
    expect(campaignFocus({ passed: Object.fromEntries(ACT_1.slice(0, 3).map((spec) => [spec.id, true])), stats: {}, road: ROAD_END }, false, 3)).toBe(ROAD.length + 3);
  });
});
