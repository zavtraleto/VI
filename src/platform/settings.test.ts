import { afterEach, describe, expect, it, vi } from 'vitest';
import { RULES_VERSION, defaultExperiments } from '../rules';
import { SETTINGS_KEY, bestOf, bestOn, joinRuns, loadSettings } from './settings';

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
    expect(settings.tutorialDone).toBe(true);
    expect(settings.rulesVersion).toBe(RULES_VERSION);
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
        'timed:0.8-gclqd': [run(708, '2026-10-03')],
      },
    });
    const settings = loadSettings();
    expect(Object.keys(settings.runs).sort()).toEqual(['endless', 'timed']);
    expect(bestOf(settings, 'endless', 'score')).toBe(27770);
    expect(bestOn(settings, 'timed', '2026-10-03')).toBe(708);
    // Newest last: a log that grows too long lets go of its oldest runs.
    expect(settings.runs.endless.map((kept) => kept.date)).toEqual(['2026-10-01', '2026-10-03', '2026-10-04']);
  });

  it('stay as they are once they are kept by kind of session', () => {
    const runs = { endless: [run(500, '2026-10-04'), run(40, '2026-10-02')], 'endless/0.9-g': [run(7, '2026-10-04')] };
    expect(joinRuns(runs)).toEqual(runs);
    expect(joinRuns({})).toEqual({});
  });
});

describe('the place on the road a player has saved', () => {
  it('is none where nothing was saved, and none in a save from before the road', () => {
    saved(null);
    expect(loadSettings().levels).toEqual({ passed: {}, stats: {} });
    saved({ levels: { passed: { F1: true, P01: true }, stats: {} } });
    const { levels } = loadSettings();
    expect(levels.road).toBeUndefined();
    // What the build before kept is still there to be read.
    expect(levels.passed).toEqual({ F1: true, P01: true });
  });

  it('comes back as it was saved, with what was passed', () => {
    saved({ levels: { passed: { R01: true, R02: true }, stats: {}, road: 'R03' } });
    const { levels } = loadSettings();
    expect(levels.road).toBe('R03');
    expect(levels.passed).toEqual({ R01: true, R02: true });
    // A save goes out as it was read: the place is a field of what is kept.
    expect(JSON.parse(JSON.stringify(levels)).road).toBe('R03');
  });
});
