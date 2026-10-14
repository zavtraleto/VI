import { describe, expect, it } from 'vitest';
import { DOWN_AND_UP, LESSON } from './boardSamples';
import { ROAD } from './road';
import { createRun, defaultConfig } from '../rules';
import { movesAt, moveText } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { normalSpec } from './boardFile';
import { ROAD_PLACES } from './roadRecipes';
import { levelSource } from './select';
import { parseBoard, readBoardHead } from './boardFile';
import { BLIND, boardFrom, checkJson, checkOf, checkText, diffOf, diffText, fitOf, fitText, genFile, genOf, genSeeds, movesOf, movesText, nearBoards, nearOf, nearText, regressOne, regressText } from './labText';

describe('genOf', () => {
  const place = ROAD_PLACES.find((recipe) => recipe.id === 'R03')!;
  it('counts the seeds of a place in the range of the way its boards are laid', () => {
    expect(genSeeds(place, { from: 1, to: 3 }, 'random')).toEqual([1, 2, 3]);
    expect(genSeeds(place, { from: 393, to: 394 }, 'solution')).toEqual([10393, 10394]);
    expect(genSeeds(place, { from: 1, to: 2 }, 'route')).toEqual([30001, 30002]);
    expect(genSeeds(place, { from: 5, to: 4 })).toEqual([]);
  });
  it('gives the boards that fit a place, each a file of the lab with a note of its place and seed', { timeout: 120_000 }, () => {
    // The board of R03 was laid from the seed 10393: the place takes it still.
    const said: number[] = [];
    const fits = genOf(place, { from: 393, to: 393 }, { mode: 'solution', say: (done) => said.push(done) });
    expect(fits).toHaveLength(1);
    expect(fits[0].spec.id).toBe('R03');
    expect(said).toEqual([1]);
    const { name, text } = genFile(place, fits[0]);
    expect(name).toBe('R03-10393');
    expect(readBoardHead(text)).toEqual({ status: 'idea', note: 'место R03, зерно 10393' });
    expect(parseBoard(text, name).par).toBe(fits[0].par);
  });
  it('gives the boards one change away as boards, each with its way where it has one', () => {
    const boards = nearBoards(ROAD[2]);
    expect(boards.map(({ spec: _spec, ...fact }) => fact)).toEqual(nearOf(ROAD[2]));
    const cleared = boards.find((board) => board.par !== null)!;
    expect(cleared.spec.solution).toHaveLength(cleared.par!);
  });
});

describe('fitOf', () => {
  it('holds a board against places, and says what it misses of each by the name of the place alone', { timeout: 120_000 }, () => {
    const facts = fitOf(ROAD[2], ROAD_PLACES);
    expect(facts).toHaveLength(ROAD_PLACES.length);
    expect(facts.find((fact) => fact.place === 'R03')).toEqual({ place: 'R03', misses: [] });
    expect(facts.find((fact) => fact.place === 'R04')!.misses[0]).toMatch(/faces 2, the place has 3/);
    expect(fitText(facts)).toContain('the board fits R03');
    expect(BLIND).toContain('P23');
  });
});

describe('diffOf', () => {
  const P06 = DOWN_AND_UP;
  it('finds no cell between a board and itself, and the one cell of a die turned', () => {
    expect(diffOf(P06, P06)).toEqual({ cells: [], same: true });
    const dice = P06.layout!.dice.map((die, index) => (index === 1 ? { ...die, top: 1, north: 2 } : die));
    const turned = { ...P06, layout: { ...P06.layout!, dice } };
    expect(diffOf(P06, turned)).toEqual({ cells: [{ x: 1, z: 1, was: '21', now: '12' }], same: false });
    expect(diffText(P06, turned, diffOf(P06, turned))).toContain('diff: 1 cells differ');
  });
});

describe('levelSource', () => {
  it('writes what a board of the road has: fixed dice, a start on the floor, a die that is leaving, the moves taken back', () => {
    const source = levelSource(LESSON);
    expect(source).toContain('fixed: true');
    expect(source).toContain('onFloor: true');
    expect(source).toMatch(/leaving: \[\{ die: \d, moves: 1 \}\]/);
    expect(source).toContain('undos: 3');
    const read = new Function(`return [${source}][0]`)() as LevelSpec;
    expect(normalSpec(read)).toEqual(normalSpec(LESSON));
  });
});

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
    const facts = nearOf(LESSON);
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
    // A board of the road a chapter took is the level of the list, on the faces of the chapter; a spare and a parked level are found too.
    expect(boardFrom('R11')).toMatchObject({ from: 'list', spec: { id: 'R11', faces: [2, 3] } });
    expect(boardFrom('K22')).toMatchObject({ from: 'list', spec: { id: 'K22', faces: [2, 3] } });
    expect(boardFrom('R13')).toMatchObject({ from: 'road', spec: { id: 'R13' } });
    expect(boardFrom('K23')).toMatchObject({ from: 'list', spec: { id: 'K23' } });
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
    expect(Object.keys(checkJson(R03, check))).toEqual(['id', 'par', 'exact', 'states', 'way', 'route', 'kind', 'turns', 'away', 'kept', 'ok']);
  });
  it('tells the dice to turn before the first event and the rolls away, as a line and as keys', () => {
    const R02 = ROAD[1];
    const check = checkOf(R02);
    expect(checkText(R02, check)).toContain('turns 1  away 0');
    expect(checkJson(R02, check)).toMatchObject({ turns: 1, away: 0 });
  });
});
