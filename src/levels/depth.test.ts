import { describe, expect, it } from 'vitest';
import { moveOf } from '../rules/levelSolver';
import { boardOf } from './boardSets';
import { canonicalWay, depthOf, symmetriesOf, type Depth } from './depth';

const wayOf = (code: string) => (boardOf(code).solution ?? []).map(moveOf);

/** Every board is measured once for all the tests that ask of it. */
const measured = new Map<string, Depth>();
const depth = (code: string): Depth => {
  if (!measured.has(code)) measured.set(code, depthOf(boardOf(code)));
  return measured.get(code)!;
};

describe('the depth of a board', () => {
  it('has one way on R03, where the two ways are mirrors, and cannot be lost', () => {
    const r03 = depth('R03');
    expect(r03.complete).toBe(true);
    expect(r03.ways).toBe(1);
    // The spec looked for one fork at most. By the measure as it is defined there are two: the last
    // move of each of the two mirrored ways, where the clearing roll and the roll back both look good.
    // Forks are boards, and the boards of a way and of its mirror are not the same boards.
    expect(r03.forks).toBe(2);
    expect(r03.lossAt).toBeNull();
    expect(r03.lostShare).toBe(0);
  });

  it('is lost first after three moves on P07: the trap of its order costs moves, and no first or second move loses it', () => {
    // The spec looked for a loss after one move or two. The solver says every board two moves from the
    // start is still cleared (`nearOf`: 28 boards, none lost), and `trapOf` finds no trap.
    expect(depth('P07').lossAt).toBe(3);
  });

  it('has one way on tight-room-4, the first two moves taken either way', () => {
    const tight = depth('tight-room-4');
    expect(tight.ways).toBe(1);
    // The spec looked for fewer forks than par (6). There are six: the start is none, since either of the
    // first two moves keeps par, but each of the two boards after it is one, and so are the four after
    // the second move, where one move keeps par and moves of another die lose nothing within two moves.
    expect(tight.forks).toBe(6);
  });

  it('keeps slack within the moves it looks past par, and no fewer long ways than shortest', () => {
    for (const code of ['R03', 'P07', 'tight-room-4']) {
      const one = depth(code);
      expect(one.slack).toBeGreaterThanOrEqual(0);
      expect(one.slack).toBeLessThanOrEqual(3);
      expect(one.waysLong).toBeGreaterThanOrEqual(one.ways);
    }
  });

  it('gives up on finale-1 past its limit of boards, and says so', () => {
    const begun = Date.now();
    const finale = depthOf(boardOf('finale-1'), { maxStates: 2000 });
    expect(finale.complete).toBe(false);
    expect(finale.slack).toBe(0);
    expect(Date.now() - begun).toBeLessThan(20_000);
  }, 30_000);
});

describe('the key of a way', () => {
  it('is the same for the way of tight-room-4 with its first two moves swapped', () => {
    const spec = boardOf('tight-room-4');
    const way = wayOf('tight-room-4');
    const swapped = [way[1], way[0], ...way.slice(2)];
    expect(canonicalWay(spec, swapped)).toBe(canonicalWay(spec, way));
  });

  it('is not the same for two ways that differ in more than the order of moves of other dice', () => {
    const spec = boardOf('tight-room-4');
    const way = wayOf('tight-room-4');
    // The last two moves are of one die: they cannot be made in the other order.
    expect(canonicalWay(spec, [...way.slice(0, 4), way[5], way[4]])).not.toBe(canonicalWay(spec, way));
  });

  it('is the same for the way of R03 and its mirror', () => {
    const spec = boardOf('R03');
    expect(canonicalWay(spec, ['1,2,W', '0,2,N'].map(moveOf))).toBe(canonicalWay(spec, wayOf('R03')));
  });
});

describe('the symmetries of a board', () => {
  it('are the board itself and its mirror for R03, and the board alone for tight-room-4', () => {
    const r03 = symmetriesOf(boardOf('R03'));
    expect(r03).toContain(0);
    expect(r03).toEqual([0, 4]);
    expect(symmetriesOf(boardOf('tight-room-4'))).toEqual([0]);
  });
});
