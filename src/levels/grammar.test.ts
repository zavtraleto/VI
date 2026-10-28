import { describe, expect, it, vi } from 'vitest';
import { solveLevel } from '../rules/levelSolver';
import type { LevelSpec } from '../rules/types';
import { CAMPAIGN, type Stop } from './campaign';
import { BARRED, HELD, KNOWN_REPEATS, REPEAT_FROM, WARNING, fastGrammar, held, knownRepeat, lessonOf, markOf, needsOf, repeatsOf, slowGrammar } from './grammar';
import { boardOf as anyBoard } from './boardSets';
import { turnedBoard } from './edits';

vi.mock('../rules/levelSolver', async (original) => {
  const actual = await original<typeof import('../rules/levelSolver')>();
  return { ...actual, solveLevel: vi.fn(actual.solveLevel) };
});

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
  it('holds on the row as it is built, but for the repeats known till the row is rebuilt', () => {
    expect(fastGrammar(CAMPAIGN).filter(held).filter((one) => !knownRepeat(one))).toEqual([]);
  });

  it('prints what it does not hold yet as warnings: rules 4, 8, 10, 11, 13, 14, 15 and 17', () => expect([...HELD]).toEqual([1, 2, 3, 5, 7, 12, 16, 18]));

  it('finds the place a move is taught at, or none', () => {
    const row = rowOf([['act-k17', { role: 'apply' }], ['R07', { role: 'meet', teaches: 'link' }]]);
    expect(lessonOf(row, 'link')).toBe(2);
    expect(lessonOf(row, 'push')).toBe(Infinity);
  });

  it('does not let a board stand before the lesson of a move it cannot do without: rule 12', () => {
    const row = rowOf([['act-k17', { role: 'apply' }], ['R07', { role: 'meet', teaches: 'link' }]]);
    const facts = (stop: Stop) => ({ lost: true, planner: 1, casual: 1, order: false, cleared: stop.spec.id === 'act-k17' ? { link: null } : {} });
    const breach = ['место 1 (act-k17) без link не проходится в 3 хода, а звену учат на месте 2'];
    expect(slowGrammar(row, facts).filter((one) => one.rule === 12).map((one) => one.text)).toEqual(breach);
    // A move longer without the move is a breach too: a board before the lesson is cleared in its own count without it.
    expect(slowGrammar(row, (stop) => ({ ...facts(stop), cleared: { link: 4 } })).filter((one) => one.rule === 12).map((one) => one.text)).toEqual(breach);
    expect(slowGrammar(row, (stop) => ({ ...facts(stop), cleared: { link: 3 } })).filter((one) => one.rule === 12)).toEqual([]);
    // Past the lesson the board may need the move.
    const after = rowOf([['R07', { role: 'meet', teaches: 'link' }], ['act-k17', { role: 'apply' }]]);
    expect(slowGrammar(after, facts).filter((one) => one.rule === 12)).toEqual([]);
  });

  it('warns where the way a board keeps uses a move before its lesson: rule 12, the fast part', () => {
    const row = rowOf([['act-k17', { role: 'apply' }], ['R07', { role: 'meet', teaches: 'link' }]]);
    const warned = fastGrammar(row).filter((one) => one.rule === 12);
    expect(warned.map((one) => one.text)).toEqual(['место 1 (act-k17) по записанному пути требует link, а звену учат на месте 2']);
    expect(warned.some(held)).toBe(false);
    // R05 keeps a way with a link, but its facts say it is cleared as short without one: the slow part is clean.
    const r05 = rowOf([['R05', { role: 'meet', teaches: undefined }], ['R07', { role: 'meet', teaches: 'link' }]]);
    expect(fastGrammar(r05).filter((one) => one.rule === 12).map((one) => one.text)).toEqual(['место 1 (R05) по записанному пути требует link, а звену учат на месте 2']);
    expect(slowGrammar(r05, () => ({ lost: true, planner: 1, casual: 1, order: false, cleared: { link: 3 } })).filter((one) => one.rule === 12)).toEqual([]);
  });

  it('reads the climb alone as the lift of rule 12: a way down and a push are not it', () => {
    // floor-first-1 steps down and pushes (K v P) before the climb is taught.
    const row = rowOf([['floor-first-1', { role: 'meet', teaches: 'push' }], ['lift-first-1', { role: 'meet', teaches: 'lift' }]]);
    expect(fastGrammar(row).filter((one) => one.rule === 12)).toEqual([]);
  });

  it('warns where a goal face is not to be seen at the start: rule 13', () => {
    const r03 = rowOf(['R03']);
    expect(fastGrammar(r03).filter((one) => one.rule === 13)).toEqual([]);
    // R03 shows a 2, 4 and 6 at the start; a goal of 5s is nowhere to be seen.
    const hidden = [{ ...r03[0], spec: { ...r03[0].spec, faces: [5], values: [5], solution: undefined } }];
    expect(fastGrammar(hidden).filter((one) => one.rule === 13).map((one) => one.text)).toEqual(['место 1 (R03): грань 5 не видна в начале']);
    expect(fastGrammar(hidden).filter((one) => one.rule === 13).some(held)).toBe(false);
  });

  it('does not hold two faces to rule 1: it is no lesson', () => {
    const row = rowOf([['R11', { role: 'meet', teaches: 'twoFaces' }], 'R03', 'R01', 'R03']);
    expect(fastGrammar(row).filter((one) => one.rule === 1 && one.text.includes('twoFaces'))).toEqual([]);
  });

  it('asks the lessons with a window to stand seven places apart, and the climb one place after the push: rule 11', () => {
    const row = rowOf([['R11', { help: { hint: 'roadHintWalk' } }], 'R03', 'R04', ['R07', { help: { hint: 'roadHintChain' } }], ['R13', { help: { hint: 'roadHintPush' }, teaches: 'push' }], ['R10', { help: { hint: 'roadHintClimb' }, teaches: 'lift' }]]);
    expect(fastGrammar(row).filter((one) => one.rule === 11).map((one) => one.text)).toEqual([
      'места 1 (R11) и 4 (R07): уроки ближе семи мест',
      'места 4 (R07) и 5 (R13): уроки ближе семи мест',
      'место 6 (R10): подъём сразу после толчка на месте 5',
    ]);
  });

  it('asks the window of the pushed 1 for the 1s and the push both: rule 7', () => {
    const row = rowOf([['R07', { role: 'meet', teaches: 'ones', help: { hint: 'hintOnesPush' } }]]);
    expect(fastGrammar(row).filter((one) => one.rule === 7).map((one) => one.text)).toEqual([
      'место 1 (R07): окно hintOnesPush, а путь доски не требует ones',
      'место 1 (R07): окно hintOnesPush, а путь доски не требует push',
    ]);
  });

  it('puts the window of the pushed 1 after that of the 1s, and counts the 1s among the lessons a block apart: rule 11', () => {
    const rule11 = (row: Stop[]) => fastGrammar(row).filter((one) => one.rule === 11).map((one) => one.text);
    expect(rule11(rowOf([['R11', { help: { hint: 'hintOnes' } }], ['R03', { help: { hint: 'hintOnesPush' } }]]))).toEqual(['место 2 (R03): окно толчка единицы сразу после окна единиц на месте 1']);
    expect(rule11(rowOf([['R03', { help: { hint: 'hintOnesPush' } }]]))).toEqual(['место 1 (R03): окно толчка единицы, а окна единиц раньше нет']);
    expect(rule11(rowOf([['R11', { help: { hint: 'hintOnes' } }], 'R04', ['R03', { help: { hint: 'hintOnesPush' } }]]))).toEqual([]);
    expect(rule11(rowOf([['R11', { help: { hint: 'roadHintWalk' } }], 'R03', ['R07', { help: { hint: 'hintOnes' } }]]))).toEqual(['места 1 (R11) и 3 (R07): уроки ближе семи мест']);
  });

  it('bars the 1s before their lesson as the other moves: rule 12', () => {
    expect(BARRED).toContain('ones');
    const row = rowOf([['R03', { role: 'apply' }], ['R07', { role: 'meet', teaches: 'ones' }]]);
    const facts = (stop: Stop) => ({ lost: true, planner: 1, casual: 1, order: false, cleared: stop.number === 1 ? { ones: null } : {} });
    expect(slowGrammar(row, facts).filter((one) => one.rule === 12).map((one) => one.text)).toEqual(['место 1 (R03) без ones не проходится в 2 хода, а единицам учат на месте 2']);
    const none = rowOf([['R03', { role: 'apply' }]]);
    expect(slowGrammar(none, facts).filter((one) => one.rule === 12).map((one) => one.text)).toEqual(['место 1 (R03) без ones не проходится в 2 хода, а единицам в ряду не учат']);
  });

  // R03 makes 2s, H06 3s, R11 2s and 3s, broom-3 1s and 4s: rule 14 counts the 4 alone.
  const rule14 = (codes: readonly string[]) => fastGrammar(rowOf(codes)).filter((one) => one.rule === 14);

  it('asks ten places in a row from the twentieth for three goal faces: rule 14, a warning', () => {
    const first = Array.from({ length: 19 }, (_, i) => (i % 2 === 0 ? 'R03' : 'H06'));
    const twos = rule14([...first, ...Array.from({ length: 10 }, () => 'R03')]);
    expect(twos.filter((one) => !one.text.includes('подряд')).map((one) => one.text)).toEqual(['места 20–29: грани цели только 2']);
    expect(twos.some(held)).toBe(false);
    const spread = ['R03', 'H06', 'broom-3', 'R03', 'H06', 'broom-3', 'R03', 'H06', 'broom-3', 'R03'];
    expect(rule14([...first, ...spread])).toEqual([]);
    // Fewer than twenty places: no window to ask of.
    expect(rule14(first)).toEqual([]);
  });

  it('says three boards in a row with the same goal faces: rule 14, a warning', () => {
    const found = rule14(['R03', 'H06', 'R03', 'H06', 'R11', 'R11', 'R11', 'H06']);
    expect(found.map((one) => one.text)).toEqual(['места 5–7 — три доски подряд с гранями 2 3']);
    expect(found.some(held)).toBe(false);
  });

  it('asks twelve places in a row for five emotions and no archetype more than three times: rule 15, a warning', () => {
    const emotions = ['gift', 'flow', 'insight', 'trick'] as const;
    const four = rowOf(Array.from({ length: 12 }, (_, i): [string, Partial<Stop>] => ['R03', { emotion: emotions[i % 4], archetype: `a${i}` }]));
    const found = fastGrammar(four).filter((one) => one.rule === 15);
    expect(found.map((one) => one.text)).toEqual(['места 1–12: эмоций четыре (gift, flow, insight, trick), а нужно пять']);
    expect(found.some(held)).toBe(false);
    const all = ['gift', 'flow', 'insight', 'trick', 'surprise'] as const;
    const bridges = rowOf(Array.from({ length: 12 }, (_, i): [string, Partial<Stop>] => ['R03', { emotion: all[i % 5], archetype: i % 3 === 0 ? 'bridge' : `a${i}` }]));
    expect(fastGrammar(bridges).filter((one) => one.rule === 15).map((one) => one.text)).toEqual(['места 1–12: архетип bridge четыре раза']);
    // A row shorter than twelve is not asked.
    expect(fastGrammar(four.slice(0, 11)).filter((one) => one.rule === 15)).toEqual([]);
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

  it('does not count the 1s a way sends among the faces of rule 4: broom-3 names 1 4 and its way sends both', () => {
    expect(fastGrammar(rowOf(['broom-3'])).filter((one) => one.rule === 4)).toEqual([]);
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

  it('asks of the window of the roll-in a board that teaches the glass: rule 7', () => {
    const right = rowOf([['roll-in-1', { role: 'meet', teaches: 'glass', help: { hint: 'hintRollIn' } }]]);
    expect(fastGrammar(right).filter((one) => one.rule === 7)).toEqual([]);
    const bare = rowOf([['roll-in-1', { role: 'meet', teaches: undefined, help: { hint: 'hintRollIn' } }]]);
    expect(fastGrammar(bare).filter((one) => one.rule === 7).map((one) => one.text)).toEqual(['место 1 (roll-in-1): окно hintRollIn, а доска учит ничему']);
    // A board whose way rolls into no leaving die does not stand behind the window.
    const wrong = rowOf([['R07', { role: 'meet', teaches: 'glass', help: { hint: 'hintRollIn' } }]]);
    expect(fastGrammar(wrong).filter((one) => one.rule === 7).map((one) => one.text)).toEqual(['место 1 (R07): окно hintRollIn, а путь доски не требует glass']);
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
    // One chapter, whatever chapters the row puts these boards in.
    const row = rowOf([['R11', { role: 'meet', teaches: 'walk', chapter: 1 }], ['P02', { chapter: 1 }], ['two-pairs-2', { chapter: 1 }], ['act-k22', { chapter: 1 }]]);
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

describe('repeats of a thought and of a layout: rules 16 and 17', () => {
  const first = CAMPAIGN.slice(0, 30).map((place) => place.code);
  const turned29: [string, Partial<Stop>] = [first[28], { spec: turnedBoard(boardOf(first[28])) }];
  const rule = (n: number, row: readonly Stop[]) => repeatsOf(row).filter((one) => one.rule === n);

  it('judges the places from the 31st on', () => expect(REPEAT_FROM).toBe(31));

  it('finds a board turned as the same layout: rule 16', () => {
    // The 30th of the row (carry-1) is one thought with the 29th: R03 stands there instead, so that the layout is said alone.
    const row = rowOf([...first.slice(0, 29), 'R03', turned29]);
    expect(rule(16, row)).toEqual([{ rule: 16, at: 31, text: 'места 29 (floor-first-1) и 31 (floor-first-1): одна раскладка' }]);
    expect(rule(16, row).every(held)).toBe(true);
    // Below the 31st the rule does not judge: the first thirty stay as they are.
    expect(rule(16, rowOf([...first.slice(0, 29), turned29]))).toEqual([]);
  });

  it('finds two layouts of one thought: rule 16', () => {
    const row = rowOf([...first.slice(0, 29), 'two-combos-3', 'two-combos-5']);
    expect(rule(16, row).map((one) => one.text)).toEqual(['места 30 (two-combos-3) и 31 (two-combos-5): одна мысль — K ~ K, seven twoFaces walk, грани 3 4']);
  });

  it('warns once for a place too alike to one before it: rule 17', () => {
    const row = rowOf([...first.slice(0, 29), 'two-combos-3', 'two-combos-5']);
    const warned = rule(17, row);
    expect(warned.map((one) => [one.at, one.text, one.warning])).toEqual([[31, 'место 31 (two-combos-5): похоже на место 30 (two-combos-3) из пяти перед ним, 1.00', true]]);
    expect(warned.some(held)).toBe(false);
  });

  /** A short row of the boards named, numbered on from `from`: the places before the 31st are judged against, not judged. */
  const numbered = (codes: readonly string[], from: number) => rowOf(codes.map((code, i): [string, Partial<Stop>] => [code, { number: from + i }]));
  /** Boards below 0.45 alike to which-first-2 and to bridge-first-1, to stand between. */
  const apart = ['first-sixes-1', 'first-fours-1', 'rescue-5', 'broom-3', 'ready-fours-1'];
  const said = (row: readonly Stop[]) => rule(17, row).map((one) => one.text);

  it('says a place alike to one six places back of the whole row: rule 17', () => {
    // which-first-2 and R09 are one thought (1.00); the five between are far from it, so only the whole row is over.
    expect(said(numbered(['R09', ...apart, 'which-first-2'], 25))).toEqual(['место 31 (which-first-2): похоже на место 25 (R09), 1.00']);
  });

  it('says a place alike to one of the five before it, under the threshold of the whole row: rule 17', () => {
    // two-pairs-1 is 0.68 alike to which-first-2: over SIMILAR_NEAR, under SIMILAR_ROW.
    expect(said(numbered(['two-pairs-1', 'which-first-2'], 30))).toEqual(['место 31 (which-first-2): похоже на место 30 (two-pairs-1) из пяти перед ним, 0.68']);
  });

  it('says once the part further over its threshold, where both are over: rule 17', () => {
    // R09 1.00 far back is 0.25 over SIMILAR_ROW, two-pairs-1 0.68 just before 0.03 over SIMILAR_NEAR: the whole row is said.
    expect(said(numbered(['R09', ...apart.slice(0, 4), 'two-pairs-1', 'which-first-2'], 25))).toEqual(['место 31 (which-first-2): похоже на место 25 (R09), 1.00']);
    // P02 0.78 far back is 0.03 over SIMILAR_ROW, R11 0.73 just before 0.08 over SIMILAR_NEAR: the five before are said, though P02 is more alike.
    expect(said(numbered(['P02', ...apart.slice(0, 4), 'R11', 'bridge-first-1'], 25))).toEqual(['место 31 (bridge-first-1): похоже на место 30 (R11) из пяти перед ним, 0.73']);
  });

  it('reads the core off the kept way only, never asking the solver: rules 16 and 17', () => {
    const bare = (id: string): [string, Partial<Stop>] => [id, { spec: { ...boardOf(id), solution: undefined, par: undefined, exact: undefined } }];
    const row = rowOf([...first.slice(0, 29), bare('hidden-face-1'), bare('two-combos-5')]);
    vi.mocked(solveLevel).mockClear();
    const found = repeatsOf(row);
    expect(solveLevel).not.toHaveBeenCalled();
    // A board with no way has the core of an empty way: the rows are still judged, by the layouts alone.
    expect(found.map((one) => one.rule)).toEqual([17]);
  });

  it('says nothing of a place before the 31st, or of one far from all before it: rule 17', () => {
    expect(said(numbered(['two-pairs-1', 'which-first-2'], 29))).toEqual([]);
    expect(said(numbered([...apart, 'which-first-2'], 26))).toEqual([]);
  });

  it('ends the line of a known repeat with its mark, and of a repeat not known with nothing', () => {
    const known = { rule: 16 as const, at: 33, text: KNOWN_REPEATS[0] };
    const other = { rule: 16 as const, at: 33, text: 'места 1 (R01) и 33 (R01): одна раскладка' };
    expect([knownRepeat(known), markOf(known)]).toEqual([true, ' (известный повтор)']);
    expect([knownRepeat(other), held(other), markOf(other)]).toEqual([false, true, '']);
    // The text of a known repeat under another rule is no known repeat.
    expect(markOf({ rule: 17, at: 33, text: KNOWN_REPEATS[0], warning: true })).toBe(WARNING);
  });

  it('holds the repeats of the row as it stands as known, and each is found', () => {
    const rule16 = fastGrammar(CAMPAIGN).filter((one) => one.rule === 16);
    expect(rule16.map((one) => one.text)).toEqual([...KNOWN_REPEATS]);
    expect(rule16.every(knownRepeat)).toBe(true);
    expect(knownRepeat({ rule: 16, at: 31, text: 'места 29 (floor-first-1) и 31 (floor-first-1): одна раскладка' })).toBe(false);
  });
});

describe('the scale of difficulty in the row: rule 18 and the parts of rules 5 and 8 on D', () => {
  /** A row of R03 in every place, each of the role given; nothing teaches, so rules 1 and 2 say nothing. */
  const scaled = (length: number, roles: Partial<Record<number, Stop['role']>> = {}) =>
    rowOf(Array.from({ length }, (_, i): [string, Partial<Stop>] => ['R03', { chapter: 1, role: roles[i + 1] ?? 'apply', teaches: undefined, archetype: `a${i + 1}` }]));
  /** The places from 1 to 30 at D 2, those after at 3.5, the middle of the band of 31–40, where no other is given. */
  const plain = (n: number): number | undefined => (n <= 30 ? 2 : 3.5);
  const said = (n: number, row: readonly Stop[], given: Record<number, number>, base = plain) =>
    slowGrammar(row, (stop) => ({ lost: true, planner: 1, d: given[stop.number] ?? base(stop.number) })).filter((one) => one.rule === n);
  const texts = (lines: readonly { text: string }[]) => lines.map((one) => one.text);

  it('says nothing of a row in its bands, nor of a row with no D', () => {
    expect(said(18, scaled(40), {})).toEqual([]);
    expect(slowGrammar(scaled(40), () => ({ lost: true, planner: 1 }))).toEqual([]);
  });

  it('says a place out of the band of its decade, and a rise of more than two: rule 18, held', () => {
    const lines = said(18, scaled(40), { 35: 6 });
    expect(texts(lines)).toEqual(['место 35 (R03): D 6, а полоса мест 31–40 — 3–4', 'место 35 (R03): D 6 после 3.5 на месте 34, рост больше 2']);
    expect(lines.every((one) => one.scale === true && held(one))).toBe(true);
  });

  it('lets a meeting stand a step under the band of its decade, and no more: rule 18', () => {
    const met = scaled(40, { 33: 'meet' });
    expect(said(18, met, { 33: 2 })).toEqual([]);
    expect(texts(said(18, met, { 33: 1.5 }))).toEqual(['место 33 (R03): D 1.5, а полоса мест 31–40 — 2–4 (встреча)']);
  });

  it('says nothing before the 31st place, whatever its D: rule 18', () => {
    expect(said(18, scaled(40), { 20: 9, 25: 1 })).toEqual([]);
  });

  it('says a rest that is not two under both its neighbours, and asks no neighbour with no D: rule 18', () => {
    const rest = scaled(40, { 38: 'rest' });
    const lines = said(18, rest, { 37: 4, 38: 3, 39: 4 });
    expect(texts(lines)).toEqual(['место 38 (R03): передышка D 3, а соседи — 4 и 4; передышка на 2 ниже соседей']);
    expect(lines.every((one) => one.scale === true && held(one))).toBe(true);
    expect(said(18, rest, { 37: 4, 38: 2, 39: 4 })).toEqual([]);
    // 39 at 3.5 is a neighbour only 1.5 over the rest; with no D it is not asked.
    expect(texts(said(18, rest, { 37: 4, 38: 2 }))).toEqual(['место 38 (R03): передышка D 2, а соседи — 4 и 3.5; передышка на 2 ниже соседей']);
    expect(said(18, rest, { 37: 4, 38: 2 }, (n) => (n === 39 ? undefined : plain(n)))).toEqual([]);
  });

  it('says a second rest in a decade, a rest under 4 past the 50th, and a peak out of its band: rule 18', () => {
    const roles = { 33: 'rest', 38: 'rest', 45: 'peak', 55: 'rest' } as const;
    const base = (n: number) => (n <= 30 ? 2 : n <= 40 ? 3.5 : n <= 50 ? 4.5 : 5.5);
    expect(texts(said(18, scaled(60, roles), { 33: 1.5, 38: 1.5, 45: 5, 55: 3.5 }, base))).toEqual([
      'места 33 и 38: две передышки в десятке 31–40',
      'место 45 (R03): пик D 5, а пик мест 41–50 — 6',
      'место 55 (R03): передышка D 3.5, а после 50-го места передышка не ниже 4',
    ]);
  });

  it('says a gift from the start past the 40th and the 50th: rule 18', () => {
    const base = (n: number) => (n <= 30 ? 2 : n <= 40 ? 4 : n <= 50 ? 4.5 : 5.5);
    const gifts = (given: Record<number, number>) => texts(said(18, scaled(60), given, base)).filter((text) => text.includes('подарок'));
    expect(gifts({ 44: 2, 56: 3.5 })).toEqual(['место 44 (R03): D 2 — подарок из начала после 40-го места']);
    expect(gifts({ 44: 2.5, 56: 3 })).toEqual(['место 56 (R03): D 3 — подарок из начала после 50-го места']);
    expect(gifts({ 38: 2 })).toEqual([]);
  });

  it('says a decade lighter on the mean than the one before, from 41–50 on: rule 18', () => {
    const base = (n: number) => (n <= 30 ? 2 : n <= 50 ? 4 : 5);
    const means = (given: Record<number, number>) => texts(said(18, scaled(60), given, base)).filter((text) => text.includes('средний'));
    // As heavy as the decade before is no fall.
    expect(means({})).toEqual([]);
    expect(means({ 45: 3.5 })).toEqual(['места 41–50: средний D 3.95, ниже, чем у мест 31–40 (4)']);
    // A decade is judged on the places of it that have D.
    expect(texts(said(18, scaled(60), {}, (n) => (n <= 30 ? 9 : n <= 35 ? 5 : n <= 40 ? undefined : n <= 50 ? 4.5 : 5))).filter((text) => text.includes('средний'))).toEqual([
      'места 41–50: средний D 4.5, ниже, чем у мест 31–40 (5)',
    ]);
  });

  it('says the board after a meeting more than one over it: rule 5 on D, held', () => {
    const lines = said(5, scaled(40, { 33: 'meet' }), { 33: 3, 34: 5 });
    expect(texts(lines)).toEqual(['место 34 (R03) после встречи на месте 33: D 5, а встреча — 3']);
    expect(lines.every((one) => one.scale === true && held(one))).toBe(true);
    expect(said(5, scaled(40, { 33: 'meet' }), { 33: 3, 34: 4 })).toEqual([]);
    // Before the 31st the meeting is let be.
    expect(said(5, scaled(40, { 23: 'meet' }), { 23: 1, 24: 4 })).toEqual([]);
  });

  it('says the board after a peak not under it: rule 8 on D, held', () => {
    const lines = said(8, scaled(40, { 36: 'peak' }), { 36: 5, 37: 5 });
    expect(texts(lines)).toEqual(['место 37 (R03) после пика на месте 36: D 5, а пик — 5; после пика ниже']);
    expect(lines.every((one) => one.scale === true && held(one))).toBe(true);
    expect(said(8, scaled(40, { 36: 'peak' }), { 36: 5, 37: 4.5 })).toEqual([]);
  });
});

describe('rule 1 past the 30th and the 60th place', () => {
  /** R07 teaching the link at the place given, and the boards named after it, none teaching. */
  const lesson = (at: number, codes: readonly string[]) =>
    rowOf([['R07', { number: at, teaches: 'link' }], ...codes.map((code, i): [string, Partial<Stop>] => [code, { number: at + 1 + i, teaches: undefined }])]);
  const rule1 = (row: readonly Stop[]) => fastGrammar(row).filter((one) => one.rule === 1).map((one) => one.text);

  it('asks for two uses of three up to the 30th, as it did', () => {
    expect(rule1(lesson(25, ['R08', 'R11', 'two-pairs-2']))).toEqual(['место 25 (R07) учит link, а из мест 26–28 его требует 1 досок']);
  });

  it('lets one use of three be enough past the 30th', () => {
    expect(rule1(lesson(45, ['R08', 'R11', 'two-pairs-2']))).toEqual([]);
    expect(rule1(lesson(45, ['R11', 'two-pairs-2', 'R03']))).toEqual(['место 45 (R07) учит link, а из мест 46–48 его требует 0 досок']);
  });

  it('asks no use past the 60th', () => expect(rule1(lesson(65, ['R11', 'two-pairs-2', 'R03']))).toEqual([]));

  it('still says two meetings side by side past the 60th', () => {
    const row = rowOf([['R07', { number: 65, teaches: 'link' }], ['R11', { number: 66, teaches: 'walk' }]]);
    expect(rule1(row)).toContain('место 66 (R11) учит сразу после места 65 (R07)');
  });

  it('holds the order to the same: one trap of three past the 30th, none past the 60th', () => {
    const order = (at: number) =>
      rowOf([['R05', { number: at, role: 'meet', teaches: 'order' }], ...['two-pairs-2', 'R03', 'R04'].map((code, i): [string, Partial<Stop>] => [code, { number: at + 1 + i, teaches: undefined }])]);
    const slow1 = (row: readonly Stop[], traps: readonly string[]) =>
      slowGrammar(row, (stop) => ({ lost: true, planner: 1, order: traps.includes(stop.spec.id) })).filter((one) => one.rule === 1).map((one) => one.text);
    expect(slow1(order(25), ['two-pairs-2'])).toEqual(['место 25 (R05) учит order, а из мест 26–28 его требует 1 досок']);
    expect(slow1(order(45), ['two-pairs-2'])).toEqual([]);
    expect(slow1(order(45), [])).toEqual(['место 45 (R05) учит order, а из мест 46–48 его требует 0 досок']);
    expect(slow1(order(65), [])).toEqual([]);
  });
});
