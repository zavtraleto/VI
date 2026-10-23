import { describe, expect, it } from 'vitest';
import { CAMPAIGN, LIVES, campaignCells, campaignDone, campaignFocus, campaignList, liveAfter, placeOfCode, plaquesOf } from './campaign';
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

describe('the live sessions in the list', () => {
  const lives = [{ code: 'live-1', step: 1, after: 1 }];

  it('stand after the board they are after, with no number of their own: the boards keep theirs', () => {
    const list = campaignList(none, row, lives);
    expect(list).toHaveLength(row.length + 1);
    expect(list.slice(0, 3).map((cell) => (cell.kind === 'board' ? cell.cell.number : cell.code))).toEqual([1, 2, 'live-1']);
    expect(list[3]).toMatchObject({ kind: 'board', cell: { number: 3 } });
    expect(list[2]).toEqual({ kind: 'live', code: 'live-1', step: 1, best: null, played: false });
  });

  it('show the best score of a session once it is played', () => {
    const list = campaignList({ ...none, lives: { 'live-1': { best: 420, plays: 2 } } }, row, lives);
    expect(list[2]).toMatchObject({ kind: 'live', best: 420, played: true });
  });

  it('are found by the place they stand after', () => {
    expect(liveAfter(1, lives)).toEqual(lives[0]);
    expect(liveAfter(0, lives)).toBeNull();
    expect(LIVES).toBe(ROW.lives);
  });
});

describe('where the list opens', () => {
  it('is the place of the prologue the player stands on, by its code, whatever they passed further on', () => {
    expect(campaignFocus({ ...none, at: 'F2' }, row)).toBe(1);
    expect(campaignFocus({ passed: { G1: true }, stats: {}, at: 'F3' }, row)).toBe(2);
    // On the prologue the place kept is shown even while a board of a chapter is played out of turn.
    expect(campaignFocus({ ...none, at: 'F2' }, row, 4)).toBe(1);
  });

  it('is the first place of the prologue for one who is new, and for a code the row has not', () => {
    expect(campaignFocus(none, row)).toBe(0);
    expect(campaignFocus({ passed: { F1: true, F2: true }, stats: {} }, row)).toBe(0);
    expect(campaignFocus({ ...none, at: 'R99' }, row)).toBe(0);
  });

  it('is, past the prologue, the first place of the chapters not passed, wherever the code kept points', () => {
    // A place further on passed out of turn does not hold the player: the first one not passed does.
    expect(campaignFocus({ passed: { G2: true }, stats: {}, at: 'G2' }, row)).toBe(3);
    expect(campaignFocus({ passed: { G1: true }, stats: {}, at: 'G1' }, row)).toBe(4);
    // Every place of the chapters passed: the first of them.
    expect(campaignFocus({ passed: { G1: true, G2: true }, stats: {}, at: 'G2' }, row)).toBe(3);
  });

  it('is, past the prologue, the place of a chapter being played', () => {
    expect(campaignFocus({ ...none, at: 'G1' }, row, 4)).toBe(4);
    // A board of the prologue played again past it does not move the list off the chapters.
    expect(campaignFocus({ ...none, at: 'G1' }, row, 0)).toBe(3);
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
