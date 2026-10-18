import { describe, expect, it } from 'vitest';
import { goalFaces, goalOf } from './goalFaces';
import { ROW } from './row.gen';

const placed = (code: string) => ROW.places.find((place) => place.code === code)!.spec;

describe('the faces a level asks for', () => {
  it('are those on the way of the board, smallest first, whatever faces its chapter names', () => {
    expect(goalFaces(placed('H06'))).toEqual([3]);
    expect(goalFaces(placed('R11'))).toEqual([2, 3]);
    // Named 2 and 3 (as its file did before step 2 of the third campaign), the way makes one combo of 3s.
    expect(placed('C1-05').faces).toEqual([3]);
    expect(goalFaces({ ...placed('C1-05'), faces: [2, 3] })).toEqual([3]);
  });

  it('are taken from the way of the board on every place of the row, never from the faces it names', () => {
    for (const place of ROW.places) {
      const goal = goalOf(place.spec);
      expect(goal.length, place.code).toBeGreaterThan(0);
      // A count of dice is there only where the goal was read off the way.
      for (const { dice } of goal) expect(dice, place.code).not.toBeNull();
    }
  });

  it('count the dice of each that go on the way', () => {
    // Three 3s, then two 2s.
    expect(goalOf(placed('R11'))).toEqual([
      { face: 2, dice: 2 },
      { face: 3, dice: 3 },
    ]);
    expect(goalOf({ ...placed('R11'), solution: undefined, faces: [2] })).toEqual([{ face: 2, dice: null }]);
  });

  it('are the faces the board names where it keeps no way, or one that does not hold', () => {
    const spec = placed('R11');
    expect(goalFaces({ ...spec, solution: undefined, faces: [3, 2, 1] })).toEqual([2, 3]);
    expect(goalFaces({ ...spec, solution: ['0,0,N'], faces: [4] })).toEqual([4]);
  });
});
