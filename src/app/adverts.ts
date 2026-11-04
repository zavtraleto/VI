import { platform } from '@platform';
import type { PlatformData, RewardedPlacement } from '../platform/platform';
import { visitSeconds } from './health';

/**
 * The advertisements the game asks the platform for, as the analytics hear of them: what brought
 * each, where in the row the player stood and how far into the visit. The platform counts what it
 * showed (`advertisement_*` of Playgama), not why it was asked for nor where the player was.
 */

/** What an interstitial is asked for: the end of a session, the end of a live session, the moves taken back. */
export type InterstitialReason = 'session_end' | 'live_end' | 'undos';

/** Advertisements of the game that have been asked for and not yet come to their end. */
let open = 0;
/** Advertisements the game has asked for in this visit, where the platform shows them. */
let asked = 0;

/** An advertisement the game asked for is on now: a page hidden under it may be the player gone to it. */
export function adOpen(): boolean {
  return open > 0;
}

/** How many advertisements the game has asked for in this visit. */
export function adsAsked(): number {
  return asked;
}

/** Counts the advertisement as asked and open, and gives `done` that closes it once. */
function opening(kind: 'interstitial' | 'rewarded', reason: string, step: PlatformData, supported: boolean): () => void {
  if (supported) {
    asked++;
    platform.track('ad_requested', { kind, reason, ...step, visit_sec: visitSeconds() });
  }
  open++;
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    open--;
  };
}

/** An interstitial at a break: `done` once it is over, shown or not. */
export function askInterstitial(reason: InterstitialReason, step: PlatformData, done: () => void): void {
  const close = opening('interstitial', reason, step, platform.interstitialSupported);
  platform.interstitial(() => {
    close();
    done();
  });
}

/** A rewarded advertisement for `placement`: `done(true)` only where it was watched to its end. */
export function askRewarded(placement: RewardedPlacement, step: PlatformData, done: (rewarded: boolean) => void): void {
  const close = opening('rewarded', placement, step, platform.rewardedSupported);
  platform.rewarded(placement, (rewarded) => {
    close();
    done(rewarded);
  });
}
