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

  it('says where one archetype runs longer than two, and where a board is another turned: rule 3 (ужесточено 14 октября по плейтесту)', () => {
    const at = (stop: Stop, number: number): Stop => ({ ...stop, number });
    const bridges = rowOf([
      ['R11', { teaches: undefined }],
      ['P02', { archetype: 'bridge' }],
      ['R15', { archetype: 'bridge' }],
    ]).map((stop, index) => at(stop, index + 9));
    expect(fastGrammar(bridges).filter((one) => one.rule === 3)).toEqual([{ rule: 3, at: 11, text: 'места 9–11 — три доски архетипа bridge подряд' }]);
    // Two in a row are a meeting and its use: no word.
    expect(fastGrammar(bridges.slice(0, 2)).filter((one) => one.rule === 3)).toEqual([]);
    const twice = rowOf([['R11', { teaches: undefined, archetype: 'a' }], ['R11', { teaches: undefined, archetype: 'b' }]]);
    expect(fastGrammar(twice).filter((one) => one.rule === 3).map((one) => one.text)).toEqual(['места 1 (R11) и 2 (R11) — одна фигура']);
  });

  it('says where an archetype of a chapter comes back in the next one but as its twist: rule 3', () => {
    const row = rowOf([
      ['R11', { chapter: 1, role: 'meet', teaches: undefined, archetype: 'bridge' }],
      ['P02', { chapter: 1, role: 'apply', archetype: 'collapse' }],
      ['R09', { chapter: 2, role: 'meet', teaches: undefined, archetype: 'two heaps' }],
      ['R12', { chapter: 2, role: 'apply', archetype: 'bridge' }],
    ]);
    expect(fastGrammar(row).filter((one) => one.rule === 3).map((one) => one.text)).toEqual(['место 4 (R12) — архетип bridge был в главе 1, а здесь не поворот']);
    // As the twist of the next chapter it is a way back, and it is let be.
    const twist = row.map((stop) => (stop.spec.id === 'R12' ? { ...stop, role: 'twist' as const } : stop));
    expect(fastGrammar(twist).filter((one) => one.rule === 3)).toEqual([]);
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

describe('no push before its lesson (the owner, 14 October 2026)', () => {
  it('finds no board before the meeting of the push whose way pushes', () => {
    expect(fastGrammar(CAMPAIGN).filter((one) => one.text.includes('толк'))).toEqual([]);
    const row = rowOf(['R01', 'R02', 'R03', ['P06', { chapter: 1, role: 'apply', archetype: 'down and back' }]]);
    expect(fastGrammar(row).filter((one) => one.rule === 1).map((one) => one.text)).toEqual(['место 4 (P06) толкает, а толкать ещё не учили']);
    // After a meeting of the push a board may push.
    const after = rowOf(['R01', 'R02', ['R13', { chapter: 1, role: 'meet', teaches: 'push', archetype: 'push' }], ['P06', { chapter: 1, role: 'apply', archetype: 'down and back' }]]);
    expect(fastGrammar(after).filter((one) => one.text.includes('толкать ещё не учили'))).toEqual([]);
  });

  it('finds no board before the meeting of the push that a push makes shorter, by what the solver found', () => {
    const row = rowOf(['R01', 'R02', 'R03', 'R04']);
    const easy = { lost: true, planner: 1, without: null, pushSaves: 0 };
    expect(slowGrammar(row, () => easy).filter((one) => one.rule === 1)).toEqual([]);
    expect(slowGrammar(row, (stop) => (stop.spec.id === 'R04' ? { ...easy, pushSaves: 2 } : easy)).map((one) => one.text)).toContain(
      'место 4 (R04) толчком короче на 2 хода, а толкать ещё не учили',
    );
  });
});

describe('the slow part of the grammar', () => {
  const easy = { lost: true, planner: 1, without: null };

  it('asks of a board that teaches that it can be lost and that its move is the short way: rule 2, past the first three places', () => {
    const row = rowOf(['R01', 'R02', 'R03', 'R04', 'R05', 'R07', 'R08']);
    // R07 is cleared in 4; without the link in 5 here, a move longer, where a link has to save two.
    const facts = (stop: Stop) => (stop.spec.id === 'R07' ? { lost: false, planner: 1, without: 5 } : easy);
    expect(slowGrammar(row, facts).filter((one) => one.rule === 2).map((one) => one.text)).toEqual([
      'место 6 (R07) учит link, а проиграть на нём нельзя',
      'место 6 (R07) учит link, а без него решение длиннее только на 1 ход',
    ]);
    expect(slowGrammar(row, () => easy)).toEqual([]);
  });

  it('asks of the walk that it save a move, and of the other moves that they save two (уточнено 14 октября по шагу 1)', () => {
    const row = rowOf(['R01', 'R02', 'R03', 'R11', 'P02', 'R15']);
    // R11 is cleared in 3: without the walk in 4 it keeps the rule, in 3 it breaks it.
    const ruleTwo = (without: number) => slowGrammar(row, (stop) => (stop.spec.id === 'R11' ? { ...easy, without } : easy)).filter((one) => one.rule === 2);
    expect(ruleTwo(4)).toEqual([]);
    expect(ruleTwo(3).map((one) => one.text)).toEqual([
      'место 4 (R11) учит walk, а без него решение не длиннее',
    ]);
  });

  it('leaves a board that teaches a move with no ban to the solver out of rule 2: two faces at once', () => {
    const row = rowOf(['R01', 'R02', 'R03', ['R09', { chapter: 2, role: 'meet', teaches: 'twoFaces', archetype: 'two heaps' }], 'R12', 'P07']);
    expect(slowGrammar(row, (stop) => (stop.spec.id === 'R09' ? { lost: false, planner: 1, without: 3 } : easy)).filter((one) => one.rule === 2)).toEqual([]);
  });

  it('holds on the row of step 1 with the facts ladder campaign measured on 14 October 2026', () => {
    // lost, the planner's share of thirty runs, and for a board that teaches the fewest moves without its move, looked for up
    // to two over its own: R07 (11 without the link) and C1-04 (8 without the roll onto a leaving die) are past that, null.
    const measured: Record<string, { lost: boolean; planner: number; without: number | null }> = {
      R01: { lost: false, planner: 1, without: null }, R02: { lost: false, planner: 1, without: null }, R03: { lost: false, planner: 1, without: null },
      R04: { lost: false, planner: 1, without: null }, R05: { lost: true, planner: 1, without: null }, R07: { lost: true, planner: 1, without: null },
      R08: { lost: true, planner: 28 / 30, without: null }, R11: { lost: true, planner: 1, without: 4 }, P02: { lost: true, planner: 28 / 30, without: null },
      R15: { lost: true, planner: 1, without: null }, 'C1-04': { lost: true, planner: 1, without: null }, 'C1-05': { lost: true, planner: 1, without: null },
      'C1-06': { lost: true, planner: 28 / 30, without: null }, K22: { lost: true, planner: 1, without: null },
    };
    const row = rowOf(Object.keys(measured));
    expect(slowGrammar(row, (stop) => measured[stop.spec.id])).toEqual([]);
  });

  it('asks the planner to do as well after a meeting, but for two runs of thirty, and the hardest board of a chapter to stand fourth or later: rule 5', () => {
    const row = rowOf(['R11', 'P02', 'R15', 'K22']);
    const shares: Record<string, number> = { R11: 0.9, P02: 0.5, R15: 0.8, K22: 1 };
    const facts = (stop: Stop) => ({ ...easy, planner: shares[stop.spec.id] });
    expect(slowGrammar(row, facts).filter((one) => one.rule === 5).map((one) => one.text)).toEqual([
      'место 2 (P02) после встречи на месте 1: планирующий 50%, а на встрече — 90%',
      'самая трудная доска главы 1 — место 2 (P02), 2-я в главе, а должна стоять не раньше 4-й',
    ]);
    // Two runs of thirty under the meeting are not a step down; three are.
    const near = (p02: number) => slowGrammar(row, (stop) => ({ ...easy, planner: stop.spec.id === 'P02' ? p02 : stop.spec.id === 'K22' ? 0.5 : 1 })).filter((one) => one.rule === 5);
    expect(near(28 / 30)).toEqual([]);
    expect(near(27 / 30)).toHaveLength(1);
  });

  it('does not hold the meeting of a chapter to the rest that ends the chapter before it', () => {
    const row = rowOf(['R01', 'R02', 'R03', 'K22', ['R09', { chapter: 2, role: 'meet', teaches: 'twoFaces', archetype: 'two heaps' }], 'R12']);
    expect(slowGrammar(row, (stop) => ({ ...easy, planner: stop.spec.id === 'R09' ? 0.6 : 1 })).filter((one) => one.rule === 5 && one.text.includes('после встречи'))).toEqual([]);
  });
});
