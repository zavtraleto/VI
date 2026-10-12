import { describe, expect, it } from 'vitest';
import { ROAD } from './road';
import { createRun, defaultConfig } from '../rules';
import { movesAt, moveText } from '../rules/levelSolver';
import { boardFrom, checkJson, checkOf, checkText, movesOf, movesText, nearOf, nearText, regressOne, regressText } from './labText';

describe('movesOf', () => {
  const R03 = ROAD[2];
  it('tells every move there is from the start, and which keep the fewest moves', () => {
    const start = createRun({ seed: R03.seed, config: defaultConfig(), level: { ...R03, moves: 0 } });
    const facts = movesOf(R03);
    expect(facts.map((fact) => fact.move)).toEqual(movesAt(start).map(moveText));
    expect(facts.find((fact) => fact.move === '1,2,E')).toMatchObject({ keeps: 'par', par: 2 });
    expect(movesText(facts)).toContain('keep the fewest');
  });
  it('tells the moves of the board after moves made', () => {
    const facts = movesOf(R03, { after: ['1,2,E'] });
    expect(facts.find((fact) => fact.move === '2,2,N')).toMatchObject({ keeps: 'par', par: 1 });
  });
});

describe('nearOf', () => {
  it('solves every board one change away and says what the change does', () => {
    const facts = nearOf(ROAD[2]);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every((fact) => fact.what !== '')).toBe(true);
    expect(facts.some((fact) => fact.change === 'unsolved' || fact.change === 'longer')).toBe(true);
    expect(nearText(facts)).toContain(`near: ${facts.length} changes`);
  });
  it('keeps a start on the floor and the dice that are leaving, where the change is not of the start', () => {
    const facts = nearOf(ROAD[1]);
    expect(facts.some((fact) => fact.par !== null)).toBe(true);
  });
});

describe('regressOne', () => {
  it('says ok of a board that is as it says, shorter of one that keeps a move too many, broken of a way that does not play', () => {
    const R03 = ROAD[2];
    expect(regressOne(R03, 100_000, 'road')).toMatchObject({ id: 'R03', from: 'road', stored: 2, found: 2, verdict: 'ok' });
    expect(regressOne({ ...R03, par: 3 }, 100_000).verdict).toBe('shorter');
    expect(regressOne({ ...R03, solution: ['0,0,N'] }, 100_000).verdict).toBe('broken');
    expect(regressOne(R03, 1).verdict).toBe('capped');
  });
  it('is told as a table with the count of what is not ok', () => {
    const text = regressText([regressOne(ROAD[2], 100_000, 'road'), regressOne({ ...ROAD[2], solution: ['0,0,N'] }, 100_000)]);
    expect(text).toContain('regress: 2 boards, 1 not ok');
  });
});

const R03 = ROAD[2];

describe('boardFrom', () => {
  it('finds a level of the list and a piece of the road by their codes', () => {
    expect(boardFrom('P06')).toMatchObject({ from: 'list', spec: { id: 'P06' } });
    expect(boardFrom('R03')).toMatchObject({ from: 'road', spec: { id: 'R03' } });
    expect(() => boardFrom('Z9')).toThrow(/Z9/);
  });
});

describe('checkOf', () => {
  it('solves a board and holds what it finds against what the board keeps', () => {
    expect(R03.id).toBe('R03');
    const check = checkOf(R03);
    expect(check).toMatchObject({ par: 2, exact: true, kept: 'same' });
    expect(check.way).toHaveLength(2);
  });
  it('says nothing of a board that keeps no way', () => {
    const { solution, par, exact, ...bare } = R03;
    expect(checkOf(bare).kept).toBeNull();
    expect(checkOf(bare).par).toBe(2);
  });
  it('says shorter where the board keeps a move more, and broken where its way does not play', () => {
    const { solution, ...noWay } = R03;
    expect(checkOf({ ...noWay, par: 3 }).kept).toBe('shorter');
    expect(checkOf({ ...R03, solution: ['0,0,N', '0,0,N'] }).kept).toBe('broken');
    expect(checkOf({ ...noWay, par: 1 }).kept).toBe('longer');
  });
  it('says missing where the search gives up before a way is found', () => {
    expect(checkOf(R03, { maxStates: 1 })).toMatchObject({ par: null, exact: false, kept: 'missing' });
  });
  it('is told as text and as keys that stay', () => {
    const check = checkOf(R03);
    const text = checkText(R03, check);
    expect(text).toContain('moves 2');
    expect(text).toContain('1. ');
    expect(text).toContain('kept: same');
    expect(Object.keys(checkJson(R03, check))).toEqual(['id', 'par', 'exact', 'states', 'way', 'route', 'kind', 'kept', 'ok']);
  });
});
