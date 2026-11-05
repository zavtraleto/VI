import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({
  interstitialSupported: true,
  rewardedSupported: true,
  /** The advertisement asked for last, still waiting for its end. */
  pending: null as ((rewarded: boolean) => void) | null,
  tracked: [] as { event: string; data?: Record<string, unknown> }[],
  /** How many seconds into the visit the game is. */
  visit: 600,
}));

vi.mock('./health', () => ({ visitSeconds: () => platform.visit }));

/** The bar of the game (word of the owner, 5 November 2026): from the eighth place of the row, after three minutes of the visit. */
const BAR = { minPlace: 8, minVisitSec: 180 };

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
  platform.visit = 600;
});

describe('the advertisements the game asks for', () => {
  it('an interstitial is told with what brought it, the place of the row and the seconds of the visit', async () => {
    const { askInterstitial, adOpen, adsAsked } = await fresh();
    const done = vi.fn();
    askInterstitial('level_end', { step_id: 'level_P09', step_index: 9 }, { ...BAR, place: 9 }, done);
    expect(platform.tracked).toEqual([
      { event: 'ad_requested', data: { kind: 'interstitial', reason: 'level_end', step_id: 'level_P09', step_index: 9, visit_sec: 600 } },
    ]);
    expect(done).not.toHaveBeenCalled();
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
    askInterstitial('session_end', { step_id: 'endless' }, { ...BAR, place: 12 }, done);
    platform.pending!(false);
    expect(platform.tracked).toEqual([]);
    expect(adsAsked()).toBe(0);
    expect(adOpen()).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('an end said twice closes the advertisement once', async () => {
    const { askInterstitial, askRewarded, adOpen } = await fresh();
    askInterstitial('live_end', { step_id: 'live-1', step_index: 16 }, { ...BAR, place: 16 }, () => undefined);
    const first = platform.pending!;
    askRewarded('double_score', { step_id: 'live-1', step_index: 16 }, () => undefined);
    first(false);
    first(false);
    expect(adOpen()).toBe(true);
    platform.pending!(false);
    expect(adOpen()).toBe(false);
  });
});

describe('the pauses an interstitial may come at (word of the owner, 5 November 2026)', () => {
  it('none before three minutes of the visit: nothing is asked for, nothing told, and the game goes on at once', async () => {
    platform.visit = 179;
    const { askInterstitial, adsAsked, adOpen } = await fresh();
    const done = vi.fn();
    askInterstitial('level_end', { step_id: 'level_P20', step_index: 20 }, { ...BAR, place: 20 }, done);
    expect(platform.pending).toBeNull();
    expect(platform.tracked).toEqual([]);
    expect(adsAsked()).toBe(0);
    expect(adOpen()).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('none before the eighth place of the row, however long the visit', async () => {
    const { askInterstitial, adsAsked } = await fresh();
    const done = vi.fn();
    for (const reason of ['level_end', 'session_end', 'live_end'] as const) askInterstitial(reason, { step_id: 'level_P07', step_index: 7 }, { ...BAR, place: 7 }, done);
    expect(platform.pending).toBeNull();
    expect(platform.tracked).toEqual([]);
    expect(adsAsked()).toBe(0);
    expect(done).toHaveBeenCalledTimes(3);
  });

  it('none where the player stands on no place of the row, as on a board of the lab', async () => {
    const { askInterstitial } = await fresh();
    const done = vi.fn();
    askInterstitial('level_end', { step_id: 'level_X' }, { ...BAR, place: null }, done);
    expect(platform.tracked).toEqual([]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('from the eighth place and three minutes on, one going on from a board asks for one level_end, and the game waits for its end', async () => {
    platform.visit = 180;
    const { askInterstitial, adsAsked } = await fresh();
    const done = vi.fn();
    askInterstitial('level_end', { step_id: 'level_P08', step_index: 8 }, { ...BAR, place: 8 }, done);
    expect(platform.tracked.map(({ event, data }) => [event, data?.reason])).toEqual([['ad_requested', 'level_end']]);
    expect(adsAsked()).toBe(1);
    expect(done).not.toHaveBeenCalled();
    platform.pending!(false);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('pauseFits reads the place and the visit at their bounds', async () => {
    const { pauseFits } = await fresh();
    expect(pauseFits({ ...BAR, place: 8 }, 180)).toBe(true);
    expect(pauseFits({ ...BAR, place: 7 }, 1000)).toBe(false);
    expect(pauseFits({ ...BAR, place: 30 }, 179)).toBe(false);
    expect(pauseFits({ ...BAR, place: null }, 1000)).toBe(false);
  });
});
