/** As much of a worker as the client leans on: the tests give it one that is no worker. */
export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
}

/** What is said of a question that was dropped for a newer one. */
export const CANCELLED = 'cancelled';

/**
 * One question at a time to a worker, and the answer to it only. A question is numbered; an
 * answer that bears another number is of a board that is not asked about any more, and is
 * dropped. A new question while one waits stops the worker in the middle of its work, which is
 * the only way a search is stopped, and the question that waited is told it was cancelled; the
 * next one starts a worker anew. The page keeps a client to a tier, so that a quick answer does
 * not wait behind a slow one.
 */
export class SolveClient<Q extends object, A> {
  private worker: WorkerLike | null = null;
  private nextId = 1;
  private waiting: { id: number; resolve: (answer: A) => void; reject: (error: Error) => void } | null = null;

  constructor(private readonly make: () => WorkerLike) {}

  /** Whether a question waits for its answer. */
  get busy(): boolean {
    return this.waiting !== null;
  }

  ask(question: Q): Promise<A> {
    this.cancel();
    const id = this.nextId++;
    const worker = (this.worker ??= this.wired());
    return new Promise<A>((resolve, reject) => {
      this.waiting = { id, resolve, reject };
      worker.postMessage({ ...question, id });
    });
  }

  /** Drops the question that waits, if one does: the worker is stopped, and whoever asked is told. */
  cancel(): void {
    const { waiting } = this;
    if (!waiting) return;
    this.waiting = null;
    this.worker?.terminate();
    this.worker = null;
    waiting.reject(new Error(CANCELLED));
  }

  private wired(): WorkerLike {
    const worker = this.make();
    worker.onmessage = ({ data }) => {
      const told = data as { id: number; error?: string; facts?: A };
      const { waiting } = this;
      // An answer to a question that is not the one waiting is of a board that has been changed since.
      if (!waiting || told.id !== waiting.id) return;
      this.waiting = null;
      if (told.error !== undefined) waiting.reject(new Error(told.error));
      else waiting.resolve(told.facts as A);
    };
    worker.onerror = (event) => {
      const { waiting } = this;
      this.waiting = null;
      this.worker?.terminate();
      this.worker = null;
      waiting?.reject(new Error(event.message ?? 'the worker failed'));
    };
    return worker;
  }
}
