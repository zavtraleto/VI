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
