import { describe, expect, it } from 'vitest';
import { CAMPAIGN, CHAPTERS, HINTS, STOPS, campaignCells, campaignDone, campaignFocus, numberOf, stopOf, withChapterFaces } from './campaign';
import { CHAPTER_1, LEVELS } from './levels';
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
    expect(campaignFocus({ ...none, road: 'R08' }, false, 0)).toBe(6);
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

describe('the chapters of the row', () => {
  it('is the prologue and the chapters, in the order of CHAPTERS, numbered from one', () => {
    expect(CAMPAIGN.map((stop) => stop.spec.id)).toEqual(CHAPTERS.flatMap((chapter) => chapter.stops));
    expect(CAMPAIGN.length).toBe(14);
    expect(CAMPAIGN[0]).toMatchObject({ chapter: 0, role: 'meet' });
    expect(CAMPAIGN[7]).toMatchObject({ chapter: 1, role: 'meet', teaches: 'walk' });
    expect(CHAPTERS.map((chapter) => [chapter.id, chapter.faces])).toEqual([[0, null], [1, [2, 3]]]);
    expect(CHAPTERS[0].stops).toEqual(ROAD.map((spec) => spec.id));
    expect(CHAPTER_1.map((spec) => spec.id)).toEqual(CHAPTERS[1].stops);
  });

  it('gives every board of a chapter the faces of the chapter, and leaves the prologue its own', () => {
    for (const stop of CAMPAIGN.slice(7)) expect(stop.spec.faces, stop.spec.id).toEqual([2, 3]);
    for (const stop of CAMPAIGN.slice(7)) expect(stop.spec.values, stop.spec.id).toEqual([2, 3]);
    expect(CAMPAIGN[0].spec.faces).toEqual([2]);
    expect(CAMPAIGN[1].spec.faces).toEqual([3]);
    const spec = ROAD[0];
    expect(withChapterFaces(spec, [2, 3])).toEqual({ ...spec, faces: [2, 3], values: [2, 3] });
  });

  it('knows what every stop teaches and what it is about', () => {
    expect(STOPS.R07).toMatchObject({ chapter: 0, role: 'meet', teaches: 'link' });
    expect(STOPS['C1-04']).toMatchObject({ chapter: 1, role: 'meet', teaches: 'glass' });
    for (const stop of CAMPAIGN) expect(stop.archetype, stop.spec.id).toBeTruthy();
    for (const stop of CAMPAIGN) expect(STOPS[stop.spec.id].chapter, stop.spec.id).toBe(stop.chapter);
  });

  it('carries the line of the chain on R07 and no other line yet', () => {
    expect(HINTS).toEqual({ R07: { key: 'roadHintChain', until: 'chain' } });
  });

  it('keeps the stars of a board that came to a chapter: they are kept by its code', () => {
    const cells = campaignCells({ passed: { K22: true }, stats: { K22: { bestMoves: 99 } } });
    const at = CAMPAIGN.findIndex((stop) => stop.spec.id === 'K22');
    expect(CAMPAIGN[at].chapter).toBe(1);
    expect(cells[at]).toMatchObject({ passed: true, stars: 1 });
  });

  it('opens the list on the first board of the chapter not yet passed', () => {
    // nextLevel of the game is the first index of LEVELS not passed: with three of the chapter passed, 3.
    expect(campaignFocus({ passed: Object.fromEntries(CHAPTER_1.slice(0, 3).map((spec) => [spec.id, true])), stats: {}, road: ROAD_END }, false, 3)).toBe(ROAD.length + 3);
    expect(campaignFocus({ ...none, road: ROAD_END }, false, 0)).toBe(7);
  });
});
