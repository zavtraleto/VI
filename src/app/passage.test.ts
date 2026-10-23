import { describe, expect, it } from 'vitest';
import { FIXTURE } from '../levels/rowFixture';
import { MENU_FILES } from '../shell/text';
import { FILE_LEADS, atAfter, liveDue, liveKey, orderOf, passageAt, passageEnd, placeAfterIndex, startPlace, type PassageTimes } from './passage';

/** The numbers the look has for the passage as it is first laid out. */
const TIMES: PassageTimes = { comboStepMs: 140, comboHoldMs: 350, sinkMs: 1300, eraseMs: 700, cameraMs: 900, drawMs: 1100, riseMs: 600, riseStepMs: 90 };
const COUNTS = { combo: 3, dice: 4 };
const at = (ms: number, reduced = false, counts = COUNTS) => passageAt(ms, TIMES, counts, reduced);

const row = FIXTURE.places;

describe('the place the program opens on', () => {
  it('is the first for one who is new', () => {
    expect(startPlace(undefined, {}, row)).toBe(0);
  });

  it('is the place whose code is kept, whatever was passed', () => {
    expect(startPlace('G1', {}, row)).toBe(3);
    expect(startPlace('F2', { F1: true, F2: true, F3: true }, row)).toBe(1);
  });

  it('is the first for a code the row has not', () => {
    expect(startPlace('R99', { F1: true, F2: true }, row)).toBe(0);
  });

  it('is, past the prologue, the first place of the chapters not passed, and their first when all are', () => {
    // At C1-05 the player played C1-06 out of turn, then passed C1-05: they go on with the first not passed.
    expect(startPlace('G2', { F1: true, F2: true, F3: true, G2: true }, row)).toBe(3);
    expect(startPlace('G2', Object.fromEntries(row.map((place) => [place.code, true])), row)).toBe(3);
  });
});

describe('the place after a place', () => {
  it('is the next of the row, through its chapters, and none after the last', () => {
    expect(placeAfterIndex(0, row.length)).toBe(1);
    expect(placeAfterIndex(2, row.length)).toBe(3);
    expect(placeAfterIndex(4, row.length)).toBeNull();
  });

  it('walks one who is new through the whole row, and then nothing', () => {
    const seen: string[] = [];
    for (let place: number | null = startPlace(undefined, {}, row); place !== null; place = placeAfterIndex(place, row.length)) seen.push(row[place].code);
    expect(seen).toEqual(['F1', 'F2', 'F3', 'G1', 'G2']);
  });
});

describe('a live session after a place', () => {
  const lives = [{ code: 'live-1', step: 1, after: 2 }];

  it('holds the passage from the place it stands after for its window, once for a player', () => {
    expect(liveDue(2, [], lives)).toEqual(lives[0]);
    expect(liveDue(1, [], lives)).toBeNull();
    expect(liveDue(3, [], lives)).toBeNull();
    expect(liveKey(lives[0])).toBe('live:live-1');
  });

  it('lets the passage go on to the place after once its window is closed, played or skipped', () => {
    const told = [liveKey(lives[0])];
    expect(liveDue(2, told, lives)).toBeNull();
    expect(placeAfterIndex(2, row.length)).toBe(3);
  });
});

describe('where the player stands once a place is passed', () => {
  it('is the place after it, when the player stood on it, through the chapters', () => {
    expect(atAfter(undefined, 0, row, {})).toBe('F2');
    expect(atAfter('F3', 2, row, {})).toBe('G1');
  });

  it('is where it was when the place passed was played out of turn', () => {
    expect(atAfter('F3', 4, row, {})).toBe('F3');
    expect(atAfter('F3', 0, row, {})).toBe('F3');
  });

  it('is the last place still once the last is passed', () => {
    expect(atAfter('G2', 4, row, {})).toBe('G2');
  });
});

describe('the passage between two boards', () => {
  it('begins with the dice of the combo lighting up one after another', () => {
    expect(at(0)).toMatchObject({ phase: 'combo', lit: 1, swapped: false, camera: 0, lines: 1, risen: 0 });
    expect(at(139).lit).toBe(1);
    expect(at(140).lit).toBe(2);
    expect(at(280).lit).toBe(3);
    expect(at(769)).toMatchObject({ phase: 'combo', lit: 3 });
  });

  it('then sends them under the floor, a step apart, the lines whole', () => {
    expect(at(770)).toMatchObject({ phase: 'sink', at: 0, lit: 3, lines: 1, swapped: false });
    expect(at(2349).phase).toBe('sink');
    expect(at(2349).at).toBeLessThan(1);
  });

  it('then erases the lines of the board, from all of them to none', () => {
    expect(at(2350)).toMatchObject({ phase: 'erase', at: 0, lines: 1, swapped: false });
    expect(at(2700).lines).toBeCloseTo(0.5);
    expect(at(3049)).toMatchObject({ phase: 'erase', swapped: false });
    expect(at(3049).lines).toBeLessThan(0.01);
  });

  it('then the board is the next one: its lines are drawn while the camera travels', () => {
    expect(at(3050)).toMatchObject({ phase: 'draw', at: 0, swapped: true, lines: 0, camera: 0, risen: 0 });
    expect(at(3600).lines).toBeCloseTo(0.5);
    expect(at(3500).camera).toBeCloseTo(0.5);
    expect(at(3950).camera).toBe(1);
    expect(at(4149)).toMatchObject({ phase: 'draw', risen: 0 });
  });

  it('then its dice come up, a step apart, and then it is done', () => {
    expect(at(4150)).toMatchObject({ phase: 'rise', at: 0, lines: 1, risen: 0, swapped: true });
    expect(at(4150 + 600).risen).toBe(1);
    expect(at(4150 + 600 + 180).risen).toBe(3);
    expect(at(5019)).toMatchObject({ phase: 'rise', risen: 3 });
    expect(at(5020)).toMatchObject({ phase: 'done', at: 1, risen: 4, lines: 1, camera: 1, swapped: true, lit: 3 });
    expect(at(60_000)).toMatchObject({ phase: 'done', risen: 4 });
    expect(passageEnd(TIMES, COUNTS, false)).toBe(5020);
  });

  it('stairs rise with the other dice: a die laid as leaving has no turn of its own after them', () => {
    // The dice are counted alike, the stair among them: the last stands when the fourth step has run, not a rise later.
    expect(at(4150 + 600 + 180, false).risen).toBe(3);
    expect(at(5019, false)).toMatchObject({ phase: 'rise', risen: 3 });
    expect(at(5020, false)).toMatchObject({ phase: 'done', risen: 4 });
    expect(passageEnd(TIMES, COUNTS, false)).toBe(5020);
  });

  it('with motion kept low changes the board at once when the dice are gone', () => {
    expect(at(0, true)).toMatchObject({ phase: 'combo', lit: 1 });
    expect(at(770, true).phase).toBe('sink');
    expect(at(2349, true)).toMatchObject({ phase: 'sink', swapped: false });
    expect(at(2350, true)).toMatchObject({ phase: 'done', swapped: true, lines: 1, camera: 1, risen: 4 });
    expect(passageEnd(TIMES, COUNTS, true)).toBe(2350);
  });

  it('where no die lights up, waits the pause and sends what there is under together', () => {
    const none = { combo: 0, dice: 2 };
    expect(at(0, false, none)).toMatchObject({ phase: 'combo', lit: 0 });
    expect(at(350, false, none).phase).toBe('sink');
    expect(at(350 + 1300, false, none).phase).toBe('erase');
  });

  it('lights every die at once where there is no step between them', () => {
    expect(passageAt(0, { ...TIMES, comboStepMs: 0 }, COUNTS, false)).toMatchObject({ phase: 'combo', lit: 3 });
  });
});

describe('the order of the dice in a passage', () => {
  const dice = [
    { x: 3, z: 0 },
    { x: 1, z: 1 },
    { x: 0, z: 0 },
    { x: 1, z: 0 },
  ];

  it('is the nearest to the player first, by steps along the board', () => {
    expect(orderOf(dice, { x: 0, z: 0 })).toEqual([2, 3, 1, 0]);
  });

  it('is the same every time: of two as near, the one in the lower row, then the lower column', () => {
    expect(orderOf([{ x: 1, z: 2 }, { x: 2, z: 1 }, { x: 0, z: 1 }, { x: 1, z: 0 }], { x: 1, z: 1 })).toEqual([3, 2, 1, 0]);
  });

  it('puts the dice named as late after all the others, in the same order among themselves', () => {
    expect(orderOf([{ x: 0, z: 0, late: true }, { x: 3, z: 0 }, { x: 1, z: 0, late: true }, { x: 2, z: 0 }], { x: 0, z: 0 })).toEqual([3, 1, 0, 2]);
  });
});

describe('where the files of the menu lead', () => {
  it('opens the list of the levels from the file of the levels, and the rules from the file that says how the game is played', () => {
    expect(FILE_LEADS.levels).toBe('levels');
    expect(FILE_LEADS.howto).toBe('rules');
  });

  it('has a place of its own for every file of the menu', () => {
    expect(Object.keys(FILE_LEADS).sort()).toEqual(MENU_FILES.map((file) => file.id).sort());
    expect(new Set(Object.values(FILE_LEADS)).size).toBe(MENU_FILES.length);
  });

  it('erases the lines from the frame the dice strike, where they go under at once and take no time of their own', () => {
    // The finale of a level: three dice sound 30 ms apart, the strike is 350 ms in, and nothing is waited for after it.
    const finale: PassageTimes = { ...TIMES, comboStepMs: 30, comboHoldMs: 350 - 3 * 30, sinkMs: 0 };
    expect(passageAt(349, finale, COUNTS, false).phase).toBe('combo');
    expect(passageAt(60, finale, COUNTS, false).lit).toBe(3);
    expect(passageAt(350, finale, COUNTS, false).phase).toBe('erase');
    expect(passageEnd(finale, COUNTS, false)).toBe(350 + 700 + 1100 + 3 * 90 + 600);
  });
});
