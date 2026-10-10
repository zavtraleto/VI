import type { ShortGroup } from '../rules/level';
import type { RunState } from '../rules/types';
import { comboHints } from './comboHint';

/**
 * The hint of a level is counted aside, off the frame: a board is sent to a worker, and its
 * plaques come back a moment later. Most boards take a fraction of a millisecond; one in a
 * hundred takes a tenth of a second and more, and that is not taken out of a frame.
 */

/** Boards the solver may see where the hint has to be counted on the frame after all: no worker could be started. */
const INLINE_MAX_STATES = 1_500;

/** The name of a board as its plaques depend on it: the level, its dice as they stand and where the player is. */
export function boardKey(state: RunState): string {
  const { player } = state;
  const dice = state.cubes.map((cube) => `${cube.id}.${cube.x}.${cube.z}.${cube.ori.top}.${cube.ori.north}.${cube.state}.${cube.reactionId}`);
  return `${state.levelRun?.spec.id ?? ''}|${player.x}.${player.z}.${player.level}|${dice.join(',')}`;
}

/** Whether a heap counted on another board is on this one unchanged: its dice stand where they stood, showing its face. */
export function stillShort(state: RunState, group: ShortGroup): boolean {
  return group.cells.every(({ x, z }) => state.cubes.some((cube) => cube.x === x && cube.z === z && cube.state === 'idle' && cube.ori.top === group.value));
}

interface Asked {
  key: string;
  state: RunState;
}
interface Answer {
  key: string;
  groups: ShortGroup[];
}

export class ComboHintWork {
  private worker: Worker | null = null;
  /** No worker can be had: the hint is counted on the frame, within a smaller bound. */
  private inline = typeof Worker === 'undefined';
  /** The board the worker is counting, and the one that waits for it to be free: only the latest is worth counting. */
  private counting = '';
  private waiting: Asked | null = null;
  private answer: Answer = { key: '', groups: [] };

  /**
   * The plaques of the board named `key`, or null while they are being counted. Asking for a
   * board that has not been asked for sets its count going, and drops any that waited.
   */
  groups(key: string, state: RunState): ShortGroup[] | null {
    if (this.answer.key === key) return this.answer.groups;
    if (this.inline) {
      this.answer = { key, groups: comboHints(state, INLINE_MAX_STATES).groups };
      return this.answer.groups;
    }
    if (this.counting === key || this.waiting?.key === key) return null;
    // The board is sent as it is now: by the time the worker is free it will have moved on.
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
    const worker = new Worker(new URL('./comboHint.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<Answer>) => {
      this.answer = event.data;
      this.counting = '';
      this.send();
    };
    worker.onerror = () => this.fail();
    return worker;
  }

  /** The worker cannot be used: from here on the hint is counted on the frame. */
  private fail(): void {
    this.worker?.terminate();
    this.worker = null;
    this.inline = true;
    this.counting = '';
    this.waiting = null;
  }
}
