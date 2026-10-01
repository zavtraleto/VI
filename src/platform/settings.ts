import { defaultExperiments, type ExperimentConfig } from '../rules';
import { loadJson, saveJson } from './storage';

export type ControlMode = 'gesture' | 'dpad';

export interface Settings {
  experiments: ExperimentConfig;
  controlMode: ControlMode;
  tutorialDone: boolean;
  hintsSeen: string[];
  /** Best score per mode and rule key. */
  best: Record<string, number>;
}

const KEY = 'vi.settings.v1';

export function loadSettings(): Settings {
  const fallback: Settings = {
    experiments: defaultExperiments(),
    controlMode: 'gesture',
    tutorialDone: false,
    hintsSeen: [],
    best: {},
  };
  const loaded = loadJson(KEY, fallback);
  loaded.experiments = { ...defaultExperiments(), ...loaded.experiments };
  return loaded;
}

export function saveSettings(settings: Settings): boolean {
  return saveJson(KEY, settings);
}
