import { afterEach, describe, expect, it, vi } from 'vitest';
import { RULES_VERSION, defaultExperiments } from '../rules';
import { FIXTURE } from '../levels/rowFixture';
import { ROW_EDITION, SETTINGS_KEY, bestOf, joinRuns, loadSettings, toRowEdition, type RowKept } from './settings';

/** The browser's storage holding what an earlier start of the game saved. */
function saved(settings: object | null): void {
  const raw = settings === null ? null : JSON.stringify(settings);
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => (key === SETTINGS_KEY ? raw : null), setItem: () => undefined } });
}

afterEach(() => vi.unstubAllGlobals());

describe('the experiments a player has saved', () => {
  it('start from the defaults of the rules where nothing was saved', () => {
    saved(null);
    const settings = loadSettings();
    expect(settings.experiments).toEqual(defaultExperiments());
    expect(settings.rulesVersion).toBe(RULES_VERSION);
  });

  it('do not hold back what became a rule: a save from before 0.8 had climbing from the floor off', () => {
    const before = { ...defaultExperiments(), floorClimb: false, soloOne: true, guidedStart: false } as Record<string, boolean>;
    delete before.dockSteps;
    saved({ experiments: before, tutorialDone: true });
    const settings = loadSettings();
    expect(settings.experiments).toMatchObject({ floorClimb: true, dockSteps: true });
    // What the player had switched themselves stays as they left it.
    expect(settings.experiments).toMatchObject({ soloOne: true, guidedStart: false });
    expect(settings.rulesVersion).toBe(RULES_VERSION);
  });

  it('let go of the exercise that was done: the game has no exercise any more', () => {
    saved({ tutorialDone: true });
    expect('tutorialDone' in loadSettings()).toBe(false);
  });

  it('let go of the tasks that were played: the game has no tasks any more', () => {
    saved({ puzzle: { stars: { 1: 3 }, stats: {}, rulesSeen: true } });
    expect('puzzle' in loadSettings()).toBe(false);
  });

  it('stay as they were switched under these rules', () => {
    saved({ experiments: { ...defaultExperiments(), floorClimb: false, dockSteps: false }, rulesVersion: RULES_VERSION });
    expect(loadSettings().experiments).toMatchObject({ floorClimb: false, dockSteps: false });
  });
});

describe('the sessions a player has saved', () => {
  const run = (score: number, date: string) => ({ score, chain: 1, ticks: 100, date });

  it('are not lost when the rules get a new version: what was kept by version is one log now', () => {
    saved({
      runs: {
        'endless:0.7-gclq': [run(900, '2026-10-01')],
        'endless:0.9-gclqdtwuepo': [run(27770, '2026-10-04'), run(300, '2026-10-03')],
      },
    });
    const settings = loadSettings();
    expect(Object.keys(settings.runs)).toEqual(['endless']);
    expect(bestOf(settings, 'endless', 'score')).toBe(27770);
    // Newest last: a log that grows too long lets go of its oldest runs.
    expect(settings.runs.endless.map((kept) => kept.date)).toEqual(['2026-10-01', '2026-10-03', '2026-10-04']);
  });

  it('let go of the sessions of the day, which the game has no more', () => {
    saved({ runs: { endless: [run(500, '2026-10-04')], timed: [run(708, '2026-10-03')], 'timed:0.8-gclqd': [run(70, '2026-10-02')], 'timed/0.9-g': [run(7, '2026-10-04')] } });
    expect(Object.keys(loadSettings().runs)).toEqual(['endless']);
  });

  it('stay as they are once they are kept by kind of session', () => {
    const runs = { endless: [run(500, '2026-10-04'), run(40, '2026-10-02')], 'endless/0.9-g': [run(7, '2026-10-04')] };
    expect(joinRuns(runs)).toEqual(runs);
    expect(joinRuns({})).toEqual({});
  });
});

describe('the windows a player has closed', () => {
  it('are none in a new save nor in one from before them, and are kept once they are', () => {
    saved(null);
    expect(loadSettings().levels.told).toEqual([]);
    saved({ levels: { passed: { R01: true }, stats: {}, at: 'R02', rowEdition: ROW_EDITION } });
    expect(loadSettings().levels.told).toEqual([]);
    saved({ levels: { passed: { R01: true }, stats: {}, at: 'R02', rowEdition: ROW_EDITION, told: ['R07', 'end:24'] } });
    expect(loadSettings().levels.told).toEqual(['R07', 'end:24']);
    // A save of an earlier edition of the road starts again and keeps what the player has been told.
    saved({ levels: { passed: { R01: true }, stats: {}, road: 'R02', told: ['R07'] } });
    expect(loadSettings().levels.told).toEqual(['R07']);
  });

  it('leave nothing of the line about a dim die, which is said no more', () => {
    saved({ levels: { passed: {}, stats: {}, rowEdition: ROW_EDITION, fixedSaid: true } });
    expect('fixedSaid' in loadSettings().levels).toBe(false);
  });
});

describe('the place in the row a player has saved', () => {
  it('is none where nothing was saved, and none in a save from before the road, whose levels are of other boards', () => {
    saved(null);
    expect(loadSettings().levels).toEqual({ passed: {}, stats: {}, told: [], rowEdition: ROW_EDITION });
    saved({ levels: { passed: { F1: true, P01: true }, stats: {} } });
    const { levels } = loadSettings();
    expect(levels.at).toBeUndefined();
    expect(levels.passed).toEqual({});
  });

  it('comes back as it was saved, with what was passed, when it is of the row', () => {
    saved({ levels: { passed: { R01: true, R02: true }, stats: {}, at: 'R03', rowEdition: ROW_EDITION } });
    const { levels } = loadSettings();
    expect(levels.at).toBe('R03');
    expect(levels.passed).toEqual({ R01: true, R02: true });
    expect(JSON.parse(JSON.stringify(levels)).at).toBe('R03');
  });

  it('is the piece a save of the seventh edition of the road stood on, with all it passed', () => {
    saved({ levels: { passed: { R01: true, R02: true }, stats: {}, road: 'R03', roadEdition: 7 } });
    const { levels } = loadSettings();
    expect(levels).toEqual({ passed: { R01: true, R02: true }, stats: {}, told: [], at: 'R03', rowEdition: ROW_EDITION });
  });

  it('starts again in a save of any edition before the seventh: the stars and the place dropped, what the player was told kept', () => {
    const stat = { tries: 2, passes: 1, fails: 0, firstPassTry: 1, bestLeft: null, bestMoves: 3, undos: 0, stuck: 0, short: [], playMs: 100 };
    saved({ levels: { passed: { R01: true, R08: true, P01: true, P02: true }, stats: { R01: stat, R08: stat, P01: stat }, road: 'R09' } });
    expect(loadSettings().levels).toEqual({ passed: {}, stats: {}, told: [], rowEdition: ROW_EDITION });
    saved({ levels: { passed: { R01: true, P13: true, K17: true }, stats: { R01: stat, K17: stat }, road: 'R12', roadEdition: 6, told: ['R07'] } });
    expect(loadSettings().levels).toEqual({ passed: {}, stats: {}, told: ['R07'], rowEdition: ROW_EDITION });
  });
});

describe('what a save of the road becomes in the row', () => {
  const row = FIXTURE.places;

  it('keeps the place of the piece the player stood on, and all that was passed', () => {
    const kept = toRowEdition({ passed: { F1: true }, stats: { F1: { bestMoves: 1 } }, road: 'F2', roadEdition: 7 }, row);
    expect(kept).toEqual({ passed: { F1: true }, stats: { F1: { bestMoves: 1 } }, at: 'F2', rowEdition: ROW_EDITION });
  });

  it('puts one past the road on the first place not passed after the prologue, and on its first when all are', () => {
    expect(toRowEdition<RowKept>({ passed: { F1: true, F2: true, F3: true, G1: true }, stats: {}, road: 'R00', roadEdition: 7 }, row).at).toBe('G2');
    expect(toRowEdition<RowKept>({ passed: Object.fromEntries(row.map((place) => [place.code, true])), stats: {}, road: 'R00', roadEdition: 7 }, row).at).toBe('G1');
  });

  it('leaves one of the seventh edition with no place kept with none', () => {
    expect(toRowEdition({ passed: {}, stats: {}, roadEdition: 7 }, row)).toEqual({ passed: {}, stats: {}, at: undefined, rowEdition: ROW_EDITION });
  });

  it('drops what an edition before the seventh kept, and gives a save of the row back as it is', () => {
    expect(toRowEdition({ passed: { F1: true }, stats: {}, road: 'F2', roadEdition: 6 }, row)).toEqual({ passed: {}, stats: {}, at: undefined, rowEdition: ROW_EDITION });
    const fresh = { passed: { F1: true }, stats: {}, at: 'F2', rowEdition: ROW_EDITION };
    expect(toRowEdition(fresh, row)).toBe(fresh);
  });
});
