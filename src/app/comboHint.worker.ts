import type { RunState } from '../rules/types';
import { comboHints } from './comboHint';

/** Counts the plaques of a board off the frame: the board comes in with its name, and its plaques go back under it. */
self.onmessage = (event: MessageEvent<{ key: string; state: RunState }>) => {
  const { key, state } = event.data;
  // A board that cannot be counted has no plaques: the worker goes on to the next.
  let groups: ReturnType<typeof comboHints>['groups'] = [];
  try {
    groups = comboHints(state).groups;
  } catch {
    groups = [];
  }
  self.postMessage({ key, groups });
};
