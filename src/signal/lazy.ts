/**
 * What the game fetches only when it is wanted, or a little before: a part of the code, a picture.
 * It is asked for once and kept; a fetch that failed is asked for again the next time.
 */
export class Lazy<T> {
  private value: T | null = null;
  private loading: Promise<T | null> | null = null;

  constructor(private readonly fetch: () => Promise<T>) {}

  /** What has come, or null while it has not. */
  get now(): T | null {
    return this.value;
  }

  /** What has come, once it has; null if it could not be fetched. */
  get(): Promise<T | null> {
    if (this.value !== null) return Promise.resolve(this.value);
    this.loading ??= this.fetch().then(
      (value) => (this.value = value),
      () => {
        this.loading = null;
        return null;
      },
    );
    return this.loading;
  }
}

/** What a promise comes to, or null if it has not come in `ms`: what waits for it goes on without it. */
export function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}
