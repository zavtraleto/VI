/**
 * What the game owes the world outside it and need not pay on the frame of a move: a report to
 * the platform, a write to storage. It is put by here and done once the move is over, on a frame
 * in which nothing moves, so that the frame the die sets off on does only what is seen. Whatever
 * is still owed is paid at once when the page is hidden, the session waits, or the board ends:
 * nothing is lost, and nothing is said out of its order.
 */

/** Frames with nothing moving before what is owed is paid: the frame a die lands on has work of its own. */
const QUIET_FRAMES = 2;

export class Later {
  private jobs: { job: () => void; key: string | null }[] = [];
  private quiet = 0;

  /** Puts a thing by. One with a `key` takes the place of an earlier one with the same key: it is done once. */
  after(job: () => void, key: string | null = null): void {
    if (key !== null) this.jobs = this.jobs.filter((owed) => owed.key !== key);
    this.jobs.push({ job, key });
    this.quiet = 0;
  }

  /** How many things are owed. */
  get owed(): number {
    return this.jobs.length;
  }

  /** Called every frame. `moving` is a move being made on the board. */
  frame(moving: boolean): void {
    if (this.jobs.length === 0) return;
    this.quiet = moving ? 0 : this.quiet + 1;
    if (this.quiet >= QUIET_FRAMES) this.flush();
  }

  /** Pays everything owed now, in the order it was put by. */
  flush(): void {
    const { jobs } = this;
    this.jobs = [];
    this.quiet = 0;
    for (const { job } of jobs) {
      try {
        job();
      } catch {
        // What is owed outside never gets in the way of the game.
      }
    }
  }
}
