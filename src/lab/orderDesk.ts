import { byOrder, type OrderOffer } from '../levels/orderSearch';
import { orderText, type Order } from '../levels/orders';
import { sameBoard } from '../levels/variety';
import type { LevelSpec } from '../rules/types';
import { CANCELLED, SolveClient, type WorkerLike } from './solveClient';

/** What a worker is asked for an order, without its number, and what it answers. */
export interface OrderQuestion {
  tier: 'order';
  order: Order;
  from: number;
  budgetMs: number;
  skip: LevelSpec[];
}
export interface OrderAnswer {
  offers: OrderOffer[];
  tried: number;
  next: number;
}

/**
 * Seconds a worker searches before it answers, and the seeds between where one worker begins and
 * the next. The workers stay under ten thousand between them: above it a seed lays a board
 * another way (`generate.ts`), and a worker begun there would lay the boards of another again.
 */
const BUDGET_MS = 3000;
const STRIDE = 2000;
/** Boards that meet the order kept in stock: with so many waiting, the workers rest. */
const STOCK = 3;

/**
 * The boards of an order as the page asks for them: the first in a few seconds, and after it
 * another at once. A board takes the solver a good part of a second, so one search of three
 * seconds sees a dozen boards and seldom one that meets a narrow order; several workers search
 * at once, each from seeds of its own, and go on searching after the first board is given, so
 * that a stock of boards that meet the order is there when another is asked for. The best board
 * known is given at once, with what it misses where it misses anything; a better one found
 * later is given next.
 *
 * The desk belongs to one order at a time: a new order stops the workers in the middle of their
 * search and empties the stock.
 */
export class OrderDesk {
  private readonly workers: SolveClient<OrderQuestion, OrderAnswer>[];
  private key = '';
  private order: Order | null = null;
  /** Boards found and not yet given, the best first; boards given, which are not offered again. */
  private stock: OrderOffer[] = [];
  private given: LevelSpec[] = [];
  private nextSeed: number[] = [];
  private tried = 0;
  private waiting: ((offer: OrderOffer | null) => void) | null = null;
  private rounds = 0;

  constructor(
    make: () => WorkerLike,
    /** Told whenever the stock or the count of seeds tried changes. */
    private readonly onChange: () => void,
    count = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2)),
  ) {
    this.workers = Array.from({ length: count }, () => new SolveClient<OrderQuestion, OrderAnswer>(make));
  }

  /** Boards that meet the order waiting to be given, and all boards waiting; seeds tried for the order so far; whether the workers are searching. */
  get status(): { exact: number; waiting: number; tried: number; searching: boolean } {
    return { exact: this.stock.filter((offer) => offer.misses.length === 0).length, waiting: this.stock.length, tried: this.tried, searching: this.workers.some((worker) => worker.busy) };
  }

  /**
   * The next board of an order: from the stock where a board that meets the order waits there,
   * and else the best found when the workers next answer. An order other than the one in hand
   * begins anew. Null where the workers found no board at all.
   */
  next(order: Order): Promise<OrderOffer | null> {
    const key = orderText(order);
    if (key !== this.key) {
      this.cancel();
      this.key = key;
      this.order = order;
      this.nextSeed = this.workers.map((_, index) => 1 + index * STRIDE);
    }
    this.waiting?.(null);
    this.waiting = null;
    if (this.stock.some((offer) => offer.misses.length === 0)) {
      const offer = this.take();
      this.search();
      return Promise.resolve(offer);
    }
    this.search();
    return new Promise((resolve) => (this.waiting = resolve));
  }

  /** Stops the search and forgets the order. */
  cancel(): void {
    this.key = '';
    this.order = null;
    this.stock = [];
    this.given = [];
    this.tried = 0;
    this.rounds = 0;
    for (const worker of this.workers) worker.cancel();
    this.waiting?.(null);
    this.waiting = null;
  }

  private take(): OrderOffer | null {
    const offer = this.stock.shift() ?? null;
    if (offer) this.given.push(offer.spec);
    this.onChange();
    return offer;
  }

  /** Sets every worker that rests to search, unless the stock is full. */
  private search(): void {
    const { order, key } = this;
    if (!order || this.status.exact >= STOCK) return;
    this.workers.forEach((worker, index) => {
      if (worker.busy) return;
      const skip = [...this.given, ...this.stock.map((offer) => offer.spec)];
      worker.ask({ tier: 'order', order, from: this.nextSeed[index], budgetMs: BUDGET_MS, skip }).then(
        (answer) => {
          if (key !== this.key) return;
          this.nextSeed[index] = answer.next;
          this.tried += answer.tried;
          for (const offer of answer.offers) {
            if ([...this.given, ...this.stock.map((kept) => kept.spec)].some((other) => sameBoard(other, offer.spec))) continue;
            this.stock.push(offer);
          }
          this.stock.sort(byOrder);
          this.stock.length = Math.min(this.stock.length, 12);
          this.answered();
        },
        (error: Error) => {
          if (error.message !== CANCELLED) console.error(error);
        },
      );
    });
    this.onChange();
  }

  /** A worker has answered: whoever waits for a board gets the best there is once every worker of the round has had its say, and the search goes on. */
  private answered(): void {
    this.rounds++;
    const everyone = this.rounds >= this.workers.length || this.stock.some((offer) => offer.misses.length === 0);
    if (this.waiting && everyone) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve(this.take());
    }
    this.onChange();
    this.search();
  }
}
