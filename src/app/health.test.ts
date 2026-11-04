import { afterEach, describe, expect, it, vi } from 'vitest';
import { nameOf, sourceOf } from './health';

const platform = vi.hoisted(() => ({ said: [] as string[] }));

vi.mock('@platform', () => ({
  platform: { track: (event: string) => platform.said.push(event) },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  platform.said = [];
});

const ORIGIN = 'https://game.example';

describe('what is told of an error', () => {
  it('says whose file it came from, never the address', () => {
    expect(sourceOf(`${ORIGIN}/assets/index-abc.js`, ORIGIN)).toBe('game');
    expect(sourceOf(`${ORIGIN}/assets/vendor-abc.js`, ORIGIN)).toBe('vendor');
    expect(sourceOf(`${ORIGIN}/src/app/game.ts`, ORIGIN)).toBe('game');
    expect(sourceOf(`${ORIGIN}/node_modules/.vite/deps/three.js`, ORIGIN)).toBe('vendor');
    expect(sourceOf('https://sdk.crazygames.com/crazygames-sdk-v3.js', ORIGIN)).toBe('external');
    expect(sourceOf(`${ORIGIN}/playgama-bridge.js`, ORIGIN)).toBe('other');
    expect(sourceOf(null, ORIGIN)).toBe('other');
    expect(sourceOf('not an address', ORIGIN)).toBe('other');
  });

  it('names the error by its kind out of a few, never by what it says', () => {
    expect(nameOf(new TypeError('x is undefined'))).toBe('TypeError');
    expect(nameOf({ name: 'QuotaExceededError' })).toBe('QuotaExceededError');
    expect(nameOf({ name: 'MyOwnError' })).toBe('other');
    expect(nameOf('a string thrown')).toBe('other');
    expect(nameOf(null)).toBe('other');
  });
});

describe('a page that is hidden or put away', () => {
  /** A page with no browser behind it: the window and the document as the listeners of the game and of the SDK see them. */
  async function page(): Promise<{ health: typeof import('./health'); page: EventTarget & { hidden: boolean } }> {
    const doc = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', doc);
    vi.resetModules();
    return { health: await import('./health'), page: doc };
  }

  /** The SDK as Playgama's Bridge 2.3 is: it starts after the health is watched and sends what it holds as the page goes. */
  function bridgeSends(doc: EventTarget): void {
    doc.addEventListener('visibilitychange', () => platform.said.push('sent'));
    window.addEventListener('pagehide', () => platform.said.push('sent'));
  }

  it('what the game says of it comes before the platform sends what it holds', async () => {
    const { health, page: doc } = await page();
    health.watchHealth();
    health.platformStarted();
    bridgeSends(doc);
    health.watchHidden(() => platform.said.push('page_hidden'));
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(platform.said).toEqual(['load_hidden', 'page_hidden', 'sent']);
  });

  it('a tab closed while seen is put away first: it is said then, and the loading is told once', async () => {
    const { health, page: doc } = await page();
    health.watchHealth();
    health.platformStarted();
    bridgeSends(doc);
    const note = vi.fn(() => platform.said.push('page_hidden'));
    health.watchHidden(note);
    window.dispatchEvent(new Event('pagehide'));
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(platform.said.slice(0, 3)).toEqual(['load_hidden', 'page_hidden', 'sent']);
    expect(platform.said.filter((event) => event === 'load_hidden')).toHaveLength(1);
    // Told twice: the game says it once a run (`noteHidden`).
    expect(note).toHaveBeenCalledTimes(2);
  });

  it('a page seen again says nothing', async () => {
    const { health, page: doc } = await page();
    health.watchHealth();
    health.platformStarted();
    const note = vi.fn();
    health.watchHidden(note);
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(note).not.toHaveBeenCalled();
    expect(platform.said).toEqual([]);
  });
});
