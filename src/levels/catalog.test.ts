import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { catalogKey, entryOf, fieldMatch, fieldOf, findBoards, funnelOf, lineText, parseQuery, readLines, shortKey, type Entry } from './catalog';
import { CATALOG_VERSION, catalogJobs, variationsOf, type Job } from './catalogJobs';
import { PLOTS } from './plots';
import { passportOf } from './plotFinal';

const WALL = `
kind rule
idea Кость, которую не сдвинуть, задаёт дорогу
frame 5x3
combo 3: a w! o<r4-5/around=w
par 4-5
`;

const NO_INPUT = { solutions: [], plots: {}, row: [], recipes: [] };

describe('catalogJobs', () => {
  it('gives every plot as it is first, then its variations step by step, each work once', () => {
    const jobs = catalogJobs({ ...NO_INPUT, solutions: [{ name: 'wall-loop', text: WALL }], plots: { wall: PLOTS.wall } });
    const steps = jobs.map((job) => job.step);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(new Set(jobs.map((job) => job.id)).size).toBe(jobs.length);
    expect(jobs.slice(0, 2).map((job) => job.id)).toEqual([`solution:wall-loop:as@${CATALOG_VERSION}`, `plot:wall:as@${CATALOG_VERSION}`]);
    const solution = jobs.filter((job) => job.source === 'solution');
    expect(solution.every((job) => job.strict)).toBe(true);
    expect(solution.map((job) => job.vary)).toEqual(expect.arrayContaining(['as', 'rolls1', 'link', 'f4x3', 'face3to2', 'shut', 'die']));
  });

  it('frames the field anew and journals a variation that does not hold', () => {
    const vary = variationsOf(PLOTS.wall).map((one) => one.vary);
    expect(vary).toContain('f5x4');
    expect(vary).toContain('f4x5');
    const jobs = catalogJobs({ ...NO_INPUT, solutions: [{ name: 'broken', text: 'combo 3: a' }] });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].fault).toBeTruthy();
    expect(jobs[0].plot).toBeUndefined();
  });

  it('gives only the works of one base where asked', () => {
    const jobs = catalogJobs({ ...NO_INPUT, solutions: [{ name: 'wall-loop', text: WALL }], plots: PLOTS, only: { source: 'plot', base: 'wall' } });
    expect(jobs.length).toBeGreaterThan(3);
    expect(jobs.every((job) => job.source === 'plot' && job.base === 'wall')).toBe(true);
  });
});

describe('funnelOf and the line of a board', () => {
  const job: Job = catalogJobs({ ...NO_INPUT, solutions: [{ name: 'wall-loop', text: WALL }] })[0];

  it('lays a work, keeps the finalists one to a shape, and passes over the boards the catalog has', () => {
    const { tally, finalists } = funnelOf(job, { limit: 3000, finalists: 3 });
    expect(tally.laid).toBeGreaterThan(0);
    expect(tally.lesson).toBeGreaterThanOrEqual(finalists.length);
    expect(finalists.length).toBeGreaterThan(0);
    expect(finalists.length).toBeLessThanOrEqual(3);
    expect(finalists.every((one) => one.spec.faces?.join() === '3')).toBe(true);
    const known = new Set(finalists.map((one) => catalogKey(one.spec)));
    const again = funnelOf(job, { limit: 3000, finalists: 3, known });
    expect(again.finalists.some((one) => known.has(catalogKey(one.spec)))).toBe(false);
  });

  it('writes a board with its way, its field and its passport, and reads it back', () => {
    const { finalists } = funnelOf(job, { limit: 3000, finalists: 1 });
    const passport = passportOf(job.plot!, finalists[0].spec, { runs: 4, people: 2 });
    const entry = entryOf(job, finalists[0], passport);
    expect(entry.spec.solution).toEqual(passport.way);
    expect(entry.spec.par).toBe(passport.par);
    expect(entry.kind).toBe('rule');
    expect(entry.field).toMatchObject({ w: 5, h: 3, fixed: 1, faces: [3], floor: 'open' });
    expect(Object.keys(entry.p)).not.toContain('nearest');
    const text = `${lineText(entry)}\n{"v":0}\n{"v":${CATALOG_VERSION},"cut`;
    const read = readLines<Entry>(text);
    expect(read).toHaveLength(1);
    expect(read[0].key).toBe(entry.key);
  });
});

/** A board of one die line for the query: only what the query reads is said. */
function entry(over: { key: string; d: number; par?: number; faces?: number[]; kind?: Entry['kind']; troubles?: string[]; want?: Entry['want']; narrow?: number; waysLong?: number }): Entry {
  const spec: LevelSpec = {
    id: over.key,
    seed: 0,
    size: 4,
    goal: { kind: 'clear' },
    moves: 0,
    values: over.faces ?? [3],
    norm: 3,
    arrival: 'none',
    faces: over.faces ?? [3],
    layout: { start: { x: 0, z: 0 }, dice: [0, 1, 2].map((x) => ({ x, z: 0, top: (over.faces ?? [3])[0], north: 2 })) },
    par: over.par ?? 4,
    solution: [],
  };
  return {
    v: CATALOG_VERSION,
    key: over.key,
    job: 'plot:test:as@1',
    source: 'plot',
    base: 'test',
    vary: 'as',
    ...(over.kind ? { kind: over.kind } : {}),
    ...(over.want ? { want: over.want } : {}),
    spec,
    field: fieldOf(spec),
    p: {
      par: over.par ?? 4,
      d: over.d,
      depth: { forks: 1, ways: 1, waysLong: over.waysLong ?? 1 },
      troubles: over.troubles ?? [],
      craft: { narrow: over.narrow ?? 0, lastShare: 0, counter: 0, choice: 0, motif: 'K' },
      route: 'K',
    } as unknown as Entry['p'],
  };
}

describe('the query', () => {
  it('reads the words of the command line', () => {
    expect(parseQuery(['kind=polish', 'faces=4,2', 'D=6-7', 'par=5', 'near<0.75', 'holds', 'frame=5x4', 'faces~=2'])).toEqual({
      kind: 'polish',
      faces: [2, 4],
      d: [6, 7],
      par: [5, 5],
      near: 0.75,
      holds: true,
      frame: { w: 5, h: 4 },
      facesHas: [2],
    });
    expect(() => parseQuery(['kind=fun'])).toThrow();
    expect(() => parseQuery(['colour=red'])).toThrow();
  });

  it('keeps the boards of the kind asked and those of none, and not those of another', () => {
    const q = parseQuery(['kind=polish']);
    expect(fieldMatch(entry({ key: 'a', d: 5, kind: 'polish' }), q)).toBe(true);
    expect(fieldMatch(entry({ key: 'b', d: 5 }), q)).toBe(true);
    expect(fieldMatch(entry({ key: 'c', d: 5, kind: 'insight' }), q)).toBe(false);
  });

  it('finds by the band of D and the faces, the boards that hold their gates and have fewer troubles first, each once', () => {
    const entries = [
      entry({ key: 'far', d: 9 }),
      entry({ key: 'troubled', d: 6.5, troubles: ['видно сразу'] }),
      entry({ key: 'misses', d: 6.5, want: { par: [8, 9] } }),
      entry({ key: 'good', d: 6.5 }),
      entry({ key: 'good', d: 6.5 }),
      entry({ key: 'fours', d: 6.5, faces: [4] }),
    ];
    const found = findBoards(entries, parseQuery(['D=6-7', 'faces=3']), []);
    expect(found.map((one) => one.entry.key)).toEqual(['good', 'troubled', 'misses']);
    expect(found[2].misses).toEqual(['par 4 not 8–9']);
    expect(findBoards(entries, parseQuery(['D=6-7', 'faces=3', 'holds', 'troubles=0']), []).map((one) => one.entry.key)).toEqual(['good']);
  });

  it('puts the boards of a kind in the order of its passport: the long ways first for polishing', () => {
    const found = findBoards([entry({ key: 'few', d: 6, waysLong: 3 }), entry({ key: 'many', d: 6, waysLong: 40 })], parseQuery(['kind=polish']), []);
    expect(found.map((one) => one.entry.key)).toEqual(['many', 'few']);
  });

  it('holds a board against the row given at the query, not the one it was laid against', () => {
    const a = entry({ key: 'a', d: 6 });
    const row = [{ code: 'same', number: 61, spec: a.spec, core: { kind: 'top' as const, route: 'K', needs: [], faces: [3] } }];
    const found = findBoards([a], parseQuery([]), row);
    expect(found[0].nearest?.code).toBe('same');
    expect(findBoards([a], parseQuery(['near<0.5']), row)).toEqual([]);
    expect(shortKey(a)).toBe('a');
  });
});
