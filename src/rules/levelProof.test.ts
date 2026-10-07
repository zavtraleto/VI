import { describe, expect, it } from 'vitest';
import { ROUTE_PARTS, bypassesOf, partsOf } from './levelProof';
import { scoreOf } from './levelScore';
import { moveOf, moveText, replay } from './levelSolver';
import { ALL_ORIENTATIONS, roll } from './orientation';
import type { Dir, LevelSpec, PuzzleDie } from './types';

/** Boards of the ladder with a strict floor: 2s work, a combo goes in two moves, no die is climbed from the floor. */
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
const two = (x: number, z: number): PuzzleDie => ({ x, z, top: 2, north: 1 });
const way = (...moves: string[]) => moves.map(moveOf);

const ONE_PAIR = strict([turns(2, 0, 'W'), two(0, 0)]);
/** A third die beside the pair: over the die that is leaving it joins at once; round the corner it takes a roll more. */
const BESIDE = strict([turns(2, 0, 'W'), two(0, 0), turns(1, 1, 'E', 'N')]);
/** After the pair, two more 2s stand apart and a push from the floor brings them together. */
const PUSHED = strict([turns(2, 0, 'W'), two(0, 0), two(3, 2), two(1, 2)]);
/** The same, and a fifth die rolled into the pair the push made: the player comes up by that pair. */
const DOWN_AND_UP = strict([...PUSHED.layout!.dice, turns(1, 3, 'E')]);
/** A second pair down the west side, made by a die beside the corner die: it is come to over the first pair while that is leaving. */
const BRIDGED = strict([turns(2, 0, 'W'), two(0, 0), turns(0, 1, 'S'), two(0, 3)]);
/** A third die beside the corner die, rolled to the pair: it is come to the same way, or pushed onto the corner die from the floor and rolled from there. */
const OVER = strict([turns(2, 0, 'W'), two(0, 0), turns(0, 1, 'E')]);

describe('the parts of a route a way leans on', () => {
  it('are read off its score, in one order', () => {
    expect(ROUTE_PARTS).toEqual(['link', 'glass', 'ones', 'floor', 'push', 'up', 'bridge']);
    expect(partsOf(scoreOf(ONE_PAIR, way('2,0,W')))).toEqual([]);
    expect(partsOf(scoreOf(BESIDE, way('2,0,W', '1,1,N')))).toEqual(['link', 'glass']);
    expect(partsOf(scoreOf(PUSHED, way('2,0,W', '3,2,W,p')))).toEqual(['floor', 'push']);
    expect(partsOf(scoreOf(DOWN_AND_UP, way('2,0,W', '3,2,W,p', '1,3,E')))).toEqual(['link', 'floor', 'push', 'up']);
  });

  it('name the walk over a combo that is leaving, from one of its dice to another', () => {
    expect(partsOf(scoreOf(BRIDGED, way('2,0,W', '0,1,S')))).toEqual(['bridge']);
    expect(partsOf(scoreOf(OVER, way('2,0,W', '0,1,E')))).toEqual(['link', 'bridge']);
    // A step from the die the pair was made with onto the die beside it is no such walk.
    expect(partsOf(scoreOf(BESIDE, way('2,0,W', '1,1,E', '2,1,N')))).toEqual(['link']);
  });
});

describe('the ways round a route', () => {
  it('are none where the level makes its player use the part: the search saw every board and found no way', () => {
    expect(bypassesOf(PUSHED, way('2,0,W', '3,2,W,p'))).toEqual([
      { part: 'floor', way: null, settled: true },
      { part: 'push', way: null, settled: true },
    ]);
    const round = bypassesOf(DOWN_AND_UP, way('2,0,W', '3,2,W,p', '1,3,E'));
    expect(round.map((bypass) => bypass.part)).toEqual(['link', 'floor', 'push', 'up']);
    expect(round.every((bypass) => bypass.way === null && bypass.settled)).toBe(true);
  });

  it('are found where a part only makes the way shorter: a move more, and the board is cleared without it', () => {
    const [link, glass] = bypassesOf(BESIDE, way('2,0,W', '1,1,N'));
    // Three 2s where pairs go: the third is a link whatever is done.
    expect(link).toEqual({ part: 'link', way: null, settled: true });
    expect(glass.part).toBe('glass');
    expect(glass.way).toHaveLength(3);
    expect(glass.way!.map(moveText)).toEqual(['2,0,W', '1,1,E', '2,1,N']);
    expect(replay(BESIDE, glass.way!).endReason).toBe('passed');
  });

  it('are looked for no further than the slack: with none, a way a move longer is no way round', () => {
    const [, glass] = bypassesOf(BESIDE, way('2,0,W', '1,1,N'), { slack: 0 });
    expect(glass).toEqual({ part: 'glass', way: null, settled: true });
  });

  it('are none round the walk over a leaving combo where the next die has to be rolled: from the floor a die is only pushed', () => {
    expect(bypassesOf(BRIDGED, way('2,0,W', '0,1,S'))).toEqual([{ part: 'bridge', way: null, settled: true }]);
  });

  it('are found round that walk where a push does as well: the die is pushed onto the corner die, which is leaving, and rolled from there', () => {
    const [link, bridge] = bypassesOf(OVER, way('2,0,W', '0,1,E'));
    expect(link).toEqual({ part: 'link', way: null, settled: true });
    expect(bridge.part).toBe('bridge');
    expect(bridge.way!.map(moveText)).toEqual(['2,0,W', '0,1,N,p', '0,0,E']);
    expect(replay(OVER, bridge.way!).endReason).toBe('passed');
    expect(partsOf(scoreOf(OVER, bridge.way!))).not.toContain('bridge');
  });
});
