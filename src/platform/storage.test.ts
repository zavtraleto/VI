import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({
  live: true,
  /** How the platform answers a read: as it should, not at all, or with a refusal. */
  read: 'answers' as 'answers' | 'hangs' | 'refuses',
  /** The platform refuses what is written to it. */
  writeRefused: false,
  kept: new Map<string, string>(),
  writes: [] as { keys: string[]; values: string[] }[],
  tracked: [] as { event: string; data?: object }[],
}));

vi.mock('@platform', () => ({
  platform: {
    get storage() {
      return platform.live
        ? {
            read: (keys: readonly string[]) => {
              if (platform.read === 'hangs') return new Promise(() => undefined);
              if (platform.read === 'refuses') return Promise.reject(new Error('refused'));
              return Promise.resolve(keys.map((key) => platform.kept.get(key) ?? null));
            },
            write: async (keys: readonly string[], values: readonly string[]) => {
              platform.writes.push({ keys: [...keys], values: [...values] });
              if (platform.writeRefused) throw new Error('refused');
              keys.forEach((key, i) => platform.kept.set(key, values[i]));
            },
          }
        : null;
    },
    track: (event: string, data?: object) => platform.tracked.push({ event, data }),
  },
}));

/** A browser's own storage, as far as the game uses it; `full` refuses what is written to it. */
function browserStorage(full = false): Map<string, string> {
  const items = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (full) throw new Error('QuotaExceededError');
        items.set(key, value);
      },
    },
  });
  return items;
}

/** Lets the answers of the platform that are already on their way arrive. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  platform.live = true;
  platform.read = 'answers';
  platform.writeRefused = false;
  platform.kept.clear();
  platform.writes.length = 0;
  platform.tracked.length = 0;
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('what the game keeps on a platform', () => {
  it('goes to the platform in one call, however many things are saved together', async () => {
    browserStorage();
    const { openStorage, saveAll, loadJson } = await import('./storage');
    await openStorage(['a', 'b']);
    expect(
      saveAll([
        ['a', { score: 5 }],
        ['b', null],
      ]),
    ).toBe(true);
    expect(platform.writes).toEqual([{ keys: ['a', 'b'], values: ['{"score":5}', 'null'] }]);
    expect(loadJson('a', { score: 0 })).toEqual({ score: 5 });
    expect(loadJson('b', {})).toEqual({});
  });

  it('saves one thing the same way', async () => {
    browserStorage();
    const { openStorage, saveJson } = await import('./storage');
    await openStorage(['a']);
    saveJson('a', { score: 7 });
    expect(platform.writes).toEqual([{ keys: ['a'], values: ['{"score":7}'] }]);
  });

  it('is kept in the browser where there is no platform', async () => {
    platform.live = false;
    const items = browserStorage();
    const { openStorage, saveAll, loadJson } = await import('./storage');
    await openStorage(['a', 'b']);
    saveAll([
      ['a', { score: 5 }],
      ['b', { on: true }],
    ]);
    expect(platform.writes).toEqual([]);
    expect(items.get('a')).toBe('{"score":5}');
    expect(loadJson('b', { on: false })).toEqual({ on: true });
  });
});

describe('a platform whose storage fails', () => {
  it('refuses to be read: the browser keeps what the game saves, and the failure is told', async () => {
    platform.read = 'refuses';
    platform.kept.set('a', '{"score":9}');
    const items = browserStorage();
    items.set('a', '{"score":3}');
    const { openStorage, saveJson, loadJson } = await import('./storage');
    await openStorage(['a']);
    expect(loadJson('a', { score: 0 })).toEqual({ score: 3 });
    expect(saveJson('a', { score: 4 })).toBe(true);
    expect(items.get('a')).toBe('{"score":4}');
    expect(platform.writes).toEqual([]);
    expect(platform.tracked).toEqual([{ event: 'save_failed', data: { stage: 'read', store: 'platform' } }]);
  });

  it('hangs: it is not waited for past three seconds, and the browser is used', async () => {
    vi.useFakeTimers();
    platform.read = 'hangs';
    const items = browserStorage();
    items.set('a', '{"score":3}');
    const { openStorage, loadJson, saveJson } = await import('./storage');
    let opened = false;
    void openStorage(['a']).then(() => (opened = true));
    await vi.advanceTimersByTimeAsync(2999);
    expect(opened).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(opened).toBe(true);
    expect(loadJson('a', { score: 0 })).toEqual({ score: 3 });
    saveJson('a', { score: 4 });
    expect(items.get('a')).toBe('{"score":4}');
    expect(platform.writes).toEqual([]);
    expect(platform.tracked).toEqual([{ event: 'save_failed', data: { stage: 'read', store: 'platform' } }]);
  });

  it('answers in time: nothing is told and the platform keeps what is saved', async () => {
    vi.useFakeTimers();
    browserStorage();
    const { openStorage, saveJson } = await import('./storage');
    await openStorage(['a']);
    await vi.advanceTimersByTimeAsync(5000);
    saveJson('a', { score: 4 });
    expect(platform.writes).toEqual([{ keys: ['a'], values: ['{"score":4}'] }]);
    expect(platform.tracked).toEqual([]);
  });

  it('refuses what is written: the save shows as not kept, and the failure is told once', async () => {
    platform.writeRefused = true;
    browserStorage();
    const { openStorage, saveJson, storageAvailable } = await import('./storage');
    await openStorage(['a']);
    saveJson('a', { score: 4 });
    await settle();
    expect(storageAvailable()).toBe(false);
    saveJson('a', { score: 5 });
    await settle();
    expect(platform.tracked).toEqual([{ event: 'save_failed', data: { stage: 'write', store: 'platform' } }]);
  });
});

describe('what is kept that cannot be read', () => {
  it('on a platform: broken text gives the defaults, and the failure is told', async () => {
    platform.kept.set('a', '{"score":');
    browserStorage();
    const { openStorage, loadJson, storageAvailable } = await import('./storage');
    await openStorage(['a']);
    expect(loadJson('a', { score: 0 })).toEqual({ score: 0 });
    expect(storageAvailable()).toBe(false);
    expect(platform.tracked).toEqual([{ event: 'save_failed', data: { stage: 'parse', store: 'platform' } }]);
  });

  it('in the browser: broken text gives the defaults, and the failure is told', async () => {
    platform.live = false;
    const items = browserStorage();
    items.set('a', 'not json');
    const { openStorage, loadJson } = await import('./storage');
    await openStorage(['a']);
    expect(loadJson('a', { score: 0 })).toEqual({ score: 0 });
    expect(platform.tracked).toEqual([{ event: 'save_failed', data: { stage: 'parse', store: 'browser' } }]);
  });

  it('a browser that refuses what is written: the save says so, and the failure is told', async () => {
    platform.live = false;
    browserStorage(true);
    const { openStorage, saveJson, storageAvailable } = await import('./storage');
    await openStorage(['a']);
    expect(saveJson('a', { score: 4 })).toBe(false);
    expect(storageAvailable()).toBe(false);
    expect(platform.tracked).toEqual([{ event: 'save_failed', data: { stage: 'write', store: 'browser' } }]);
  });

  it('a save of an unexpected form is told as one that cannot be read, once a visit', async () => {
    platform.live = false;
    browserStorage();
    const { openStorage, tellBroken } = await import('./storage');
    await openStorage(['a']);
    tellBroken();
    tellBroken();
    expect(platform.tracked).toEqual([{ event: 'save_failed', data: { stage: 'parse', store: 'browser' } }]);
  });
});
