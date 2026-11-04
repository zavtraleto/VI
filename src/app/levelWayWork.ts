import type { RunState } from '../rules/types';
import { WAY_INLINE_STATES, wayFrom, type WayFound } from './levelWay';

interface Asked {
  key: string;
  state: RunState;
}
interface Answer {
  key: string;
  found: WayFound;
}

/**
 * How far a board of a level is from being cleared, counted aside, off the frame: a board is sent
 * to a worker, and what the solver found comes back a moment later (`levelWay.ts`). Only the latest
 * board is worth counting; one that waited is dropped for the next. Without a worker the count is
 * made on the frame, within a small bound.
 */
export class LevelWayWork {
  private worker: Worker | null = null;
  private inline = typeof Worker === 'undefined';
  private counting = '';
  private waiting: Asked | null = null;
  private answer: Answer = { key: '', found: { fewest: null, settled: false } };

  /** What was found from the board named `key`, or null while it is being counted. Asking for a new board sets its count going. */
  found(key: string, state: RunState): WayFound | null {
    if (this.answer.key === key) return this.answer.found;
    if (this.inline) {
      this.answer = { key, found: wayFrom(state, WAY_INLINE_STATES) };
      return this.answer.found;
    }
    if (this.counting === key || this.waiting?.key === key) return null;
    this.waiting = { key, state: structuredClone(state) };
    this.send();
    return null;
  }

  private send(): void {
    if (this.counting !== '' || !this.waiting) return;
    try {
      this.worker ??= this.start();
      this.counting = this.waiting.key;
      this.worker.postMessage(this.waiting);
      this.waiting = null;
    } catch {
      this.fail();
    }
  }

  private start(): Worker {
    const worker = new Worker(new URL('./levelWay.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<Answer>) => {
      this.answer = event.data;
      this.counting = '';
      this.send();
    };
    worker.onerror = () => this.fail();
    return worker;
  }

  /** The worker cannot be used: from here on the count is made on the frame. */
  private fail(): void {
    this.worker?.terminate();
    this.worker = null;
    this.inline = true;
    this.counting = '';
    this.waiting = null;
  }
}
