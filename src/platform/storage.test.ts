import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({
  live: true,
  kept: new Map<string, string>(),
  writes: [] as { keys: string[]; values: string[] }[],
}));

vi.mock('./bridge', () => ({
  platformLive: () => platform.live,
  platformRead: async (keys: readonly string[]) => keys.map((key) => platform.kept.get(key) ?? null),
  platformWrite: async (keys: readonly string[], values: readonly string[]) => {
    platform.writes.push({ keys: [...keys], values: [...values] });
    keys.forEach((key, i) => platform.kept.set(key, values[i]));
  },
}));

/** A browser's own storage, as far as the game uses it. */
function browserStorage(): Map<string, string> {
  const items = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    },
  });
  return items;
}

beforeEach(() => {
  platform.live = true;
  platform.kept.clear();
  platform.writes.length = 0;
  vi.resetModules();
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
