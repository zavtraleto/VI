import { describe, expect, it } from 'vitest';
import { fileBoard } from '../levels/boardFiles';
import { similarity } from '../levels/signature';
import { answer, instantOf, laterOf, nearInRow, secondsOf, spareOf, wayedFor } from './labFacts';

const R03 = fileBoard('R03');

describe('the tiers of the lab', () => {
  it('says at once that a board is laid and is no dead end', () => {
    expect(instantOf(R03)).toMatchObject({ error: null, deadEnd: null, dice: 2 });
  });
  it('says at once what the rules refuse', () => {
    const broken = { ...R03, layout: { ...R03.layout!, start: { x: 0, z: 0 } } };
    expect(instantOf(broken).error).toMatch(/no die to start on/);
  });
  it('solves a board in the second tier, with its first moves and what each move does', () => {
    const seconds = secondsOf(R03);
    expect(seconds.check.par).toBe(2);
    expect(seconds.firsts).toBeGreaterThanOrEqual(1);
    expect(seconds.moves.some((fact) => fact.keeps === 'par')).toBe(true);
  });
  it('reports on a board and its neighbours in the third', { timeout: 60_000 }, () => {
    const later = laterOf(R03, 2);
    expect(later.report.par).toBe(2);
    expect(later.near.length).toBeGreaterThan(0);
    // R03 is cleared by its pair in two moves, by one way, and cannot be lost; the hasty player clears it.
    expect(later.measures).toEqual({ d: 1.5, rank: 1, forks: expect.any(Number), hidden: 0, ways: 1, waysLong: expect.any(Number), complete: true });
    expect(later.measures!.forks).toBeLessThanOrEqual(1);
  });
  it('measures a board that keeps no way by the way the solver finds', { timeout: 60_000 }, () => {
    const { par: _par, exact: _exact, solution: _solution, ...draft } = R03;
    expect(laterOf(draft, 2).measures).toEqual(laterOf(R03, 2).measures);
  });
  it('finds no die to spare on a board of two dice that are a pair, and finds a die that goes along for nothing', () => {
    expect(spareOf(R03)).toEqual([]);
    // A third 2 beside the cell the pair is made on goes with it: the board is cleared in the same two moves by the same route.
    const three = { ...R03, norm: 3, layout: { ...R03.layout!, dice: [...R03.layout!.dice, { x: 2, z: 0, top: 2, north: 3 }] } };
    expect(spareOf(three)).toContainEqual({ x: 2, z: 0 });
    expect(spareOf(three)).not.toContainEqual({ x: 1, z: 2 });
  });
  it('answers a question under its number, and a board that cannot be asked with what went wrong', () => {
    expect(answer({ id: 7, tier: 'seconds', spec: R03 })).toMatchObject({ id: 7, tier: 'seconds', facts: { firsts: expect.any(Number) } });
    const broken = { ...R03, layout: { ...R03.layout!, start: { x: 0, z: 0 } } };
    expect(answer({ id: 8, tier: 'seconds', spec: broken })).toMatchObject({ id: 8, error: expect.stringMatching(/no die to start on/) });
  });
});

describe('how alike a board of the row is to the places before it', () => {
  const bridge = fileBoard('bridge-5');
  const hidden = fileBoard('hidden-face-1');
  it('says every earlier place with a way, in the order of the row, and none after', () => {
    const places = [
      { number: 1, code: 'R03', spec: R03 },
      { number: 2, code: 'bridge-5', spec: bridge },
      { number: 4, code: 'later', spec: R03 },
    ];
    expect(nearInRow(hidden, 3, places)).toEqual([
      { number: 1, code: 'R03', sim: similarity(hidden, R03) },
      { number: 2, code: 'bridge-5', sim: similarity(hidden, bridge) },
    ]);
    expect(nearInRow(R03, 2, places)?.[0].sim).toBe(1);
    expect(nearInRow(R03, 1, places)).toEqual([]);
  });
  it('says nothing of a board whose way cannot be played, and leaves out a place before whose way cannot be', () => {
    const broken = { ...R03, solution: ['9,9,E'] };
    expect(nearInRow(broken, 3, [{ number: 1, code: 'R03', spec: R03 }])).toBeNull();
    expect(nearInRow(R03, 3, [{ number: 1, code: 'broken', spec: broken }, { number: 2, code: 'bridge-5', spec: bridge }])?.map((near) => near.code)).toEqual(['bridge-5']);
  });
  it('leaves out an earlier place that keeps no way: its thought is not read on the page', () => {
    const { solution: _solution, ...bare } = bridge;
    expect(nearInRow(hidden, 3, [{ number: 2, code: 'bridge-5', spec: bare }])).toEqual([]);
  });
  it('reads the board in hand by the way the solver found where the file keeps none or one that does not hold', () => {
    const { solution: _solution, ...bare } = R03;
    const found = secondsOf(R03);
    expect(wayedFor(R03, null)).toBe(R03);
    expect(wayedFor(bare, null)).toBeNull();
    expect(wayedFor(bare, 'the worker fell')).toBeNull();
    expect(wayedFor(bare, { ...found, check: { ...found.check, kept: null } })?.solution).toEqual(found.check.way);
    expect(wayedFor(R03, { ...found, check: { ...found.check, kept: 'broken', way: ['1,1,E'] } })?.solution).toEqual(['1,1,E']);
    expect(wayedFor(R03, found)).toBe(R03);
  });
});
