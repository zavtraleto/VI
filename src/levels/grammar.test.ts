import { describe, expect, it } from 'vitest';
import type { LevelSpec } from '../rules/types';
import { CAMPAIGN, type Stop } from './campaign';
import { HELD, fastGrammar, held, needsOf, slowGrammar } from './grammar';
import { boardOf as anyBoard } from './boardSets';

/**
 * The grammar of the row (docs/superpowers/specs/2026-10-14-vi-campaign-2-design.md, section 3): the
 * rules of which board may stand after which, held against the row as it is built and against rows
 * made wrong on purpose.
 */

const boardOf = (id: string): LevelSpec => anyBoard(id);

/** A row of the boards named, each with what the row says of it, or what is given here instead. */
function rowOf(entries: readonly (string | [string, Partial<Stop>])[]): Stop[] {
  return entries.map((entry, index) => {
    const [id, over] = typeof entry === 'string' ? [entry, {}] : entry;
    const place = CAMPAIGN.find((one) => one.code === id);
    const meta = place ? { chapter: place.chapter, role: place.role, teaches: place.teaches, archetype: place.archetype, event: place.event } : { chapter: 1, role: 'apply' as const, archetype: id };
    return { spec: boardOf(id), code: id, number: index + 1, help: {}, ...meta, ...over };
  });
}

describe('what a board asks for', () => {
  it('is read off the score of the way it keeps', () => {
    expect(needsOf(boardOf('R08')).has('link')).toBe(true);
    const r11 = needsOf(boardOf('R11'));
    expect(r11.has('walk')).toBe(true);
    expect(r11.has('link')).toBe(false);
    const k23 = needsOf(boardOf('act-k23'));
    expect(k23.has('glass')).toBe(true);
    expect(k23.has('link')).toBe(true);
    const p06 = needsOf(boardOf('P06'));
    expect(p06.has('lift')).toBe(true);
    expect(p06.has('push')).toBe(true);
  });

  it('reads the seven off a way that starts on a die with a working face under and turns it up', () => {
    expect(needsOf(boardOf('act-k17')).has('seven')).toBe(true); // act I, the opening of the seven: a 3 under at the start
    expect(needsOf(boardOf('R07')).has('seven')).toBe(false); // starts on a 4: a 3 under, not a face it works
  });

  it('reads the loop into what a board asks for', () => {
    expect(needsOf(boardOf('B01_s290')).has('loop')).toBe(true);
    expect(needsOf(boardOf('R05')).has('loop')).toBe(false);
  });

  it('counts two faces where combos of two faces go on the way', () => {
    expect(needsOf(boardOf('R09')).has('twoFaces')).toBe(true);
    expect(needsOf(boardOf('R08')).has('twoFaces')).toBe(false);
  });
});

describe('the grammar of the row', () => {
  it('holds on the row as it is built', () => {
    expect(fastGrammar(CAMPAIGN).filter(held)).toEqual([]);
  });

  it('prints what it does not hold yet as warnings: rules 4, 8 and 10', () => expect([...HELD]).toEqual([1, 2, 3, 5, 7, 11]));

  it('asks the lessons with a window to stand seven places apart, and the climb one place after the push: rule 11', () => {
    const row = rowOf([['R11', { help: { hint: 'roadHintWalk' } }], 'R03', 'R04', ['R07', { help: { hint: 'roadHintChain' } }], ['R13', { help: { hint: 'roadHintPush' }, teaches: 'push' }], ['R10', { help: { hint: 'roadHintClimb' }, teaches: 'lift' }]]);
    expect(fastGrammar(row).filter((one) => one.rule === 11).map((one) => one.text)).toEqual([
      'места 1 (R11) и 4 (R07): уроки ближе семи мест',
      'места 4 (R07) и 5 (R13): уроки ближе семи мест',
      'место 6 (R10): подъём сразу после толчка на месте 5',
    ]);
  });

  it('lets a twist that teaches count its own move as brought in: rule 10', () => {
    const row = rowOf([['R07', { role: 'meet', teaches: 'link' }], ['roll-in-1', { role: 'twist', teaches: 'glass' }]]);
    expect(fastGrammar(row).filter((one) => one.rule === 10 && one.text.includes('glass'))).toEqual([]);
  });

  it('says where a move taught is not used after: rule 1', () => {
    const row = rowOf(['R01', 'R02', 'R03', 'R04', 'R05', 'R07', ['R11', { teaches: undefined }], 'two-pairs-2', 'R03']);
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
      ['two-pairs-2', { archetype: 'bridge' }],
    ]).map((stop, index) => at(stop, index + 9));
    expect(fastGrammar(bridges).filter((one) => one.rule === 3)).toEqual([{ rule: 3, at: 11, text: 'места 9–11 — три доски архетипа bridge подряд' }]);
    // Two in a row are a meeting and its use: no word.
    expect(fastGrammar(bridges.slice(0, 2)).filter((one) => one.rule === 3)).toEqual([]);
    const twice = rowOf([['R11', { teaches: undefined, archetype: 'a' }], ['R11', { teaches: undefined, archetype: 'b' }]]);
    expect(fastGrammar(twice).filter((one) => one.rule === 3).map((one) => one.text)).toEqual(['места 1 (R11) и 2 (R11) — одна фигура']);
  });

  it('lets two meetings stand side by side where the first already asked for the move the second brings in: rule 1', () => {
    // R13 pushes after a step down (K v P), so the way down is asked for before R10 names it.
    const row = rowOf([
      ['R13', { chapter: 3, role: 'meet', teaches: 'push', archetype: 'push' }],
      ['R10', { chapter: 3, role: 'meet', teaches: 'lift', archetype: 'lift' }],
      ['R14', { chapter: 3, role: 'apply', archetype: 'a' }],
      ['P06', { chapter: 3, role: 'apply', archetype: 'b' }],
    ]);
    expect(fastGrammar(row).filter((one) => one.rule === 1)).toEqual([]);
    // The other way round R10 does not push, and R13 right after it is a second new move.
    const swapped = [row[1], row[0], row[2], row[3]].map((stop, index) => ({ ...stop, number: index + 1 }));
    expect(fastGrammar(swapped).filter((one) => one.rule === 1).map((one) => one.text)).toContain('место 2 (R13) учит сразу после места 1 (R10)');
  });

  it('says where an archetype of a chapter comes back in the next one but as its twist: rule 3', () => {
    const row = rowOf([
      ['R11', { chapter: 1, role: 'meet', teaches: undefined, archetype: 'bridge' }],
      ['P02', { chapter: 1, role: 'apply', archetype: 'collapse' }],
      ['R09', { chapter: 2, role: 'meet', teaches: undefined, archetype: 'two heaps' }],
      ['two-pairs-1', { chapter: 2, role: 'apply', archetype: 'bridge' }],
    ]);
    expect(fastGrammar(row).filter((one) => one.rule === 3).map((one) => one.text)).toEqual(['место 4 (two-pairs-1) — архетип bridge был в главе 1, а здесь не поворот']);
    // As the twist of the next chapter it is a way back, and it is let be.
    const twist = row.map((stop) => (stop.spec.id === 'two-pairs-1' ? { ...stop, role: 'twist' as const } : stop));
    expect(fastGrammar(twist).filter((one) => one.rule === 3)).toEqual([]);
  });

  it('says where the faces a board names are not those of its way: rule 4', () => {
    const row = rowOf([['R11', { teaches: undefined }], 'act-k22']);
    row[1] = { ...row[1], spec: { ...row[1].spec, faces: [2, 3], values: [2, 3] } };
    expect(fastGrammar(row).filter((one) => one.rule === 4)).toEqual([{ rule: 4, at: 2, text: 'место 2 (act-k22) называет грани 2 3, а на пути — 3' }]);
  });

  it('lets a board name the 1s besides the faces of its way, and refuses `only`: rule 4', () => {
    const row = rowOf([['R11', { teaches: undefined }], 'act-k22']);
    row[1] = { ...row[1], spec: { ...row[1].spec, faces: [1, 3], values: [1, 3] } };
    expect(fastGrammar(row).filter((one) => one.rule === 4)).toEqual([]);
    row[1] = { ...row[1], spec: { ...row[1].spec, only: [3] } };
    expect(fastGrammar(row).filter((one) => one.rule === 4).map((one) => one.text)).toEqual(['место 2 (act-k22) ставит only, а доска ряда его не ставит']);
  });

  it('asks of a place with a window that its board teaches the move of the window and needs it: rule 7', () => {
    const row = rowOf([['R11', { teaches: undefined, help: { hint: 'roadHintWalk' } }], ['R08', { help: { hint: 'roadHintChain' }, teaches: 'walk' }]]);
    expect(fastGrammar(row).filter((one) => one.rule === 7).map((one) => one.text)).toEqual([
      'место 1 (R11): окно roadHintWalk, а доска учит ничему',
      'место 2 (R08): окно roadHintChain, а доска учит walk',
    ]);
    const right = rowOf([['R11', { teaches: 'walk', help: { hint: 'roadHintWalk' } }]]);
    expect(fastGrammar(right).filter((one) => one.rule === 7)).toEqual([]);
  });

  it('asks of a climb window a way up onto a leaving die, not only a way down: rule 7', () => {
    // R13 steps down and pushes (K v P): a way down is no climb.
    const row = rowOf([['R13', { teaches: 'lift', help: { hint: 'roadHintClimb' } }], ['R10', { teaches: 'lift', help: { hint: 'roadHintClimb' } }]]);
    expect(fastGrammar(row).filter((one) => one.rule === 7).map((one) => one.text)).toEqual(['место 1 (R13): окно roadHintClimb, а путь доски не требует lift (^)']);
  });

  it('does not hold a board that teaches the seven to rule 1 — the seven is needed everywhere unsaid', () => {
    const row = rowOf([['R03', { teaches: 'seven', role: 'meet' }], 'R04', 'R05', 'R07']);
    expect(fastGrammar(row).filter((one) => one.rule === 1 && one.text.includes('seven'))).toEqual([]);
  });

  it('names a place with no emotion, three alike in a row, and a board after a peak that is not lighter: rule 8', () => {
    const row = rowOf([['R03', { emotion: 'gift' }], ['R04', { emotion: 'gift' }], ['B01_s290', { emotion: 'gift' }], ['R05', { emotion: undefined, role: 'peak' }], ['R07', { emotion: 'insight', teaches: undefined }]]);
    expect(fastGrammar(row).filter((one) => one.rule === 8).map((one) => one.text)).toEqual([
      'места 1–3 — три доски с эмоцией gift подряд',
      'место 4 (R05) без эмоции',
      'место 5 (R07) после пика на месте 4: 4 ходов, а пик — 3; после пика легче хотя бы на ход',
    ]);
  });

  it('asks of a peak and a twist that their way joins two moves taught before: rule 10', () => {
    const row = rowOf([['R07', { role: 'meet', teaches: 'link' }], ['R11', { role: 'meet', teaches: 'walk' }], ['P12', { role: 'peak' }], ['R09', { role: 'twist', teaches: undefined }]]);
    const facts = () => ({ lost: true, planner: 1, casual: 1, order: false });
    expect(fastGrammar(row).filter((one) => one.rule === 10).map((one) => one.text)).toEqual([
      'место 3 (P12): пик требует lift, а его не вводили раньше',
      'место 3 (P12): пик требует push, а его не вводили раньше',
      'место 3 (P12): пик требует twoFaces, а его не вводили раньше',
      'место 4 (R09): поворот требует twoFaces, а его не вводили раньше',
    ]);
    expect(slowGrammar(row, facts).filter((one) => one.rule === 10).map((one) => one.text)).toEqual(['место 4 (R09): поворот требует один приём (twoFaces), а соединяет не меньше двух']);
  });

  it('counts the order the search found among the moves a twist joins, and asks that it be taught before: rule 10', () => {
    const row = rowOf([['R05', { role: 'meet', teaches: 'order' }], ['R09', { role: 'meet', teaches: 'twoFaces' }], ['two-pairs-2', { role: 'twist' }]]);
    const trap = (stop: Stop) => ({ lost: true, planner: 1, casual: 1, order: stop.spec.id === 'two-pairs-2' });
    expect(slowGrammar(row, trap).filter((one) => one.rule === 10)).toEqual([]);
    const late = [row[1], row[2]].map((stop, index) => ({ ...stop, number: index + 1 }));
    expect(slowGrammar(late, trap).filter((one) => one.rule === 10).map((one) => one.text)).toEqual(['место 2 (two-pairs-2): поворот требует order, а его не вводили раньше']);
  });

  it('says where the board after a meeting is more than a move longer: rule 5', () => {
    const row = rowOf([['R03', { role: 'meet', archetype: 'x' }], ['R08', { archetype: 'y' }]]);
    expect(fastGrammar(row).filter((one) => one.rule === 5)).toEqual([{ rule: 5, at: 2, text: 'место 2 (R08) после встречи на месте 1: 5 ходов, а встреча — 2' }]);
  });
});

describe('the floor and the push before their lesson (the owner, 17 October 2026)', () => {
  // «пол вообще не стоит насильно закрывать… пусть кто сможет, тот толкает сам»: neither is a rule of the row.
  it('lets a board before the meeting of the push keep an open floor and a way that pushes', () => {
    const row = rowOf(['R01', 'R03', ['P06', { chapter: 0, role: 'apply', archetype: 'down and back' }]]);
    row[0] = { ...row[0], spec: { ...row[0].spec, floor: undefined } };
    expect(fastGrammar(row).filter((one) => one.text.includes('толк') || one.text.includes('пол '))).toEqual([]);
  });
});

describe('the slow part of the grammar', () => {
  const easy = { lost: true, planner: 1, without: null };

  it('asks of a board that teaches that it can be lost and that its move is the short way: rule 2, past the first three places', () => {
    const row = rowOf(['R01', ['R02', { chapter: 0, role: 'learn', archetype: 'ride' }], 'R03', ['R04', { chapter: 0, role: 'event', archetype: 'free to fail' }], ['R05', { teaches: undefined }], ['R07', { chapter: 0 }], ['R08', { chapter: 0 }]]);
    // R07 is cleared in 4; without the link in 5 here, a move longer, where a link has to save two.
    const facts = (stop: Stop) => (stop.spec.id === 'R07' ? { lost: false, planner: 1, without: 5 } : easy);
    expect(slowGrammar(row, facts).filter((one) => one.rule === 2).map((one) => one.text)).toEqual([
      'место 6 (R07) учит link, а проиграть на нём нельзя',
      'место 6 (R07) учит link, а без него решение длиннее только на 1 ход',
    ]);
    expect(slowGrammar(row, () => easy)).toEqual([]);
  });

  it('asks of the walk that it save a move, and of the other moves that they save two (уточнено 14 октября по шагу 1)', () => {
    const row = rowOf(['R01', 'R02', 'R03', ['R11', { role: 'meet', teaches: 'walk' }], 'P02', 'two-pairs-2']);
    // R11 is cleared in 3: without the walk in 4 it keeps the rule, in 3 it breaks it.
    const ruleTwo = (without: number) => slowGrammar(row, (stop) => (stop.spec.id === 'R11' ? { ...easy, without } : easy)).filter((one) => one.rule === 2);
    expect(ruleTwo(4)).toEqual([]);
    expect(ruleTwo(3).map((one) => one.text)).toEqual([
      'место 4 (R11) учит walk, а без него решение не длиннее',
    ]);
  });

  it('leaves a board that teaches a move with no ban to the solver out of rule 2: two faces at once', () => {
    const row = rowOf(['R01', 'R02', 'R03', ['R09', { chapter: 2, role: 'meet', teaches: 'twoFaces', archetype: 'two heaps' }], 'two-pairs-1', 'P07']);
    expect(slowGrammar(row, (stop) => (stop.spec.id === 'R09' ? { lost: false, planner: 1, without: 3 } : easy)).filter((one) => one.rule === 2)).toEqual([]);
  });

  it('holds on the row of step 1 with the facts ladder campaign measured on 14 October 2026', () => {
    // lost, the planner's share of thirty runs, and for a board that teaches the fewest moves without its move, looked for up
    // to two over its own: R07 (11 without the link) and roll-onto-1 (was C1-04; 8 without the roll onto a leaving die) are past that, null.
    const measured: Record<string, { lost: boolean; planner: number; without: number | null }> = {
      R01: { lost: false, planner: 1, without: null }, R02: { lost: false, planner: 1, without: null }, R03: { lost: false, planner: 1, without: null },
      R04: { lost: false, planner: 1, without: null }, R05: { lost: true, planner: 1, without: null }, R07: { lost: true, planner: 1, without: null },
      R08: { lost: true, planner: 28 / 30, without: null }, R11: { lost: true, planner: 1, without: 4 }, P02: { lost: true, planner: 28 / 30, without: null },
      'two-pairs-2': { lost: true, planner: 1, without: null }, 'roll-onto-1': { lost: true, planner: 1, without: null }, 'C1-05': { lost: true, planner: 1, without: null },
      'C1-06': { lost: true, planner: 28 / 30, without: null }, 'act-k22': { lost: true, planner: 1, without: null },
    };
    // As the row of step 1 stood: R11 met the walk, R05 taught nothing.
    const row = rowOf(Object.keys(measured).map((id): string | [string, Partial<Stop>] => (id === 'R11' ? [id, { role: 'meet', teaches: 'walk' }] : id === 'R05' ? [id, { role: 'apply', teaches: undefined }] : id)));
    expect(slowGrammar(row, (stop) => measured[stop.spec.id])).toEqual([]);
  });

  it('asks the planner to do as well after a meeting, but for two runs of thirty, and the hardest board of a chapter to stand fourth or later: rule 5', () => {
    const row = rowOf([['R11', { role: 'meet', teaches: 'walk' }], 'P02', 'two-pairs-2', 'act-k22']);
    const shares: Record<string, number> = { R11: 0.9, P02: 0.5, 'two-pairs-2': 0.8, 'act-k22': 1 };
    const facts = (stop: Stop) => ({ ...easy, planner: shares[stop.spec.id] });
    expect(slowGrammar(row, facts).filter((one) => one.rule === 5).map((one) => one.text)).toEqual([
      'место 2 (P02) после встречи на месте 1: планирующий 50%, а на встрече — 90%',
      'самая трудная доска главы 1 — место 2 (P02), 2-я в главе, а должна стоять не раньше 4-й',
    ]);
    // Two runs of thirty under the meeting are not a step down; three are.
    const near = (p02: number) => slowGrammar(row, (stop) => ({ ...easy, planner: stop.spec.id === 'P02' ? p02 : stop.spec.id === 'act-k22' ? 0.5 : 1 })).filter((one) => one.rule === 5);
    expect(near(28 / 30)).toEqual([]);
    expect(near(27 / 30)).toHaveLength(1);
  });

  it('asks of a board that teaches the order that two of the next three are traps of order, by what the search found: rule 1', () => {
    const row = rowOf([['R05', { role: 'meet', teaches: 'order' }], 'two-pairs-2', 'R03', 'R04']);
    const facts = (stop: Stop) => ({ lost: true, planner: 1, casual: 1, order: stop.spec.id === 'two-pairs-2' });
    expect(slowGrammar(row, facts).filter((one) => one.rule === 1).map((one) => one.text)).toEqual(['место 1 (R05) учит order, а из мест 2–4 его требует 1 досок']);
    expect(slowGrammar(row, (stop) => ({ ...facts(stop), order: stop.spec.id !== 'R04' })).filter((one) => one.rule === 1)).toEqual([]);
    // The fast part cannot see a trap, and leaves the count to the slow one.
    expect(fastGrammar(row).filter((one) => one.rule === 1 && one.text.includes('order'))).toEqual([]);
  });

  it('asks the casual persona to do as well after a peak as on it: rule 8', () => {
    const row = rowOf([['R05', { role: 'peak', emotion: 'insight' }], ['R03', { emotion: 'gift' }]]);
    const facts = (stop: Stop) => ({ lost: true, planner: 1, casual: stop.spec.id === 'R03' ? 0.5 : 0.9 });
    expect(slowGrammar(row, facts).filter((one) => one.rule === 8).map((one) => one.text)).toEqual(['место 2 (R03) после пика на месте 1: обычный 50%, а на пике — 90%']);
  });

  it('asks the hardest board of a chapter shorter than four to stand last in it: rule 5 (third campaign, section 14, the tail)', () => {
    const row = rowOf([['R09', { chapter: 3, archetype: 'a' }], ['P06', { chapter: 3, archetype: 'b' }], ['R16', { chapter: 3, role: 'twist', archetype: 'c' }]]);
    const shares = (hard: string) => (stop: Stop) => ({ ...easy, planner: stop.spec.id === hard ? 0.5 : 1 });
    expect(slowGrammar(row, shares('R16')).filter((one) => one.rule === 5)).toEqual([]);
    expect(slowGrammar(row, shares('P06')).filter((one) => one.rule === 5).map((one) => one.text)).toEqual(['самая трудная доска главы 3 — место 2 (P06), 2-я в главе, а должна стоять последней']);
  });

  it('does not hold the meeting of a chapter to the rest that ends the chapter before it', () => {
    const row = rowOf(['R01', 'R02', 'R03', 'act-k22', ['R09', { chapter: 2, role: 'meet', teaches: 'twoFaces', archetype: 'two heaps' }], 'two-pairs-1']);
    expect(slowGrammar(row, (stop) => ({ ...easy, planner: stop.spec.id === 'R09' ? 0.6 : 1 })).filter((one) => one.rule === 5 && one.text.includes('после встречи'))).toEqual([]);
  });
});
