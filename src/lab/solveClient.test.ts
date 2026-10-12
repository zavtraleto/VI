import { describe, expect, it } from 'vitest';
import { CANCELLED, SolveClient, type WorkerLike } from './solveClient';

/** A worker that answers when the test says so. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;
  posted: { id: number; board: string }[] = [];
  terminated = false;
  postMessage(message: unknown): void {
    this.posted.push(message as { id: number; board: string });
  }
  terminate(): void {
    this.terminated = true;
  }
  tell(data: unknown): void {
    this.onmessage?.({ data });
  }
}

function client(): { made: FakeWorker[]; asks: SolveClient<{ board: string }, string> } {
  const made: FakeWorker[] = [];
  const asks = new SolveClient<{ board: string }, string>(() => {
    made.push(new FakeWorker());
    return made[made.length - 1];
  });
  return { made, asks };
}

describe('SolveClient', () => {
  it('gives the answer that bears the number of the question', async () => {
    const { made, asks } = client();
    const answer = asks.ask({ board: 'a' });
    expect(made[0].posted).toEqual([{ board: 'a', id: 1 }]);
    made[0].tell({ id: 1, facts: 'of a' });
    await expect(answer).resolves.toBe('of a');
    expect(asks.busy).toBe(false);
  });
  it('drops an answer that bears another number: it is of a board changed since', async () => {
    const { made, asks } = client();
    let told: string | null = null;
    const answer = asks.ask({ board: 'a' }).then((facts) => (told = facts));
    made[0].tell({ id: 99, facts: 'of a board that is gone' });
    await Promise.resolve();
    expect(told).toBeNull();
    expect(asks.busy).toBe(true);
    made[0].tell({ id: 1, facts: 'of a' });
    await answer;
    expect(told).toBe('of a');
  });
  it('stops the worker when a new question comes while one waits, and tells the one that waited', async () => {
    const { made, asks } = client();
    const first = asks.ask({ board: 'a' });
    const second = asks.ask({ board: 'b' });
    await expect(first).rejects.toThrow(CANCELLED);
    expect(made[0].terminated).toBe(true);
    expect(made).toHaveLength(2);
    // What the stopped worker had found, had it got to say it, is not taken for the answer to the new question.
    made[0].tell({ id: 1, facts: 'of a' });
    made[1].tell({ id: 2, facts: 'of b' });
    await expect(second).resolves.toBe('of b');
  });
  it('keeps a worker that has answered for the next question', async () => {
    const { made, asks } = client();
    const first = asks.ask({ board: 'a' });
    made[0].tell({ id: 1, facts: 'of a' });
    await first;
    const second = asks.ask({ board: 'b' });
    expect(made).toHaveLength(1);
    made[0].tell({ id: 2, facts: 'of b' });
    await expect(second).resolves.toBe('of b');
  });
  it('tells of a question the worker could not answer, and of one cancelled by hand', async () => {
    const { made, asks } = client();
    const failed = asks.ask({ board: 'a' });
    made[0].tell({ id: 1, error: 'level a: no die to start on' });
    await expect(failed).rejects.toThrow(/no die to start on/);
    const dropped = asks.ask({ board: 'b' });
    asks.cancel();
    await expect(dropped).rejects.toThrow(CANCELLED);
  });
});
