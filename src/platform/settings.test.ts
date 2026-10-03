import { afterEach, describe, expect, it, vi } from 'vitest';
import { RULES_VERSION, defaultExperiments } from '../rules';
import { SETTINGS_KEY, loadSettings } from './settings';

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
