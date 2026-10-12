import { describe, expect, it } from 'vitest';
import { ROAD } from '../levels/road';
import { parseBoard } from '../levels/boardFile';
import { GEN_PLACES, answer, instantOf, laterOf, offersOfBoard, secondsOf, spareOf } from './labFacts';

const R03 = ROAD[2];

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
  });
  it('finds no die to spare on a board of two dice that are a pair, and finds a die that goes along for nothing', () => {
    expect(spareOf(R03)).toEqual([]);
    // A third 2 beside the cell the pair is made on goes with it: the board is cleared in the same two moves by the same route.
    const three = { ...R03, norm: 3, layout: { ...R03.layout!, dice: [...R03.layout!.dice, { x: 2, z: 0, top: 2, north: 3 }] } };
    expect(spareOf(three)).toContainEqual({ x: 2, z: 0 });
    expect(spareOf(three)).not.toContainEqual({ x: 1, z: 2 });
  });
  it('offers the boards one change away that are still cleared, the longest way first, each a file of its own', () => {
    const offers = offersOfBoard(R03, 'H07');
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.map((offer) => offer.par)).toEqual([...offers.map((offer) => offer.par!)].sort((a, b) => b - a));
    expect(offers[0].name).toBe('H07-e1');
    expect(parseBoard(offers[0].text, offers[0].name).par).toBe(offers[0].par);
    expect(GEN_PLACES).toContain('R03');
    expect(GEN_PLACES).toContain('P06');
  });
  it('answers a question under its number, and a board that cannot be asked with what went wrong', () => {
    expect(answer({ id: 7, tier: 'seconds', spec: R03 })).toMatchObject({ id: 7, tier: 'seconds', facts: { firsts: expect.any(Number) } });
    const broken = { ...R03, layout: { ...R03.layout!, start: { x: 0, z: 0 } } };
    expect(answer({ id: 8, tier: 'seconds', spec: broken })).toMatchObject({ id: 8, error: expect.stringMatching(/no die to start on/) });
  });
});
