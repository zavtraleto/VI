import { parseBoard, printBoard, readBoardHead, type BoardHead, type BoardStatus } from '../levels/boardFile';
import type { Place } from '../levels/library';
import type { LevelSpec } from '../rules/types';
import { PROGRAM_FONT, type Palette } from '../shell/theme';
import { writeBoard } from './boardsClient';
import type { BoardStage } from './boardStage';
import { textOf, type EditBoard } from './editBoard';
import type { Seconds } from './labFacts';
import { wayToKeep, type CampaignBoard } from './workshopCampaign';
import type { BoardFacts } from './workshopFacts';
import { buttonOf } from './workshopListView';
import { plural } from './workshopLists';

/** What the state line over the field is said of: the board in hand, where it stands, and its edits. */
export interface StateOf {
  name: string;
  status: BoardStatus | undefined;
  /** Its place in the row, as the player meets it; null where it has none. */
  place: Place | null;
  /** The batch it was laid in, `bridge 2026-10-16`. */
  batch: string | undefined;
  /** The edits made since it was saved or opened. */
  unsaved: number;
  /** Its file was changed from outside while the edits stood. */
  outside: boolean;
  /** Its file cannot be read as a board: the page writes nothing of it. */
  locked: boolean;
}

const STATUS_WORDS: Readonly<Record<Exclude<BoardStatus, 'R' | 'N'>, string>> = { D: 'черновик', RC: 'хорошая', X: 'убрана' };

/**
 * The state line over the field, in three parts: which board, and where it stands; whether it is
 * saved; and what saving will do. A board of the row is said as the player meets it, by the number
 * of its place and the title of its chapter.
 */
export function stateLine(of: StateOf): string {
  if (of.name === '') return '';
  const { status, place } = of;
  const where =
    status === 'R'
      ? place
        ? `в кампании, уровень ${place.number}, глава «${place.title}»`
        : 'в кампании, без места в row.json'
      : status === 'N'
        ? `новая${of.batch ? `, пачка ${of.batch.split(' ')[0]}` : ''}`
        : status
          ? STATUS_WORDS[status]
          : 'без статуса';
  const saved = of.unsaved === 0 ? 'сохранено' : `не сохранено: ${of.unsaved} ${plural(of.unsaved, ['правка', 'правки', 'правок'])}${of.outside ? '; файл изменён снаружи — сохранить перезапишет его' : ''}`;
  const does = of.locked ? 'файл не читается как доска — страница его не пишет' : status === 'R' && place ? `сохранить — изменит уровень ${place.number} в игре` : 'сохранить — запишет файл доски';
  return `${of.name} — ${where} · ${saved} · ${does}`;
}

/**
 * The edits between the board in hand and the board saved, as steps of the history: `depth` is the
 * steps taken to the board in hand, `saved` those to the board saved, and `fork` the deepest step
 * the two share as it was when the history last branched (a new edit made below the board saved).
 */
export function stepsAway(depth: number, saved: number, fork: number): number {
  const shared = Math.min(depth, fork);
  return depth - shared + (saved - shared);
}

/** What saving a board of the row comes to: wait for the solver, refuse with a line, or write the head given. */
export type RowSave = { kind: 'wait' } | { kind: 'refuse'; line: string } | { kind: 'write'; head: LevelSpec };

const TO_COPY = '«копия» унесёт правку рядом, не трогая уровень';

/**
 * A board of the row is saved only with its fewest moves proved, on the board as the player meets
 * it (`seconds`, counted of `WorkshopRow.asPlayed`), and the way is written with the board in one
 * write: the way proved, or the way the head keeps where it holds (`wayToKeep`). `refused` is what
 * the rules say of the board, where they do not take it.
 */
export function rowSave(board: { extra: BoardHead; head: LevelSpec; locked: boolean }, seconds: Seconds | string | null, refused: string | null): RowSave {
  if (board.locked) return { kind: 'refuse', line: 'файл не читается как доска — страница его не пишет' };
  if (refused !== null) return { kind: 'refuse', line: `правила не принимают доску: ${refused} — не сохранено; ${TO_COPY}` };
  if (seconds === null) return { kind: 'wait' };
  if (typeof seconds === 'string') return { kind: 'refuse', line: `решатель не ответил (${seconds}) — не сохранено; ${TO_COPY}` };
  const { par, exact, way } = seconds.check;
  if (par === null && exact) return { kind: 'refuse', line: `у доски нет решения — в кампанию не сохраняется; ${TO_COPY}` };
  if (par === null || !exact || !way || way.length === 0) return { kind: 'refuse', line: `решатель не доказал минимум — не сохранено; ${TO_COPY}` };
  const proved = wayToKeep({ ...board, extra: { ...board.extra, status: 'R' } }, seconds);
  return { kind: 'write', head: proved ? { ...board.head, ...proved } : board.head };
}

/** The board of a text without what the library says of it (the status, the words, the mark): null where the text is no board. */
function boardPart(text: string, name: string): string | null {
  try {
    return printBoard(parseBoard(text, name, true));
  } catch {
    return null;
  }
}

/** Whether a file changed from outside changed only in its head: the status, the words, the mark, as a verdict or the row writes them. */
export function headOnly(was: string, now: string, name: string): boolean {
  const board = boardPart(was, name);
  return board !== null && board === boardPart(now, name);
}

/** What saving asks of the page it is on. */
export interface SavePage {
  board(): CampaignBoard;
  /** The place of the board in hand in the row, as the player meets it; null where it has none. */
  place(): Place | null;
  stage(): BoardStage;
  facts(): BoardFacts;
  /** What the rules say of the board in hand where they do not take it; null where they do. */
  refused(): string | null;
  /** The board and head were written: `was` is the head the write was begun with, to be taken over only where it is still the one in hand. */
  wrote(head: LevelSpec, board: EditBoard, was: LevelSpec): void;
  /** The head of the file read again, as a verdict or the row wrote it, laid under the edits in hand. */
  takeHead(extra: BoardHead): void;
  /** Reads the file of the board in hand again and puts it on the stage, as it is opened. */
  reload(): Promise<void>;
}

type Choice = 'save' | 'drop' | 'stay';

/**
 * Saving the board in hand (docs/VI_Levels_Lab.md, section 4): edits stay on the page until
 * «сохранить» or `Ctrl+S` writes them, and «отменить» reads the file again. A board of the row is
 * written only with its fewest moves proved, the way in the same write (`rowSave`). The state line
 * over the field says the board, whether it is saved and what saving will do (`stateLine`). Leaving
 * a board with edits asks in a small dialog of the page (`settle`), and closing the tab asks with
 * the browser's own prompt. A file changed from outside is read again where there are no edits; a
 * change of its head alone is laid under them; any other change is said on the line, and saving
 * writes over it.
 */
export class WorkshopSave {
  readonly line = document.createElement('div');
  readonly saveButton: HTMLButtonElement;
  readonly cancelButton: HTMLButtonElement;
  /** The text the file is known to hold. */
  file = '';
  /** The board and head as the file holds them: the edits are what the board in hand differs from them by. */
  private base: { board: EditBoard; head: LevelSpec } | null = null;
  /** Changes of the head (the faces, the rules of the board) since the board was saved: they are no steps of the stage. */
  private headEdits = 0;
  private outside = false;
  /** What the last save said, or the stage: why it was refused, «сначала убери кость». */
  private note = '';
  /** A board of the row waits for its proof to be saved. */
  private proving: { promise: Promise<boolean>; resolve: (saved: boolean) => void } | null = null;
  private readonly dialog = document.createElement('div');
  private readonly asked = document.createElement('div');
  private answer: ((choice: Choice) => void) | null = null;

  constructor(
    palette: Palette,
    private readonly page: SavePage,
  ) {
    this.line.style.cssText = 'flex:1;min-width:240px;white-space:pre-line';
    this.saveButton = buttonOf(palette, 'сохранить (Ctrl+S)', () => void this.save());
    this.cancelButton = buttonOf(palette, 'отменить', () => void this.cancel());
    this.dialog.style.cssText = 'position:fixed;inset:0;z-index:990;display:none;align-items:center;justify-content:center';
    const box = document.createElement('div');
    box.style.cssText = `display:flex;flex-direction:column;gap:10px;padding:14px 16px;max-width:420px;background:${palette.bg};color:${palette.ink};border:1px solid ${palette.ink};font:13px/1.4 ${PROGRAM_FONT}`;
    this.asked.style.whiteSpace = 'pre-line';
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:6px';
    const choice = (label: string, chosen: Choice): HTMLButtonElement => buttonOf(palette, label, () => this.answer?.(chosen));
    buttons.append(choice('сохранить', 'save'), choice('отменить правки', 'drop'), choice('остаться', 'stay'));
    box.append(this.asked, buttons);
    this.dialog.append(box);
    document.body.append(this.dialog);
    window.addEventListener('beforeunload', (event) => {
      if (!this.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  /** The board in hand differs from its file: by its cells, or by its head. A locked board has no edits. */
  get dirty(): boolean {
    const { base } = this;
    const { name, locked, board, head, extra } = this.page.board();
    return base !== null && name !== '' && !locked && textOf(board, head, extra) !== textOf(base.board, base.head, extra);
  }

  /** A board of the row waits for its fewest moves to be proved, to be saved: the solver is asked of it. */
  get waiting(): boolean {
    return this.proving !== null;
  }

  /** The edits since the board was saved or opened. */
  get unsaved(): number {
    return this.dirty ? Math.max(1, this.page.stage().unsaved + this.headEdits) : 0;
  }

  /** The file was read and put on the stage as the board in hand: no edit stands, and a save waited for is dropped. */
  opened(text: string): void {
    const { board, head } = this.page.board();
    this.file = text;
    this.base = { board, head };
    this.headEdits = 0;
    this.outside = false;
    this.note = '';
    this.page.stage().markSaved();
    this.endProof();
    this.show();
  }

  /** The board in hand was edited; `head` where its head was, which is no step of the stage. */
  edited(head = false): void {
    if (head) this.headEdits++;
    this.note = '';
  }

  /** Something the stage or a save says, shown on the line until the next edit. */
  tell(line: string): void {
    this.note = line;
    this.show();
  }

  show(): void {
    const { name, extra, locked } = this.page.board();
    const state = stateLine({ name, status: extra.status, place: this.page.place(), batch: extra.batch, unsaved: this.unsaved, outside: this.outside, locked });
    const note = this.proving ? 'решаю…' : this.note;
    this.line.textContent = note ? `${state}\n${note}` : state;
  }

  /**
   * The file of the board in hand changed on the disk; true where it is to be read again as it is,
   * there being no edits in hand. With edits, a change of its head alone is taken under them, and
   * any other is said: saving writes over it.
   */
  changed(text: string): boolean {
    if (text === this.file) return false;
    if (!this.dirty) return true;
    if (headOnly(this.file, text, this.page.board().name)) this.page.takeHead(readBoardHead(text));
    else this.outside = true;
    this.file = text;
    this.show();
    return false;
  }

  /**
   * «сохранить»: writes the board in hand where it has edits; true where it is written, or there was
   * nothing to write. A board of the row waits for the solver first, and is refused where its fewest
   * moves are not proved: the line says why. It is proved with no edits too: a way proved anew on
   * the faces of its chapter, which its file does not keep, is written.
   */
  save(): Promise<boolean> {
    if (this.proving) return this.proving.promise;
    const board = this.page.board();
    if (board.name === '' || board.locked) return Promise.resolve(true);
    if (board.extra.status !== 'R') return this.dirty ? this.write(board.head) : Promise.resolve(true);
    let resolve: (saved: boolean) => void = () => {};
    const promise = new Promise<boolean>((done) => (resolve = done));
    this.proving = { promise, resolve };
    this.page.facts().ask();
    this.told();
    return promise;
  }

  /** A fact of the board in hand was counted: a save waiting for the proof is written or refused. */
  told(): void {
    if (!this.proving) return;
    const board = this.page.board();
    const decision = rowSave(board, this.page.facts().seconds, this.page.refused());
    if (decision.kind === 'wait') return this.show();
    const { resolve } = this.proving;
    this.proving = null;
    if (decision.kind === 'refuse') {
      this.tell(decision.line);
      return resolve(false);
    }
    // No edits, and the way the file keeps holds: there is nothing to write.
    if (decision.head === board.head && !this.dirty) {
      this.show();
      return resolve(true);
    }
    void this.write(decision.head).then(resolve);
  }

  /** «отменить»: the board is put back as its file has it, read again; nothing is asked. */
  async cancel(): Promise<void> {
    await this.page.reload();
  }

  /**
   * The board in hand is to be left (another board, a new one, a copy, the row, a name): with edits,
   * the dialog asks whether to save them, drop them or stay. True where the page may go on; `why` is
   * said in the dialog, under the question.
   */
  async settle(why = ''): Promise<boolean> {
    if (!this.dirty) return true;
    if (this.answer) return false;
    const { name } = this.page.board();
    const count = this.unsaved;
    this.asked.textContent = `${name}: не сохранено — ${count} ${plural(count, ['правка', 'правки', 'правок'])}${why ? `\n${why}` : ''}`;
    this.dialog.style.display = 'flex';
    const choice = await new Promise<Choice>((done) => (this.answer = done));
    this.answer = null;
    this.dialog.style.display = 'none';
    if (choice === 'stay') return false;
    if (choice === 'save') return this.save();
    await this.cancel();
    return true;
  }

  /** The keys of saving: `Ctrl+S`, and every key while the dialog asks (`Escape` stays). True where the key was one of them. */
  key(event: KeyboardEvent): boolean {
    if (this.answer) {
      event.stopImmediatePropagation();
      if (event.type === 'keydown' && event.code === 'Escape') this.answer('stay');
      return true;
    }
    if (!(event.ctrlKey || event.metaKey) || event.code !== 'KeyS') return false;
    // The browser's own save is never asked.
    event.stopImmediatePropagation();
    event.preventDefault();
    if (event.type === 'keydown' && !event.repeat) void this.save();
    return true;
  }

  /** The proof waited for will not come: the board was opened anew, or read again. */
  private endProof(): void {
    const { proving } = this;
    this.proving = null;
    proving?.resolve(false);
  }

  /** Writes the board in hand with the head given, in one write. */
  private async write(head: LevelSpec): Promise<boolean> {
    const { name, board, extra, head: was } = this.page.board();
    const text = textOf(board, head, extra);
    const before = this.file;
    // The text is known before it is written: the server tells of the change of the file, and this one is no change from outside.
    this.file = text;
    try {
      await writeBoard(name, text);
    } catch (error) {
      if (this.file === text) this.file = before;
      this.tell(`не сохранено: ${(error as Error).message}`);
      return false;
    }
    // Another board was opened meanwhile: it has its own file.
    if (this.page.board().name !== name) return true;
    this.base = { board, head };
    this.headEdits = 0;
    this.outside = false;
    this.note = '';
    const stage = this.page.stage();
    if (stage.current === board) stage.markSaved();
    this.page.wrote(head, board, was);
    return true;
  }
}
