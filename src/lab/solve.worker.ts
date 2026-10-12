import { answer, type Ask } from './labFacts';

/** Asks a board off the page: a question comes in with its number, and its answer goes back under it. */
self.onmessage = (event: MessageEvent<Ask>) => {
  self.postMessage(answer(event.data));
};
