import { describe, expect, it } from 'vitest';
import { moveOf, tryWay } from '../rules/levelSolver';
import { scoreOf } from '../rules/levelScore';
import { LEVELS, SPARES } from './levels';
import { tailOf } from './measures';

describe('the score of the levels of the ladder', () => {
  it('counts the longest pause and the tail as the solver and the measures of a board do', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      const way = level.solution!.map(moveOf);
      const told = tryWay(level, way);
      const score = scoreOf(level, way);
      expect(score.pause, level.id).toBe(told.depth);
      expect(score.tail, level.id).toBe(tailOf(told.cleared));
      expect(score.beats, level.id).toHaveLength(way.length);
    }
  });

  it('gives every level a route, and keeps the levels with their floor shut on top', () => {
    for (const level of LEVELS) {
      const score = scoreOf(level, level.solution!.map(moveOf));
      expect(score.route, level.id).toMatch(/^[KLOPQUv!^~ ]+$/);
      if (level.floor === false) expect(['top', 'bridge'], level.id).toContain(score.kind);
    }
  });
});
