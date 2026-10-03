import { platformLive, platformRead, platformWrite } from './bridge';

/**
 * The only place that talks to persistent storage. On a platform the data is kept by its SDK,
 * which may keep it with the player's account; the game reads it once at the start and works
 * on that copy. Without a platform it is the storage of the browser. The game keeps working
 * when neither is available.
 */
let available = true;
/** What the platform kept at the start, and what has been saved since; null without a platform. */
let kept: Map<string, string> | null = null;

/** Reads everything the game keeps, in one call, before anything asks for it. */
export async function openStorage(keys: readonly string[]): Promise<void> {
  if (!platformLive()) return;
  try {
    const values = await platformRead(keys);
    kept = new Map();
    keys.forEach((key, i) => {
      // What an earlier version left in the browser itself is taken over once.
      const value = values[i] ?? local(key);
      if (value !== null) kept!.set(key, value);
    });
  } catch {
    // The platform cannot be read: the browser's own storage is used.
    kept = null;
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
  try {
    const raw = kept ? (kept.get(key) ?? null) : window.localStorage.getItem(key);
    return raw === null ? fallback : { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    available = false;
    return fallback;
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
    if (kept) {
      keys.forEach((key, i) => kept!.set(key, raws[i]));
      // The platform answers later; a save it refuses shows in `storageAvailable`.
      platformWrite(keys, raws).then(
        () => (available = true),
        () => (available = false),
      );
    } else {
      keys.forEach((key, i) => window.localStorage.setItem(key, raws[i]));
    }
    return true;
  } catch {
    available = false;
    return false;
  }
}

export function saveJson(key: string, value: unknown): boolean {
  return saveAll([[key, value]]);
}

export function storageAvailable(): boolean {
  return available;
}
