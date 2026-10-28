import { normalSpec, printBoard } from '../levels/boardFile';
import type { LevelSpec } from '../rules/types';
import type { Palette } from '../shell/theme';
import { checkLines } from './checkLines';
import { instantOf, nearInRow, wayedFor, type Instant, type Later, type Near, type RowPlace, type Seconds } from './labFacts';
import { CANCELLED, SolveClient, type WorkerLike } from './solveClient';
import { light } from './workshopListView';

/** The worker the solver and the bots count in, off the page: a worker to a tier. */
const solver = (): WorkerLike => new Worker(new URL('./solve.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;

/**
 * What the workshop counts of the board in hand, and only once it is asked for
 * (docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md, sections 3.3 and 3.4): the
 * solver once «проверить» is open or a way is wanted for «показать решение», the bots only for
 * «проверить». The lines of «проверить» stand in their box under the board and are said again as
 * each fact comes. Another board than the one the facts are of drops them, and stops the workers
 * that count them; an answer of a board that is gone is never shown (the key is the board as
 * text, as on the lab of the levels before).
 */
export class BoardFacts {
  /** The lines of «проверить» are shown. */
  checking = false;
  /** A way is waited for: the solver is asked even with the lines shut. */
  wanted = false;
  /** The solver is asked of a board this holds true of, with the lines shut and no way wanted: a board of the row that keeps no way yet (`WorkshopCampaign`). */
  keep: (spec: LevelSpec) => boolean = () => false;
  /** The place of the board in hand in the row and the places of the row the page has read, or null for a board not of the row: «проверить» says how alike it is to those before it. */
  row: () => { number: number; places: readonly RowPlace[] } | null = () => null;
  /** How alike the board in hand is to the places before it, and its place and the way it was read by: it is read again only by another place or way. */
  private near: { way: string; near: Near[] | null } | null = null;
  private spec: LevelSpec | null = null;
  private error: string | null = null;
  /** The board the facts are of, as text. */
  private measured = '';
  private readonly askSeconds = new SolveClient<{ tier: 'seconds'; spec: LevelSpec }, Seconds>(solver);
  private readonly askLater = new SolveClient<{ tier: 'later'; spec: LevelSpec }, Later>(solver);
  private asked = { seconds: false, later: false };
  instant: Instant | null = null;
  seconds: Seconds | string | null = null;
  later: Later | string | null = null;

  /** `told` hears every fact as it comes. */
  constructor(
    private readonly box: HTMLElement,
    private readonly button: HTMLElement,
    private readonly palette: Palette,
    private readonly told: () => void,
  ) {
    box.style.cssText = 'display:none;margin:0;white-space:pre-wrap;font:inherit';
  }

  /** The board in hand, as the rules take it, or what they say of it. True where it is another board, and what was wanted of the one before is wanted no more. */
  of(spec: LevelSpec | null, error: string | null): boolean {
    this.spec = spec;
    this.error = error;
    const key = spec ? printBoard(normalSpec(spec)) : '';
    if (key === this.measured) return false;
    this.measured = key;
    this.askSeconds.cancel();
    this.askLater.cancel();
    this.asked = { seconds: false, later: false };
    this.instant = null;
    this.seconds = this.later = null;
    this.near = null;
    this.wanted = false;
    this.ask();
    this.show();
    return true;
  }

  /** `C`: the lines are shown under the board, or taken away. */
  toggle(): void {
    this.checking = !this.checking;
    this.ask();
    this.show();
  }

  /** Asks of the board in hand what is wanted of it and not yet asked. */
  ask(): void {
    const { spec, measured: key } = this;
    if (!spec || !(this.checking || this.wanted || this.keep(spec))) return;
    this.instant ??= instantOf(spec);
    if (this.instant.error) return;
    const told = <T>(set: (facts: T | string) => void) => [
      (facts: T): void => {
        if (this.measured !== key) return;
        set(facts);
        this.show();
        this.told();
      },
      (error: Error): void => {
        if (error.message === CANCELLED || this.measured !== key) return;
        set(error.message);
        this.show();
        this.told();
      },
    ] as const;
    if (!this.asked.seconds) {
      this.asked.seconds = true;
      this.askSeconds.ask({ tier: 'seconds', spec }).then(...told<Seconds>((facts) => (this.seconds = facts)));
    }
    if (this.checking && !this.asked.later) {
      this.asked.later = true;
      this.askLater.ask({ tier: 'later', spec }).then(...told<Later>((facts) => (this.later = facts)));
    }
  }

  private show(): void {
    light(this.palette, this.button, this.checking);
    this.box.style.display = this.checking ? '' : 'none';
    if (!this.checking) return;
    // A board the rules do not lay is said in one line, why, as `checkLines` says a board its instant refuses.
    const refused: Instant = { error: this.error ?? 'нет доски', deadEnd: null, dice: 0, groups: [] };
    this.box.textContent = checkLines(this.spec ? this.instant : refused, this.seconds, this.later, this.nearOf()).join('\n');
  }

  /**
   * How alike the board in hand is to the places of the row before it, where it is of the row: read on the page,
   * by the way its file keeps or the solver found (`wayedFor`), and not before there is one.
   */
  private nearOf(): Near[] | undefined {
    const row = this.row();
    const wayed = this.spec && !this.instant?.error && row ? wayedFor(this.spec, this.seconds) : null;
    if (!row || !wayed) return undefined;
    // A board moved to another place of the row is held against other places.
    const way = `${row.number} ${wayed.solution!.join(' ')}`;
    if (this.near?.way !== way) this.near = { way, near: nearInRow(wayed, row.number, row.places) };
    return this.near.near ?? undefined;
  }
}
