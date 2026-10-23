import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Platform } from '../../src/platform/platform';

/** The adapter as the page has it at its start: nothing of the SDK has happened yet. */
async function fresh(): Promise<Platform> {
  vi.resetModules();
  return (await import('./adapter')).platform;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Playgama without its SDK', () => {
  it('is no platform, but for the address of the game', async () => {
    const platform = await fresh();
    await platform.init();
    expect(platform.language()).toBeNull();
    expect(platform.storage).toBeNull();
    expect(platform.leaderboard).toBeNull();
    expect(platform.auth).toBeNull();
    expect(platform.gameUrl).toBe('https://playgama.ai/play/hbhtrqdwvr');
    const done = vi.fn();
    platform.interstitial(done);
    expect(done).toHaveBeenCalledTimes(1);
    expect(platform.rewardedSupported).toBe(false);
    const rewarded = vi.fn();
    platform.rewarded('show_way', rewarded);
    expect(rewarded).toHaveBeenCalledTimes(1);
    expect(rewarded).toHaveBeenCalledWith(false);
    const listener = vi.fn();
    platform.onPause(listener);
    platform.onAudio(listener);
    expect(() => {
      platform.tell('game_ready');
      platform.track('records_opened', { network: false });
      platform.trackPerformance({ fps: 60 });
    }).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('hangs: an SDK that does not start is not waited for past its patience', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('bridge', { initialize: () => new Promise(() => undefined) });
    const platform = await fresh();
    const started = platform.init();
    await vi.advanceTimersByTimeAsync(8000);
    await started;
    expect(platform.storage).toBeNull();
    expect(platform.language()).toBeNull();
  });
});

describe('Playgama with its SDK', () => {
  it('live: reads what it keeps as text, and has no table where the platform has none', async () => {
    vi.stubGlobal('bridge', {
      initialize: () => Promise.resolve(),
      platform: { language: 'ru', getServerTime: () => Promise.reject(new Error('no clock')) },
      storage: { get: async () => ['text', null, { a: 1 }, undefined] },
      leaderboards: { type: 'not_available' },
      player: { isAuthorizationSupported: false, isGuest: true },
    });
    const platform = await fresh();
    await platform.init();
    expect(platform.language()).toBe('ru');
    expect(await platform.storage!.read(['a', 'b', 'c', 'd'])).toEqual(['text', null, '{"a":1}', null]);
    expect(platform.leaderboard).toBeNull();
    expect(platform.auth).toBeNull();
  });
});

/** An SDK that shows rewarded advertisements: the states it goes through are given by the test, as the platform would send them. */
function rewardedSdk(supported = true) {
  const listeners = new Map<string, (state: string) => void>();
  const shown: (string | null | undefined)[] = [];
  const bridge = {
    initialize: () => Promise.resolve(),
    gameVersion: '',
    EVENT_NAME: { REWARDED_STATE_CHANGED: 'rewarded_state_changed' },
    REWARDED_STATE: { LOADING: 'loading', OPENED: 'opened', CLOSED: 'closed', FAILED: 'failed', REWARDED: 'rewarded' },
    platform: { language: 'en', getServerTime: () => Promise.reject(new Error('no clock')) },
    leaderboards: { type: 'not_available' },
    player: { isAuthorizationSupported: false, isGuest: true },
    advertisement: {
      isRewardedSupported: supported,
      on: (event: string, listener: (state: string) => void) => listeners.set(event, listener),
      off: (event: string) => listeners.delete(event),
      showRewarded: (placement?: string | null) => shown.push(placement),
    },
  };
  // The adapter keeps its time by the clock of the page, which a test in Node has as its own.
  vi.stubGlobal('window', globalThis);
  const send = (...states: string[]): void => {
    for (const state of states) listeners.get('rewarded_state_changed')?.(state);
  };
  return { bridge, shown, send, listening: () => listeners.size > 0 };
}

describe('a rewarded advertisement on Playgama', () => {
  it('gives what it is for once it is watched and closed', async () => {
    const sdk = rewardedSdk();
    vi.stubGlobal('bridge', sdk.bridge);
    const platform = await fresh();
    await platform.init();
    expect(platform.rewardedSupported).toBe(true);
    const done = vi.fn();
    platform.rewarded('show_way', done);
    expect(sdk.shown).toEqual(['show_way']);
    sdk.send('loading', 'opened', 'rewarded');
    expect(done).not.toHaveBeenCalled();
    sdk.send('closed');
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(true);
    expect(sdk.listening()).toBe(false);
  });

  it('gives nothing when it is closed before the end', async () => {
    const sdk = rewardedSdk();
    vi.stubGlobal('bridge', sdk.bridge);
    const platform = await fresh();
    await platform.init();
    const done = vi.fn();
    platform.rewarded('double_score', done);
    expect(sdk.shown).toEqual(['double_score']);
    sdk.send('loading', 'opened', 'closed');
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(false);
    expect(sdk.listening()).toBe(false);
  });

  it('gives nothing when it fails', async () => {
    const sdk = rewardedSdk();
    vi.stubGlobal('bridge', sdk.bridge);
    const platform = await fresh();
    await platform.init();
    const done = vi.fn();
    platform.rewarded('show_way', done);
    sdk.send('loading', 'failed', 'closed');
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(false);
  });

  it('gives nothing, and shows none, where the platform has no rewarded advertisement', async () => {
    const sdk = rewardedSdk(false);
    vi.stubGlobal('bridge', sdk.bridge);
    const platform = await fresh();
    await platform.init();
    expect(platform.rewardedSupported).toBe(false);
    const done = vi.fn();
    platform.rewarded('show_way', done);
    expect(sdk.shown).toEqual([]);
    expect(done).toHaveBeenCalledWith(false);
  });

  it('gives nothing where nothing is heard of it', async () => {
    const sdk = rewardedSdk();
    vi.stubGlobal('bridge', sdk.bridge);
    const platform = await fresh();
    await platform.init();
    vi.useFakeTimers();
    const done = vi.fn();
    platform.rewarded('show_way', done);
    vi.advanceTimersByTime(1500);
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(false);
  });
});
