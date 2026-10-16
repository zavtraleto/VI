import { isBoardName } from '../app/boardProbe';
import type { BoardHead } from '../levels/boardFile';
import { ROW_EVENT } from '../levels/row';
import type { LevelSpec } from '../rules/types';
import type { Palette } from '../shell/theme';
import { onBoardChanged, swapBoards, writeBoard } from './boardsClient';
import { rowPathLine } from './checkLines';
import { textOf, type EditBoard } from './editBoard';
import type { BoardFacts } from './workshopFacts';
import { buttonOf } from './workshopListView';
import { freeName } from './workshopLists';
import { refusal, type RowPage, type WorkshopRow } from './workshopRow';

/** The board in hand as the page has it. */
export interface CampaignBoard {
  name: string;
  /** The head of the level, and what the file says besides: the status, the origin, the words. */
  head: LevelSpec;
  extra: BoardHead;
  /** The board as a level, where the rules take it for one. */
  spec: LevelSpec | null;
  board: EditBoard;
  /** The file cannot be read as a board: the page writes nothing of it. */
  locked: boolean;
}

/** What the campaign asks of the page it is on, besides what the row does. */
export interface CampaignPage extends RowPage {
  board(): CampaignBoard;
  names(): string[];
  /** Lays the way the solver proved into the head of the board in hand, and writes the file. */
  keep(way: Required<Pick<LevelSpec, 'par' | 'exact' | 'solution'>>): void;
}

/** The way a level keeps: the fewest moves, proved, and the moves themselves. */
const keepsWay = (spec: LevelSpec): boolean => spec.par !== undefined && spec.exact === true && (spec.solution?.length ?? 0) > 0;
/** The file a copy of a board of the row was made of, by its `origin`. */
const COPY_OF = /^копия (\S+)$/;

/**
 * A board of the campaign edited on the workshop (docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md,
 * section 11.2). Edited directly, a board of the row (`R`) that keeps no shortest way has the
 * solver ask after it by itself, and the way is written into its file as soon as the fewest moves
 * are proved: the row asks every board of it for one. Until then a line over the board says why
 * the row will not be laid; the same line says the row the dev server could not lay, in place of
 * the overlay of Vite. «копия» lays the board beside, as `<код>-try-<n>`, to be changed and played
 * as any; on such a copy «заменить в ряду <код>» gives its board to the file of the row, whose
 * code, place and the progress of the players stay, and the copy takes the board that was.
 */
export class WorkshopCampaign {
  /** The line over the board: why the row will not be laid; empty where nothing stops it. */
  readonly line = document.createElement('div');
  readonly copyButton: HTMLButtonElement;
  readonly swapButton: HTMLButtonElement;
  /** What the dev server said where it could not lay the row; null since it laid it, or a board of it was written again. */
  private refused: string | null = null;
  private busy = false;

  constructor(
    palette: Palette,
    private readonly facts: BoardFacts,
    private readonly row: WorkshopRow,
    private readonly page: CampaignPage,
  ) {
    this.line.style.cssText = `flex-basis:100%;color:${palette.dim}`;
    this.copyButton = buttonOf(palette, 'копия', () => void this.copy());
    this.swapButton = buttonOf(palette, '', () => void this.replace());
    facts.keep = (spec) => this.page.board().extra.status === 'R' && !keepsWay(spec);
    // The row the dev server could not lay is said here, and the overlay of Vite does not cover the page; an error of the code, which has a file to it, keeps its overlay.
    import.meta.hot?.on('vite:error', ({ err }) => {
      if (err.id || err.plugin || err.loc || err.frame) return;
      this.refused = err.message.split('\n')[0];
      // The overlay is laid just after its listeners are told.
      window.setTimeout(() => document.querySelectorAll('vite-error-overlay').forEach((one) => one.remove()));
      this.showLine();
    });
    // A board of the row written is laid again on the server: it is told before the row is, and a row not laid says it again.
    onBoardChanged((name) => this.row.holds(name) && this.laid());
    window.addEventListener(ROW_EVENT, () => this.laid());
  }

  /** The board in hand was opened, changed or read again: the solver is asked of it where its way is wanted, and the line and the buttons are as it has them. */
  show(): void {
    this.facts.ask();
    const { name, extra } = this.page.board();
    this.copyButton.style.display = extra.status === 'R' ? '' : 'none';
    const code = this.codeOf(name, extra);
    this.swapButton.style.display = code ? '' : 'none';
    if (code) this.swapButton.textContent = `заменить в ряду ${code}`;
    this.showLine();
  }

  /** A fact of the board in hand was counted: the fewest moves proved, a board of the row with no way keeps them. */
  told(): void {
    const { extra, head, locked } = this.page.board();
    const { seconds } = this.facts;
    if (extra.status === 'R' && !locked && !keepsWay(head) && seconds && typeof seconds !== 'string') {
      const { par, exact, way } = seconds.check;
      // An empty way is no way kept (`keepsWay`): written, it would have the solver asked again and again.
      if (exact && par !== null && way && way.length > 0) return this.page.keep({ par, exact: true, solution: way });
    }
    this.showLine();
  }

  /** The row was laid again, or will be, on a board of it written: what the dev server said of the row before is said no more. */
  private laid(): void {
    this.refused = null;
    this.showLine();
  }

  private showLine(): void {
    const { extra, head, spec } = this.page.board();
    let line = this.refused === null ? null : `ряд не соберётся: ${this.refused}`;
    if (line === null && extra.status === 'R' && !keepsWay(head)) {
      const refused = !spec || this.facts.instant?.error;
      line = rowPathLine(extra.status, refused ? 'правила не принимают доску' : this.facts.seconds);
    }
    this.line.textContent = line ?? '';
    this.line.style.display = line === null ? 'none' : '';
  }

  /** The code of the board of the row a board is a copy of, where that board is in the row still. */
  private codeOf(name: string, extra: BoardHead): string | null {
    const code = COPY_OF.exec(extra.origin ?? '')?.[1];
    return code && code.toLowerCase() !== name.toLowerCase() && this.row.holds(code) ? code : null;
  }

  /** «копия»: the board of the row in hand, as it stands, laid beside as `<код>-try-<n>` and opened; a board to be done, made of the code. */
  private async copy(): Promise<void> {
    if (this.busy) return;
    const { name: code, locked } = this.page.board();
    if (locked) return this.page.say('не скопировано: файл не читается как доска');
    const name = freeName(`${code}-try`, this.page.names());
    if (!isBoardName(name)) return this.page.say(`не имя доски: ${name}`);
    this.busy = true;
    try {
      if (!(await this.page.save())) return;
      // The words, the mark, the names it had and the batch are of the board of the row, not of its copy.
      const { head, board, extra } = this.page.board();
      const { words: _words, mark: _mark, was: _was, batch: _batch, migrated: _migrated, ...rest } = extra;
      await writeBoard(name, textOf(board, { ...head, id: name }, { ...rest, status: 'D', origin: `копия ${code}` }));
    } catch (error) {
      return this.page.say(`не скопировано: ${(error as Error).message}`);
    } finally {
      this.busy = false;
    }
    await this.page.readLists();
    await this.page.open(name);
    this.page.say(`${name}: копия ${code}`);
  }

  /**
   * «заменить в ряду <код>»: what waits to be written of the copy is written, then the server swaps
   * the boards of the two files (`swapBoards`), both or neither. While it works the stage is locked;
   * swapped, it stays locked until the board of the row is opened, so that no change made meanwhile
   * writes the copy's board over the one the copy now holds. Refused, the line is said, and the lock
   * is put back where the copy is still in hand.
   */
  private async replace(): Promise<void> {
    const { name, extra } = this.page.board();
    const code = this.codeOf(name, extra);
    if (this.busy || !code) return;
    this.busy = true;
    const stage = this.page.stage();
    const locked = stage.locked;
    try {
      if (!(await this.page.save())) return;
      stage.locked = true;
      await swapBoards(code, name);
    } catch (error) {
      if (this.page.board().name === name) stage.locked = locked;
      return this.page.say(`не заменено: ${refusal(error as Error)}`);
    } finally {
      this.busy = false;
    }
    await this.page.readLists();
    await this.page.open(code);
    this.page.say(`${code}: в ряду доска ${name}; в ${name} — прежняя доска, RC`);
  }
}
