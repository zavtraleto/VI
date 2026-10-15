import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserShare, none } from './platform';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('no platform', () => {
  it('starts at once and has nothing of its own', async () => {
    await none.init();
    expect(none.language()).toBeNull();
    expect(none.storage).toBeNull();
    expect(none.leaderboard).toBeNull();
    expect(none.auth).toBeNull();
    expect(none.gameUrl).toBeNull();
  });

  it('tells the time by the device', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_234_567);
    expect(none.now()).toBe(1_234_567);
  });

  it('shows no advertisement and goes on at once', () => {
    const done = vi.fn();
    none.interstitial(done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('never asks for a pause or for silence, and hears nothing', () => {
    const listener = vi.fn();
    none.onPause(listener);
    none.onAudio(listener);
    none.tell('game_ready');
    none.tell('level_started', 'endless');
    none.track('records_opened', { network: false });
    none.trackPerformance({ fps: 60 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('sending text out by the browser', () => {
  /** A desktop browser: no sheet of the device, a clipboard that writes what it is given. */
  function desktop(): string[] {
    const written: string[] = [];
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('navigator', { clipboard: { writeText: async (text: string) => void written.push(text) } });
    return written;
  }

  it('puts the text on the clipboard of the browser', async () => {
    const written = desktop();
    expect(await browserShare('VI 120')).toBe('copied');
    expect(written).toEqual(['VI 120']);
  });

  it('asks the clipboard of the platform first, where it is given', async () => {
    const written = desktop();
    const copied: string[] = [];
    expect(await browserShare('VI 120', async (text) => void copied.push(text))).toBe('copied');
    expect(copied).toEqual(['VI 120']);
    expect(written).toEqual([]);
  });

  it('goes to the browser when the platform cannot', async () => {
    const written = desktop();
    expect(await browserShare('VI 120', () => Promise.reject(new Error('denied')))).toBe('copied');
    expect(written).toEqual(['VI 120']);
  });
});
