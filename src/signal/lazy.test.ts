import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lazy, within } from './lazy';

afterEach(() => {
  vi.useRealTimers();
});

describe('Lazy', () => {
  it('fetches once and keeps what came', async () => {
    const fetch = vi.fn(() => Promise.resolve('kit'));
    const lazy = new Lazy(fetch);
    expect(lazy.now).toBeNull();
    const [a, b] = await Promise.all([lazy.get(), lazy.get()]);
    expect([a, b, lazy.now]).toEqual(['kit', 'kit', 'kit']);
    await lazy.get();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('gives null on a failed fetch and asks again the next time', async () => {
    const fetch = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('kit');
    const lazy = new Lazy(fetch);
    expect(await lazy.get()).toBeNull();
    expect(lazy.now).toBeNull();
    expect(await lazy.get()).toBe('kit');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('within', () => {
  it('waits for what comes in time', async () => {
    vi.useFakeTimers();
    const late = new Promise<string>((resolve) => setTimeout(() => resolve('picture'), 2900));
    const waited = within(late, 3000);
    await vi.advanceTimersByTimeAsync(2900);
    expect(await waited).toBe('picture');
  });

  it('goes on without what has not come in time', async () => {
    vi.useFakeTimers();
    const waited = within(new Promise<string>(() => {}), 3000);
    let done: string | null | undefined;
    void waited.then((value) => (done = value));
    await vi.advanceTimersByTimeAsync(2999);
    expect(done).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBeNull();
  });

  it('goes on at once without what failed', async () => {
    expect(await within(Promise.reject(new Error('404')), 3000)).toBeNull();
  });
});
