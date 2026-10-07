import { describe, expect, it } from 'vitest';
import { moveOf, tryWay } from '../rules/levelSolver';
import { partsOf } from '../rules/levelProof';
import { scoreOf } from '../rules/levelScore';
import { LEVELS, SPARES } from './levels';
import { silenceOf, tailOf } from './measures';

describe('the score of the levels of the game', () => {
  it('counts the longest pause and the tail as the solver and the measures of a board do', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      const way = level.solution!.map(moveOf);
      const told = tryWay(level, way);
      const score = scoreOf(level, way);
      expect(score.pause, level.id).toBe(told.depth);
      expect(score.tail, level.id).toBe(tailOf(told.cleared));
      expect(score.beats, level.id).toHaveLength(way.length);
      // A move is quiet or under the count, and the events of the score are the clearing moves of the way.
      expect(score.quiet + score.counted, level.id).toBe(way.length);
      expect(score.beats.map((beat) => beat.event !== 'none'), level.id).toEqual(told.cleared);
      // The silence under the count is never longer than the longest pause, which counts the move that ends it.
      expect(silenceOf(told.cleared), level.id).toBeLessThan(Math.max(1, score.pause));
    }
  });

  it('gives every level a route in the signs of a route, and ends every way with an event', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      const score = scoreOf(level, level.solution!.map(moveOf));
      expect(score.route, level.id).toMatch(/^[KLOPQUv!^~ ]+$/);
      // The move that clears a board is the one that sends its last dice off.
      expect(score.beats[score.beats.length - 1].event, level.id).not.toBe('none');
      // A way found by a search steps down to the floor and never falls: a fall is what a person does.
      expect(score.route, level.id).not.toContain('!');
    }
  });

  it('calls a route by its kind as its signs read: on top with no floor in it, a bridge with a walk over a leaving combo, and the floor by what is done from it', () => {
    for (const level of [...LEVELS, ...SPARES]) {
      const score = scoreOf(level, level.solution!.map(moveOf));
      const floor = /[vPQU^]/.test(score.route);
      if (score.kind === 'top') expect(score.route, level.id).toMatch(/^[KLO ]+$/);
      if (score.kind === 'bridge') expect(score.route, level.id).toMatch(/^[KLO~ ]*~[KLO~ ]*$/);
      if (score.kind === 'downLast' || score.kind === 'downAndUp' || score.kind === 'other') expect(floor, level.id).toBe(true);
      // Down and up again: a step down, and a way up after it. The push between them is written only where it set something off.
      if (score.kind === 'downAndUp') expect(score.route, level.id).toMatch(/v.*\^/);
      // Down at the last: the way ends with what a push set off.
      if (score.kind === 'downLast') expect(score.route, level.id).toMatch(/[PQU]$/);
      // The parts a way leans on are read off the same score.
      const parts = partsOf(score);
      expect(parts.includes('floor'), level.id).toBe(floor);
      expect(parts.includes('bridge'), level.id).toBe(score.route.includes('~'));
    }
  });
});
