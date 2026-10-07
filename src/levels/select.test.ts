import { describe, expect, it } from 'vitest';
import { scoreOf } from '../rules/levelScore';
import { moveOf, solveLevel, tryWay } from '../rules/levelSolver';
import { ori } from '../rules/testkit';
import type { LevelLayout, Orientation, PuzzleDie } from '../rules/types';
import { FROM_ROUTE, SKETCH, levelId } from './generate';
import type { Recipe } from './recipes';
import { layFromRoute } from './route';
import { MEASURE_HEAD, gather, judge, levelSource, measureRow } from './select';

/** A die of a board, lying as the faces given say. */
const die = (x: number, z: number, faces: Partial<Orientation>): PuzzleDie => {
  const lie = ori(faces);
  return { x, z, top: lie.top, north: lie.north };
};

/**
 * A board laid by hand. Two 3s stand at (1,1) and (1,2), beside the die the player is on, at
 * (0,2), which has its 3 to the west: a roll east would lay it on top, and they stand in the
 * way. Rolled north twice, past them, and then east, the die lays the 3 on top above them.
 */
const RIDE: LevelLayout = { start: { x: 0, z: 2 }, dice: [die(1, 1, { top: 3 }), die(1, 2, { top: 3 }), die(0, 2, { top: 6, west: 3 })] };

/** A place of three dice where 3s work, with its floor shut and one board laid by hand. */
const place: Recipe = { slot: 901, id: 'X01', chapter: 0, size: 3, dice: 3, faces: [3], compact: false, par: [3, 3], floor: false, sketch: [RIDE] };
const first = SKETCH + 1;

describe('a place judged', () => {
  it('takes a board laid by hand as it takes one laid from a seed, and names its level as the place says', () => {
    const { fit, why } = judge({ ...place, safe: true, ownOnly: true, ride: true, under: false, guard: true, guide: true, until: 'combo', lesson: 'lineSide' }, first);
    expect(why).toBe('');
    expect(fit!.par).toBe(3);
    expect(fit!.exact).toBe(true);
    expect(fit!.spec).toMatchObject({ id: 'X01', chapter: 0, floor: false, guard: true, guide: true, until: 'combo', lesson: 'lineSide', faces: [3] });
    expect(fit!.spec.solution).toEqual(['0,2,N', '0,1,N', '0,0,E']);
    expect(fit!.tail).toBe(0);
  });

  it('has no board where the place has laid none by that number', () => {
    expect(judge(place, SKETCH + 2).why).toBe('no board laid');
    expect(levelId(place)).toBe('X01');
  });

  it('turns a board away by what is read off it before it is solved', () => {
    expect(judge({ ...place, faces: [2], safe: true }, first).why).toBe('not a board of one combo');
    expect(judge({ ...place, floor: undefined, safe: true }, first).why).toBe('not a board of one combo');
    expect(judge({ ...place, under: true }, first).why).toBe('no die with a working face at the bottom');
    expect(judge({ ...place, faces: [4], par: [1, 9], under: false }, first).why).toBe('a die with a working face at the bottom');
  });

  it('turns a board away by what its way is, and says which', () => {
    expect(judge({ ...place, combos: 2 }, first).why).toBe('combos not 2');
    expect(judge({ ...place, far: 1 }, first).why).toBe('the die of the first move is nearer than 1 steps');
    expect(judge({ ...place, movers: 2 }, first).why).toBe('fewer dice moved than 2');
    expect(judge({ ...place, tail: [1, 2] }, first).why).toBe('tail not 1-2');
    expect(judge({ ...place, firsts: [9, 9] }, first).why).toBe('first moves not 9');
  });

  it('counts the first moves that keep the board in hand where the place asks', () => {
    expect(judge(place, first).fit!.firsts).toBeNull();
    expect(judge({ ...place, firsts: [1, 12] }, first).fit!.firsts).toBeGreaterThanOrEqual(1);
  });

  it('asks the players made of the rules last, and keeps what they came to', () => {
    expect(judge(place, first).fit!.personas).toBeNull();
    const { fit } = judge({ ...place, casual: [0, 1] }, first);
    expect(fit!.personas!.casual).toBeGreaterThanOrEqual(0);
    expect(fit!.personas!.planner).toBeLessThanOrEqual(1);
    expect(judge({ ...place, hasty: [2, 2] }, first).why).toBe('hasty not 2');
    expect(judge({ ...place, gap: [2, 3] }, first).why).toBe('gap not 2-3');
    // Four personas play the board a dozen times each, for every board judged so.
  }, 30_000);

  it('writes a level into the list with what its place gave it', () => {
    const { fit } = judge({ ...place, guard: true, guide: true, until: 'combo', lesson: 'lineSide', story: 'storyHello' }, first);
    const source = levelSource(fit!.spec);
    expect(source).toContain("id: 'X01', chapter: 0,");
    expect(source).toContain("floor: false, guard: true, lesson: 'lineSide', until: 'combo', guide: true, story: 'storyHello'");
  });
});

/** A board laid by hand; the player starts on the first die named. */
const laid = (...dice: PuzzleDie[]): LevelLayout => ({ start: { x: dice[0].x, z: dice[0].z }, dice });

/** The die of the start shows its 2 rolled west, beside the 2 in the corner: the pair every board below begins with. */
const MOVER = die(2, 0, { top: 6, east: 2 });
const CORNER = die(0, 0, { top: 2 });
/**
 * A second pair down the west side: a die beside the corner die that shows its 2 rolled south,
 * and a 2 two cells below it. It is come to over the first pair while that is leaving, and it has
 * to be rolled: there is no way round that walk.
 */
const TWO_PAIRS = laid(MOVER, CORNER, die(0, 1, { top: 6, north: 2 }), die(0, 3, { top: 2 }));
/** A third die beside the corner die, rolled east to the pair: come to the same way, or pushed onto the corner die from the floor and rolled from there. */
const OVER = laid(MOVER, CORNER, die(0, 1, { top: 6, west: 2 }));
/** A third die beside the die that makes the pair: rolled over it at once, or round the corner in two rolls, on the last move the pair is there for. */
const LATE = laid(MOVER, CORNER, die(1, 1, { top: 6, south: 2 }));
/**
 * The second pair is a 2 under the die of the start and a die in the east corner that shows its
 * 2 rolled south. The pair in the west corner made first leaves the player on it with no die a
 * step away, and the board cannot be cleared from the floor: a trap of the floor.
 */
const CUT_OFF = laid(MOVER, CORNER, die(2, 1, { top: 2 }), die(3, 0, { top: 6, north: 2 }));

/** A place of pairs with a route: a pair, and a second pair. Its boards are those laid by hand above, and those its route lays. */
const pairs: Recipe = {
  slot: 902, id: 'X02', chapter: 0, size: 4, dice: 4, faces: [2], compact: false, par: [2, 2],
  scenes: [{ event: 'combo', face: 2, by: 'roll' }, { event: 'combo', face: 2, by: 'roll' }],
  sketch: [TWO_PAIRS, OVER, LATE, CUT_OFF],
};
/** The boards of three dice of that place. */
const three: Recipe = { ...pairs, dice: 3 };
/** The seeds of the boards laid by hand, in the order the place has them. */
const twoPairs = SKETCH + 1;
const over = SKETCH + 2;
const late = SKETCH + 3;
const cutOff = SKETCH + 4;

describe('the route of a way, judged', () => {
  it('is kept with the board: its signs and the kind of route it is', () => {
    const { fit, why } = judge(pairs, twoPairs);
    expect(why).toBe('');
    expect(fit).toMatchObject({ par: 2, exact: true, route: 'K ~ K', kind: 'bridge', tail: 1, clears: 2 });
    expect(fit!.spec.solution).toEqual(['2,0,W', '0,1,S']);
    expect(judge(three, late).fit).toMatchObject({ route: 'K L', kind: 'top' });
  });

  it('turns a board away for a route of another kind than the place asks for', () => {
    expect(judge({ ...pairs, kinds: ['top'] }, twoPairs).why).toBe('a route that is bridge');
    expect(judge({ ...pairs, kinds: ['downLast', 'downAndUp', 'other'] }, twoPairs).why).toBe('a route that is bridge');
    expect(judge({ ...three, kinds: ['bridge'] }, late).why).toBe('a route that is top');
    expect(judge({ ...pairs, kinds: ['top', 'bridge'] }, twoPairs).fit).not.toBeNull();
  });

  it('turns a board away for a route that does not read as the pattern of the place', () => {
    // A push that makes a combo is written `P`: there is none on this way.
    expect(judge({ ...pairs, route: 'P' }, twoPairs).why).toBe('the route does not read as the place asks');
    expect(judge({ ...pairs, route: '^K ~ K$' }, twoPairs).fit).not.toBeNull();
  });

  it('turns a board away by the score of its way, and says which bound it was', () => {
    expect(judge({ ...pairs, quiet: [1, 2] }, twoPairs).why).toBe('quiet moves not 1-2');
    expect(judge({ ...pairs, counted: [1, 1] }, twoPairs).why).toBe('moves under the count not 1');
    expect(judge({ ...pairs, last: [3, 3] }, twoPairs).why).toBe('the last event not of 3 dice');
    expect(judge({ ...pairs, links: [1, 2] }, twoPairs).why).toBe('links not 1-2');
  });

  it('turns a board away by how its way ends: the event, what it is made with, and the moves a link had to spare', () => {
    expect(judge({ ...pairs, ends: { event: 'link' } }, twoPairs).why).toBe('the way does not end with link');
    expect(judge({ ...pairs, ends: { event: 'combo', how: 'push' } }, twoPairs).why).toBe('the way does not end with a push');
    expect(judge({ ...pairs, ends: { event: 'combo', how: 'roll' } }, twoPairs).fit).not.toBeNull();
    // The die that goes round the corner comes to the pair on its last move; the way over the leaving die is the shorter one, and the place avoids it.
    const round: Recipe = { ...three, par: [2, 3], avoid: ['glass'] };
    expect(judge(round, late).why).toBe('the fewest moves lean on what the place avoids');
    expect(judge({ ...round, ends: { event: 'link', spare: 1 } }, late, { loose: true }).why).toBe('the last link does not come with 1 to spare');
    const kept = judge({ ...round, ends: { event: 'link', how: 'roll', spare: 0 } }, late, { loose: true }).fit!;
    expect(kept).toMatchObject({ par: 3, short: 2, exact: false, route: 'K L', kind: 'top', tail: 2 });
    expect(kept.spec.solution).toEqual(['2,0,W', '1,1,E', '2,1,N']);
  });

  it('turns a board away for a silence under the count longer than the place allows', () => {
    const round: Recipe = { ...three, par: [2, 3], avoid: ['glass'] };
    expect(judge({ ...round, silence: 0 }, late, { loose: true }).why).toBe('a silence longer than 0');
    expect(judge({ ...round, silence: 1 }, late, { loose: true }).fit).not.toBeNull();
  });

  it('keeps a board that meets all of it', () => {
    const asked: Recipe = {
      ...pairs,
      kinds: ['bridge'], route: '^K ~ K$', quiet: [0, 0], counted: [2, 2], last: [2, 2], links: [0, 0], silence: 0, tail: [0, 2],
      ends: { event: 'combo', how: 'roll' }, parts: ['bridge'], islands: 3, room: [12, 12],
    };
    const { fit, why } = judge(asked, twoPairs);
    expect(why).toBe('');
    // The score the board was kept by is the score of the way it keeps.
    const score = scoreOf(fit!.spec, fit!.spec.solution!.map(moveOf));
    expect([score.route, score.kind]).toEqual([fit!.route, fit!.kind]);
  });
});

describe('what is read off a board of a route', () => {
  it('turns it away before it is solved: its free cells, the faces it shows, the faces under them, its clusters', () => {
    expect(judge({ ...pairs, room: [1, 3] }, twoPairs).why).toBe('free cells not 1-3');
    expect(judge({ ...pairs, blind: true }, twoPairs).why).toBe('a die starts showing a face that works');
    expect(judge({ ...pairs, underShare: 0.5 }, twoPairs).why).toBe('too few dice with a working face at the bottom');
    // The die of the start, the corner die with the die beside it, and the 2 below them.
    expect(judge({ ...pairs, islands: 4 }, twoPairs).why).toBe('fewer clusters than 4');
    expect(judge({ ...pairs, islands: 3, room: [12, 12] }, twoPairs).fit).not.toBeNull();
  });
});

describe('the parts of a route a board makes its player use', () => {
  it('are proved with the part taken away: a board with a way round it within a move is turned away', () => {
    expect(judge({ ...three, parts: ['bridge'] }, over).why).toBe('a way round bridge within a move');
    // The third die of three is a link whatever is done.
    expect(judge({ ...three, parts: ['link'] }, over).fit).not.toBeNull();
  });

  it('are kept where there is no way round: the board solved without the part has no way a move longer', () => {
    const { fit } = judge({ ...pairs, parts: ['bridge'] }, twoPairs);
    expect(fit).not.toBeNull();
    expect(solveLevel(fit!.spec, { ban: ['bridge'], maxMoves: fit!.par + 1 })).toMatchObject({ solution: null, exhausted: true });
  });
});

describe('a trap of order, asked of a board', () => {
  /** Three dice where pairs go: the pair at hand is made with one roll, and the third die, a step away, has its 2 on the wrong side to join it in time. */
  const wrongSide: Recipe = { slot: 903, id: 'X03', chapter: 0, size: 3, dice: 3, faces: [2], compact: false, par: [5, 5], sketch: [laid(die(1, 0, { top: 6, west: 2 }), die(2, 1, { top: 2 }), die(1, 1, { top: 6, east: 2 }))] };

  it('turns away a board with no combo at hand that loses it', () => {
    expect(judge({ ...pairs, trap: 'any' }, twoPairs).why).toBe('no combo at hand that loses the board');
  });

  it('keeps a board with one, whatever the trap is, where the place asks for any', () => {
    expect(judge({ ...wrongSide, trap: 'any' }, SKETCH + 1).fit).toMatchObject({ par: 5, route: 'K L' });
    expect(judge({ ...pairs, trap: 'any' }, cutOff).fit).not.toBeNull();
  });

  it('asks for a trap of the floor by name: the combo leaves the player on it with no die to step to', () => {
    expect(judge({ ...wrongSide, trap: 'floor' }, SKETCH + 1).why).toBe('no combo at hand that leaves the player nowhere to step');
    expect(judge({ ...pairs, trap: 'floor' }, cutOff).fit).toMatchObject({ par: 2, kind: 'bridge' });
  });
});

describe('the count of the faces, asked of a board', () => {
  /** A pair and a three, each a roll away; neither face clears the five dice alone. */
  const pairAndThree: Recipe = {
    slot: 904, id: 'X04', chapter: 0, size: 4, dice: 5, faces: [2, 3], compact: false, par: [2, 2],
    sketch: [laid(die(1, 0, { top: 6, west: 2 }), die(3, 0, { top: 2 }), die(2, 1, { top: 3, north: 2 }), die(2, 2, { top: 3, north: 2 }), die(1, 1, { top: 6, north: 3 }))],
  };
  /** Two 3s side by side and a 2 beside them: the three dice go as 2s, and would go as 3s as well. */
  const twoThrees: Recipe = { slot: 905, id: 'X05', chapter: 0, size: 3, dice: 3, faces: [2, 3], compact: false, par: [2, 2], sketch: [laid(die(1, 0, { top: 3, east: 2 }), die(1, 1, { top: 3, south: 2 }), die(0, 1, { top: 2 }))] };

  it('keeps a board that takes both its faces, and turns away one that a single face clears', () => {
    expect(judge({ ...pairAndThree, bothFaces: true }, SKETCH + 1).fit).toMatchObject({ par: 2, route: 'K K', kind: 'top' });
    expect(judge({ ...twoThrees, bothFaces: true }, SKETCH + 1).why).toBe('one face clears the board alone');
  });

  it('keeps a board whose combo nearly made goes as another face, and turns away one whose dice go as what they show', () => {
    const { fit } = judge({ ...twoThrees, decoy: true }, SKETCH + 1);
    expect(fit).not.toBeNull();
    // The two 3s of the start went as 2s.
    expect(tryWay(fit!.spec, fit!.spec.solution!.map(moveOf)).values).toEqual([2, 2]);
    expect(judge({ ...pairAndThree, decoy: true }, SKETCH + 1).why).toBe('no combo nearly made that goes as another face');
  });
});

describe('the boards a route lays, judged', () => {
  const routed: Recipe = { ...pairs, slot: 41, par: [2, 4], sketch: undefined };
  const seeds = Array.from({ length: 40 }, (_, i) => FROM_ROUTE + i + 1);
  const judged = (recipe: Recipe) => gather(recipe, seeds.map((seed) => judge(recipe, seed)));

  it('are kept where their ways are of a kind the place allows, each with the board its seed lays', () => {
    const { fits } = judged({ ...routed, kinds: ['top', 'bridge'] });
    expect(fits.length).toBeGreaterThan(0);
    for (const fit of fits) {
      expect(['top', 'bridge']).toContain(fit.kind);
      expect(fit.spec.layout).toEqual(layFromRoute(routed, fit.seed - FROM_ROUTE));
      expect(tryWay(fit.spec, fit.spec.solution!.map(moveOf)).state.endReason).toBe('passed');
    }
  });

  it('are turned away for a route of another kind, and for a way round the part the place is there for', () => {
    // A board laid for a route goes where the route does more often than not, and not every time.
    expect(judged({ ...routed, kinds: ['bridge'] }).reasons['a route that is top']).toBeGreaterThan(0);
    const proved = judged({ ...routed, kinds: ['bridge'], parts: ['bridge'] });
    expect(proved.reasons['a way round bridge within a move']).toBeGreaterThan(0);
    for (const fit of proved.fits) {
      expect(fit.kind).toBe('bridge');
      expect(solveLevel(fit.spec, { ban: ['bridge'], maxMoves: fit.par + 1 })).toMatchObject({ solution: null, exhausted: true });
    }
  });
});

describe('a board that fits, as a row of the table', () => {
  it('has a cell for every column, the route of its way and the kind of it among them', () => {
    const row = measureRow('2', judge(pairs, twoPairs).fit!);
    expect(row).toHaveLength(MEASURE_HEAD.length);
    const cell = (column: string): string => row[MEASURE_HEAD.indexOf(column)];
    expect([cell('place'), cell('board'), cell('dice'), cell('moves'), cell('exact'), cell('tail')]).toEqual(['2', '4x4', '4', '2', 'yes', '1']);
    expect([cell('route'), cell('kind')]).toEqual(['K ~ K', 'bridge']);
  });

  it('says the fewest moves by any way beside the moves of the way kept, where the way kept is the longer', () => {
    const { fit } = judge({ ...three, par: [2, 3], avoid: ['glass'] }, late, { loose: true });
    const row = measureRow('3', fit!);
    expect(row[MEASURE_HEAD.indexOf('moves')]).toBe('3 (2)');
    expect(row[MEASURE_HEAD.indexOf('exact')]).toBe('no');
  });
});
