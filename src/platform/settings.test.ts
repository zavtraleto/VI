import { afterEach, describe, expect, it, vi } from 'vitest';
import { RULES_VERSION, defaultExperiments } from '../rules';
import { FIXTURE } from '../levels/rowFixture';
import { DEFAULT_CAMERA, ROW_EDITION, SETTINGS_KEY, bestOf, joinRuns, levelStat, loadSettings, noteLive, raiseLive, saveSettings, toRowEdition, type RowKept } from './settings';

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

  it('let go of whether the boot was seen: the game has no boot any more', () => {
    saved({ bootSeen: true, muted: true });
    const settings = loadSettings();
    expect('bootSeen' in settings).toBe(false);
    expect(settings.muted).toBe(true);
  });

  it('keep the effects calm for a player who had turned the shake off, and let go of the shake and the camera', () => {
    saved({ shake: false, reducedMotion: null, view: 'full' });
    const calm = loadSettings();
    expect(calm.reducedMotion).toBe(true);
    expect('shake' in calm).toBe(false);
    expect('view' in calm).toBe(false);
    // Motion the player set themselves stays as they set it; a shake left on changes nothing.
    saved({ shake: false, reducedMotion: false });
    expect(loadSettings().reducedMotion).toBe(false);
    saved({ shake: true, reducedMotion: null });
    expect(loadSettings().reducedMotion).toBeNull();
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

describe('the count of moves taken back towards an advertisement, gone (the owner, 5 November 2026)', () => {
  it('is let go of: a save that kept it reads as it was, without it, and is written back without it', () => {
    const written: string[] = [];
    const raw = JSON.stringify({ muted: true, undosForAd: 2, levels: { passed: { R01: true }, stats: {}, rowEdition: ROW_EDITION, told: [] } });
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => (key === SETTINGS_KEY ? raw : null), setItem: (_: string, value: string) => written.push(value) } });
    const settings = loadSettings();
    expect(settings.muted).toBe(true);
    expect(settings.levels.passed).toEqual({ R01: true });
    expect('undosForAd' in settings).toBe(false);
    expect(saveSettings(settings)).toBe(true);
    expect(JSON.parse(written.at(-1)!)).not.toHaveProperty('undosForAd');
  });

  it('is let go of whatever it held, broken too', () => {
    saved({ undosForAd: 'many' });
    expect('undosForAd' in loadSettings()).toBe(false);
  });
});

describe('the live sessions a player has played', () => {
  it('are none in a new save nor in one from before them, and come back as they were kept', () => {
    saved(null);
    expect(loadSettings().levels.lives).toEqual({});
    saved({ levels: { passed: { R01: true }, stats: {}, at: 'R02', rowEdition: ROW_EDITION, told: [] } });
    expect(loadSettings().levels.lives).toEqual({});
    saved({ levels: { passed: {}, stats: {}, rowEdition: ROW_EDITION, told: ['live:live-1'], lives: { 'live-1': { best: 900, plays: 3 } } } });
    const { levels } = loadSettings();
    expect(levels.lives).toEqual({ 'live-1': { best: 900, plays: 3 } });
    expect(levels.told).toEqual(['live:live-1']);
  });

  it('count every play and keep the best score', () => {
    saved(null);
    const settings = loadSettings();
    expect(noteLive(settings, 'live-2', 300)).toEqual({ best: 300, plays: 1 });
    expect(noteLive(settings, 'live-2', 120)).toEqual({ best: 300, plays: 2 });
    expect(noteLive(settings, 'live-2', 450)).toEqual({ best: 450, plays: 3 });
    expect(settings.levels.lives).toEqual({ 'live-2': { best: 450, plays: 3 } });
  });

  it('take a score doubled for an advertisement as the best where it is, with no play added', () => {
    saved(null);
    const settings = loadSettings();
    noteLive(settings, 'live-1', 400);
    noteLive(settings, 'live-1', 300);
    expect(raiseLive(settings, 'live-1', 600)).toEqual({ best: 600, plays: 2 });
    expect(raiseLive(settings, 'live-1', 500)).toEqual({ best: 600, plays: 2 });
  });

  it('are not dropped where a save of the row is brought to its edition', () => {
    const kept = { passed: {}, stats: {}, rowEdition: ROW_EDITION, lives: { 'live-1': { best: 5, plays: 1 } } };
    expect(toRowEdition(kept, FIXTURE.places).lives).toEqual({ 'live-1': { best: 5, plays: 1 } });
  });
});

describe('the place in the row a player has saved', () => {
  it('is none where nothing was saved, and none in a save from before the road, whose levels are of other boards', () => {
    saved(null);
    expect(loadSettings().levels).toEqual({ passed: {}, stats: {}, told: [], lives: {}, rowEdition: ROW_EDITION });
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
    saved({ levels: { passed: { R01: true, R02: true }, stats: {}, road: 'side-up-1', roadEdition: 7 } });
    const { levels } = loadSettings();
    expect(levels).toEqual({ passed: { R01: true, R02: true }, stats: {}, told: [], lives: {}, at: 'side-up-1', rowEdition: ROW_EDITION });
  });

  it('starts again in a save of any edition before the seventh: the stars and the place dropped, what the player was told kept', () => {
    const stat = { tries: 2, passes: 1, fails: 0, firstPassTry: 1, bestLeft: null, bestMoves: 3, undos: 0, stuck: 0, short: [], playMs: 100 };
    saved({ levels: { passed: { R01: true, R08: true, P01: true, P02: true }, stats: { R01: stat, R08: stat, P01: stat }, road: 'R09' } });
    expect(loadSettings().levels).toEqual({ passed: {}, stats: {}, told: [], lives: {}, rowEdition: ROW_EDITION });
    saved({ levels: { passed: { R01: true, P13: true, K17: true }, stats: { R01: stat, K17: stat }, road: 'R12', roadEdition: 6, told: ['R07'] } });
    expect(loadSettings().levels).toEqual({ passed: {}, stats: {}, told: ['R07'], lives: {}, rowEdition: ROW_EDITION });
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

describe('the way shown on a level for an advertisement', () => {
  it('is shown on none in a new save, and on none in a save from before it', () => {
    saved(null);
    expect(levelStat(loadSettings(), 'R01').hinted).toBe(0);
    const old = { tries: 4, passes: 0, fails: 4, firstPassTry: null, bestLeft: null, bestMoves: null, undos: 2, stuck: 4, short: [], playMs: 9000 };
    saved({ levels: { passed: {}, stats: { R05: old }, rowEdition: ROW_EDITION, told: [] } });
    const settings = loadSettings();
    const stat = levelStat(settings, 'R05');
    expect(stat.hinted).toBe(0);
    expect(stat.fails).toBe(4);
  });

  it('is counted, and kept through a save and a load', () => {
    const kept = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => kept.set(key, value) } });
    const first = loadSettings();
    levelStat(first, 'R07').hinted++;
    expect(saveSettings(first)).toBe(true);
    expect(levelStat(loadSettings(), 'R07').hinted).toBe(1);
  });
});

/** The browser's storage holding what an earlier start saved, as text, whatever it is. */
function savedText(raw: string): void {
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => (key === SETTINGS_KEY ? raw : null), setItem: () => undefined } });
}

/** Settings and the platform as a fresh page has them, with what the platform is told. */
async function freshStart(): Promise<{ loadSettings: typeof loadSettings; tracked: { event: string; data?: object }[] }> {
  vi.resetModules();
  const { platform } = await import('@platform');
  const tracked: { event: string; data?: object }[] = [];
  vi.spyOn(platform, 'track').mockImplementation((event, data) => void tracked.push({ event, data }));
  return { loadSettings: (await import('./settings')).loadSettings, tracked };
}

describe('a save broken in its fields', () => {
  const nothing = (): ReturnType<typeof loadSettings> => {
    saved(null);
    return loadSettings();
  };

  it('opens the game when what the levels keep is null: those fields start empty', () => {
    saved({ muted: true, levels: { passed: null, stats: null, told: null, lives: null, rowEdition: ROW_EDITION } });
    const settings = loadSettings();
    expect(settings.levels.passed).toEqual({});
    expect(settings.levels.stats).toEqual({});
    expect(settings.levels.told).toEqual([]);
    expect(settings.levels.lives).toEqual({});
    expect(settings.muted).toBe(true);
    expect(() => {
      levelStat(settings, 'R01').tries++;
      noteLive(settings, 'L1', 10);
    }).not.toThrow();
  });

  it('gives a broken field its default and keeps the rest of the save', () => {
    const stat = { tries: 4, passes: 1, fails: 3, firstPassTry: 4, bestLeft: null, bestMoves: 9, undos: 2, stuck: 0, short: [1, 2], playMs: 9000, hinted: 0 };
    const run = { score: 120, chain: 3, ticks: 900, date: '2026-10-30' };
    saved({
      muted: true,
      debugPanel: 1,
      reducedMotion: 'calm',
      control: 5,
      language: 7,
      hintsSeen: ['a', 3],
      heardLines: [null, 'x'],
      undosForAd: null,
      experiments: { soloOne: true, floorClimb: 'on' },
      rulesVersion: RULES_VERSION,
      tuning: { stepMs: 180, warnMs: 'slow' },
      camera: { yaw: null, pitch: 40 },
      runs: { endless: [run, null, { ...run, score: 'many' }], other: 'none' },
      levels: {
        rowEdition: ROW_EDITION,
        at: 12,
        passed: { R01: true, R02: 'yes' },
        told: ['live:L1', null],
        stats: { R01: stat, R02: 7, R03: { ...stat, tries: null, short: 'none', firstPassTry: 'x' } },
        lives: { L1: { best: 50, plays: 2 }, L2: null, L3: { best: 'x', plays: 1 } },
      },
    });
    const settings = loadSettings();
    expect(settings.muted).toBe(true);
    expect(settings.debugPanel).toBe(false);
    expect(settings.reducedMotion).toBeNull();
    expect(settings.control).toBe('swipe');
    expect(settings.language).toBeNull();
    expect(settings.hintsSeen).toEqual(['a']);
    expect(settings.heardLines).toEqual(['x']);
    expect('undosForAd' in settings).toBe(false);
    expect(settings.experiments).toEqual({ ...defaultExperiments(), soloOne: true });
    expect(settings.tuning).toEqual({ stepMs: 180 });
    expect(settings.camera).toEqual({ yaw: 30, pitch: 40, swipeTilt: 0.5 });
    expect(settings.runs).toEqual({ endless: [run] });
    expect(bestOf(settings, 'endless', 'score')).toBe(120);
    expect(settings.levels.at).toBeUndefined();
    expect(settings.levels.passed).toEqual({ R01: true });
    expect(settings.levels.told).toEqual(['live:L1']);
    expect(settings.levels.stats).toEqual({ R01: stat, R03: { ...stat, tries: 0, short: [], firstPassTry: null } });
    expect(settings.levels.lives).toEqual({ L1: { best: 50, plays: 2 }, L3: { best: 0, plays: 1 } });
  });

  it('opens on the defaults when what was kept is not a save at all', () => {
    for (const raw of ['5', '"text"', '[1,2,3]', 'true', 'null']) {
      savedText(raw);
      expect(loadSettings()).toEqual(nothing());
    }
  });

  it('opens on the defaults however strange the fields are, and never throws', () => {
    for (const levels of [5, 'x', [], { stats: { R01: 'x' } }, { lives: [1] }, { passed: [true] }]) {
      saved({ levels, runs: 'x', camera: 'x', experiments: [1], tuning: null, hintsSeen: {}, heardLines: 5 });
      expect(() => loadSettings()).not.toThrow();
      const settings = loadSettings();
      expect(settings.camera).toEqual({ ...DEFAULT_CAMERA });
      expect(settings.experiments).toEqual(defaultExperiments());
      expect(settings.runs).toEqual({});
      expect(settings.tuning).toEqual({});
      expect(settings.hintsSeen).toEqual([]);
      expect(settings.heardLines).toEqual([]);
    }
  });

  it('is told to the analytics once, as what could not be read', async () => {
    saved({ levels: { passed: null, rowEdition: ROW_EDITION } });
    const start = await freshStart();
    start.loadSettings();
    start.loadSettings();
    expect(start.tracked).toEqual([{ event: 'save_failed', data: { stage: 'parse', store: 'browser' } }]);
  });

  it('is not told for a save from before a field was there: an absent field is an old save, not a broken one', async () => {
    saved({ muted: true, levels: { passed: { R01: true }, stats: { R01: { tries: 1, passes: 1, fails: 0, firstPassTry: 1, bestLeft: null, short: [], playMs: 10 } }, rowEdition: ROW_EDITION } });
    const start = await freshStart();
    const settings = start.loadSettings();
    expect(settings.levels.told).toEqual([]);
    expect(start.tracked).toEqual([]);
  });

  it('is told for what was kept that is not a save at all', async () => {
    savedText('[1,2,3]');
    const start = await freshStart();
    start.loadSettings();
    expect(start.tracked).toEqual([{ event: 'save_failed', data: { stage: 'parse', store: 'browser' } }]);
  });
});
