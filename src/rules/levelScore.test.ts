import { describe, expect, it } from 'vitest';
import { moveOf } from './levelSolver';
import { scoreOf } from './levelScore';
import { ALL_ORIENTATIONS, roll } from './orientation';
import type { Dir, LevelSpec, PuzzleDie } from './types';

/**
 * Boards of the ladder with a strict floor: 2s work, a combo goes in two moves, and from the
 * floor the only way up is a die that is leaving. The player starts on the first die named.
 */
function strict(dice: readonly PuzzleDie[]): LevelSpec {
  return {
    id: 'test', seed: 1, size: 5, values: [2], faces: [2], sinkMoves: 2, liftMoves: 1, climb: false, norm: dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0,
    layout: { dice, start: { x: dice[0].x, z: dice[0].z } },
  };
}
/** A die with a 6 on top that shows a 2 once rolled the ways given, one after another, and not before. */
function turns(x: number, z: number, ...ways: Dir[]): PuzzleDie {
  const lie = ALL_ORIENTATIONS.find((o) => {
    if (o.top !== 6) return false;
    let at = o;
    for (const [index, way] of ways.entries()) {
      at = roll(at, way);
      if ((at.top === 2) !== (index === ways.length - 1)) return false;
    }
    return true;
  })!;
  return { x, z, top: 6, north: lie.north };
}
const way = (...moves: string[]) => moves.map(moveOf);
const two = (x: number, z: number): PuzzleDie => ({ x, z, top: 2, north: 1 });

/** The player's die rolled west makes a pair in the corner. */
const MOVER = turns(2, 0, 'W');
const PAIR = strict([MOVER, two(0, 0)]);
/** A third die beside the pair: rolled round the corner in two rolls, it comes to the pair on the last move the pair is there for. */
const LATE = strict([MOVER, two(0, 0), turns(1, 1, 'E', 'N')]);
/** A third die stands beside the far die of the pair: the player gets to it over that die, which is leaving. */
const BRIDGE = strict([MOVER, two(0, 0), turns(0, 1, 'E')]);
/** Two more 2s stand apart: a push from the floor brings them together, and that is the end. */
const PUSHED = strict([MOVER, two(0, 0), two(3, 2), two(1, 2)]);
/** The same, and a fifth die that is rolled into the pair the push made: the player comes up by that pair. */
const DOWN_AND_UP = strict([...PUSHED.layout!.dice, turns(1, 3, 'E')]);

describe('the score of a way', () => {
  it('writes a move down: what it was made with, where the player stood, what it set off and what was left', () => {
    const { beats } = scoreOf(PAIR, way('2,0,W'));
    expect(beats).toEqual([
      { move: { x: 2, z: 0, dir: 'W', push: false }, how: 'roll', from: 'standing', down: null, up: false, bridged: false, event: 'combo', face: 2, took: 2, standing: 0, leaving: 2, spare: null },
    ]);
  });

  it('counts the quiet part and the part under the count, the biggest event and the last, the longest pause and the tail', () => {
    const score = scoreOf(LATE, way('2,0,W', '1,1,E', '2,1,N'));
    expect(score.beats.map((beat) => beat.event)).toEqual(['combo', 'none', 'link']);
    expect(score).toMatchObject({ quiet: 0, counted: 3, biggest: 2, last: 1, pause: 2, tail: 2, chain: 1 });
    // A roll that clears nothing first: the quiet part is a move long.
    const slow = scoreOf(PAIR, way('2,0,S', '2,1,N', '2,0,W'));
    expect(slow).toMatchObject({ quiet: 2, counted: 1, pause: 3, tail: 0, chain: 0 });
  });

  it('says how late a link came: none to spare on the last move the combo was there for', () => {
    const late = scoreOf(LATE, way('2,0,W', '1,1,E', '2,1,N'));
    expect(late.beats.map((beat) => beat.spare)).toEqual([null, null, 0]);
    const soon = scoreOf(BRIDGE, way('2,0,W', '0,1,E'));
    expect(soon.beats[1]).toMatchObject({ event: 'link', spare: 1, took: 1 });
  });

  it('throws at a move that cannot be made', () => {
    expect(() => scoreOf(PAIR, way('0,0,E'))).toThrow(/cannot be made/);
  });
});

describe('the route of a way', () => {
  it('stays on top where the floor is not touched', () => {
    expect(scoreOf(PAIR, way('2,0,W'))).toMatchObject({ route: 'K', kind: 'top' });
    // A step from the die the player made the combo with to the die beside it is no bridge.
    expect(scoreOf(LATE, way('2,0,W', '1,1,E', '2,1,N'))).toMatchObject({ route: 'K L', kind: 'top' });
  });

  it('is a bridge where the next die is come to over another die that is leaving', () => {
    const score = scoreOf(BRIDGE, way('2,0,W', '0,1,E'));
    expect(score.beats[1]).toMatchObject({ from: 'leaving', bridged: true });
    expect(score).toMatchObject({ route: 'K ~ L', kind: 'bridge' });
  });

  it('goes down at the last where what is done from the floor ends it', () => {
    const score = scoreOf(PUSHED, way('2,0,W', '3,2,W,p'));
    expect(score.beats[1]).toMatchObject({ how: 'push', from: 'leaving', down: 'stepped', up: false, event: 'combo', took: 2 });
    expect(score).toMatchObject({ route: 'K v P', kind: 'downLast' });
  });

  it('goes down and up again where a push makes the combo the player comes up by', () => {
    const score = scoreOf(DOWN_AND_UP, way('2,0,W', '3,2,W,p', '1,3,E'));
    expect(score.beats[2]).toMatchObject({ how: 'roll', from: 'floor', down: null, up: true, event: 'link' });
    expect(score).toMatchObject({ route: 'K v P ^ L', kind: 'downAndUp', last: 1, biggest: 2 });
  });
});
