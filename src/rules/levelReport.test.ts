import { describe, expect, it } from 'vitest';
import { REPORT_HEAD, REPORT_PLAYERS, layOut, report, reportRow, scoreText } from './levelReport';
import { moveText } from './levelSolver';
import { ALL_ORIENTATIONS, roll } from './orientation';
import type { Dir, LevelSpec, PuzzleDie } from './types';

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
/** After the pair, two more 2s stand apart and a push brings them together; a fifth die is rolled into that pair from on top. */
const DOWN_AND_UP = strict([turns(2, 0, 'W'), two(0, 0), two(3, 2), two(1, 2), turns(1, 3, 'E')]);
/** A die alone: nothing clears it. */
const ALONE = strict([{ x: 2, z: 2, top: 6, north: 3 }]);

describe('the report of a board', () => {
  it('solves a board that keeps no way, and says all there is to say of it', () => {
    const told = report(DOWN_AND_UP, { runs: 3 });
    expect(told).toMatchObject({ par: 3, exact: true, uses: ['link', 'floor'], needs: ['link', 'floor'] });
    expect(told.way!.map(moveText)).toEqual(['2,0,W', '3,2,W,p', '1,3,E']);
    expect(told.score).toMatchObject({ route: 'K v P ^ L', kind: 'downAndUp' });
    expect(told.bypasses.map((bypass) => bypass.part)).toEqual(['link', 'floor', 'push', 'up']);
    expect(told.bypasses.every((bypass) => bypass.way === null && bypass.settled)).toBe(true);
    expect(told.graph).not.toBeNull();
    expect(told.graph!.ways).toBeGreaterThanOrEqual(1);
    expect(told.walk!.walker.moves).toBeGreaterThanOrEqual(3);
    expect(Object.keys(told.personas)).toEqual([...REPORT_PLAYERS]);
    expect(told.personas.planner).toMatchObject({ endings: { passed: 1 }, over: 0, match: 1 });
    expect(told.traps).toBe(told.personas.greedy.endings.count + told.personas.greedy.endings.floor);
  }, 60_000);

  it('takes a level that keeps its way at its word', () => {
    const kept = strict(DOWN_AND_UP.layout!.dice, { par: 3, exact: false, solution: ['2,0,W', '3,2,W,p', '1,3,E'] });
    expect(report(kept, { runs: 1 })).toMatchObject({ par: 3, exact: false });
    expect(() => report({ ...kept, solution: ['0,0,E'] }, { runs: 1 })).toThrow(/cannot be made/);
  }, 60_000);

  it('says of a board with no way that it has none', () => {
    const told = report(ALONE, { runs: 2 });
    expect(told).toMatchObject({ par: null, way: null, score: null, graph: null, walk: null, bypasses: [], traps: 1, random: 0 });
  });

  it('is a row of a table, a cell to every column of its head', () => {
    const told = report(DOWN_AND_UP, { runs: 2 });
    const row = reportRow(DOWN_AND_UP, told);
    expect(row).toHaveLength(REPORT_HEAD.length);
    expect(row.slice(0, 7)).toEqual(['test', '5x5', '5', '2', '3', 'K v P ^ L', 'downAndUp']);
    expect(row[REPORT_HEAD.indexOf('needs')]).toBe('link floor push up');
    expect(row[REPORT_HEAD.indexOf('round')]).toBe('-');
    expect(row[REPORT_HEAD.indexOf('planner p/c/f/l')]).toBe('100/0/0/0');
    const table = layOut([REPORT_HEAD, row]).split('\n');
    expect(table).toHaveLength(2);
    expect(reportRow(ALONE, report(ALONE, { runs: 1 }))[REPORT_HEAD.indexOf('moves')]).toBe('-');
  }, 60_000);

  it('writes the score of a way out, a row to a move', () => {
    const text = scoreText(report(DOWN_AND_UP, { runs: 1 }).score!).split('\n');
    expect(text).toHaveLength(4);
    expect(text[0]).toMatch(/^move\s+how\s+from\s+floor\s+event\s+face\s+took\s+standing\s+leaving\s+spare$/);
    expect(text[2]).toMatch(/^2\. 3,2,W,p\s+push\s+leaving\s+down\s+combo\s+2\s+2\s+1\s+4\s+-$/);
    expect(text[3]).toMatch(/^3\. 1,3,E\s+roll\s+floor\s+up\s+link\s+2\s+1\s+0\s+3\s+1$/);
  }, 60_000);
});
