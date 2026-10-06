import { describe, expect, it } from 'vitest';
import { ori } from '../rules/testkit';
import type { LevelLayout, Orientation, PuzzleDie } from '../rules/types';
import { SKETCH, levelId } from './generate';
import type { Recipe } from './recipes';
import { judge, levelSource } from './select';

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
