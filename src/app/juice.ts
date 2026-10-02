import type { BoardBeat } from '../render/burst';
import type { GameEvent, RunState } from '../rules';

/**
 * A beat: something the player has done that the game answers out loud - a group sent, a chain
 * added to, a step of the contact. The answer is as large as the result: every tier has its
 * own size, and the largest are kept for what is rare. Presentation only: the rules never read
 * any of this.
 */
export interface Beat extends BoardBeat {
  /** Points the beat brought; 0 when it is not scored. */
  points: number;
  /** How long the chain is after it; 1 for a group that starts one, 0 when no group goes. */
  chain: number;
}

/** How long the game holds its breath on a beat, by tier, in milliseconds. */
export const HITSTOP_MS: readonly number[] = [0, 25, 40, 60, 80];
/** The simulation is never held for longer than this at a stretch, however the beats pile up. */
const HITSTOP_MOST_MS = 110;
/** A group this large is a beat of its own, without a chain. */
const LARGE_GROUP = 5;

/** A group that starts a chain: small, unless it is large. */
export function matchTier(count: number): number {
  return count >= LARGE_GROUP ? 1 : 0;
}

/** A chain added to: every join is a tier up, until the last. */
export function chainTier(chain: number): number {
  if (chain <= 1) return 0;
  if (chain === 2) return 1;
  if (chain === 3) return 2;
  if (chain <= 5) return 3;
  return 4;
}

/** The beats of a tick: what the rules say has happened, with where on the board it did. */
export function beatsOf(state: RunState, events: readonly GameEvent[]): Beat[] {
  const beats: Beat[] = [];
  const cellsOf = (pick: (cube: RunState['cubes'][number]) => boolean) =>
    state.cubes.filter((cube) => cube.state === 'sinking' && pick(cube)).map((cube) => ({ x: cube.x, z: cube.z }));
  for (const event of events) {
    if (event.type === 'match') {
      beats.push({
        kind: 'match',
        value: event.value,
        tier: matchTier(event.count),
        cells: cellsOf((cube) => cube.reactionId === event.reactionId),
        points: event.points,
        chain: 1,
      });
    } else if (event.type === 'chain') {
      // The dice that have just joined are where it happened; a long chain lights all of it.
      const all = cellsOf((cube) => cube.reactionId === event.reactionId);
      const fresh = cellsOf((cube) => cube.reactionId === event.reactionId && cube.t <= 1);
      beats.push({
        kind: 'chain',
        value: event.value,
        tier: chainTier(event.chain),
        cells: event.chain >= 3 || fresh.length === 0 ? all : fresh,
        points: event.points,
        chain: event.chain,
      });
    } else if (event.type === 'happyOne') {
      beats.push({ kind: 'one', value: 1, tier: 2, cells: cellsOf((cube) => cube.ori.top === 1 && cube.reactionId === 0), points: event.points, chain: 0 });
    } else if (event.type === 'levelUp' && !state.tutorial) {
      beats.push({ kind: 'level', value: 0, tier: 0, cells: [], points: 0, chain: 0 });
    }
  }
  return beats;
}

/** A step of the contact reached, and the moment the contact goes past its last one. */
export function stepBeat(): Beat {
  return { kind: 'step', value: 0, tier: 1, cells: [], points: 0, chain: 0 };
}

export function peakBeat(): Beat {
  return { kind: 'peak', value: 0, tier: 4, cells: [], points: 0, chain: 0 };
}

/**
 * The breath the game holds on a beat: for a few hundredths of a second the simulation stands
 * still while the picture goes on. Time held is time the player does not lose: the clock of
 * the rules stops with everything else.
 */
export class Hitstop {
  private left = 0;

  hold(tier: number): void {
    const ms = HITSTOP_MS[Math.max(0, Math.min(HITSTOP_MS.length - 1, Math.round(tier)))];
    this.left = Math.min(HITSTOP_MOST_MS, Math.max(this.left, ms));
  }

  /** Takes what is held out of a frame's time: returns the time the simulation may have. */
  take(dtMs: number): number {
    const held = Math.min(this.left, Math.max(0, dtMs));
    this.left -= held;
    return dtMs - held;
  }

  reset(): void {
    this.left = 0;
  }
}
