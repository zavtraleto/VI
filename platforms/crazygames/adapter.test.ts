import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Platform } from '../../src/platform/platform';

/** The adapter as the page has it at its start: nothing of the SDK has happened yet. */
async function fresh(): Promise<Platform> {
  vi.resetModules();
  return (await import('./adapter')).platform;
}

/** A page as far as the adapter uses it. */
function page(hidden = false): void {
  vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener: vi.fn() });
  vi.stubGlobal('document', { hidden });
}

type Callbacks = { adStarted?: () => void; adFinished?: () => void; adError?: (error: { code?: string }) => void };

/** The SDK v3 as the adapter sees it, with a record of what it was told. */
function crazy(environment = 'crazygames') {
  const kept = new Map<string, string>([['vi-settings', '{"a":1}']]);
  const settingsListeners: ((settings: { muteAudio?: boolean }) => void)[] = [];
  const ads: { type: string; callbacks: Callbacks }[] = [];
  const sdk = {
    init: vi.fn(() => Promise.resolve()),
    environment,
    game: {
      gameplayStart: vi.fn(),
      gameplayStop: vi.fn(),
      loadingStart: vi.fn(),
      loadingStop: vi.fn(),
      setGameContext: vi.fn(),
      clearGameContext: vi.fn(),
      settings: { muteAudio: false },
      addSettingsChangeListener: (listener: (settings: { muteAudio?: boolean }) => void) => settingsListeners.push(listener),
    },
    ad: { requestAd: vi.fn((type: string, callbacks: Callbacks) => ads.push({ type, callbacks })) },
    data: { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => kept.set(key, value) },
    user: { systemInfo: { locale: 'pt-BR' } },
  };
  vi.stubGlobal('CrazyGames', { SDK: sdk });
  return { sdk, kept, settingsListeners, ads };
}

beforeEach(() => page());

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('CrazyGames without its SDK', () => {
  it('is no platform', async () => {
    const platform = await fresh();
    await platform.init();
    expect(platform.language()).toBeNull();
    expect(platform.storage).toBeNull();
    expect(platform.leaderboard).toBeNull();
    expect(platform.auth).toBeNull();
    expect(platform.gameUrl).toBeNull();
    expect(platform.interstitialSupported).toBe(false);
    expect(platform.rewardedSupported).toBe(false);
    const done = vi.fn();
    platform.interstitial(done);
    expect(done).toHaveBeenCalledTimes(1);
    const rewarded = vi.fn();
    platform.rewarded('show_way', rewarded);
    expect(rewarded).toHaveBeenCalledWith(false);
    expect(() => {
      platform.tell('game_ready');
      platform.track('records_opened', { network: false });
    }).not.toThrow();
  });

  it('is no platform where the SDK says it is disabled: a site that is not CrazyGames', async () => {
    const { sdk } = crazy('disabled');
    const platform = await fresh();
    await platform.init();
    expect(platform.storage).toBeNull();
    platform.tell('level_started');
    expect(sdk.game.gameplayStart).not.toHaveBeenCalled();
  });

  it('hangs: an SDK that does not start is not waited for past its patience', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('CrazyGames', { SDK: { init: () => new Promise(() => undefined) } });
    const platform = await fresh();
    const started = platform.init();
    await vi.advanceTimersByTimeAsync(8000);
    await started;
    expect(platform.storage).toBeNull();
  });
});

describe('CrazyGames with its SDK', () => {
  it('reads the language, and keeps the save in the Data module', async () => {
    const { kept } = crazy();
    const platform = await fresh();
    await platform.init();
    expect(platform.language()).toBe('pt-BR');
    expect(await platform.storage!.read(['vi-settings', 'vi-run'])).toEqual(['{"a":1}', null]);
    await platform.storage!.write(['vi-run'], ['{"b":2}']);
    expect(kept.get('vi-run')).toBe('{"b":2}');
  });

  it('tells the opening and the breaks of play, each once, and not a hidden page', async () => {
    const { sdk } = crazy();
    const platform = await fresh();
    await platform.init();
    expect(sdk.game.loadingStart).toHaveBeenCalledTimes(1);
    platform.tell('game_ready');
    expect(sdk.game.loadingStop).toHaveBeenCalledTimes(1);
    platform.tell('level_started', 'a');
    platform.tell('level_resumed', 'a');
    expect(sdk.game.gameplayStart).toHaveBeenCalledTimes(1);
    // A hidden page is seen by the platform itself: the pause it brings is not a break.
    vi.stubGlobal('document', { hidden: true });
    platform.tell('level_paused', 'a');
    expect(sdk.game.gameplayStop).not.toHaveBeenCalled();
    vi.stubGlobal('document', { hidden: false });
    platform.tell('level_paused', 'a');
    platform.tell('level_failed', 'a');
    expect(sdk.game.gameplayStop).toHaveBeenCalledTimes(1);
    expect(sdk.game.setGameContext).toHaveBeenCalledWith({ level: 'a' });
    expect(sdk.game.clearGameContext).toHaveBeenCalledTimes(1);
  });

  it('follows the sound setting of CrazyGames', async () => {
    const { settingsListeners } = crazy();
    const platform = await fresh();
    await platform.init();
    const audio = vi.fn();
    platform.onAudio(audio);
    expect(audio).toHaveBeenLastCalledWith(true);
    settingsListeners.forEach((listener) => listener({ muteAudio: true }));
    expect(audio).toHaveBeenLastCalledWith(false);
  });

  it('shows no advertisement unless the build asks for them: a Basic Launch has none', async () => {
    const { sdk } = crazy();
    const platform = await fresh();
    await platform.init();
    expect(platform.interstitialSupported).toBe(false);
    expect(platform.rewardedSupported).toBe(false);
    const done = vi.fn();
    platform.interstitial(done);
    expect(done).toHaveBeenCalledTimes(1);
    expect(sdk.ad.requestAd).not.toHaveBeenCalled();
  });
});

describe('CrazyGames with advertisements', () => {
  beforeEach(() => vi.stubEnv('VITE_CRAZYGAMES_ADS', 'on'));

  it('rewards only an advertisement that finished, and the game waits while it is on', async () => {
    const { ads } = crazy();
    const platform = await fresh();
    await platform.init();
    expect(platform.rewardedSupported).toBe(true);
    const paused = vi.fn();
    platform.onPause(paused);
    const done = vi.fn();
    platform.rewarded('double_score', done);
    expect(ads[0].type).toBe('rewarded');
    ads[0].callbacks.adStarted!();
    expect(paused).toHaveBeenLastCalledWith(true);
    ads[0].callbacks.adFinished!();
    expect(paused).toHaveBeenLastCalledWith(false);
    expect(done).toHaveBeenCalledWith(true);

    const failed = vi.fn();
    platform.rewarded('show_way', failed);
    ads[1].callbacks.adError!({ code: 'unfilled' });
    expect(failed).toHaveBeenCalledWith(false);
    expect(platform.rewardedSupported).toBe(true);
  });

  it('draws nothing for advertisements once the platform says there are none this visit', async () => {
    const { ads } = crazy();
    const platform = await fresh();
    await platform.init();
    const done = vi.fn();
    platform.interstitial(done);
    expect(ads[0].type).toBe('midgame');
    ads[0].callbacks.adError!({ code: 'adsDisabled' });
    expect(done).toHaveBeenCalledTimes(1);
    expect(platform.rewardedSupported).toBe(false);
    expect(platform.interstitialSupported).toBe(false);
  });

  it('does not wait for an advertisement that never starts', async () => {
    vi.useFakeTimers();
    page();
    crazy();
    const platform = await fresh();
    await platform.init();
    const done = vi.fn();
    platform.interstitial(done);
    await vi.advanceTimersByTimeAsync(8000);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
