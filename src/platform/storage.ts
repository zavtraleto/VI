/**
 * The only place that talks to persistent storage. A platform SDK replaces the body of
 * these two functions later; the game keeps working when storage is unavailable.
 */
let available = true;

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    available = false;
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    available = false;
    return false;
  }
}

export function storageAvailable(): boolean {
  return available;
}
