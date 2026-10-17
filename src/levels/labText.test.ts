import { describe, expect, it } from 'vitest';
import { DOWN_AND_UP, LESSON } from './boardSamples';
import { fileBoard } from './boardFiles';
import { createRun, defaultConfig } from '../rules';
import { movesAt, moveText } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { normalSpec } from './boardFile';
import { ROAD_PLACES } from './roadRecipes';
import { levelSource } from './select';
import { parseBoard, readBoardHead } from './boardFile';
import { BATCH_WORD, BLIND, batchFile, batchTaken, boardFrom, checkJson, checkOf, checkText, diffOf, diffText, fitOf, fitText, genFile, genOf, genSeeds, movesOf, movesText, nearOf, nearText, regressOne, regressText } from './labText';

describe('a board of a batch', () => {
  it('takes the first free number of its word, and says it is new', () => {
    const { name, text } = batchFile(fileBoard('R03'), 'bridge', ['bridge-1', 'bridge-3'], '2026-10-16', 'заказ preset=tricky');
    expect(name).toBe('bridge-2');
    expect(readBoardHead(text)).toMatchObject({ status: 'N', batch: 'bridge 2026-10-16', note: 'заказ preset=tricky' });
    expect(parseBoard(text, name).id).toBe('bridge-2');
  });
  it('holds a name taken in other letters as taken: the disk does not tell them apart', () => {
    expect(batchFile(fileBoard('R03'), 'bridge', ['Bridge-1'], '2026-10-16', '').name).toBe('bridge-2');
  });
  it('holds a name taken where only a history is kept under it: a new board would take its versions and plays', () => {
    const taken = batchTaken(['bridge-1.txt', 'README.md'], ['bridge-1', 'Bridge-2', '.renaming-bridge-3', 'export-2026-10-14.md']);
    expect(taken).toEqual(['bridge-1', 'bridge-1', 'Bridge-2']);
    expect(batchFile(fileBoard('R03'), 'bridge', taken, '2026-10-16', '').name).toBe('bridge-3');
  });
  it('knows a word of a batch', () => {
    expect(BATCH_WORD.test('combo-opens')).toBe(true);
    expect(BATCH_WORD.test('Мост')).toBe(false);
    expect(BATCH_WORD.test('a_b')).toBe(false);
  });
});

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
    expect(readBoardHead(text)).toEqual({ status: 'D', note: 'место R03, зерно 10393' });
    expect(parseBoard(text, name).par).toBe(fits[0].par);
  });
});

describe('fitOf', () => {
  it('holds a board against places, and says what it misses of each by the name of the place alone', { timeout: 120_000 }, () => {
    const facts = fitOf(fileBoard('R03'), ROAD_PLACES);
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
    expect(diffOf(P06, turned)).toEqual({ cells: [{ x: 2, z: 1, was: '21', now: '12' }], same: false });
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
  const R03 = fileBoard('R03');
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
    const facts = nearOf(fileBoard('R03'));
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
    const R03 = fileBoard('R03');
    expect(regressOne(R03, 100_000, 'road')).toMatchObject({ id: 'R03', from: 'road', stored: 2, found: 2, verdict: 'ok' });
    expect(regressOne({ ...R03, par: 3 }, 100_000).verdict).toBe('shorter');
    expect(regressOne({ ...R03, solution: ['0,0,N'] }, 100_000).verdict).toBe('broken');
    expect(regressOne(R03, 1).verdict).toBe('capped');
  });
  it('is told as a table with the count of what is not ok', () => {
    const text = regressText([regressOne(fileBoard('R03'), 100_000, 'road'), regressOne({ ...fileBoard('R03'), solution: ['0,0,N'] }, 100_000)]);
    expect(text).toContain('regress: 2 boards, 1 not ok');
  });
});

const R03 = fileBoard('R03');

describe('boardFrom', () => {
  it('finds a board of the row by its code, as the row plays it', () => {
    expect(boardFrom('R03')).toMatchObject({ from: 'row', spec: { id: 'R03' } });
    // A board is played on the faces its file names: no chapter names faces since the third campaign (2026-10-17).
    expect(boardFrom('R11')).toMatchObject({ from: 'row', spec: { id: 'R11', faces: [3, 2] } });
    expect(boardFrom('C1-05')).toMatchObject({ from: 'row', spec: { id: 'C1-05', faces: [3] } });
    // A board out of the row is read by its file, and the refusal says how.
    expect(() => boardFrom('K23')).toThrow(/file=K23/);
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
    const R02 = fileBoard('R02');
    const check = checkOf(R02);
    expect(checkText(R02, check)).toContain('turns 1  away 0');
    expect(checkJson(R02, check)).toMatchObject({ turns: 1, away: 0 });
  });
  it('says whether a combo made first or second loses the board: the trap of order', () => {
    const R05 = fileBoard('R05');
    expect(checkText(R05, checkOf(R05))).toContain('trap floor');
    const pairs = fileBoard('two-pairs-2');
    expect(checkText(pairs, checkOf(pairs))).toContain('trap none');
  });
});
