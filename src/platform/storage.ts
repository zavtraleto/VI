import { platform } from '@platform';
import type { PlatformStorage } from './platform';

/**
 * The only place that talks to persistent storage. On a platform the data is kept by its SDK,
 * which may keep it with the player's account; the game reads it once at the start and works
 * on that copy. Without a platform it is the storage of the browser. The game keeps working
 * when neither is available.
 */
let available = true;
/** What the platform kept at the start, and what has been saved since; null without a platform. */
let kept: Map<string, string> | null = null;
/** Where it goes on a platform: what `kept` was read from. */
let store: PlatformStorage | null = null;
/** Failures already told this visit, by kind: each is told once. */
const told = new Set<string>();

/**
 * A save that did not go through, or what is kept that could not be read, for the analytics of
 * the platform: here the player may lose progress. Told once a visit for each kind.
 */
function tellFailure(stage: 'read' | 'write' | 'parse', where: 'platform' | 'browser'): void {
  const key = `${stage}|${where}`;
  if (told.has(key)) return;
  told.add(key);
  try {
    platform.track('save_failed', { stage, store: where });
  } catch {
    // Analytics never gets in the way of the game.
  }
}

/** Reads everything the game keeps, in one call, before anything asks for it. */
export async function openStorage(keys: readonly string[]): Promise<void> {
  const platformStore = platform.storage;
  if (!platformStore) return;
  try {
    const values = await platformStore.read(keys);
    kept = new Map();
    store = platformStore;
    keys.forEach((key, i) => {
      // What an earlier version left in the browser itself is taken over once.
      const value = values[i] ?? local(key);
      if (value !== null) kept!.set(key, value);
    });
  } catch {
    // The platform cannot be read: the browser's own storage is used.
    tellFailure('read', 'platform');
    kept = null;
    store = null;
  }
}

function local(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadJson<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = kept ? (kept.get(key) ?? null) : window.localStorage.getItem(key);
    return raw === null ? fallback : { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    available = false;
    tellFailure(raw === null ? 'read' : 'parse', kept ? 'platform' : 'browser');
    return fallback;
  }
}

/** Whether anything is kept under the key: a player who has been here before. */
export function hasSaved(key: string): boolean {
  if (kept) return kept.has(key);
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Saves several things together. On a platform they go in one call, as the platform asks:
 * whatever is saved at the same moment is handed over at once, not key by key.
 */
export function saveAll(entries: readonly (readonly [key: string, value: unknown])[]): boolean {
  try {
    const keys = entries.map(([key]) => key);
    const raws = entries.map(([, value]) => JSON.stringify(value));
    if (kept && store) {
      keys.forEach((key, i) => kept!.set(key, raws[i]));
      // The platform answers later; a save it refuses shows in `storageAvailable`.
      store.write(keys, raws).then(
        () => (available = true),
        () => {
          available = false;
          tellFailure('write', 'platform');
        },
      );
    } else {
      keys.forEach((key, i) => window.localStorage.setItem(key, raws[i]));
    }
    return true;
  } catch {
    available = false;
    tellFailure('write', kept && store ? 'platform' : 'browser');
    return false;
  }
}

export function saveJson(key: string, value: unknown): boolean {
  return saveAll([[key, value]]);
}

export function storageAvailable(): boolean {
  return available;
}
