import { describe, expect, it } from 'vitest';
import { defaultConfig } from './config';
import {
  ENDINGS, GREEDY, PERSONAS, PERSONA_NAMES, WALKERS, endingOf, measure, neededBy, personaFacts, personaMove, personaPlay, personaRates, personaRun, randomMove, randomMoves, randomPlay, randomRate,
  trapRate, walkFacts, witnessWay,
} from './levelBot';
import { graphOf } from './levelGraph';
import { moveOf, moveText, playMove, replay } from './levelSolver';
import { ALL_ORIENTATIONS, roll } from './orientation';
import { createRun } from './sim';
import type { Dir, LevelSpec, PuzzleDie, RunState } from './types';

/** A board of three cells a side given die by die, where every face works; the player starts on the first die named. */
const board = (dice: readonly PuzzleDie[]): LevelSpec => ({
  id: 'test', seed: 1, size: 3, values: [2, 3], norm: dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0,
  layout: { dice, start: { x: dice[0].x, z: dice[0].z } },
});
/** One roll west makes the pair. */
const PAIR = board([{ x: 2, z: 0, top: 6, north: 3 }, { x: 0, z: 0, top: 2, north: 1 }]);
/** The pair, and a die beside it that comes to it over the die that is going. */
const GLASS = board([{ x: 2, z: 0, top: 6, north: 3 }, { x: 0, z: 0, top: 2, north: 1 }, { x: 1, z: 1, top: 6, north: 5 }]);
const ALONE = board([{ x: 1, z: 1, top: 6, north: 3 }]);

/** Boards of the ladder with a strict floor: 2s work, a combo goes in two moves, no die is climbed from the floor. */
function strict(dice: readonly PuzzleDie[], more: Partial<LevelSpec> = {}): LevelSpec {
  return {
    id: 'test', seed: 1, size: 5, values: [2], faces: [2], sinkMoves: 2, liftMoves: 1, climb: false, norm: dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0,
    layout: { dice, start: { x: dice[0].x, z: dice[0].z } },
    ...more,
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
/** One roll west makes the pair and clears the board. */
const ONE_PAIR = strict([turns(2, 0, 'W'), two(0, 0)]);
/** A third die beside the pair: it comes to it at once over the die that is leaving, or in two rolls round the corner; a roll amiss leaves it alone. */
const LATE = strict([turns(2, 0, 'W'), two(0, 0), turns(1, 1, 'E', 'N')]);
/** After the pair, two more 2s stand apart and a push from the floor brings them together. */
const PUSHED = strict([turns(2, 0, 'W'), two(0, 0), two(3, 2), two(1, 2)]);
/** The same, and a fifth die rolled into the pair the push made: the player comes up by that pair. */
const DOWN_AND_UP = strict([...PUSHED.layout!.dice, turns(1, 3, 'E')]);
/** A third die in the far corner: once the pair is made nothing leads to it, and from the floor it cannot be pushed. */
const CUT_OFF = strict([turns(2, 0, 'W'), two(0, 0), { x: 4, z: 4, top: 6, north: 3 }]);

const start = (spec: LevelSpec): RunState => createRun({ seed: spec.seed, config: defaultConfig(), level: spec });
const played = (spec: LevelSpec, ...moves: string[]): RunState => moves.map(moveOf).reduce(playMove, start(spec));

/** Three levels of the ladder with their floor shut, as they stood when the players were taught the rule of the floor. */
const SHUT: readonly LevelSpec[] = [
  { id: 'T09', chapter: 0, seed: 10874, size: 4, values: [2], norm: 6, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces: [2], sinkMoves: 2, liftMoves: 1, floor: false, guard: true, par: 4, exact: true, solution: ['1,1,N', '1,2,S', '1,3,W', '0,1,E'], layout: { start: { x: 1, z: 2 }, dice: [{ x: 0, z: 0, top: 2, north: 1 }, { x: 0, z: 1, top: 6, north: 4 }, { x: 1, z: 1, top: 4, north: 5 }, { x: 2, z: 1, top: 2, north: 6 }, { x: 0, z: 2, top: 2, north: 4 }, { x: 1, z: 2, top: 4, north: 6 }] } },
  { id: 'C104', chapter: 1, seed: 10299, size: 4, values: [3], norm: 6, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces: [3], sinkMoves: 2, liftMoves: 1, floor: false, guard: true, par: 3, exact: true, solution: ['2,3,E', '3,3,N', '1,1,W'], layout: { start: { x: 1, z: 0 }, dice: [{ x: 0, z: 0, top: 3, north: 5 }, { x: 1, z: 0, top: 3, north: 1 }, { x: 1, z: 1, top: 5, north: 1 }, { x: 2, z: 1, top: 3, north: 6 }, { x: 2, z: 2, top: 3, north: 6 }, { x: 2, z: 3, top: 5, north: 4 }] } },
  { id: 'C109', chapter: 1, seed: 10880, size: 4, values: [3], norm: 6, arrival: 'none', goal: { kind: 'clear' }, moves: 0, faces: [3], sinkMoves: 2, liftMoves: 1, floor: false, guard: true, par: 4, exact: true, solution: ['1,2,E', '3,1,S', '3,2,S', '3,3,W'], layout: { start: { x: 0, z: 3 }, dice: [{ x: 1, z: 1, top: 3, north: 6 }, { x: 2, z: 1, top: 3, north: 5 }, { x: 3, z: 1, top: 6, north: 5 }, { x: 1, z: 2, top: 5, north: 6 }, { x: 0, z: 3, top: 3, north: 1 }, { x: 1, z: 3, top: 3, north: 1 }] } },
];

describe('how a run ends', () => {
  it('is told apart four ways: cleared, a dead end by the count, a dead end of the floor, or still going', () => {
    expect(ENDINGS).toEqual(['passed', 'count', 'floor', 'limit']);
    expect(endingOf(start(ONE_PAIR))).toBe('limit');
    expect(endingOf(played(ONE_PAIR, '2,0,W'))).toBe('passed');
    // The pair is gone two moves after it is made, and the third die is left alone.
    expect(endingOf(played(LATE, '2,0,W', '1,1,S', '1,2,S'))).toBe('count');
    // With the pair made there is nothing to step to, nothing to push and, once down, nothing to do.
    expect(endingOf(played(CUT_OFF, '2,0,W'))).toBe('floor');
  });
});

describe('the random player', () => {
  it('makes any move it can get to, the same ones for one seed', () => {
    const end = randomPlay(PAIR, 3, 12);
    expect(JSON.stringify(randomPlay(PAIR, 3, 12))).toBe(JSON.stringify(end));
    expect(end.levelRun!.moves).toBeLessThanOrEqual(12);
    expect(end.over || end.levelRun!.moves === 12).toBe(true);
  });

  it('gets thirty moves, or four times the fewest', () => {
    expect(randomMoves(1)).toBe(30);
    expect(randomMoves(7)).toBe(30);
    expect(randomMoves(12)).toBe(48);
  });

  it('clears a board in a share of its runs', () => {
    const rate = randomRate(PAIR, 40, 1);
    expect(rate).toBeGreaterThan(0.5);
    expect(rate).toBeLessThanOrEqual(1);
    expect(randomRate(PAIR, 40, 1)).toBe(rate);
    expect(randomRate(ALONE, 10, 1)).toBe(0);
  });

  it('does not step down to the floor while there is a move to make from on top', () => {
    // The pair is made and the third die stands beside it: it can be rolled from on top, or pushed from the floor.
    const made = played(LATE, '2,0,W');
    const seeds = Array.from({ length: 30 }, (_, index) => index + 1);
    for (const seed of seeds) expect(randomMove(made, { rng: seed })!.push, `seed ${seed}`).toBe(false);
    expect(seeds.some((seed) => randomMove(made, { rng: seed }, true)!.push)).toBe(true);
  });

  it('goes down once nothing else is left: the push is all there is', () => {
    const seeds = Array.from({ length: 20 }, (_, index) => index + 1);
    expect(seeds.some((seed) => randomPlay(PUSHED, seed, 30).stats.groundTicks > 0)).toBe(true);
  });
});

describe('the players that plan', () => {
  it('are four, each thinking as far as its bounds let it', () => {
    expect(PERSONA_NAMES).toEqual(['hasty', 'casual', 'careful', 'planner']);
    expect(PERSONAS.planner.depth).toBeGreaterThan(PERSONAS.hasty.depth);
    expect(PERSONAS.planner.slip).toBeLessThan(PERSONAS.hasty.slip);
    const rates = personaRates(PAIR, 6);
    expect(Object.keys(rates)).toEqual(PERSONA_NAMES);
    expect(rates.planner).toBeGreaterThan(0.8);
    expect(JSON.stringify(personaPlay(GLASS, 'careful', 2))).toBe(JSON.stringify(personaPlay(GLASS, 'careful', 2)));
    expect(personaPlay(GLASS, 'planner', 1).endReason).toBe('passed');
  });

  it('play a level with its floor shut as they did before they were taught the floor', () => {
    const [twos, threes, peak] = SHUT;
    const moves = (spec: LevelSpec, name: 'hasty' | 'casual' | 'careful', seed: number) => {
      const end = personaPlay(spec, name, seed);
      return [end.levelRun!.moves, end.endReason];
    };
    expect([moves(twos, 'casual', 3), moves(twos, 'hasty', 7), moves(twos, 'careful', 2)]).toEqual([[4, 'passed'], [12, 'passed'], [4, 'passed']]);
    expect([moves(threes, 'casual', 3), moves(threes, 'hasty', 7), moves(threes, 'careful', 2)]).toEqual([[3, 'passed'], [3, 'passed'], [3, 'passed']]);
    expect([moves(peak, 'casual', 3), moves(peak, 'hasty', 7), moves(peak, 'careful', 2)]).toEqual([[4, 'passed'], [14, 'passed'], [4, 'passed']]);
    expect(personaRates(twos, 6)).toEqual({ hasty: 5 / 6, casual: 1, careful: 1, planner: 1 });
    expect(personaRates(threes, 6)).toEqual({ hasty: 0.5, casual: 5 / 6, careful: 1, planner: 1 });
    expect(personaRates(peak, 6)).toEqual({ hasty: 5 / 6, casual: 5 / 6, careful: 1, planner: 1 });
    expect([randomPlay(twos, 5, 30).levelRun!.moves, randomPlay(threes, 5, 30).levelRun!.moves, randomPlay(peak, 5, 30).levelRun!.moves]).toEqual([30, 23, 30]);
    expect([randomRate(twos, 40), randomRate(threes, 40), randomRate(peak, 40)]).toEqual([0.05, 0.05, 0.1]);
  }, 60_000);

  it('keep the moves they made, as a way the solver can play', () => {
    const { state, way } = personaRun(GLASS, PERSONAS.planner, 1);
    expect(state.endReason).toBe('passed');
    expect(replay(GLASS, way).endReason).toBe('passed');
    expect(way).toHaveLength(state.levelRun!.moves);
  });

  it('do not go down to the floor where there is nothing to gain by it', () => {
    // The pair is made and the third die stands beside it: it is rolled from on top; a push would turn nothing.
    const made = played(LATE, '2,0,W');
    for (let seed = 1; seed <= 30; seed++) {
      expect(personaMove(made, PERSONAS.hasty, { rng: seed })!.push, `seed ${seed}`).toBe(false);
    }
  });

  it('go down where the push is what clears the board, and come up again where the way goes on from on top', () => {
    const pushed = personaRun(PUSHED, GREEDY, 1);
    expect(pushed.state.endReason).toBe('passed');
    expect(pushed.way.map((move) => move.push)).toEqual([false, true]);
    const round = personaRun(DOWN_AND_UP, PERSONAS.planner, 1);
    expect(round.state.endReason).toBe('passed');
    expect(round.way.map(moveText)).toEqual(['2,0,W', '3,2,W,p', '1,3,E']);
  });
});

describe('the greedy player', () => {
  it('sees the move in front of it and never slips', () => {
    expect(GREEDY).toEqual({ depth: 1, budget: 40, slip: 0, counts: false });
  });

  it('is counted by the runs that end at a dead end', () => {
    expect(trapRate(PAIR, 5)).toBe(0);
    // One die cannot be cleared: the first move of every run ends it.
    expect(trapRate(ALONE, 5)).toBe(1);
    expect(trapRate(GLASS, 6)).toBe(trapRate(GLASS, 6));
  });

  it('takes the pair in front of it though it leaves a die nothing leads to; one who counts the dice does not', () => {
    expect(trapRate(CUT_OFF, 10)).toBe(1);
    const counting = { ...PERSONAS.careful, slip: 0 };
    expect(endingOf(personaRun(CUT_OFF, counting, 1, 20).state)).toBe('limit');
  });
});

describe('what the runs of a player come to', () => {
  it('is the share of the runs by how they end', () => {
    const facts = personaFacts(LATE, 'hasty', 20);
    expect(ENDINGS.reduce((sum, ending) => sum + facts.endings[ending], 0)).toBeCloseTo(1);
    expect(facts.endings.count).toBeGreaterThan(0);
    expect(facts.endings.floor).toBe(0);
    expect(personaFacts(CUT_OFF, 'greedy', 5).endings.floor).toBe(1);
  });

  it('says how much longer than the fewest the passes are, and whether they go the route of the level', () => {
    const kept = strict(ONE_PAIR.layout!.dice, { par: 1, exact: true, solution: ['2,0,W'] });
    expect(personaFacts(kept, 'careful', 10)).toMatchObject({ endings: { passed: 1 }, over: 0, match: 1, sameKind: 1 });
    // The level goes down and up again; whoever passes it has to.
    const round = strict(DOWN_AND_UP.layout!.dice, { par: 3, exact: true, solution: ['2,0,W', '3,2,W,p', '1,3,E'] });
    expect(personaFacts(round, 'planner', 3).match).toBe(1);
    // A level that keeps no way has no route to hold its players to.
    expect(personaFacts(ONE_PAIR, 'careful', 4)).toMatchObject({ over: null, match: null, sameKind: null });
  }, 30_000);
});

describe('the witness of a board', () => {
  it('is the shortest way the planner clears it by, as a way the solver can play', () => {
    const way = witnessWay(GLASS, 3)!;
    expect(way.length).toBeGreaterThanOrEqual(2);
    const end = replay(GLASS, way);
    expect(end.endReason).toBe('passed');
    expect(end.levelRun!.moves).toBe(way.length);
    expect(witnessWay(ALONE, 2)).toBeNull();
  });
});

describe('the walker', () => {
  const graph = graphOf(LATE, { depth: 6 });
  const aimless = { bonus: 0, wary: false, patience: 6 };

  it('walks one and the same walk for one seed', () => {
    expect(walkFacts(graph, WALKERS.walker, { runs: 50, seed: 3 })).toEqual(walkFacts(graph, WALKERS.walker, { runs: 50, seed: 3 }));
  });

  it('takes fewer moves the more it leans towards the cleared board', () => {
    const leaning = walkFacts(graph, WALKERS.walker, { runs: 200 })!;
    const lost = walkFacts(graph, aimless, { runs: 200 })!;
    expect(leaning.moves).toBeLessThan(lost.moves);
    expect(leaning.first).toBeGreaterThan(lost.first);
    expect(leaning.moves).toBeGreaterThanOrEqual(2);
  });

  it('begins again at a dead end, and the wary one walks into fewer', () => {
    const plain = walkFacts(graph, WALKERS.walker, { runs: 200 })!;
    const wary = walkFacts(graph, WALKERS.wary, { runs: 200 })!;
    expect(plain.restarts).toBeGreaterThan(0);
    expect(wary.restarts).toBeLessThan(plain.restarts);
  });

  it('never begins again, when wary, on a board nothing is lost on', () => {
    expect(walkFacts(graphOf(ONE_PAIR, { depth: 4 }), WALKERS.wary, { runs: 100 })!.restarts).toBe(0);
  });

  it('counts a run as cleared at the first go only within the moves it is given', () => {
    const free = walkFacts(graph, WALKERS.walker, { runs: 200 })!;
    const tight = walkFacts(graph, WALKERS.walker, { runs: 200, limit: 3 })!;
    expect(tight.first).toBeLessThanOrEqual(free.first);
    expect(tight.first).toBeGreaterThan(0);
  });

  it('says nothing of a graph that is not complete, or that holds no way', () => {
    expect(walkFacts(graphOf(PUSHED, { depth: 4, maxStates: 30 }), WALKERS.walker)).toBeNull();
    expect(walkFacts(graphOf(LATE, { depth: 1 }), WALKERS.walker)).toBeNull();
  });
});

describe('a board measured', () => {
  it('names what it cannot be cleared without', () => {
    // The third die of three is a link whatever is done; over the die that is going is only the short way.
    expect(neededBy(GLASS, 2, ['link', 'glass'])).toEqual(['link']);
  });

  it('is asked of the solver for its moves, and of the players for the rest', () => {
    const measured = measure(GLASS, { skillRuns: 2 });
    expect(measured).toMatchObject({ par: 2, exact: true, depth: 1, uses: ['link', 'glass'], needs: ['link'] });
    expect(measured.way!.map(moveText)).toEqual(['2,0,W', '1,1,N']);
    expect(measured.traps).toBeGreaterThanOrEqual(0);
    expect(measured.random).toBeGreaterThanOrEqual(0);
    expect(Object.keys(measured.personas)).toEqual(PERSONA_NAMES);
  });

  it('is taken at its word where it keeps its way, and the way is played again', () => {
    // A longer way than the fewest: round the die that is going.
    const kept: LevelSpec = { ...GLASS, par: 3, exact: false, solution: ['2,0,W', '1,1,E', '2,1,N'] };
    expect(measure(kept, { skillRuns: 1 })).toMatchObject({ par: 3, exact: false, uses: ['link'] });
    expect(() => measure({ ...kept, solution: ['0,0,E'] }, { skillRuns: 1 })).toThrow(/cannot be made/);
  });

  it('has no way where there is none', () => {
    const measured = measure(ALONE, { skillRuns: 1 });
    expect(measured).toMatchObject({ par: null, way: null, exact: false, traps: 1, random: 0 });
  });
});
