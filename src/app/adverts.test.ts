import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({
  interstitialSupported: true,
  rewardedSupported: true,
  /** The advertisement asked for last, still waiting for its end. */
  pending: null as ((rewarded: boolean) => void) | null,
  tracked: [] as { event: string; data?: Record<string, unknown> }[],
}));

vi.mock('@platform', () => ({
  platform: {
    get interstitialSupported() {
      return platform.interstitialSupported;
    },
    get rewardedSupported() {
      return platform.rewardedSupported;
    },
    interstitial: (done: () => void) => (platform.pending = () => done()),
    rewarded: (_: string, done: (rewarded: boolean) => void) => (platform.pending = done),
    track: (event: string, data?: Record<string, unknown>) => platform.tracked.push({ event, data }),
  },
}));

async function fresh(): Promise<typeof import('./adverts')> {
  vi.resetModules();
  return import('./adverts');
}

beforeEach(() => {
  platform.interstitialSupported = true;
  platform.rewardedSupported = true;
  platform.pending = null;
  platform.tracked = [];
});

describe('the advertisements the game asks for', () => {
  it('an interstitial is told with what brought it, the place of the row and the seconds of the visit', async () => {
    const { askInterstitial, adOpen, adsAsked } = await fresh();
    const done = vi.fn();
    askInterstitial('undos', { step_id: 'level_P06', step_index: 6 }, done);
    expect(platform.tracked).toEqual([
      { event: 'ad_requested', data: { kind: 'interstitial', reason: 'undos', step_id: 'level_P06', step_index: 6, visit_sec: expect.any(Number) } },
    ]);
    expect(adOpen()).toBe(true);
    expect(adsAsked()).toBe(1);
    platform.pending!(false);
    expect(done).toHaveBeenCalledTimes(1);
    expect(adOpen()).toBe(false);
  });

  it('a rewarded one is told as asked, its placement for the reason, and its answer goes through', async () => {
    const { askRewarded, adOpen, adsAsked } = await fresh();
    const done = vi.fn();
    askRewarded('show_way', { step_id: 'level_P20', step_index: 20 }, done);
    expect(platform.tracked[0]).toEqual({
      event: 'ad_requested',
      data: { kind: 'rewarded', reason: 'show_way', step_id: 'level_P20', step_index: 20, visit_sec: expect.any(Number) },
    });
    expect(adOpen()).toBe(true);
    platform.pending!(true);
    expect(done).toHaveBeenCalledWith(true);
    expect(adOpen()).toBe(false);
    expect(adsAsked()).toBe(1);
  });

  it('where the platform shows none, nothing is told or counted, and the game goes on', async () => {
    platform.interstitialSupported = false;
    const { askInterstitial, adsAsked, adOpen } = await fresh();
    const done = vi.fn();
    askInterstitial('session_end', { step_id: 'endless' }, done);
    platform.pending!(false);
    expect(platform.tracked).toEqual([]);
    expect(adsAsked()).toBe(0);
    expect(adOpen()).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('an end said twice closes the advertisement once', async () => {
    const { askInterstitial, askRewarded, adOpen } = await fresh();
    askInterstitial('live_end', { step_id: 'live-1', step_index: 16 }, () => undefined);
    const first = platform.pending!;
    askRewarded('double_score', { step_id: 'live-1', step_index: 16 }, () => undefined);
    first(false);
    first(false);
    expect(adOpen()).toBe(true);
    platform.pending!(false);
    expect(adOpen()).toBe(false);
  });
});
