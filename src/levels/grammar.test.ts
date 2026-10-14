import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { CAMPAIGN, type Stop } from './campaign';
import { STOPS } from './chapters';
import { fastGrammar, needsOf, slowGrammar } from './grammar';
import { LEVELS, PARKED } from './levels';
import { ROAD, ROAD_SPARES } from './road';

/**
 * The grammar of the row (docs/superpowers/specs/2026-10-14-vi-campaign-2-design.md, section 3): the
 * rules of which board may stand after which, held against the row as it is built and against rows
 * made wrong on purpose.
 */

const boardOf = (id: string): LevelSpec => [...LEVELS, ...ROAD, ...ROAD_SPARES, ...PARKED].find((spec) => spec.id === id)!;

/** A row of the boards named, each with what the row says of it, or what is given here instead. */
function rowOf(entries: readonly (string | [string, Partial<Stop>])[]): Stop[] {
  return entries.map((entry, index) => {
    const [id, over] = typeof entry === 'string' ? [entry, {}] : entry;
    const meta = STOPS[id] ?? { chapter: 1, role: 'apply' as const, archetype: id };
    return { spec: boardOf(id), number: index + 1, board: { level: index }, ...meta, ...over };
  });
}

describe('what a board asks for', () => {
  it('is read off the score of the way it keeps', () => {
    expect(needsOf(boardOf('R08')).has('link')).toBe(true);
    const r11 = needsOf(boardOf('R11'));
    expect(r11.has('walk')).toBe(true);
    expect(r11.has('link')).toBe(false);
    const k23 = needsOf(boardOf('K23'));
    expect(k23.has('glass')).toBe(true);
    expect(k23.has('link')).toBe(true);
    const p06 = needsOf(boardOf('P06'));
    expect(p06.has('lift')).toBe(true);
    expect(p06.has('push')).toBe(true);
  });

  it('counts two faces where combos of two faces go on the way', () => {
    expect(needsOf(boardOf('R09')).has('twoFaces')).toBe(true);
    expect(needsOf(boardOf('R08')).has('twoFaces')).toBe(false);
  });
});

describe('the grammar of the row', () => {
  it('holds on the row as it is built', () => {
    expect(fastGrammar(CAMPAIGN)).toEqual([]);
  });

  it('says where a move taught is not used after: rule 1', () => {
    const row = rowOf(['R01', 'R02', 'R03', 'R04', 'R05', 'R07', ['R11', { teaches: undefined }], 'R15', 'R03']);
    expect(fastGrammar(row).filter((one) => one.rule === 1)).toEqual([{ rule: 1, at: 6, text: 'место 6 (R07) учит link, а из мест 7–9 его требует 0 досок' }]);
  });

  it('says where two boards that teach stand side by side: rule 1', () => {
    const row = rowOf(['R07', ['R08', { teaches: 'twoFaces' }], 'P02', 'R08']);
    expect(fastGrammar(row).filter((one) => one.rule === 1).map((one) => one.text)).toContain('место 2 (R08) учит сразу после места 1 (R07)');
  });

  it('says where one archetype runs longer than three, and where a board is another turned: rule 3', () => {
    const bridges = rowOf([
      ['R11', { teaches: undefined }],
      ['P02', { archetype: 'bridge' }],
      ['R15', { archetype: 'bridge' }],
      ['R12', { archetype: 'bridge' }],
    ]);
    expect(fastGrammar(bridges).filter((one) => one.rule === 3)).toEqual([{ rule: 3, at: 4, text: 'места 1–4 — архетип bridge 4 раза подряд' }]);
    const twice = rowOf([['R11', { teaches: undefined, archetype: 'a' }], ['R11', { teaches: undefined, archetype: 'b' }]]);
    expect(fastGrammar(twice).filter((one) => one.rule === 3).map((one) => one.text)).toEqual(['места 1 (R11) и 2 (R11) — одна фигура']);
  });

  it('says where a board of a chapter has faces not of its chapter: rule 4', () => {
    const row = rowOf([['R11', { teaches: undefined }], 'K22']);
    row[1] = { ...row[1], spec: { ...row[1].spec, faces: [3], values: [3] } };
    expect(fastGrammar(row).filter((one) => one.rule === 4)).toEqual([{ rule: 4, at: 2, text: 'место 2 (K22) на гранях 3, а глава 1 — на гранях 2 3' }]);
  });

  it('says where the board after a meeting is more than a move longer: rule 5', () => {
    const row = rowOf([['R03', { role: 'meet', archetype: 'x' }], ['R08', { archetype: 'y' }]]);
    expect(fastGrammar(row).filter((one) => one.rule === 5)).toEqual([{ rule: 5, at: 2, text: 'место 2 (R08) после встречи на месте 1: 5 ходов, а встреча — 2' }]);
  });
});

describe('the slow part of the grammar', () => {
  const easy = { lost: true, planner: 1, shortWithout: false };

  it('asks of a board that teaches that it can be lost and that its move is the short way: rule 2, past the first three places', () => {
    const row = rowOf(['R01', 'R02', 'R03', 'R04', 'R05', 'R07', 'R08']);
    const facts = (stop: Stop) => (stop.spec.id === 'R07' ? { lost: false, planner: 1, shortWithout: true } : easy);
    expect(slowGrammar(row, facts).filter((one) => one.rule === 2).map((one) => one.text)).toEqual([
      'место 6 (R07) учит link, а проиграть на нём нельзя',
      'место 6 (R07) учит link, а без него решение не длиннее чем на ход',
    ]);
    expect(slowGrammar(row, () => easy)).toEqual([]);
  });

  it('asks the planner to do as well after a meeting, and the hardest board of a chapter to stand fourth or later: rule 5', () => {
    const row = rowOf(['R11', 'P02', 'R15', 'K22']);
    const shares: Record<string, number> = { R11: 0.9, P02: 0.5, R15: 0.8, K22: 1 };
    const facts = (stop: Stop) => ({ ...easy, planner: shares[stop.spec.id] });
    expect(slowGrammar(row, facts).filter((one) => one.rule === 5).map((one) => one.text)).toEqual([
      'место 2 (P02) после встречи на месте 1: планирующий 50%, а на встрече — 90%',
      'самая трудная доска главы 1 — место 2 (P02), 2-я в главе, а должна стоять не раньше 4-й',
    ]);
  });
});
