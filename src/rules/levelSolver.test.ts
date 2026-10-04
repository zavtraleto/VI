import { describe, expect, it } from 'vitest';
import { defaultConfig } from './config';
import { moveOf, moveText, movesAt, playMove, replay, solveLevel, tryWay, type SolverMove } from './levelSolver';
import { createRun } from './sim';
import type { LevelSpec, PuzzleDie, RunState } from './types';

/** A board of three cells a side to be cleared, given die by die; the player starts on the first die named. */
function board(dice: readonly PuzzleDie[], spec: Partial<LevelSpec> = {}): LevelSpec {
  return {
    id: 'test', seed: 1, size: 3, values: [2, 3], norm: dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0,
    layout: { dice, start: { x: dice[0].x, z: dice[0].z } },
    ...spec,
  };
}

const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });

/** The die the player is on shows its 2 when rolled west, beside the 2 in the corner. */
const MOVER: PuzzleDie = { x: 2, z: 0, top: 6, north: 3 };
const CORNER: PuzzleDie = { x: 0, z: 0, top: 2, north: 1 };
const PAIR = board([MOVER, CORNER]);
/** A third die beside where the pair is made: rolled north over the die that is going, it shows a 2. */
const GLASS = board([MOVER, CORNER, { x: 1, z: 1, top: 6, north: 5 }]);
/** A third die two cells off, with no die between: it comes to the pair by the floor, in two rolls. */
const FLOOR = board([MOVER, CORNER, { x: 2, z: 2, top: 5, north: 4 }]);

describe('moves of a board', () => {
  it('are the rolls of every die the player can step to', () => {
    // Three dice in a row: the player walks the row, and each die rolls where there is room.
    const spec = board([
      { x: 0, z: 1, top: 6, north: 3 },
      { x: 1, z: 1, top: 5, north: 4 },
      { x: 2, z: 1, top: 4, north: 6 },
    ]);
    const moves = movesAt(start(spec)).map(moveText);
    expect(moves).toEqual(['0,1,N', '0,1,S', '1,1,N', '1,1,S', '2,1,N', '2,1,S']);
  });

  it('do not reach a die that no step leads to', () => {
    expect(movesAt(start(PAIR)).map(moveText)).toEqual(['2,0,S', '2,0,W']);
  });

  it('take in the floor, once a die that is going lets the player down', () => {
    const made = playMove(start(FLOOR), moveOf('2,0,W'));
    const all = movesAt(made).map(moveText);
    // From the floor the die in the far corner is stepped onto and rolled.
    expect(all).toEqual(expect.arrayContaining(['2,2,N', '2,2,W']));
    expect(movesAt(made, ['floor'])).toEqual([]);
  });

  it('leave out a roll over a die that is going when glass is banned', () => {
    const made = playMove(start(GLASS), moveOf('2,0,W'));
    expect(movesAt(made).map(moveText)).toContain('1,1,N');
    expect(movesAt(made, ['glass']).map(moveText)).not.toContain('1,1,N');
    expect(movesAt(made, ['glass']).map(moveText)).toContain('1,1,E');
  });

  it('are written and read back as a level keeps them', () => {
    const moves: SolverMove[] = [{ x: 2, z: 0, dir: 'W', push: false }, { x: 1, z: 3, dir: 'N', push: true }];
    expect(moves.map(moveText)).toEqual(['2,0,W', '1,3,N,p']);
    expect(moves.map(moveText).map(moveOf)).toEqual(moves);
    expect(() => moveOf('2,0,X')).toThrow(/cannot read/);
    expect(() => moveOf('2,W')).toThrow(/cannot read/);
  });
});

describe('a move played', () => {
  it('is played on the real rules until the world stands, and leaves the run it was given alone', () => {
    const before = start(PAIR);
    const same = JSON.stringify(before);
    const after = playMove(before, moveOf('2,0,S'));
    expect(JSON.stringify(before)).toBe(same);
    expect(after.levelRun!.moves).toBe(1);
    expect(after.cubes.every((cube) => cube.state === 'idle')).toBe(true);
    expect(after.player).toEqual({ x: 2, z: 1, level: 'top' });
    expect(after.over).toBe(false);
  });

  it('ends the level when it clears the board', () => {
    const after = playMove(start(PAIR), moveOf('2,0,W'));
    expect(after.endReason).toBe('passed');
  });
});

describe('the fewest moves of a board', () => {
  it('is one for a board one roll clears', () => {
    const { solution, exhausted, states } = solveLevel(PAIR);
    expect(solution).toEqual({ par: 1, moves: [{ x: 2, z: 0, dir: 'W', push: false }], depth: 1, uses: [] });
    expect(exhausted).toBe(true);
    // The start, and the board the other roll of the die leads to.
    expect(states).toBe(2);
  });

  it('is found with a way that clears the board in exactly that many moves', () => {
    for (const spec of [PAIR, GLASS, FLOOR]) {
      const { solution } = solveLevel(spec);
      const end = replay(spec, solution!.moves);
      expect(end.endReason).toBe('passed');
      expect(end.levelRun!.moves).toBe(solution!.par);
      expect(solution!.moves).toHaveLength(solution!.par);
    }
  });

  it('says what the way leans on', () => {
    expect(solveLevel(GLASS).solution).toMatchObject({ par: 2, uses: ['link', 'glass'], depth: 1 });
    expect(solveLevel(FLOOR).solution).toMatchObject({ par: 3, uses: ['link', 'floor'], depth: 2 });
  });

  it('is another, or none, when what the way leans on is banned', () => {
    // Round the die that is going instead of over it: a move more.
    const round = solveLevel(GLASS, { ban: ['glass'] }).solution!;
    expect(round.par).toBe(3);
    expect(round.uses).not.toContain('glass');
    // And the same with the floor left out as well: the die goes round over the cells that stand free.
    expect(solveLevel(GLASS, { ban: ['glass', 'floor'] }).solution).toMatchObject({ par: 3, uses: ['link'] });
    // The third die of three is always a link.
    expect(solveLevel(GLASS, { ban: ['link'], maxMoves: 5 })).toMatchObject({ solution: null, exhausted: true });
    // The far die is reached by the floor, or else the first die is rolled up to it before the pair is made.
    expect(solveLevel(FLOOR, { ban: ['floor'], maxMoves: 5 })).toMatchObject({ solution: null, exhausted: true });
    const noFloor = solveLevel(FLOOR, { ban: ['floor'] }).solution!;
    expect(noFloor.par).toBe(6);
    expect(noFloor.uses).not.toContain('floor');
  });

  it('is the same every time it is looked for', () => {
    expect(solveLevel(GLASS)).toEqual(solveLevel(GLASS));
    expect(solveLevel(FLOOR)).toEqual(solveLevel(FLOOR));
  });

  it('is none for a board that cannot be cleared: one die', () => {
    expect(solveLevel(board([MOVER]))).toMatchObject({ solution: null, exhausted: true });
  });

  it('is not said to be none when the search gave up', () => {
    expect(solveLevel(FLOOR, { maxStates: 3 })).toMatchObject({ solution: null, exhausted: false, states: 3 });
    expect(solveLevel(FLOOR, { maxMoves: 2 })).toMatchObject({ solution: null, exhausted: true });
  });

  it('begins with the die the player starts on, or with another, when asked to', () => {
    // The die that makes the pair is the one the player starts on, and no step leads to another.
    expect(solveLevel(GLASS, { first: 'own' }).solution).toMatchObject({ par: 2 });
    expect(solveLevel(GLASS, { first: 'other', maxMoves: 6 })).toMatchObject({ solution: null, exhausted: true });
    // Here the pair is made by the die beside the one the player starts on.
    const walk = board([
      { x: 1, z: 0, top: 5, north: 4 },
      { x: 0, z: 0, top: 2, north: 1 },
      { x: 1, z: 1, top: 6, north: 3 },
    ]);
    const any = solveLevel(walk).solution!;
    const other = solveLevel(walk, { first: 'other' }).solution!;
    const own = solveLevel(walk, { first: 'own', maxMoves: any.par + 3 }).solution;
    expect(other.par).toBe(any.par);
    expect([other.moves[0].x, other.moves[0].z]).toEqual([1, 1]);
    expect(tryWay(walk, other.moves).ownFirst).toBe(false);
    if (own) {
      expect(own.par).toBeGreaterThanOrEqual(any.par);
      expect(own.moves[0]).toMatchObject({ x: 1, z: 0, push: false });
    }
  });
});

describe('a way played again', () => {
  it('says what went, how far ahead it had to be seen, and with which die it began', () => {
    const report = tryWay(GLASS, solveLevel(GLASS).solution!.moves);
    expect(report).toMatchObject({ depth: 1, uses: ['link', 'glass'], values: [2, 2], ownFirst: true, commits: 0 });
    expect(report.state.endReason).toBe('passed');
  });

  it('gives up on a move that cannot be made, and says which', () => {
    expect(() => replay(PAIR, [moveOf('0,0,E')])).toThrow(/move 1 \(0,0,E\) cannot be made/);
    expect(() => replay(PAIR, [moveOf('2,0,W'), moveOf('1,0,S')])).toThrow(/move 2 is made after the level has ended/);
  });

  it('counts a choice among standing dice that no step joins', () => {
    // The pair is made in the top row; a die stands beside either die of it, apart from the other.
    const spec = board([
      { x: 1, z: 1, top: 6, north: 5 },
      { x: 0, z: 0, top: 2, north: 1 },
      { x: 0, z: 1, top: 5, north: 4 },
      { x: 2, z: 0, top: 5, north: 4 },
    ]);
    expect(tryWay(spec, [moveOf('1,1,N')]).commits).toBe(0);
    expect(tryWay(spec, [moveOf('1,1,N'), moveOf('0,1,S')]).commits).toBe(1);
    // With one die to step to there is nothing to choose.
    const one = board(spec.layout!.dice.slice(0, 3));
    expect(tryWay(one, [moveOf('1,1,N'), moveOf('0,1,S')]).commits).toBe(0);
  });
});
