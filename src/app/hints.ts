/** How long a hint stays, in milliseconds. */
const HINT_MS = 4500;

/** One short hint at a time; the ones that come while it is shown wait their turn. */
export class Hints {
  /** The hint on screen now. */
  text: string | null = null;
  private readonly queue: string[] = [];
  private timer: number | null = null;

  show(text: string): void {
    this.queue.push(text);
    if (this.timer === null) this.next();
  }

  reset(): void {
    this.queue.length = 0;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.text = null;
  }

  private next(): void {
    this.timer = null;
    this.text = this.queue.shift() ?? null;
    if (this.text !== null) this.timer = window.setTimeout(() => this.next(), HINT_MS);
  }
}
