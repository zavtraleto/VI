import { describe, expect, it } from 'vitest';
import { factsOf, graphOf } from './levelGraph';
import { solveLevel } from './levelSolver';
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

/** One roll west makes the pair, and the board is clear. */
const PAIR = strict([turns(2, 0, 'W'), two(0, 0)]);
/** After the pair, two more 2s stand apart and a push brings them together. */
const PUSHED = strict([turns(2, 0, 'W'), two(0, 0), two(3, 2), two(1, 2)]);
/** A third die beside the pair: it comes to it at once over the die that is leaving, or in two rolls round the corner; a roll amiss leaves it alone. */
const LATE = strict([turns(2, 0, 'W'), two(0, 0), turns(1, 1, 'E', 'N')]);
/** A third die stands in the far corner: once the pair is made nothing leads to it, and from the floor it cannot be pushed. */
const CUT_OFF = strict([turns(2, 0, 'W'), two(0, 0), { x: 4, z: 4, top: 6, north: 3 }]);

const parOf = (spec: LevelSpec): number => solveLevel(spec).solution!.par;

describe('the graph of a level', () => {
  it('knows from every board the fewest moves to a cleared one: from the start, what the solver says', () => {
    for (const spec of [PAIR, PUSHED, LATE]) {
      const par = parOf(spec);
      const graph = graphOf(spec, { depth: par + 1 });
      expect(graph.complete, spec.layout!.dice.length + ' dice').toBe(true);
      expect(graph.toClear[0]).toBe(par);
      expect(graph.next).toHaveLength(graph.states + 1);
      expect(graph.end[graph.states]).toBe('passed');
      expect(graph.toClear[graph.states]).toBe(0);
      expect(Math.max(...graph.far)).toBeLessThanOrEqual(par + 1);
    }
  });

  it('is the same graph every time', () => {
    const one = graphOf(LATE, { depth: 4 });
    const other = graphOf(LATE, { depth: 4 });
    expect(other.next).toEqual(one.next);
    expect([...other.toClear]).toEqual([...one.toClear]);
  });

  it('goes no further than the moves it is given: a board on the rim leads nowhere', () => {
    const graph = graphOf(PAIR, { depth: 2 });
    graph.far.forEach((moves, at) => {
      if (moves >= 2) expect(graph.next[at]).toEqual([]);
    });
    expect(graphOf(PAIR, { depth: 3 }).states).toBeGreaterThan(graph.states);
  });

  it('says of a board of one pair how many ways are the shortest, and which first moves keep it in hand', () => {
    const facts = factsOf(graphOf(PAIR, { depth: 3 }))!;
    // The die rolls three ways from the start: west into the pair, south and east; from each of the two the pair is two moves on.
    // Nothing on such a board is ever lost: a roll is rolled back.
    expect(facts).toMatchObject({ ways: 1, firsts: 3, firstsAlive: 3, lostIn: -1, alive: 1 });
  });

  it('says how soon a board can be lost: by the count of the dice, or on the floor', () => {
    const late = graphOf(LATE, { depth: 4 });
    expect(late.end.some((how) => how === 'count')).toBe(true);
    // The pair is made on the first move and gone two moves later with the third die left alone.
    expect(factsOf(late)!.lostIn).toBe(3);
    const cut = graphOf(CUT_OFF, { depth: 2 });
    expect(cut.end.some((how) => how === 'floor')).toBe(true);
    expect(factsOf(cut)!.lostIn).toBe(1);
    expect(factsOf(late)!.alive).toBeLessThan(1);
    // A board that ends leads nowhere.
    late.end.forEach((how, at) => {
      if (how !== null) expect(late.next[at]).toEqual([]);
    });
  });

  it('gives up past its limit of boards, and then says nothing of the level', () => {
    const graph = graphOf(PUSHED, { depth: 4, maxStates: 30 });
    expect(graph.complete).toBe(false);
    expect(graph.states).toBe(30);
    expect(factsOf(graph)).toBeNull();
  });
});
