import { isBoardName } from '../app/boardProbe';
import { normalSpec, printBoard, type BoardHead } from '../levels/boardFile';
import { ROW_EVENT } from '../levels/row';
import type { LevelSpec } from '../rules/types';
import type { Palette } from '../shell/theme';
import { onBoardChanged, swapBoards, writeBoard } from './boardsClient';
import { rowPathLine } from './checkLines';
import { textOf, type EditBoard } from './editBoard';
import type { Seconds } from './labFacts';
import type { BoardFacts } from './workshopFacts';
import { buttonOf } from './workshopListView';
import { freeName, plural } from './workshopLists';
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
  /** A save of a board of the row waits for its fewest moves to be proved (`WorkshopSave`). */
  proving(): boolean;
}

/** The way a level keeps: the fewest moves, proved, and the moves themselves. */
const keepsWay = (spec: LevelSpec): boolean => spec.par !== undefined && spec.exact === true && (spec.solution?.length ?? 0) > 0;
/** The file a copy of a board of the row was made of, by its `origin`. */
const COPY_OF = /^копия (\S+)$/;

/**
 * Whether the solver is to be asked after a board of the row by itself: it keeps no way, or the
 * board it plays as in its chapter (`played`, `WorkshopRow.asPlayed`) is not the board of its file,
 * on other faces or with the floor opened, and the way the file keeps was proved on another board.
 */
export function wantsProof(file: LevelSpec | null, played: LevelSpec): boolean {
  return !keepsWay(played) || file === null || printBoard(normalSpec(file)) !== printBoard(normalSpec(played));
}

/**
 * The way the board in hand is to keep now, or null. `seconds` is counted of the board as the row
 * plays it, on the faces of its chapter (`WorkshopRow.asPlayed`), as `src/levels/row.test.ts` holds
 * its way. A board of the row, not locked, with the fewest moves proved, keeps the way proved
 * unless the way its head keeps holds on that board: the same fewest moves (`kept: same`), in a
 * way of as many moves. A head that keeps the very way proved keeps it already. An empty way is
 * no way kept (`keepsWay`). It is written only by a save (`rowSave` in `workshopSave.ts`).
 */
export function wayToKeep(board: Pick<CampaignBoard, 'extra' | 'head' | 'locked'>, seconds: Seconds | string | null): Required<Pick<LevelSpec, 'par' | 'exact' | 'solution'>> | null {
  if (board.extra.status !== 'R' || board.locked || !seconds || typeof seconds === 'string') return null;
  const { par, exact, way, kept } = seconds.check;
  if (!exact || par === null || !way || way.length === 0) return null;
  const { head } = board;
  if (keepsWay(head) && head.par === par && head.solution!.length === par && (kept === 'same' || head.solution!.join(' ') === way.join(' '))) return null;
  return { par, exact: true, solution: way };
}

/**
 * A board of the campaign edited on the workshop (docs/superpowers/specs/2026-10-15-vi-level-workshop-design.md,
 * section 11.2). Edited directly, a board of the row (`R`) that keeps no shortest way has the
 * solver ask after it by itself, and a line over the board says why the row will not be laid; the
 * way is written into its file by a save, which waits for the proof (`WorkshopSave`): the row
 * asks every board of it for one. The same line says the row the dev server could not lay, in
 * place of the overlay of Vite. «копия» lays the board beside, as `<код>-try-<n>`, to be changed
 * and played as any; on such a copy «заменить в ряду <код>» gives its board to the file of the
 * row, whose code, place and the progress of the players stay, and the copy takes the board that was.
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
    facts.keep = (played) => this.page.proving() || (this.page.board().extra.status === 'R' && wantsProof(this.page.board().spec, played));
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

  /**
   * The board in hand was opened, changed or read again, or its stage unlocked: the solver is asked
   * of it where its way is wanted, and the line and the buttons are as it has them.
   */
  show(): void {
    this.facts.ask();
    const { name, extra } = this.page.board();
    this.copyButton.style.display = extra.status === 'R' ? '' : 'none';
    const code = this.codeOf(name, extra);
    this.swapButton.style.display = code ? '' : 'none';
    if (code) this.swapButton.textContent = `заменить в ряду ${code}`;
    this.told();
  }

  /** A fact of the board in hand was counted: the line says it. */
  told(): void {
    this.showLine();
  }

  /** The row was laid again, or will be, on a board of it written: what the dev server said of the row before is said no more. */
  private laid(): void {
    this.refused = null;
    this.showLine();
  }

  private showLine(): void {
    const board = this.page.board();
    const { extra, head, spec } = board;
    let line = this.refused === null ? null : `ряд не соберётся: ${this.refused}`;
    if (line === null && extra.status === 'R' && !keepsWay(head)) {
      const refused = !spec || this.facts.instant?.error;
      line = rowPathLine(extra.status, refused ? 'правила не принимают доску' : this.facts.seconds);
    }
    // A way proved that the file does not keep is written by a save, and by nothing else.
    const way = line === null ? wayToKeep(board, this.facts.seconds) : null;
    if (way) line = `доказан путь в ${way.par} ${plural(way.par, ['ход', 'хода', 'ходов'])} — «сохранить» запишет его в файл`;
    this.line.textContent = line ?? '';
    this.line.style.display = line === null ? 'none' : '';
  }

  /** The code of the board of the row a board is a copy of, where that board is in the row still. A copy given the board of the row (`RC`) holds the board that was: it is not swapped back. */
  private codeOf(name: string, extra: BoardHead): string | null {
    if (extra.status === 'RC') return null;
    const code = COPY_OF.exec(extra.origin ?? '')?.[1];
    return code && code.toLowerCase() !== name.toLowerCase() && this.row.holds(code) ? code : null;
  }

  /**
   * «копия»: the board of the row in hand, as it is drawn, laid beside as `<код>-try-<n>` and opened;
   * a board to be done, made of the code. With edits, the dialog asks of the board of the row first:
   * saved, the copy has the way proved too; dropped, the file of the row is as it was, and the copy
   * takes the edits away with it.
   */
  private async copy(): Promise<void> {
    if (this.busy) return;
    const drawn = this.page.board();
    const { name: code, locked } = drawn;
    if (locked) return this.page.say('не скопировано: файл не читается как доска');
    const name = freeName(`${code}-try`, this.page.names());
    if (!isBoardName(name)) return this.page.say(`не имя доски: ${name}`);
    this.busy = true;
    try {
      if (!(await this.page.settle('копия возьмёт доску, как она нарисована'))) return;
      const now = this.page.board();
      const { head, board } = now.board === drawn.board ? now : drawn;
      // The words, the mark, the names it had and the batch are of the board of the row, not of its copy.
      const { extra } = now;
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
   * «заменить в ряду <код>»: the edits of the copy are saved or dropped (`settle`), then the server swaps
   * the boards of the two files (`swapBoards`), both or neither. While it works the stage is locked;
   * swapped, it stays locked until the board of the row is opened, so that no change made meanwhile
   * writes the copy's board over the one the copy now holds. Refused, the line is said; where the copy
   * is still in hand the lock is put back, and what was counted meanwhile is taken.
   */
  private async replace(): Promise<void> {
    const { name, extra } = this.page.board();
    const code = this.codeOf(name, extra);
    if (this.busy || !code) return;
    this.busy = true;
    const stage = this.page.stage();
    let locked = stage.locked;
    try {
      if (!(await this.page.settle())) return;
      // Dropped, the edits were read away and the stage is as the file opened it.
      locked = stage.locked;
      stage.locked = true;
      await swapBoards(code, name);
    } catch (error) {
      this.page.say(`не заменено: ${refusal(error as Error)}`);
      if (this.page.board().name !== name) return;
      stage.locked = locked;
      // The file is as it was: what was counted while the stage was locked is taken now.
      return this.show();
    } finally {
      this.busy = false;
    }
    await this.page.readLists();
    await this.page.open(code);
    this.page.say(`${code}: в ряду доска ${name}; в ${name} — прежняя доска, RC`);
  }
}
