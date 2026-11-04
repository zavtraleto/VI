import type { RunState } from '../rules/types';
import { wayFrom, type WayFound } from './levelWay';

/** Counts how far a board of a level is from being cleared, off the frame: the board comes in with its name, and what was found goes back under it. */
self.onmessage = (event: MessageEvent<{ key: string; state: RunState }>) => {
  const { key, state } = event.data;
  // A board that cannot be counted is not known: the worker goes on to the next.
  let found: WayFound = { fewest: null, settled: false };
  try {
    found = wayFrom(state);
  } catch {
    found = { fewest: null, settled: false };
  }
  self.postMessage({ key, found });
};
