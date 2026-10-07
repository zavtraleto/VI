import { describe, expect, it } from 'vitest';
import type { LevelSpec, PuzzleDie } from '../rules/types';
import { editsOf, probeEdits } from './edits';
import { LEVELS } from './levels';

/** A board of the ladder where 2s work: three cells a side, the player on the first die named. */
function board(dice: readonly PuzzleDie[], more: Partial<LevelSpec> = {}): LevelSpec {
  return {
    id: 'test', seed: 1, size: 3, values: [2], faces: [2], sinkMoves: 2, liftMoves: 1, norm: dice.length, arrival: 'none', goal: { kind: 'clear' }, moves: 0,
    layout: { dice, start: { x: dice[0].x, z: dice[0].z } },
    ...more,
  };
}
/** A die in the corner and a 2 two cells off; the level keeps a way that is not looked at here. */
const TWO_DICE = board([{ x: 0, z: 0, top: 6, north: 3 }, { x: 2, z: 0, top: 2, north: 1 }], { par: 1, exact: true, solution: ['0,0,E'] });

describe('the boards one change away from a level', () => {
  it('are every die turned to each other face, moved to each free cell beside it, and the player started on each other die', () => {
    const edits = editsOf(TWO_DICE);
    const whats = edits.map((edit) => edit.what);
    // Five other faces to a die; the corner die has two free cells beside it, the other three; one other die to start on.
    expect(whats.filter((what) => what.includes('turned'))).toHaveLength(10);
    expect(whats.filter((what) => what.includes('moved'))).toEqual(['die 0,0 moved east', 'die 0,0 moved south', 'die 2,0 moved south', 'die 2,0 moved west']);
    expect(whats.filter((what) => what.startsWith('start'))).toEqual(['start at 2,0']);
    expect(new Set(whats).size).toBe(edits.length);
  });

  it('leave the level as it was, and keep nothing of its way', () => {
    const before = JSON.stringify(TWO_DICE);
    const edits = editsOf(TWO_DICE);
    expect(JSON.stringify(TWO_DICE)).toBe(before);
    for (const { spec } of edits) {
      expect(spec.solution).toBeUndefined();
      expect(spec.par).toBeUndefined();
      expect(spec.exact).toBeUndefined();
      expect(spec.layout!.dice).toHaveLength(2);
    }
  });

  it('take the player along with the die they stand on', () => {
    const moved = editsOf(TWO_DICE).find((edit) => edit.what === 'die 0,0 moved south')!.spec.layout!;
    expect(moved.start).toEqual({ x: 0, z: 1 });
    expect(moved.dice[0]).toMatchObject({ x: 0, z: 1, top: 6 });
    const turned = editsOf(TWO_DICE).find((edit) => edit.what === 'die 2,0 turned to 5')!.spec.layout!;
    expect(turned.dice[1]).toMatchObject({ x: 2, z: 0, top: 5 });
    expect(turned.start).toEqual({ x: 0, z: 0 });
  });

  it('move no die onto a cell that is cut out of the board, and leave the board its shape', () => {
    // The cell between the two dice is gone: neither is moved towards the other.
    const cut = { ...TWO_DICE, holes: [{ x: 1, z: 0 }] };
    const edits = editsOf(cut);
    expect(edits.map((edit) => edit.what).filter((what) => what.includes('moved'))).toEqual(['die 0,0 moved south', 'die 2,0 moved south']);
    // Nothing else is taken away: the dice are turned and the player started as on the square board.
    expect(edits.filter((edit) => !edit.what.includes('moved')).map((edit) => edit.what)).toEqual(editsOf(TWO_DICE).filter((edit) => !edit.what.includes('moved')).map((edit) => edit.what));
    for (const { what, spec } of edits) {
      expect(spec.holes, what).toEqual([{ x: 1, z: 0 }]);
      for (const die of spec.layout!.dice) expect([die.x, die.z], what).not.toEqual([1, 0]);
      expect([spec.layout!.start.x, spec.layout!.start.z], what).not.toEqual([1, 0]);
    }
  });

  it('keep every die of a level of the game on the cells its board has', () => {
    const levels = LEVELS.filter((level) => (level.holes?.length ?? 0) > 0);
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) {
      const cut = new Set(level.holes!.map((cell) => `${cell.x},${cell.z}`));
      const edits = editsOf(level);
      // A board with room on it has dice to move.
      expect(edits.some((edit) => edit.what.includes('moved')), level.id).toBe(true);
      for (const { what, spec } of edits) {
        expect(spec.holes, `${level.id}: ${what}`).toEqual(level.holes);
        for (const die of spec.layout!.dice) expect(cut.has(`${die.x},${die.z}`), `${level.id}: ${what}`).toBe(false);
        expect(new Set(spec.layout!.dice.map((die) => `${die.x},${die.z}`)).size, `${level.id}: ${what}`).toBe(spec.layout!.dice.length);
        expect(cut.has(`${spec.layout!.start.x},${spec.layout!.start.z}`), `${level.id}: ${what}`).toBe(false);
      }
    }
  });

  it('are none for a level with no board of its own', () => {
    const { layout: _layout, ...seeded } = TWO_DICE;
    expect(editsOf(seeded)).toEqual([]);
  });
});

describe('the edits a rating takes', () => {
  it('come the best first, and those the rating turns away do not come at all', () => {
    // The fewer moves the better; a board cleared in one move, or not at all, is turned away.
    const kept = probeEdits(TWO_DICE, (told) => (told.par === null || told.par < 2 ? null : -told.par), { runs: 1 });
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(editsOf(TWO_DICE).length);
    const ratings = kept.map((entry) => entry.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    for (const { report, rating } of kept) {
      expect(report.par).toBeGreaterThanOrEqual(2);
      expect(rating).toBe(-report.par!);
    }
  }, 120_000);

  it('are told what was changed', () => {
    const seen: string[] = [];
    probeEdits(TWO_DICE, (_told, edit) => {
      seen.push(edit.what);
      return null;
    }, { runs: 1 });
    expect(seen).toContain('die 2,0 moved west');
  }, 120_000);
});
