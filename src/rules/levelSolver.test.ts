import { describe, expect, it } from 'vitest';
import { defaultConfig } from './config';
import { moveOf, moveText, movesAt, playMove, replay, solveFrom, solveLevel, tellMove, tryWay, type SolverMove } from './levelSolver';
import { ALL_ORIENTATIONS } from './orientation';
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

/** Four dice where only 3s work: the fewest moves are three, and the last is a link. */
const LINK: LevelSpec = {
  id: 'link', seed: 368, size: 3, values: [3], norm: 4, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces: [3], sinkMoves: 2, liftMoves: 1,
  layout: { start: { x: 2, z: 0 }, dice: [{ x: 1, z: 0, top: 6, north: 5 }, { x: 0, z: 0, top: 2, north: 3 }, { x: 1, z: 1, top: 3, north: 1 }, { x: 2, z: 0, top: 2, north: 3 }] },
};
const LINK_WAY = ['0,0,S', '2,0,S', '1,0,W'].map(moveOf);

describe('the fewest moves from where a run stands', () => {
  it('are those of the level at its start', () => {
    expect(solveLevel(LINK).solution?.par).toBe(3);
    expect(solveFrom(start(LINK)).solution?.par).toBe(3);
  });

  it('are one fewer after every move of a shortest way', () => {
    let state = start(LINK);
    LINK_WAY.forEach((move, made) => {
      expect(solveFrom(state).solution?.par, `after ${made} moves`).toBe(LINK_WAY.length - made);
      state = playMove(state, move);
    });
    expect(state.endReason).toBe('passed');
  });

  it('give a way that clears the board when played from there, and leave the run as it was', () => {
    const from = playMove(start(LINK), LINK_WAY[0]);
    const before = JSON.stringify(from.cubes);
    let state = from;
    for (const move of solveFrom(from).solution!.moves) state = playMove(state, move);
    expect(state.endReason).toBe('passed');
    expect(JSON.stringify(from.cubes)).toBe(before);
  });

  it('are none within fewer moves than the board takes, and the search says it saw everything', () => {
    const { solution, exhausted } = solveFrom(start(LINK), { maxMoves: 2 });
    expect(solution).toBeNull();
    expect(exhausted).toBe(true);
  });

  it('do not count the moves the run has made against the limit of the level', () => {
    const state = playMove(start({ ...LINK, moves: 3 }), LINK_WAY[0]);
    expect(state.levelRun!.moves).toBe(1);
    expect(solveFrom(state).solution?.par).toBe(2);
  });

  it('are not looked for on a run that is not a level', () => {
    expect(() => solveFrom(createRun({ seed: 1, config: defaultConfig(), empty: true }))).toThrow('not a level');
  });
});

describe('the moves of a way played again', () => {
  it('are told apart: which cleared, which were made with the die the player stood on, and with which die', () => {
    const report = tryWay(LINK, LINK_WAY);
    expect(report.cleared).toEqual([false, true, true]);
    expect(report.inPlace).toEqual([false, false, false]);
    expect(new Set(report.dice).size).toBe(3);
    // One roll of the die the player starts on is a move made in place.
    expect(tryWay(PAIR, [{ x: 2, z: 0, dir: 'W', push: false }]).inPlace).toEqual([true]);
  });
});

/**
 * Boards of the ladder with a strict floor: 2s work, a combo goes in two moves, and from the
 * floor the only way up is a die that is leaving.
 */
function strict(dice: readonly PuzzleDie[]): LevelSpec {
  return board(dice, { size: 5, values: [2], faces: [2], sinkMoves: 2, liftMoves: 1, climb: false });
}
/** A die with a 6 on top that shows a 2 when rolled to `side`: the 2 lies on the side it rolls away from. */
function turns(x: number, z: number, side: 'east' | 'west'): PuzzleDie {
  const from = side === 'east' ? 'west' : 'east';
  const lie = ALL_ORIENTATIONS.find((o) => o.top === 6 && o[from] === 2)!;
  return { x, z, top: 6, north: lie.north };
}
/**
 * The player's die makes a pair in the corner. Two more 2s stand apart with a cell between
 * them: no step leads to them over the dice, and a push from the floor brings them together.
 */
const PUSHED = strict([turns(2, 0, 'west'), { x: 0, z: 0, top: 2, north: 1 }, { x: 3, z: 2, top: 2, north: 1 }, { x: 1, z: 2, top: 2, north: 1 }]);
/** The same, and a fifth die beside the pair the push makes: it is rolled into it from on top, so the player has to come up again. */
const DOWN_AND_UP = strict([...PUSHED.layout!.dice, turns(1, 3, 'east')]);

describe('a way with a part of its route taken away', () => {
  it('finds the push from the floor, and no way of that length without one', () => {
    const { solution } = solveLevel(PUSHED);
    // Either of the two dice is pushed to the other: the board is the same both ways.
    expect(solution!.moves.map(moveText)[0]).toBe('2,0,W');
    expect(solution!.moves.map((move) => move.push)).toEqual([false, true]);
    const without = solveLevel(PUSHED, { ban: ['push'], maxMoves: 3 });
    expect(without).toMatchObject({ solution: null, exhausted: true });
  });

  it('leaves out every push, but not the floor, when pushes are banned', () => {
    const made = playMove(start(PUSHED), moveOf('2,0,W'));
    expect(movesAt(made).map(moveText)).toContain('3,2,W,p');
    expect(movesAt(made, ['push'])).toEqual([]);
  });

  it('goes down, pushes a combo together, comes up by it and ends on top; with no way up there is none', () => {
    const { solution } = solveLevel(DOWN_AND_UP);
    expect(solution!.moves.map(moveText)).toEqual(['2,0,W', '3,2,W,p', '1,3,E']);
    expect(solveLevel(DOWN_AND_UP, { ban: ['up'], maxMoves: 4 })).toMatchObject({ solution: null, exhausted: true });
  });

  it('leaves out the steps up from the floor when the way up is banned', () => {
    const pushed = playMove(playMove(start(DOWN_AND_UP), moveOf('2,0,W')), moveOf('3,2,W,p'));
    expect(pushed.player.level).toBe('ground');
    expect(movesAt(pushed).map(moveText)).toContain('1,3,E');
    expect(movesAt(pushed, ['up']).map(moveText)).not.toContain('1,3,E');
  });
});

describe('a move played and told', () => {
  it('says what the move set off: a combo, a link, or nothing', () => {
    const first = tellMove(start(DOWN_AND_UP), moveOf('2,0,W'));
    expect(first.outcome).toEqual({ cleared: true, link: false, ones: false, values: [2] });
    const pushed = tellMove(first.state, moveOf('3,2,W,p'));
    expect(pushed.outcome).toMatchObject({ cleared: true, link: false });
    const last = tellMove(pushed.state, moveOf('1,3,E'));
    expect(last.outcome).toMatchObject({ cleared: true, link: true, values: [2] });
    expect(last.state.endReason).toBe('passed');
    expect(tellMove(start(DOWN_AND_UP), moveOf('2,0,S')).outcome).toEqual({ cleared: false, link: false, ones: false, values: [] });
  });

  it('leaves the run it was given alone', () => {
    const before = start(PUSHED);
    const same = JSON.stringify(before);
    tellMove(before, moveOf('2,0,W'));
    expect(JSON.stringify(before)).toBe(same);
  });
});
